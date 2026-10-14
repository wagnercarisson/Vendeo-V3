param(
  [switch]$PreflightOnly,
  [switch]$SkipApply,
  [switch]$RunSuites,
  [switch]$MigrationProof,
  [string[]]$Suites = @()
)

# F56.2b2a — B2.1 (Plano 05): runner da integração isolada REAL (Postgres local;
# provider SIMULADO). Revalida o gate/identidade da instância descartável ANTES de
# qualquer comando de banco, copia as migrations com verificação SHA-256, ENUMERA
# as pendentes e ABORTA se qualquer pendente NÃO for uma das CINCO migrations b1b
# OU das TRÊS migrations B2.1, e então APLICA-as SOMENTE na instância isolada via
# `npx --no-install supabase --workdir <ISO> migration up --local`.
#
# NUNCA `db push`, `--linked`, reset de produção, deploy ou provider pago.
# Não registra segredos: apenas URL loopback e booleans de disponibilidade.
#
# APLICAÇÃO EM DUAS ETAPAS (fixtures ANTES da migração de dados — critérios
# 22/§4.6/§4.8):
#   * No MODO `-MigrationProof`, a `20261013000003` (backfill) é ESTACIONADA FORA
#     de `supabase/migrations` do workdir ANTES do passe inicial; o passe inicial
#     aplica SOMENTE `20261013000001` (identidade/lease) + `20261013000002`
#     (aquisição), REGISTRANDO as versões. É o MOVIMENTO DO ARQUIVO (nunca do
#     banco) que garante isso; NÃO é reset.
#   * A PROVA DE MIGRAÇÃO (modo `-MigrationProof`) roda na INSTÂNCIA ATUAL, SEM
#     RESET, e SÓ prossegue se a `0003` AINDA NÃO estiver aplicada (se JÁ estiver,
#     PARA e solicita uma instância de prova SEPARADA, sem destruir a existente):
#     INSERE as fixtures b1b (attempt_seq/attempt_token NULL — permitido porque a
#     `0003` ainda não foi aplicada) ⇒ RESTAURA a `0003` em `supabase/migrations`
#     ⇒ `migration up --local` REGISTRA a versão ⇒ ASSERTA NOT NULL + kind='auto'
#     + vínculo da MESMA tentativa + imutabilidade ⇒ re-executa `migration up
#     --local` provando o SKIP idempotente.
#   * Fora do modo `-MigrationProof`, a `0003` NÃO é estacionada: a aplicação
#     recorrente (`-RunSuites`) espera o schema JÁ MIGRADO (as 3 versões
#     registradas pelo `-MigrationProof`) e roda contra ele. A prova de backfill
#     exige o fluxo do `-MigrationProof`.
#
# AUTORIZAÇÃO: aplicar as TRÊS migrations B2.1 EXCLUSIVAMENTE na instância
# isolada, SOMENTE via CLI. Se o isolado estiver indisponível ⇒ PARAR (parada
# humana); NUNCA substituir por push remoto nem destruir/resetar a instância.

$ErrorActionPreference = "Continue"
$workdir = "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$requiredProjectId = "vendeo-f562a-isolated"
$requiredApiUrl = "http://127.0.0.1:56321"
$requiredDbPort = 56322
$requiredBaseSha = "335bfb70"
$dedicatedPorts = 56320..56329
$b2aPrefix = "20261013"
$dbContainer = "supabase_db_vendeo-f562a-isolated"
$backfillName = "20261013000003_f56_2b2a_copy_state_backfill.sql"
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

  $instanceRecordPath = Join-Path $repoRoot ".planning\phases\56.2-preparacao-nao-operacional-produto-1-1\56-2-ISOLATED-INSTANCE.md"
  $instanceRecord = Get-Content -LiteralPath $instanceRecordPath -Raw
  foreach ($requiredEvidence in @(
    'recovery_attempt_number: `2`',
    'recovery_start_invocations: `1`',
    'recovery_start_exit_code: `0`',
    'recovery_poststart_gate: `passed`',
    'recovery_prestart_gate: `passed`',
    'recovery_conflict_id_absent: `true`',
    'recovery_mailpit_exclusion_only: `true`',
    'rename_performed: `false`',
    'recovery_configured_ports: `[56320, 56321, 56322, 56323, 56324, 56327, 56329]`'
  )) {
    if (-not $instanceRecord.Contains($requiredEvidence)) {
      $failures.Add("isolation recovery evidence missing: $requiredEvidence")
    }
  }

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
  if (@($configuredPorts | Where-Object { $_ -lt 56320 -or $_ -gt 56329 }).Count -gt 0) {
    $failures.Add("configured port outside 56320-56329")
  }
  if (@($configuredPorts | Where-Object { $_ -ge 55320 -and $_ -le 55329 }).Count -gt 0) {
    $failures.Add("configured ports overlap F56.1")
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

  foreach ($name in @(
    "supabase_db_vendeo-f562a-isolated",
    "supabase_rest_vendeo-f562a-isolated",
    "supabase_auth_vendeo-f562a-isolated",
    "supabase_kong_vendeo-f562a-isolated"
  )) {
    if (-not @($rows | Where-Object { $_ -match ('\|' + [regex]::Escape($name) + '\|Up') }).Count) {
      $failures.Add("required container not running: $name")
    }
  }

  $f562Health = @(& docker inspect `
    supabase_db_vendeo-f562a-isolated `
    supabase_auth_vendeo-f562a-isolated `
    supabase_kong_vendeo-f562a-isolated `
    --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>$null)
  foreach ($line in $f562Health) {
    if ($line -notmatch '\|running\|healthy$') { $failures.Add("F56.2a required health failed: $line") }
  }

  $f562Rest = @(& docker inspect supabase_rest_vendeo-f562a-isolated --format '{{.Name}}|{{.State.Status}}' 2>$null)
  if (($f562Rest -join '') -notmatch '\|running$') { $failures.Add("F56.2a PostgREST not running") }

  $f561Health = @(& docker inspect `
    supabase_db_vendeo-f561-isolated `
    supabase_auth_vendeo-f561-isolated `
    supabase_kong_vendeo-f561-isolated `
    --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>$null)
  foreach ($line in $f561Health) {
    if ($line -notmatch '\|running\|healthy$') { $failures.Add("F56.1 preservation health failed: $line") }
  }
  $f561Rest = @(& docker inspect supabase_rest_vendeo-f561-isolated --format '{{.Name}}|{{.State.Status}}' 2>$null)
  if (($f561Rest -join '') -notmatch '\|running$') { $failures.Add("F56.1 PostgREST not running") }

  foreach ($volume in @('supabase_db_vendeo-f562a-isolated', 'supabase_db_vendeo-f561-isolated')) {
    if ($volumes -notcontains $volume) { $failures.Add("database volume missing: $volume") }
  }
  foreach ($network in @('supabase_network_vendeo-f562a-isolated', 'supabase_network_vendeo-f561-isolated')) {
    if ($networks -notcontains $network) { $failures.Add("network missing: $network") }
  }

  if (@($rows | Where-Object { $_ -match '(?i)Vendeo_V3.*\|Up' }).Count -gt 0) {
    $failures.Add("shared Vendeo_V3 container active")
  }
  if (@($rows | Where-Object { $_ -match '^.*supabase_inbucket_vendeo-f562a-isolated\|Up' }).Count -gt 0) {
    $failures.Add("F56.2a Mailpit active")
  }

  $portConflicts = @()
  foreach ($row in $rows) {
    foreach ($match in [regex]::Matches($row, '(?:0\.0\.0\.0|\[::\]):(\d+)->')) {
      $hostPort = [int]$match.Groups[1].Value
      if ($configuredPorts -contains $hostPort -and $row -notmatch 'vendeo-f562a-isolated') {
        $portConflicts += $row
      }
    }
  }
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $configuredPorts -contains [int]$_.LocalPort })
  foreach ($listener in $listeners) {
    $hostPort = [int]$listener.LocalPort
    $owned = @($rows | Where-Object {
      $_ -match ('vendeo-f562a-isolated\|.*(?:0\.0\.0\.0|\[::\]):' + $hostPort + '->')
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
    F562Health = $f562Health
    F562Postgrest = $f562Rest
    F561Health = $f561Health
    F561Postgrest = $f561Rest
    VendeoV3Active = [bool](@($rows | Where-Object { $_ -match '(?i)Vendeo_V3.*\|Up' }).Count)
    MailpitActive = [bool](@($rows | Where-Object { $_ -match '^.*supabase_inbucket_vendeo-f562a-isolated\|Up' }).Count)
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
function Invoke-IsolatedSql {
  param([Parameter(Mandatory = $true)][string]$Sql)
  return @(& docker exec $dbContainer psql -U postgres -d postgres -t -A -c $Sql 2>&1)
}

# Primeiro valor escalar de uma consulta ('' quando vazio). Força ARRAY antes de
# indexar (um único resultado NÃO é tratado como string indexável por caractere).
function Get-ProofScalar {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $rows = @(Invoke-IsolatedSql -Sql $Sql | Where-Object { $_ -and $_.Trim() -ne '' })
  if ($rows.Count -gt 0) { return ([string]$rows[0]).Trim() }
  return ''
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
  F562Health = $gate.F562Health
  F562Postgrest = $gate.F562Postgrest
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
#        SHA-256 verification (source revision recorded; no improper overwrite). ---
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

# --- 3. Enumerate pending migrations on the isolated instance and BLOCK any
#        pending migration that is NOT one of the five b1b / three B2.1. ---
$statusLines = @(& npx --no-install supabase status --workdir $workdir -o env 2>$null)
$statusText = $statusLines -join "`n"
$databaseUrl = Get-EnvValue -Text $statusText -Name "DB_URL"
$statusText = $null
$statusLines = $null
if (-not $databaseUrl) { throw "local database URL unavailable after passing isolation gate" }
$dbUri = $null
try { $dbUri = [uri]$databaseUrl } catch { throw "local database URL is malformed" }
if ($dbUri.Host -notin @('127.0.0.1', 'localhost') -or $dbUri.Port -ne $requiredDbPort) {
  throw "database URL is not the dedicated F56.2b1a loopback"
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

# --- 4. (MODO -MigrationProof) ESTACIONAR a `0003` FORA do workdir ANTES do
#        passe inicial ⇒ o passe inicial aplica SOMENTE `0001`+`0002`. ---
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

# --- 5. Passe inicial: aplica as pendentes (em -MigrationProof, somente
#        `0001`+`0002`) SOMENTE na instância isolada (migration up --local). ---
$pendingAfterStage = @(
  (Get-ChildItem -LiteralPath $dstMigrations -File -Filter '*.sql' |
    ForEach-Object { ($_.Name -split '_')[0] } | Sort-Object -Unique) |
    Where-Object { $appliedVersions -notcontains $_ }
)
if (-not $SkipApply -and $pendingAfterStage.Count -gt 0) {
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

  # 7.1 FIXTURES b1b no formato ANTIGO (attempt_seq/attempt_token NULL), reusando
  #     uma campanha existente (FK) e um operation_id novo.
  $fixtureCampaignRows = @(Invoke-IsolatedSql -Sql "SELECT id FROM public.campaigns ORDER BY id LIMIT 1" | Where-Object { $_ -and $_.Trim() -ne '' })
  $fixtureCampaign = if ($fixtureCampaignRows.Count -gt 0) { $fixtureCampaignRows[0].Trim() } else { $null }
  if (-not $fixtureCampaign) { Write-Output "# PROOF FAIL: no campaign available for fixture"; $script:proofOk = $false }
  $fixtureOperation = [guid]::NewGuid().ToString()
  # Payload construído por `jsonb_build_object` (SEM aspas duplas literais — evita
  # qualquer mangling de quoting entre PowerShell e a CLI/psql).
  Invoke-IsolatedSql -Sql "INSERT INTO public.product_1_1_copy_state (campaign_id, operation_id, state, copy_text, copy_payload, updated_at, created_at) VALUES ('$fixtureCampaign', '$fixtureOperation', 'failed', NULL, jsonb_build_object('title','T','caption','C','hashtags', jsonb_build_array('#a')), now(), now())" | Out-Null
  Invoke-IsolatedSql -Sql "INSERT INTO public.product_1_1_copy_cancellations (campaign_id, operation_id, reason) VALUES ('$fixtureCampaign', '$fixtureOperation', 'copy_budget_exceeded')" | Out-Null
  Write-Output "# proof: b1b fixtures inserted (attempt_seq/attempt_token NULL) campaign=$fixtureCampaign operation=$fixtureOperation"

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
  Assert-Proof ($proofExit -eq 0) "0003 migration up --local exit 0"

  $registered = @((Invoke-IsolatedSql -Sql "SELECT version FROM supabase_migrations.schema_migrations WHERE version='20261013000003'") | Where-Object { $_ -and $_.Trim() -ne '' })
  Assert-Proof ($registered.Count -eq 1) "0003 registered in schema_migrations"

  # 7.4 ASSERTS: NOT NULL + kind='auto' + vínculo da MESMA tentativa + imutabilidade.
  $stateSeq = Get-ProofScalar -Sql "SELECT attempt_seq FROM public.product_1_1_copy_state WHERE campaign_id='$fixtureCampaign' AND operation_id='$fixtureOperation'"
  Assert-Proof ($stateSeq -eq '1') "fixture copy_state attempt_seq = 1"

  $stateKind = Get-ProofScalar -Sql "SELECT copy_payload->'recovery'->>'kind' FROM public.product_1_1_copy_state WHERE campaign_id='$fixtureCampaign' AND operation_id='$fixtureOperation'"
  Assert-Proof ($stateKind -eq 'auto') "fixture copy_payload.recovery.kind = 'auto'"

  $stateNotNull = Get-ProofScalar -Sql "SELECT count(*) FROM information_schema.columns WHERE table_name='product_1_1_copy_state' AND column_name IN ('attempt_seq','attempt_token') AND is_nullable='NO'"
  Assert-Proof ($stateNotNull -eq '2') "copy_state attempt_seq/attempt_token NOT NULL"

  $cancelLink = Get-ProofScalar -Sql "SELECT count(*) FROM public.product_1_1_copy_cancellations cc JOIN public.product_1_1_copy_state cs ON cs.campaign_id=cc.campaign_id AND cs.operation_id=cc.operation_id AND cs.attempt_seq=cc.attempt_seq WHERE cc.campaign_id='$fixtureCampaign' AND cc.operation_id='$fixtureOperation' AND cc.attempt_token=cs.attempt_token AND cc.attempt_seq=1"
  Assert-Proof ($cancelLink -eq '1') "cancellation shares the SAME attempt token/seq (link)"

  $cancelNotNull = Get-ProofScalar -Sql "SELECT count(*) FROM information_schema.columns WHERE table_name='product_1_1_copy_cancellations' AND column_name IN ('attempt_seq','attempt_token') AND is_nullable='NO'"
  Assert-Proof ($cancelNotNull -eq '2') "cancellation attempt_seq/attempt_token NOT NULL"

  # Imutabilidade RESTAURADA: um UPDATE direto no cancelamento é NEGADO.
  $immUpdate = @(& docker exec $dbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "UPDATE public.product_1_1_copy_cancellations SET reason='x' WHERE campaign_id='$fixtureCampaign' AND operation_id='$fixtureOperation'" 2>&1)
  $immUpdateExit = $LASTEXITCODE
  $immUpdateText = ($immUpdate -join ' ')
  Assert-Proof ($immUpdateExit -ne 0 -and $immUpdateText -match 'product_1_1_copy_cancellations_immutable') "cancellation immutability RESTORED (UPDATE denied)"

  # 7.5 IDEMPOTÊNCIA: re-executa `migration up --local` ⇒ a versão é PULADA.
  $reapply = @(& npx --no-install supabase --workdir $workdir migration up --local 2>&1)
  $reapplyExit = $LASTEXITCODE
  Write-SanitizedLines -Lines $reapply
  Assert-Proof ($reapplyExit -eq 0) "idempotent re-run exit 0 (0003 skipped)"

  $regCount = Get-ProofScalar -Sql "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261013000003'"
  Assert-Proof ($regCount -eq '1') "0003 registered exactly once after idempotent re-run"

  if (-not $proofOk) { exit 4 }
  Write-Output "# MIGRATION PROOF: PASS (fixtures ⇒ CLI migration up --local ⇒ asserts ⇒ idempotent skip)"
}

# --- 8. Optionally run the real integration suites (provider SIMULATED). ---
if ($RunSuites) {
  $serviceRoleKey = Get-EnvValue -Text (( & npx --no-install supabase status --workdir $workdir -o env 2>$null ) -join "`n") -Name "SERVICE_ROLE_KEY"
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

      # Gate POR SUÍTE: executados > 0 E skipped = 0. Um arquivo de teste
      # INTEIRAMENTE pulado NÃO falha no vitest (exit 0); o validador é puro e
      # recebe a saída JÁ SANITIZADA (sem segredos).
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
