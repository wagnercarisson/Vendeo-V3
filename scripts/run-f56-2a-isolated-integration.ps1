param()

$ErrorActionPreference = "Continue"
$workdir = "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$requiredProjectId = "vendeo-f562a-isolated"
$requiredApiUrl = "http://127.0.0.1:56321"
$requiredBaseSha = "335bfb70"
$dedicatedPorts = 56320..56329
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

  # Capture status env in memory only. Parse safe API/availability fields and clear
  # the raw text before returning or emitting anything to the console.
  $statusLines = @(& supabase status --workdir $workdir -o env 2>$null)
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

  # Vector is recorded for observability only; its health is not a gate.
  $vectorLines = @(& docker inspect supabase_vector_vendeo-f562a-isolated --format '{{.State.Status}}|{{.RestartCount}}|{{json .Config.Labels}}' 2>$null)
  $vectorText = $vectorLines -join ''
  $vectorState = "not-found"
  $vectorRestartCount = -1
  if ($vectorText -match '^([^|]+)\|(\d+)\|') {
    $vectorState = $Matches[1]
    $vectorRestartCount = [int]$Matches[2]
  }

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
    F562Volume = ($volumes -contains 'supabase_db_vendeo-f562a-isolated')
    F562Network = ($networks -contains 'supabase_network_vendeo-f562a-isolated')
    F561Volume = ($volumes -contains 'supabase_db_vendeo-f561-isolated')
    F561Network = ($networks -contains 'supabase_network_vendeo-f561-isolated')
    VendeoV3Active = [bool](@($rows | Where-Object { $_ -match '(?i)Vendeo_V3.*\|Up' }).Count)
    MailpitActive = [bool](@($rows | Where-Object { $_ -match '^.*supabase_inbucket_vendeo-f562a-isolated\|Up' }).Count)
    VectorState = $vectorState
    VectorRestarts = $vectorRestartCount
    MigrationSqlCount = @(Get-ChildItem -LiteralPath (Join-Path $workdir 'supabase\migrations') -File -Filter '*.sql').Count
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

$gate = Assert-IsolatedPreflight
if (-not $gate.Pass) {
  [pscustomobject]@{ Preflight = 'FAIL'; Failures = $gate.Failures; VectorState = $gate.VectorState; VectorRestarts = $gate.VectorRestarts; CredentialValues = 'suppressed' } | ConvertTo-Json -Depth 4
  exit 2
}

[pscustomobject]@{
  Preflight = 'PASS'
  ProjectId = $gate.ProjectId
  ApiLoopback = $gate.ApiLoopback
  ConfiguredPorts = $gate.ConfiguredPorts
  F562Health = $gate.F562Health
  F562Postgrest = $gate.F562Postgrest
  F561Health = $gate.F561Health
  F561Postgrest = $gate.F561Postgrest
  PortConflicts = $gate.PortConflicts
  VectorState = $gate.VectorState
  VectorRestarts = $gate.VectorRestarts
  ServiceRoleKeyAvailable = $gate.ServiceRoleKeyAvailable
  DatabaseUrlAvailable = $gate.DatabaseUrlAvailable
  MigrationSqlCount = $gate.MigrationSqlCount
  CredentialValues = 'suppressed'
} | ConvertTo-Json -Depth 4

if (-not $gate.ServiceRoleKeyAvailable -or -not $gate.DatabaseUrlAvailable) {
  throw "required local test credential unavailable after passing isolation gate"
}

# Read the service key and DB URL only after the full gate passed. Keep the raw
# status output and values in process memory; never write or print them.
$statusLines = @(& supabase status --workdir $workdir -o env 2>$null)
$statusExit = $LASTEXITCODE
if ($statusExit -ne 0) { throw "supabase status failed after passing isolation gate" }
$statusText = $statusLines -join "`n"
$serviceRoleKey = Get-EnvValue -Text $statusText -Name "SERVICE_ROLE_KEY"
$databaseUrl = Get-EnvValue -Text $statusText -Name "DB_URL"
$statusText = $null
$statusLines = $null

if (-not $serviceRoleKey -or -not $databaseUrl) {
  throw "required local test credential unavailable after passing isolation gate"
}
$databaseUri = $null
try { $databaseUri = [uri]$databaseUrl } catch { throw "local database URL is malformed" }
if ($databaseUri.Host -notin @('127.0.0.1', 'localhost') -or $databaseUri.Port -ne 56322) {
  throw "database URL is not the dedicated F56.2a loopback"
}

$env:F562A_ISOLATED_SUPABASE_URL = $gate.ApiLoopback
$env:F562A_ISOLATED_SERVICE_ROLE_KEY = $serviceRoleKey
$env:F562A_ISOLATED_DATABASE_URL = $databaseUrl
$script:SecretsToRedact = @($serviceRoleKey, $databaseUrl)
$serviceRoleKey = $null
$databaseUrl = $null
$databaseUri = $null

try {
  $testOutput = @(& npx vitest run src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts 2>&1)
  $testExit = $LASTEXITCODE
  Write-SanitizedLines -Lines $testOutput
  if ($testExit -ne 0) { exit $testExit }
} finally {
  Remove-Item Env:F562A_ISOLATED_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:F562A_ISOLATED_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:F562A_ISOLATED_DATABASE_URL -ErrorAction SilentlyContinue
  $script:SecretsToRedact = @()
}
