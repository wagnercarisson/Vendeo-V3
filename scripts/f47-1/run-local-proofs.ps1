# F47.1 - Runner fail-closed: aplica SOMENTE a migration autorada no destino
# local aprovado e executa as provas reais em Postgres local isolado.
#
# Garantias:
#   * Valida workdir, project_id, containers, API/DB em portas loopback
#     separadas, ausencia de destino remoto/Vercel e SHA-256 da migration.
#   * Aplica APENAS com `supabase migration up --local`.
#   * NUNCA usa db push, --linked, reset, migration repair, push ou deploy.
#   * Nao chama provider pago.
#
# Uso:
#   powershell -NoProfile -File scripts/f47-1/run-local-proofs.ps1
#   powershell -NoProfile -File scripts/f47-1/run-local-proofs.ps1 -ProofsOnly
param(
  [string]$Workdir = "G:\Vendeo-Homolog",
  [string]$ProjectId = "vendeo-homolog",
  [int]$ApiPort = 57781,
  [int]$DbPort = 57782,
  [string]$ExpectedMigration = "20261024141422_f47_1_visual_signature_model_config.sql",
  [string]$ExpectedSha256 = "B352F93EFA1B2F829E5D97FFAA79F7972CF3D7696C6B7CEB40EBFC517A26AA90",
  [switch]$ProofsOnly
)

$ErrorActionPreference = "Stop"
$script:Failures = @()

function Get-LfNormalizedSha256([string]$Path) {
  $text = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) -replace "`r`n", "`n"
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text))
    return (($bytes | ForEach-Object { $_.ToString("X2") }) -join "")
  } finally {
    $sha.Dispose()
  }
}

$RepoRoot       = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ConfigToml     = Join-Path $Workdir "supabase\config.toml"
$WorkdirMigs    = Join-Path $Workdir "supabase\migrations"
$RepoMigration  = Join-Path $RepoRoot ("supabase\migrations\" + $ExpectedMigration)
$WorkdirMigration = Join-Path $WorkdirMigs $ExpectedMigration
$Preflight      = Join-Path $PSScriptRoot "preflight.ps1"
$ProofsScript   = Join-Path $RepoRoot "supabase\proofs\f47_1_visual_signature_model_config_proofs.mjs"
$ExpectedVersion = ($ExpectedMigration -split "_")[0]

function Check([string]$Label, [bool]$Ok) {
  if ($Ok) { Write-Output "  ok   $Label" }
  else { $script:Failures += $Label; Write-Output "  FAIL $Label" }
}

function Unquote([string]$v) {
  if ($null -eq $v) { return "" }
  return ($v.Trim().Trim('"').Trim("'")).Trim()
}

function Uri-Host([string]$u) { try { return ([System.Uri]$u).Host } catch { return "" } }
function Uri-Port([string]$u) { try { return ([System.Uri]$u).Port } catch { return 0 } }
function Is-LoopbackHost([string]$h) { return @("127.0.0.1", "localhost", "::1") -contains $h }

function Invoke-Cli([string[]]$Argv) {
  $outFile = [System.IO.Path]::GetTempFileName()
  $errFile = [System.IO.Path]::GetTempFileName()
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $code = 1
  try {
    & npx @Argv 1> $outFile 2> $errFile
    $code = $LASTEXITCODE
  }
  finally { $ErrorActionPreference = $prev }
  $stdout = @(Get-Content $outFile -ErrorAction SilentlyContinue)
  Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
  return @{ ExitCode = $code; StdOut = $stdout }
}

function Get-LedgerVersions {
  $out = @(docker exec "supabase_db_$ProjectId" psql -U postgres -tAc "select version::text from supabase_migrations.schema_migrations" 2>$null)
  $code = $LASTEXITCODE
  $versions = @()
  foreach ($line in $out) {
    $v = "$line".Trim()
    if ($v -ne "") { $versions += $v }
  }
  return @{ ExitCode = $code; Versions = $versions }
}

Write-Output "== F47.1 run-local-proofs (mode=$(if ($ProofsOnly) { 'ProofsOnly' } else { 'apply+proofs' })) =="

# ---------------------------------------------------------------------------
# (1) Destino local aprovado
# ---------------------------------------------------------------------------
Check "workdir local existe" (Test-Path $Workdir)

$projectOk = $false
if (Test-Path $ConfigToml) {
  $cfg = Get-Content $ConfigToml -Raw
  $match = [regex]::Match($cfg, '(?m)^\s*project_id\s*=\s*"([^"]+)"')
  $declared = if ($match.Success) { $match.Groups[1].Value } else { "" }
  $projectOk = ($declared -eq $ProjectId)
  Write-Output "  info project_id declarado: $declared"
}
Check "config.toml declara project_id = $ProjectId" $projectOk

$running = @()
try { $running = @(docker ps --format "{{.Names}}|{{.Status}}" 2>$null) } catch { $running = @() }
function Container-Status([string]$name) {
  $hit = @($running | Where-Object { "$_" -like "$name|*" }) | Select-Object -First 1
  if ($null -eq $hit) { return $null }
  return (("$hit" -split "\|", 2)[1]).Trim()
}
function Is-Up([string]$s) { return ($null -ne $s) -and ($s -match '^Up\b') }
function Is-Healthy([string]$s) { return ($null -ne $s) -and ($s -match '\(healthy\)') }
foreach ($suffix in @("db", "auth", "rest", "storage", "kong")) {
  $name = "supabase_${suffix}_$ProjectId"
  $status = Container-Status $name
  if ($suffix -in @("db", "auth", "storage")) {
    Check "container $name Up/healthy" (Is-Healthy $status)
  } else {
    Check "container $name Up" (Is-Up $status)
  }
}
$productionLike = @($running | Where-Object { "$_" -match '^supabase_db_(vendeo|vendeo-prod)\|' })
Check "nenhum container de producao nomeado 'vendeo' em execucao" (@($productionLike).Count -eq 0)

# ---------------------------------------------------------------------------
# (2) supabase status - API e DB validados SEPARADAMENTE
# ---------------------------------------------------------------------------
$status = Invoke-Cli @("--no-install", "supabase", "status", "--workdir", $Workdir, "-o", "env")
Check "supabase status exit 0" ($status.ExitCode -eq 0)

$apiUrl = ""
$dbUrl = ""
foreach ($line in $status.StdOut) {
  if ("$line" -match "^\s*API_URL\s*=") { $apiUrl = Unquote (("$line" -split "=", 2)[1]) }
  if ("$line" -match "^\s*DB_URL\s*=")  { $dbUrl  = Unquote (("$line" -split "=", 2)[1]) }
}
$apiHost = Uri-Host $apiUrl
$apiPortActual = Uri-Port $apiUrl
$dbHost = Uri-Host $dbUrl
$dbPortActual = Uri-Port $dbUrl
$apiOk = ($apiUrl -ne "") -and (Is-LoopbackHost $apiHost) -and ($apiPortActual -eq $ApiPort)
$dbOk = ($dbUrl -ne "") -and (Is-LoopbackHost $dbHost) -and ($dbPortActual -eq $DbPort)
Check "API local loopback na porta :$ApiPort" $apiOk
Check "DB local loopback na porta :$DbPort (porta propria/independente)" $dbOk
Check "API e DB em portas independentes" ($apiOk -and $dbOk -and ($ApiPort -ne $DbPort))
Write-Output "  info api_host=$apiHost api_port=$apiPortActual db_host=$dbHost db_port=$dbPortActual"
Check "sem VERCEL no processo" ([string]::IsNullOrEmpty($env:VERCEL))
Check "sem project ref remoto nas URLs" (($apiHost -notmatch '\.supabase\.co$') -and ($dbHost -notmatch '\.supabase\.co$'))

# ---------------------------------------------------------------------------
# (3) Migration autorada: presenca, SHA e unicidade de pendencia
# ---------------------------------------------------------------------------
Check "migration autorada presente no repo" (Test-Path $RepoMigration)
$repoSha = ""
if (Test-Path $RepoMigration) {
  $repoSha = Get-LfNormalizedSha256 $RepoMigration
  Check "SHA-256 do repo confere com o autorizado" ($repoSha -ieq $ExpectedSha256.ToUpperInvariant())
  Write-Output "  info repo_sha256=$repoSha"
}

if ($script:Failures.Count -gt 0) {
  Write-Output ""
  Write-Output ("RESULT: FAIL (" + $script:Failures.Count + " falha(s) antes de qualquer escrita)")
  foreach ($f in $script:Failures) { Write-Output ("  - " + $f) }
  exit 1
}

if (-not $ProofsOnly -and -not (Test-Path $WorkdirMigration)) {
  Copy-Item -LiteralPath $RepoMigration -Destination $WorkdirMigration -Force
  Write-Output "  info copiada a migration autorada para o workdir local"
}
$workdirShaOk = $false
if (Test-Path $WorkdirMigration) {
  $workdirSha = Get-LfNormalizedSha256 $WorkdirMigration
  $workdirShaOk = ($workdirSha -ieq $ExpectedSha256.ToUpperInvariant())
  Write-Output "  info workdir_sha256=$workdirSha"
}
Check "SHA-256 da copia no workdir confere com o autorizado" $workdirShaOk

$ledger = Get-LedgerVersions
Check "ledger local legivel" ($ledger.ExitCode -eq 0)
$ledgerVersions = @($ledger.Versions)
$ledgerSet = @{}
foreach ($v in $ledgerVersions) { $ledgerSet[$v] = $true }
Write-Output ("  info ledger_count=" + $ledgerVersions.Count)

$workdirFiles = @(Get-ChildItem $WorkdirMigs -Filter *.sql | Sort-Object Name)
$pending = @()
foreach ($f in $workdirFiles) {
  $version = ($f.Name -split "_")[0]
  if (-not $ledgerSet.ContainsKey($version)) { $pending += $f.Name }
}
Write-Output ("  info pending_count=" + $pending.Count)
foreach ($p in $pending) { Write-Output "  info pending=$p" }
$unexpectedPending = @($pending | Where-Object { $_ -ne $ExpectedMigration })
Check "nenhuma pendencia fora da autorizada" ($unexpectedPending.Count -eq 0)

if ($ProofsOnly) {
  Check "migration autorada ja aplicada (ProofsOnly)" ($ledgerSet.ContainsKey($ExpectedVersion))
  Check "nenhuma pendencia no workdir (ProofsOnly)" ($pending.Count -eq 0)
} else {
  Check "exatamente 1 pendencia: a migration autorada" (($pending.Count -eq 1) -and ($pending[0] -eq $ExpectedMigration))
}

if ($script:Failures.Count -gt 0) {
  Write-Output ""
  Write-Output ("RESULT: FAIL (" + $script:Failures.Count + " falha(s); nenhuma migration aplicada)")
  foreach ($f in $script:Failures) { Write-Output ("  - " + $f) }
  exit 1
}

# ---------------------------------------------------------------------------
# (4) Aplicacao local (somente quando autorizado)
# ---------------------------------------------------------------------------
if (-not $ProofsOnly) {
  $ledgerBefore = $ledgerVersions.Count
  Write-Output "  info applying: migration up --local (workdir local aprovado)"
  $apply = Invoke-Cli @("--no-install", "supabase", "--workdir", $Workdir, "migration", "up", "--local")
  foreach ($line in $apply.StdOut) {
    if ("$line" -match 'Applying migration|up to date|error|Error') { Write-Output ("  apply: " + "$line") }
  }
  Check "migration up --local exit 0" ($apply.ExitCode -eq 0)

  $ledgerAfter = Get-LedgerVersions
  Check "ledger legivel apos apply" ($ledgerAfter.ExitCode -eq 0)
  $ledgerAfterSet = @{}
  foreach ($v in $ledgerAfter.Versions) { $ledgerAfterSet[$v] = $true }
  Check "ledger incrementou em 1" ($ledgerAfter.Versions.Count -eq ($ledgerBefore + 1))
  Check "migration autorada registrada no ledger" ($ledgerAfterSet.ContainsKey($ExpectedVersion))
  Write-Output ("  info ledger_before=" + $ledgerBefore + " ledger_after=" + $ledgerAfter.Versions.Count)
}

# ---------------------------------------------------------------------------
# (5) Preflight pos-migration (exige Luna ativo, ledger, sem pendencia)
# ---------------------------------------------------------------------------
$env:NEXT_PUBLIC_SUPABASE_URL = $apiUrl
$env:SUPABASE_URL = $apiUrl
$env:VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE = ("{0}:{1}" -f $apiHost, $apiPortActual)
if ([string]::IsNullOrEmpty($env:VENDEO_VS_VALIDATION_ENABLED)) { $env:VENDEO_VS_VALIDATION_ENABLED = "1" }

$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& powershell -NoProfile -File $Preflight -PreflightOnly -Stage post-migration -ExpectedSha256 $ExpectedSha256
$preflightExit = $LASTEXITCODE
$ErrorActionPreference = $prev
Check "preflight post-migration PASS (Luna ativo, sem pendencia)" ($preflightExit -eq 0)

if ($script:Failures.Count -gt 0) {
  Write-Output ""
  Write-Output ("RESULT: FAIL (" + $script:Failures.Count + " falha(s); provas nao executadas)")
  foreach ($f in $script:Failures) { Write-Output ("  - " + $f) }
  exit 1
}

# ---------------------------------------------------------------------------
# (6) Provas reais em Postgres local isolado
# ---------------------------------------------------------------------------
$env:DATABASE_URL = $dbUrl
$env:EXPECTED_DB_PORT = [string]$DbPort
$env:EXPECTED_PROJECT_ID = $ProjectId
$env:MIGRATION_PATH = $RepoMigration
$env:EXPECTED_MIGRATION_VERSION = $ExpectedVersion
$env:PROOFS_ONLY = if ($ProofsOnly) { "1" } else { "0" }

Check "harness de provas presente" (Test-Path $ProofsScript)
if ($script:Failures.Count -gt 0) {
  Write-Output ""
  Write-Output ("RESULT: FAIL (" + $script:Failures.Count + " falha(s); provas nao executadas)")
  foreach ($f in $script:Failures) { Write-Output ("  - " + $f) }
  exit 1
}

& node $ProofsScript
$proofsExit = $LASTEXITCODE
Check "provas reais PASS" ($proofsExit -eq 0)

Write-Output ""
if ($script:Failures.Count -gt 0) {
  Write-Output ("RESULT: FAIL (" + $script:Failures.Count + " falha(s))")
  foreach ($f in $script:Failures) { Write-Output ("  - " + $f) }
  exit 1
}
Write-Output "RESULT: PASS (migration local aplicada somente no destino aprovado; provas reais verdes; nenhuma chamada paga)"
exit 0
