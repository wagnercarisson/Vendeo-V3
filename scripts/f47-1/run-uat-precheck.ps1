# F47.1 - Precheck READ-ONLY do UAT local.
#
# Garantias:
#   * NAO substitui NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL; compara os valores
#     ORIGINAIS com o destino local aprovado.
#   * Se o isolamento falhar, NAO executa preflight, psql ou qualquer consulta
#     adicional.
#   * NAO chama provider, NAO grava configuracao e NAO imprime chaves/tokens.
#   * Distingue isolamento, credencial, configuracao ausente/invalida e
#     combinacao esperada por resultado estruturado.
param(
  [ValidateSet("initial", "additional")]
  [string]$Mode = "initial",
  [string]$Workdir = "G:\Vendeo-Homolog",
  [string]$ProjectId = "vendeo-homolog",
  [int]$ApiPort = 57781,
  [int]$DbPort = 57782,
  [string]$ExpectedMigration = "20261024141422_f47_1_visual_signature_model_config.sql",
  [string]$ExpectedSha256 = "B352F93EFA1B2F829E5D97FFAA79F7972CF3D7696C6B7CEB40EBFC517A26AA90",
  [string]$ExpectedOrchestrator = "",
  [string]$ExpectedPreset = ""
)

$ErrorActionPreference = "Continue"
$script:Failures = @()
$ExpectedVersion = ($ExpectedMigration -split "_")[0]
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Preflight = Join-Path $PSScriptRoot "preflight.ps1"
$Validator = Join-Path $PSScriptRoot "validate-visual-signature-config.ts"

function Check([string]$Label, [bool]$Ok, [string]$Detail = "") {
  if ($Ok) {
    Write-Output ("  ok   " + $Label + $(if ($Detail) { " | $Detail" } else { "" }))
  } else {
    $script:Failures += $Label
    Write-Output ("  FAIL " + $Label + $(if ($Detail) { " | $Detail" } else { "" }))
  }
}

function Uri-Host([string]$u) { try { return ([System.Uri]$u).Host } catch { return "" } }
function Uri-Port([string]$u) { try { return ([System.Uri]$u).Port } catch { return 0 } }
function Uri-Origin([string]$u) { try { $x = [System.Uri]$u; return ("{0}://{1}:{2}" -f $x.Scheme, $x.Host, $x.Port) } catch { return "" } }
function Is-LoopbackHost([string]$h) { return @("127.0.0.1", "localhost", "::1") -contains $h }
function Is-RemoteHost([string]$h) { return ($h -match '\.supabase\.co$') -or ($h -match '\.vercel\.app$') }

function Invoke-Psql([string]$Sql) {
  $outFile = [System.IO.Path]::GetTempFileName()
  $errFile = [System.IO.Path]::GetTempFileName()
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & docker exec "supabase_db_$ProjectId" psql -U postgres -tAc $Sql 1> $outFile 2> $errFile
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  $stdout = @(Get-Content $outFile -ErrorAction SilentlyContinue)
  Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
  return @{ ExitCode = $code; Lines = $stdout }
}

function Get-StatusUrls {
  $outFile = [System.IO.Path]::GetTempFileName()
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & npx --no-install supabase status --workdir $Workdir -o env 1> $outFile 2> $null
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  $lines = @(Get-Content $outFile -ErrorAction SilentlyContinue)
  Remove-Item $outFile -ErrorAction SilentlyContinue
  $api = ""
  $db = ""
  foreach ($line in $lines) {
    if ("$line" -match "^\s*API_URL\s*=") { $api = (("$line" -split "=", 2)[1]).Trim().Trim('"').Trim("'") }
    if ("$line" -match "^\s*DB_URL\s*=") { $db = (("$line" -split "=", 2)[1]).Trim().Trim('"').Trim("'") }
  }
  return @{ ExitCode = $code; ApiUrl = $api; DbUrl = $db }
}

$nextPublic = $env:NEXT_PUBLIC_SUPABASE_URL
$serverUrl = $env:SUPABASE_URL
$validationInstance = $env:VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE
$optIn = ($env:VENDEO_VS_VALIDATION_ENABLED -eq "1")
$validationKey = -not [string]::IsNullOrWhiteSpace($env:VENDEO_VS_VALIDATION_OPENAI_API_KEY)
$normalKey = -not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)

Write-Output "== F47.1 UAT precheck (read-only) mode=$Mode =="
Write-Output "repo=$RepoRoot local_workdir=$Workdir api_port=$ApiPort db_port=$DbPort"

# (1) Isolamento: compara as URLs ORIGINAIS; NAO atribui nem corrige env.
$status = Get-StatusUrls
Check "supabase status local exit 0" ($status.ExitCode -eq 0)
$apiUrl = $status.ApiUrl
$dbUrl = $status.DbUrl
$apiHost = Uri-Host $apiUrl
$apiPortActual = Uri-Port $apiUrl
$dbHost = Uri-Host $dbUrl
$dbPortActual = Uri-Port $dbUrl
$apiIdentity = if ($apiHost -and $apiPortActual) { "$apiHost`:$apiPortActual" } else { "" }
$nextOrigin = if ($nextPublic) { Uri-Origin $nextPublic } else { "" }
$serverOrigin = if ($serverUrl) { Uri-Origin $serverUrl } else { "" }
$apiOrigin = Uri-Origin $apiUrl

Check "API local loopback na porta :$ApiPort" (($apiUrl -ne "") -and (Is-LoopbackHost $apiHost) -and ($apiPortActual -eq $ApiPort))
Check "DB local loopback na porta :$DbPort" (($dbUrl -ne "") -and (Is-LoopbackHost $dbHost) -and ($dbPortActual -eq $DbPort))
Check "API e DB em portas independentes" ($ApiPort -ne $DbPort)
Check "NEXT_PUBLIC_SUPABASE_URL original presente/loopback" (($nextPublic -ne "") -and (Is-LoopbackHost (Uri-Host $nextPublic)))
Check "SUPABASE_URL original presente/loopback" (($serverUrl -ne "") -and (Is-LoopbackHost (Uri-Host $serverUrl)))
Check "URLs originais no mesmo origin" (($nextOrigin -ne "") -and ($nextOrigin -eq $serverOrigin))
Check "URLs originais correspondem ao API_URL do workdir" (($nextOrigin -ne "") -and ($nextOrigin -eq $apiOrigin))
Check "identidade original coincide com API host:port" (($validationInstance -ne "") -and ($validationInstance -eq $apiIdentity))
Check "sem VERCEL no processo" ([string]::IsNullOrEmpty($env:VERCEL))
Check "sem project ref remoto nas URLs originais" (
  (-not (Is-RemoteHost (Uri-Host $nextPublic))) -and
  (-not (Is-RemoteHost (Uri-Host $serverUrl)))
)

if ($script:Failures.Count -gt 0) {
  $result = [ordered]@{
    ok = $false
    readiness = "isolation_failed"
    isolation = "fail"
    failures = @($script:Failures)
    database_connection_attempted = $false
    provider_calls_attempted = $false
  }
  Write-Output ("UAT_PRECHECK_RESULT=" + ($result | ConvertTo-Json -Compress))
  Write-Output "FAIL: isolamento invalido; preflight/psql NAO executados."
  exit 1
}
Write-Output "  info isolation=pass (URLs originais; nenhuma substituicao)"

# (2) Preflight com as URLs ORIGINAIS. Falha de credencial e distinguida de
# falha de isolamento/ambiente. Nenhuma env e sobrescrita.
$preflightOut = [System.IO.Path]::GetTempFileName()
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& powershell -NoProfile -File $Preflight -PreflightOnly -Stage post-migration `
  -Workdir $Workdir -ProjectId $ProjectId -ApiPort $ApiPort -DbPort $DbPort `
  -ExpectedMigration $ExpectedMigration -ExpectedSha256 $ExpectedSha256 1> $preflightOut
$preflightExit = $LASTEXITCODE
$ErrorActionPreference = $prev
$preflightLines = @(Get-Content $preflightOut -ErrorAction SilentlyContinue)
Remove-Item $preflightOut -ErrorAction SilentlyContinue
foreach ($line in $preflightLines) { Write-Output $line }
$failLines = @($preflightLines | Where-Object { "$_" -match '^\s*FAIL\s' })
$nonCredentialFails = @($failLines | Where-Object {
  "$_" -notmatch 'credencial dedicada' -and
  "$_" -notmatch 'preflight-app sem falhas internas'
})
$preflightCredentialOnly = ($preflightExit -ne 0) -and ($failLines.Count -gt 0) -and ($nonCredentialFails.Count -eq 0)
Check "preflight post-migration PASS ou bloqueio exclusivo de credencial" (($preflightExit -eq 0) -or $preflightCredentialOnly)

if ($preflightExit -ne 0 -and -not $preflightCredentialOnly) {
  $result = [ordered]@{
    ok = $false
    readiness = "preflight_failed"
    isolation = "pass"
    preflight = "fail"
    failures = @($script:Failures)
    database_connection_attempted = $false
    provider_calls_attempted = $false
  }
  Write-Output ("UAT_PRECHECK_RESULT=" + ($result | ConvertTo-Json -Compress))
  Write-Output "FAIL: preflight falhou fora do escopo de credencial; consultas adicionais NAO executadas."
  exit 1
}

# (3) Consultas adicionais somente com isolamento provado.
$ledger = Invoke-Psql "select version::text from supabase_migrations.schema_migrations where version = '$ExpectedVersion'"
$ledgerHit = @($ledger.Lines | Where-Object { "$_".Trim() -eq $ExpectedVersion }).Count -eq 1
Check "migration autorada no ledger local" ($ledger.ExitCode -eq 0 -and $ledgerHit) "version=$ExpectedVersion"

$catalog = Invoke-Psql "select count(*) from public.ai_model_catalog where capability='visual_signature_image' and provider='openai' and model='gpt-6-luna' and protocol='responses' and status='active'"
$catalogCount = 0
if ($catalog.Lines.Count -gt 0) { [void][int]::TryParse("$($catalog.Lines[0])".Trim(), [ref]$catalogCount) }
Check "catalogo Luna/responses ativo" ($catalog.ExitCode -eq 0 -and $catalogCount -eq 1) "rows=$catalogCount"

$rowJson = ""
$configRead = Invoke-Psql "select coalesce((select row_to_json(t)::text from (select environment_scope, instance_identity, orchestrator_model, image_preset, image_model, image_quality, reasoning_effort, config_version_id from public.visual_signature_model_config where scope='visual_signature') t), '')"
if ($configRead.Lines.Count -gt 0) { $rowJson = ("$($configRead.Lines[0])").Trim() }
Check "configuracao dedicada consultavel (leitura)" ($configRead.ExitCode -eq 0)

$env:VS_ROW_JSON = $rowJson
$env:VS_API_IDENTITY = $apiIdentity
$env:VS_EXPECTED_ORCHESTRATOR = $ExpectedOrchestrator
$env:VS_EXPECTED_PRESET = $ExpectedPreset
$validatorOut = [System.IO.Path]::GetTempFileName()
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& npx --no-install tsx $Validator 1> $validatorOut 2> $null
$validatorExit = $LASTEXITCODE
$ErrorActionPreference = $prev
$validatorRaw = @(Get-Content $validatorOut -ErrorAction SilentlyContinue)
Remove-Item $validatorOut -ErrorAction SilentlyContinue
$config = $null
if ($validatorRaw.Count -gt 0) { try { $config = (($validatorRaw -join "`n") | ConvertFrom-Json) } catch { $config = $null } }
Check "validacao da configuracao pelo contrato puro do runtime" (($validatorExit -eq 0) -and ($null -ne $config))

$credentialMissing = (-not $validationKey) -or (-not $normalKey)
$expectedMissing = [string]::IsNullOrWhiteSpace($ExpectedOrchestrator) -or [string]::IsNullOrWhiteSpace($ExpectedPreset)
$configStatus = if ($config) { "$($config.status)" } else { "unknown" }
$configReason = if ($config -and $config.reason) { "$($config.reason)" } else { $null }
$configCode = if ($config -and $config.code) { "$($config.code)" } else { $null }

if ($configStatus -eq "dedicated") {
  Write-Output ("  info config_mode=dedicated orchestrator=" + $config.orchestrator_model + " preset=" + $config.image_preset + " image_model=" + $config.image_model + " quality=" + $config.image_quality + " reasoning=" + $config.reasoning_effort + " version=" + $config.config_version_id)
} elseif ($configStatus -eq "inherited") {
  Write-Output "  info config_mode=inherited (ausencia confirmada de linha dedicada)"
} else {
  Write-Output ("  info config_mode=blocked reason=" + $configReason + " code=" + $configCode)
}

# (4) Prova de maxRetries=0.
Write-Output ""
Write-Output "== maxRetries=0 proof =="
Set-Location $RepoRoot
npx vitest run src/lib/ai/__tests__/responses-adapter-retry.test.ts
$retryProof = ($LASTEXITCODE -eq 0)
Check "maxRetries=0 comprovado pelo teste do adapter" $retryProof

# (5) Orçamento/limite efetivo e escopos (autorizacao pendente).
$generations = if ($Mode -eq "initial") { 2 } else { 6 }
$maxImages = $generations * 2
$maxValidations = $generations * 2
$historicalImageUsd = if ($Mode -eq "initial") { "~0.176" } else { "~0.464" }
Write-Output ""
Write-Output "== budget =="
Write-Output "  mode=$Mode generations=$generations"
Write-Output "  max_image_calls=$maxImages max_validation_calls=$maxValidations (2 tentativas por geracao)"
Write-Output "  historical_image_reference_usd=$historicalImageUsd (NAO e teto financeiro)"
Write-Output "  credential_scope: image+validation=validation; aprovacao/perfil de marca=normal"
Write-Output "  profile_flow_planned=1 authorization=pending"
if ($Mode -eq "additional") {
  Write-Output "  additional_generations=6 (Sunburst Low x2, Flare Medium x2, Flare Low x2)"
}

# (6) Readiness estruturado.
$readiness = "ready_for_authorization"
if ($script:Failures.Count -gt 0) { $readiness = "preflight_data_failed" }
elseif ($credentialMissing) { $readiness = "blocked_credentials" }
elseif ($configStatus -ne "dedicated") { $readiness = "blocked_inherited_or_invalid_config" }
elseif ($expectedMissing -or $configReason -eq "expected_mismatch") { $readiness = "blocked_expected_combination" }
elseif ($preflightExit -ne 0) { $readiness = "blocked_preflight" }

$result = [ordered]@{
  ok = ($readiness -eq "ready_for_authorization")
  readiness = $readiness
  isolation = "pass"
  preflight = if ($preflightExit -eq 0) { "pass" } elseif ($preflightCredentialOnly) { "credential_blocked" } else { "fail" }
  credentials = [ordered]@{ validation = $validationKey; normal = $normalKey }
  opt_in = $optIn
  expected = [ordered]@{ orchestrator = $ExpectedOrchestrator; preset = $ExpectedPreset }
  config = $config
  budget = [ordered]@{
    mode = $Mode
    generations = $generations
    max_image_calls = $maxImages
    max_validation_calls = $maxValidations
    historical_image_reference_usd = $historicalImageUsd
    profile_flow_planned = 1
    authorization = "pending"
  }
  max_retries_zero_proven = $retryProof
  database_connection_attempted = $true
  provider_calls_attempted = $false
  failures = @($script:Failures)
}
Write-Output ("UAT_PRECHECK_RESULT=" + ($result | ConvertTo-Json -Compress -Depth 6))

Write-Output ""
Write-Output "== RESULT =="
if ($readiness -eq "ready_for_authorization") {
  Write-Output "PASS: precheck verde; UAT ainda depende do checkpoint humano (Task 3)."
  exit 0
}
Write-Output ("BLOCKED: readiness=" + $readiness + ". UAT NAO deve comecar.")
exit 1
