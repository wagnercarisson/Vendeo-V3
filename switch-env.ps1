# Vendeo - Trocador OFICIAL de ambiente do .env.local
#
# Uso:
#   .\switch-env.ps1 local            -> Supabase LOCAL (Docker) + prepara o UAT (captcha de teste)
#   .\switch-env.ps1 remote           -> restaura o .env.local REMOTO a partir do backup validado
#   .\switch-env.ps1 local -NoServe   -> troca o ambiente sem iniciar o dev server
#
# Garantias de seguranca:
#   - Credenciais locais vem de `npx supabase status -o env` (nunca hardcoded).
#   - API/DB remotos sao recusados no modo local.
#   - O backup remoto so e atualizado quando o .env.local atual e remoto e valido.
#   - As env-vars de modelo/provider removidas pela F46 nunca sao propagadas.
#   - Nenhum `supabase db reset` e executado.
#   - O dev server e controlado por PID e so encerra processos do workspace Vendeo V3.

param(
    [ValidateSet("local", "remote")]
    [string]$Target = "remote",
    [switch]$NoServe
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir ".env.local"
$remoteBackup = Join-Path $scriptDir ".env.local.remote.bak"
$localBackup = Join-Path $scriptDir ".env.local.local.bak"
$logsDir = Join-Path $scriptDir "logs"

# Test keys oficiais do Cloudflare Turnstile (sempre passam) - nao sao secrets reais.
$turnstileTestSiteKey = "1x00000000000000000000AA"
$turnstileTestSecret = "1x0000000000000000000000000000000AA"

# 14 env-vars de modelo/provider removidas pela F46 + legado morto GEMINI_IMAGE_MODEL.
$ForbiddenModelVars = @(
    "OPENAI_MODEL",
    "OPENAI_TEXT_MODEL",
    "OPENAI_BRAND_DIRECTOR_MODEL",
    "OPENAI_TEXT_ONLY_INFERENCE_MODEL",
    "IMAGE_GENERATION_RESPONSES_MODEL",
    "GPT_IMAGE_MODEL",
    "IMAGE_EDIT_FALLBACK_MODEL",
    "VISION_REVIEW_MODEL",
    "IMAGE_VALIDATION_MODEL",
    "IMAGE_PROVIDER",
    "TEXT_PROVIDER",
    "TEXT_FALLBACK_PROVIDER",
    "GEMINI_TEXT_MODEL",
    "GEMINI_MODEL",
    "GEMINI_IMAGE_MODEL"
)

function Get-VendeoPidFile {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($scriptDir.ToLowerInvariant())
    $hash = [System.BitConverter]::ToString((New-Object System.Security.Cryptography.SHA1Managed).ComputeHash($bytes)).Replace("-", "")
    return (Join-Path $env:TEMP ("vendeo-dev-" + $hash.Substring(0, 12) + ".pid"))
}
$pidFile = Get-VendeoPidFile

function Read-EnvLines {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { throw "Arquivo nao encontrado: $Path" }
    return ,@(Get-Content -LiteralPath $Path)
}

function Get-EnvValue {
    param([string[]]$Lines, [string]$Key)
    $prefix = "$Key="
    foreach ($line in $Lines) {
        if ($line.StartsWith($prefix)) {
            $value = $line.Substring($prefix.Length).Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            return $value
        }
    }
    return $null
}

function Get-EnvKeys {
    param([string[]]$Lines)
    $keys = New-Object System.Collections.Generic.List[string]
    foreach ($line in $Lines) {
        if ($line -match '^([A-Za-z0-9_]+)=') { $keys.Add($Matches[1]) }
    }
    return ,$keys.ToArray()
}

function Test-LocalUrl {
    param([string]$Url)
    if ([string]::IsNullOrWhiteSpace($Url)) { return $false }
    try { $hostName = ([System.Uri]$Url).Host } catch { return $false }
    return ($hostName -eq "localhost" -or $hostName -eq "127.0.0.1")
}

function Test-RemoteUrl {
    param([string]$Url)
    if ([string]::IsNullOrWhiteSpace($Url)) { return $false }
    try { $hostName = ([System.Uri]$Url).Host } catch { return $false }
    return (-not ($hostName -eq "localhost" -or $hostName -eq "127.0.0.1"))
}

function Get-EnvState {
    param([string[]]$Lines)
    $api = Get-EnvValue -Lines $Lines -Key "NEXT_PUBLIC_SUPABASE_URL"
    $sb = Get-EnvValue -Lines $Lines -Key "SUPABASE_URL"
    $keys = Get-EnvKeys -Lines $Lines
    $forbidden = @($ForbiddenModelVars | Where-Object { $keys -contains $_ })
    return [pscustomobject]@{
        IsLocal   = (Test-LocalUrl $api) -or (Test-LocalUrl $sb)
        IsRemote  = (Test-RemoteUrl $api) -or (Test-RemoteUrl $sb)
        Forbidden = $forbidden
    }
}

function Remove-ForbiddenModelVars {
    param([string[]]$Lines)
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($line in $Lines) {
        $keep = $true
        if ($line -match '^([A-Za-z0-9_]+)=') {
            if ($ForbiddenModelVars -contains $Matches[1]) { $keep = $false }
        }
        if ($keep) { $out.Add($line) }
    }
    return ,$out.ToArray()
}

function Set-EnvValue {
    param([string[]]$Lines, [string]$Key, [string]$Value)
    $prefix = "$Key="
    $found = $false
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($line in $Lines) {
        if ($line.StartsWith($prefix)) {
            if (-not $found) { $out.Add("$Key=$Value"); $found = $true }
        } else {
            $out.Add($line)
        }
    }
    if (-not $found) { $out.Add("$Key=$Value") }
    return ,$out.ToArray()
}

# Grava .env sem BOM e com LF (a CLI do Supabase recusa BOM no .env.local).
function Write-EnvFile {
    param([string]$Path, [string[]]$Lines)
    $encoding = New-Object System.Text.UTF8Encoding($false)
    $text = ($Lines -join "`n") + "`n"
    [System.IO.File]::WriteAllText($Path, $text, $encoding)
}

function Invoke-Native {
    param([string]$FilePath, [string[]]$Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $FilePath @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($null -eq $output) { $output = @() }
    return [pscustomobject]@{ Output = @($output); ExitCode = $code }
}

function Get-SupabaseStatusEnv {
    $result = Invoke-Native -FilePath "npx" -Arguments @("supabase", "status", "-o", "env")
    if ($result.ExitCode -ne 0 -or -not $result.Output) { return $null }
    $map = @{}
    foreach ($line in $result.Output) {
        if ($line -match '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)="([^"]+)"$') {
            $map[$Matches[1]] = $Matches[2]
        }
    }
    if (-not $map.ContainsKey("API_URL")) { return $null }
    return $map
}

function Get-AuthCaptchaState {
    $result = Invoke-Native -FilePath "docker" -Arguments @("inspect", "supabase_auth_Vendeo_V3", "--format", "{{json .Config.Env}}")
    if ($result.ExitCode -ne 0 -or -not $result.Output) { return $null }
    $json = $result.Output | Where-Object { $_ -match '^\s*\[' } | Select-Object -First 1
    if (-not $json) { return $null }
    $items = $json | ConvertFrom-Json
    $state = @{ Enabled = $null; Provider = $null; Secret = $null }
    foreach ($item in $items) {
        if ($item -like "GOTRUE_SECURITY_CAPTCHA_ENABLED=*") { $state.Enabled = $item.Substring("GOTRUE_SECURITY_CAPTCHA_ENABLED=".Length) }
        elseif ($item -like "GOTRUE_SECURITY_CAPTCHA_PROVIDER=*") { $state.Provider = $item.Substring("GOTRUE_SECURITY_CAPTCHA_PROVIDER=".Length) }
        elseif ($item -like "GOTRUE_SECURITY_CAPTCHA_SECRET=*") { $state.Secret = $item.Substring("GOTRUE_SECURITY_CAPTCHA_SECRET=".Length) }
    }
    return $state
}

function Test-AuthCaptchaOk {
    param($AuthState)
    return ($null -ne $AuthState -and $AuthState.Enabled -eq "true" -and $AuthState.Provider -eq "turnstile" -and $AuthState.Secret -eq $turnstileTestSecret)
}

function Update-RemoteBackupFromCurrentIfRemote {
    if (-not (Test-Path -LiteralPath $envFile)) { return }
    $lines = Read-EnvLines -Path $envFile
    $state = Get-EnvState -Lines $lines
    if (-not $state.IsRemote) {
        Write-Host "Ambiente atual nao e remoto; backup remoto preservado."
        return
    }
    $needsRefresh = $true
    if (Test-Path -LiteralPath $remoteBackup) {
        $backupState = Get-EnvState -Lines (Read-EnvLines -Path $remoteBackup)
        if ($backupState.IsRemote -and $backupState.Forbidden.Count -eq 0) { $needsRefresh = $false }
    }
    if ($needsRefresh) {
        $clean = Remove-ForbiddenModelVars -Lines $lines
        Write-EnvFile -Path $remoteBackup -Lines $clean
        Write-Host "Backup remoto atualizado a partir do .env.local remoto atual (.env.local.remote.bak)."
    } else {
        Write-Host "Backup remoto ja esta valido; preservado."
    }
}

function Invoke-Local {
    # 1) Secret de teste do Turnstile para o container Auth local.
    $env:SUPABASE_AUTH_CAPTCHA_SECRET = $turnstileTestSecret

    # 2) Garante o Supabase local rodando.
    $status = Get-SupabaseStatusEnv
    if (-not $status) {
        Write-Host "Supabase local nao esta rodando; iniciando com o secret de teste do Turnstile..."
        $start = Invoke-Native -FilePath "npx" -Arguments @("supabase", "start", "--yes")
        if ($start.ExitCode -ne 0) { throw "Falha ao iniciar o Supabase local." }
        $status = Get-SupabaseStatusEnv
    }
    if (-not $status) { throw "Nao foi possivel obter as credenciais locais via 'npx supabase status -o env'." }
    if (-not (Test-LocalUrl $status.API_URL)) { throw "API_URL nao e local: $($status.API_URL)" }
    if (-not (Test-LocalUrl $status.DB_URL)) { throw "DB_URL nao e local: $($status.DB_URL)" }

    # 3) Garante o Auth local com captcha turnstile + secret de teste.
    $auth = Get-AuthCaptchaState
    if (-not (Test-AuthCaptchaOk $auth)) {
        Write-Host "Reiniciando o Supabase local para aplicar o secret de teste do Turnstile (volumes/dados preservados)..."
        $stop = Invoke-Native -FilePath "npx" -Arguments @("supabase", "stop", "--yes")
        if ($stop.ExitCode -ne 0) { throw "Falha ao parar o Supabase local." }
        $start = Invoke-Native -FilePath "npx" -Arguments @("supabase", "start", "--yes")
        if ($start.ExitCode -ne 0) { throw "Falha ao iniciar o Supabase local." }
        $status = Get-SupabaseStatusEnv
        if (-not $status) { throw "Sem credenciais locais apos reiniciar o Supabase." }
        $auth = Get-AuthCaptchaState
        if (-not (Test-AuthCaptchaOk $auth)) { throw "Auth local nao ficou com captcha/turnstile/secret de teste." }
    }
    Write-Host "Auth local OK: captcha=$($auth.Enabled) provider=$($auth.Provider) secret=test"

    # 4) Base = backup remoto validado (nunca chaves locais hardcoded).
    if (-not (Test-Path -LiteralPath $remoteBackup)) {
        throw "Backup remoto ausente (.env.local.remote.bak). Restaure o ambiente remoto primeiro para gera-lo."
    }
    $baseLines = Read-EnvLines -Path $remoteBackup
    if (-not (Get-EnvState -Lines $baseLines).IsRemote) { throw "Backup remoto invalido: endpoints nao sao remotos." }

    # 5) Aplica overrides locais + remove env-vars de modelo proibidas.
    $lines = Remove-ForbiddenModelVars -Lines $baseLines
    $overrides = [ordered]@{
        NEXT_PUBLIC_SITE_URL            = "http://localhost:3000"
        SUPABASE_URL                    = $status.API_URL
        NEXT_PUBLIC_SUPABASE_URL        = $status.API_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY   = $status.ANON_KEY
        SUPABASE_SERVICE_ROLE_KEY       = $status.SERVICE_ROLE_KEY
        SUPABASE_AUTH_CAPTCHA_SECRET    = $turnstileTestSecret
        NEXT_PUBLIC_TURNSTILE_SITE_KEY  = $turnstileTestSiteKey
        VENDEO_CAPTCHA_ENABLED          = "true"
        VENDEO_PUBLIC_SIGNUP_ENABLED    = "true"
    }
    foreach ($k in $overrides.Keys) { $lines = Set-EnvValue -Lines $lines -Key $k -Value $overrides[$k] }
    $lines = Remove-ForbiddenModelVars -Lines $lines

    Write-EnvFile -Path $envFile -Lines $lines
    Write-EnvFile -Path $localBackup -Lines $lines

    $finalKeys = Get-EnvKeys -Lines $lines
    $remaining = @($ForbiddenModelVars | Where-Object { $finalKeys -contains $_ })
    if ($remaining.Count -gt 0) { throw "Ainda existem env-vars de modelo proibidas no .env.local: $($remaining -join ', ')" }

    Write-Host "==> .env.local aponta para o Supabase LOCAL (validado, sem env-vars de modelo)."
    Write-Host "    API_URL: $($status.API_URL)"
}

function Invoke-Remote {
    if (-not (Test-Path -LiteralPath $remoteBackup)) {
        throw "Backup remoto ausente (.env.local.remote.bak). Nao ha como restaurar o ambiente remoto."
    }
    $backupLines = Read-EnvLines -Path $remoteBackup
    $state = Get-EnvState -Lines $backupLines
    if (-not $state.IsRemote) { throw "Backup remoto invalido: contem endpoints locais." }
    if ($state.Forbidden.Count -gt 0) { throw "Backup remoto contem env-vars de modelo proibidas: $($state.Forbidden -join ', ')" }
    $clean = Remove-ForbiddenModelVars -Lines $backupLines
    Write-EnvFile -Path $envFile -Lines $clean
    Write-Host "==> .env.local restaurado para o Supabase REMOTO (backup validado, sem env-vars de modelo)."
}

function Stop-DevServer {
    if (-not (Test-Path -LiteralPath $pidFile)) {
        Write-Host "Nenhum dev server controlado por este script."
        return
    }
    $raw = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    $devPid = 0
    if (-not [int]::TryParse([string]$raw, [ref]$devPid)) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
        return
    }
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $devPid" -ErrorAction SilentlyContinue
    if ($proc) {
        if ($proc.CommandLine -and $proc.CommandLine.Contains($scriptDir)) {
            Write-Host "Encerrando dev server controlado (PID $devPid)..."
            Invoke-Native -FilePath "taskkill" -Arguments @("/PID", "$devPid", "/T", "/F") | Out-Null
        } else {
            Write-Warning "PID $devPid nao pertence ao workspace Vendeo V3; nao sera encerrado."
        }
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

function Start-DevServer {
    if (-not (Test-Path -LiteralPath $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $log = Join-Path $logsDir "dev-$stamp.log"
    $cmdArgs = "/c cd /d `"$scriptDir`" && npm run dev > `"$log`" 2>&1"
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArgs -WorkingDirectory $scriptDir -WindowStyle Hidden -PassThru
    Set-Content -LiteralPath $pidFile -Value $proc.Id -Encoding ASCII
    Write-Host "Dev server iniciado (PID $($proc.Id)). Log: $log"
}

Update-RemoteBackupFromCurrentIfRemote

if ($Target -eq "local") { Invoke-Local } else { Invoke-Remote }

if (-not $NoServe) {
    Stop-DevServer
    Start-DevServer
    Write-Host "Dev server reiniciado -> http://localhost:3000"
}
