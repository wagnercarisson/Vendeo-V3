# F56.2b2c (B2.3) - Runner da homologacao permanente `vendeo-homolog` (Plano 04).
# NAO aplica nada sem `-Apply -Authorized`. `-PreflightOnly` e ESTRITAMENTE read-only.
param(
  [switch]$PreflightOnly,
  [switch]$Apply,
  [switch]$Authorized
)
$ErrorActionPreference = "Stop"

$Workdir    = "G:\Vendeo-Homolog"
$ConfigToml = Join-Path $Workdir "supabase\config.toml"
$MigsDir    = Join-Path $Workdir "supabase\migrations"
$ApiPort    = 57781
$DbPort     = 57782
$ProjectId  = "vendeo-homolog"
$Container  = "supabase_db_$ProjectId"

$AllowedPending = @(
  "20261017000001_f56_2b2c_narrow_authorization.sql",
  "20261017000002_f56_2b2c_pilot_spend_control.sql"
)
$ExpectedHash = @{
  "20261017000001_f56_2b2c_narrow_authorization.sql" = "52859A5BFA7BD7EE4AC5F38156F1D07E6C2A23CF978024BDEFE298C07D928B41"
  "20261017000002_f56_2b2c_pilot_spend_control.sql"  = "6F31F1D81277C80A83B6193C2132A55A5406B896D1555BF7305A8D8590F7DC4B"
}

$script:Failures = @()
function Check([string]$Label, [bool]$Ok) {
  if ($Ok) { Write-Output "  ok   $Label" } else { $script:Failures += $Label; Write-Output "  FAIL $Label" }
}
function Unquote([string]$v) {
  if ($null -eq $v) { return "" }
  return ($v.Trim().Trim('"').Trim("'")).Trim()
}
function Uri-Host([string]$u) { try { return ([System.Uri]$u).Host } catch { return "" } }
function Uri-Port([string]$u) { try { return ([System.Uri]$u).Port } catch { return 0 } }
function Psql([string]$Sql) {
  $out = docker exec $Container psql -U postgres -d postgres -t -A -c $Sql 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return @($out)
}

Write-Output "== F56.2b2c runner - preflight (read-only) =="

# (1) Prova de destino - config.toml
$cfgOk = (Test-Path $ConfigToml) -and ((Get-Content $ConfigToml -Raw) -match "project_id\s*=\s*`"$ProjectId`"")
Check "config.toml declara project_id = $ProjectId" $cfgOk

# (2) Container Up
$containerUp = $false
try {
  $names = docker ps --format "{{.Names}}" 2>$null
  $containerUp = (@($names) | ForEach-Object { "$_".Trim() }) -contains $Container
} catch { $containerUp = $false }
Check "container $Container Up" $containerUp

# (3) Status - parser que REMOVE ASPAS; valida host/porta API e DB
$statusEnv = $null
try { $statusEnv = npx --no-install supabase status --workdir $Workdir -o env 2>$null } catch { $statusEnv = $null }
$apiUrl = ""; $dbUrl = ""
if ($statusEnv) {
  foreach ($line in $statusEnv) {
    if ($line -match "^\s*API_URL\s*=") { $apiUrl = Unquote (($line -split "=", 2)[1]) }
    if ($line -match "^\s*DB_URL\s*=")  { $dbUrl  = Unquote (($line -split "=", 2)[1]) }
  }
}
$apiOk = ($apiUrl -ne "") -and (@("127.0.0.1","localhost","::1") -contains (Uri-Host $apiUrl)) -and ((Uri-Port $apiUrl) -eq $ApiPort)
Check "API da homolog em host local :$ApiPort (apos unquote)" $apiOk
$dbOk = ($dbUrl -ne "") -and (@("127.0.0.1","localhost","::1") -contains (Uri-Host $dbUrl)) -and ((Uri-Port $dbUrl) -eq $DbPort)
Check "DB da homolog em host local :$DbPort" $dbOk

# (4) Migrations do REPO - hash exato + conjunto autorizado
foreach ($m in $AllowedPending) {
  $path = Join-Path "supabase\migrations" $m
  $exists = Test-Path $path
  Check "migration no repo: $m" $exists
  if ($exists) { Check "SHA-256 confere: $m" (((Get-FileHash -Algorithm SHA256 $path).Hash) -ieq $ExpectedHash[$m]) }
}

# (5) Pendentes REAIS: ledger local vs TODOS os arquivos do WORKDIR (nao so B2.3)
$ledger = Psql "select version from supabase_migrations.schema_migrations"
if ($null -eq $ledger) {
  Check "ledger local legivel" $false
} else {
  Check "ledger local legivel" $true
  $workdirFiles = @()
  if (Test-Path $MigsDir) { $workdirFiles = Get-ChildItem $MigsDir -Filter "*.sql" | ForEach-Object { $_.Name } }
  $pending = @()
  foreach ($f in $workdirFiles) {
    $ver = ($f -split "_")[0]
    if (-not ($ledger -contains $ver)) { $pending += $f }
  }
  $extra = @($pending | Where-Object { $AllowedPending -notcontains $_ })
  Check "nenhuma pendente no workdir fora do conjunto autorizado" (@($extra).Count -eq 0)
}

# (6) Estado INATIVO efetivo
$flags = Psql "select key||'='||enabled from feature_flags where key like 'product_1_1_%'"
if ($null -eq $flags) {
  Check "flags product_1_1_* legiveis" $false
} else {
  Check "flags product_1_1_* legiveis" $true
  Check "product_1_1_test_stores_enabled=false" ((@($flags) -contains "product_1_1_test_stores_enabled=f") -or (@($flags) -contains "product_1_1_test_stores_enabled=false"))
  Check "product_1_1_all_stores_enabled=false" ((@($flags) -contains "product_1_1_all_stores_enabled=f") -or (@($flags) -contains "product_1_1_all_stores_enabled=false"))
}
$enabling = Psql "select count(*) from product_flow_stage_authorizations where event_type='granted' and stage <> 'off'"
Check "nenhuma autorizacao habilitadora (stage <> off)" (($null -ne $enabling) -and (([int](($enabling -join "").Trim())) -eq 0))
$envLocal = Join-Path (Get-Location) ".env.local"
Check "VENDEO_GENERATION_PAUSED=true (.env.local)" ((Test-Path $envLocal) -and ((Get-Content $envLocal -Raw) -match "VENDEO_GENERATION_PAUSED=true"))
Check "sem VENDEO_PILOT_COPY_ESTIMATED_USD no ambiente" ([string]::IsNullOrEmpty($env:VENDEO_PILOT_COPY_ESTIMATED_USD))

Write-Output ""
if ($script:Failures.Count -gt 0) { Write-Output "PREFLIGHT: FAIL ($($script:Failures.Count))"; exit 1 }
Write-Output "PREFLIGHT: PASS"
if ($PreflightOnly) { Write-Output "PreflightOnly: encerrando SEM escrita no banco."; exit 0 }
if (-not ($Apply -and $Authorized)) { Write-Output "Refuso: sem -Apply -Authorized (nenhuma escrita)."; exit 2 }

foreach ($m in $AllowedPending) { Copy-Item (Join-Path "supabase\migrations" $m) (Join-Path $MigsDir $m) -Force }
Write-Output "Copiadas 2 migrations (hash verificado) para $MigsDir"
npx --no-install supabase --workdir $Workdir migration up --local
if ($LASTEXITCODE -ne 0) { Write-Output "migration up --local EXIT=$LASTEXITCODE"; exit $LASTEXITCODE }
Write-Output "Aplicado (--local). Executar as provas em seguida no checkpoint autorizado."
exit 0
