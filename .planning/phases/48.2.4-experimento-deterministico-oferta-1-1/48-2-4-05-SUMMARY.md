---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-05
subsystem: lab-bench
tags: [lab, bench, identity, images-adapter, fail-closed, data-url, D10, D17]

# Dependency graph
requires:
  - phase: 48.2.4 (Plano 01)
    provides: DDL local/evidências, `identityReference` (`{ kind, variantType, storagePath }`) e isolamento/Base SHA
  - phase: 48.2.4 (Planos 02-04)
    provides: núcleo/políticas, prompt-base padrão e mapeamento de branding/identity-direction
provides:
  - Transporte canônico da identidade ao modelo (`identityImageUrl`) no adapter/runtime da bancada
  - Anexo da identidade como ÚLTIMA referência (principal → adicionais → identidade)
  - `resolveBenchIdentityImageDataUrl` fail-closed (`bench_identity_reference_unavailable`) antes da chamada paga
  - URL assinada transitória e não persistida
affects: [48.2.4-06 (POST /runs revalidação/evidências), 48.2.4-07 (tentativas), 48.2.4-08 (UAT), 48.2.4-09 (gate Base SHA)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consumo da referência canônica já resolvida (sem re-resolver identidade em POST /runs)"
    - "Validação de compatibilidade identityState × identityReference.kind"
    - "Fail-closed antes da chamada paga via erro determinístico com `code`"

key-files:
  created:
    - src/lib/lab/bench/execution/bench-identity-transport.ts
    - src/lib/lab/bench/__tests__/identity-transport.contract.test.ts
  modified:
    - src/lib/lab/bench/gateway/runtime.ts
    - src/lib/ai/adapters/bench-images.ts
    - src/lib/lab/bench/execution/bench-execution-service.ts
    - src/lib/lab/bench/__tests__/bench-images-adapter.test.ts
    - src/lib/lab/bench/__tests__/bench-execution.contract.test.ts

key-decisions:
  - "O transporte consome a identityReference já resolvida por loadBenchBranding e não re-invoca resolveBenchIdentity"
  - "Erros determinísticos: bench_identity_reference_unavailable (indisponível) e bench_identity_reference_incompatible (estado×kind)"
  - "A URL assinada é usada apenas como gate do signer restrito de branding; nunca retornada/persistida"

patterns-established:
  - "Identidade como última referência no adapter da bancada (ordem documentada principal → adicionais → identidade)"
  - "Transporte server-only com client por parâmetro e signer mockável em testes"

requirements-completed:
  - "cap: lab-bench-identity-transport"
  - "cap: lab-generation-bench"
  - "spec: lab-bench-identity-transport"
  - "spec: lab-isolation"
  - "spec: lab-generation-bench"
  - "D10"
  - "D17"
  - "tasks: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7"

# Metrics
duration: 6min
completed: 2026-09-30
---

# Phase 48.2.4 Plan 05: Transporte canônico da identidade ao modelo Summary

**Identidade canônica transportada ao modelo como última referência (principal → adicionais → identidade), resolvida a partir da referência já resolvida por `loadBenchBranding`, com falha fail-closed (`bench_identity_reference_unavailable`) antes da chamada paga e URL assinada transitória não persistida — adapter `Images` produtivo e registry padrão byte a byte intocados.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-09-30T12:56:11Z
- **Completed:** 2026-09-30T13:02:15Z
- **Tasks:** 3/3
- **Files modified:** 7 (2 criados, 5 modificados)

## Accomplishments

- `buildBenchInvocationRequest` passou a aceitar e incluir `identityImageUrl`; `BenchExecutionRequest`/`executeBenchRun` o repassam ao gateway da bancada.
- `BenchImagesAdapter` passou a anexar a identidade canônica como **última** referência, após as imagens de produto (`text_only` não envia imagem).
- Criado `bench-identity-transport.ts` com `resolveBenchIdentityImageDataUrl` — consome a `identityReference` já resolvida (sem re-resolver), valida apenas a compatibilidade `identityState`×`kind`, assina via signer restrito de branding, baixa o objeto e devolve data URL; indisponível ⇒ `bench_identity_reference_unavailable` antes da chamada paga, sem fallback.
- Testes de identidade nos 3 estados + indisponível + compatibilidade + ausência de re-resolução + ordem/regressão, com fakes em memória (nenhuma chamada de rede/paga).

## Task Commits

Each task was committed atomically:

1. **Task 1: Estender buildBenchInvocationRequest/BenchImagesAdapter e repassar por executeBenchRun** - `2b7055d5` (feat)
2. **Task 2: Resolver o data URL da identidade com falha fail-closed** - `5c7d91e6` (feat)
3. **Task 3: Testes de identidade (3 estados + indisponível) e regressão** - `d21a1497` (test)

**Plan metadata:** (este SUMMARY) — commit de docs

_Note: as tasks tiveram TDD aplicado na forma teste-de-contrato + implementação; a atualização das asserções obsoletas ficou no commit da Task 1 (ver Deviations)._

## Files Created/Modified

- `src/lib/lab/bench/gateway/runtime.ts` - `buildBenchInvocationRequest` aceita/inclui `identityImageUrl`.
- `src/lib/ai/adapters/bench-images.ts` - anexa a identidade como último arquivo; comentário atualizado.
- `src/lib/lab/bench/execution/bench-execution-service.ts` - `BenchExecutionRequest.identityImageUrl?` repassado.
- `src/lib/lab/bench/execution/bench-identity-transport.ts` - **novo**: `resolveBenchIdentityImageDataUrl` + `BenchIdentityTransportError`.
- `src/lib/lab/bench/__tests__/identity-transport.contract.test.ts` - **novo**: contrato do transporte.
- `src/lib/lab/bench/__tests__/bench-images-adapter.test.ts` - ordem/identidade + text_only.
- `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts` - transporte de `identityImageUrl` (asserção atualizada).

## Decisions Made

- **Sem re-resolução:** o transporte consome a `identityReference` já resolvida por `loadBenchBranding`; a única validação adicional é a compatibilidade `identityState`×`identityReference.kind` (D10).
- **Erros determinísticos:** `bench_identity_reference_unavailable` (referência ausente/sign/download/arquivo falho) e `bench_identity_reference_incompatible` (estado×kind; `text_only` com referência não nula; estado desconhecido).
- **Download via storage do cliente + gate do signer:** assina o `storagePath` da referência pelo signer restrito de branding (allowlist de bucket/path) e baixa o objeto pelo client; a URL assinada nunca é retornada/persistida.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Atualização das asserções obsoletas nos testes existentes (Task 1)**
- **Found during:** Task 1
- **Issue:** `bench-images-adapter.test.ts` e `bench-execution.contract.test.ts` continham asserções que provavam o comportamento **antigo** ("identityImageUrl ignorado" / "nunca inclui identityImageUrl"). A mudança de comportamento é **exigida pelo spec** (D10: identidade como última referência); mantê-las deixaria a verificação da Task 1 vermelha.
- **Fix:** Atualizadas as asserções contraditórias para o novo comportamento (identidade anexada como última referência; `identityImageUrl` incluído quando fornecido) e adicionada cobertura de `text_only` sem imagem. Nenhuma asserção foi enfraquecida — as demais permanecem idênticas.
- **Files modified:** `src/lib/lab/bench/__tests__/bench-images-adapter.test.ts`, `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts`
- **Verification:** `npx vitest run` dos dois arquivos ⇒ verdes; Task 3 estende a cobertura.
- **Committed in:** `2b7055d5` (Task 1)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessário para refletir a mudança de comportamento definida pelo spec (D10); sem ampliação de escopo.

## Issues Encountered

- **4 testes de `bench-execution.contract.test.ts` (executeBenchRun) estouram o timeout padrão de 5s neste ambiente**, por causa da chamada de rede do `LabTelemetrySink` → `getModelPricing` → Supabase local (`localhost:54321`), que não está em execução. **Pré-existente e não relacionado a este plano:** comprovado executando o arquivo no estado `HEAD` (sem alterações) — mesmos 4 timeouts. Com `--testTimeout=30000`, os 23 testes do arquivo passam. Nenhum arquivo de produção/teste foi alterado para "contornar" isso.

## User Setup Required

None - no external service configuration required. (Observação: para a suíte `bench-execution.contract.test.ts` rodar no timeout padrão, é necessário o Supabase local ativo em `localhost:54321`.)

## Next Phase Readiness

- Transporte de identidade pronto para o Plano 06 consumir em `POST /runs` (`resolveBenchIdentityImageDataUrl` a partir da referência já resolvida + persistência das evidências + revalidação do preflight).
- Nenhum bloqueio. `git diff --name-only -- src/lib/ai/adapters/images.ts src/lib/ai/adapters/registry.ts` vazio; nenhuma dependência nova.

## Self-Check: PASSED

---
*Phase: 48.2.4-experimento-deterministico-oferta-1-1*
*Completed: 2026-09-30*
