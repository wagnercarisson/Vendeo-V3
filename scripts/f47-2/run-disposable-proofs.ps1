[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('environment', 'checkpoint', 'provision', 'invariants', 'compatibility-new', 'stop')]
    [string]$Stage,

    [switch]$ConfirmStart,
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
$Manifest = 'C:\Users\wagne\AppData\Local\Temp\opencode\f47-2-compose-review\compose.yaml'
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
    $composeArguments = New-ComposeArguments -ProjectName $ComposeProject -ManifestPath $Manifest -Arguments $Arguments
    return Invoke-Captured -FilePath 'docker' -Arguments $composeArguments -TimeoutMilliseconds $TimeoutMilliseconds
}

function Assert-ReviewInputs {
    if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) { throw 'Restricted review manifest is missing.' }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Manifest).Hash -ne $ExpectedManifestHash) {
        throw 'Compose manifest SHA-256 differs from the reviewed artifact.'
    }
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
    try { $manifestObject = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json }
    catch { throw 'Restricted Compose manifest is not valid JSON/YAML; output suppressed.' }
    if ($manifestObject.services.kong.depends_on.rest.condition -ne 'service_started') {
        throw 'Kong REST dependency must be service_started; REST readiness is probed separately.'
    }
    if ($manifestObject.services.studio.environment.PSObject.Properties.Name -contains 'OPENAI_API_KEY') {
        throw 'Provider credential must not be present in the disposable review manifest.'
    }
    foreach ($service in $manifestObject.services.PSObject.Properties) {
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
    if (@(Get-ChildItem -LiteralPath $migrationDir -File -ErrorAction Stop).Count -ne 0) {
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

function Stop-NewComposeProject {
    $stopped = Invoke-Compose -Arguments @('stop', '--timeout', '20')
    if ($stopped.ExitCode -ne 0) { throw 'Stopping the dedicated Compose project failed; output suppressed.' }
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

function Get-LedgerVersions {
    $container = Get-DatabaseContainer
    $query = 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version'
    $result = Invoke-Captured -FilePath 'docker' -Arguments @('exec', '-u', 'postgres', $container.Id, 'psql', '-XAt', '-U', 'postgres', '-d', 'postgres', '-c', $query)
    if ($result.ExitCode -ne 0) { throw 'Read-only migration ledger query failed; output suppressed.' }
    return @($result.Lines | ForEach-Object { "$($_)".Trim() } | Where-Object { $_ -match '^\d{14}$' })
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
    $result = Invoke-Captured -FilePath $Cli -Arguments $args
    if ($result.ExitCode -ne 0) { throw "Supabase migration $Operation failed; output suppressed." }
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
        -CleanupAction { Invoke-Compose -Arguments @('stop', '--timeout', '20') }
    if (-not $outcome.Succeeded) {
        if (-not $outcome.CleanupSucceeded) {
            throw 'Startup/validation failed; restricted Compose stop was attempted but could not be confirmed.'
        }
        throw 'Startup/validation failed; only the dedicated Compose project was stopped.'
    }
    Write-Output 'Disposable Compose environment healthy; bindings verified loopback; REST probe passed.'
}

function Assert-RunningEnvironment {
    Assert-ReviewInputs
    Assert-LoopbackBindingsAndHealth
    Wait-RestReadiness
    $null = Get-DatabaseContainer
}

function Invoke-Provision {
    if (-not $ConfirmMigrations) { throw 'Migration application requires the separate -ConfirmMigrations human gate.' }
    Assert-RunningEnvironment
    $manifest = Read-MigrationManifest
    $source = Join-Path $Repo 'supabase\migrations'
    $target = Join-Path $Workdir 'supabase\migrations'
    $files = @(Get-ChildItem -LiteralPath $source -Filter '*.sql' -File)
    if ($files.Count -ne $ExpectedMigrationCount -or @(Get-ChildItem -LiteralPath $target -File).Count -ne 0) {
        throw 'Source/target migration inventory mismatch; refusing to copy.'
    }
    foreach ($file in $files) {
        if (-not $manifest.ContainsKey($file.Name) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash -ne $manifest[$file.Name]) {
            throw 'Source migration hash mismatch; refusing to copy.'
        }
    }
    $before = @(Get-LedgerVersions)
    if ($before.Count -ne 0) { throw 'Disposable migration ledger is not empty before provision.' }
    $url = Get-LocalDatabaseUrl
    Invoke-StandardMigrationCommand -Operation 'list' -DatabaseUrl $url
    foreach ($file in $files) { Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $target $file.Name) }
    foreach ($file in Get-ChildItem -LiteralPath $target -Filter '*.sql' -File) {
        if ((Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash -ne $manifest[$file.Name]) {
            throw 'Copied migration hash mismatch; refusing to apply.'
        }
    }
    Invoke-StandardMigrationCommand -Operation 'up' -DatabaseUrl $url
    Invoke-StandardMigrationCommand -Operation 'list' -DatabaseUrl $url
    $after = @(Get-LedgerVersions)
    $expected = @($manifest.Keys | ForEach-Object { $_.Substring(0, 14) } | Sort-Object -Unique)
    if ($after.Count -ne $ExpectedMigrationCount -or (Compare-Object $expected $after).Count -ne 0) {
        throw 'Post-migration ledger does not match the approved 145-version manifest.'
    }
    Write-Output 'Migration batch applied through Supabase CLI to verified local loopback DB; ledger count=145.'
}

function Invoke-SignatureProof {
    if (-not $ConfirmInvariants) { throw 'Invariant proof execution requires the separate -ConfirmInvariants human gate.' }
    Assert-RunningEnvironment
    if (@(Get-LedgerVersions).Count -ne $ExpectedMigrationCount) { throw 'Migration ledger is incomplete; refusing proofs.' }
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
    'checkpoint' {
        Assert-RunningEnvironment
        $url = Get-LocalDatabaseUrl
        Invoke-StandardMigrationCommand -Operation 'list' -DatabaseUrl $url
        $ledger = @(Get-LedgerVersions)
        if ($ledger.Count -ne 0) { throw 'Initial ledger is not empty; block checkpoint.' }
        Write-Output 'Environment checkpoint PASS; initial migration ledger count=0.'
    }
    'provision' { Invoke-Provision }
    'invariants' { Invoke-SignatureProof }
    'compatibility-new' {
        if (-not $ConfirmCompatibility) { throw 'Compatibility proof execution requires the separate -ConfirmCompatibility human gate.' }
        throw 'Blocked: exact compatibility-new test inventory is not defined; refusing a false PASS.'
    }
    'stop' {
        if (-not $ConfirmStop) { throw 'Stopping requires the separate -ConfirmStop human gate.' }
        $result = Invoke-Compose -Arguments @('stop', '--timeout', '20')
        if ($result.ExitCode -ne 0) { throw 'Stopping the dedicated Compose project failed; output suppressed.' }
        Write-Output 'Only the dedicated disposable Compose project was stopped; volumes were not removed.'
    }
}
