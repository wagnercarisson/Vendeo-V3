Set-StrictMode -Version Latest

function ConvertTo-ProcessArgument {
    param([AllowEmptyString()][string]$Value)
    $builder = [System.Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') {
            $slashes++
            continue
        }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (($slashes * 2) + 1)))
            [void]$builder.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)) }
        [void]$builder.Append($character)
        $slashes = 0
    }
    if ($slashes -gt 0) { [void]$builder.Append(('\' * ($slashes * 2))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Invoke-Captured {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [ValidateRange(1, 3600000)][int]$TimeoutMilliseconds = 30000
    )

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $process.StartInfo.FileName = $FilePath
    $process.StartInfo.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument -Value $_ }) -join ' ')
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true

    try {
        if (-not $process.Start()) {
            return [pscustomobject]@{ ExitCode = -1; Lines = @(); StdErrPresent = $false; TimedOut = $false; StartError = $true }
        }
    }
    catch {
        $process.Dispose()
        return [pscustomobject]@{ ExitCode = -1; Lines = @(); StdErrPresent = $false; TimedOut = $false; StartError = $true }
    }

    # Drain both pipes asynchronously; stderr is intentionally discarded after
    # capture so neither native stderr nor secret-bearing diagnostics reach the
    # caller's console/error stream.
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $timedOut = -not $process.WaitForExit($TimeoutMilliseconds)
    if ($timedOut) {
        try { $process.Kill() } catch { }
        try { $process.WaitForExit() } catch { }
    }
    else {
        $process.WaitForExit()
    }

    $stdout = ''
    $stderrPresent = $false
    try { $stdout = $stdoutTask.GetAwaiter().GetResult() } catch { }
    try { $stderrPresent = $stderrTask.GetAwaiter().GetResult().Length -gt 0 } catch { }
    $exitCode = if ($timedOut) { -1 } else { $process.ExitCode }
    $process.Dispose()

    $lines = @()
    if ($stdout.Length -gt 0) { $lines = @($stdout -split "`r?`n") }
    return [pscustomobject]@{
        ExitCode = $exitCode
        Lines = $lines
        StdErrPresent = $stderrPresent
        TimedOut = $timedOut
        StartError = $false
    }
}

function New-ComposeArguments {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectName,
        [Parameter(Mandatory = $true)][string]$ManifestPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    return @('compose', '-p', $ProjectName, '-f', $ManifestPath) + $Arguments
}

function Get-SafeProcessFailureCategory {
    param([Parameter(Mandatory = $true)][object]$Result)
    if ($Result.StartError) { return 'process_start_error' }
    if ($Result.TimedOut) { return 'process_timeout' }
    if ($Result.ExitCode -ne 0 -and $Result.StdErrPresent) { return 'nonzero_with_stderr' }
    if ($Result.ExitCode -ne 0) { return 'nonzero_exit' }
    if ($Result.StdErrPresent) { return 'stderr_on_success' }
    return 'none'
}

function New-SafeProcessDiagnostic {
    param(
        [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_]+$')][string]$Stage,
        [Parameter(Mandatory = $true)][object]$Result
    )
    $category = Get-SafeProcessFailureCategory -Result $Result
    return [pscustomobject]@{
        Stage = $Stage
        ExitCode = [int]$Result.ExitCode
        TimedOut = [bool]$Result.TimedOut
        Category = $category
        StdErrPresent = [bool]$Result.StdErrPresent
    }
}

function Resolve-ComposeStopVerification {
    param(
        [Parameter(Mandatory = $true)][object]$StopResult,
        [Parameter(Mandatory = $true)][object]$RunningQueryResult
    )
    if ($RunningQueryResult.StartError -or $RunningQueryResult.TimedOut -or $RunningQueryResult.ExitCode -ne 0) {
        return [pscustomobject]@{
            VerifiedStopped = $false
            ExitCode = 1
            RunningCount = -1
            Category = Get-SafeProcessFailureCategory -Result $RunningQueryResult
        }
    }
    $runningIds = @($RunningQueryResult.Lines | Where-Object { $_ -match '^[0-9a-f]{12,64}$' })
    if ($runningIds.Count -eq 0) {
        $stopFailed = $StopResult.StartError -or $StopResult.TimedOut -or $StopResult.ExitCode -ne 0
        return [pscustomobject]@{
            VerifiedStopped = $true
            ExitCode = 0
            RunningCount = 0
            Category = if ($stopFailed) { 'stop_exit_nonzero_but_no_running_containers' } else { 'none' }
        }
    }
    return [pscustomobject]@{
        VerifiedStopped = $false
        ExitCode = 1
        RunningCount = $runningIds.Count
        Category = 'containers_still_running'
    }
}

function New-RestReadinessProbe {
    param(
        [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_]+$')][string]$ProjectId,
        [ValidateRange(100, 30000)][int]$RequestTimeoutMilliseconds = 4000
    )
    $url = "http://supabase_rest_${ProjectId}:3000/"
    return "(async()=>{const c=new AbortController();const t=setTimeout(()=>c.abort(),$RequestTimeoutMilliseconds);try{const r=await fetch('$url',{signal:c.signal});process.exitCode=r.status>=500?1:0}catch{process.exitCode=1}finally{clearTimeout(t)}})()"
}

function Get-HostPortBindings {
    param([Parameter(Mandatory = $true)][object[]]$Containers)
    $result = [System.Collections.Generic.List[object]]::new()
    foreach ($container in $Containers) {
        $bindings = $container.HostConfig.PortBindings
        if ($null -eq $bindings) { continue }
        $properties = if ($bindings -is [System.Collections.IDictionary]) {
            @($bindings.GetEnumerator() | ForEach-Object { [pscustomobject]@{ Name = $_.Key; Value = $_.Value } })
        }
        else {
            @($bindings.PSObject.Properties)
        }
        foreach ($property in $properties) {
            foreach ($binding in @($property.Value)) {
                $result.Add([pscustomobject]@{
                    Container = [string]$container.Name
                    ContainerPort = [string]$property.Name
                    HostIp = [string]$binding.HostIp
                    HostPort = [string]$binding.HostPort
                })
            }
        }
    }
    return @($result.ToArray())
}

function Assert-ExpectedHostPortBindings {
    param(
        [Parameter(Mandatory = $true)][object[]]$Containers,
        [Parameter(Mandatory = $true)][object[]]$ExpectedBindings
    )
    $actual = @(Get-HostPortBindings -Containers $Containers)
    if ($actual.Count -ne $ExpectedBindings.Count) {
        throw 'Published port count differs from the reviewed exact binding set.'
    }
    foreach ($expected in $ExpectedBindings) {
        $matches = @($actual | Where-Object {
            $_.ContainerPort -eq $expected.ContainerPort -and
            $_.HostIp -eq $expected.HostIp -and
            $_.HostPort -eq $expected.HostPort -and
            ($expected.Container -eq '*' -or $_.Container -eq $expected.Container)
        })
        if ($matches.Count -ne 1) { throw 'Published bindings differ from the reviewed exact loopback set.' }
    }
}

function Assert-ResumeContainerInventory {
    param(
        [Parameter(Mandatory = $true)][object[]]$Containers,
        [Parameter(Mandatory = $true)][object[]]$ExpectedServices,
        [Parameter(Mandatory = $true)][string]$ComposeProject,
        [Parameter(Mandatory = $true)][string]$ProjectId
    )
    if ($Containers.Count -ne $ExpectedServices.Count) {
        throw 'Existing Compose container count differs from the reviewed service inventory.'
    }
    foreach ($expected in $ExpectedServices) {
        $matches = @($Containers | Where-Object { $_.Config.Labels.'com.docker.compose.service' -eq $expected.Service })
        if ($matches.Count -ne 1) { throw 'Existing Compose service identity is missing or duplicated.' }
        $container = $matches[0]
        $expectedName = "/supabase_$($expected.Service)_${ProjectId}_compose"
        if ($container.Name -ne $expectedName -or
            $container.State.Status -ne 'exited' -or
            $container.Config.Labels.'com.docker.compose.project' -ne $ComposeProject -or
            $container.Config.Labels.'com.supabase.cli.project' -ne $ProjectId -or
            $container.Config.Image -ne $expected.Image -or
            $container.Image -ne $expected.ImageId -or
            $container.HostConfig.RestartPolicy.Name -notin @('', 'no')) {
            throw 'Existing Compose container name/state/project/image identity differs from the reviewed inventory.'
        }

        $expectedMounts = @($expected.Mounts | Where-Object { $null -ne $_ })
        $actualMounts = @($container.Mounts | Where-Object { $null -ne $_ })
        if ($actualMounts.Count -ne $expectedMounts.Count) { throw 'Existing Compose mount count differs from the reviewed inventory.' }
        foreach ($mount in $expectedMounts) {
            $sourceProperty = if ($mount.Type -eq 'volume') { 'Name' } else { 'Source' }
            $actualSource = [string]$mount.Source
            if ($mount.Type -eq 'volume') { $actualSource = [string]$mount.Source }
            $found = @($actualMounts | Where-Object {
                $_.Type -eq $mount.Type -and
                $_.Destination -eq $mount.Target -and
                $_.$sourceProperty -eq $actualSource -and
                [bool]$_.RW -eq (-not [bool]$mount.ReadOnly)
            })
            if ($found.Count -ne 1) { throw 'Existing Compose mount source/target/mode differs from the reviewed inventory.' }
        }
    }
    return $true
}

function Assert-SameContainerIds {
    param(
        [Parameter(Mandatory = $true)][string[]]$Before,
        [Parameter(Mandatory = $true)][string[]]$After
    )
    $beforeSorted = @($Before | Sort-Object)
    $afterSorted = @($After | Sort-Object)
    if ((Compare-Object $beforeSorted $afterSorted) -or $beforeSorted.Count -ne $afterSorted.Count) {
        throw 'Resume changed container IDs; recreation is forbidden.'
    }
    return $true
}

function Resolve-LedgerCheckpoint {
    param(
        [Parameter(Mandatory = $true)][bool]$TableExists,
        [AllowEmptyCollection()][string[]]$Versions = @(),
        [Parameter(Mandatory = $true)][ValidateSet('pre_migration', 'post_migration')][string]$Context,
        [bool]$MigrationDirectoryEmpty = $false,
        [bool]$MigrationListSucceeded = $false,
        [string[]]$ExpectedVersions = @()
    )
    $actualVersions = @($Versions | Where-Object { $_ -match '^\d{14}$' } | Sort-Object -Unique)
    if ($Context -eq 'pre_migration') {
        if (-not $MigrationListSucceeded) { throw 'Pre-migration checkpoint requires successful Supabase CLI migration list.' }
        if (-not $MigrationDirectoryEmpty) { throw 'Pre-migration checkpoint requires an empty migration directory.' }
        if ($actualVersions.Count -gt 0) { throw 'Pre-migration ledger unexpectedly contains migration versions.' }
        $state = if ($TableExists) { 'ledger_empty' } else { 'ledger_not_initialized' }
        return [pscustomobject]@{ State = $state; Count = 0; TableExists = $TableExists }
    }

    if (-not $TableExists) { throw 'Post-migration ledger table is missing.' }
    $expected = @($ExpectedVersions | Where-Object { $_ -match '^\d{14}$' } | Sort-Object -Unique)
    $versionDifferences = @(Compare-Object $expected $actualVersions)
    if ($expected.Count -eq 0 -or $actualVersions.Count -ne $expected.Count -or $versionDifferences.Count -gt 0) {
        throw 'Post-migration ledger does not match the expected migration version set.'
    }
    return [pscustomobject]@{ State = 'ledger_initialized'; Count = $actualVersions.Count; TableExists = $true }
}

function Resolve-LedgerRelationProbeOutput {
    param([AllowEmptyCollection()][string[]]$Lines = @())
    $states = @($Lines | ForEach-Object { "$($_)".Trim() } | Where-Object { $_ })
    if ($states.Count -ne 1 -or $states[0] -notin @('absent', 'present')) {
        throw 'Ledger relation probe output is not a single safe state token.'
    }
    return ($states[0] -eq 'present')
}

function Invoke-StartupWithRestrictedCleanup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][scriptblock]$StartAction,
        [Parameter(Mandatory = $true)][scriptblock]$ValidateAction,
        [Parameter(Mandatory = $true)][scriptblock]$CleanupAction
    )

    $startAttempted = $true
    try {
        $startResult = & $StartAction
        if ($null -eq $startResult -or $startResult.StartError -or $startResult.TimedOut -or $startResult.ExitCode -ne 0) {
            throw 'start_failed'
        }
        $validation = & $ValidateAction
        if ($validation -is [bool] -and -not $validation) { throw 'validation_failed' }
        return [pscustomobject]@{ Succeeded = $true; CleanupAttempted = $false; CleanupSucceeded = $true }
    }
    catch {
        $cleanupSucceeded = $false
        try {
            $cleanupResult = & $CleanupAction
            if ($cleanupResult -is [bool]) {
                $cleanupSucceeded = $cleanupResult
            }
            elseif ($null -ne $cleanupResult) {
                $cleanupSucceeded = (-not $cleanupResult.StartError -and -not $cleanupResult.TimedOut -and $cleanupResult.ExitCode -eq 0)
            }
        }
        catch { $cleanupSucceeded = $false }
        return [pscustomobject]@{ Succeeded = $false; CleanupAttempted = $startAttempted; CleanupSucceeded = $cleanupSucceeded }
    }
}

Export-ModuleMember -Function Invoke-Captured, New-ComposeArguments, New-SafeProcessDiagnostic, Get-SafeProcessFailureCategory, Resolve-ComposeStopVerification, New-RestReadinessProbe, Get-HostPortBindings, Assert-ExpectedHostPortBindings, Assert-ResumeContainerInventory, Assert-SameContainerIds, Resolve-LedgerCheckpoint, Resolve-LedgerRelationProbeOutput, Invoke-StartupWithRestrictedCleanup
