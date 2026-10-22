# F47.1 - Precheck READ-ONLY do UAT local.
#
# NAO chama provider, NAO grava configuracao, NAO aplica migration e NAO
# imprime chaves/tokens. Se qualquer gate falhar, o UAT NAO deve comecar.
param(
  [ValidateSet("initial", "additional")]
  [string]$Mode = "initial",
  [string]$Workdir = "G:\Vendeo-Homolog",
  [string]$ProjectId = "vendeo-homolog",
  [int]$ApiPort = 57781,
  [int]$DbPort = 57782,
  [string]$ExpectedMigration = "20261021000001_f47_1_visual_signature_model_config.sql",
  [string]$ExpectedSha256 = "B352F93EFA1B2F829E5D97FFAA79F7972CF3D7696C6B7CEB40EBFC517A26AA90"
)

$ErrorActionPreference = "Continue"
$script:Failures = @()
$ExpectedVersion = ($ExpectedMigration -split "_")[0]
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Preflight = Join-Path $PSScriptRoot "preflight.ps1"

function Check([string]$Label, [bool]$Ok, [string]$Detail = "") {
  if ($Ok) {
    Write-Output ("  ok   " + $Label + $(if ($Detail) { " | $Detail" } else { "" }))
  } else {
    $script:Failures += $Label
    Write-Output ("  FAIL " + $Label + $(if ($Detail) { " | $Detail" } else { "" }))
  }
}

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

Write-Output "== F47.1 UAT precheck (read-only) mode=$Mode =="
Write-Output "repo=$RepoRoot local_workdir=$Workdir api_port=$ApiPort db_port=$DbPort"

# (1) Preflight pos-migration (API e DB separados, containers, Luna/ledger).
# Deriva as URLs LOCAIS do workdir apenas para a checagem read-only; nao grava
# configuracao e nao imprime connection string/chaves. A identidade esperada
# continua vindo do ambiente do operador.
$statusOut = [System.IO.Path]::GetTempFileName()
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& npx --no-install supabase status --workdir $Workdir -o env 1> $statusOut 2> $null
$statusExit = $LASTEXITCODE
$ErrorActionPreference = $prev
$statusLines = @(Get-Content $statusOut -ErrorAction SilentlyContinue)
Remove-Item $statusOut -ErrorAction SilentlyContinue
$apiUrl = ""
$dbUrl = ""
foreach ($line in $statusLines) {
  if ("$line" -match "^\s*API_URL\s*=") { $apiUrl = (("$line" -split "=", 2)[1]).Trim().Trim('"').Trim("'") }
  if ("$line" -match "^\s*DB_URL\s*=") { $dbUrl = (("$line" -split "=", 2)[1]).Trim().Trim('"').Trim("'") }
}
Check "supabase status local exit 0" ($statusExit -eq 0)
if ($apiUrl) {
  $env:NEXT_PUBLIC_SUPABASE_URL = $apiUrl
  $env:SUPABASE_URL = $apiUrl
}
Check "API_URL local presente para o preflight" (-not [string]::IsNullOrWhiteSpace($apiUrl))
Check "DB_URL local presente para o preflight" (-not [string]::IsNullOrWhiteSpace($dbUrl))

& powershell -NoProfile -File $Preflight -PreflightOnly -Stage post-migration `
  -Workdir $Workdir -ProjectId $ProjectId -ApiPort $ApiPort -DbPort $DbPort `
  -ExpectedMigration $ExpectedMigration -ExpectedSha256 $ExpectedSha256
Check "preflight post-migration PASS" ($LASTEXITCODE -eq 0)

# (2) Ledger local confirma a migration autorada.
$ledger = Invoke-Psql "select version::text from supabase_migrations.schema_migrations where version = '$ExpectedVersion'"
$ledgerHit = @($ledger.Lines | Where-Object { "$_".Trim() -eq $ExpectedVersion }).Count -eq 1
Check "migration autorada no ledger local" ($ledger.ExitCode -eq 0 -and $ledgerHit) "version=$ExpectedVersion"

# (3) Catálogo Luna ativo para a VS.
$catalog = Invoke-Psql "select count(*) from public.ai_model_catalog where capability='visual_signature_image' and provider='openai' and model='gpt-6-luna' and protocol='responses' and status='active'"
$catalogCount = 0
if ($catalog.Lines.Count -gt 0) { [void][int]::TryParse("$($catalog.Lines[0])".Trim(), [ref]$catalogCount) }
Check "catalogo Luna/responses ativo" ($catalog.ExitCode -eq 0 -and $catalogCount -eq 1) "rows=$catalogCount"

# (4) Configuração dedicada vigente OU herdada explícita (sem escrever).
$config = Invoke-Psql "select orchestrator_model || '|' || image_preset || '|' || image_model || '|' || image_quality || '|' || reasoning_effort || '|' || config_version_id || '|' || coalesce(reason,'') || '|' || coalesce(updated_by::text,'') || '|' || coalesce(updated_at::text,'') from public.visual_signature_model_config where scope='visual_signature'"
$configLine = @($config.Lines | Where-Object { "$_".Trim() -ne "" }) | Select-Object -First 1
$configOk = $config.ExitCode -eq 0
Check "configuracao dedicada consultavel (leitura)" $configOk
if ($configLine) {
  $parts = ("$configLine" -split "\|", 9)
  Write-Output ("  info config_mode=dedicated orchestrator=" + $parts[0] + " preset=" + $parts[1] + " image_model=" + $parts[2] + " quality=" + $parts[3] + " reasoning=" + $parts[4] + " version=" + $parts[5])
} else {
  Write-Output "  info config_mode=inherited (nenhuma linha dedicada; a geracao usara a selecao herdada)"
}

# (5) Credenciais: apenas booleanos, nunca valores.
$validationKey = -not [string]::IsNullOrWhiteSpace($env:VENDEO_VS_VALIDATION_OPENAI_API_KEY)
$normalKey = -not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)
Check "credencial validation presente (booleano)" $validationKey
Check "credencial normal presente (booleano)" $normalKey
$optIn = ($env:VENDEO_VS_VALIDATION_ENABLED -eq "1")
$instance = -not [string]::IsNullOrWhiteSpace($env:VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE)
Check "opt-in local VENDEO_VS_VALIDATION_ENABLED=1" $optIn
Check "identidade esperada VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE presente" $instance

# (6) Prova de maxRetries=0 no gateway de validação.
Write-Output ""
Write-Output "== maxRetries=0 proof =="
Set-Location $RepoRoot
npx vitest run src/lib/ai/__tests__/responses-adapter-retry.test.ts
$retryProof = ($LASTEXITCODE -eq 0)
Check "maxRetries=0 comprovado pelo teste do adapter" $retryProof

# (7) Orçamento/limite efetivo (histórico, não teto financeiro).
$generations = if ($Mode -eq "initial") { 2 } else { 6 }
$maxImages = $generations * 2
$maxValidations = $generations * 2
$historicalImageUsd = if ($Mode -eq "initial") { "~0.176" } else { "~0.464" }
Write-Output ""
Write-Output "== budget =="
Write-Output "  mode=$Mode generations=$generations"
Write-Output "  max_image_calls=$maxImages max_validation_calls=$maxValidations (2 tentativas por geracao)"
Write-Output "  historical_image_reference_usd=$historicalImageUsd (NAO e teto financeiro; provider reportado e autoritativo)"
Write-Output "  credential_scope: image+validation=validation; aprovacao/perfil de marca=normal"
if ($Mode -eq "initial") {
  Write-Output "  profile_flow_authorized=1 (credencial normal)"
} else {
  Write-Output "  additional_generations=6 (Sunburst Low x2, Flare Medium x2, Flare Low x2)"
}

Write-Output ""
Write-Output "== RESULT =="
if ($script:Failures.Count -eq 0) {
  Write-Output "PASS: precheck verde. UAT pode ser autorizado pelo checkpoint humano; nenhuma chamada paga foi feita."
  exit 0
}
Write-Output ("FAIL: " + $script:Failures.Count + " precheck(s) falharam; UAT NAO deve comecar.")
foreach ($failure in $script:Failures) { Write-Output ("  - " + $failure) }
exit 1
