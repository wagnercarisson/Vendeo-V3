$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$ModulePath = Join-Path $Repo 'scripts\f47-2\lib\DisposableRunner.psm1'
Import-Module -Name $ModulePath -Force -ErrorAction Stop

function Assert-Test {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "Offline behavior test failed: $Message" }
}

$temporary = Join-Path ([IO.Path]::GetTempPath()) ('f47-2-runner-fakes-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
    $fake = Join-Path $temporary 'fake-command.ps1'
    @'
param([string]$Mode)
switch ($Mode) {
    'stderr' { [Console]::Error.WriteLine('offline-sensitive-stderr-marker'); exit 23 }
    'timeout' { Start-Sleep -Seconds 12; exit 0 }
    'ok' { [Console]::Out.WriteLine('offline-ok'); exit 0 }
    default { exit 91 }
}
'@ | Set-Content -LiteralPath $fake -Encoding utf8

$powershell = Join-Path $PSHOME 'powershell.exe'
if (-not (Test-Path -LiteralPath $powershell)) { $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source }

# Exercise the generated probe with a fake fetch; no socket is opened.
$project = 'vendeo_disposable_test'
$probe = New-RestReadinessProbe -ProjectId $project -RequestTimeoutMilliseconds 200
$expectedUrl = "http://supabase_rest_${project}:3000/"
$fakeSuccess = "globalThis.fetch=(url)=>Promise.resolve({status:url==='$expectedUrl'?204:500});$probe"
$success = Invoke-Captured -FilePath 'node' -Arguments @('--eval', $fakeSuccess) -TimeoutMilliseconds 3000
Assert-Test (-not $success.StartError -and -not $success.TimedOut -and $success.ExitCode -eq 0) 'REST probe URL uses interpolated project ID.'

$fakeTimeoutFetch = "globalThis.fetch=(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('fake abort'))));$probe"
$probeClock = [Diagnostics.Stopwatch]::StartNew()
$probeTimeout = Invoke-Captured -FilePath 'node' -Arguments @('--eval', $fakeTimeoutFetch) -TimeoutMilliseconds 3000
$probeClock.Stop()
Assert-Test ($probeTimeout.ExitCode -eq 1 -and -not $probeTimeout.TimedOut -and $probeClock.ElapsedMilliseconds -lt 2500) 'REST request has its own bounded abort timeout.'

# Docker inspect shape: PortBindings is a PSCustomObject, not a dictionary.
$loopbackContainer = [pscustomobject]@{
    Name = '/supabase_db_test_compose'
    HostConfig = [pscustomobject]@{
        PortBindings = [pscustomobject]@{
            '5432/tcp' = @([pscustomobject]@{ HostIp = '127.0.0.1'; HostPort = '56322' })
        }
    }
}
$expectedBindings = @([pscustomobject]@{ Container = '/supabase_db_test_compose'; ContainerPort = '5432/tcp'; HostIp = '127.0.0.1'; HostPort = '56322' })
Assert-ExpectedHostPortBindings -Containers @($loopbackContainer) -ExpectedBindings $expectedBindings

$wildcardContainer = [pscustomobject]@{
    Name = '/supabase_db_test_compose'
    HostConfig = [pscustomobject]@{
        PortBindings = [pscustomobject]@{
            '5432/tcp' = @([pscustomobject]@{ HostIp = '0.0.0.0'; HostPort = '56322' })
        }
    }
}
$wildcardRejected = $false
try { Assert-ExpectedHostPortBindings -Containers @($wildcardContainer) -ExpectedBindings $expectedBindings }
catch { $wildcardRejected = $true }
Assert-Test $wildcardRejected 'PSCustomObject wildcard binding is enumerated and rejected.'

$extraBindingContainer = [pscustomobject]@{
    Name = '/supabase_db_test_compose'
    HostConfig = [pscustomobject]@{
        PortBindings = [pscustomobject]@{
            '5432/tcp' = @([pscustomobject]@{ HostIp = '127.0.0.1'; HostPort = '56322' })
            '8080/tcp' = @([pscustomobject]@{ HostIp = '127.0.0.1'; HostPort = '58080' })
        }
    }
}
$extraRejected = $false
try { Assert-ExpectedHostPortBindings -Containers @($extraBindingContainer) -ExpectedBindings $expectedBindings }
catch { $extraRejected = $true }
Assert-Test $extraRejected 'Unexpected published ports are rejected by exact-set validation.'

# Native stderr is drained but never returned or emitted; nonzero exit is preserved.
$stderrResult = Invoke-Captured -FilePath $powershell -Arguments @('-NoProfile', '-NonInteractive', '-File', $fake, 'stderr') -TimeoutMilliseconds 10000
$serialized = ConvertTo-Json -InputObject $stderrResult -Depth 5 -Compress
    Assert-Test ($stderrResult.ExitCode -eq 23 -and $stderrResult.StdErrPresent) 'stderr does not throw and process exit code is retained.'
    Assert-Test (-not $serialized.Contains('offline-sensitive-stderr-marker')) 'stderr content is not returned or disclosed.'
    $safeDiagnostic = New-SafeProcessDiagnostic -Stage 'fake_process' -Result $stderrResult
    $safeSerialized = ConvertTo-Json -InputObject $safeDiagnostic -Depth 5 -Compress
    Assert-Test ($safeDiagnostic.Stage -eq 'fake_process' -and $safeDiagnostic.ExitCode -eq 23 -and -not $safeDiagnostic.TimedOut -and $safeDiagnostic.Category -eq 'nonzero_with_stderr') 'Safe diagnostics retain stage/code/timeout/category.'
    Assert-Test (-not $safeSerialized.Contains('offline-sensitive-stderr-marker')) 'Safe diagnostics never include raw stderr.'

$timeoutResult = Invoke-Captured -FilePath $powershell -Arguments @('-NoProfile', '-NonInteractive', '-File', $fake, 'timeout') -TimeoutMilliseconds 1200
    Assert-Test ($timeoutResult.TimedOut -and $timeoutResult.ExitCode -eq -1) 'A hung fake process is killed at the configured timeout.'
    $timeoutDiagnostic = New-SafeProcessDiagnostic -Stage 'fake_timeout' -Result $timeoutResult
    Assert-Test ($timeoutDiagnostic.Category -eq 'process_timeout' -and $timeoutDiagnostic.TimedOut) 'Safe diagnostics classify process timeouts.'

# Failed start and post-start validation invoke only the injected cleanup action.
$script:cleanupCount = 0
$failedStart = Invoke-StartupWithRestrictedCleanup `
    -StartAction { [pscustomobject]@{ ExitCode = 23; TimedOut = $false; StartError = $false } } `
    -ValidateAction { throw 'fake validation must not run' } `
    -CleanupAction { $script:cleanupCount++; [pscustomobject]@{ ExitCode = 0; TimedOut = $false; StartError = $false } }
Assert-Test (-not $failedStart.Succeeded -and $failedStart.CleanupAttempted -and $failedStart.CleanupSucceeded -and $script:cleanupCount -eq 1) 'Failed start invokes restricted cleanup.'

$failedValidation = Invoke-StartupWithRestrictedCleanup `
    -StartAction { [pscustomobject]@{ ExitCode = 0; TimedOut = $false; StartError = $false } } `
    -ValidateAction { throw 'fake wildcard/readiness validation' } `
    -CleanupAction { $script:cleanupCount++; [pscustomobject]@{ ExitCode = 0; TimedOut = $false; StartError = $false } }
Assert-Test (-not $failedValidation.Succeeded -and $failedValidation.CleanupAttempted -and $failedValidation.CleanupSucceeded -and $script:cleanupCount -eq 2) 'Failed post-start validation invokes restricted cleanup.'

$stopArguments = New-ComposeArguments -ProjectName 'vendeo_f47_2_disposable_compose_20261024' -ManifestPath 'C:\restricted\compose.yaml' -Arguments @('stop', '--timeout', '20')
Assert-Test (($stopArguments -join ' ') -eq 'compose -p vendeo_f47_2_disposable_compose_20261024 -f C:\restricted\compose.yaml stop --timeout 20') 'Cleanup command is scoped to the dedicated Compose project and stop only.'
$stopNonzero = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StartError = $false; StdErrPresent = $true }
$zeroRunning = [pscustomobject]@{ ExitCode = 0; TimedOut = $false; StartError = $false; StdErrPresent = $false; Lines = @() }
$stoppedVerified = Resolve-ComposeStopVerification -StopResult $stopNonzero -RunningQueryResult $zeroRunning
Assert-Test ($stoppedVerified.VerifiedStopped -and $stoppedVerified.ExitCode -eq 0 -and $stoppedVerified.Category -eq 'stop_exit_nonzero_but_no_running_containers') 'Nonzero Compose stop is accepted only when read-only state confirms no running containers.'
$oneRunning = [pscustomobject]@{ ExitCode = 0; TimedOut = $false; StartError = $false; StdErrPresent = $false; Lines = @('0123456789abcdef0123456789abcdef') }
$stopUnverified = Resolve-ComposeStopVerification -StopResult $stopNonzero -RunningQueryResult $oneRunning
Assert-Test (-not $stopUnverified.VerifiedStopped -and $stopUnverified.RunningCount -eq 1 -and $stopUnverified.Category -eq 'containers_still_running') 'Stop is not reported successful while any dedicated project container remains running.'

$resumeLabels = [pscustomobject]@{
    'com.docker.compose.service' = 'db'
    'com.docker.compose.project' = 'vendeo_f47_2_disposable_compose_20261024'
    'com.supabase.cli.project' = 'vendeo_f47_2_disposable_20261024'
}
$resumeContainer = [pscustomobject]@{
    Id = '1111111111111111111111111111111111111111111111111111111111111111'
    Name = '/supabase_db_vendeo_f47_2_disposable_20261024_compose'
    State = [pscustomobject]@{ Status = 'exited' }
    Config = [pscustomobject]@{ Labels = $resumeLabels; Image = 'postgres:reviewed' }
    HostConfig = [pscustomobject]@{ RestartPolicy = [pscustomobject]@{ Name = 'no' } }
    Image = 'sha256:reviewed-image-id'
    Mounts = @([pscustomobject]@{ Type = 'volume'; Name = 'supabase_db_vendeo_f47_2_disposable_20261024'; Destination = '/var/lib/postgresql/data'; RW = $true })
}
$resumeService = [pscustomobject]@{
    Service = 'db'
    Image = 'postgres:reviewed'
    ImageId = 'sha256:reviewed-image-id'
    Mounts = @([pscustomobject]@{ Type = 'volume'; Source = 'supabase_db_vendeo_f47_2_disposable_20261024'; Target = '/var/lib/postgresql/data'; ReadOnly = $false })
}
Assert-Test (Assert-ResumeContainerInventory -Containers @($resumeContainer) -ExpectedServices @($resumeService) -ComposeProject 'vendeo_f47_2_disposable_compose_20261024' -ProjectId 'vendeo_f47_2_disposable_20261024') 'Resume accepts only exact stopped container identity/image/volume inventory.'
$wrongImageService = $resumeService.PSObject.Copy()
$wrongImageService.ImageId = 'sha256:unexpected-image-id'
$identityDriftRejected = $false
try { Assert-ResumeContainerInventory -Containers @($resumeContainer) -ExpectedServices @($wrongImageService) -ComposeProject 'vendeo_f47_2_disposable_compose_20261024' -ProjectId 'vendeo_f47_2_disposable_20261024' }
catch { $identityDriftRejected = $true }
Assert-Test $identityDriftRejected 'Resume blocks when a local image ID differs from the reviewed image.'
$wrongMountService = $resumeService.PSObject.Copy()
$wrongMountService.Mounts = @([pscustomobject]@{ Type = 'volume'; Source = 'unexpected-volume'; Target = '/var/lib/postgresql/data'; ReadOnly = $false })
$mountDriftRejected = $false
try { Assert-ResumeContainerInventory -Containers @($resumeContainer) -ExpectedServices @($wrongMountService) -ComposeProject 'vendeo_f47_2_disposable_compose_20261024' -ProjectId 'vendeo_f47_2_disposable_20261024' }
catch { $mountDriftRejected = $true }
Assert-Test $mountDriftRejected 'Resume blocks when the preserved volume mapping differs.'
Assert-Test (Assert-SameContainerIds -Before @('id-a', 'id-b') -After @('id-b', 'id-a')) 'Resume permits only the same container IDs, independent of ordering.'
$recreatedIdsRejected = $false
try { Assert-SameContainerIds -Before @('id-a', 'id-b') -After @('id-a', 'id-new') }
catch { $recreatedIdsRejected = $true }
Assert-Test $recreatedIdsRejected 'Resume blocks if Compose recreated even one container.'

$noMountLabels = [pscustomobject]@{
    'com.docker.compose.service' = 'rest'
    'com.docker.compose.project' = 'vendeo_f47_2_disposable_compose_20261024'
    'com.supabase.cli.project' = 'vendeo_f47_2_disposable_20261024'
}
$noMountContainer = [pscustomobject]@{
    Name = '/supabase_rest_vendeo_f47_2_disposable_20261024_compose'
    State = [pscustomobject]@{ Status = 'exited' }
    Config = [pscustomobject]@{ Labels = $noMountLabels; Image = 'rest:reviewed' }
    HostConfig = [pscustomobject]@{ RestartPolicy = [pscustomobject]@{ Name = '' } }
    Image = 'sha256:rest-image-id'
    Mounts = @($null)
}
$noMountService = [pscustomobject]@{ Service = 'rest'; Image = 'rest:reviewed'; ImageId = 'sha256:rest-image-id'; Mounts = @($null) }
Assert-Test (Assert-ResumeContainerInventory -Containers @($noMountContainer) -ExpectedServices @($noMountService) -ComposeProject 'vendeo_f47_2_disposable_compose_20261024' -ProjectId 'vendeo_f47_2_disposable_20261024') 'A service with null/empty Compose and inspect mount lists is accepted as zero mounts.'

$unexpectedExpectedVolume = $noMountService.PSObject.Copy()
$unexpectedExpectedVolume.Mounts = @([pscustomobject]@{ Type = 'volume'; Source = 'unexpected-volume'; Target = '/unexpected'; ReadOnly = $false })
$unexpectedVolumeRejected = $false
try { Assert-ResumeContainerInventory -Containers @($noMountContainer) -ExpectedServices @($unexpectedExpectedVolume) -ComposeProject 'vendeo_f47_2_disposable_compose_20261024' -ProjectId 'vendeo_f47_2_disposable_20261024' }
catch { $unexpectedVolumeRejected = $true }
Assert-Test $unexpectedVolumeRejected 'A volume absent from the actual container is rejected.'

$unexpectedActualVolume = $noMountContainer.PSObject.Copy()
$unexpectedActualVolume.Mounts = @([pscustomobject]@{ Type = 'volume'; Name = 'unexpected-volume'; Destination = '/unexpected'; RW = $true })
$unexpectedActualRejected = $false
try { Assert-ResumeContainerInventory -Containers @($unexpectedActualVolume) -ExpectedServices @($noMountService) -ComposeProject 'vendeo_f47_2_disposable_compose_20261024' -ProjectId 'vendeo_f47_2_disposable_20261024' }
catch { $unexpectedActualRejected = $true }
Assert-Test $unexpectedActualRejected 'An unexpected actual mount on a service with no volumes is rejected.'

$uninitializedLedger = Resolve-LedgerCheckpoint -TableExists $false -Versions @() -Context 'pre_migration' -MigrationDirectoryEmpty $true -MigrationListSucceeded $true
Assert-Test ($uninitializedLedger.State -eq 'ledger_not_initialized' -and $uninitializedLedger.Count -eq 0) 'Missing history table is accepted only in the pre-migration checkpoint after successful list and empty migration directory.'
Assert-Test (-not (Resolve-LedgerRelationProbeOutput -Lines @('absent'))) 'The to_regclass safe token absent maps to a missing history table.'
Assert-Test (Resolve-LedgerRelationProbeOutput -Lines @('present')) 'The to_regclass safe token present maps to an existing history table.'
$badRelationTokenRejected = $false
try { Resolve-LedgerRelationProbeOutput -Lines @('password=do-not-print') }
catch { $badRelationTokenRejected = $true }
Assert-Test $badRelationTokenRejected 'Unexpected relation probe output is rejected without surfacing its contents.'
$emptyInitializedLedger = Resolve-LedgerCheckpoint -TableExists $true -Versions @() -Context 'pre_migration' -MigrationDirectoryEmpty $true -MigrationListSucceeded $true
Assert-Test ($emptyInitializedLedger.State -eq 'ledger_empty' -and $emptyInitializedLedger.TableExists) 'An initialized empty ledger is distinguished from an absent ledger.'
$notInitializedPostRejected = $false
try { Resolve-LedgerCheckpoint -TableExists $false -Versions @() -Context 'post_migration' -ExpectedVersions @('20260101000000') }
catch { $notInitializedPostRejected = $true }
Assert-Test $notInitializedPostRejected 'A missing ledger table is rejected after migrations.'
$versionsExpected = @('20260101000000', '20260102000000')
$postLedger = Resolve-LedgerCheckpoint -TableExists $true -Versions $versionsExpected -Context 'post_migration' -ExpectedVersions $versionsExpected
Assert-Test ($postLedger.State -eq 'ledger_initialized' -and $postLedger.Count -eq 2) 'Post-migration ledger requires and accepts the exact expected version set.'
$postMismatchRejected = $false
try { Resolve-LedgerCheckpoint -TableExists $true -Versions @('20260101000000') -Context 'post_migration' -ExpectedVersions $versionsExpected }
catch { $postMismatchRejected = $true }
Assert-Test $postMismatchRejected 'Post-migration ledger rejects missing batch versions.'
$preMigrationGateRejected = $false
try { Resolve-LedgerCheckpoint -TableExists $false -Versions @() -Context 'pre_migration' -MigrationDirectoryEmpty $false -MigrationListSucceeded $true }
catch { $preMigrationGateRejected = $true }
Assert-Test $preMigrationGateRejected 'Uninitialized ledger is not accepted when the migration directory is not empty.'
$cliListGateRejected = $false
try { Resolve-LedgerCheckpoint -TableExists $false -Versions @() -Context 'pre_migration' -MigrationDirectoryEmpty $true -MigrationListSucceeded $false }
catch { $cliListGateRejected = $true }
Assert-Test $cliListGateRejected 'Uninitialized ledger is not accepted unless the normal CLI migration list succeeded.'

Write-Output 'Offline behavioral runner tests: PASS (probe URL/timeout, bindings, stderr/diagnostics, process timeout, cleanup, resume identity/images/volumes, null/unexpected mounts, absent/empty/post-migration ledger rules).'
}
finally {
    Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
}
