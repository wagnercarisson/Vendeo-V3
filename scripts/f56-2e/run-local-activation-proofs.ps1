param(
  [switch]$PreflightOnly
)

$ErrorActionPreference = "Stop"

# F56.2b2e (56.2.7) - provas locais REAIS na instancia isolada de testes.
# Destino permitido: vendeo-f562a-isolated (API 56321 / DB 56322).
# NUNCA producao, homologacao permanente ou instancia de restauracao.
# Aplica SOMENTE o conjunto exato autorizado; qualquer outra pendente HALT.

$workdir = "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$projectId = "vendeo-f562a-isolated"
$apiPort = 56321
$dbPort = 56322
$dbContainer = "supabase_db_vendeo-f562a-isolated"
$configToml = Join-Path $workdir "supabase\config.toml"
$migrationsDir = Join-Path $workdir "supabase\migrations"

$allowedPending = @(
  "20261017000001_f56_2b2c_narrow_authorization.sql",
  "20261017000002_f56_2b2c_pilot_spend_control.sql",
  "20261017000003_f56_2b2c_pilot_spend_estimate_positive.sql",
  "20261018000001_quick_gpt6_luna_campaign_copy.sql",
  "20261018000002_quick_gpt6_luna_brand_profile_text.sql",
  "20261018000003_quick_gpt6_luna_brand_profile_vision.sql",
  "20261019000001_f56_2b2d_operational_test_stores_authorization.sql",
  "20261019000002_f56_2b2e_all_stores_authorization.sql",
  "20261019000003_f56_2b2e_product_flow_activation.sql",
  "20261019000004_f56_2b2e_activation_expiry_fix.sql"
)

function Fail([string]$Message) {
  Write-Output "FAIL $Message"
  exit 1
}

function Check([string]$Label, [bool]$Ok) {
  if ($Ok) { Write-Output "  ok   $Label" } else { Fail $Label }
}

Check "workdir existe" (Test-Path $workdir)
Check "config.toml declara $projectId" ((Get-Content $configToml -Raw) -match "project_id\s*=\s*`"$projectId`"")
Check "migrations dir existe" (Test-Path $migrationsDir)

$names = @(docker ps --format "{{.Names}}")
Check "container $dbContainer Up" ($names -contains $dbContainer)
Check "porta DB $dbPort no container" (((@(docker port $dbContainer 5432/tcp)) -join "`n") -match ":$dbPort$")
$tcp = New-Object System.Net.Sockets.TcpClient
try {
  $tcp.Connect("127.0.0.1", $apiPort)
  Check "API 127.0.0.1:$apiPort acessivel" $true
} catch {
  Fail "API 127.0.0.1:$apiPort inacessivel"
} finally {
  $tcp.Dispose()
}

function Psql([string]$Sql) {
  $out = docker exec $dbContainer psql -U postgres -d postgres -t -A -c $Sql 2>$null
  if ($LASTEXITCODE -ne 0) { Fail "psql falhou" }
  return @($out | Where-Object { "$_".Trim() -ne "" } | ForEach-Object { "$_".Trim() })
}

$applied = @(Psql "SELECT version FROM supabase_migrations.schema_migrations;")
$appliedSet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($v in $applied) { [void]$appliedSet.Add($v) }

$workdirFiles = @(Get-ChildItem $migrationsDir -Filter *.sql | Sort-Object Name)
$workdirNames = New-Object 'System.Collections.Generic.HashSet[string]'
$pendingSet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($file in $workdirFiles) {
  [void]$workdirNames.Add($file.Name)
  $version = ($file.Name -split "_")[0]
  if (-not $appliedSet.Contains($version)) { [void]$pendingSet.Add($file.Name) }
}
foreach ($allowed in $allowedPending) {
  if (-not $workdirNames.Contains($allowed)) { [void]$pendingSet.Add($allowed) }
}
$pending = @($pendingSet)

$allowedSet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($allowed in $allowedPending) { [void]$allowedSet.Add($allowed) }
foreach ($item in $pending) {
  Check "pendente dentro do lote autorizado: $item" ($allowedSet.Contains($item))
}
Write-Output "  info pendentes a aplicar: $($pending.Count) de $($allowedPending.Count) autorizadas"

foreach ($allowed in $allowedPending) {
  $repoFile = Join-Path (Join-Path $repoRoot "supabase\migrations") $allowed
  $workFile = Join-Path $migrationsDir $allowed
  Check "arquivo no repo: $allowed" (Test-Path $repoFile)
  if (Test-Path $workFile) {
    Check "hash repo == workdir: $allowed" ((Get-FileHash $repoFile -Algorithm SHA256).Hash -eq (Get-FileHash $workFile -Algorithm SHA256).Hash)
  }
}

if ($PreflightOnly) {
  Write-Output "PASS preflight f56-2e isolated (10 pendentes autorizadas, nenhuma extra)"
  exit 0
}

# Copia os arquivos do repo para o workdir (SOMENTE o lote autorizado).
foreach ($allowed in $allowedPending) {
  Copy-Item (Join-Path (Join-Path $repoRoot "supabase\migrations") $allowed) (Join-Path $migrationsDir $allowed) -Force
}

Write-Output "Aplicando 10 migrations autorizadas SOMENTE em $projectId..."
npx --no-install supabase --workdir $workdir migration up --local
if ($LASTEXITCODE -ne 0) { Fail "migration up --local falhou" }

$appliedAfter = @(Psql "SELECT version FROM supabase_migrations.schema_migrations;")
foreach ($allowed in $allowedPending) {
  $version = ($allowed -split "_")[0]
  Check "ledger contem $version" ($appliedAfter -contains $version)
}

$env:F56_2E_DB_HOST = "127.0.0.1"
$env:F56_2E_DB_PORT = "56322"
$env:F56_2E_DB_USER = "postgres"
$env:F56_2E_DB_PASSWORD = "postgres"
$env:F56_2E_DB_NAME = "postgres"
node (Join-Path $repoRoot "supabase\proofs\f56_2e_activation_proofs.mjs")
if ($LASTEXITCODE -ne 0) { Fail "provas reais falharam" }

Write-Output "PASS f56-2e local activation proofs"
