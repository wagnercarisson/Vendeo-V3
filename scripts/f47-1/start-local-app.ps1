# F47.1 — inicia o app local com o Supabase aprovado e a chave de testes.
#
# - Lê SOMENTE OPENAI_API_KEY do arquivo autorizado.
# - Não imprime, não copia e não persiste valores de chave.
# - Deriva as chaves de banco/Storage do `supabase status` do workdir aprovado.
# - Define as variáveis apenas no processo atual e inicia `next dev`.
#
# Uso:
#   powershell -NoProfile -File scripts/f47-1/start-local-app.ps1
#   powershell -NoProfile -File scripts/f47-1/start-local-app.ps1 -Port 3000
param(
  [string]$EnvFile = "C:\Projetos\Vendeo V3\.env.local",
  [string]$Workdir = "G:\Vendeo-Homolog",
  [int]$ApiPort = 57781,
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Arquivo local autorizado nao encontrado: $EnvFile"
}

$line = Get-Content -LiteralPath $EnvFile |
  Where-Object { $_ -match '^\s*(export\s+)?OPENAI_API_KEY\s*=' } |
  Select-Object -First 1
if (-not $line) {
  throw "OPENAI_API_KEY nao encontrada no arquivo local autorizado."
}
$key = ($line -replace '^\s*(export\s+)?OPENAI_API_KEY\s*=\s*', '').Trim().Trim('"').Trim("'")
if ([string]::IsNullOrWhiteSpace($key)) {
  throw "OPENAI_API_KEY vazia."
}

# Captura em memoria; stderr do CLI nao deve derrubar o script.
$status = cmd /c "npx --no-install supabase status --workdir $Workdir -o env 2>nul"
$apiUrl = ""
$anonKey = ""
$serviceKey = ""
foreach ($statusLine in $status) {
  if ("$statusLine" -match '^\s*API_URL\s*=') {
    $apiUrl = (("$statusLine" -split '=', 2)[1]).Trim().Trim('"').Trim("'")
  }
  if ("$statusLine" -match '^\s*ANON_KEY\s*=') {
    $anonKey = (("$statusLine" -split '=', 2)[1]).Trim().Trim('"').Trim("'")
  }
  if ("$statusLine" -match '^\s*SERVICE_ROLE_KEY\s*=') {
    $serviceKey = (("$statusLine" -split '=', 2)[1]).Trim().Trim('"').Trim("'")
  }
}

if (-not $apiUrl -or -not $anonKey -or -not $serviceKey) {
  throw "Nao foi possivel ler as credenciais locais do Supabase aprovado."
}

$uri = [System.Uri]$apiUrl
if ($uri.Host -notin @("127.0.0.1", "localhost", "::1") -or $uri.Port -ne $ApiPort) {
  throw "Supabase local fora do destino aprovado (esperado loopback:$ApiPort)."
}

$env:OPENAI_API_KEY = $key
$env:VENDEO_VS_VALIDATION_OPENAI_API_KEY = $key
$env:VENDEO_VS_VALIDATION_ENABLED = "1"
$env:VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE = "127.0.0.1:$ApiPort"
$env:NEXT_PUBLIC_SUPABASE_URL = $apiUrl
$env:SUPABASE_URL = $apiUrl
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $anonKey
$env:SUPABASE_SERVICE_ROLE_KEY = $serviceKey
$env:NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:$Port"

Write-Output "F47.1 app local: supabase=$apiUrl port=$Port"
Write-Output "credentials: validation=present normal=present (mesma chave; valores nao exibidos)"
if ([string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
  Write-Output "WARN: NEXT_PUBLIC_TURNSTILE_SITE_KEY ausente; se captcha_enabled=true o login por senha pode nao concluir."
}

cmd /c "npm run dev -- -p $Port"
