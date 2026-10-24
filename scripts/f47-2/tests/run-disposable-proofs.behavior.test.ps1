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

$timeoutResult = Invoke-Captured -FilePath $powershell -Arguments @('-NoProfile', '-NonInteractive', '-File', $fake, 'timeout') -TimeoutMilliseconds 1200
Assert-Test ($timeoutResult.TimedOut -and $timeoutResult.ExitCode -eq -1) 'A hung fake process is killed at the configured timeout.'

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

Write-Output 'Offline behavioral runner tests: PASS (probe URL/timeout, PSCustomObject wildcard/exact bindings, stderr suppression, process timeout, restricted cleanup).'
}
finally {
    Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
}
