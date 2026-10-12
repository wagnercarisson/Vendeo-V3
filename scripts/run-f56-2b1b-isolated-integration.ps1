param(
  [switch]$PreflightOnly,
  [switch]$SkipApply,
  [switch]$RunSuites,
  [string[]]$Suites = @()
)

# F56.2b1b — Plano 09 (O2): runner da integração isolada REAL (Postgres/Storage
# locais; provider SIMULADO). Revalida o gate/identidade da instância descartável
# ANTES de qualquer comando de banco, copia as migrations com verificação SHA-256,
# ENUMERA as pendentes e ABORTA se qualquer pendente NÃO for uma das CINCO
# migrations b1b, e então APLICA-as SOMENTE na instância isolada via
# `migration up --local`. NUNCA `db push`, reset de produção, deploy ou provider.
# Não registra segredos: apenas URL loopback e booleans de disponibilidade.

$ErrorActionPreference = "Continue"
$workdir = "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$requiredProjectId = "vendeo-f562a-isolated"
$requiredApiUrl = "http://127.0.0.1:56321"
$requiredDbPort = 56322
$requiredBaseSha = "335bfb70"
$dedicatedPorts = 56320..56329
$b1bPrefix = "2026100900000"
$allowedPending = @(
  "20261009000001_f56_2b1b_atomic_attempt_start",
  "20261009000002_f56_2b1b_pending_resolution",
  "20261009000003_f56_2b1b_frozen_evidence",
  "20261009000004_f56_2b1b_campaign_artifacts",
  "20261009000005_f56_2b1b_copy_state"
)
$defaultSuites = @(
  "src/lib/product-1-1/__tests__/atomic-attempt.integration.test.ts",
  "src/lib/product-1-1/__tests__/credit-delivery.integration.test.ts",
  "src/lib/product-1-1/__tests__/artifact-download.integration.test.ts",
  "src/lib/product-1-1/__tests__/pending-resolution.integration.test.ts",
  "src/lib/product-1-1/__tests__/persisted-campaign.integration.test.ts",
  "src/lib/product-1-1/__tests__/integration-corrections.integration.test.ts"
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

function Write-SanitizedLines {
  param([object[]]$Lines)
  foreach ($entry in $Lines) {
    $line = [string]$entry
    foreach ($secret in $script:SecretsToRedact) {
      if ($secret) { $line = $line.Replace($secret, '[REDACTED]') }
    }
    $line = [regex]::Replace($line, '(?i)(SERVICE_ROLE_KEY|ANON_KEY|DB_URL|POSTGRES_PASSWORD|JWT_SECRET)\s*[=:]\s*\S+', '$1=[REDACTED]')
    $line = [regex]::Replace($line, '(?i)postgres(?:ql)?://\S+', '[DATABASE_URL_REDACTED]')
    $line = [regex]::Replace($line, '(?i)Bearer\s+\S+', 'Bearer [REDACTED]')
    Write-Output $line
  }
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
  if ($file.Name -like "$b1bPrefix*") {
    $copied += [pscustomobject]@{ name = $file.Name; sha256 = $srcHash; bytes = $file.Length }
  }
}
if ($shaMismatches.Count -gt 0) {
  throw "migration SHA-256 mismatch after copy: $($shaMismatches -join ', ')"
}

Write-Output "# b1b migrations copied (source revision $sourceRevision):"
$copied | ForEach-Object { Write-Output ("  {0}  {1}  {2} bytes" -f $_.name, $_.sha256, $_.bytes) }

# --- 3. Enumerate pending migrations on the isolated instance and BLOCK any
#        pending migration that is NOT one of the five b1b migrations. ---
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
  docker exec supabase_db_vendeo-f562a-isolated psql -U postgres -d postgres -t -A -c `
    "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version" 2>$null
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

# --- 4. Apply the b1b migrations ONLY on the isolated instance (migration up --local). ---
if (-not $SkipApply -and $pending.Count -gt 0) {
  $applyOutput = @(& npx --no-install supabase --workdir $workdir migration up --local 2>&1)
  $applyExit = $LASTEXITCODE
  Write-SanitizedLines -Lines $applyOutput
  if ($applyExit -ne 0) {
    Write-Output "# migration up --local FAILED (exit $applyExit)"
    exit $applyExit
  }
  Write-Output "# migration up --local exit 0"
}

# --- 5. Confirm the new relations + RPCs exist after application. ---
$relationCheck = @(
  docker exec supabase_db_vendeo-f562a-isolated psql -U postgres -d postgres -t -A -c `
    "SELECT string_agg(relname, ',' ORDER BY relname) FROM pg_class WHERE relname IN ('product_1_1_generation_attempt_claims','product_1_1_generation_outcomes','product_1_1_snapshot_frozen_evidence','product_1_1_snapshot_content_binding','product_1_1_campaign_artifacts','product_1_1_copy_state','product_1_1_copy_cancellations')" 2>$null
)
$rpcCheck = @(
  docker exec supabase_db_vendeo-f562a-isolated psql -U postgres -d postgres -t -A -c `
    "SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('product_1_1_acquire_attempt_start','product_1_1_finish_attempt','product_1_1_record_generation_outcome','product_1_1_get_campaign_operation_by_campaign','admin_resolve_product_1_1_pending','product_1_1_persist_snapshot_with_binding','product_1_1_apply_copy_state','product_1_1_cancel_copy')" 2>$null
)
Write-Output ("# relations present: {0}" -f ($relationCheck -join ' '))
Write-Output ("# rpcs present: {0}" -f ($rpcCheck -join ' '))

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
  try {
    $testOutput = @(& npx vitest run @suiteList 2>&1)
    $testExit = $LASTEXITCODE
    Write-SanitizedLines -Lines $testOutput
    if ($testExit -ne 0) { exit $testExit }
  } finally {
    Remove-Item Env:F562A_ISOLATED_SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:F562A_ISOLATED_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:F562A_ISOLATED_DATABASE_URL -ErrorAction SilentlyContinue
    $script:SecretsToRedact = @()
  }
}
