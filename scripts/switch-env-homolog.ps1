# Vendeo - Troca REVERSIVEL do .env.local para a homologacao permanente no Docker.
#
# Altera .env.local SOMENTE com -Action apply. Nunca aplica migrations/db push/provider.
# Nao imprime credenciais.
#
#   .\switch-env-homolog.ps1 -Action status     # read-only
#   .\switch-env-homolog.ps1 -Action prepare    # monta .env.local.homolog.bak (NAO toca .env.local)
#   .\switch-env-homolog.ps1 -Action apply      # revalida e troca (backup recuperavel antes)
#   .\switch-env-homolog.ps1 -Action rollback   # restaura o estado anterior
#
param([ValidateSet("status","prepare","apply","rollback")] [string]$Action = "status")

$ErrorActionPreference = "Stop"
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo        = Split-Path -Parent $scriptDir
$homologWork = "G:\Vendeo-Homolog"
$envFile     = Join-Path $repo ".env.local"
$remoteBak   = Join-Path $repo ".env.local.remote.bak"
$preBak      = Join-Path $repo ".env.local.pre-homolog.bak"
$homologBak  = Join-Path $repo ".env.local.homolog.bak"
$turnstileTestSecret = "1x0000000000000000000000000000000AA"
$turnstileTestSiteKey = "1x00000000000000000000AA"
$neutralize  = @("OPENAI_API_KEY","OPENAI_BENCH_API_KEY","GEMINI_API_KEY","GEMINI_MODEL","VERCEL_OIDC_TOKEN","SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET")
$remoteRefRe = "gvbzwihwgzujwsviufgy|pooler\.supabase\.com"

function Get-HomologStatus {
    $cfg = Get-Content -Raw (Join-Path $homologWork "supabase\config.toml")
    if ($cfg -notmatch 'project_id = "vendeo-homolog"') { throw "GUARD: project_id != vendeo-homolog" }
    $st = (& docker inspect -f "{{.State.Status}}" supabase_db_vendeo-homolog 2>$null).Trim()
    if ($st -ne "running") { throw "GUARD: container supabase_db_vendeo-homolog status=$st" }
    $out = & cmd /c "npx --no-install --prefix `"$repo`" supabase status -o env --workdir `"$homologWork`" 2>&1"
    $m = @{}
    foreach ($l in $out) { if ($l -match '^([A-Z0-9_]+)=(.*)$') { $m[$Matches[1]] = $Matches[2].Trim('"').Trim("'") } }
    if (-not $m.ContainsKey("API_URL")) { throw "GUARD: API_URL ausente" }
    $u = [uri]$m["API_URL"]
    if ($u.Host -notin @("127.0.0.1","localhost","::1") -or $u.Port -ne 57781) { throw "GUARD: API_URL precisa ser loopback:57781 (obtido host=$($u.Host) port=$($u.Port))" }
    foreach ($k in @("ANON_KEY","SERVICE_ROLE_KEY")) { if (-not $m.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($m[$k])) { throw "GUARD: chave local ausente: $k" } }
    return $m
}

function Build-HomologEnv {
    if (-not (Test-Path -LiteralPath $remoteBak)) { throw "Base ausente: $remoteBak" }
    $st = Get-HomologStatus
    $overrides = @{
        "NEXT_PUBLIC_SUPABASE_URL"      = $st["API_URL"]
        "SUPABASE_URL"                  = $st["API_URL"]
        "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $st["ANON_KEY"]
        "SUPABASE_SERVICE_ROLE_KEY"     = $st["SERVICE_ROLE_KEY"]
        "SUPABASE_AUTH_CAPTCHA_SECRET"  = $turnstileTestSecret
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY" = $turnstileTestSiteKey
        "VENDEO_CAPTCHA_ENABLED"        = "true"
        "VENDEO_GENERATION_PAUSED"      = "true"
    }
    $seen = @{}
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($l in (Get-Content -LiteralPath $remoteBak)) {
        if ($l -match '^([A-Za-z0-9_]+)=') {
            $k = $Matches[1]
            if ($neutralize -contains $k) { continue }
            if ($overrides.ContainsKey($k)) { $lines.Add("$k=$($overrides[$k])"); $seen[$k] = $true; continue }
            $seen[$k] = $true
        }
        $lines.Add($l)
    }
    foreach ($k in $overrides.Keys) { if (-not $seen.ContainsKey($k)) { $lines.Add("$k=$($overrides[$k])") } }
    foreach ($k in $neutralize) { $lines.Add("$k=") }
    return $lines
}

function Assert-HomologArtifact([string[]]$lines) {
    if ($lines | Select-String -Pattern $remoteRefRe) { throw "ARTEFATO: referencia remota detectada" }
    if (-not ($lines | Where-Object { $_ -match '^SUPABASE_URL=http://(127\.0\.0\.1|localhost):57781$' })) { throw "ARTEFATO: SUPABASE_URL nao e loopback:57781" }
    if (-not ($lines | Where-Object { $_ -match '^VENDEO_GENERATION_PAUSED=true$' })) { throw "ARTEFATO: geracao nao pausada" }
    foreach ($k in $neutralize) {
        $v = ($lines | Where-Object { $_ -match ("^" + [regex]::Escape($k) + "=") } | Select-Object -First 1)
        if ($v -and ($v -replace '^[^=]*=','').Length -gt 0) { throw "ARTEFATO: $k nao neutralizada" }
    }
}

function Write-HomologBak { $l = Build-HomologEnv; [System.IO.File]::WriteAllLines($homologBak, $l, (New-Object System.Text.UTF8Encoding($false))) }

switch ($Action) {
    "status" {
        if (Test-Path $envFile) { Write-Host (".env.local -> " + ((Get-Content $envFile | Where-Object { $_ -match '^SUPABASE_URL=' } | Select-Object -First 1))) }
        else { Write-Host ".env.local ausente" }
        Write-Host "pre-homolog.bak: $(Test-Path $preBak) ; homolog.bak: $(Test-Path $homologBak)"
    }
    "prepare" {
        $null = Get-HomologStatus
        if (-not (Test-Path -LiteralPath $preBak)) { Copy-Item -LiteralPath $envFile -Destination $preBak -Force; Write-Host "pre-homolog.bak criado (estado anterior)." }
        Write-HomologBak
        Assert-HomologArtifact (Get-Content -LiteralPath $homologBak)
        Write-Host "homolog.bak preparado e validado. .env.local NAO foi alterado."
    }
    "apply" {
        $null = Get-HomologStatus                       # revalida instancia/URL/porta/chaves
        Write-HomologBak                                # reconstroi com chaves locais atuais
        Assert-HomologArtifact (Get-Content -LiteralPath $homologBak)   # revalida artefato
        if (-not (Test-Path -LiteralPath $preBak)) { Copy-Item -LiteralPath $envFile -Destination $preBak -Force }
        Copy-Item -LiteralPath $homologBak -Destination $envFile -Force
        Write-Host "apply concluido -> homolog (127.0.0.1:57781). rollback: -Action rollback"
    }
    "rollback" {
        if (-not (Test-Path -LiteralPath $preBak)) { throw "Sem pre-homolog.bak para restaurar." }
        Copy-Item -LiteralPath $preBak -Destination $envFile -Force
        Write-Host "rollback concluido."
    }
}
