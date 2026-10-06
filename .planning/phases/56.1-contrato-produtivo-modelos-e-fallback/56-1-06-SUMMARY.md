---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 06
subsystem: ai
tags: [ai, image-generation, failure-policy, fallback, quota, billing, rate-limit, pure-component]

# Dependency graph
requires:
  - phase: 56.1 / Plano 01
    provides: "AiInvocationErrorKind com quota/billing, AiInvocationError.code/httpStatus e envelope aditivo por tentativa"
provides:
  - "Classificador puro de elegibilidade ao fallback (ImageGenerationFailureClass + classifyImageGenerationFailure)"
  - "Máquina de política pura com teto de 3 chamadas (2 principal + 1 fallback), rate_limit transitório e disponibilidade direta ao fallback"
  - "Regra contábil simulada de não cobrança de falha técnica (charged=false/consumedCredit=false)"
affects: [56.1-07, 56.1-11, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Componente puro de decisão (sem I/O): classificação determinística + máquina de estado com invariantes de teto codificadas"
    - "Sinais explícitos de quota/faturamento avaliados antes do 429 genérico (espelha normalizeAiError do plano 01)"
    - "Resultado de encerramento com flags contábeis literais false (charged/consumedCredit), sinalizando não-cobrança por tipo"

key-files:
  created:
    - src/lib/ai/image-generation-failure-policy.ts
    - src/lib/ai/__tests__/image-generation-failure-policy.test.ts
  modified: []

key-decisions:
  - "provider_error com httpStatus 4xx é classificado como input (não elegível); só 5xx (ou provider_error sem status) é elegível ao fallback."
  - "Disponibilidade/capacidade só é acionada por sinal explícito (overloaded/unavailable/capacity); um 503 sem sinal continua provider_error (repete o principal)."
  - "O fallback é a única tentativa após o principal: um segundo estado no alvo fallback encerra (stop) mesmo antes do teto numérico."
  - "charged/consumedCredit são tipados como literal false e retornados em toda decisão de falha (D-17/T-56.1-20), com o enforcement transacional explicitamente atribuído à F56.2."

patterns-established:
  - "Classificação fail-closed de falha: entrada/autorização/segurança nunca retornam categoria de falha de modelo elegível"
  - "Máquina de tentativas pura com teto invariante (2+1=3) e plano máximo exposto por planImageGenerationAttempts/IMAGE_GENERATION_ATTEMPT_PLAN"

requirements-completed: [REQ-56.1-12, REQ-56.1-13, REQ-56.1-14, REQ-56.1-15, REQ-56.1-16]

# Metrics
duration: 4 min
completed: 2026-10-06
---

# Phase 56.1 Plan 06: Contrato produtivo, modelos e fallback — Política de falhas e fallback Summary

**Classificador puro de elegibilidade ao fallback + máquina de política com teto de 3 chamadas (2 principal + 1 fallback), rate_limit transitório, disponibilidade direta ao fallback, quota/faturamento sem fallback e não cobrança simulada de falha técnica**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-06T15:25:28Z
- **Completed:** 2026-10-06T15:28:59Z
- **Tasks:** 3
- **Files modified:** 2 (2 criados, 0 modificados)

## Accomplishments

- `classifyImageGenerationFailure(error)` classifica cada falha como **elegível** (`rate_limit`, `timeout`, `network`, `provider_error` 5xx e `availability`) ou **não elegível** (`quota`, `billing`, `auth`, `content`, `input`), de forma explícita e determinística (D-15).
- Sinais explícitos de **quota** (`insufficient_quota`/`quota_exceeded`) e **faturamento** são avaliados **antes** do `429` genérico — `insufficient_quota` com `httpStatus` 429 é não elegível (T-56.1-18).
- Falhas de **entrada/autorização/segurança** nunca retornam categoria de falha de modelo elegível; o default seguro de uma falha desconhecida é `input` (não elegível) (D-15).
- `nextImageGenerationAttempt(state, failure)` decide `retry_primary`/`go_fallback`/`stop` com tetos invariantes: até 2 tentativas no principal + até 1 no fallback = **até 3 chamadas** por operação (D-16/T-56.1-19).
- `rate_limit` é transitório (repete uma vez no principal e, persistindo, cai no fallback); **disponibilidade/capacidade** explícita vai direto ao fallback sem repetir o principal; `quota`/`billing`/`auth`/`content`/`input` nunca acionam fallback (D-16).
- Toda decisão de falha retorna `charged: false`/`consumedCredit: false` (tipo literal `false`): falha técnica não debita o lojista, com o enforcement transacional explicitamente atribuído à **F56.2** (D-17/T-56.1-20).

## Task Commits

Cada task foi commitada atomicamente (Tasks 1 e 2 em ciclo TDD RED → GREEN):

1. **Task 1: Classificador de elegibilidade ao fallback** - `94bcf819` (test, RED) + `882af0dc` (feat, GREEN)
2. **Task 2: Máquina de política com teto de 3 chamadas e não cobrança simulada** - `fa5b8394` (test, RED) + `844ae2ff` (feat, GREEN)
3. **Task 3: Testes de todas as ramificações (simulados)** - `20ebd3c9` (test)

**Plan metadata:** (docs: complete plan) — commit final do SUMMARY/STATE/ROADMAP/REQUIREMENTS.

_Nota: Tasks TDD geram commits de teste (RED) e de implementação (GREEN)._

## Files Created/Modified

- `src/lib/ai/image-generation-failure-policy.ts` - Módulo **puro**: tipo fechado `ImageGenerationFailureClass`, `classifyImageGenerationFailure` (taxonomia D-15, quota/billing antes do 429) e máquina `nextImageGenerationAttempt`/`planImageGenerationAttempts` com teto 2+1=3 e flags contábeis simuladas (D-16/D-17).
- `src/lib/ai/__tests__/image-generation-failure-policy.test.ts` - 35 testes offline (sem provider) cobrindo toda a taxonomia, o teto global, `rate_limit` transitório, disponibilidade direta ao fallback, quota/faturamento sem fallback, falha de entrada não virando falha de modelo e a não cobrança (`charged=false`/`consumedCredit=false`) em todas as categorias.

## Decisions Made

- **`provider_error` 4xx vira `input`**: apenas 5xx (ou `provider_error` sem status) é elegível; um `provider_error` com status 4xx é tratado como entrada/validação e não aciona fallback.
- **Disponibilidade exige sinal explícito** (`overloaded`/`unavailable`/`capacity`/`model_overloaded`); um `503` sem sinal permanece `provider_error` (repete o principal), preservando o comportamento de repetição útil.
- **Fallback único**: um estado com `target === "fallback"` encerra na falha seguinte, independentemente do número — o fallback é a última tentativa da mesma operação.
- **Flags contábeis como literal `false`**: o tipo reforça que falha técnica nunca cobra; o enforcement real sobre o ledger de créditos fica na F56.2 (D-25).
- **Classificação não-IO**: o módulo importa apenas **tipos** de `./types` (`import type`), sem rede, banco, provider ou crédito.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Tasks com `tdd="true"` seguiram RED → GREEN:
- Task 1: `94bcf819` (test, RED — módulo inexistente) → `882af0dc` (feat, GREEN).
- Task 2: `fa5b8394` (test, RED — `nextImageGenerationAttempt is not a function`) → `844ae2ff` (feat, GREEN).
- Task 3 (`type="auto"`, sem `tdd`): `20ebd3c9` (test) completou a suíte e passou na primeira execução sobre a máquina já implementada (task de teste pura, alinhada à separação do plano).

## Issues Encountered

None. `npm test -- src/lib/ai/__tests__/image-generation-failure-policy.test.ts` → **35 testes verdes**; suíte `src/lib/ai/` → **23 arquivos / 266 testes verdes** (sem regressão); `architecture-guard.test.ts` verde; `npm run typecheck` e `npm run lint` exit 0. Nenhum import de banco/provider; `git diff` restrito aos 2 arquivos do plano.

## User Setup Required

None - nenhuma configuração externa. Nenhuma chamada a provider, nenhuma mutação de banco, nenhuma migration e nenhuma ativação de geração.

## Next Phase Readiness

- Taxonomia e política de execução entregues como componentes puros testados por simulação, com teto de 3 chamadas e não cobrança de falha técnica.
- A **aplicação** da política sobre geração real e o **enforcement transacional** sobre o ledger de créditos permanecem explicitamente atribuídos à **F56.2** (D-25), registrados em docstring no módulo e em comentário na suíte.
- Fronteira produtiva legada intocada; nenhum `db push`, nenhuma chamada paga.
- Pronto para os próximos planos de código puro da F56.1.

## Self-Check: PASSED

- Arquivos criados verificados em disco: `src/lib/ai/image-generation-failure-policy.ts`, `src/lib/ai/__tests__/image-generation-failure-policy.test.ts` — todos FOUND.
- Commits verificados em `git log`: `94bcf819`, `882af0dc`, `fa5b8394`, `844ae2ff`, `20ebd3c9` — todos presentes.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*
