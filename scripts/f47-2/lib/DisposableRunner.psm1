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

Export-ModuleMember -Function Invoke-Captured, New-ComposeArguments, New-RestReadinessProbe, Get-HostPortBindings, Assert-ExpectedHostPortBindings, Invoke-StartupWithRestrictedCleanup
