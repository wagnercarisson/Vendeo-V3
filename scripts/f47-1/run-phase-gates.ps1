# F47.1 - Gates automatizados da fase (sem chamadas pagas).
#
# Executa typecheck, lint, build, suites focadas da fase, OpenSpec strict,
# diff check e as provas reais em Postgres local no modo ProofsOnly.
#
# ProofsOnly NAO aplica migration e usa transacao/ROLLBACK ou banco descartavel
# proprio no mesmo servidor local aprovado. Nenhum provider e chamado.
param(
  [string]$Workdir = "G:\Vendeo-Homolog",
  [string]$ApiPort = "57781",
  [string]$DbPort = "57782"
)

$ErrorActionPreference = "Continue"
$script:Failures = @()

function Invoke-Gate {
  param([string]$Name, [scriptblock]$Action)
  Write-Output ""
  Write-Output "== gate: $Name =="
  $started = Get-Date
  & $Action
  $code = $LASTEXITCODE
  $elapsed = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
  if ($code -eq 0) {
    Write-Output "PASS $Name (${elapsed}s)"
  } else {
    $script:Failures += "$Name (exit $code)"
    Write-Output "FAIL $Name (exit $code, ${elapsed}s)"
  }
}

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

# Build local: origem absoluta de fallback se o ambiente nao definir uma.
if ([string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SITE_URL)) {
  $env:NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
}
if ([string]::IsNullOrWhiteSpace($env:VENDEO_VS_VALIDATION_OPENAI_API_KEY)) {
  Write-Output "WARN: credencial dedicada ausente neste shell; ProofsOnly fara fail-closed na presenca booleana."
}

Write-Output "== F47.1 phase gates (summary sanitizado) =="
Write-Output "repo=$RepoRoot"
Write-Output "local_workdir=$Workdir api_port=$ApiPort db_port=$DbPort"

# `npm` no Windows pode ser um wrapper .ps1 que nao preenche $LASTEXITCODE;
# `cmd /c` garante o codigo de saida real de cada gate.
Invoke-Gate "typecheck" { cmd /c "npm run typecheck" }
Invoke-Gate "lint" { cmd /c "npm run lint" }
Invoke-Gate "build" { cmd /c "npm run build" }

Invoke-Gate "focused-vitest" {
  npx vitest run `
    src/lib/visual-signature/__tests__/local-validation-guard.test.ts `
    src/lib/ai/__tests__/responses-adapter-wire.test.ts `
    src/lib/ai/__tests__/visual-signature-model-config-freeze.test.ts `
    src/lib/visual-signature/__tests__/creative-intent-parsing.test.ts `
    src/lib/ai/__tests__/deferred-telemetry-sink.test.ts `
    src/lib/ai/__tests__/telemetry-sink.test.ts `
    src/lib/visual-signature/__tests__/ai-image-generator.test.ts `
    src/lib/visual-signature/__tests__/identity-art-director-rejection.test.ts `
    src/lib/visual-signature/__tests__/server-actions-automatic.test.ts `
    "src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts" `
    src/lib/ai-cost/__tests__/visual-signature-usage.test.ts `
    src/lib/ai-cost/__tests__/visual-signature-pricing.test.ts `
    src/lib/ai-cost/__tests__/visual-signature-cost.contract.test.ts `
    src/lib/ai/__tests__/visual-signature-telemetry-fields.test.ts `
    src/lib/ai/__tests__/responses-adapter-retry.test.ts `
    src/lib/ai/__tests__/visual-signature-usage-path.test.ts `
    src/lib/ai-cost/__tests__/cost-estimator.test.ts `
    src/lib/ai/__tests__/visual-signature-model-config-view.test.ts `
    src/app/api/admin/__tests__/visual-signature-model-config.test.ts `
    "src/app/(app)/admin/ai-model-selection/visual-signature-model-config.test.tsx" `
    "src/app/(app)/admin/ai-model-selection/unified-model-config.test.tsx" `
    "src/app/(app)/admin/ai-model-selection/ai-model-selection.test.tsx" `
    tests/integration/f47-1-visual-signature-entry-points.test.ts `
    tests/integration/f47-1-visual-signature-regressions.test.ts
}

Invoke-Gate "openspec-strict" {
  npx openspec validate "fase-47-1-modelos-assinatura-visual" --strict
}

Invoke-Gate "git-diff-check" { git diff --check }

Invoke-Gate "local-proofs-proofs-only" {
  powershell -NoProfile -File (Join-Path $PSScriptRoot "run-local-proofs.ps1") `
    -ProofsOnly -Workdir $Workdir -ApiPort ([int]$ApiPort) -DbPort ([int]$DbPort)
}

Write-Output ""
Write-Output "== RESULT =="
if ($script:Failures.Count -eq 0) {
  Write-Output "PASS: todos os gates da F47.1 passaram; ProofsOnly verde; nenhuma chamada paga."
  exit 0
}

Write-Output ("FAIL: " + $script:Failures.Count + " gate(s) falharam")
foreach ($failure in $script:Failures) { Write-Output ("  - " + $failure) }
exit 1
