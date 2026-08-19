# Vendeo - Trocador de ambiente do .env.local
# Uso:
#   .\switch-env.ps1 local   -> aponta o app para o Supabase LOCAL (Docker): UAT F42 (captcha test + flag ON)
#   .\switch-env.ps1 remote  -> aponta o app para o Supabase REMOTO (producao): dia a dia, suas contas reais
#
# O .env.local nunca vai para o git (esta no .gitignore). Commits/push continuam identicos.

param(
    [ValidateSet("local", "remote")]
    [string]$Target = "remote"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir ".env.local"
$remoteBackup = Join-Path $scriptDir ".env.local.remote.bak"
$localBackup = Join-Path $scriptDir ".env.local.local.bak"

# Valores do Supabase local (gerados por `supabase status`).
# ATENCAO: a test secret do Turnstile e a LONGA (1x...000AA); a sitekey e a CURTA (1x...00AA).
$localOverrides = [ordered]@{
    NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    SUPABASE_URL = "http://127.0.0.1:54321"
    NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
    NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    SUPABASE_AUTH_CAPTCHA_SECRET = "1x0000000000000000000000000000000AA"
    NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA"
    VENDEO_CAPTCHA_ENABLED = "true"
    VENDEO_PUBLIC_SIGNUP_ENABLED = "true"
}

function Stop-DevServer {
    # Mata primeiro os cmd.exe que envolvem `npm run dev` (seguram o arquivo de log),
    # depois os node.exe que rodam `next dev`. Tolerante a "processo ja morto".
    $cmds = Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "npm( |_)run( |_)dev" }
    foreach ($p in $cmds) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    $nodes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "next( |_)dev|start-server" }
    foreach ($p in $nodes) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

function Start-DevServer {
    # Log com timestamp -> nunca tenta apagar um arquivo que o cmd ainda segura
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $log = Join-Path $env:TEMP "vendeo-dev-$stamp.log"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev > `"$log`" 2>&1" -WorkingDirectory $scriptDir -WindowStyle Hidden
    # Limpa logs antigos (tolerante a falha, nao bloqueia a troca)
    Get-ChildItem -Path $env:TEMP -Filter "vendeo-dev-*.log" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne (Split-Path $log -Leaf) -and $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
}

# Garante que sempre existe um backup remoto antes de qualquer troca
if (-not (Test-Path -LiteralPath $remoteBackup)) {
    Copy-Item -LiteralPath $envFile -Destination $remoteBackup -Force
    Write-Host "Backup remoto criado: .env.local.remote.bak"
}

if ($Target -eq "local") {
    # Parte do backup remoto e aplica as overrides locais
    $lines = Get-Content -LiteralPath $remoteBackup
    $seen = @{}
    $out = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $lines) {
        if ($line -match '^([A-Z0-9_]+)=') {
            $key = $matches[1]
            if ($localOverrides.Contains($key)) {
                $out.Add("$key=$($localOverrides[$key])")
                $seen[$key] = $true
            } else {
                $out.Add($line)
            }
        } else {
            $out.Add($line)
        }
    }
    foreach ($k in $localOverrides.Keys) {
        if (-not $seen.ContainsKey($k)) {
            $out.Add("$k=$($localOverrides[$k])")
        }
    }
    Set-Content -LiteralPath $envFile -Value $out -Encoding UTF8
    Copy-Item -LiteralPath $envFile -Destination $localBackup -Force
    Write-Host ""
    Write-Host "==> .env.local agora aponta para o Supabase LOCAL (Docker)"
    Write-Host "    - captcha: test keys do Turnstile (sempre passam)"
    Write-Host "    - VENDEO_PUBLIC_SIGNUP_ENABLED=true (UAT F42)"
    Write-Host "    - Supabase local precisa estar rodando: npx supabase start"
} else {
    if (Test-Path -LiteralPath $remoteBackup) {
        Copy-Item -LiteralPath $remoteBackup -Destination $envFile -Force
        Write-Host ""
        Write-Host "==> .env.local agora aponta para o Supabase REMOTO (producao)"
        Write-Host "    - suas contas reais funcionam; flag OFF; beta fechado"
    } else {
        Write-Host "Sem backup remoto para restaurar."
    }
}

Stop-DevServer
Start-DevServer
Write-Host "Dev server reiniciado -> http://localhost:3000"