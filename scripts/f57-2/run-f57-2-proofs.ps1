<#
.SYNOPSIS
  Orquestrador das provas F57.2 no homolog existente.

.DESCRIPTION
  Executa SOMENTE contra 127.0.0.1:57782/postgres. Não cria, inicia, baixa ou
  destrói ambientes; não usa comandos de criação, reset ou push de banco.
  -Action status: valida identidade/ledger em modo read-only.
  -Action prove:  roda as três suítes postgres, emite/compara a prova
                  comparativa e grava as evidências; cleanup no finally.

  A ação prove exige autorização explícita do checkpoint humano do plano 05.
#>
param(
  [ValidateSet("status", "prove")]
  [string]$Action = "status",
  [string]$EvidenceDir = ".planning/phases/57.2-f57-2-persist-ncia-de-prefer-ncias-multimercado/evidence",
  [int]$ExpectedLedgerCount = 149,
  [string]$ExpectedLedgerSha256 = "acc1ce62227e54b8cf0f2f9178e3b2e77f77b89d4582b904a7c1b11972c1e9a9",
  [int]$SuiteTimeoutSeconds = 600,
  [int]$CommandTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$TargetHost = "127.0.0.1"
$TargetPort = "57782"
$TargetDb = "postgres"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$NodeExe = (Get-Command node -ErrorAction Stop).Source
$VitestEntry = Join-Path $RepoRoot "node_modules/vitest/vitest.mjs"
$ProofsTool = Join-Path $PSScriptRoot "proofs-tool.mjs"
$ComparativeProof = Join-Path $PSScriptRoot "comparative-proof.mjs"
$SnapshotTool = Join-Path $PSScriptRoot "homolog-snapshot.mjs"
foreach ($requiredTool in @($NodeExe, $VitestEntry, $ProofsTool, $ComparativeProof, $SnapshotTool)) {
  if (-not (Test-Path $requiredTool)) { throw "Ferramenta obrigatória ausente: $requiredTool" }
}
if (-not [System.IO.Path]::IsPathRooted($EvidenceDir)) {
  $EvidenceDir = Join-Path $RepoRoot $EvidenceDir
}

if ($env:SUPABASE_ACCESS_TOKEN -or $env:SUPABASE_DB_URL) {
  throw "Recusado: SUPABASE_ACCESS_TOKEN/SUPABASE_DB_URL não são permitidos neste procedimento."
}
if (-not $env:TEST_DATABASE_URL) { throw "TEST_DATABASE_URL é obrigatório." }

$uri = $null
if (-not [Uri]::TryCreate($env:TEST_DATABASE_URL, [UriKind]::Absolute, [ref]$uri)) {
  throw "TEST_DATABASE_URL inválida."
}
if (($uri.Scheme -ne "postgresql" -and $uri.Scheme -ne "postgres") -or
    ($uri.Host -ne $TargetHost -and $uri.Host -ne "localhost") -or
    $uri.Port -ne [int]$TargetPort -or $uri.AbsolutePath -ne "/$TargetDb") {
  throw "Destino recusado: esperado $TargetHost`:$TargetPort/$TargetDb."
}
$MaskedTarget = "postgresql://***@$TargetHost`:$TargetPort/$TargetDb"

function ConvertTo-ProcessArgument([string]$Value) {
  if ($null -eq $Value -or $Value.Length -eq 0) { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }
  $builder = New-Object System.Text.StringBuilder
  [void]$builder.Append('"')
  $backslashes = 0
  foreach ($ch in $Value.ToCharArray()) {
    if ($ch -eq '\') {
      $backslashes += 1
      continue
    }
    if ($ch -eq '"') {
      if ($backslashes -gt 0) { [void]$builder.Append(('\' * ($backslashes * 2 + 1))) }
      else { [void]$builder.Append('\') }
      [void]$builder.Append('"')
      $backslashes = 0
      continue
    }
    if ($backslashes -gt 0) {
      [void]$builder.Append(('\' * $backslashes))
      $backslashes = 0
    }
    [void]$builder.Append($ch)
  }
  if ($backslashes -gt 0) { [void]$builder.Append(('\' * ($backslashes * 2))) }
  [void]$builder.Append('"')
  return $builder.ToString()
}

function Invoke-External {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$StdoutPath,
    [string]$StderrPath,
    [int]$TimeoutSeconds = $CommandTimeoutSeconds
  )
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument $_ }) -join ' ')
  $psi.UseShellExecute = $false
  $psi.WorkingDirectory = $RepoRoot
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  try {
    if (-not $process.Start()) { throw "Não foi possível iniciar $FilePath" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $timedOut = $false
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
      $timedOut = $true
      try { $process.Kill() } catch { }
      $process.WaitForExit(5000) | Out-Null
    }
    $stdout = $stdoutTask.Result
    $stderr = $stderrTask.Result
    if ($StdoutPath) {
      $parent = Split-Path $StdoutPath -Parent
      if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
      [System.IO.File]::WriteAllText($StdoutPath, $stdout, [System.Text.UTF8Encoding]::new($false))
    }
    if ($StderrPath) {
      $parent = Split-Path $StderrPath -Parent
      if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
      [System.IO.File]::WriteAllText($StderrPath, $stderr, [System.Text.UTF8Encoding]::new($false))
    }
    return [pscustomobject]@{
      ExitCode = if ($timedOut) { -1 } else { $process.ExitCode }
      TimedOut = $timedOut
      Stdout = $stdout
      Stderr = $stderr
    }
  } finally {
    $process.Dispose()
  }
}

function Assert-Step {
  param([string]$Name, $Result, [string]$StdoutPath, [string]$StderrPath)
  if ($Result.TimedOut) {
    throw "$Name excedeu timeout (stdout=$StdoutPath stderr=$StderrPath)"
  }
  if ($Result.ExitCode -ne 0) {
    $detail = if ($Result.Stderr) { $Result.Stderr.Trim() } else { $Result.Stdout.Trim() }
    if ($detail.Length -gt 800) { $detail = $detail.Substring(0, 800) }
    throw "$Name falhou (exit=$($Result.ExitCode); stdout=$StdoutPath stderr=$StderrPath): $detail"
  }
}

function Invoke-ProofsTool {
  param([string[]]$Arguments, [int]$TimeoutSeconds = $CommandTimeoutSeconds)
  $result = Invoke-External -FilePath $NodeExe -Arguments (@($ProofsTool) + $Arguments) -TimeoutSeconds $TimeoutSeconds
  Assert-Step -Name "proofs-tool $($Arguments[0])" -Result $result -StdoutPath "" -StderrPath ""
  return $result.Stdout | ConvertFrom-Json
}

if ($Action -eq "status") {
  $status = Invoke-ProofsTool -Arguments @(
    "status",
    "--expected-count", "$ExpectedLedgerCount",
    "--expected-sha256", $ExpectedLedgerSha256
  )
  Write-Output "HOMOLOG $MaskedTarget"
  Write-Output "LEDGER $($status.ledger_count) $($status.ledger_sha256)"
  Write-Output "F57_2 $($status.f57_2 -join ',')"
  exit 0
}

if (-not (Test-Path $EvidenceDir)) { New-Item -ItemType Directory -Path $EvidenceDir | Out-Null }
$status = Invoke-ProofsTool -Arguments @(
  "status",
  "--expected-count", "$ExpectedLedgerCount",
  "--expected-sha256", $ExpectedLedgerSha256
)
$preflight = Invoke-ProofsTool -Arguments @("preflight")
if ($preflight.stores -ne 0 -or $preflight.users -ne 0 -or $preflight.settings -ne 0 -or $preflight.preferences -ne 0) {
  throw "Preflight encontrou resíduos de execução anterior; não serão apagados automaticamente: $($preflight | ConvertTo-Json -Compress)"
}

$suiteCodes = [ordered]@{}
$evidencePaths = [ordered]@{
  db = Join-Path $EvidenceDir "57.2-05-db-evidence.json"
  rls = Join-Path $EvidenceDir "57.2-05-rls-grants.txt"
  comparative = Join-Path $EvidenceDir "57.2-05-comparative-proof.md"
  concurrency = Join-Path $EvidenceDir "57.2-05-concurrency.json"
  after = Join-Path $EvidenceDir "57.2-05-s1-s9-after.json"
  cleanup = Join-Path $EvidenceDir "57.2-05-cleanup-manifest.json"
}
$registry = Join-Path $EvidenceDir "57.2-05-cleanup-registry.jsonl"
if (Test-Path $registry) { Remove-Item -Force $registry }
New-Item -ItemType File -Path $registry | Out-Null
$evidencePaths.registry = $registry
$env:F57_2_CLEANUP_MANIFEST = $registry

$residues = $null
$proofError = $null
$cleanupError = $null
$finalSnapshotError = $null
try {
  $env:F57_2_EXPECTED_LEDGER_COUNT = "$ExpectedLedgerCount"
  $env:F57_2_EXPECTED_LEDGER_SHA256 = $ExpectedLedgerSha256

  $schemaOut = Join-Path $EvidenceDir "57.2-05-schema-output.txt"
  $schema = Invoke-External -FilePath $NodeExe -Arguments @(
    $VitestEntry, "run", "src/lib/__tests__/market-preferences-schema.postgres.test.ts", "--reporter=verbose"
  ) -StdoutPath $schemaOut -StderrPath (Join-Path $EvidenceDir "57.2-05-schema-stderr.txt") -TimeoutSeconds $SuiteTimeoutSeconds
  $suiteCodes.schema = $schema.ExitCode
  Assert-Step -Name "suíte de schema" -Result $schema -StdoutPath $schemaOut -StderrPath (Join-Path $EvidenceDir "57.2-05-schema-stderr.txt")

  $onboardingOut = Join-Path $EvidenceDir "57.2-05-onboarding-output.txt"
  $onboarding = Invoke-External -FilePath $NodeExe -Arguments @(
    $VitestEntry, "run", "src/lib/__tests__/market-preferences-onboarding.postgres.test.ts", "--reporter=verbose"
  ) -StdoutPath $onboardingOut -StderrPath (Join-Path $EvidenceDir "57.2-05-onboarding-stderr.txt") -TimeoutSeconds $SuiteTimeoutSeconds
  $suiteCodes.onboarding = $onboarding.ExitCode
  Assert-Step -Name "suíte de onboarding" -Result $onboarding -StdoutPath $onboardingOut -StderrPath (Join-Path $EvidenceDir "57.2-05-onboarding-stderr.txt")

  $securityErr = Join-Path $EvidenceDir "57.2-05-rls-grants-stderr.txt"
  $security = Invoke-External -FilePath $NodeExe -Arguments @(
    $VitestEntry, "run", "src/lib/__tests__/market-preferences-security.postgres.test.ts", "--reporter=verbose"
  ) -StdoutPath $evidencePaths.rls -StderrPath $securityErr -TimeoutSeconds $SuiteTimeoutSeconds
  $suiteCodes.security = $security.ExitCode
  Assert-Step -Name "suíte de segurança/RLS" -Result $security -StdoutPath $evidencePaths.rls -StderrPath $securityErr

  $baseline = Join-Path $EvidenceDir "57.2-04-baseline.json"
  $s0Before = Join-Path $EvidenceDir "57.2-01-s0-before.json"
  $s0After01 = Join-Path $EvidenceDir "57.2-01-s0-after-01.json"
  $s0After02 = Join-Path $EvidenceDir "57.2-01-s0-after-02.json"
  foreach ($required in @($baseline, $s0Before, $s0After01, $s0After02)) {
    if (-not (Test-Path $required)) { throw "Evidência obrigatória ausente: $required" }
  }

  $emit = Invoke-External -FilePath $NodeExe -Arguments @(
    $ComparativeProof, "emit", "--url", $env:TEST_DATABASE_URL, "--side", "new",
    "--out", $evidencePaths.after, "--concurrency-out", $evidencePaths.concurrency
  ) -StdoutPath (Join-Path $EvidenceDir "57.2-05-emit-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-emit-stderr.txt") -TimeoutSeconds 300
  Assert-Step -Name "emissão comparativa" -Result $emit -StdoutPath (Join-Path $EvidenceDir "57.2-05-emit-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-emit-stderr.txt")

  $compare = Invoke-External -FilePath $NodeExe -Arguments @(
    $ComparativeProof, "compare", "--base", $baseline, "--new", $evidencePaths.after,
    "--s0-before", $s0Before, "--s0-after-01", $s0After01, "--s0-after-02", $s0After02,
    "--out-md", $evidencePaths.comparative
  ) -StdoutPath (Join-Path $EvidenceDir "57.2-05-compare-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-compare-stderr.txt") -TimeoutSeconds 120
  Assert-Step -Name "comparação base × novo" -Result $compare -StdoutPath (Join-Path $EvidenceDir "57.2-05-compare-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-compare-stderr.txt")
} catch {
  $proofError = $_
} finally {
  try {
    $cleanupResult = Invoke-External -FilePath $NodeExe -Arguments @(
      $ProofsTool, "cleanup", "--registry", $registry, "--manifest-out", $evidencePaths.cleanup
    ) -StdoutPath (Join-Path $EvidenceDir "57.2-05-cleanup-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-cleanup-stderr.txt") -TimeoutSeconds 120
    $cleanupStdout = Join-Path $EvidenceDir "57.2-05-cleanup-output.txt"
    $cleanupStderr = Join-Path $EvidenceDir "57.2-05-cleanup-stderr.txt"
    $residues = if ($cleanupResult.Stdout) { $cleanupResult.Stdout | ConvertFrom-Json } else { $null }
    if ($cleanupResult.TimedOut) { throw "cleanup excedeu timeout (stdout=$cleanupStdout stderr=$cleanupStderr)" }
    if ($cleanupResult.ExitCode -ne 0) {
      $detail = if ($cleanupResult.Stderr) { $cleanupResult.Stderr.Trim() } else { $cleanupResult.Stdout.Trim() }
      throw "cleanup falhou (exit=$($cleanupResult.ExitCode); stdout=$cleanupStdout stderr=$cleanupStderr): $detail"
    }
  } catch {
    $cleanupError = $_
  }
}

$finalS0 = Join-Path $EvidenceDir "57.2-05-s0-final.json"
$finalS0Md = Join-Path $EvidenceDir "57.2-05-s0-final.md"
$evidencePaths.final_s0 = $finalS0
$evidencePaths.final_s0_md = $finalS0Md
try {
  $snapshot = Invoke-External -FilePath $NodeExe -Arguments @(
    $SnapshotTool, "snapshot", "--url", $env:TEST_DATABASE_URL,
    "--out", $finalS0, "--label", "after-proofs-cleanup"
  ) -StdoutPath (Join-Path $EvidenceDir "57.2-05-s0-final-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-s0-final-stderr.txt") -TimeoutSeconds 120
  Assert-Step -Name "S0 final" -Result $snapshot -StdoutPath (Join-Path $EvidenceDir "57.2-05-s0-final-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-s0-final-stderr.txt")

  $s0Compare = Invoke-External -FilePath $NodeExe -Arguments @(
    $SnapshotTool, "compare",
    "--before", (Join-Path $EvidenceDir "57.2-01-s0-after-02.json"),
    "--after", $finalS0, "--out-md", $finalS0Md
  ) -StdoutPath (Join-Path $EvidenceDir "57.2-05-s0-final-compare-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-s0-final-compare-stderr.txt") -TimeoutSeconds 120
  Assert-Step -Name "comparação S0 final" -Result $s0Compare -StdoutPath (Join-Path $EvidenceDir "57.2-05-s0-final-compare-output.txt") -StderrPath (Join-Path $EvidenceDir "57.2-05-s0-final-compare-stderr.txt")
} catch {
  $finalSnapshotError = $_
}

$evidence = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  target = $MaskedTarget
  ledger = [ordered]@{ count = $status.ledger_count; sha256 = $status.ledger_sha256; f57_2 = $status.f57_2 }
  preflight = $preflight
  suites = $suiteCodes
  residues = $residues
  evidence = $evidencePaths
  proof_error = if ($proofError) { $proofError.ToString() } else { $null }
  cleanup_error = if ($cleanupError) { $cleanupError.ToString() } else { $null }
  final_s0_error = if ($finalSnapshotError) { $finalSnapshotError.ToString() } else { $null }
}
$evidenceJson = $evidence | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($evidencePaths.db, $evidenceJson, [System.Text.UTF8Encoding]::new($false))

if ($cleanupError) { throw $cleanupError }
if ($proofError) { throw $proofError }
if ($finalSnapshotError) { throw $finalSnapshotError }

foreach ($path in $evidencePaths.Values) {
  if (-not (Test-Path $path)) { throw "Evidência não produzida: $path" }
  if ((Get-Item $path).Length -le 0) { throw "Evidência vazia: $path" }
}
if ($residues.stores -ne 0 -or $residues.users -ne 0 -or $residues.settings -ne 0 -or $residues.preferences -ne 0) {
  throw "Resíduos encontrados após cleanup: $($residues | ConvertTo-Json -Compress)"
}
Write-Output "PROVE OK $MaskedTarget"
