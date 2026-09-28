---
phase: 48.2.2
plan: 48-2-2-04
subsystem: lab-bench
tags: [nextjs, typescript, vitest, supabase, lab, bench, presets, allowlist, pricing, checkpoint, local-only]

# Dependency graph
requires:
  - phase: 48.2.2
    plan: 48-2-2-01
    provides: bounded context `src/lib/lab/bench/**`, `BENCH_MODEL_ALLOWLIST`, registry de presets e spike bloqueante (`docs/lab/48-2-2-spike-models.md`, CHECKPOINT 1)
  - phase: 48.2.2
    plan: 48-2-2-02
    provides: DDL local (`supabase/lab/bench-schema.sql`) e bootstrap local idempotente (`scripts/lab/48-2-2-bench-bootstrap.mjs`)
  - phase: 48.2.2
    plan: 48-2-2-03
    provides: manifesto de lojas de teste, branding read-only e snapshot de campanha
provides:
  - `src/lib/lab/bench/domain/bench-model-allowlist.ts`: `BENCH_MODEL_ALLOWLIST` com os modelos confirmados pelo spike (`gpt-image-2`, `gpt-image-2.5-flare`) no protocolo `images` (allowlist própria da bancada; `MODEL_ALLOWLIST` produtivo intocado)
  - `src/lib/lab/bench/domain/preset-registry.ts`: 4 presets `enabled: true` (caminho direto `images`) + caminho `responses` desabilitado com `reason: protocolo_nao_confirmado`
  - `src/lib/lab/bench/domain/bench-pricing.ts`: pricing local versionado (`BENCH_PRICING_RULE_VERSION = "2026-09-bench-1"`) chaveado por `provider+model+protocol+quality+size`
  - `scripts/lab/48-2-2-bench-bootstrap.mjs`: inserção local idempotente de linhas de catálogo (`ai_model_catalog`), sem pricing
  - CHECKPOINT 2 aprovado por humano (após correção do pricing) — nenhuma geração paga autorizada
affects: [48.2.2 planos 05-08, 48.2.3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist própria da bancada (`BENCH_MODEL_ALLOWLIST`) como autoridade de presets, independente do `MODEL_ALLOWLIST` produtivo (regressão garantida por teste negativo)"
    - "Habilitação de preset gated por `enabled` + validação contra allowlist própria E catálogo ativo em leitura (`ai_model_catalog` `status='active'`)"
    - "Pricing local puro e versionado, chaveado pelo preset completo (`provider+model+protocol+quality+size`), exclusivamente em código (sem tabela de pricing)"
    - "Estimativas de tokens de saída chaveadas por `model+quality+size` — nunca compartilhadas entre modelos; valores não comprovados ficam ausentes"
    - "Bootstrap local-only idempotente que adiciona apenas linhas de catálogo, com REVERT das linhas inseridas e nenhuma promoção ao remoto"

key-files:
  created:
    - src/lib/lab/bench/domain/bench-pricing.ts
    - src/lib/lab/bench/__tests__/bench-pricing.test.ts
  modified:
    - src/lib/lab/bench/domain/bench-model-allowlist.ts
    - src/lib/lab/bench/domain/preset-registry.ts
    - src/lib/lab/bench/__tests__/preset-registry.test.ts
    - scripts/lab/48-2-2-bench-bootstrap.mjs
    - docs/lab/48-2-2-spike-models.md

key-decisions:
  - "CHECKPOINT 2 APROVADO por humano: habilitados `gpt-image-2-low`, `gpt-image-2-medium`, `gpt-image-2.5-flare-low`, `gpt-image-2.5-flare-medium` (todos `protocol: images`); o protocolo `responses` permanece desabilitado (`protocolo_nao_confirmado`); nenhuma geração paga autorizada neste checkpoint"
  - "Flare mantido como `coverage: partial` (não promovido a `complete`) — só entram valores comprovados; Flare `medium` sem estimativa de saída (ausente de propósito)"
  - "Correção de pricing dirigida por humano (commit 02b0dbcc): estimativas de tokens de saída chaveadas por `model+quality+size`, nunca reaproveitadas entre modelos"
  - "Pricing vive exclusivamente em código (`bench-pricing.ts`), sem tabela de pricing no banco (D17); o bootstrap nunca persiste pricing"
  - "Bootstrap local inseriu apenas 2 linhas de catálogo (`inserted:2`) de forma idempotente; nada foi promovido ao remoto e nenhum `supabase db push` foi executado"

patterns-established:
  - "Preset habilitado = decisão do spike (CP1) + aprovação humana (CP2); constar na allowlist não habilita geração por si só"
  - "Custo da bancada nunca usa o pricing produtivo por `provider+model` como fonte; combinação ausente devolve `coverage: missing`"

requirements-completed: [lab-bench-config, lab-generation-bench]

# Metrics
duration: ~25min
completed: 2026-09-28
---

# Phase 48.2.2 Plan 04: Presets habilitados, pricing local e CHECKPOINT 2 Summary

**Registry final com os 4 presets confirmados pelo spike habilitados no caminho direto `images` (protocolo `responses` desabilitado), pricing local versionado `2026-09-bench-1` chaveado por `provider+model+protocol+quality+size` com estimativas por `model+quality+size`, bootstrap local idempotente (`inserted:2`), e CHECKPOINT 2 aprovado por humano sem autorizar nenhuma geração paga.**

## Performance

- **Duration:** ~25min (implementação das tasks + fechamento pós-checkpoint)
- **Started:** 2026-09-28T17:29:16Z (Task 1)
- **Completed:** 2026-09-28 (fechamento)
- **Tasks:** 3/3 (Task 3 = CHECKPOINT 2, aprovado)
- **Files modified:** 7 (2 criados, 5 modificados)

## Verificação (plan-level)

Comandos reexecutados no encerramento (modo sequencial, árvore principal):

- `npm run typecheck` → **exit 0** (`tsc -p tsconfig.typecheck.json --noEmit`).
- `npm test -- --run src/lib/lab/bench/__tests__/preset-registry.test.ts src/lib/lab/bench/__tests__/bench-pricing.test.ts` → **2 test files passed (2) / 22 tests passed (22)**, exit 0 (vitest v4.1.9) — 13 testes em `preset-registry.test.ts` e 9 em `bench-pricing.test.ts`.

> A verificação de `npx supabase db reset` + bootstrap idempotente (2×) foi executada durante a Task 2 e não foi reexecutada no fechamento (o bootstrap é local-only e já estava comprovadamente idempotente; a saída registrada é `inserted:2`).

## Accomplishments

- **Registry de presets final** (`preset-registry.ts`): os **4 presets do caminho direto `images`** ficam `enabled: true` — `gpt-image-2-low`, `gpt-image-2-medium`, `gpt-image-2.5-flare-low`, `gpt-image-2.5-flare-medium` — e os dois presets do caminho `responses` permanecem `enabled: false` com `reason: "protocolo_nao_confirmado"`. `resolveBenchPreset` recusa preset inexistente/desabilitado com `preset_not_enabled`.
- **Allowlist própria da bancada** (`bench-model-allowlist.ts`): `BENCH_MODEL_ALLOWLIST` lista `openai.gpt-image-2` e `openai.gpt-image-2.5-flare` no protocolo `images`; o `MODEL_ALLOWLIST` produtivo **não** é importado, intersectado nem alterado (teste negativo cobre `gpt-image-2.5-flare`, ausente da allowlist produtiva).
- **Pricing local versionado** (`bench-pricing.ts`): módulo puro, `BENCH_PRICING_RULE_VERSION = "2026-09-bench-1"`, chaveado pelo preset completo (`provider+model+protocol+quality+size`), modo `token_based` confirmado pelo spike, `low` ≠ `medium`. Nunca usa o pricing produtivo por `provider+model`; combinação ausente ⇒ `coverage: "missing"`. Pricing existe **exclusivamente em código** — sem tabela de pricing (D17).
- **Cobertura de pricing por preset:** `gpt-image-2` = `complete` (low 400 tokens / medium 3533 tokens, derivados da referência pública com taxa de saída US$15/M); `gpt-image-2.5-flare` = `partial` (Flare low = **196 tokens / ~US$0,00588** pelo calculador oficial; Flare medium **ausente** — sem valor comprovado; taxas publicadas preservadas: imagem entrada US$8/M, saída US$30/M).
- **Bootstrap local de catálogo** (`48-2-2-bench-bootstrap.mjs`): insere **apenas linhas de catálogo** (`ai_model_catalog`) necessárias à validação local, de forma idempotente (`ON CONFLICT DO NOTHING`; conteúdo igual ⇒ "nada a fazer"), com bloco REVERT das linhas inseridas, guarda local-only (`assertLocalHost`) antes de qualquer I/O e sem imprimir chaves/URLs. Resultado local: **`inserted:2`** (idempotente na segunda execução).
- **CHECKPOINT 2 aprovado por humano** (após a correção de pricing): lista final de presets habilitados aprovada e **nenhuma geração paga autorizada**.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Habilita presets confirmados pelo spike via BENCH_MODEL_ALLOWLIST** — `e1928770` (feat)
2. **Task 2: Pricing local por preset completo + bootstrap de catálogo local** — `fd447b64` (feat)
3. **Task 3: CHECKPOINT 2 — aprovação humana dos presets** — checkpoint humano (sem commit de código; correção pós-checkpoint abaixo)
4. **Correção pós-checkpoint (dirigida por humano): Chaveia estimativas por model+quality+size; Flare só com valor oficial** — `02b0dbcc` (fix)

**Plan metadata:** `[pending]` (docs: complete presets + pricing + CP2 plan)

## Files Created/Modified

- `src/lib/lab/bench/domain/bench-model-allowlist.ts` — `BENCH_MODEL_ALLOWLIST` (modificada) com os modelos confirmados no protocolo `images`; independente do `MODEL_ALLOWLIST` produtivo.
- `src/lib/lab/bench/domain/preset-registry.ts` — (modificada) 4 presets `enabled: true` + `responses` desabilitado com motivo; validação contra allowlist própria e catálogo ativo em leitura.
- `src/lib/lab/bench/domain/bench-pricing.ts` — (criada) pricing local puro/versionado, `resolveBenchPricing`, `BENCH_PRICING_ENTRIES`, estimativas por `model+quality+size`.
- `src/lib/lab/bench/__tests__/preset-registry.test.ts` — (modificada) 13 testes (preset confirmado aceito; desabilitado com motivo; fora da allowlist/catálogo; catálogo não mutado; teste negativo do Flare ausente da allowlist produtiva).
- `src/lib/lab/bench/__tests__/bench-pricing.test.ts` — (criada) 9 testes (`low`≠`medium`; `missing`; `ruleVersion` estável; Flare low com valor oficial; Flare medium ausente).
- `scripts/lab/48-2-2-bench-bootstrap.mjs` — (modificada) `BENCH_CATALOG_ROWS`/`insertBenchCatalogRows`/`revertBenchCatalogRows`; apenas linhas de catálogo, idempotente, sem pricing.
- `docs/lab/48-2-2-spike-models.md` — (modificada) referência por peça do Flare low (196 tokens / ~US$0,00588) e ausência do Flare medium.

## Decisions Made

- **Lista final aprovada no CHECKPOINT 2 (humano):**
  - **Habilitados (`enabled: true`, protocolo `images`):** `gpt-image-2-low`, `gpt-image-2-medium`, `gpt-image-2.5-flare-low`, `gpt-image-2.5-flare-medium`.
  - **Desabilitado:** caminho `responses` (`reason: protocolo_nao_confirmado`).
  - **Flare mantido como `coverage: partial`** (não promovido a `complete`).
  - **Nenhuma geração paga autorizada** neste checkpoint.
- **Correção de pricing dirigida por humano (commit `02b0dbcc`):** estimativas de tokens de saída passam a ser chaveadas por `model + quality + size` (antes compartilhadas entre modelos); `gpt-image-2` low/medium com 400/3533 tokens (derivado da referência pública); `gpt-image-2.5-flare` low com **196 tokens / ~US$0,00588** (calculador oficial); `gpt-image-2.5-flare` medium **ausente** (não reaproveita tokens do `gpt-image-2`); taxas publicadas do Flare preservadas (imagem entrada US$8/M, saída US$30/M).
- **Pricing somente em código:** o bootstrap **não** insere/persiste pricing; nenhuma tabela de pricing foi criada (D17).
- **Bootstrap local-only:** `inserted:2` em `ai_model_catalog` (somente local), idempotente; **nada promovido ao remoto** e **nenhum `supabase db push`** executado.

## Deviations from Plan

### Human-directed correction (pós-checkpoint)

**1. [Correção dirigida por humano — Rule 4, aprovada] Estimativas de tokens chaveadas por `model+quality+size`; Flare só com valor oficial**
- **Found during:** CHECKPOINT 2 (Task 3) — o humano exigiu correção do pricing antes de aprovar.
- **Issue:** as estimativas de tokens de saída estavam compartilhadas entre modelos por qualidade, o que inflava o custo estimado do `gpt-image-2.5-flare` (usava tokens do `gpt-image-2`) e não refletia o calculador oficial.
- **Fix:** estimativas passaram a ser chaveadas por `model + quality + size` e nunca reaproveitadas entre modelos; Flare low usa 196 tokens / ~US$0,00588 (calculador oficial); Flare medium fica **ausente** (sem valor comprovado); taxas publicadas do Flare preservadas; `coverage` do Flare permanece `partial`. O spike (`docs/lab/48-2-2-spike-models.md`) foi atualizado com a referência por peça do Flare low e a ausência do medium.
- **Files modified:** `src/lib/lab/bench/domain/bench-pricing.ts`, `src/lib/lab/bench/__tests__/bench-pricing.test.ts`, `docs/lab/48-2-2-spike-models.md`.
- **Verification:** `npm run typecheck` exit 0; 22/22 testes verdes; CHECKPOINT 2 aprovado após a correção.
- **Committed in:** `02b0dbcc`.

---

**Total deviations:** 1 (correção dirigida por humano, aprovada no CHECKPOINT 2 — Rule 4).
**Impact on plan:** Correção de correção do pricing, sem mudança de escopo. Nenhuma geração paga, nenhuma dependência nova e nenhum `supabase db push`.

## CHECKPOINT 2 — Resultado

- **Tipo:** `checkpoint:human-verify` (gate `blocking`).
- **Resultado:** **APROVADO** após a correção do pricing (commit `02b0dbcc`).
- **Lista final aprovada:** 4 presets habilitados via `images`; `responses` desabilitado; Flare `coverage: partial`.
- **Autorização de geração paga:** **nenhuma** — nenhuma geração paga foi autorizada nem executada neste plano.

## Declaração de custo

**Nenhuma chamada paga a provedor foi executada neste plano.** Nenhum `usage` real, nenhum run em `lab_bench_runs` e nenhuma geração de imagem. Nenhum crédito do lojista foi consumido. O bootstrap tocou **somente o Supabase local** e nada foi promovido ao remoto.

## Issues Encountered

- Nenhum problema bloqueante. O único ajuste foi a correção de pricing exigida pelo humano antes da aprovação do CHECKPOINT 2 (documentada acima como deviation).
- **Tracking (SDK parcialmente incompatível com o STATE.md compacto):** `roadmap.update-plan-progress 48.2.2` funcionou (atualizou o checklist do plano `48-2-2-04`; `summary_count: 4`) e um dos handlers atualizou `completed_plans` (297→298) + `last_updated` no frontmatter. Porém `state.update-progress` (`Progress field not found`), `state.advance-plan` (`Cannot parse Current Plan or Total Plans in Phase`), `state.record-metric` (erro de argumentos) e `state.record-session` (`No session fields found`) retornaram erro/skip. As seções de prosa do `STATE.md` (posição, decisões, sessão/continuidade) e as linhas-resumo do `ROADMAP.md` foram atualizadas **manualmente**; `requirements.mark-complete` não se aplica (sem REQ-IDs correspondentes).

## User Setup Required

None — nenhuma configuração de serviço externo. Os presets estão habilitados no registry, mas a geração efetiva depende do fluxo do plano 06 e do UAT autorizado (plano 08).

## Next Phase Readiness

- **Plano 05+** pode consumir `listBenchPresets`/`resolveBenchPreset` (4 presets `images` habilitados) e `resolveBenchPricing` (chaveado pelo preset completo) na estimativa e no fluxo de geração.
- `MODEL_ALLOWLIST` produtivo permanece intocado; nenhuma tabela de pricing existe; nenhuma promoção ao remoto.
- A pendência não bloqueante `account_availability_pending` (disponibilidade específica da conta) segue a comprovar no **UAT autorizado** (plano 08), sob autorização humana explícita.
- Tracking: `requirements.mark-complete` **não** aplicável (`.planning/REQUIREMENTS.md` é um índice operacional sem os REQ-IDs `lab-bench-config`/`lab-generation-bench`); os IDs foram registrados apenas no frontmatter deste SUMMARY.

---

*Phase: 48.2.2-fundacao-bancada-geracao*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Arquivos criados/modificados: `src/lib/lab/bench/domain/bench-pricing.ts`, `src/lib/lab/bench/__tests__/bench-pricing.test.ts`, `src/lib/lab/bench/domain/bench-model-allowlist.ts`, `src/lib/lab/bench/domain/preset-registry.ts`, `src/lib/lab/bench/__tests__/preset-registry.test.ts`, `scripts/lab/48-2-2-bench-bootstrap.mjs`, `docs/lab/48-2-2-spike-models.md` — todos FOUND.
- Commits verificados: `e1928770`, `fd447b64`, `02b0dbcc` — todos FOUND.
- Verificação: typecheck exit 0; 2 arquivos de teste / 22 testes verdes.
