param(
  [switch]$PreflightOnly,
  [switch]$SkipApply,
  [switch]$RunSuites,
  [switch]$MigrationProof,
  [string[]]$Suites = @()
)

# F56.2b2a — Plano 05: PERFIL DE PROVA `vendeo-f562b-isolated` (instância NOVA e
# DESCARTÁVEL). Duplicata da harness `run-f56-2b2a-isolated-integration.ps1`
# (que opera a f562a) com CONSTANTES ajustadas: workdir, project_id, bloco de
# portas 56420..56429, nomes de container do novo projeto e env das suítes.
#
# ENDURECIMENTO FAIL-CLOSED PRESERVADO SEM ALTERAÇÃO:
#   * `ON_ERROR_STOP=1` + checagem de `$LASTEXITCODE` em TODA chamada psql;
#   * NENHUM descarte de saída (qualquer erro de SQL ⇒ `throw`);
#   * gate de PRONTIDÃO (`f56-2b2a\fixture-readiness.mjs`) que HALTA ANTES de
#     restaurar/aplicar a `0003`;
#   * toda precondição (campanha/fixtures) HALTA ANTES de qualquer migração;
#   * `$allowedPending` = CINCO b1b + TRÊS B2.1 (inalterado);
#   * recusa se a `0003` JÁ estiver aplicada (human-halt, exit 10).
#
# SEM `db push`, `--linked`, reset, `RECREATE`, deploy ou provider pago.
# Imprime apenas URL loopback e booleans (nenhum segredo).
#
# AJUSTES OBRIGATÓRIOS DESTA PROVA (vs. a harness da f562a):
#   1. PREPARO DE CAMPANHA: uma instância NOVA não tem campanhas. ANTES das
#      fixtures de copy, cria-se user/store/campanha via os helpers EXISTENTES
#      (`scripts/f56-2b2a/prepare-campaign-fixture.ts`, que reusa
#      `createTestStore`/`createCampaign` do harness de integração) e ASSERTA-se
#      que a campanha existe (FK real). NUNCA `SELECT ... LIMIT 1`.
#   2. CHECK DE `RETURNING`: `psql` também imprime a TAG DE COMANDO (`INSERT 0 1`);
#      contar TODAS as linhas confundiria status com dado. Os INSERTs rodam com
#      `psql -q` E validam EXPLICITAMENTE o UUID devolvido (mesmo critério do
#      helper puro testado `parseReturnedUuid`).
#   3. SEQUÊNCIA REAL DO PASSE INICIAL: com as 8 pendentes e SÓ a `20261013000003`
#      estacionada, o passe inicial aplica **5 b1b (20261009000001..00005) + 2
#      B2.1 (20261013000001, 20261013000002) = 7**; a `-MigrationProof` aplica a
#      `0003` (a 8ª) depois das fixtures. (NÃO é "só 0001+0002".)

$ErrorActionPreference = "Continue"
$workdir = "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562b-isolated"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$requiredProjectId = "vendeo-f562b-isolated"
$requiredApiUrl = "http://127.0.0.1:56421"
$requiredDbPort = 56422
$requiredBaseSha = "335bfb70"
$dedicatedPorts = 56420..56429
$b2aPrefix = "20261013"
$dbContainer = "supabase_db_vendeo-f562b-isolated"
$restContainer = "supabase_rest_vendeo-f562b-isolated"
$authContainer = "supabase_auth_vendeo-f562b-isolated"
$kongContainer = "supabase_kong_vendeo-f562b-isolated"
$backfillName = "20261013000003_f56_2b2a_copy_state_backfill.sql"
$readinessGuard = Join-Path $PSScriptRoot "f56-2b2a\fixture-readiness.mjs"
$fixtureHelper = Join-Path $PSScriptRoot "f56-2b2a\prepare-campaign-fixture.ts"
$uuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
$allowedPending = @(
  "20261009000001_f56_2b1b_atomic_attempt_start",
  "20261009000002_f56_2b1b_pending_resolution",
  "20261009000003_f56_2b1b_frozen_evidence",
  "20261009000004_f56_2b1b_campaign_artifacts",
  "20261009000005_f56_2b1b_copy_state",
  "20261013000001_f56_2b2a_copy_attempt_identity",
  "20261013000002_f56_2b2a_copy_acquire_attempt",
  "20261013000003_f56_2b2a_copy_state_backfill"
)
$defaultSuites = @(
  "src/lib/product-1-1/__tests__/atomic-attempt.integration.test.ts",
  "src/lib/product-1-1/__tests__/credit-delivery.integration.test.ts",
  "src/lib/product-1-1/__tests__/artifact-download.integration.test.ts",
  "src/lib/product-1-1/__tests__/pending-resolution.integration.test.ts",
  "src/lib/product-1-1/__tests__/persisted-campaign.integration.test.ts",
  "src/lib/product-1-1/__tests__/integration-corrections.integration.test.ts",
  "src/lib/product-1-1/__tests__/copy-state.integration.test.ts",
  "src/lib/product-1-1/__tests__/concurrent-route-submission.integration.test.ts",
  "src/lib/product-1-1/__tests__/copy-recovery.integration.test.ts"
)
$script:SecretsToRedact = @()

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][string]$Name
  )
  $match = [regex]::Match($Text, "(?m)^$([regex]::Escape($Name))=(.*)$")
  if (-not $match.Success) { return $null }
  $value = $match.Groups[1].Value.Trim()
  if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
    return $value.Substring(1, $value.Length - 2)
  }
  return $value
}

function Get-EnvPresence {
  param([Parameter(Mandatory = $true)][string[]]$Lines)
  $text = $Lines -join "`n"
  $apiUrl = Get-EnvValue -Text $text -Name "API_URL"
  $hasServiceRoleKey = $text -match '(?m)^SERVICE_ROLE_KEY=.+$'
  $hasDatabaseUrl = $text -match '(?m)^DB_URL=.+$'
  $text = $null
  return [pscustomobject]@{
    ApiUrl = $apiUrl
    ServiceRoleKeyAvailable = $hasServiceRoleKey
    DatabaseUrlAvailable = $hasDatabaseUrl
  }
}

function Assert-IsolatedPreflight {
  $failures = [System.Collections.Generic.List[string]]::new()

  & git cat-file -e "$requiredBaseSha^{commit}" 2>$null
  $baseExists = ($LASTEXITCODE -eq 0)
  & git merge-base --is-ancestor $requiredBaseSha HEAD 2>$null
  $baseIsAncestor = ($LASTEXITCODE -eq 0)
  if (-not $baseExists) { $failures.Add("BASE_SHA missing") }
  if (-not $baseIsAncestor) { $failures.Add("BASE_SHA not ancestor") }

  # Identidade do projeto de prova + portas dedicadas.
  $configPath = Join-Path $workdir "supabase\config.toml"
  $config = Get-Content -LiteralPath $configPath -Raw
  $projectId = [regex]::Match($config, '(?m)^project_id\s*=\s*"([^"]+)"').Groups[1].Value
  if ($projectId -ne $requiredProjectId) { $failures.Add("project_id mismatch") }

  $configuredPorts = @(
    [regex]::Matches($config, '(?m)^\s*(?:port|shadow_port)\s*=\s*(\d+)') |
      ForEach-Object { [int]$_.Groups[1].Value }
  )
  if ($configuredPorts.Count -eq 0 -or $configuredPorts.Count -ne @($configuredPorts | Sort-Object -Unique).Count) {
    $failures.Add("configured ports empty or duplicated")
  }
  if (@($configuredPorts | Where-Object { $_ -lt 56420 -or $_ -gt 56429 }).Count -gt 0) {
    $failures.Add("configured port outside 56420-56429")
  }
  # NÃO sobrepõe f561 (55320..55329), f562a (56320..56329) nem landing-lab (57321/57322).
  if (@($configuredPorts | Where-Object {
        ($_ -ge 55320 -and $_ -le 55329) -or
        ($_ -ge 56320 -and $_ -le 56329) -or
        ($_ -eq 57321) -or ($_ -eq 57322)
      }).Count -gt 0) {
    $failures.Add("configured ports overlap another instance")
  }

  $statusLines = @(& npx --no-install supabase status --workdir $workdir -o env 2>$null)
  $statusExit = $LASTEXITCODE
  $safeStatus = Get-EnvPresence -Lines $statusLines
  $statusLines = $null
  if ($statusExit -ne 0) { $failures.Add("supabase status failed") }
  if ($safeStatus.ApiUrl -ne $requiredApiUrl) { $failures.Add("API_URL not expected loopback") }

  $rows = @(& docker ps -a --no-trunc --format '{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}')
  $volumes = @(& docker volume ls --format '{{.Name}}')
  $networks = @(& docker network ls --format '{{.Name}}')

  # Containers obrigatórios da NOVA instância.
  foreach ($name in @($dbContainer, $restContainer, $authContainer, $kongContainer)) {
    if (-not @($rows | Where-Object { $_ -match ('\|' + [regex]::Escape($name) + '\|Up') }).Count) {
      $failures.Add("required container not running: $name")
    }
  }

  $f562bHealth = @(& docker inspect `
    $dbContainer $authContainer $kongContainer `
    --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>$null)
  foreach ($line in $f562bHealth) {
    if ($line -notmatch '\|running\|healthy$') { $failures.Add("f562b required health failed: $line") }
  }
  $f562bRest = @(& docker inspect $restContainer --format '{{.Name}}|{{.State.Status}}' 2>$null)
  if (($f562bRest -join '') -notmatch '\|running$') { $failures.Add("f562b PostgREST not running") }

  # PRESERVAÇÃO: a instância ATUAL (f562a) e a F56.1 (f561) devem permanecer
  # running/healthy — a prova f562b NÃO as toca.
  $f562aHealth = @(& docker inspect `
    supabase_db_vendeo-f562a-isolated supabase_auth_vendeo-f562a-isolated supabase_kong_vendeo-f562a-isolated `
    --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>$null)
  foreach ($line in $f562aHealth) {
    if ($line -notmatch '\|running\|healthy$') { $failures.Add("f562a preservation health failed: $line") }
  }
  $f562aRest = @(& docker inspect supabase_rest_vendeo-f562a-isolated --format '{{.Name}}|{{.State.Status}}' 2>$null)
  if (($f562aRest -join '') -notmatch '\|running$') { $failures.Add("f562a PostgREST not running") }

  $f561Health = @(& docker inspect `
    supabase_db_vendeo-f561-isolated supabase_auth_vendeo-f561-isolated supabase_kong_vendeo-f561-isolated `
    --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>$null)
  foreach ($line in $f561Health) {
    if ($line -notmatch '\|running\|healthy$') { $failures.Add("f561 preservation health failed: $line") }
  }
  $f561Rest = @(& docker inspect supabase_rest_vendeo-f561-isolated --format '{{.Name}}|{{.State.Status}}' 2>$null)
  if (($f561Rest -join '') -notmatch '\|running$') { $failures.Add("f561 PostgREST not running") }

  foreach ($volume in @('supabase_db_vendeo-f562b-isolated', 'supabase_db_vendeo-f562a-isolated', 'supabase_db_vendeo-f561-isolated')) {
    if ($volumes -notcontains $volume) { $failures.Add("database volume missing: $volume") }
  }
  foreach ($network in @('supabase_network_vendeo-f562b-isolated', 'supabase_network_vendeo-f562a-isolated', 'supabase_network_vendeo-f561-isolated')) {
    if ($networks -notcontains $network) { $failures.Add("network missing: $network") }
  }

  if (@($rows | Where-Object { $_ -match '(?i)Vendeo_V3.*\|Up' }).Count -gt 0) {
    $failures.Add("shared Vendeo_V3 container active")
  }
  if (@($rows | Where-Object { $_ -match '^.*supabase_inbucket_vendeo-f562b-isolated\|Up' }).Count -gt 0) {
    $failures.Add("f562b Mailpit active")
  }

  $portConflicts = @()
  foreach ($row in $rows) {
    foreach ($match in [regex]::Matches($row, '(?:0\.0\.0\.0|\[::\]):(\d+)->')) {
      $hostPort = [int]$match.Groups[1].Value
      if ($configuredPorts -contains $hostPort -and $row -notmatch 'vendeo-f562b-isolated') {
        $portConflicts += $row
      }
    }
  }
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $configuredPorts -contains [int]$_.LocalPort })
  foreach ($listener in $listeners) {
    $hostPort = [int]$listener.LocalPort
    $owned = @($rows | Where-Object {
      $_ -match ('vendeo-f562b-isolated\|.*(?:0\.0\.0\.0|\[::\]):' + $hostPort + '->')
    })
    if (-not $owned.Count) { $portConflicts += "unowned listener:$hostPort" }
  }
  if ($portConflicts.Count -gt 0) { $failures.Add("dedicated port conflict/mapping owner mismatch") }

  return [pscustomobject]@{
    Pass = ($failures.Count -eq 0)
    Failures = @($failures)
    ProjectId = $projectId
    StatusExit = $statusExit
    ApiLoopback = $safeStatus.ApiUrl
    ServiceRoleKeyAvailable = $safeStatus.ServiceRoleKeyAvailable
    DatabaseUrlAvailable = $safeStatus.DatabaseUrlAvailable
    ConfiguredPorts = $configuredPorts
    PortConflicts = $portConflicts
    F562BHealth = $f562bHealth
    F562BPostgrest = $f562bRest
    F562AHealth = $f562aHealth
    F562ARest = $f562aRest
    F561Health = $f561Health
    F561Postgrest = $f561Rest
    VendeoV3Active = [bool](@($rows | Where-Object { $_ -match '(?i)Vendeo_V3.*\|Up' }).Count)
    MailpitActive = [bool](@($rows | Where-Object { $_ -match '^.*supabase_inbucket_vendeo-f562b-isolated\|Up' }).Count)
  }
}

function Get-SanitizedLines {
  param([object[]]$Lines)
  $result = foreach ($entry in $Lines) {
    $line = [string]$entry
    foreach ($secret in $script:SecretsToRedact) {
      if ($secret) { $line = $line.Replace($secret, '[REDACTED]') }
    }
    $line = [regex]::Replace($line, '(?i)(SERVICE_ROLE_KEY|ANON_KEY|DB_URL|POSTGRES_PASSWORD|JWT_SECRET)\s*[=:]\s*\S+', '$1=[REDACTED]')
    $line = [regex]::Replace($line, '(?i)postgres(?:ql)?://\S+', '[DATABASE_URL_REDACTED]')
    $line = [regex]::Replace($line, '(?i)Bearer\s+\S+', 'Bearer [REDACTED]')
    $line
  }
  return @($result)
}

function Write-SanitizedLines {
  param([object[]]$Lines)
  foreach ($line in Get-SanitizedLines -Lines $Lines) {
    Write-Output $line
  }
}

# Executa SQL no Postgres isolado (somente leitura/fixtures locais). Devolve as
# linhas (modo -t -A). Segredos NÃO passam por aqui (nenhuma URL/credencial).
#
# FAIL-CLOSED: `ON_ERROR_STOP=1`; stdout+stderr capturados e o exit code de psql é
# CHECADO. Qualquer exit != 0 ⇒ `throw`. NÃO há descarte de saída.
function Invoke-IsolatedSql {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $output = @(& docker exec $dbContainer psql -U postgres -d postgres -t -A -v ON_ERROR_STOP=1 -c $Sql 2>&1)
  $exit = $LASTEXITCODE
  if ($exit -ne 0) {
    $detail = ($output | ForEach-Object { [string]$_ }) -join ' '
    throw "isolated SQL failed (psql exit $exit): $detail"
  }
  return $output
}

# AJUSTE 2 — INSERT de fixture com `RETURNING`: roda psql com `-q` (a TAG DE
# COMANDO `INSERT 0 1` NÃO é emitida) E valida EXPLICITAMENTE o UUID devolvido
# (mesmo critério de `parseReturnedUuid` no guard). NUNCA conta linhas cruas.
function Invoke-FixtureInsertReturningUuid {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $output = @(& docker exec $dbContainer psql -U postgres -d postgres -q -t -A -v ON_ERROR_STOP=1 -c $Sql 2>&1)
  $exit = $LASTEXITCODE
  if ($exit -ne 0) {
    $detail = ($output | ForEach-Object { [string]$_ }) -join ' '
    throw "isolated fixture INSERT failed (psql exit $exit): $detail"
  }
  $uuids = @($output | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -match $uuidPattern })
  if ($uuids.Count -ne 1) {
    throw "HALT: fixture INSERT did not return exactly one UUID (got $($uuids.Count); raw='$($output -join '|')')"
  }
  return $uuids[0]
}

# Observação de UMA fixture para o gate de prontidão. Corrige o defeito herdado:
# `product_1_1_copy_cancellations` NÃO tem as colunas `attempt_seq`/`attempt_token`
# ANTES da `0003` (elas são ADICIONADAS pela própria `0003`). Referenciá-las antes
# da migração faz o psql falhar (`column attempt_seq does not exist`). Pré-`0003`,
# a identidade do cancelamento é VACUOSAMENTE NULL (as colunas ainda não existem ⇒
# a linha está inequivocamente no formato antigo). Para `copy_state` (que JÁ tem as
# colunas após o passe inicial/`0001`) a checagem de NULL é feita normalmente.
function Get-FixtureObservation {
  param(
    [Parameter(Mandatory = $true)][string]$Table,
    [Parameter(Mandatory = $true)][string]$CampaignId,
    [Parameter(Mandatory = $true)][string]$OperationId
  )
  $hasIdentity = Get-ProofScalar -Sql "SELECT count(*) FROM information_schema.columns WHERE table_name='$Table' AND column_name='attempt_seq'"
  $total = [int](Get-ProofScalar -Sql "SELECT count(*) FROM public.$Table WHERE campaign_id='$CampaignId' AND operation_id='$OperationId'")
  $nulls = $total
  if ($hasIdentity -eq '1') {
    $nulls = [int](Get-ProofScalar -Sql "SELECT count(*) FILTER (WHERE attempt_seq IS NULL AND attempt_token IS NULL) FROM public.$Table WHERE campaign_id='$CampaignId' AND operation_id='$OperationId'")
  }
  return [pscustomobject]@{
    present = ($total -gt 0)
    nullIdentity = ($total -gt 0 -and $nulls -eq $total)
  }
}

# GATE de PRONTIDÃO fail-closed ANTES de restaurar/aplicar a `0003`: delega a
# decisão ao guard PURO `scripts/f56-2b2a/fixture-readiness.mjs`. Exige AMBAS as
# fixtures presentes com identidade NULL. Se o guard bloquear ⇒ `throw` (HALT
# antes de qualquer `migration up`). NÃO aplica nada.
function Assert-FixtureReadiness {
  param(
    [Parameter(Mandatory = $true)][string]$CampaignId,
    [Parameter(Mandatory = $true)][string]$OperationId
  )
  $payload = [pscustomobject]@{
    campaignPresent = $true
    stateFixture = (Get-FixtureObservation -Table 'product_1_1_copy_state' -CampaignId $CampaignId -OperationId $OperationId)
    cancellationFixture = (Get-FixtureObservation -Table 'product_1_1_copy_cancellations' -CampaignId $CampaignId -OperationId $OperationId)
  } | ConvertTo-Json -Compress -Depth 4
  $guardOut = @($payload | & node $readinessGuard 2>&1)
  $guardExit = $LASTEXITCODE
  $guardText = ($guardOut | ForEach-Object { [string]$_ }) -join ' '
  Write-Output "# fixture readiness guard: exit $guardExit :: $guardText"
  if ($guardExit -ne 0) {
    throw "HALT: fixture readiness failed before 0003 (guard exit $guardExit)"
  }
}

# Primeiro valor escalar de uma consulta ('' quando vazio). Força ARRAY antes de
# indexar.
function Get-ProofScalar {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $rows = @(Invoke-IsolatedSql -Sql $Sql | Where-Object { $_ -and $_.Trim() -ne '' })
  if ($rows.Count -gt 0) { return ([string]$rows[0]).Trim() }
  return ''
}

# AJUSTE 1 — PREPARO das fixtures de campanha via os HELPERS EXISTENTES
# (`prepare-campaign-fixture.ts` → `createTestStore`/`createCampaign`). Devolve o
# objeto com `campaignId`/`storeId`/`userId`. NUNCA `SELECT ... LIMIT 1`.
function New-CampaignFixture {
  param(
    [Parameter(Mandatory = $true)][string]$SupabaseUrl,
    [Parameter(Mandatory = $true)][string]$ServiceRoleKey
  )
  $env:F562B_ISOLATED_SUPABASE_URL = $SupabaseUrl
  $env:F562B_ISOLATED_SERVICE_ROLE_KEY = $ServiceRoleKey
  try {
    $raw = @(& npx --no-install tsx $fixtureHelper 2>&1)
    $exit = $LASTEXITCODE
  } finally {
    Remove-Item Env:F562B_ISOLATED_SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:F562B_ISOLATED_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  }
  if ($exit -ne 0) {
    $detail = ($raw | ForEach-Object { [string]$_ }) -join ' '
    throw "HALT: campaign fixture helper failed (exit $exit): $detail"
  }
  $jsonLine = @($raw | Where-Object { ([string]$_).Trim().StartsWith('{') } | Select-Object -Last 1)
  if ($jsonLine.Count -eq 0) {
    throw "HALT: campaign fixture helper produced no JSON: $((($raw | ForEach-Object { [string]$_ }) -join ' '))"
  }
  return ($jsonLine[0] | ConvertFrom-Json)
}

# --- 1. Revalidate gate + isolated-instance identity (fail-closed). ---
$gate = Assert-IsolatedPreflight
if (-not $gate.Pass) {
  [pscustomobject]@{ Preflight = 'FAIL'; Failures = $gate.Failures; CredentialValues = 'suppressed' } | ConvertTo-Json -Depth 4
  exit 2
}

$preflightReport = [pscustomobject]@{
  Preflight = 'PASS'
  ProjectId = $gate.ProjectId
  ApiLoopback = $gate.ApiLoopback
  ConfiguredPorts = $gate.ConfiguredPorts
  F562BHealth = $gate.F562BHealth
  F562BPostgrest = $gate.F562BPostgrest
  F562AHealth = $gate.F562AHealth
  F562ARest = $gate.F562ARest
  F561Health = $gate.F561Health
  F561Postgrest = $gate.F561Postgrest
  VendeoV3Active = $gate.VendeoV3Active
  MailpitActive = $gate.MailpitActive
  ServiceRoleKeyAvailable = $gate.ServiceRoleKeyAvailable
  DatabaseUrlAvailable = $gate.DatabaseUrlAvailable
  CredentialValues = 'suppressed'
}
$preflightReport | ConvertTo-Json -Depth 4

if ($PreflightOnly) { exit 0 }

# --- 2. Copy supabase/migrations/* into the isolated workdir with per-file
#        SHA-256 verification (source revision recorded). ---
$srcMigrations = Join-Path $repoRoot "supabase\migrations"
$dstMigrations = Join-Path $workdir "supabase\migrations"
if (-not (Test-Path -LiteralPath $dstMigrations)) {
  throw "isolated migrations directory missing: $dstMigrations"
}

$sourceRevision = (& git -C $repoRoot rev-parse HEAD 2>$null)
$copied = @()
$shaMismatches = @()
foreach ($file in Get-ChildItem -LiteralPath $srcMigrations -File -Filter '*.sql') {
  $srcHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
  $dstPath = Join-Path $dstMigrations $file.Name
  Copy-Item -LiteralPath $file.FullName -Destination $dstPath -Force
  $dstHash = (Get-FileHash -LiteralPath $dstPath -Algorithm SHA256).Hash
  if ($srcHash -ne $dstHash) { $shaMismatches += $file.Name }
  if ($file.Name -like "$b2aPrefix*") {
    $copied += [pscustomobject]@{ name = $file.Name; sha256 = $srcHash; bytes = $file.Length }
  }
}
if ($shaMismatches.Count -gt 0) {
  throw "migration SHA-256 mismatch after copy: $($shaMismatches -join ', ')"
}

Write-Output "# B2.1 migrations copied (source revision $sourceRevision):"
$copied | ForEach-Object { Write-Output ("  {0}  {1}  {2} bytes" -f $_.name, $_.sha256, $_.bytes) }

# --- 3. Enumerate pending migrations and BLOCK any pending migration that is NOT
#        one of the five b1b / three B2.1. ---
$statusLines = @(& npx --no-install supabase status --workdir $workdir -o env 2>$null)
$statusText = $statusLines -join "`n"
$databaseUrl = Get-EnvValue -Text $statusText -Name "DB_URL"
$serviceRoleKey = Get-EnvValue -Text $statusText -Name "SERVICE_ROLE_KEY"
$statusText = $null
$statusLines = $null
if (-not $databaseUrl) { throw "local database URL unavailable after passing isolation gate" }
$dbUri = $null
try { $dbUri = [uri]$databaseUrl } catch { throw "local database URL is malformed" }
if ($dbUri.Host -notin @('127.0.0.1', 'localhost') -or $dbUri.Port -ne $requiredDbPort) {
  throw "database URL is not the dedicated F56.2b2a proof loopback"
}

$appliedVersions = @(
  Invoke-IsolatedSql -Sql "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"
) | Where-Object { $_ -and $_.Trim() -ne '' } | ForEach-Object { $_.Trim() }

$diskVersions = @(
  Get-ChildItem -LiteralPath $dstMigrations -File -Filter '*.sql' |
    ForEach-Object { ($_.Name -split '_')[0] } |
    Sort-Object -Unique
)
$pending = @($diskVersions | Where-Object { $appliedVersions -notcontains $_ })

Write-Output "# pending migrations enumerated: $($pending.Count)"
$pending | ForEach-Object { Write-Output "  pending: $_" }

if ($SkipApply -and $pending.Count -gt 0) { Write-Output "# -SkipApply set; not applying." }

$blockedPending = @()
foreach ($version in $pending) {
  $match = @($allowedPending | Where-Object { $_ -like "$($version)_*" })
  if ($match.Count -eq 0) { $blockedPending += $version }
}
if ($blockedPending.Count -gt 0) {
  [pscustomobject]@{
    Gate = 'BLOCKED_PENDING_MIGRATION'
    PendingNotAllowed = $blockedPending
    Allowed = $allowedPending
  } | ConvertTo-Json -Depth 4
  exit 3
}

$backfillApplied = $appliedVersions -contains "20261013000003"

# --- 4. (MODO -MigrationProof) ESTACIONAR a `0003` FORA do workdir ANTES do passe
#        inicial ⇒ o passe inicial aplica as 7 (5 b1b + 0001 + 0002). ---
$deferredDir = Join-Path $workdir "supabase\b2a-deferred"
$backfillDst = Join-Path $dstMigrations $backfillName
$backfillDeferred = Join-Path $deferredDir $backfillName
if ($MigrationProof -and -not $SkipApply) {
  if ($backfillApplied) {
    Write-Output "# HUMAN-HALT: migration 20261013000003 já aplicada; a prova de backfill exige instância separada (a existente NÃO deve ser destruída)."
    exit 10
  }
  if (Test-Path -LiteralPath $backfillDst) {
    if (-not (Test-Path -LiteralPath $deferredDir)) {
      New-Item -ItemType Directory -Path $deferredDir -Force | Out-Null
    }
    Move-Item -LiteralPath $backfillDst -Destination $backfillDeferred -Force
    Write-Output "# B2.1: 0003 estacionada fora do passe inicial (arquivo movido, SEM reset de banco)."
  }
}

# --- 5. Passe inicial: aplica as pendentes (em -MigrationProof, as 7 anteriores
#        à `0003`) SOMENTE na instância isolada (migration up --local). ---
$pendingAfterStage = @(
  (Get-ChildItem -LiteralPath $dstMigrations -File -Filter '*.sql' |
    ForEach-Object { ($_.Name -split '_')[0] } | Sort-Object -Unique) |
    Where-Object { $appliedVersions -notcontains $_ }
)
if (-not $SkipApply -and $pendingAfterStage.Count -gt 0) {
  Write-Output "# initial pass: applying $($pendingAfterStage.Count) pending migration(s): $($pendingAfterStage -join ', ')"
  $applyOutput = @(& npx --no-install supabase --workdir $workdir migration up --local 2>&1)
  $applyExit = $LASTEXITCODE
  Write-SanitizedLines -Lines $applyOutput
  if ($applyExit -ne 0) {
    Write-Output "# migration up --local FAILED (exit $applyExit)"
    exit $applyExit
  }
  Write-Output "# migration up --local exit 0"
} else {
  Write-Output "# no pending migrations to apply in the initial pass"
}

# --- 6. Confirm the new relations + RPCs exist after application. ---
$relationCheck = @(
  Invoke-IsolatedSql -Sql "SELECT string_agg(relname, ',' ORDER BY relname) FROM pg_class WHERE relname IN ('product_1_1_generation_attempt_claims','product_1_1_generation_outcomes','product_1_1_snapshot_frozen_evidence','product_1_1_snapshot_content_binding','product_1_1_campaign_artifacts','product_1_1_copy_state','product_1_1_copy_cancellations')"
)
$rpcCheck = @(
  Invoke-IsolatedSql -Sql "SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('product_1_1_apply_copy_state','product_1_1_cancel_copy','product_1_1_acquire_copy_attempt','product_1_1_acquire_attempt_start','product_1_1_finish_attempt','product_1_1_reserve_credit_operation')"
)
$copyStateColumns = @(
  Invoke-IsolatedSql -Sql "SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_name='product_1_1_copy_state' AND column_name IN ('attempt_seq','attempt_token','lease_at','request_token')"
)
Write-Output ("# relations present: {0}" -f ($relationCheck -join ' '))
Write-Output ("# rpcs present: {0}" -f ($rpcCheck -join ' '))
Write-Output ("# copy_state identity columns present: {0}" -f ($copyStateColumns -join ' '))

# --- 7. PROVA DE MIGRAÇÃO do backfill (modo -MigrationProof; INSTÂNCIA ATUAL,
#        SEM RESET; SEPARADA da execução recorrente das suítes). ---
if ($MigrationProof -and -not $SkipApply) {
  $proofOk = $true
  function Assert-Proof { param([bool]$Cond, [string]$Label) if (-not $Cond) { Write-Output "# PROOF FAIL: $Label"; $script:proofOk = $false } else { Write-Output "# proof ok: $Label" } }

  # 7.0 Re-checa: a `0003` AINDA NÃO aplicada (senão human-halt).
  $stillNotApplied = -not ((Invoke-IsolatedSql -Sql "SELECT version FROM supabase_migrations.schema_migrations WHERE version='20261013000003'") | Where-Object { $_ -and $_.Trim() -ne '' })
  if (-not $stillNotApplied) {
    Write-Output "# HUMAN-HALT: 20261013000003 aplicada; prova exige instância separada."
    exit 10
  }
  Write-Output "# proof: 0003 NOT previously applied (fixtures may be inserted in the old shape)"

  # 7.1 AJUSTE 1 — PREPARO das fixtures de CAMPANHA (uma instância nova NÃO tem
  #     campanhas). Reusa os helpers existentes e ASSERTA que a campanha existe
  #     ANTES de inserir as fixtures de copy (FK real). NUNCA `SELECT ... LIMIT 1`.
  if (-not $serviceRoleKey) { throw "HALT: SERVICE_ROLE_KEY unavailable for the campaign fixture helper" }
  $script:SecretsToRedact = @($serviceRoleKey)
  $fixture = New-CampaignFixture -SupabaseUrl $gate.ApiLoopback -ServiceRoleKey $serviceRoleKey
  $fixtureCampaign = ([string]$fixture.campaignId).Trim()
  if ($fixtureCampaign -notmatch $uuidPattern) {
    throw "HALT: campaign fixture helper returned no valid campaign_id"
  }
  $campaignExists = Get-ProofScalar -Sql "SELECT count(*) FROM public.campaigns WHERE id='$fixtureCampaign'"
  if ($campaignExists -ne '1') {
    throw "HALT: prepared campaign fixture NOT found before inserting copy fixtures (count='$campaignExists')"
  }
  Write-Output "# proof: campaign fixture prepared and confirmed (store/user/campaign created via existing helpers)"
  $fixtureOperation = [guid]::NewGuid().ToString()

  # 7.1a FIXTURES b1b no formato ANTIGO (attempt_seq/attempt_token NULL), com o
  #      `campaign_id` REAL da fixture. AJUSTE 2: `psql -q` + validação EXPLÍCITA
  #      do UUID devolvido (a TAG DE COMANDO `INSERT 0 1` NUNCA é confundida com
  #      uma linha de dados).
  $stateReturned = Invoke-FixtureInsertReturningUuid -Sql "INSERT INTO public.product_1_1_copy_state (campaign_id, operation_id, state, copy_text, copy_payload, updated_at, created_at) VALUES ('$fixtureCampaign', '$fixtureOperation', 'failed', NULL, jsonb_build_object('title','T','caption','C','hashtags', jsonb_build_array('#a')), now(), now()) RETURNING campaign_id"
  $cancelReturned = Invoke-FixtureInsertReturningUuid -Sql "INSERT INTO public.product_1_1_copy_cancellations (campaign_id, operation_id, reason) VALUES ('$fixtureCampaign', '$fixtureOperation', 'copy_budget_exceeded') RETURNING campaign_id"
  if ($stateReturned -ne $fixtureCampaign -or $cancelReturned -ne $fixtureCampaign) {
    throw "HALT: fixture INSERT RETURNING did not match the prepared campaign_id"
  }
  Write-Output "# proof: b1b fixtures inserted (attempt_seq/attempt_token NULL), campaign=$fixtureCampaign operation=$fixtureOperation"

  # 7.1b GATE de PRONTIDÃO (fail-closed): AMBAS as fixtures DEVEM existir com
  #      identidade NULL. Se qualquer uma faltar/NÃO for NULL ⇒ HALT ANTES de
  #      restaurar/aplicar a `0003`.
  Assert-FixtureReadiness -CampaignId $fixtureCampaign -OperationId $fixtureOperation

  # 7.2 RESTAURA a `0003` em `supabase/migrations`.
  if (Test-Path -LiteralPath $backfillDeferred) {
    Copy-Item -LiteralPath $backfillDeferred -Destination $backfillDst -Force
    Remove-Item -LiteralPath $backfillDeferred -Force -ErrorAction SilentlyContinue
    Write-Output "# proof: 0003 restored into workdir supabase/migrations"
  }

  # 7.3 Aplica `0003` PELO CLI (REGISTRA a versão em schema_migrations).
  $proofApply = @(& npx --no-install supabase --workdir $workdir migration up --local 2>&1)
  $proofExit = $LASTEXITCODE
  Write-SanitizedLines -Lines $proofApply
  if ($proofExit -ne 0) {
    throw "HALT: migration up --local FAILED for 0003 (exit $proofExit)"
  }
  Write-Output "# proof: 0003 migration up --local exit 0"

  $registered = @((Invoke-IsolatedSql -Sql "SELECT version FROM supabase_migrations.schema_migrations WHERE version='20261013000003'") | Where-Object { $_ -and $_.Trim() -ne '' })
  Assert-Proof ($registered.Count -eq 1) "0003 registered in schema_migrations"

  # 7.4 ASSERTS: NOT NULL + kind='auto' + vínculo da MESMA tentativa + imutabilidade.
  $stateSeq = Get-ProofScalar -Sql "SELECT attempt_seq FROM public.product_1_1_copy_state WHERE campaign_id='$fixtureCampaign' AND operation_id='$fixtureOperation'"
  Assert-Proof ($stateSeq -eq '1') "fixture copy_state attempt_seq = 1"

  $stateKind = Get-ProofScalar -Sql "SELECT copy_payload->'recovery'->>'kind' FROM public.product_1_1_copy_state WHERE campaign_id='$fixtureCampaign' AND operation_id='$fixtureOperation'"
  Assert-Proof ($stateKind -eq 'auto') "fixture copy_payload.recovery.kind = 'auto'"

  $stateToken = Get-ProofScalar -Sql "SELECT attempt_token FROM public.product_1_1_copy_state WHERE campaign_id='$fixtureCampaign' AND operation_id='$fixtureOperation'"
  Assert-Proof ($stateToken -match $uuidPattern) "fixture copy_state attempt_token NOT NULL (uuid)"

  $stateNotNull = Get-ProofScalar -Sql "SELECT count(*) FROM information_schema.columns WHERE table_name='product_1_1_copy_state' AND column_name IN ('attempt_seq','attempt_token') AND is_nullable='NO'"
  Assert-Proof ($stateNotNull -eq '2') "copy_state attempt_seq/attempt_token NOT NULL"

  $cancelLink = Get-ProofScalar -Sql "SELECT count(*) FROM public.product_1_1_copy_cancellations cc JOIN public.product_1_1_copy_state cs ON cs.campaign_id=cc.campaign_id AND cs.operation_id=cc.operation_id AND cs.attempt_seq=cc.attempt_seq WHERE cc.campaign_id='$fixtureCampaign' AND cc.operation_id='$fixtureOperation' AND cc.attempt_token=cs.attempt_token AND cc.attempt_seq=1"
  Assert-Proof ($cancelLink -eq '1') "cancellation shares the SAME attempt token/seq (link)"

  $cancelNotNull = Get-ProofScalar -Sql "SELECT count(*) FROM information_schema.columns WHERE table_name='product_1_1_copy_cancellations' AND column_name IN ('attempt_seq','attempt_token') AND is_nullable='NO'"
  Assert-Proof ($cancelNotNull -eq '2') "cancellation attempt_seq/attempt_token NOT NULL"

  # Imutabilidade RESTAURADA: um UPDATE direto no cancelamento é NEGADO.
  # NOTA DELIBERADA: aqui um exit != 0 é o RESULTADO ESPERADO (probe negativo).
  $immUpdate = @(& docker exec $dbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "UPDATE public.product_1_1_copy_cancellations SET reason='x' WHERE campaign_id='$fixtureCampaign' AND operation_id='$fixtureOperation'" 2>&1)
  $immUpdateExit = $LASTEXITCODE
  $immUpdateText = ($immUpdate -join ' ')
  Assert-Proof ($immUpdateExit -ne 0 -and $immUpdateText -match 'product_1_1_copy_cancellations_immutable') "cancellation immutability RESTORED (UPDATE denied)"

  # 7.5 IDEMPOTÊNCIA: re-executa `migration up --local` ⇒ a versão é PULADA.
  $reapply = @(& npx --no-install supabase --workdir $workdir migration up --local 2>&1)
  $reapplyExit = $LASTEXITCODE
  Write-SanitizedLines -Lines $reapply
  if ($reapplyExit -ne 0) {
    throw "HALT: idempotent re-run of migration up --local FAILED (exit $reapplyExit)"
  }
  Write-Output "# proof: idempotent re-run exit 0 (0003 skipped)"

  $regCount = Get-ProofScalar -Sql "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261013000003'"
  Assert-Proof ($regCount -eq '1') "0003 registered exactly once after idempotent re-run"

  if (-not $proofOk) { exit 4 }
  Write-Output "# MIGRATION PROOF: PASS (fixtures ⇒ CLI migration up --local ⇒ asserts ⇒ idempotent skip)"
}

# --- 8. Optionally run the real integration suites (provider SIMULATED). ---
if ($RunSuites) {
  if (-not $serviceRoleKey -or -not $databaseUrl) {
    $statusLines = @(& npx --no-install supabase status --workdir $workdir -o env 2>$null)
    $statusText = $statusLines -join "`n"
    if (-not $serviceRoleKey) { $serviceRoleKey = Get-EnvValue -Text $statusText -Name "SERVICE_ROLE_KEY" }
    if (-not $databaseUrl) { $databaseUrl = Get-EnvValue -Text $statusText -Name "DB_URL" }
    $statusText = $null
    $statusLines = $null
  }
  if (-not $serviceRoleKey -or -not $databaseUrl) {
    throw "required local test credential unavailable after passing isolation gate"
  }
  $env:F562A_ISOLATED_SUPABASE_URL = $gate.ApiLoopback
  $env:F562A_ISOLATED_SERVICE_ROLE_KEY = $serviceRoleKey
  $env:F562A_ISOLATED_DATABASE_URL = $databaseUrl
  $script:SecretsToRedact = @($serviceRoleKey, $databaseUrl)
  $serviceRoleKey = $null
  $databaseUrl = $null

  $suiteList = if ($Suites.Count -gt 0) { $Suites } else { $defaultSuites }
  $overallExit = 0
  try {
    foreach ($suite in $suiteList) {
      Write-Output "# running suite: $suite"
      $testOutput = @(& npx vitest run $suite 2>&1)
      $suiteExit = $LASTEXITCODE
      $sanitized = @(Get-SanitizedLines -Lines $testOutput)
      foreach ($line in $sanitized) { Write-Output $line }
      if ($suiteExit -ne 0) { $overallExit = $suiteExit }

      $coveragePath = Join-Path ([System.IO.Path]::GetTempPath()) `
        ("f562b-suite-coverage-" + [guid]::NewGuid().ToString('N') + ".txt")
      try {
        Set-Content -LiteralPath $coveragePath -Value ($sanitized -join "`n") -Encoding UTF8
        & npx --no-install tsx scripts/verify/f56-2-2-suite-skip-guard.ts --suite $suite --output-file $coveragePath
        if ($LASTEXITCODE -ne 0) { $overallExit = 1 }
      } finally {
        Remove-Item -LiteralPath $coveragePath -ErrorAction SilentlyContinue
      }
    }
    if ($overallExit -ne 0) { exit $overallExit }
  } finally {
    Remove-Item Env:F562A_ISOLATED_SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:F562A_ISOLATED_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:F562A_ISOLATED_DATABASE_URL -ErrorAction SilentlyContinue
    $script:SecretsToRedact = @()
  }
}
