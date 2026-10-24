$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$Runner = Join-Path $Repo 'scripts\f47-2\run-disposable-proofs.ps1'
$Module = Join-Path $Repo 'scripts\f47-2\lib\DisposableRunner.psm1'
$Manifest = 'C:\Users\wagne\AppData\Local\Temp\opencode\f47-2-compose-review\compose.yaml'

$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($Runner, [ref]$tokens, [ref]$parseErrors) | Out-Null
if ($parseErrors.Count -gt 0) { throw 'Runner has PowerShell parse errors.' }

$source = Get-Content -LiteralPath $Runner -Raw
$moduleSource = Get-Content -LiteralPath $Module -Raw
foreach ($requiredLedgerContract in @(
    "to_regclass('supabase_migrations.schema_migrations')",
    'ledger_relation_probe', 'ledger_select_sql',
    "-Context 'pre_migration'", "-Context 'post_migration'",
    'ledger_not_initialized'
)) {
    if (-not $source.Contains($requiredLedgerContract) -and -not $moduleSource.Contains($requiredLedgerContract)) {
        throw "Ledger initialization contract missing: $requiredLedgerContract"
    }
}
foreach ($required in @(
    "'environment', 'resume-preflight', 'resume-checkpoint', 'checkpoint', 'provision', 'invariants', 'compatibility-new', 'stop'",
    '-ConfirmStart', '-ConfirmResume', '-ConfirmMigrations', '-ConfirmInvariants', '-ConfirmCompatibility', '-ConfirmStop',
    "'--wait-timeout', '180'", '127.0.0.1:56322',
    "'--db-url'", "-Operation 'list'", "-Operation 'up'", "EXPECTED_DB_PORT = '56322'",
    'Stop-NewComposeProject', "'--timeout', '20'", 'partial run, never a Task 3 PASS',
    'exact compatibility-new test inventory is not defined', 'ExpectedManifestHash',
    'image ID differs from the stopped source service',
    'inventory differs from the two preserved volumes',
    "-TimeoutMilliseconds 120000", 'compose_stop_state_check',
    "-Stage 'ledger_select_sql'", 'migration_${Operation}_cli',
    'Resolve-ComposeStopVerification', 'Assert-ExistingComposeForResume', 'Get-MigrationProcessTimeout',
    "'start', '--wait', '--wait-timeout', '180'", 'Assert-ResumeContainerInventory',
    'Assert-SameContainerIds', 'Test-DisposableResumePreflight', 'Invoke-ProvisionWorkWithRestrictedStop',
    'no start/stop performed.'
)) {
    if (-not $source.Contains($required)) { throw "Runner missing required safety contract: $required" }
}
if (-not $moduleSource.Contains('stop_exit_nonzero_but_no_running_containers')) {
    throw 'Runner module missing safe stop-state classification.'
}
$provisionStart = $source.IndexOf('function Invoke-Provision {')
$proofStart = $source.IndexOf('function Invoke-SignatureProof {', $provisionStart)
if ($provisionStart -lt 0 -or $proofStart -le $provisionStart) { throw 'Could not isolate the provision stage for static sequencing checks.' }
$provisionSource = $source.Substring($provisionStart, $proofStart - $provisionStart)
$orderedTokens = @(
    'Assert-ExistingComposeForResume',
    "'start', '--wait', '--wait-timeout', '180'",
    '-PrepareAction {', 'Get-LocalDatabaseUrl', '-PreMigrationCheck {',
    "-Operation 'list'",
    'Copy-Item -LiteralPath',
    "-Operation 'up'",
    'Get-LedgerState',
    '-StopAction { Stop-NewComposeProject }'
)
$lastIndex = -1
foreach ($token in $orderedTokens) {
    $index = $provisionSource.IndexOf($token)
    if ($index -le $lastIndex) { throw "Provision stage order is missing or incorrect at: $token" }
    $lastIndex = $index
}
foreach ($forbidden in @('supabase status', 'supabase start', 'supabase stop', '--linked', 'migration repair', 'db reset', 'db push', 'compose down', 'down -v')) {
    if ($source.Contains($forbidden)) { throw "Runner contains forbidden operation: $forbidden" }
}
if ($source -match 'Write-Output\s+\$result\.Lines|Write-Host\s+\$result\.Lines') {
    throw 'Runner may print captured command output.'
}

if (Test-Path -LiteralPath $Manifest -PathType Leaf) {
    $manifestObject = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
    if ($manifestObject.services.kong.depends_on.rest.condition -ne 'service_started') {
        throw 'Kong REST dependency must be service_started; REST is probed separately.'
    }
    if ($manifestObject.services.studio.environment.PSObject.Properties.Name -contains 'OPENAI_API_KEY') {
        throw 'Studio provider credential must not be in the review manifest.'
    }
}

Write-Output 'Offline static runner checks: PASS (PowerShell parser, gates, loopback target, bounded start/resume, REST condition, secret/output guards).'
