---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 08
subsystem: ai
tags: [regression, behavior-preserving, defaults-equivalence, external-contract, prompts-no-drift, gates]

# Dependency graph
requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: registry de modelos por capacidade + gateway + adapters + telemetria (46-01..46-05)
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: gate global de arquitetura + inventário de telemetria (46-06)
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: runtime e `.env.example` sem as 14 env-vars de modelo/provider (46-07)
provides:
  - "Regressão completa verde: 275 arquivos / 2720 testes, 0 falhas (nenhum resíduo de fixture/asserção a corrigir)"
  - "Não-mudança do contrato externo comprovada por git diff (UI/form/schema público/snapshot/domínio/prompts intactos)"
  - "Equivalência de defaults registry × comportamento pré-F46 demonstrada para as 11 capacidades (zero divergência)"
  - "Ausência de drift nos prompts (`git diff 3e2d7ff1 HEAD -- 'prompts/*.md'` vazio)"
affects: [46-09, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fechamento behavior-preserving: regressão total + não-mudança por git diff + tabela de equivalência de defaults"

key-files:
  created:
    - .planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-08-SUMMARY.md
  modified: []

key-decisions:
  - "Nenhum resíduo de fixture/asserção a corrigir: a suíte completa já estava verde no estado herdado do 46-07 (275/2720)"
  - "`GenerationEventType` (src/lib/visual-signature/types.ts) é a única alteração adjacente a 'domínio' na fase e é aditiva/telemetria (literal campaign_spec), prevista na migration do 46-01 — não é mudança de superfície de domínio/snapshot"
  - "Equivalência de defaults verificada capacidade a capacidade contra o baseline factual do 46-01; zero divergência"

patterns-established:
  - "Verificação de não-mudança do contrato externo por restrição de git diff aos caminhos congelados (prompts/, schema.ts, brief.ts, hooks/components de fluxo)"

requirements: [F46-37, F46-38, F46-39]
requirements-completed: [F46-37, F46-38, F46-39]

# Metrics
duration: 12min
completed: 2026-09-12
---

# Phase 46 Plan 08: Regressão, Não-mudança do Contrato Externo e Equivalência de Defaults Summary

**Fechamento behavior-preserving da F46: suíte completa verde (275 arquivos / 2720 testes), typecheck/lint/build verdes, UI/form/schema público/snapshot/domínio/prompts intactos por git diff, prompts sem drift e equivalência de defaults registry × pré-F46 demonstrada para as 11 capacidades (zero divergência).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-12T20:50:00Z (aprox.)
- **Completed:** 2026-09-12T21:02:17Z
- **Tasks:** 3
- **Files modified:** 0 de código (plano de regressão/verificação — apenas este SUMMARY + trackings)

## Accomplishments

- **Task 1 — Regressão completa verde:** `npx vitest run` → **275 arquivos / 2720 testes, 0 falhas** (32,6s). Nenhum resíduo de fixture/asserção dependente de env-var de modelo, instanciação de provider ou mock antigo foi encontrado — a co-migração das ondas 3–7 já havia deixado a suíte consistente. Nenhuma asserção de contrato externo foi alterada.
- **Task 2 — 4 gates verdes + contrato externo intacto:** `npm run typecheck` (0 erros), `npm run lint` (0 erros) e `npm run build` (Next.js build + `check:cnae` concluídos). Verificação por `git diff --name-only 3e2d7ff1 HEAD` (107 arquivos alterados pela fase) restrita aos caminhos congelados → **vazio** (sem mudança de UI/form/schema público/snapshot/domínio/prompts).
- **Task 3 — Equivalência de defaults + prompts sem drift:** tabela capacidade a capacidade (11 linhas) sem divergência contra o baseline do 46-01; `git diff 3e2d7ff1 HEAD -- 'prompts/*.md'` **vazio**; confirmação de 0 leituras das 14 envs removidas em `src/` e `scripts/` e de 0 ocorrências no `.env.example` (chaves + operacionais apenas).

## Task Commits

Plano de regressão/verificação: nenhuma alteração de código ou teste foi necessária (suíte já verde), portanto **não houve commit `test(46-08)`**. As Tasks 1–3 têm como artefato este SUMMARY, commitado em bloco atômico com a metadata do plano:

1. **Task 1: Regressão completa + resíduos** — sem commit (0 resíduos; nenhum arquivo alterado)
2. **Task 2: typecheck/lint/build + não-mudança** — sem commit (0 arquivos alterados)
3. **Task 3: equivalência de defaults + prompts sem drift** — sem commit (0 arquivos alterados)

**Plan metadata:** este commit (docs: complete plan — SUMMARY + STATE.md + ROADMAP.md + AGENTS.md)

## Files Created/Modified

- `.planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-08-SUMMARY.md` — este documento (evidência de regressão, não-mudança e equivalência de defaults).
- `.planning/STATE.md` — Phase 46 → 8/9 plans; 46-08 ✅.
- `.planning/ROADMAP.md` — Phase 46 → 8/9 plans complete; 46-08-PLAN.md `[x]`.
- `ROADMAP.md` (raiz) — linha 46 → `8/9 | ◆ In Progress`.
- `AGENTS.md` — Status Phase 46 → 8/9 + linha 46-08 ✅.

Nenhum arquivo de produção foi criado ou modificado por este plano.

## Equivalência de Defaults (registry × comportamento pré-F46) — 11 capacidades

Baseline pré-F46: inventário factual do **46-01** (coluna "Default atual (provider/model)" da tabela das 11 capacidades). Default atual: `MODEL_REGISTRY` em `src/lib/ai/model-registry.ts`.

| Capacidade | Default pré-F46 (provider/model) | Default registry (provider/model · protocolo) | Divergência |
|---|---|---|---|
| `campaign_copy` | openai/`gpt-4o` (+ fallback gemini/`gemini-3.1-flash-lite`) | openai/`gpt-4o` · chat-completions (+ fallback gemini/`gemini-3.1-flash-lite` · gemini) | ❌ nenhuma |
| `campaign_correction_analysis` | openai/`gpt-4o` | openai/`gpt-4o` · chat-completions | ❌ nenhuma |
| `brand_profile_text` | openai/`gpt-4o` | openai/`gpt-4o` · chat-completions | ❌ nenhuma |
| `campaign_spec` (legado) | openai/`gpt-4o-mini` | openai/`gpt-4o-mini` · chat-completions | ❌ nenhuma |
| `campaign_input_validation` | openai/`gpt-4o` | openai/`gpt-4o` · chat-completions | ❌ nenhuma |
| `campaign_image_review` | openai/`gpt-4o` | openai/`gpt-4o` · chat-completions | ❌ nenhuma |
| `brand_profile_vision` | openai/`gpt-4o` | openai/`gpt-4o` · chat-completions | ❌ nenhuma |
| `visual_signature_validation` | openai/`gpt-4o-mini` | openai/`gpt-4o-mini` · responses | ❌ nenhuma |
| `campaign_image` | openai/`gpt-5.5` | openai/`gpt-5.5` · responses | ❌ nenhuma |
| `campaign_image_edit` | openai/`gpt-image-2` | openai/`gpt-image-2` · images | ❌ nenhuma |
| `visual_signature_image` | openai/`gpt-5.5` | openai/`gpt-5.5` · responses | ❌ nenhuma |

**Resultado: 11/11 capacidades equivalentes — zero divergência de provider/modelo.** Nenhum modelo mudou nesta fase (design D1 :66-78). O `campaign_copy` mantém o fallback configurado `gemini`/`gemini-3.1-flash-lite` como default inicial (configuração, não regra).

## Não-mudança do Contrato Externo (Task 2)

`git diff --name-only 3e2d7ff1 HEAD` → **107 arquivos alterados pela fase**. Restrição aos caminhos congelados:

```
git diff --name-only 3e2d7ff1 HEAD -- 'prompts/*.md' 'src/lib/image-generation/schema.ts' 'src/lib/campaign/brief.ts' 'src/hooks/*' 'src/components/campaign/*'
→ (vazio)
```

Verificação explícita arquivo a arquivo:

| Arquivo (contrato congelado) | Alterado pela fase? |
|---|---|
| `src/components/flow/use-campaign-form.ts` (hook do form) | **NÃO** |
| `src/components/flow/__tests__/use-campaign-form-review.test.ts` | **NÃO** |
| `src/components/flow/__tests__/use-campaign-form-validity.test.ts` | **NÃO** |
| `src/lib/image-generation/schema.ts` (`GenerateImageRequestSchema`) | **NÃO** |
| `src/lib/campaign/brief.ts` (snapshot/domínio) | **NÃO** |
| `prompts/*.md` (16 arquivos) | **NÃO** |
| Qualquer `src/components/flow/**` ou `src/components/campaign/**` | **NÃO** |

**Única alteração adjacente a "domínio" na fase:** `src/lib/visual-signature/types.ts` — adição aditiva do literal `'campaign_spec'` ao union `GenerationEventType` (tipo de **evento de telemetria**, não de domínio/snapshot), prevista pela migration `20260912000001` do 46-01. Diff é estritamente a extensão do union + comentário; retrocompatível. **Não é mudança de superfície de domínio/snapshot.**

## Prompt Drift (Task 3)

```
git diff 3e2d7ff1 HEAD -- 'prompts/*.md'
→ EMPTY (no prompt drift)
```

Nenhum dos 16 arquivos de prompt foi alterado pela F46.

## Envs Removidas (14) + Remanescentes

**14 envs de modelo/provider removidas do runtime e do `.env.example`** (46-07): `OPENAI_MODEL`, `OPENAI_TEXT_MODEL`, `OPENAI_BRAND_DIRECTOR_MODEL`, `OPENAI_TEXT_ONLY_INFERENCE_MODEL`, `IMAGE_GENERATION_RESPONSES_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_VALIDATION_MODEL`, `IMAGE_PROVIDER`, `TEXT_PROVIDER`, `TEXT_FALLBACK_PROVIDER`, `GEMINI_TEXT_MODEL`, `GEMINI_MODEL`.

Evidência: `grep process.env.(<14 envs>)` em `src/` e `scripts/` → **0 ocorrências**; `Select-String` no `.env.example` → **0 ocorrências**.

**Chaves de API remanescentes (únicas configs de IA por env-var):** `OPENAI_API_KEY`, `GEMINI_API_KEY`.
**Operacionais remanescentes:** `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`, `IMAGE_GENERATION_QUALITY`, `IMAGE_GENERATION_DEBUG`, `METRICS_ENABLED`, `VENDEO_AI_FALLBACK_COST_USD`, `VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD`, `VENDEO_AI_CREDIT_UNIT_USD_VALUE`.

## Decisions Made

- **Nenhum resíduo corrigido** — a suíte completa herdada do 46-07 já estava verde (275/2720); a regressão da Task 1 não exigiu alteração de fixture/asserção.
- **`GenerationEventType` não conta como mudança de domínio** — é union de evento de telemetria; extensão aditiva planejada (46-01) e fora dos caminhos congelados.
- **Equivalência de defaults verificada contra o baseline factual do 46-01**, não contra env-vars (já removidas) — a fonte é a tabela de inventário registrada na Task 2 do 46-01.

## Deviations from Plan

**None - plan executed exactly as written.** Nenhuma correção de resíduo foi necessária e nenhuma asserção de contrato externo foi tocada.

## Issues Encountered

- **Ruído de jsdom no output do vitest** (`Not implemented: navigation to another Document` / `Window's scrollTo()`): avisos de ambiente, não falhas — a suíte terminou com `275 passed / 2720 passed`. Sem impacto.
- Nenhum outro problema.

## Gate Results

| Gate | Comando | Resultado |
|---|---|---|
| Regressão completa | `npx vitest run` | ✅ PASS — **275 arquivos / 2720 testes, 0 falhas** (32,6s) |
| Typecheck | `npm run typecheck` | ✅ PASS — 0 erros |
| Lint | `npm run lint` | ✅ PASS — 0 erros |
| Build | `npm run build` | ✅ PASS — `check:cnae` + `next build` concluídos |
| Não-mudança (git diff) | `git diff --name-only 3e2d7ff1 HEAD -- <caminhos congelados>` | ✅ PASS — vazio |
| Prompt drift | `git diff 3e2d7ff1 HEAD -- 'prompts/*.md'` | ✅ PASS — vazio |
| Envs removidas | grep `process.env` (14 envs) em `src/` + `scripts/` | ✅ PASS — 0 ocorrências |

## Threat Flags

Nenhuma nova superfície. O plano mitiga T-46-08a (git diff proíbe alteração das suites de não-mudança), T-46-08b (equivalência de defaults capacidade a capacidade, documentada) e T-46-08c (prompts sem drift). Nenhum pacote novo (T-46-SC aceito).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **46-09 (Onda 9) desbloqueada:** verificação final (`46-VERIFICATION.md` + `46-UAT.md` + registros/arquivamento).
- Regressão completa verde, 4 gates verdes, contrato externo intacto e prompts sem drift — base pronta para o fechamento da fase.
- Sem blockers.

## Self-Check: PASSED

- [x] `npx vitest run` verde (275 arquivos / 2720 testes, 0 falhas)
- [x] `npm run typecheck` / `npm run lint` / `npm run build` verdes
- [x] `git diff --name-only 3e2d7ff1 HEAD` sem UI/form/schema público/snapshot/domínio/prompts
- [x] `git diff 3e2d7ff1 HEAD -- 'prompts/*.md'` vazio (sem drift)
- [x] Tabela de equivalência de defaults (11 capacidades, zero divergência) neste SUMMARY
- [x] Lista das 14 envs removidas + chaves/operacionais remanescentes neste SUMMARY
- [x] `46-08-SUMMARY.md` existe com frontmatter `requirements: [F46-37, F46-38, F46-39]`

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-12*
