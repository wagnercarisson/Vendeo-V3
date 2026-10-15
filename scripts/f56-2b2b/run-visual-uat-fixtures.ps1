param(
  [switch]$Apply
)

# F56.2b2b (B2.2 / Plano 07) — wrapper PROTEGIDO das fixtures de UAT visual.
#
# Reusa o MESMO caminho protegido do runner isolado (`-PreflightOnly`): se o gate
# de identidade/isolamento NÃO passar, ABORTA sem tocar no banco. Em seguida
# extrai API/DB do `supabase status` (nunca imprime segredos), valida loopback e
# roda `prepare-visual-uat.ts` em DRY-RUN por padrão (escreve SOMENTE com
# `-Apply`). NUNCA `db push`/`--linked`/reset/deploy/provider pago.

# `Continue` (não `Stop`): comandos nativos (npx/supabase/tsx) escrevem em stderr
# avisos NÃO-fatais; o sucesso é decidido por `$LASTEXITCODE`. `throw` explícito
# continua terminante.
$ErrorActionPreference = "Continue"
$workdir = "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $repoRoot "scripts\run-f56-2b2b-isolated-integration.ps1"
$requiredApiUrl = "http://127.0.0.1:56321"
$requiredDbPort = 56322

# --- 1. Gate de isolamento/identidade (mesmo caminho protegido). ---
$preflight = @(& $runner -PreflightOnly 2>&1)
$preflightExit = $LASTEXITCODE
$preflightText = $preflight -join "`n"
if ($preflightExit -ne 0 -or $preflightText -notmatch '"Preflight":\s*"PASS"') {
  Write-Output "# isolated preflight FAILED; refusing to create UAT fixtures"
  $preflight | ForEach-Object { Write-Output ([string]$_) }
  exit 2
}
Write-Output "# preflight PASS (identity/isolation verified)"

# --- 2. Extract loopback API/DB from `supabase status` (never printed). ---
function Get-StatusValue {
  param([Parameter(Mandatory = $true)][string]$Text, [Parameter(Mandatory = $true)][string]$Name)
  $match = [regex]::Match($Text, "(?m)^$([regex]::Escape($Name))=(.*)$")
  if (-not $match.Success) { return $null }
  $value = $match.Groups[1].Value.Trim()
  if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
    return $value.Substring(1, $value.Length - 2)
  }
  return $value
}

$statusText = (@(& npx --no-install supabase status --workdir $workdir -o env 2>$null)) -join "`n"
$apiUrl = Get-StatusValue -Text $statusText -Name "API_URL"
$serviceRoleKey = Get-StatusValue -Text $statusText -Name "SERVICE_ROLE_KEY"
$databaseUrl = Get-StatusValue -Text $statusText -Name "DB_URL"
$statusText = $null
if (-not $apiUrl -or -not $serviceRoleKey -or -not $databaseUrl) { throw "local credentials unavailable after passing isolation gate" }
if ($apiUrl -ne $requiredApiUrl) { throw "API url is not the dedicated loopback" }
$dbUri = $null
try { $dbUri = [uri]$databaseUrl } catch { throw "local database URL is malformed" }
if ($dbUri.Host -notin @('127.0.0.1', 'localhost') -or $dbUri.Port -ne $requiredDbPort) {
  throw "database URL is not the dedicated F56.2b2b loopback"
}

$secrets = @($serviceRoleKey, $databaseUrl)
$tsxArgs = @("--dry-run")
if ($Apply) { $tsxArgs = @("--apply") }
$mode = if ($Apply) { "apply" } else { "dry-run" }
Write-Output "# creating/reporting B2.2 UAT fixtures in mode: $mode"

try {
  $env:F562A_ISOLATED_SUPABASE_URL = $apiUrl
  $env:F562A_ISOLATED_SERVICE_ROLE_KEY = $serviceRoleKey
  $env:F562A_ISOLATED_DATABASE_URL = $databaseUrl
  $env:B22_VISUAL_PREFLIGHT = "vendeo-f562a-isolated:56321:56322"

  $output = @(& npx --no-install tsx scripts/f56-2b2b/prepare-visual-uat.ts @tsxArgs 2>&1)
  $code = $LASTEXITCODE

  foreach ($entry in $output) {
    $line = [string]$entry
    foreach ($secret in $secrets) { if ($secret) { $line = $line.Replace($secret, '[REDACTED]') } }
    $line = [regex]::Replace($line, '(?i)postgres(?:ql)?://\S+', '[DATABASE_URL_REDACTED]')
    $line = [regex]::Replace($line, '(?i)Bearer\s+\S+', 'Bearer [REDACTED]')
    $line = [regex]::Replace($line, '(?i)eyJ[A-Za-z0-9_\-\.]+', '[REDACTED]')
    Write-Output $line
  }
  exit $code
} finally {
  Remove-Item Env:F562A_ISOLATED_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:F562A_ISOLATED_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:F562A_ISOLATED_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:B22_VISUAL_PREFLIGHT -ErrorAction SilentlyContinue
}
