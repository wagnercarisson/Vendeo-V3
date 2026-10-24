[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('environment', 'resume-preflight', 'resume-checkpoint', 'checkpoint', 'provision', 'invariants', 'compatibility-new', 'stop')]
    [string]$Stage,

    [switch]$ConfirmStart,
    [switch]$ConfirmResume,
    [switch]$ConfirmMigrations,
    [switch]$ConfirmInvariants,
    [switch]$ConfirmCompatibility,
    [switch]$ConfirmStop
)

$ErrorActionPreference = 'Stop'
$RunnerModule = Join-Path $PSScriptRoot 'lib\DisposableRunner.psm1'
Import-Module -Name $RunnerModule -Force -ErrorAction Stop

$ProjectId = 'vendeo_f47_2_disposable_20261024'
$ComposeProject = 'vendeo_f47_2_disposable_compose_20261024'
$ComposeManifestPath = 'C:\Users\wagne\AppData\Local\Temp\opencode\f47-2-compose-review\compose.yaml'
$ExpectedManifestHash = 'AEC60160266A80F08AAB6FB18AC0E4F5B8233BE992D1896517EDAD5BE7A9F1C1'
$Workdir = 'C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f47-2-disposable'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Cli = Join-Path $Repo 'node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
$DbVolume = "supabase_db_$ProjectId"
$ExpectedMigrationCount = 145
$MigrationHashFile = Join-Path $Repo '.planning\phases\47.2-integracao-promocao-assinatura-visual\47.2-06-MIGRATION-HASHES.txt'

function Invoke-DockerJson {
    param([string[]]$Arguments)
    $result = Invoke-Captured -FilePath 'docker' -Arguments $Arguments
    if ($result.ExitCode -ne 0) { throw 'Docker inspection failed; output suppressed.' }
    try { return (($result.Lines -join "`n") | ConvertFrom-Json) }
    catch { throw 'Docker inspection returned invalid JSON; output suppressed.' }
}

function Invoke-Compose {
    param([string[]]$Arguments, [int]$TimeoutMilliseconds = 30000)
    $composeArguments = New-ComposeArguments -ProjectName $ComposeProject -ManifestPath $ComposeManifestPath -Arguments $Arguments
    return Invoke-Captured -FilePath 'docker' -Arguments $composeArguments -TimeoutMilliseconds $TimeoutMilliseconds
}

function Write-SafeProcessDiagnostic {
    param([string]$Stage, [object]$Result)
    $diagnostic = New-SafeProcessDiagnostic -Stage $Stage -Result $Result
    Write-Warning ("RUNNER_DIAGNOSTIC stage={0} exit_code={1} timeout={2} error_category={3} stderr_present={4}" -f `
        $diagnostic.Stage, $diagnostic.ExitCode, $diagnostic.TimedOut.ToString().ToLowerInvariant(),
        $diagnostic.Category, $diagnostic.StdErrPresent.ToString().ToLowerInvariant())
}

function Assert-ReviewInputs {
    $null = Assert-ComposeManifestArtifact -Path $ComposeManifestPath -ExpectedHash $ExpectedManifestHash
    if (-not (Test-Path -LiteralPath (Join-Path $Workdir 'supabase\config.toml') -PathType Leaf)) { throw 'Disposable Supabase config is missing.' }
    if (-not (Test-Path -LiteralPath $Cli -PathType Leaf)) { throw 'Pinned Supabase CLI executable is missing.' }
    if (-not (Test-Path -LiteralPath $MigrationHashFile -PathType Leaf)) { throw 'Migration hash manifest is missing.' }
    if (Test-Path -LiteralPath (Join-Path $Workdir 'supabase\.temp\project-ref')) {
        throw 'Disposable workdir has remote project-link metadata.'
    }
    $configResult = Invoke-Compose -Arguments @('config', '--quiet')
    if ($configResult.ExitCode -ne 0) { throw 'Compose manifest validation failed; output suppressed.' }
    $resolvedResult = Invoke-Compose -Arguments @('config', '--format', 'json')
    if ($resolvedResult.ExitCode -ne 0) { throw 'Resolved Compose manifest could not be checked; output suppressed.' }
    try { $resolved = ($resolvedResult.Lines -join "`n") | ConvertFrom-Json }
    catch { throw 'Resolved Compose manifest JSON is invalid; output suppressed.' }
    $expectedServices = @('auth', 'db', 'edge_runtime', 'kong', 'pg_meta', 'realtime', 'rest', 'storage', 'studio')
    $actualServices = @($resolved.services.PSObject.Properties.Name | Sort-Object)
    if (Compare-Object $expectedServices $actualServices) { throw 'Resolved Compose service set differs from review.' }
    $published = @()
    foreach ($service in $resolved.services.PSObject.Properties) {
        foreach ($port in $service.Value.ports) {
            $published += "$($service.Name)|$($port.host_ip)|$($port.published)|$($port.target)"
        }
    }
    $expectedPublished = @('db|127.0.0.1|56322|5432', 'kong|127.0.0.1|56321|8000', 'studio|127.0.0.1|56323|3000')
    if (Compare-Object $expectedPublished $published) { throw 'Resolved Compose port set differs from reviewed loopback-only ports.' }
    foreach ($volume in @("supabase_db_$ProjectId", "supabase_storage_$ProjectId")) {
        if (-not $resolved.volumes.$volume.external) { throw 'Reviewed DB/Storage volume must remain external.' }
    }
    try { $ComposeManifestObject = Get-Content -LiteralPath $ComposeManifestPath -Raw | ConvertFrom-Json }
    catch { throw 'Restricted Compose manifest is not valid JSON/YAML; output suppressed.' }
    if ($ComposeManifestObject.services.kong.depends_on.rest.condition -ne 'service_started') {
        throw 'Kong REST dependency must be service_started; REST readiness is probed separately.'
    }
    if ($ComposeManifestObject.services.studio.environment.PSObject.Properties.Name -contains 'OPENAI_API_KEY') {
        throw 'Provider credential must not be present in the disposable review manifest.'
    }
    foreach ($service in $ComposeManifestObject.services.PSObject.Properties) {
        if ($service.Value.restart -ne 'no') { throw 'All disposable services must have restart=no.' }
        foreach ($port in $service.Value.ports) {
            if ($port.host_ip -ne '127.0.0.1') { throw 'Manifest contains a non-loopback published port.' }
        }
    }
}

function Get-SourceContainers {
    $list = Invoke-Captured -FilePath 'docker' -Arguments @('ps', '-aq', '--filter', "label=com.supabase.cli.project=$ProjectId")
    if ($list.ExitCode -ne 0) { throw 'Could not enumerate disposable source containers.' }
    $ids = @($list.Lines | Where-Object { $_ -match '^[0-9a-f]{12,64}$' })
    if ($ids.Count -ne 9) { throw 'Expected nine previously stopped source containers; block on inventory drift.' }
    return @(Invoke-DockerJson -Arguments (@('inspect') + $ids))
}

function Assert-PreStartIsolation {
    Assert-ReviewInputs
    $oldContainers = Get-SourceContainers
    $resolvedResult = Invoke-Compose -Arguments @('config', '--format', 'json')
    if ($resolvedResult.ExitCode -ne 0) { throw 'Resolved Compose manifest could not be checked; output suppressed.' }
    $resolved = ($resolvedResult.Lines -join "`n") | ConvertFrom-Json
    foreach ($container in $oldContainers) {
        if ($container.State.Status -ne 'exited') { throw 'A source disposable container is not stopped.' }
        $role = $container.Name.TrimStart('/') -replace "^supabase_(.+)_$([regex]::Escape($ProjectId))$", '$1'
        $service = $resolved.services.$role
        if (-not $service -or $service.image -ne $container.Config.Image) { throw 'Manifest image reference differs from the stopped source service.' }
        $imageIdResult = Invoke-Captured -FilePath 'docker' -Arguments @('image', 'inspect', $service.image, '--format', '{{.Id}}')
        if ($imageIdResult.ExitCode -ne 0 -or ($imageIdResult.Lines -join '').Trim() -ne $container.Image) {
            throw 'Local image ID differs from the stopped source service; refusing to pull or start.'
        }
    }

    $new = Invoke-Captured -FilePath 'docker' -Arguments @('ps', '-aq', '--filter', "label=com.docker.compose.project=$ComposeProject")
    if ($new.ExitCode -ne 0 -or @($new.Lines | Where-Object { $_ -match '^[0-9a-f]{12,64}$' }).Count -ne 0) {
        throw 'The dedicated Compose project already has containers; refusing to reuse it.'
    }

    $usingVolume = Invoke-Captured -FilePath 'docker' -Arguments @('ps', '-q', '--filter', "volume=$DbVolume")
    if ($usingVolume.ExitCode -ne 0 -or @($usingVolume.Lines | Where-Object { $_ -match '^[0-9a-f]{12,64}$' }).Count -ne 0) {
        throw 'A running container uses the disposable DB volume; refusing to start another Postgres.'
    }
    $volumeResult = Invoke-Captured -FilePath 'docker' -Arguments @('volume', 'ls', '-q', '--filter', "label=com.supabase.cli.project=$ProjectId")
    if ($volumeResult.ExitCode -ne 0) { throw 'Could not verify disposable volume inventory.' }
    $expectedVolumes = @("supabase_db_$ProjectId", "supabase_storage_$ProjectId") | Sort-Object
    $actualVolumes = @($volumeResult.Lines | Where-Object { $_ } | Sort-Object)
    if (Compare-Object $expectedVolumes $actualVolumes) { throw 'Disposable volume inventory differs from the two preserved volumes.' }

    foreach ($port in @(56321, 56322, 56323)) {
        if (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count -gt 0) {
            throw "Required loopback port $port is already listening."
        }
    }

    $migrationDir = Join-Path $Workdir 'supabase\migrations'
    if (@(Get-ChildItem -LiteralPath $migrationDir -Force -ErrorAction Stop).Count -ne 0) {
        throw 'Disposable migrations directory is not empty.'
    }
    $config = Get-Content -LiteralPath (Join-Path $Workdir 'supabase\config.toml') -Raw
    if ($config -notmatch '(?m)^project_id\s*=\s*"vendeo_f47_2_disposable_20261024"' -or
        $config -notmatch '(?ms)^\[db\.seed\]\s*.*?^enabled\s*=\s*false\s*$' -or
        $config -notmatch '(?ms)^\[db\.seed\]\s*.*?^sql_paths\s*=\s*\[\]\s*$' -or
        (Test-Path -LiteralPath (Join-Path $Workdir 'supabase\seed.sql'))) {
        throw 'Disposable project/seed configuration failed closed checks.'
    }
}

function Assert-ExistingComposeForResume {
    Assert-ReviewInputs
    $resolvedResult = Invoke-Compose -Arguments @('config', '--format', 'json')
    if ($resolvedResult.ExitCode -ne 0) { throw 'Resolved Compose manifest could not be checked; output suppressed.' }
    try { $resolved = ($resolvedResult.Lines -join "`n") | ConvertFrom-Json }
    catch { throw 'Resolved Compose manifest JSON is invalid; output suppressed.' }

    $list = Invoke-Captured -FilePath 'docker' -Arguments @('ps', '-aq', '--filter', "label=com.docker.compose.project=$ComposeProject")
    if ($list.ExitCode -ne 0 -or $list.TimedOut -or $list.StartError) {
        Write-SafeProcessDiagnostic -Stage 'resume_container_inventory' -Result $list
        throw 'Could not safely enumerate existing Compose containers.'
    }
    $ids = @($list.Lines | Where-Object { $_ -match '^[0-9a-f]{12,64}$' })
    if ($ids.Count -ne 9) { throw 'Resume requires exactly the nine existing Compose containers; no recreation allowed.' }
    $containers = @(Invoke-DockerJson -Arguments (@('inspect') + $ids))

    $expectedServices = @()
    $expectedBindings = @()
    foreach ($serviceProperty in $resolved.services.PSObject.Properties) {
        $serviceName = [string]$serviceProperty.Name
        $service = $serviceProperty.Value
        $imageResult = Invoke-Captured -FilePath 'docker' -Arguments @('image', 'inspect', $service.image, '--format', '{{.Id}}')
        if ($imageResult.ExitCode -ne 0 -or $imageResult.TimedOut -or $imageResult.StartError) {
            Write-SafeProcessDiagnostic -Stage 'resume_image_inspect' -Result $imageResult
            throw 'A reviewed image is not available locally; resume will not pull or recreate it.'
        }
        $mounts = @($service.volumes | Where-Object { $null -ne $_ } | ForEach-Object {
            [pscustomobject]@{
                Type = [string]$_.type
                Source = [string]$_.source
                Target = [string]$_.target
                ReadOnly = [bool]$_.read_only
            }
        })
        $expectedServices += [pscustomobject]@{
            Service = $serviceName
            Image = [string]$service.image
            ImageId = ($imageResult.Lines -join '').Trim()
            Mounts = $mounts
        }
        foreach ($port in $service.ports) {
            $expectedBindings += [pscustomobject]@{
                Container = "/supabase_${serviceName}_${ProjectId}_compose"
                ContainerPort = "$($port.target)/$($port.protocol)"
                HostIp = [string]$port.host_ip
                HostPort = [string]$port.published
            }
        }
    }
    if ($expectedBindings.Count -ne 3) { throw 'Reviewed manifest does not resolve to exactly three published ports.' }
    $null = Assert-ResumeContainerInventory -Containers $containers -ExpectedServices $expectedServices -ComposeProject $ComposeProject -ProjectId $ProjectId
    Assert-ExpectedHostPortBindings -Containers $containers -ExpectedBindings $expectedBindings

    $expectedVolumes = @("supabase_db_$ProjectId", "supabase_storage_$ProjectId") | Sort-Object
    $volumeResult = Invoke-Captured -FilePath 'docker' -Arguments @('volume', 'ls', '-q', '--filter', "label=com.supabase.cli.project=$ProjectId")
    if ($volumeResult.ExitCode -ne 0 -or $volumeResult.TimedOut -or $volumeResult.StartError) {
        Write-SafeProcessDiagnostic -Stage 'resume_volume_inventory' -Result $volumeResult
        throw 'Could not safely inspect preserved volume inventory.'
    }
    $actualVolumes = @($volumeResult.Lines | Where-Object { $_ } | Sort-Object)
    if (Compare-Object $expectedVolumes $actualVolumes) { throw 'Resume volume inventory differs from the two preserved volumes.' }
    foreach ($volume in $expectedVolumes) {
        $users = Invoke-Captured -FilePath 'docker' -Arguments @('ps', '-q', '--filter', "volume=$volume")
        if ($users.ExitCode -ne 0 -or $users.TimedOut -or $users.StartError) {
            Write-SafeProcessDiagnostic -Stage 'resume_volume_users' -Result $users
            throw 'Could not verify active users of preserved volumes.'
        }
        if (@($users.Lines | Where-Object { $_ -match '^[0-9a-f]{12,64}$' }).Count -ne 0) {
            throw 'Another running container uses a preserved volume; refusing to resume Postgres.'
        }
    }
    foreach ($port in @(56321, 56322, 56323)) {
        if (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count -gt 0) {
            throw "Resume port $port is already listening while Compose containers should be stopped."
        }
    }
    $migrationDir = Join-Path $Workdir 'supabase\migrations'
    if (@(Get-ChildItem -LiteralPath $migrationDir -Force -ErrorAction Stop).Count -ne 0) {
        throw 'Disposable migration directory is not empty; read-only resume is blocked.'
    }
    $config = Get-Content -LiteralPath (Join-Path $Workdir 'supabase\config.toml') -Raw
    if ($config -notmatch '(?m)^project_id\s*=\s*"vendeo_f47_2_disposable_20261024"' -or
        $config -notmatch '(?ms)^\[db\.seed\]\s*.*?^enabled\s*=\s*false\s*$' -or
        $config -notmatch '(?ms)^\[db\.seed\]\s*.*?^sql_paths\s*=\s*\[\]\s*$' -or
        (Test-Path -LiteralPath (Join-Path $Workdir 'supabase\seed.sql'))) {
        throw 'Resume workdir project/seed configuration failed closed checks.'
    }
    return $containers
}

function Stop-NewComposeProject {
    # Compose's graceful-stop timeout is 20 seconds per service. Allow enough
    # wall time for the whole nine-service project plus CLI/Docker overhead.
    $stopped = Invoke-Compose -Arguments @('stop', '--timeout', '20') -TimeoutMilliseconds 120000
    if ($stopped.ExitCode -ne 0) { Write-SafeProcessDiagnostic -Stage 'compose_stop' -Result $stopped }

    $running = Invoke-Captured -FilePath 'docker' -Arguments @('ps', '-q', '--filter', "label=com.docker.compose.project=$ComposeProject") -TimeoutMilliseconds 30000
    $verification = Resolve-ComposeStopVerification -StopResult $stopped -RunningQueryResult $running
    if ($verification.Category -ne 'none') {
        Write-Warning ("RUNNER_DIAGNOSTIC stage=compose_stop_state_check exit_code={0} timeout={1} error_category={2} running_count={3} stderr_present={4}" -f `
            $stopped.ExitCode, $stopped.TimedOut.ToString().ToLowerInvariant(), $verification.Category, $verification.RunningCount, $stopped.StdErrPresent.ToString().ToLowerInvariant())
    }
    return [pscustomobject]@{
        ExitCode = $verification.ExitCode
        TimedOut = $false
        StartError = $false
        StdErrPresent = $false
        StoppedVerified = $verification.VerifiedStopped
    }
}

function Get-NewComposeContainers {
    $list = Invoke-Captured -FilePath 'docker' -Arguments @('ps', '-aq', '--filter', "label=com.docker.compose.project=$ComposeProject")
    if ($list.ExitCode -ne 0) { throw 'Could not enumerate the dedicated Compose project.' }
    $ids = @($list.Lines | Where-Object { $_ -match '^[0-9a-f]{12,64}$' })
    if ($ids.Count -ne 9) { throw 'Expected nine containers in the dedicated Compose project.' }
    return @(Invoke-DockerJson -Arguments (@('inspect') + $ids))
}

function Assert-LoopbackBindingsAndHealth {
    $containers = Get-NewComposeContainers
    $expectedBindings = @(
        [pscustomobject]@{ Container = "/supabase_db_${ProjectId}_compose"; ContainerPort = '5432/tcp'; HostIp = '127.0.0.1'; HostPort = '56322' },
        [pscustomobject]@{ Container = "/supabase_kong_${ProjectId}_compose"; ContainerPort = '8000/tcp'; HostIp = '127.0.0.1'; HostPort = '56321' },
        [pscustomobject]@{ Container = "/supabase_studio_${ProjectId}_compose"; ContainerPort = '3000/tcp'; HostIp = '127.0.0.1'; HostPort = '56323' }
    )
    Assert-ExpectedHostPortBindings -Containers $containers -ExpectedBindings $expectedBindings
    foreach ($container in $containers) {
        if ($container.State.Status -ne 'running') { throw 'A Compose service is not running.' }
        if ($container.State.Health -and $container.State.Health.Status -ne 'healthy') {
            throw 'A Compose healthcheck is not healthy.'
        }
    }

    foreach ($port in @(56321, 56322, 56323)) {
        $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
        if ($listeners.Count -eq 0 -or @($listeners | Where-Object { $_.LocalAddress -ne '127.0.0.1' }).Count -gt 0) {
            throw "Host listener on port $port is missing or not exclusively loopback."
        }
    }
}

function Wait-RestReadiness {
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    $probe = New-RestReadinessProbe -ProjectId $ProjectId -RequestTimeoutMilliseconds 4000
    while ([DateTime]::UtcNow -lt $deadline) {
        $result = Invoke-Captured -FilePath 'docker' -Arguments @('exec', "supabase_studio_${ProjectId}_compose", 'node', '--eval', $probe) -TimeoutMilliseconds 7000
        if (-not $result.StartError -and -not $result.TimedOut -and $result.ExitCode -eq 0) { return }
        Start-Sleep -Seconds 2
    }
    throw 'REST readiness probe timed out after 60 seconds.'
}

function Get-DatabaseContainer {
    $container = Get-NewComposeContainers | Where-Object { $_.Name -eq "/supabase_db_${ProjectId}_compose" }
    if (@($container).Count -ne 1 -or $container.State.Status -ne 'running' -or $container.State.Health.Status -ne 'healthy') {
        throw 'Expected the dedicated healthy Compose Postgres container.'
    }
    if ($container.Config.Labels.'com.docker.compose.project' -ne $ComposeProject -or
        $container.Config.Labels.'com.supabase.cli.project' -ne $ProjectId) {
        throw 'Disposable DB identity labels do not match the approved local project.'
    }
    $bindings = $container.HostConfig.PortBindings.'5432/tcp'
    if (@($bindings).Count -ne 1 -or $bindings[0].HostIp -ne '127.0.0.1' -or $bindings[0].HostPort -ne '56322') {
        throw 'DB target is not exclusively 127.0.0.1:56322.'
    }
    return $container
}

function Get-LocalDatabaseUrl {
    $container = Get-DatabaseContainer
    $passwordEntry = @($container.Config.Env | Where-Object { $_ -like 'POSTGRES_PASSWORD=*' })
    if ($passwordEntry.Count -ne 1) { throw 'Disposable DB password was not available in its own container config.' }
    $password = $passwordEntry[0].Substring('POSTGRES_PASSWORD='.Length)
    if ([string]::IsNullOrEmpty($password)) { throw 'Disposable DB password is empty.' }
    $encoded = [Uri]::EscapeDataString($password)
    return "postgresql://postgres:$encoded@127.0.0.1:56322/postgres"
}

function Get-LedgerState {
    $container = Get-DatabaseContainer
    $relationQuery = "SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN 'absent' ELSE 'present' END"
    $relationResult = Invoke-Captured -FilePath 'docker' -Arguments @('exec', '-u', 'postgres', $container.Id, 'psql', '-XAt', '-U', 'postgres', '-d', 'postgres', '-c', $relationQuery)
    if ($relationResult.ExitCode -ne 0 -or $relationResult.TimedOut -or $relationResult.StartError) {
        Write-SafeProcessDiagnostic -Stage 'ledger_relation_probe' -Result $relationResult
        throw 'Read-only ledger relation probe failed; details above are categorized and sanitized.'
    }
    try { $tableExists = Resolve-LedgerRelationProbeOutput -Lines $relationResult.Lines }
    catch {
        Write-Warning 'RUNNER_DIAGNOSTIC stage=ledger_relation_probe error_category=unexpected_safe_probe_result'
        throw 'Read-only ledger relation probe returned an unexpected result.'
    }
    if (-not $tableExists) {
        return [pscustomobject]@{ TableExists = $false; Versions = @() }
    }

    $query = 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version'
    $result = Invoke-Captured -FilePath 'docker' -Arguments @('exec', '-u', 'postgres', $container.Id, 'psql', '-XAt', '-U', 'postgres', '-d', 'postgres', '-c', $query)
    if ($result.ExitCode -ne 0 -or $result.TimedOut -or $result.StartError) {
        Write-SafeProcessDiagnostic -Stage 'ledger_select_sql' -Result $result
        throw 'Read-only ledger SELECT failed; details above are categorized and sanitized.'
    }
    $versions = @($result.Lines | ForEach-Object { "$($_)".Trim() } | Where-Object { $_ -match '^\d{14}$' })
    return [pscustomobject]@{ TableExists = $true; Versions = $versions }
}

function Assert-PreMigrationLedgerCheckpoint {
    param([bool]$MigrationListSucceeded)
    $migrationDir = Join-Path $Workdir 'supabase\migrations'
    $migrationDirectoryEmpty = @(Get-ChildItem -LiteralPath $migrationDir -Force -ErrorAction Stop).Count -eq 0
    $ledgerState = Get-LedgerState
    $decision = Resolve-LedgerCheckpoint `
        -TableExists $ledgerState.TableExists `
        -Versions $ledgerState.Versions `
        -Context 'pre_migration' `
        -MigrationDirectoryEmpty $migrationDirectoryEmpty `
        -MigrationListSucceeded $MigrationListSucceeded
    if ($decision.State -eq 'ledger_not_initialized') {
        Write-Warning 'RUNNER_LEDGER_STATE state=ledger_not_initialized phase=pre_migration_checkpoint'
    }
    else {
        Write-Warning 'RUNNER_LEDGER_STATE state=ledger_empty phase=pre_migration_checkpoint'
    }
    return $decision
}

function Read-MigrationManifest {
    $entries = @{}
    foreach ($line in Get-Content -LiteralPath $MigrationHashFile) {
        if ($line -match '^([A-Fa-f0-9]{64})\s{2}(.+\.sql)$') { $entries[$matches[2]] = $matches[1].ToUpperInvariant() }
    }
    if ($entries.Count -ne $ExpectedMigrationCount) { throw 'Migration hash manifest does not contain exactly 145 SQL files.' }
    return $entries
}

function Invoke-StandardMigrationCommand {
    param([ValidateSet('list', 'up')][string]$Operation, [string]$DatabaseUrl)
    $uri = [Uri]$DatabaseUrl
    if ($uri.Scheme -notin @('postgres', 'postgresql') -or $uri.Host -ne '127.0.0.1' -or $uri.Port -ne 56322 -or $uri.AbsolutePath -ne '/postgres') {
        throw 'Refusing migration command not targeting the approved loopback Postgres.'
    }
    $args = @('--workdir', $Workdir, 'migration', $Operation, '--db-url', $DatabaseUrl, '--yes')
    $timeoutMilliseconds = Get-MigrationProcessTimeout -Operation $Operation
    $result = Invoke-Captured -FilePath $Cli -Arguments $args -TimeoutMilliseconds $timeoutMilliseconds
    if ($result.ExitCode -ne 0 -or $result.TimedOut -or $result.StartError) {
        Write-SafeProcessDiagnostic -Stage "migration_${Operation}_cli" -Result $result
        throw "Supabase migration $Operation failed; details above are categorized and sanitized."
    }
}

function Start-DisposableEnvironment {
    if (-not $ConfirmStart) { throw 'Start requires the separate -ConfirmStart human gate.' }
    Assert-PreStartIsolation
    $outcome = Invoke-StartupWithRestrictedCleanup `
        -StartAction { Invoke-Compose -Arguments @('up', '--detach', '--wait', '--wait-timeout', '180') -TimeoutMilliseconds 210000 } `
        -ValidateAction {
        Assert-LoopbackBindingsAndHealth
        Wait-RestReadiness
        return $true
    } `
        -CleanupAction { Stop-NewComposeProject }
    if (-not $outcome.Succeeded) {
        if (-not $outcome.CleanupSucceeded) {
            throw 'Startup/validation failed; restricted Compose stop was attempted but could not be confirmed.'
        }
        throw 'Startup/validation failed; only the dedicated Compose project was stopped.'
    }
    Write-Output 'Disposable Compose environment healthy; bindings verified loopback; REST probe passed.'
}

function Resume-DisposableCheckpoint {
    if (-not $ConfirmResume) { throw 'Resume requires the separate -ConfirmResume human gate.' }
    $before = @(Assert-ExistingComposeForResume)
    $beforeIds = @($before.Id | Sort-Object)
    $outcome = Invoke-StartupWithRestrictedCleanup `
        -StartAction { Invoke-Compose -Arguments @('start', '--wait', '--wait-timeout', '180') -TimeoutMilliseconds 210000 } `
        -ValidateAction {
            Assert-LoopbackBindingsAndHealth
            $after = @(Get-NewComposeContainers)
            $afterIds = @($after.Id | Sort-Object)
            $null = Assert-SameContainerIds -Before $beforeIds -After $afterIds
            Wait-RestReadiness
            return $true
        } `
        -CleanupAction { Stop-NewComposeProject }
    if (-not $outcome.Succeeded) {
        if (-not $outcome.CleanupSucceeded) {
            throw 'Resume validation failed; restricted stop was attempted but could not be confirmed.'
        }
        throw 'Resume validation failed; existing project was stopped and must not be retried without review.'
    }

    $ledgerCount = -1
    $ledgerStateName = 'unknown'
    $ledgerSucceeded = $false
    try {
        $url = Get-LocalDatabaseUrl
        Invoke-StandardMigrationCommand -Operation 'list' -DatabaseUrl $url
        $ledgerState = Assert-PreMigrationLedgerCheckpoint -MigrationListSucceeded $true
        $ledgerCount = $ledgerState.Count
        $ledgerStateName = $ledgerState.State
        $ledgerSucceeded = $true
    }
    catch {
        # The command-specific sanitized warning identifies whether CLI list or
        # the SQL SELECT failed; never echo the caught exception or its output.
        Write-Warning 'RUNNER_DIAGNOSTIC stage=resume_ledger_result error_category=ledger_read_failed details=see_sanitized_process_diagnostic'
    }
    finally {
        $stopResult = Stop-NewComposeProject
    }

    if ($stopResult.ExitCode -ne 0 -or -not $stopResult.StoppedVerified) {
        throw 'Resume ended but restricted stop could not confirm zero running containers; stop and request review.'
    }
    if (-not $ledgerSucceeded) { throw 'Read-only ledger diagnostic failed; project stopped and no migration/proof was run.' }
    if ($ledgerCount -ne 0) {
        Write-Warning "RUNNER_DIAGNOSTIC stage=resume_ledger_result error_category=ledger_not_empty row_count=$ledgerCount"
        throw 'Read-only ledger returned rows; project stopped and checkpoint is blocked.'
    }
    Write-Output "Resume used existing container IDs; CLI list and ledger diagnosis completed; ledger_state=$ledgerStateName row_count=0; dedicated project stopped and verified."
}

function Test-DisposableResumePreflight {
    $containers = @(Assert-ExistingComposeForResume)
    Write-Output ("Resume preflight PASS; existing containers={0}; no start/stop performed." -f $containers.Count)
}

function Assert-RunningEnvironment {
    Assert-ReviewInputs
    Assert-LoopbackBindingsAndHealth
    Wait-RestReadiness
    $null = Get-DatabaseContainer
}

function Invoke-Provision {
    if (-not $ConfirmMigrations) { throw 'Migration application requires the separate -ConfirmMigrations human gate.' }
    $migrationHashes = Read-MigrationManifest
    $source = Join-Path $Repo 'supabase\migrations'
    $target = Join-Path $Workdir 'supabase\migrations'
    $files = @(Get-ChildItem -LiteralPath $source -Filter '*.sql' -File)
    if ($files.Count -ne $ExpectedMigrationCount -or @(Get-ChildItem -LiteralPath $target -Force).Count -ne 0) {
        throw 'Source/target migration inventory mismatch; refusing to copy.'
    }
    foreach ($file in $files) {
        if (-not $migrationHashes.ContainsKey($file.Name) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash -ne $migrationHashes[$file.Name]) {
            throw 'Source migration hash mismatch; refusing to copy.'
        }
    }

    # This stage owns one combined authorization boundary: start the already
    # existing containers, apply the local batch, reconcile the ledger, then
    # stop and verify the dedicated project. No `compose up` or recreation.
    $before = @(Assert-ExistingComposeForResume)
    $beforeIds = @($before.Id | Sort-Object)
    $startOutcome = Invoke-StartupWithRestrictedCleanup `
        -StartAction { Invoke-Compose -Arguments @('start', '--wait', '--wait-timeout', '180') -TimeoutMilliseconds 210000 } `
        -ValidateAction {
            Assert-LoopbackBindingsAndHealth
            $after = @(Get-NewComposeContainers)
            $afterIds = @($after.Id | Sort-Object)
            $null = Assert-SameContainerIds -Before $beforeIds -After $afterIds
            Wait-RestReadiness
            return $true
        } `
        -CleanupAction { Stop-NewComposeProject }
    if (-not $startOutcome.Succeeded) {
        if (-not $startOutcome.CleanupSucceeded) {
            throw 'Provision resume failed; restricted stop was attempted but could not be confirmed. No migrations were started.'
        }
        throw 'Provision resume validation failed; existing project was stopped. No migrations were started; do not retry without review.'
    }

    $expected = @($migrationHashes.Keys | ForEach-Object { $_.Substring(0, 14) } | Sort-Object -Unique)
    $provisionOutcome = Invoke-ProvisionWorkWithRestrictedStop `
        -PrepareAction {
            [pscustomobject]@{ DatabaseUrl = Get-LocalDatabaseUrl }
        } `
        -PreMigrationCheck {
            param($context)
            Invoke-StandardMigrationCommand -Operation 'list' -DatabaseUrl $context.DatabaseUrl
            $preMigrationState = Assert-PreMigrationLedgerCheckpoint -MigrationListSucceeded $true
            if ($preMigrationState.Count -ne 0) { throw 'Initial disposable ledger is not empty.' }
    } `
        -CopyAction {
            param($context)
            foreach ($file in $files) {
                if ((Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash -ne $migrationHashes[$file.Name]) {
                    throw 'Source migration hash changed after preflight; copy blocked.'
                }
            }
            foreach ($file in $files) { Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $target $file.Name) }
            $copiedFiles = @(Get-ChildItem -LiteralPath $target -Filter '*.sql' -File)
            if ($copiedFiles.Count -ne $ExpectedMigrationCount) { throw 'Copied migration count differs from the approved batch.' }
            foreach ($file in $copiedFiles) {
                if (-not $migrationHashes.ContainsKey($file.Name) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash -ne $migrationHashes[$file.Name]) {
                    throw 'Copied migration hash mismatch; application blocked.'
                }
            }
        } `
        -ApplyAction {
            param($context)
            Invoke-StandardMigrationCommand -Operation 'up' -DatabaseUrl $context.DatabaseUrl
    } `
        -VerifyAction {
            param($context)
            Invoke-StandardMigrationCommand -Operation 'list' -DatabaseUrl $context.DatabaseUrl
            $postMigrationState = Get-LedgerState
            $validatedLedger = Resolve-LedgerCheckpoint -TableExists $postMigrationState.TableExists -Versions $postMigrationState.Versions -Context 'post_migration' -ExpectedVersions $expected
            if ($validatedLedger.Count -ne $ExpectedMigrationCount) { throw 'Post-migration ledger count differs from the approved 145-version batch.' }
    } `
        -StopAction { Stop-NewComposeProject }

    if (-not $provisionOutcome.StopSucceeded) {
        throw 'Provision stage ended but restricted stop could not confirm zero running containers; request review.'
    }
    if (-not $provisionOutcome.Succeeded) {
        Write-Warning ("RUNNER_DIAGNOSTIC stage=provision_{0} error_category=operation_failed" -f $provisionOutcome.FailedStage)
        throw 'Provision failed; restricted stop was verified. Do not retry without review.'
    }

    Write-Output 'Provision complete: 145 source hashes verified, CLI migration up/list succeeded, exact ledger verified, and existing Compose project stopped/verified. No proofs run.'
}

function Invoke-SignatureProof {
    if (-not $ConfirmInvariants) { throw 'Invariant proof execution requires the separate -ConfirmInvariants human gate.' }
    Assert-RunningEnvironment
    $expected = @((Read-MigrationManifest).Keys | ForEach-Object { $_.Substring(0, 14) } | Sort-Object -Unique)
    $ledgerState = Get-LedgerState
    $validatedLedger = Resolve-LedgerCheckpoint -TableExists $ledgerState.TableExists -Versions $ledgerState.Versions -Context 'post_migration' -ExpectedVersions $expected
    if ($validatedLedger.Count -ne $ExpectedMigrationCount) { throw 'Migration ledger is incomplete; refusing proofs.' }
    $url = Get-LocalDatabaseUrl
    $oldUrl = $env:DATABASE_URL
    $oldPort = $env:EXPECTED_DB_PORT
    try {
        $env:DATABASE_URL = $url
        $env:EXPECTED_DB_PORT = '56322'
        $proof = Join-Path $Repo 'supabase\proofs\f47_2_visual_signature_release_proofs.mjs'
        $result = Invoke-Captured -FilePath 'node' -Arguments @($proof)
        if ($result.ExitCode -ne 0) { throw 'Signature proof runner failed; output suppressed.' }
    }
    finally {
        $env:DATABASE_URL = $oldUrl
        $env:EXPECTED_DB_PORT = $oldPort
    }
    throw 'Only the release-state proof is wired; profile and F50.4 invariants are not. This is a partial run, never a Task 3 PASS.'
}

switch ($Stage) {
    'environment' { Start-DisposableEnvironment }
    'resume-preflight' { Test-DisposableResumePreflight }
    'resume-checkpoint' { Resume-DisposableCheckpoint }
    'checkpoint' {
        Assert-RunningEnvironment
        $url = Get-LocalDatabaseUrl
        Invoke-StandardMigrationCommand -Operation 'list' -DatabaseUrl $url
        $ledger = Assert-PreMigrationLedgerCheckpoint -MigrationListSucceeded $true
        Write-Output "Environment checkpoint PASS; ledger_state=$($ledger.State) count=$($ledger.Count)."
    }
    'provision' { Invoke-Provision }
    'invariants' { Invoke-SignatureProof }
    'compatibility-new' {
        if (-not $ConfirmCompatibility) { throw 'Compatibility proof execution requires the separate -ConfirmCompatibility human gate.' }
        throw 'Blocked: exact compatibility-new test inventory is not defined; refusing a false PASS.'
    }
    'stop' {
        if (-not $ConfirmStop) { throw 'Stopping requires the separate -ConfirmStop human gate.' }
        $result = Stop-NewComposeProject
        if ($result.ExitCode -ne 0 -or $result.TimedOut -or $result.StartError) {
            throw 'Restricted stop could not confirm zero running containers; do not retry automatically.'
        }
        Write-Output 'Only the dedicated disposable Compose project was stopped; volumes were not removed.'
    }
}
