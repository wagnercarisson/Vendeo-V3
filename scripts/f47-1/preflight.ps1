# F47.1 — Preflight READ-ONLY de instância isolada (API e DB separados).
#
# SOMENTE leitura:
#   * Não copia migration para o workdir.
#   * Não aplica migration (`migration up`), não faz `db push`, `--linked`,
#     reset, `migration repair`, push ou deploy.
#   * Nunca imprime segredo, connection string, chave ou token.
#
# Uso:
#   powershell -NoProfile -File scripts/f47-1/preflight.ps1 `
#     -PreflightOnly -Stage pre-migration [-Workdir G:\Vendeo-Homolog]
#
# Estágios:
#   pre-migration  → permite `gpt-6-luna` AUSENTE (esperado antes da aplicação),
#                    mas exige `gpt-5.5/responses` ativo e exatamente a
#                    migration autorizada pendente.
#   post-migration → exige `gpt-6-luna/responses` ATIVO, a migration aplicada
#                    no ledger e nenhuma pendência.
param(
  [switch]$PreflightOnly,
  [ValidateSet("pre-migration", "post-migration")]
  [string]$Stage = "pre-migration",
  [string]$Workdir = "G:\Vendeo-Homolog",
  [string]$ProjectId = "vendeo-homolog",
  [int]$ApiPort = 57781,
  [int]$DbPort = 57782,
  [string]$ExpectedMigration = "20261021000001_f47_1_visual_signature_model_config.sql",
  [string]$ExpectedSha256 = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ConfigToml = Join-Path $Workdir "supabase\config.toml"
$WorkdirMigs = Join-Path $Workdir "supabase\migrations"
$RepoMigs   = Join-Path $RepoRoot "supabase\migrations"
$RepoMigrationPath = Join-Path $RepoMigs $ExpectedMigration
$AppScript  = Join-Path $PSScriptRoot "preflight-app.ts"
$ExpectedMigrationVersion = ($ExpectedMigration -split "_")[0]

$script:Failures = @()

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
function Uri-Origin([string]$u) {
  try {
    $uri = [System.Uri]$u
    return ("{0}://{1}:{2}" -f $uri.Scheme, $uri.Host, $uri.Port)
  } catch { return "" }
}
function Is-LoopbackHost([string]$h) {
  return @("127.0.0.1", "localhost", "::1") -contains $h
}

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
  finally {
    $ErrorActionPreference = $prev
  }
  $stdout = @(Get-Content $outFile -ErrorAction SilentlyContinue)
  Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
  return @{ ExitCode = $code; StdOut = $stdout }
}

Write-Output "== F47.1 preflight (read-only) — stage=$Stage =="

if (-not $PreflightOnly) {
  Write-Output "  FAIL somente -PreflightOnly é suportado nesta fase (fail-closed)"
  exit 2
}
if ($Stage -notin @("pre-migration", "post-migration")) {
  Write-Output "  FAIL stage inválido: $Stage"
  exit 2
}

# ---------------------------------------------------------------------------
# (1) Workdir e project_id local aprovado
# ---------------------------------------------------------------------------
$workdirExists = Test-Path $Workdir
Check "workdir local existe" $workdirExists

$projectOk = $false
if ((Test-Path $ConfigToml)) {
  $cfg = Get-Content $ConfigToml -Raw
  $match = [regex]::Match($cfg, '(?m)^\s*project_id\s*=\s*"([^"]+)"')
  $declaredProject = if ($match.Success) { $match.Groups[1].Value } else { "" }
  $projectOk = ($declaredProject -eq $ProjectId)
  Write-Output "  info project_id declarado: $declaredProject"
}
Check "config.toml declara project_id = $ProjectId" $projectOk

# ---------------------------------------------------------------------------
# (2) Containers locais esperados saudáveis
# ---------------------------------------------------------------------------
$running = @()
try { $running = @(docker ps --format "{{.Names}}|{{.Status}}" 2>$null) } catch { $running = @() }

function Container-Status([string]$name) {
  $hit = @($running | Where-Object { "$_" -like "$name|*" }) | Select-Object -First 1
  if ($null -eq $hit) { return $null }
  return (("$hit" -split "\|", 2)[1]).Trim()
}
function Is-Up([string]$status) { return ($null -ne $status) -and ($status -match '^Up\b') }
function Is-Healthy([string]$status) { return ($null -ne $status) -and ($status -match '\(healthy\)') }

foreach ($suffix in @("db", "auth", "rest", "storage", "kong")) {
  $name = "supabase_${suffix}_$ProjectId"
  $status = Container-Status $name
  if ($suffix -in @("db", "auth", "storage")) {
    Check "container $name Up/healthy" (Is-Healthy $status)
  } else {
    Check "container $name Up" (Is-Up $status)
  }
}

# Recusa nominal de projeto de produção conhecido (diagnóstico explícito).
$productionLike = @($running | Where-Object { "$_" -match '^supabase_db_(vendeo|vendeo-prod)\|' })
Check "nenhum container de produção nomeado 'vendeo' em execução" (@($productionLike).Count -eq 0)

# ---------------------------------------------------------------------------
# (3) supabase status — API e DB validados SEPARADAMENTE
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
$apiOk = ($apiUrl -ne "") -and (Is-LoopbackHost $apiHost) -and ($apiPortActual -eq $ApiPort)
Check "API local loopback na porta :$ApiPort" $apiOk
if ($apiUrl -ne "") { Write-Output "  info API host=$apiHost port=$apiPortActual" }

$dbHost = Uri-Host $dbUrl
$dbPortActual = Uri-Port $dbUrl
$dbOk = ($dbUrl -ne "") -and (Is-LoopbackHost $dbHost) -and ($dbPortActual -eq $DbPort)
Check "DB local loopback na porta :$DbPort (porta própria, independente da API)" $dbOk
if ($dbUrl -ne "") { Write-Output "  info DB host=$dbHost port=$dbPortActual" }
Check "API e DB validados em portas independentes" ($apiOk -and $dbOk -and ($ApiPort -ne $DbPort))

# ---------------------------------------------------------------------------
# (4) Identidade canônica × allowlist local
# ---------------------------------------------------------------------------
$validationInstance = $env:VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE
$apiIdentity = ""
if ($apiUrl -ne "") {
  try { $apiIdentity = ([System.Uri]$apiUrl).Host + ":" + ([System.Uri]$apiUrl).Port } catch { $apiIdentity = "" }
}
Check "API host:port coincide com VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE" `
  (($validationInstance -ne "") -and ($apiIdentity -eq $validationInstance))
if ($validationInstance -ne "") { Write-Output "  info validation_instance=$validationInstance" }

# ---------------------------------------------------------------------------
# (5) URLs públicas/server  no MESMO origin local; recusa remoto/Vercel
# ---------------------------------------------------------------------------
$nextPublic = $env:NEXT_PUBLIC_SUPABASE_URL
$serverUrl = $env:SUPABASE_URL
$nextOrigin = if ($nextPublic) { Uri-Origin $nextPublic } else { "" }
$serverOrigin = if ($serverUrl) { Uri-Origin $serverUrl } else { "" }
$nextHost = Uri-Host $nextPublic
$serverHost = Uri-Host $serverUrl

Check "NEXT_PUBLIC_SUPABASE_URL presente e loopback" `
  (($nextPublic -ne "") -and (Is-LoopbackHost $nextHost))
Check "SUPABASE_URL presente e loopback" `
  (($serverUrl -ne "") -and (Is-LoopbackHost $serverHost))
Check "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_URL no mesmo origin local" `
  (($nextOrigin -ne "") -and ($nextOrigin -eq $serverOrigin))
Check "NEXT_PUBLIC_SUPABASE_URL corresponde ao API_URL do workdir" `
  (($nextOrigin -ne "") -and ($nextOrigin -eq (Uri-Origin $apiUrl)))
Check "sem VERCEL no processo" ([string]::IsNullOrEmpty($env:VERCEL))
Check "sem project ref remoto/Supabase Cloud/Vercel nas URLs" (
  ($nextHost -notmatch '\.supabase\.co$') -and ($nextHost -notmatch '\.vercel\.app$') -and
  ($serverHost -notmatch '\.supabase\.co$') -and ($serverHost -notmatch '\.vercel\.app$')
)

# ---------------------------------------------------------------------------
# (6) Migration autorada no repo: presença e SHA-256
# ---------------------------------------------------------------------------
Check "migration autorada presente no repo" (Test-Path $RepoMigrationPath)
$migrationSha = ""
if (Test-Path $RepoMigrationPath) {
  $migrationSha = (Get-FileHash -Algorithm SHA256 $RepoMigrationPath).Hash.ToUpperInvariant()
  Write-Output "  info migration=$ExpectedMigration"
  Write-Output "  info sha256=$migrationSha"
  if ($ExpectedSha256 -ne "") {
    Check "SHA-256 da migration confere com o esperado" ($migrationSha -ieq $ExpectedSha256.ToUpperInvariant())
  }
}

# ---------------------------------------------------------------------------
# (6.1) ABORT BEFORE DB: qualquer falha estática/isolation impede conexão
# ---------------------------------------------------------------------------
# Fail-closed: se workdir/project/containers/API/DB/identidade/URLs/migration
# falharam, o script TypeScript NÃO é executado. Assim, um destino recusado
# nunca recebe sequer uma consulta de leitura.
if ($script:Failures.Count -gt 0) {
  Write-Output "  info database_connection_attempted=false"
  Write-Output ""
  Write-Output ("RESULT: FAIL (" + $script:Failures.Count + " falha(s); conexão com banco NÃO tentada)")
  foreach ($f in $script:Failures) { Write-Output ("  - " + $f) }
  exit 1
}

# ---------------------------------------------------------------------------
# (7) Preflight de banco (read-only) via tsx
# ---------------------------------------------------------------------------
$env:PREFLIGHT_STAGE = $Stage
$env:EXPECTED_DB_PORT = [string]$DbPort
$env:EXPECTED_PROJECT_ID = $ProjectId
$env:EXPECTED_MIGRATION_VERSION = $ExpectedMigrationVersion
$env:EXPECTED_MIGRATION_FILE = $ExpectedMigration
$env:WORKDIR_MIGRATIONS_DIR = $WorkdirMigs
$env:REPO_MIGRATIONS_DIR = $RepoMigs
$env:DATABASE_URL = $dbUrl

$appOutFile = [System.IO.Path]::GetTempFileName()
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$appExit = 1
try {
  & npx --no-install tsx $AppScript 1> $appOutFile 2> $null
  $appExit = $LASTEXITCODE
}
finally {
  $ErrorActionPreference = $prev
}
$appRaw = @(Get-Content $appOutFile -ErrorAction SilentlyContinue)
Remove-Item $appOutFile -ErrorAction SilentlyContinue

$app = $null
if ($appRaw.Count -gt 0) {
  try { $app = ($appRaw -join "`n") | ConvertFrom-Json } catch { $app = $null }
}
Check "preflight-app.ts executou e emitiu JSON sanitizado" (($appExit -eq 0) -and ($null -ne $app))

if ($null -ne $app) {
  Write-Output ("  info database_connection_attempted=" + $app.database_connection_attempted)
  Write-Output ("  info db.current_database=" + $app.database.current_database)
  Write-Output ("  info ledger.count=" + $app.ledger.count)
  Write-Output ("  info migrations.workdir_file_count=" + $app.migrations.workdir_file_count)
  Write-Output ("  info migrations.pending_count=" + $app.migrations.pending_count)
  foreach ($p in @($app.migrations.pending)) { if ($p) { Write-Output "  info pending=$p" } }
  Write-Output ("  info migrations.repo_only_count=" + $app.migrations.repo_only_count)
  foreach ($p in @($app.migrations.repo_only_files)) { if ($p) { Write-Output "  info repo_only=$p" } }
  Write-Output ("  info catalog.gpt_5_5_present=" + $app.catalog.gpt_5_5_present)
  Write-Output ("  info catalog.luna_present=" + $app.catalog.luna_present + " status=" + $app.catalog.luna_status)
  Write-Output ("  info pricing.advisory=true all_presets_covered=" + $app.pricing.all_presets_covered)
  Write-Output ("  info credential_present=" + $app.credential_present)
  Write-Output ("  info identity.matches=" + $app.identity.matches)

  Check "identidade canônica coincide com a allowlist" ([bool]$app.identity.matches)
  Check "estágio/${Stage}: gpt-5.5/responses ativo no catálogo" ([bool]$app.catalog.gpt_5_5_present)
  if ($Stage -eq "pre-migration") {
    Check "pre-migration: Luna ausente permitida / presente consistente" `
      ((-not [bool]$app.catalog.luna_present) -or [bool]$app.catalog.luna_integrity_ok)
    Check "pre-migration: exatamente 1 pendência (a migration autorada)" `
      ([int]$app.migrations.pending_count -eq 1)
  } else {
    Check "post-migration: Luna ativo e íntegro" ([bool]$app.catalog.luna_integrity_ok)
    Check "post-migration: migration aplicada no ledger" ([bool]$app.migrations.authorized_applied)
    Check "post-migration: nenhuma pendência" ([int]$app.migrations.pending_count -eq 0)
  }
  Check "nenhuma pendência no workdir fora da autorizada" `
    (@($app.migrations.unexpected_pending).Count -eq 0)
  Check "credencial dedicada de validação presente" ([bool]$app.credential_present)
  Check "preflight-app sem falhas internas" (@($app.failures).Count -eq 0)
}

# ---------------------------------------------------------------------------
# (8) Resultado
# ---------------------------------------------------------------------------
if ($script:Failures.Count -gt 0) {
  Write-Output ""
  Write-Output ("RESULT: FAIL (" + $script:Failures.Count + " falha(s))")
  foreach ($f in $script:Failures) { Write-Output ("  - " + $f) }
  exit 1
}

Write-Output ""
Write-Output "RESULT: PASS (read-only; nenhuma migration aplicada, nenhuma chamada paga)"
exit 0
