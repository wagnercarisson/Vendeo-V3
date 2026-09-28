---
phase: 48.2.2
plan: 48-2-2-01
subsystem: lab-bench
tags: [nextjs, typescript, zod, vitest, supabase, lab, bench, openai, gpt-image, isolation]

# Dependency graph
requires:
  - phase: 48.2.1
    provides: detector de isolamento local-only (`forbiddenProductionAccess`/`wrapReadOnlyTable`), gates arquiteturais do laboratório e precedente de artefato de decisão em `docs/lab/`
provides:
  - Bounded context `src/lib/lab/bench/**` (herda os gates arquiteturais de `src/lib/lab/**`)
  - Schemas Zod puros do domínio da bancada, com `draft` como estado inicial do run
  - Registry de dimensões validado em código (primeiro recorte habilitado; demais desabilitados com motivo; sem CHECK de banco)
  - Allowlist própria `BENCH_MODEL_ALLOWLIST` (autoridade dos presets; `MODEL_ALLOWLIST` produtivo intocado)
  - Registry de presets com quatro candidatos, todos desabilitados até o CHECKPOINT 2
  - Contratos de isolamento estendidos (leitura somente-leitura de lojas/branding local + buckets `store-logos`/`store-brand-assets`/`visual-signatures`)
  - Artefato de decisão do spike `docs/lab/48-2-2-spike-models.md` (CHECKPOINT 1 aprovado)
  - Base SHA da fase registrado em `48-2-2-VERIFICATION.md`
affects: [48.2.2 planos 02-08, 48.2.3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded context sob `src/lib/lab/bench/**` para herdar os gates de `architecture-guard.test.ts`"
    - "Allowlist própria da bancada (`BENCH_MODEL_ALLOWLIST`) desacoplada da allowlist produtiva (regressão provada por teste negativo)"
    - "Registry de dimensões como autoridade de configuração (sem CHECK/enum de banco)"
    - "`READ_ONLY_BUCKETS` + `wrapReadOnlyBucket` espelhando `wrapReadOnlyTable` (somente `createSignedUrl`)"
    - "Artefato de spike versionado em `docs/lab/` como evidência de checkpoint humano"

key-files:
  created:
    - src/lib/lab/bench/domain/schemas.ts
    - src/lib/lab/bench/domain/config-registry.ts
    - src/lib/lab/bench/domain/bench-model-allowlist.ts
    - src/lib/lab/bench/domain/preset-registry.ts
    - src/lib/lab/bench/__tests__/config-registry.test.ts
    - src/lib/lab/bench/__tests__/preset-registry.test.ts
    - docs/lab/48-2-2-spike-models.md
    - .planning/phases/48.2.2-fundacao-bancada-geracao/48-2-2-VERIFICATION.md
  modified:
    - src/lib/lab/__tests__/lab-isolation.contract.test.ts
    - src/lib/ai/__tests__/architecture-guard.test.ts

key-decisions:
  - "gpt-image-2 confirmado (documentação oficial + repositório src/lib/ai/model-registry.ts:34)"
  - "gpt-image-2.5-flare confirmado pela documentação oficial (ID válido; texto e imagens; POST /v1/images/edits; qualidades low/medium/high/xhigh/max/auto; pricing público)"
  - "Quatro presets propostos (gpt-image-2-low, gpt-image-2-medium, gpt-image-2.5-flare-low, gpt-image-2.5-flare-medium); todos permanecem desabilitados (reason: spike_pendente) até o CHECKPOINT 2 (plano 04)"
  - "Disponibilidade da conta registrada como account_availability_pending, a comprovar no UAT autorizado (plano 08)"
  - "Nenhuma chamada paga executada nem autorizada neste plano"
  - "BENCH_MODEL_ALLOWLIST é a autoridade dos presets; MODEL_ALLOWLIST produtivo permanece intocado"
  - "Registry de dimensões é a autoridade de configuração; nenhum CHECK/enum de banco"
  - "F48.2.2 antiga (Revisor) permanece descartada/substituída, sem change ativa no OpenSpec"

patterns-established:
  - "Isolamento aditivo: leitura somente-leitura de lojas/branding local sem afrouxar a proibição de produção"
  - "Presets experimentais isolados por allowlist própria, sem tocar a produção"

requirements-completed: [lab-isolation, lab-bench-config, lab-generation-bench]

# Metrics
duration: ~35min
completed: 2026-09-28
---

# Phase 48.2.2 Plan 01: Fundação da bancada — bounded context, isolamento read-only e spike bloqueante (CHECKPOINT 1) Summary

**Bounded context `src/lib/lab/bench/**` com schemas puros (`draft` como estado inicial), registry de dimensões do primeiro recorte, allowlist própria `BENCH_MODEL_ALLOWLIST`, registry de presets (4 candidatos, todos desabilitados) e contratos de isolamento somente-leitura — com o spike de modelos/presets aprovado no CHECKPOINT 1 e nenhuma chamada paga executada.**

## Performance

- **Duration:** ~35min (execução das Tasks 1–2 + correção pós-checkpoint + fechamento)
- **Started:** 2026-09-28T19:31:18Z (Task 1)
- **Completed:** 2026-09-28T19:48:47Z (correção do spike) + fechamento
- **Tasks:** 3/3 (Task 3 = checkpoint humano aprovado)
- **Files modified:** 10 (8 criados, 2 modificados)

## Verificação (plan-level)

Comandos reexecutados no encerramento (modo sequencial, árvore principal):

- `npm run typecheck` → **exit 0** (`tsc -p tsconfig.typecheck.json --noEmit`).
- `npm test -- --run src/lib/lab/bench/__tests__/config-registry.test.ts src/lib/lab/bench/__tests__/preset-registry.test.ts src/lib/lab/__tests__/lab-isolation.contract.test.ts src/lib/ai/__tests__/architecture-guard.test.ts` → **4 test files passed (4) / 48 tests passed (48)**, exit 0 (vitest v4.1.9).
- Base SHA registrado em `48-2-2-VERIFICATION.md`: `50ae600792158b781b7ac3fb5f61004b17a96dd2`.

## Accomplishments

- **Bounded context criado:** `src/lib/lab/bench/**` (schemas + registry de dimensões), herdando os gates arquiteturais do laboratório via `architecture-guard.test.ts`.
- **Isolamento read-only provado por testes negativos:** leitura somente-leitura de `stores`/`store_brand_profiles`/`store_brand_assets`/`store_visual_signatures` e dos buckets `store-logos`/`store-brand-assets`/`visual-signatures` (`READ_ONLY_BUCKETS` + `wrapReadOnlyBucket`); `campaign-images`, lojas remotas e tabelas de produção permanecem proibidos.
- **Allowlist própria da bancada:** `BENCH_MODEL_ALLOWLIST` como autoridade dos presets; teste negativo comprova que habilitar um modelo ausente do `MODEL_ALLOWLIST` produtivo não toca a produção.
- **Registry de presets:** quatro candidatos do caminho direto `images`, todos `enabled: false` com `reason: "spike_pendente"` até o CHECKPOINT 2.
- **Spike bloqueante (CHECKPOINT 1) produzido e aprovado:** `docs/lab/48-2-2-spike-models.md` com ID/protocolo/qualidades/tamanho/limites/disponibilidade/usage/pricing por candidato e fonte da evidência; **sem nenhuma chamada paga** e sem segredos.
- **F48.2.2 antiga (Revisor) confirmada como descartada/substituída**, sem change ativa no OpenSpec.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Bounded context da bancada, registry de dimensões e isolamento read-only** — `a0e7832e` (feat)
2. **Task 2: Registry de presets, allowlist própria e artefato do spike** — `77ef5330` (feat)
3. **Task 3: CHECKPOINT 1 (aprovação humana)** — sem commit de código; decisão humana registrada neste SUMMARY e no artefato do spike
4. **Correção pós-checkpoint do spike** — `d77d40ca` (docs)

**Plan metadata:** `[pending]` (docs: complete bounded context + CP1 spike plan)

## Files Created/Modified

- `src/lib/lab/bench/domain/schemas.ts` — Schemas Zod puros do domínio da bancada (run input, config por dimensões, branding) e `BenchRunStatusSchema` com `draft` inicial.
- `src/lib/lab/bench/domain/config-registry.ts` — Registry de dimensões (primeiro recorte habilitado; demais `enabled:false` com motivo); `resolveBenchConfig` lança `config_registry_unknown_value`; `DEFAULT_BENCH_CONFIG`.
- `src/lib/lab/bench/domain/bench-model-allowlist.ts` — `BENCH_MODEL_ALLOWLIST` (autoridade própria da bancada) e `assertBenchTargetAllowed`; independente do `MODEL_ALLOWLIST` produtivo.
- `src/lib/lab/bench/domain/preset-registry.ts` — Quatro presets do caminho direto `images` (todos `enabled:false`/`spike_pendente`); `listBenchPresets`/`resolveBenchPreset` (`preset_not_enabled`); validação contra `BENCH_MODEL_ALLOWLIST` e catálogo ativo (leitura).
- `src/lib/lab/bench/__tests__/config-registry.test.ts` — Testes do registry de dimensões (recusa de valor desconhecido; primeiro recorte).
- `src/lib/lab/bench/__tests__/preset-registry.test.ts` — Testes de presets, incluindo o negativo que aceita `gpt-image-2.5-flare` via `BENCH_MODEL_ALLOWLIST` e prova o `MODEL_ALLOWLIST` produtivo inalterado.
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` (modificado) — `READ_ONLY_TABLES` estendido, `READ_ONLY_BUCKETS` + `wrapReadOnlyBucket`, `lab_bench_runs`/`lab_bench_artifacts` e self-tests negativos (`campaign-images`, tabelas de produção).
- `src/lib/ai/__tests__/architecture-guard.test.ts` (modificado) — Subconjunto `src/lib/lab/bench/**` coberto pelas asserções do laboratório, sem afrouxar regras.
- `docs/lab/48-2-2-spike-models.md` — Artefato de decisão do CHECKPOINT 1 (tabelas por candidato, pricing público e seção "Decisão").
- `.planning/phases/48.2.2-fundacao-bancada-geracao/48-2-2-VERIFICATION.md` — Base SHA da fase capturado no início da execução.

## Decisões (CHECKPOINT 1 — aprovado após correção)

- `gpt-image-2`: **confirmado** (documentação oficial + repositório `src/lib/ai/model-registry.ts:34`).
- `gpt-image-2.5-flare`: **confirmado pela documentação oficial** — ID válido; aceita texto e imagens; suporta `POST /v1/images/edits`; utilizável diretamente pela Image API; qualidades `low`/`medium`/`high`/`xhigh`/`max`/`auto`; pricing público publicado. A ausência no `MODEL_ALLOWLIST` produtivo **não** é impedimento (a `BENCH_MODEL_ALLOWLIST` isola modelos experimentais).
- **Quatro presets propostos** para o primeiro recorte: `gpt-image-2-low`, `gpt-image-2-medium`, `gpt-image-2.5-flare-low`, `gpt-image-2.5-flare-medium`.
- **Todos permanecem desabilitados** (`reason: "spike_pendente"`) até a aprovação do **CHECKPOINT 2** (plano 04). **Nenhum preset habilitado.**
- **Disponibilidade da conta:** `account_availability_pending` — a comprovar no **UAT autorizado** (plano 08).
- **Nenhuma chamada paga** executada nem autorizada neste plano.
- Pricing público registrado em `docs/lab/48-2-2-spike-models.md` (consulta em 2026-09-28).

## Nenhuma chamada paga

**Nenhuma chamada paga ao provider foi executada** em nenhuma task deste plano (Tasks 1–2, correção do spike ou fechamento). Toda a evidência do spike vem de documentação oficial (URL) ou do repositório (`file:line`); nenhum `usage` real aparece no artefato e nenhum preset foi habilitado.

## F48.2.2 antiga (Revisor)

A F48.2.2 antiga (**Auditoria e Otimização do Prompt do Revisor**) permanece **descartada/substituída**, sem implementação iniciada e sem artefatos mantidos (recuperável pelo histórico do Git). A change antiga **não** aparece como change ativa do OpenSpec. Nenhum artefato novo foi criado para a fase antiga.

## Base SHA

`Base SHA: 50ae600792158b781b7ac3fb5f61004b17a96dd2` (capturado no início da execução e registrado em `48-2-2-VERIFICATION.md`; referência para o encerramento do plano 08 comparar `base..HEAD`).

## Deviations from Plan

### Correção dirigida por humano (pós-checkpoint)

**1. [Correção humana no CHECKPOINT 1] Decisão do spike corrigida: `gpt-image-2.5-flare` passou de "não confirmado" para "confirmado pela documentação"**
- **Encontrado durante:** Task 3 (CHECKPOINT 1 — revisão humana do spike).
- **Issue:** A primeira versão do artefato (`77ef5330`) marcava `gpt-image-2.5-flare` como **não confirmado** por ausência no código produtivo; a revisão humana identificou que a documentação oficial confirma o contrato público do modelo (ID válido, texto+imagens, `POST /v1/images/edits`, qualidades `low`/`medium`/`high`/`xhigh`/`max`/`auto`, pricing público) e que a ausência no `MODEL_ALLOWLIST` produtivo não é impedimento (a `BENCH_MODEL_ALLOWLIST` isola modelos experimentais).
- **Fix:** Correção do artefato para `confirmado (pela documentação)`, com pricing público publicado e registro de `account_availability_pending` para a disponibilidade da conta (a comprovar no UAT autorizado). A proposta dos quatro presets e o estado "todos desabilitados até o CHECKPOINT 2" foram preservados.
- **Files modified:** `docs/lab/48-2-2-spike-models.md`
- **Verification:** Documento revisado e aprovado por humano no CHECKPOINT 1; nenhuma chamada paga executada.
- **Committed in:** `d77d40ca` (correção dirigida por humano — **não** é auto-fix das Rules 1–3).

---

**Total deviations:** 1 (correção dirigida por humano no checkpoint; nenhum auto-fix das Rules 1–3).
**Impact on plan:** Nenhum impacto de escopo — a correção alinhou o artefato à documentação oficial e manteve os presets desabilitados até o CHECKPOINT 2; nenhuma geração paga habilitada.

## Issues Encountered

None — as Tasks 1–2 executaram conforme o plano; o único desvio foi a correção dirigida por humano no artefato do spike (documentada acima).

## User Setup Required

None — nenhuma configuração de serviço externo necessária neste plano. A disponibilidade da conta OpenAI (`account_availability_pending`) será comprovada no **UAT autorizado** (plano 08), sob autorização humana explícita.

## Next Phase Readiness

- Bounded context, contratos de isolamento, registry de dimensões, allowlist própria e registry de presets prontos para os planos 02–08.
- CHECKPOINT 1 aprovado; **CHECKPOINT 2** (plano 04) é o próximo gate humano — habilitação efetiva dos quatro presets propostos antes de qualquer geração paga.
- Nenhum preset habilitado; nenhuma chamada paga executada. `account_availability_pending` a resolver no UAT (plano 08).
- Tracking: `requirements.mark-complete` **não** executado — `.planning/REQUIREMENTS.md` é um índice operacional sem REQ-IDs ativos (`lab-isolation`/`lab-bench-config`/`lab-generation-bench` não constam nele); os IDs foram registrados apenas no frontmatter deste SUMMARY.

---
*Phase: 48.2.2-fundacao-bancada-geracao*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Arquivos criados/verificados: `48-2-2-01-SUMMARY.md`, `src/lib/lab/bench/domain/schemas.ts`, `src/lib/lab/bench/domain/config-registry.ts`, `src/lib/lab/bench/domain/bench-model-allowlist.ts`, `src/lib/lab/bench/domain/preset-registry.ts`, `src/lib/lab/bench/__tests__/config-registry.test.ts`, `src/lib/lab/bench/__tests__/preset-registry.test.ts`, `docs/lab/48-2-2-spike-models.md`, `48-2-2-VERIFICATION.md` — todos FOUND.
- Commits verificados: `a0e7832e`, `77ef5330`, `d77d40ca` — todos FOUND.
- Verificação: typecheck exit 0; 4 arquivos de teste / 48 testes verdes.
