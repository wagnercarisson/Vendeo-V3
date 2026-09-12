---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 01
subsystem: ai
tags: [ai-gateway, model-registry, ai-model-resolver, campaign-spec, migration, telemetry, trackings]

# Dependency graph
requires:
  - phase: 38.1-ai-cost-accounting
    provides: AiCallInfo/AiCostTracker/resolveAiCost (base de telemetria a ser unificada pela camada única)
  - phase: 37.2-correcao-unica-por-nao-conformidade
    provides: migration idempotente do CHECK chk_generation_events_type (padrão DROP/ADD + REVERT)
provides:
  - "src/lib/ai/model-resolver.ts — AiCapability (11) + interface assíncrona AiModelResolver (seam do Change B)"
  - "src/lib/ai/model-registry.ts — MODEL_REGISTRY (11 capacidades, defaults pré-F46) + MODEL_ALLOWLIST + CAPABILITY_PROTOCOLS + validação"
  - "Literal campaign_spec no CHECK chk_generation_events_type (aplicado no remoto) e em GenerationEventType"
  - "Baseline/inventário das 11 capacidades, dos 7 furos sem telemetria e das 14 envs de modelo/provider"
affects: [46-02, 46-03, 46-04, 46-05, 46-06, 46-07, 46-08, 46-09, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry por capacidade com protocol declarado em cada alvo (primary e fallback)"
    - "AiModelResolver assíncrono como seam de resolução (injeção por construtor no gateway)"
    - "Allowlist validada por capacidade + provider + modelo + protocolo (nunca só por segmento)"
    - "Migration idempotente DROP/ADD com bloco REVERT gated por ausência de evento"

key-files:
  created:
    - src/lib/ai/model-resolver.ts
    - src/lib/ai/model-registry.ts
    - src/lib/ai/__tests__/model-registry.test.ts
    - supabase/migrations/20260912000001_f46_generation_events_type.sql
  modified:
    - src/lib/visual-signature/types.ts

key-decisions:
  - "Registry por capacidade (não por segmento/serviço) com protocol no primary e no fallback — cada alvo independente"
  - "AiModelResolver assíncrono desde já (resolve(): Promise) para o resolver persistido da F47 decorar/substituir sem reabrir o gateway"
  - "campaign_copy.fallback = gemini/gemini-3.1-flash-lite/gemini é default inicial (configuração), não regra; serviço/gateway não conhecem provider específico"
  - "Validação fail-fast no carregamento: allowlist de modelo+protocolo, protocolo por capacidade e primary != fallback (mesmo provider+model)"
  - "Migration do CHECK aditiva/idempotente: 15 valores vigentes + campaign_spec; REVERT só antes de existir evento campaign_spec"

patterns-established:
  - "Registry como fonte única de modelo por capacidade; nenhum serviço lê env-var de modelo"
  - "Seam AiModelResolver injetável por construtor (prepara F47 sem reabrir o gateway)"

requirements-completed: [F46-01, F46-02, F46-03, F46-04, F46-05]
requirements: [F46-01, F46-02, F46-03, F46-04, F46-05]

# Metrics
duration: 6min
completed: 2026-09-12
---

# Phase 46 Plan 01: Trackings, Baseline e Registry de Modelos Summary

**Registry de modelos por capacidade (`MODEL_REGISTRY` + `MODEL_ALLOWLIST` + `ModelRegistry`) com seam assíncrono `AiModelResolver`, baseline factual das 11 capacidades/7 furos/14 envs, e literal `campaign_spec` aplicado no CHECK `chk_generation_events_type` do remoto.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-12T19:21:41Z
- **Completed:** 2026-09-12T19:27:54Z
- **Tasks:** 4 (Task 1 grep-verificação; Task 2 baseline/inventário; Task 3 registry+resolver+testes; Task 4 migration+TS+push)
- **Files modified:** 5 (4 criados + 1 modificado)

## Accomplishments

- **Trackings F46/F47/F44/Stripe verificados** nos 5 runbooks (`ROADMAP.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `AGENTS.md`): **zero resíduos de estado atual**; nenhuma nota histórica alterada; nenhuma edição necessária (grep-verificação pura).
- **Baseline factual registrado** neste SUMMARY: tabela das 11 capacidades (serviço/arquivo:linha → segmento → protocolo → adapter → default → env removida), os 7 furos/caminhos sem telemetria com evidência `file:line`, o inventário das 14 envs (28 leituras `process.env`) e a baseline de testes (264 arquivos / 2578 testes).
- **Registry + resolver criados** com defaults idênticos ao comportamento pré-F46: `src/lib/ai/model-resolver.ts` (tipos + interface assíncrona) e `src/lib/ai/model-registry.ts` (11 capacidades, allowlist por modelo+protocolo, protocolos por capacidade, validação fail-fast, `ModelRegistry implements AiModelResolver`).
- **18 testes unitários verdes** cobrindo resolução das 11 capacidades, `campaign_image`→`responses` × `campaign_image_edit`→`images`, default inicial de `campaign_copy`, visão com modelos distintos, allowlist, `primary != fallback`, `listCapabilities()` com 11 entradas e `resolve` retornando `Promise`.
- **[BLOCKING] Migration aplicada no remoto**: `20260912000001_f46_generation_events_type` adiciona `campaign_spec` ao CHECK preservando os 15 valores vigentes; `GenerationEventType` (TS) recebe o literal; `supabase migration list` confirma local=remote e o dry-run subsequente reporta "Remote database is up to date."

## Task Commits

Cada task foi commitada atomicamente (Tasks 1 e 2 não produziram alteração de código/arquivo própria — ver Nota abaixo):

1. **Task 1: Grep-verificação de trackings** — sem commit (nenhum arquivo alterado; grep confirmou zero resíduos)
2. **Task 2: Inventário/baseline** — sem commit próprio (conteúdo consolidado neste SUMMARY; nenhuma linha de código alterada)
3. **Task 3: model-resolver.ts + model-registry.ts + testes** — `94c4cc52` (feat)
4. **Task 4: migration CHECK + GenerationEventType + push** — `874a7f0b` (feat)

**Plan metadata:** `_pendente_` (docs: complete 46-01 plan — SUMMARY + STATE/ROADMAP)

_Nota: as Tasks 1 e 2 são de verificação/inventário (por desenho do plano, sem edição de código). O artefato da Task 2 é este SUMMARY, commitado em bloco atômico com a metadata do plano._

## Files Created/Modified

- `src/lib/ai/model-resolver.ts` — `AiCapability` (11), `AiProtocol`, `AiSegment`, `AiModelTarget`, `AiModelConfig` e interface assíncrona `AiModelResolver` (`resolve(): Promise` + `listCapabilities()`).
- `src/lib/ai/model-registry.ts` — `MODEL_REGISTRY` (11 capacidades; `protocol` no primary e no fallback), `MODEL_ALLOWLIST` (modelo→protocolos), `CAPABILITY_PROTOCOLS` (capacidade→protocolos), `validateModelConfig` (fail-fast) e `ModelRegistry implements AiModelResolver` (`async resolve`).
- `src/lib/ai/__tests__/model-registry.test.ts` — 18 testes unitários do registry/resolver/allowlist.
- `supabase/migrations/20260912000001_f46_generation_events_type.sql` — extensão idempotente do CHECK `chk_generation_events_type` (15 → 16 valores) + bloco `-- REVERT` documentado.
- `src/lib/visual-signature/types.ts` — literal `'campaign_spec'` adicionado ao union `GenerationEventType` (aditivo/retrocompatível).

## Trackings — Resultado da Grep-verificação (Task 1 / F46-01)

**Padrões de resíduo de estado atual verificados** (devem ser zero): `F46 = Stripe`, `Phase 46 (Stripe`, `fase-46-stripe`, `| 44 |`, `Phase 44 (`, `F47 = Gateway`, `fase-47-gateway`.

| Arquivo | Resultado | Evidência positiva |
|---|---|---|
| `ROADMAP.md` (raiz) | ✅ zero resíduos | `\| 46. Gateway Único de IA e Registry de Modelos \| v1.5 \| 0/9 \| Planning \|` (linha 269) + `\| -. Monetização pública / Stripe (diferida, v1.7+) \| v1.7 \| - \| Fora da numeração \|` (linha 270) |
| `.planning/ROADMAP.md` | ✅ zero resíduos | `### Phase 46: Gateway Único de IA e Registry de Modelos` (linha 967); nota "Phase numbering" com `F46 = Gateway Único... (v1.5, Change A)` e `F47 = Catálogo e Seleção de Modelos Admin (v1.5, Change B - sucessora da F46)`; `F44 = Temas de Campanha permanece fora da numeração` |
| `.planning/STATE.md` | ✅ zero resíduos | frontmatter `current_phase: 46` (linha 5); `### Phase 46 — Gateway Único de IA e Registry de Modelos ◆ Em planejamento (0/9 plans / 9 waves)` (linha 23) |
| `.planning/PROJECT.md` | ✅ zero resíduos | sem resíduo; F44/Stripe tratados como fora da numeração |
| `AGENTS.md` | ✅ zero resíduos | `## Phase 46 — Gateway Único de IA e Registry de Modelos` (linha 207) com `9 plans previstos (46-01..46-09, 9 waves)` (linha 209) |

**Saída do comando:** `OK: zero residuos de nomenclatura no estado atual`.
**Nenhuma edição** foi necessária; notas históricas de fases concluídas (F40–F43) permanecem intocadas. **Numeração final:** F46 = Gateway (Change A), F47 = Catálogo/Seleção Admin (Change B), F44 fora da numeração, Stripe diferido v1.7+.

## Inventário das 11 Capacidades (Task 2 / F46-02)

| Capacidade | Serviço(s) / arquivo:linha | Segmento | Protocolo | Adapter | Default atual (provider/model) | Env removida |
|---|---|---|---|---|---|---|
| `campaign_copy` | `copy/copy-director-service.ts:51-58` + `text-provider/openai.ts:6` + `text-provider/gemini.ts:12` + `text-provider/factory.ts:7` | text | `chat-completions` (fallback `gemini`) | `chat-completions` / `gemini` | openai/`gpt-4o` (fallback gemini/`gemini-3.1-flash-lite`) | `OPENAI_TEXT_MODEL` |
| `campaign_correction_analysis` | `campaign/correction-intent-service.ts:158-160` | text | `chat-completions` | `chat-completions` | openai/`gpt-4o` | — |
| `brand_profile_text` | `brand-assets/text-only-inference-service.ts:57,110,133,167,178` | text | `chat-completions` | `chat-completions` | openai/`gpt-4o` | `OPENAI_TEXT_ONLY_INFERENCE_MODEL` |
| `campaign_spec` (legado) | `campaign-intelligence/providers/openai.ts:27` | text | `chat-completions` | `chat-completions` | openai/`gpt-4o-mini` | `OPENAI_MODEL` |
| `campaign_input_validation` | `image-generation/services/input-validation-service.ts:29` | vision | `chat-completions` | `chat-completions` | openai/`gpt-4o` | `VISION_REVIEW_MODEL` |
| `campaign_image_review` | `image-generation/services/image-review-service.ts:42` | vision | `chat-completions` | `chat-completions` | openai/`gpt-4o` | `VISION_REVIEW_MODEL` |
| `brand_profile_vision` | `visual-signature/brand-profiler.ts:279,294,609,707,739` + `brand-assets/brand-director.ts:345,368` | vision | `chat-completions` | `chat-completions` | openai/`gpt-4o` | `OPENAI_BRAND_DIRECTOR_MODEL` |
| `visual_signature_validation` | `visual-signature/ai-image-generator.ts:68` + `app/api/store/[id]/visual-signature/generate-without-logo/route.ts:336` | vision | `responses` | `responses` | openai/`gpt-4o-mini` | `IMAGE_VALIDATION_MODEL` |
| `campaign_image` | `image-generation/providers/openai.ts:50` | image | `responses` (tool `image_generation`) | `responses` | openai/`gpt-5.5` | `IMAGE_GENERATION_RESPONSES_MODEL` |
| `campaign_image_edit` | `image-generation/providers/openai.ts:51` (`fallbackToImageApi` :255-371) | image | `images` (`images.edit`) | `images` | openai/`gpt-image-2` | `IMAGE_EDIT_FALLBACK_MODEL`, `GPT_IMAGE_MODEL` |
| `visual_signature_image` | `visual-signature/ai-image-generator.ts:216` + `visual-signature/server-actions.ts:65` | image | `responses` (tool `image_generation`) | `responses` | openai/`gpt-5.5` | `IMAGE_GENERATION_RESPONSES_MODEL` |

> O registry criado na Task 3 codifica exatamente estes defaults (ver `MODEL_REGISTRY`). `campaign_image` e `campaign_image_edit` compartilham o segmento `image` com protocolos distintos; `campaign_image_review` (gpt-4o) e `visual_signature_validation` (gpt-4o-mini) mantêm modelos de visão distintos.

## Baseline dos 7 Furos / Caminhos sem Telemetria (Task 2)

| # | Furo / caminho | Evidência `file:line` | Descrição |
|---|---|---|---|
| 1 | Modelo errado em validation/review | `image-generation/services/image-generation-service.ts:135-142` | `emitMetricsEvent` hardcoda `IMAGE_GENERATION_RESPONSES_MODEL` (gpt-5.5, imagem) para as fases de validação/revisão de visão (gpt-4o) |
| 2 | `onCall` ausente (sem custo/latência) | `app/api/store/[id]/logo/route.ts:254` + `app/api/store/[id]/logo/retry-brand-director/route.ts:111` | `director.analyze({...})` sem `onCall` (0 ocorrências de `onCall` em cada arquivo) |
| 3 | Fallback `images.edit` sem tokens/usage | `image-generation/providers/openai.ts:255-371` (`fallbackToImageApi`) | `images.edit` retorna `{ imageBase64, mimeType, model }` sem `usage` (não normaliza `not_available` + duração + custo por unidade) |
| 4 | VS image sem o componente da tool | `visual-signature/ai-image-generator.ts:249-254` + `ai-cost/cost-estimator.ts:194` | Componente da tool aplicado apenas quando `generationType === "campaign_image"`; `visual_signature_image` não soma (ancorado por `cost-estimator.test.ts:332`) |
| 5 | `AiImageGenerator.generate` sem `onCall` | `visual-signature/server-actions.ts:136,152,233,285` | `aiGenerator.generate({...})` sem `onCall` (`generateVariations`/`generateAutomatic`; 0 ocorrências de `onCall` no arquivo) |
| 6 | `profiler.generate()` sem `onCall` (2 call sites) | `app/api/store/[id]/visual-signature/approve/route.ts:197,589` | `profiler.generate({...})` sem `onCall` |
| 7 | `profiler.generate()` sem `onCall` | `app/api/store/[id]/visual-signature/restore/route.ts:158` | `profiler.generate({...})` sem `onCall` |

## Inventário das 14 Envs de Modelo/Provider (Task 2 / D8)

**28 leituras `process.env` (26 runtime + 2 em teste).** Ficam apenas as chaves + operacionais.

| Env removida | Leituras (`file:line`) |
|---|---|
| `OPENAI_MODEL` | `campaign-intelligence/providers/openai.ts:27` |
| `OPENAI_TEXT_MODEL` | `text-provider/openai.ts:6` |
| `OPENAI_BRAND_DIRECTOR_MODEL` | `brand-assets/brand-director.ts:345,368`; `visual-signature/brand-profiler.ts:279,294,609,707,739` |
| `OPENAI_TEXT_ONLY_INFERENCE_MODEL` | `brand-assets/text-only-inference-service.ts:57,110,133,167,178` |
| `IMAGE_GENERATION_RESPONSES_MODEL` | `image-generation/config.ts:4`; `visual-signature/ai-image-generator.ts:216`; `visual-signature/server-actions.ts:65` |
| `GPT_IMAGE_MODEL` | `image-generation/config.ts:9` |
| `IMAGE_EDIT_FALLBACK_MODEL` | `image-generation/config.ts:13` |
| `VISION_REVIEW_MODEL` | `image-generation/config.ts:17` |
| `IMAGE_VALIDATION_MODEL` | `visual-signature/ai-image-generator.ts:68`; `app/api/store/[id]/visual-signature/generate-without-logo/route.ts:336` |
| `IMAGE_PROVIDER` | `image-generation/config.ts:39` |
| `TEXT_PROVIDER` | `text-provider/factory.ts:7` |
| `TEXT_FALLBACK_PROVIDER` | `text-provider/factory.ts:7`; `app/api/campaign/generate-image/route.ts:684`; teste `app/api/campaign/generate-image/__tests__/route.test.ts:929,960` |
| `GEMINI_TEXT_MODEL` | `text-provider/gemini.ts:12` |
| `GEMINI_MODEL` | `text-provider/gemini.ts:12` |

**Ficam (chaves):** `OPENAI_API_KEY`, `GEMINI_API_KEY`.
**Ficam (operacionais):** `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`, `IMAGE_GENERATION_QUALITY`, `IMAGE_GENERATION_DEBUG`, `METRICS_ENABLED`, `VENDEO_AI_FALLBACK_COST_USD`/`VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD`, `VENDEO_AI_CREDIT_UNIT_USD_VALUE`.
**`.env.example`:** `OPENAI_MODEL` (:10), `IMAGE_PROVIDER` (:15), `IMAGE_GENERATION_RESPONSES_MODEL` (:19), `VISION_REVIEW_MODEL` (:23), `TEXT_FALLBACK_PROVIDER` (:34), `GEMINI_TEXT_MODEL` (:36) — co-migração no 46-07.

## Baseline de Testes a Co-migrar (Task 2)

- **Baseline pré-F46:** `264 arquivos / 2578 testes` passando (`npx vitest run`, 2026-09-12).
- **Referências a `IMAGE_GENERATION_RESPONSES_MODEL` (fixtures/objeto mock, não `process.env`):** `app/api/campaign/generate-image/__tests__/route.test.ts:51`; `src/__tests__/regression-master-switch.test.ts:48`; `src/__tests__/concurrency.test.ts:48`; `src/__tests__/api/campaign-generate.test.ts:164`.
- **Referências a `TEXT_FALLBACK_PROVIDER`:** `app/api/campaign/generate-image/__tests__/route.test.ts:929,960`.
- **Âncora anti-dupla VS:** `ai-cost/__tests__/cost-estimator.test.ts:332` (garante que `visual_signature` **não** soma o componente da tool; a F46 estende a fórmula a `visual_signature_image` e co-migra este teste).
- **Suites irmãs sem co-migração (regressão de não-mudança):** rota/schema/snapshot/domínio/UI/form/prompts.

## Decisions Made

- **Registry por capacidade** (não por segmento/serviço) com `protocol` obrigatório no primary **e** no fallback — cada alvo é independente.
- **`AiModelResolver` assíncrono desde já** (`resolve(): Promise`) para o `PersistedModelResolver` da F47 decorar/substituir sem reabrir o gateway.
- **`campaign_copy.fallback` = `{ gemini, gemini-3.1-flash-lite, gemini }`** como default inicial (configuração, não regra).
- **Validação fail-fast no carregamento**: allowlist por modelo+protocolo, protocolo por capacidade e `primary != fallback` (mesmo provider+model).
- **Migration aditiva/idempotente**: 15 valores preservados + `campaign_spec`; `REVERT` só antes de existir evento `campaign_spec`.

## Deviations from Plan

**None - plan executed exactly as written.**

As Tasks 1 e 2 são de verificação/inventário por desenho e não alteraram código; o artefato da Task 2 é este SUMMARY, commitado em bloco atômico com a metadata do plano (Tasks 3/4 têm commits próprios).

## Issues Encountered

- **Mensagem do dry-run do Supabase CLI:** o critério de aceitação da Task 4 espera a string `"No new migrations"`, mas a versão instalada (v2.104.0) reporta `"Remote database is up to date."` — semanticamente equivalente (zero migrations pendentes). Verificado também por `supabase migration list` (`20260912000001` presente em Local **e** Remote). Sem impacto funcional; registrado para o verificador.
- Nenhum outro problema.

## Migration Status ([BLOCKING] Task 4)

- `npx supabase db push --dry-run` (antes): listou **apenas** `20260912000001_f46_generation_events_type.sql`.
- `npx supabase db push --yes`: aplicada com sucesso no projeto `gvbzwihwgzujwsviufgy`.
- `npx supabase migration list`: `20260912000001 | 20260912000001` (Local = Remote).
- `npx supabase db push --dry-run` (depois): `Remote database is up to date.` (equivalente a "No new migrations").

## Gate Results

| Gate | Resultado |
|---|---|
| `npx vitest run src/lib/ai/__tests__/model-registry.test.ts` | ✅ PASS — 1 arquivo / 18 testes |
| `npm run typecheck` | ✅ PASS — 0 erros |
| `npm run lint` | ✅ PASS — 0 erros |
| `npm run build` | ✅ PASS — `check:cnae` + `next build` concluídos |
| Grep de resíduos F46/F47/F44/Stripe nos 5 runbooks | ✅ PASS — zero resíduos de estado atual |
| `npx supabase db push --dry-run` | ✅ PASS — "Remote database is up to date." |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **46-02 pronto para iniciar:** o seam `AiModelResolver` + `ModelRegistry` + allowlist estão prontos para o gateway/adapters/telemetria consumirem por construtor.
- **46-03/46-04/46-05/46-07** têm a baseline factual (11 capacidades, 7 furos, 14 envs, testes) neste SUMMARY como entrada de co-migração.
- **`campaign_spec` liberado** no CHECK do remoto e no tipo TS — desbloqueia a migração do legado `campaign-intelligence` (46-03).
- Sem blockers.

## Self-Check: PASSED

- [x] `src/lib/ai/model-resolver.ts` existe
- [x] `src/lib/ai/model-registry.ts` existe
- [x] `src/lib/ai/__tests__/model-registry.test.ts` existe
- [x] `supabase/migrations/20260912000001_f46_generation_events_type.sql` existe
- [x] `src/lib/visual-signature/types.ts` contém `campaign_spec`
- [x] Commits `94c4cc52` e `874a7f0b` existem (`git log`)
- [x] Testes do registry verdes (18/18); typecheck/lint/build verdes
- [x] Migration `20260912000001` aplicada no remoto (Local = Remote)

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-12*
