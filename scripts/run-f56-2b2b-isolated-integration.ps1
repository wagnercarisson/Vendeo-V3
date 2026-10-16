param(
  [switch]$PreflightOnly,
  [switch]$SkipApply,
  [switch]$RunSuites,
  [string[]]$Suites = @()
)

# F56.2b2b — B2.2 (Plano 06): runner da integração isolada REAL (Postgres/Storage
# locais; provider SIMULADO). Revalida o gate/identidade da instância descartável
# ANTES de qualquer comando de banco, copia as migrations com verificação SHA-256
# POR ARQUIVO, ENUMERA as pendentes e ABORTA se qualquer pendente NÃO for uma das
# CINCO migrations b1b OU das TRÊS B2.1 OU das TRÊS B2.2, e então APLICA-as SOMENTE
# na instância isolada via
#   `npx --no-install supabase --workdir <ISO> migration up --local`.
#
# NUNCA `db push`, `--linked`, reset de produção, deploy ou provider pago.
# Não registra segredos: apenas URL loopback e booleans de disponibilidade.
#
# ANTES DE APLICAR, o harness ASSERTA o histórico esperado da instância:
#   * as OITO migrations anteriores (5 b1b 20261009000001..00005 + 3 B2.1
#     20261013000001..00003) DEVEM estar JÁ aplicadas (são DEPENDÊNCIAS, nunca
#     autorização para reaplicação); e
#   * as pendentes DEVEM ser EXATAMENTE as TRÊS B2.2 (20261015000001..00003).
# Qualquer divergência (alguma das 8 NÃO aplicada, pendente fora do conjunto, ou
# alguma B2.2 JÁ aplicada) ⇒ HALT (imprime {applied, pending, allowed}) e exit de
# divergência. NUNCA "reparar" nem reaplicar silenciosamente.
#
# AUTORIZAÇÃO: aplicar as TRÊS migrations B2.2 EXCLUSIVAMENTE na instância
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
$b2bPrefix = "20261015"
$dbContainer = "supabase_db_vendeo-f562a-isolated"
$allowedPending = @(
  "20261009000001_f56_2b1b_atomic_attempt_start",
  "20261009000002_f56_2b1b_pending_resolution",
  "20261009000003_f56_2b1b_frozen_evidence",
  "20261009000004_f56_2b1b_campaign_artifacts",
  "20261009000005_f56_2b1b_copy_state",
  "20261013000001_f56_2b2a_copy_attempt_identity",
  "20261013000002_f56_2b2a_copy_acquire_attempt",
  "20261013000003_f56_2b2a_copy_state_backfill",
  "20261015000001_f56_2b2b_failure_closure",
  "20261015000002_f56_2b2b_pending_abandon",
  "20261015000003_f56_2b2b_pending_read",
  "20261016000001_f56_2b2b_publication_fence"
)
# As OITO migrations anteriores são DEPENDÊNCIAS JÁ APLICADAS (nunca reaplicadas).
$expectedAppliedPrior = @(
  "20261009000001", "20261009000002", "20261009000003", "20261009000004", "20261009000005",
  "20261013000001", "20261013000002", "20261013000003",
  "20261015000001", "20261015000002", "20261015000003"
)
# As TRÊS pendentes AUTORIZADAS desta fase.
$expectedPendingB2b = @("20261016000001")
$defaultSuites = @(
  "src/lib/product-1-1/__tests__/atomic-attempt.integration.test.ts",
  "src/lib/product-1-1/__tests__/credit-delivery.integration.test.ts",
  "src/lib/product-1-1/__tests__/artifact-download.integration.test.ts",
  "src/lib/product-1-1/__tests__/pending-resolution.integration.test.ts",
  "src/lib/product-1-1/__tests__/persisted-campaign.integration.test.ts",
  "src/lib/product-1-1/__tests__/integration-corrections.integration.test.ts",
  "src/lib/product-1-1/__tests__/copy-state.integration.test.ts",
  "src/lib/product-1-1/__tests__/concurrent-route-submission.integration.test.ts",
  "src/lib/product-1-1/__tests__/copy-recovery.integration.test.ts",
  "src/lib/product-1-1/__tests__/failure-closure.integration.test.ts",
  "src/lib/product-1-1/__tests__/recovery-seams.integration.test.ts"
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
#
# FAIL-CLOSED: `ON_ERROR_STOP=1` (psql PARA no 1º erro de SQL); stdout+stderr
# capturados e o exit code de psql é CHECADO. Qualquer exit != 0 ⇒ `throw`.
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
  if ($file.Name -like "$b2bPrefix*") {
    $copied += [pscustomobject]@{ name = $file.Name; sha256 = $srcHash; bytes = $file.Length }
  }
}
if ($shaMismatches.Count -gt 0) {
  throw "migration SHA-256 mismatch after copy: $($shaMismatches -join ', ')"
}

Write-Output "# B2.2 migrations copied (source revision $sourceRevision):"
$copied | ForEach-Object { Write-Output ("  {0}  {1}  {2} bytes" -f $_.name, $_.sha256, $_.bytes) }

# --- 3. Enumerate pending migrations on the isolated instance and BLOCK any
#        pending migration that is NOT one of the five b1b / three B2.1 / three
#        B2.2. ---
$statusLines = @(& npx --no-install supabase status --workdir $workdir -o env 2>$null)
$statusText = $statusLines -join "`n"
$databaseUrl = Get-EnvValue -Text $statusText -Name "DB_URL"
$statusText = $null
$statusLines = $null
if (-not $databaseUrl) { throw "local database URL unavailable after passing isolation gate" }
$dbUri = $null
try { $dbUri = [uri]$databaseUrl } catch { throw "local database URL is malformed" }
if ($dbUri.Host -notin @('127.0.0.1', 'localhost') -or $dbUri.Port -ne $requiredDbPort) {
  throw "database URL is not the dedicated F56.2b2b loopback"
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

# --- 3b. ASSERT do HISTÓRICO ESPERADO (fail-closed): as 8 anteriores JÁ aplicadas
#         e as pendentes EXATAMENTE as 3 B2.2. Divergência ⇒ HALT.
#
#         NO CAMINHO DE APLICAÇÃO (sem -SkipApply) o esperado é o estado PRÉ-
#         aplicação: as 3 B2.2 AINDA pendentes (qualquer B2.2 já aplicada ⇒
#         divergência). NO CAMINHO DE EXECUÇÃO DAS SUÍTES (-SkipApply) o estado
#         PÓS-aplicação é legítimo: as 11 anteriores/novas já aplicadas ⇒ 0
#         pendentes; mas o conjunto dos 3 B2.2 NUNCA pode estar PARCIAL (alguns
#         aplicados e outros pendentes). ---
$priorMissing = @($expectedAppliedPrior | Where-Object { $appliedVersions -notcontains $_ })
$b2bAlreadyApplied = @($expectedPendingB2b | Where-Object { $appliedVersions -contains $_ })
$pendingNotB2b = @($pending | Where-Object { $expectedPendingB2b -notcontains $_ })
$b2bNotPending = @($expectedPendingB2b | Where-Object { $pending -notcontains $_ })
$b2bPartial = ($b2bAlreadyApplied.Count -gt 0) -and ($b2bAlreadyApplied.Count -lt $expectedPendingB2b.Count)
if ($SkipApply) {
  # Pós-aplicação: exige as 8 anteriores; pendentes ⊆ 3 B2.2; conjunto NÃO parcial.
  $divergence = ($priorMissing.Count -gt 0) -or ($pendingNotB2b.Count -gt 0) -or $b2bPartial
} else {
  # Pré-aplicação: exige as 8 anteriores; pendentes == EXATAMENTE as 3 B2.2
  # (nenhuma B2.2 já aplicada).
  $divergence = ($priorMissing.Count -gt 0) -or ($b2bAlreadyApplied.Count -gt 0) -or ($pendingNotB2b.Count -gt 0) -or ($b2bNotPending.Count -gt 0)
}
if ($divergence) {
  [pscustomobject]@{
    Gate = 'HALT_HISTORY_DIVERGENCE'
    Applied = $appliedVersions
    Pending = $pending
    Allowed = $allowedPending
    PriorMissing = $priorMissing
    B2bAlreadyApplied = $b2bAlreadyApplied
    PendingNotB2b = $pendingNotB2b
    B2bNotPending = $b2bNotPending
  } | ConvertTo-Json -Depth 6
  exit 5
}
Write-Output "# assert OK: 8 prior dependencies applied; pending=$($pending.Count) (allowed set: 3 B2.2)"

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

# --- 4. Apply the B2.2 migrations ONLY on the isolated instance (migration up --local). ---
if (-not $SkipApply -and $pending.Count -gt 0) {
  $applyOutput = @(& npx --no-install supabase --workdir $workdir migration up --local 2>&1)
  $applyExit = $LASTEXITCODE
  Write-SanitizedLines -Lines $applyOutput
  if ($applyExit -ne 0) {
    Write-Output "# migration up --local FAILED (exit $applyExit)"
    exit $applyExit
  }
  Write-Output "# migration up --local exit 0"
} else {
  Write-Output "# no pending migrations to apply"
}

# --- 5. Confirm the new relations + RPCs exist after application. ---
$b2bRpcCheck = @(
  Invoke-IsolatedSql -Sql "SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('product_1_1_close_failed_operation','admin_resolve_product_1_1_pending','product_1_1_get_campaign_operation_by_campaign')"
)
$readRpcCheck = @(
  Invoke-IsolatedSql -Sql "SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc WHERE proname = 'product_1_1_get_campaign_operation_by_campaign'"
)
Write-Output ("# b2b rpcs present: {0}" -f ($b2bRpcCheck -join ' '))
if (($b2bRpcCheck -join '') -notmatch 'product_1_1_close_failed_operation') { throw "HALT: product_1_1_close_failed_operation missing after apply" }
if (($b2bRpcCheck -join '') -notmatch 'admin_resolve_product_1_1_pending') { throw "HALT: admin_resolve_product_1_1_pending missing after apply" }
if (($readRpcCheck -join '') -notmatch 'product_1_1_get_campaign_operation_by_campaign') { throw "HALT: product_1_1_get_campaign_operation_by_campaign missing after apply" }

# --- 6. Optionally run the real integration suites (provider SIMULATED). ---
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
      $testOutput = @(& npx --no-install vitest run $suite 2>&1)
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
