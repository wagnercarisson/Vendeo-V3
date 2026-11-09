param(
  [ValidateSet("status", "prove")]
  [string]$Action = "status",
  [string]$RunId = "",
  [string]$EvidenceRoot = ""
)

$ErrorActionPreference = "Stop"

if ($RunId -eq "") {
  $RunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss") + "-" + (Get-Random -Minimum 1000 -Maximum 9999)
}
if ($EvidenceRoot -eq "") {
  $EvidenceRoot = ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence"
}
$EvidenceDir = Join-Path $EvidenceRoot $RunId
$env:F60_RUN_ID = $RunId
$env:F60_EVIDENCE_DIR = $EvidenceDir

if ($env:SUPABASE_ACCESS_TOKEN -or $env:SUPABASE_DB_URL) {
  throw "Recusado: SUPABASE_ACCESS_TOKEN/SUPABASE_DB_URL não são aceitos nesta prova."
}
if (-not $env:TEST_DATABASE_URL) {
  throw "TEST_DATABASE_URL é obrigatório."
}

$uri = [System.Uri]$env:TEST_DATABASE_URL
if ($uri.Host -ne "127.0.0.1" -or $uri.Port -ne 57782 -or $uri.AbsolutePath.TrimStart("/") -ne "postgres") {
  throw "Alvo recusado: $($uri.Host):$($uri.Port)$($uri.AbsolutePath). Permitido: 127.0.0.1:57782/postgres."
}

New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

Write-Host "[f60] run: $RunId"
Write-Host "[f60] evidências: $EvidenceDir"
Write-Host "[f60] alvo: $($uri.Host):$($uri.Port)/$($uri.AbsolutePath.TrimStart('/'))"
Write-Host "[f60] ação: $Action"

if ($Action -eq "status") {
  node scripts/f60/homolog-snapshot.mjs snapshot --label status --run-id $RunId
  if ($LASTEXITCODE -ne 0) { throw "snapshot de status falhou" }
  if ($env:F60_EXPECTED_LEDGER_COUNT -and $env:F60_EXPECTED_LEDGER_SHA256) {
    node scripts/f60/homolog-snapshot.mjs validate-ledger `
      --snapshot (Join-Path $EvidenceDir "f60-snapshot-status.json") `
      --expected-ledger-count $env:F60_EXPECTED_LEDGER_COUNT `
      --expected-ledger-sha256 $env:F60_EXPECTED_LEDGER_SHA256 `
      --require-f60-absent true
    if ($LASTEXITCODE -ne 0) {
      throw "pré-checagem (antes da aplicação) falhou: ledger divergente ou F60 já aplicada."
    }
  }
  Write-Host "[f60] status somente leitura concluído."
  exit 0
}

if ($env:F60_HOMOLOG_AUTHORIZED -ne "1") {
  throw "prove exige F60_HOMOLOG_AUTHORIZED=1 (autorização C registrada)."
}
if (-not $env:F60_EXCLUSIVITY_WINDOW) {
  throw "prove exige F60_EXCLUSIVITY_WINDOW (início/fim/responsável)."
}
if (-not $env:F60_EXPECTED_LEDGER_COUNT -or -not $env:F60_EXPECTED_LEDGER_SHA256) {
  throw "prove exige F60_EXPECTED_LEDGER_COUNT e F60_EXPECTED_LEDGER_SHA256."
}

$cleanupAuthorized = $env:F60_CLEANUP_AUTHORIZED -eq "1"
$before = Join-Path $EvidenceDir "f60-snapshot-before.json"
$after = Join-Path $EvidenceDir "f60-snapshot-after.json"
$afterCleanup = Join-Path $EvidenceDir "f60-snapshot-after-cleanup.json"
$expect = Join-Path $EvidenceDir "f60-expected-additions.json"
$evidence = Join-Path $EvidenceDir "f60-proof-evidence.json"

Write-Host "[f60] snapshot antes..."
node scripts/f60/homolog-snapshot.mjs snapshot --label before --run-id $RunId
if ($LASTEXITCODE -ne 0) { throw "snapshot before falhou" }

Write-Host "[f60] validando ledger ANTES de qualquer escrita..."
node scripts/f60/homolog-snapshot.mjs validate-ledger `
  --snapshot $before `
  --expected-ledger-count $env:F60_EXPECTED_LEDGER_COUNT `
  --expected-ledger-sha256 $env:F60_EXPECTED_LEDGER_SHA256 `
  --require-f60-applied true
if ($LASTEXITCODE -ne 0) {
  Write-Error "Ledger inicial divergente ou F60 não aplicada. Nenhuma escrita será feita."
  exit 1
}

Write-Host "[f60] executando harness S01..S13 (sem IA)..."
node scripts/f60/two-stage-proof-harness.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Error "A prova falhou. Nenhum cleanup será executado. Registrar REJECTED."
  exit 1
}

Write-Host "[f60] snapshot depois..."
node scripts/f60/homolog-snapshot.mjs snapshot --label after --run-id $RunId
if ($LASTEXITCODE -ne 0) { throw "snapshot after falhou" }

Write-Host "[f60] comparação esperado × observado + ledger..."
node scripts/f60/homolog-snapshot.mjs compare `
  --before $before --after $after --expect $expect --run-id $RunId `
  --expected-ledger-count $env:F60_EXPECTED_LEDGER_COUNT `
  --expected-ledger-sha256 $env:F60_EXPECTED_LEDGER_SHA256
if ($LASTEXITCODE -ne 0) {
  Write-Error "Comparação S0/delta falhou. Nenhum cleanup será executado."
  exit 1
}

if (-not $cleanupAuthorized) {
  Write-Warning "[f60] cleanup NÃO autorizado (F60_CLEANUP_AUTHORIZED != 1). Nada foi apagado; pendência registrada."
  exit 0
}

Write-Host "[f60] cleanup autorizado (D): validação de manifesto e retenção..."
node scripts/f60/proof-cleanup.mjs --evidence $evidence --run-id $RunId
if ($LASTEXITCODE -ne 0) {
  Write-Error "Cleanup recusou o manifesto; nada foi apagado."
  exit 1
}

Write-Host "[f60] snapshot pós-cleanup..."
node scripts/f60/homolog-snapshot.mjs snapshot --label after-cleanup --run-id $RunId
if ($LASTEXITCODE -ne 0) { throw "snapshot after-cleanup falhou" }

Write-Host "[f60] verificação pós-cleanup..."
node scripts/f60/homolog-snapshot.mjs compare `
  --before $before --after $afterCleanup --expect $expect --run-id $RunId `
  --expected-ledger-count $env:F60_EXPECTED_LEDGER_COUNT `
  --expected-ledger-sha256 $env:F60_EXPECTED_LEDGER_SHA256
if ($LASTEXITCODE -ne 0) {
  Write-Error "Verificação pós-cleanup falhou."
  exit 1
}

Write-Host "[f60] prova concluída; revisar evidence e preencher 60-01-PROOF-RESULT/DECISION."
exit 0
