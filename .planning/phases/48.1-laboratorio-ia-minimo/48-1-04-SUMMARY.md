---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-04
subsystem: lab
tags: [zod, supabase, sha256, lab-experiments, state-machine, atomic-rpc, prompt-snapshot, catalog-allowlist]

# Dependency graph
requires:
  - phase: 48.1-laboratorio-ia-minimo
    provides: tabelas `lab_*` + RPCs `lab_create_experiment`/`lab_reserve_run` + triggers de imutabilidade (48-1-01)
  - phase: 48.1-laboratorio-ia-minimo
    provides: guarda de ambiente fail-closed e constantes de limite travadas (48-1-02)
provides:
  - "`CreateLabExperimentInputSchema` (Zod `.strict()`) com dimensão única `prompt` e rejeição determinística de `model`/`configuration` (`UnsupportedChangedDimensionError`)"
  - "`CreateLabEvaluationInputSchema` com `verdict`, modo cego e runs distintos (`run_ids_must_differ`)"
  - "`buildBaselinePromptSnapshot` (prompt oficial atual, `source: official`) e `buildCandidatePromptSnapshot` (override, `source: override`) com hash SHA-256"
  - "`validateModelTargetAgainstCatalog` — allowlist read-only do catálogo F47 (`status = 'active'` para `campaign_image`)"
  - "`createExperiment` — criação atômica (experimento + exatamente 2 variantes + N cenários) via RPC `lab_create_experiment`, sem run"
  - "Máquina de estados travada (`EXPERIMENT_TRANSITIONS`), `computeExperimentReadiness` com códigos objetivos, `transitionExperiment` e `assertConfigurationEditable` (congelamento após o primeiro run)"
affects: [48-1-05 (harness do gateway consome alvo fixo e snapshots), 48-1-07 (reserva de run usa prontidão/congelamento), 48-1-08 (API usa schemas e serviço), 48-1-09/48-1-10 (UI de experimentos e avaliação), 48-1-11/48-1-12 (testes), 48-1-13 (regressão), 48-1-14 (UAT local)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Criação atômica de agregado por RPC SECURITY DEFINER (uma transação) em vez de inserts PostgREST encadeados — sem registro parcial em falha"
    - "Allowlist read-only de alvo de modelo: o catálogo persistido é consultado, nunca mutado; falha de leitura é fail-closed"
    - "Máquina de estados como tabela de transições (`Record<status, status[]>`) + `assertTransitionAllowed` com mensagem determinística `invalid_transition:<from>-><to>`"
    - "Prontidão por códigos objetivos (`reasons`) em vez de exceções de configuração — o chamador compõe `experiment_not_ready:<reasons>`"
    - "Congelamento por contagem de runs (`lab_runs`), com o trigger de banco como reforço estrutural"
    - "Client Supabase tipado recebido por parâmetro e substituído por fake em memória com builder thenable (`select`/`eq`/`update`/`maybeSingle`) — zero rede e zero chamada paga nos testes"

key-files:
  created:
    - src/lib/lab/domain/schemas.ts
    - src/lib/lab/domain/prompt-snapshot.ts
    - src/lib/lab/domain/model-target.ts
    - src/lib/lab/domain/experiment-service.ts
    - src/lib/lab/domain/__tests__/schemas.test.ts
    - src/lib/lab/domain/__tests__/prompt-snapshot.test.ts
    - src/lib/lab/domain/__tests__/model-target.test.ts
    - src/lib/lab/domain/__tests__/experiment-service.test.ts
  modified: []

key-decisions:
  - "Dimensão única executável em `CHANGED_DIMENSIONS = ['prompt']`; `FUTURE_CHANGED_DIMENSIONS = ['model','configuration']` existe apenas para o enum reconhecer o valor e devolver `UnsupportedChangedDimensionError` — o parse rejeita antes de qualquer escrita (T-48-1-23)"
  - "Baseline carrega **somente** `promptName` (o conteúdo oficial é lido no servidor pelo `PromptLoader`); a candidata carrega o override completo — nenhum conteúdo de baseline atravessa a fronteira da UI (T-48-1-27)"
  - "Alvo de modelo e params vivem apenas no experimento e nenhum schema de variante possui alvo próprio (`.strict()`), garantindo que a única diferença comparada seja o prompt (T-48-1-26)"
  - "`createExperiment` grava numa única RPC `lab_create_experiment`; nenhum insert PostgREST separado e nenhum run criado/disparado (T-48-1-30)"
  - "Falha de leitura do catálogo é fail-closed: erros de leitura lançam `model_target_catalog_read_failed` (distinto de `ModelTargetNotInCatalogError`) em vez de liberar o alvo silenciosamente (T-48-1-25)"
  - "`computeExperimentReadiness` devolve `reasons` objetivos (7 códigos) e nunca lança por configuração incompleta — só por falha de leitura ou experimento inexistente"
  - "`evaluated → running` é exposto pela máquina de estados porque avaliar não encerra as execuções; `→ archived` é válido no domínio mas não exposto pela API/UI da F48.1 (F48.2)"

patterns-established:
  - "Erro determinístico nomeado com `code` readonly: `unsupported_changed_dimension`, `model_target_not_in_catalog`, `invalid_transition:<from>-><to>`, `experiment_not_ready:<reasons>`, `experiment_frozen`, `experiment_not_found`"
  - "Snapshot de prompt com `{ name, content, contentHash, source }` — hash SHA-256 hex de 64 chars é a identidade verificável congelada no run"

requirements-completed: [lab-experiments]

# Metrics
duration: 7min
completed: 2026-09-16
---

# Phase 48.1 Plan 48-1-04: Domínio de Experimentos Prompt-Only do Laboratório Summary

**Domínio de experimentos prompt-only com criação atômica de 2 variantes (baseline `official` × candidata `override`) numa única RPC, allowlist read-only do catálogo F47, máquina de estados travada `draft→ready→running⇄evaluated→archived` e congelamento após o primeiro run**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-16T16:57:16Z
- **Completed:** 2026-09-16T17:04:27Z
- **Tasks:** 3
- **Files modified:** 8 (todos criados)

## Accomplishments

- **Schemas Zod (`schemas.ts`)** — `CreateLabExperimentInputSchema` `.strict()` com dimensão única `prompt`: `changedDimension` aceita o enum completo (`prompt`/`model`/`configuration`) para poder emitir a issue `unsupported_changed_dimension`, e `parseCreateLabExperimentInput` a traduz em `UnsupportedChangedDimensionError { code, dimension }` **antes de qualquer escrita**. Limites LOCKED importados de `@/lib/lab/limits` (`MAX_REPETITIONS` 3, `MAX_RUNS_PER_EXPERIMENT` 12, `MAX_SCENARIOS_PER_EXPERIMENT` 3, `DEFAULT_MAX_RUNS_PER_EXPERIMENT` 6). Baseline carrega apenas `promptName`; candidata carrega `promptName` + `promptContent`; `skipInputValidation` é `z.literal(true)` (D7). `CreateLabEvaluationInputSchema` cobre `verdict` (`baseline|candidate|tie|none`), `blindOrder`, `observation` e rejeita runs iguais com `run_ids_must_differ`.
- **Snapshots de prompt (`prompt-snapshot.ts`)** — `PROMPT_UNDER_TEST` como constante única (intent `offer`); `buildBaselinePromptSnapshot` lê o **conteúdo oficial atual** via `PromptLoader` e devolve `source: "official"`; `buildCandidatePromptSnapshot` valida o nome sob teste (senão `unsupported_prompt_under_test:<name>`) e devolve `source: "override"`; ambos com `computePromptContentHash` (SHA-256 hex, 64 chars). O teste compara conteúdo + `mtimeMs` do arquivo oficial antes/depois — `prompts/` permanece intocado (T-48-1-27).
- **Allowlist do catálogo (`model-target.ts`)** — `validateModelTargetAgainstCatalog` consulta `ai_model_catalog` filtrando `capability = 'campaign_image'`, provider/model/protocol do alvo e `status = 'active'`, com `maybeSingle()`. Módulo **sem** `insert`/`update`/`delete`/`upsert`/`rpc` e **sem** qualquer referência à seleção produtiva de modelos (T-48-1-25); falha de leitura é fail-closed com `model_target_catalog_read_failed`.
- **Serviço de experimentos (`experiment-service.ts`)** — `createExperiment` valida a entrada (rejeitando `model`/`configuration`), valida o alvo no catálogo e grava **tudo numa única RPC `lab_create_experiment`** (experimento + exatamente 2 variantes + N cenários), devolvendo `{ experimentId }`; nenhum run é criado. `EXPERIMENT_TRANSITIONS` trava a máquina de estados (`draft → ["ready"]`, `archived → []`, `evaluated → ["running","archived"]`) e `assertTransitionAllowed` lança `invalid_transition:<from>-><to>`. `computeExperimentReadiness` devolve os 7 códigos objetivos; `transitionExperiment` valida prontidão em `draft → ready` (`experiment_not_ready:<reasons>`) e faz `update` de `status`/`updated_at`; `assertConfigurationEditable` conta `lab_runs` e lança `experiment_frozen` a partir do primeiro run (T-48-1-24).
- **Testes (69 no diretório de domínio; 27 só no serviço)** — client fake em memória com builder thenable cobrindo criação válida (1 experimento, 2 variantes com origens corretas, N cenários em ordem, 0 runs), ausência de inserts separados (lista exata de chamadas: catálogo + RPC), rejeição de dimensão e de alvo fora do catálogo **sem nenhuma escrita**, atomicidade em falha da RPC (nada persistido), prontidão (variantes faltando, zero cenários, 4 cenários, repetições 4, teto 13, dimensão fora de `prompt`, alvo inativo), transições válidas/inválidas e congelamento. Nenhuma chamada de rede e nenhuma chamada paga.
- **Mitigações do threat model aplicadas:** T-48-1-23 (`unsupported_changed_dimension` antes de escrever, com teste de zero escritas), T-48-1-24 (`experiment_frozen` + trigger de banco como reforço), T-48-1-25 (allowlist read-only com grep de zero escritas e zero referência à seleção produtiva), T-48-1-26 (alvo/params só no experimento, `.strict()` sem alvo por variante, `skipInputValidation` literal `true`), T-48-1-27 (baseline somente leitura; `git status --porcelain prompts/` vazio), T-48-1-28 (`created_by` obrigatório atravessa a RPC), T-48-1-29 (`run_ids_must_differ`), T-48-1-30 (nenhum run criado/disparado). T-48-1-SC: nenhum pacote novo (`zod`, `node:crypto` e o client Supabase já existiam).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Schemas Zod de experimento e avaliação** — `6cf418c7` (feat)
2. **Task 2: Snapshots de prompt + validação do alvo no catálogo F47** — `80c5681e` (feat)
3. **Task 3: Serviço de experimentos (criação atômica, transições, prontidão, congelamento)** — `ff14d4df` (feat)

**Plan metadata:** `(este commit)` (docs: complete plan)

## Files Created/Modified

- `src/lib/lab/domain/schemas.ts` — `CreateLabExperimentInputSchema`/`CreateLabEvaluationInputSchema`, `LabModelTargetSchema`, `LabExperimentParamsSchema`, `CHANGED_DIMENSIONS`/`FUTURE_CHANGED_DIMENSIONS`, `UnsupportedChangedDimensionError`, `parseCreateLabExperimentInput`/`parseCreateLabEvaluationInput`
- `src/lib/lab/domain/prompt-snapshot.ts` — `PROMPT_UNDER_TEST`, `computePromptContentHash`, `buildBaselinePromptSnapshot` (`official`), `buildCandidatePromptSnapshot` (`override`)
- `src/lib/lab/domain/model-target.ts` — `LAB_PRIMARY_CAPABILITY`, `ModelTargetNotInCatalogError`, `validateModelTargetAgainstCatalog` (somente leitura)
- `src/lib/lab/domain/experiment-service.ts` — `EXPERIMENT_TRANSITIONS`, `READINESS_REASONS`, `assertTransitionAllowed`, `computeExperimentReadiness`, `createExperiment` (RPC atômica), `transitionExperiment`, `assertConfigurationEditable`
- `src/lib/lab/domain/__tests__/schemas.test.ts` — 24 testes (criação, dimensão, limites, comparação justa, avaliação)
- `src/lib/lab/domain/__tests__/prompt-snapshot.test.ts` — 9 testes (hash determinístico, baseline oficial, candidata override, arquivo oficial intacto)
- `src/lib/lab/domain/__tests__/model-target.test.ts` — 9 testes (linha ativa, model/protocol/provider diferentes, deprecated, catálogo vazio, falha de leitura, somente leitura)
- `src/lib/lab/domain/__tests__/experiment-service.test.ts` — 27 testes (criação atômica, zero escritas em erro, atomicidade, prontidão, estados, congelamento)

## Decisions Made

- **`CHANGED_DIMENSIONS` × enum do schema** — o enum conhece as 3 dimensões para que `model`/`configuration` produzam a issue determinística `unsupported_changed_dimension` (e não um erro genérico de enum); `CHANGED_DIMENSIONS` é a fonte executável (`["prompt"]`) e `FUTURE_CHANGED_DIMENSIONS` documenta o que a F48.2 habilitará.
- **Baseline sem conteúdo do cliente** — `baseline.promptName` é o único campo; o conteúdo oficial é lido server-side pelo `PromptLoader`, o que impede injetar um "baseline" arbitrário e manter a comparação honesta.
- **Atomicidade delegada à RPC** — `createExperiment` não faz três inserts; a única gravação é `client.rpc("lab_create_experiment", …)`. O teste fixa a lista exata de chamadas (catálogo + RPC) e prova que uma falha da RPC não deixa experimento/variantes/cenários.
- **Erro de leitura do catálogo distinto do "não está no catálogo"** — fail-closed nos dois casos, mas com diagnóstico diferente (`model_target_catalog_read_failed` vs `ModelTargetNotInCatalogError`).
- **Prontidão como dados, não exceção** — `computeExperimentReadiness` devolve `{ ready, reasons }`; quem compõe a mensagem determinística `experiment_not_ready:<reasons>` é a transição (e a API no 48-1-08).
- **`archived` no domínio, fora da superfície** — a transição existe na tabela (e é testada como terminal), mas nenhuma rota/UI da F48.1 a expõe, conforme D5/non-goals.
- **Fakes em memória com builder thenable** — o client tipado (`SupabaseClient`) recebido por parâmetro permite um fake que reproduz `select`/`eq`/`update`/`maybeSingle` e filtra de verdade as linhas, sem rede e sem chamada paga.

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 2 - Fail-closed] Erro de leitura do catálogo separado do "alvo ausente"**
- **Found during:** Task 2 (validação do alvo no catálogo)
- **Issue:** o plano descreve apenas "ausente → `ModelTargetNotInCatalogError`". Tratar falha de leitura do banco com o mesmo erro tornaria uma indisponibilidade do catálogo indistinguível de um alvo realmente inexistente (diagnóstico enganoso no operador).
- **Fix:** `error` da consulta lança `model_target_catalog_read_failed:<message>`; ausência de linha lança `ModelTargetNotInCatalogError`. Ambos recusam a criação/execução (fail-closed, T-48-1-25).
- **Files modified:** `src/lib/lab/domain/model-target.ts`, `src/lib/lab/domain/__tests__/model-target.test.ts`
- **Verification:** teste dedicado "fail-closed: erro de leitura do catálogo não libera o alvo" (`npx vitest run src/lib/lab/domain` → 0).
- **Committed in:** `80c5681e` (Task 2)

**2. [Informativo] `position` dos cenários é 1-based na RPC do 48-1-01**
- **Found during:** Task 3 (leitura da migration `20260915000003`)
- **Issue:** o texto do plano diz "`lab_experiment_scenarios` (position = índice 0..n-1)", mas a RPC `lab_create_experiment` já aplicada grava `FOR v_position IN 1..v_scenario_count` (1-based).
- **Fix:** nenhum código alterado — o serviço delega a ordem à RPC enviando `p_scenario_version_ids` na ordem desejada, que é o contrato observável (ordem preservada). O fake do teste espelha a RPC (1-based) para manter paridade com o banco local.
- **Files modified:** nenhum (apenas comentário de teste)
- **Verification:** teste "cria 1 experimento com … N cenários" afirma `positions === [1, 2]`.
- **Committed in:** `ff14d4df` (Task 3)

**3. [Rule 2 - Aditivo] Constantes/tipos auxiliares exportados**
- **Found during:** Tasks 1-3
- **Issue:** o plano lista os exports mínimos; o consumo downstream (48-1-05..48-1-10) precisa dos códigos de prontidão e dos tipos dos snapshots para compor mensagens e snapshots de run sem repetir literais.
- **Fix:** adicionados `READINESS_REASONS`/`ReadinessReason`, `LAB_EVALUATION_VERDICTS`, `LAB_BLIND_ORDERS`, `LAB_PRIMARY_CAPABILITY`, `LabPromptSnapshot`/`BaselinePromptSnapshot`/`CandidatePromptSnapshot` e `UNSUPPORTED_PROMPT_UNDER_TEST`. Nenhum comportamento extra.
- **Files modified:** `src/lib/lab/domain/schemas.ts`, `model-target.ts`, `prompt-snapshot.ts`, `experiment-service.ts`
- **Verification:** `npx tsc -p tsconfig.typecheck.json --noEmit` → 0; `npx vitest run src/lib/lab/domain` → 0.
- **Committed in:** `6cf418c7`, `80c5681e`, `ff14d4df`

---

**Total deviations:** 1 fail-closed (diagnóstico do catálogo), 1 informativa (1-based na RPC) e 1 aditiva (constantes/tipos)
**Impact on plan:** Nenhum escopo extra e nenhuma mudança de contrato: os limites, a dimensão única, a atomicidade, os códigos de erro e a máquina de estados são exatamente os do plano. As adaptações são de diagnóstico/testabilidade.

## Issues Encountered

- **Duas iterações no fake do cliente** — o primeiro fake de `model-target` usava `this.rows` dentro do builder, onde `this` era o próprio builder (não o cliente); corrigido capturando `const rows = this.rows` antes de construir o builder. Nenhum impacto no código de produção.
- **Ajuste de comentário para atender ao critério de aceitação** — a menção a `run_ids_must_differ` em um JSDoc fazia o grep de aceitação (exatamente 1 linha) retornar 2; o comentário foi reescrito sem o literal, mantendo o código intacto.
- Nenhum outro problema: os 3 gates (`vitest`/`typecheck`/`lint`) ficaram verdes na primeira execução após a implementação de cada task.

## User Setup Required

None - nenhuma configuração de serviço externo. A RPC `lab_create_experiment` é **local-only** (push remoto deliberado só no 48-1-14) e os testes usam fakes em memória, sem banco e sem chamadas pagas.

## Verification

| Verificação | Exit | Resultado |
|---|---|---|
| `npx vitest run src/lib/lab/domain` | **0** | 4 arquivos / **69 testes** (24 schemas + 9 prompt-snapshot + 9 model-target + 27 experiment-service) |
| `npx vitest run src/lib/lab` (contexto completo) | **0** | 9 arquivos / **179 passed + 1 skipped** |
| `npx vitest run src/lib/ai/__tests__/architecture-guard.test.ts` | **0** | 9 testes (gate global cobre `src/lib/lab/**`) |
| `npx tsc -p tsconfig.typecheck.json --noEmit` | **0** | limpo |
| `npm.cmd run lint` | **0** | limpo |
| `rg 'unsupported_changed_dimension' src/lib/lab/domain/schemas.ts` | — | **4** ocorrências (≥2 exigido) |
| `rg 'MAX_REPETITIONS\|MAX_RUNS_PER_EXPERIMENT\|MAX_SCENARIOS_PER_EXPERIMENT\|DEFAULT_MAX_RUNS_PER_EXPERIMENT' schemas.ts` | — | 4 constantes importadas de `@/lib/lab/limits` |
| `rg 'skipInputValidation: z.literal\(true\)' schemas.ts` | — | **1** linha |
| `rg 'run_ids_must_differ' schemas.ts` | — | **1** linha |
| `rg 'model_target\|modelTarget' schemas.ts` | — | **1** linha (apenas o nível do experimento) |
| `rg 'campaign-image-director-offer' prompt-snapshot.ts` | — | **1** linha (constante única) |
| `rg 'source: "official"\|source: "override"' prompt-snapshot.ts` | — | ambos presentes |
| `rg '\.(insert\|update\|delete\|upsert\|rpc)\(' model-target.ts` | **1** (vazio) | zero linhas — somente leitura |
| `rg 'ai_model_selection' src/lib/lab/domain` | **1** (vazio) | zero ocorrências |
| `rg 'lab_create_experiment' experiment-service.ts` | — | presente (`client.rpc("lab_create_experiment", …)`) |
| `rg '\.insert\(' experiment-service.ts` | **1** (vazio) | zero inserts PostgREST separados |
| `rg 'invalid_transition\|experiment_frozen\|experiment_not_ready' experiment-service.ts` | — | as 3 mensagens presentes |
| `rg 'draft: \["ready"\]'` / `rg 'archived: \[\]'` experiment-service.ts | — | `draft` só para `ready`; `archived` terminal |
| `rg 'generation_events\|AiCostTracker' src/lib/lab/domain` | **1** (vazio) | zero ocorrências |
| `git status --porcelain prompts/ src/lib/ai/gateway.ts src/lib/ai-cost src/lib/campaign` | — | **vazio** (nenhuma superfície produtiva tocada) |

## Known Stubs

Nenhum. Os schemas validam de verdade, os snapshots leem o arquivo oficial real e calculam hash do conteúdo real, a validação do catálogo consulta a tabela (fake nos testes, banco no runtime) e o serviço grava pela RPC transacional. Nenhum valor hardcoded, placeholder ou fonte de dados não conectada.

## Threat Flags

Nenhum. As superfícies introduzidas (entrada de criação/avaliação, escrita nas tabelas `lab_*` via RPC, leitura de `ai_model_catalog`, leitura do prompt oficial) já estão registradas no `<threat_model>` do plano (T-48-1-23..T-48-1-30) e todas as mitigações foram implementadas e testadas.

## Next Phase Readiness

- **Pronto para 48-1-05/48-1-06:** o harness do gateway consome o alvo fixo (`LabModelTarget` + `validateModelTargetAgainstCatalog`) e os snapshots de prompt (`LabPromptSnapshot` com `name`/`content`/`contentHash`/`source`) para montar o `LabModelResolver`/`LabPromptLoader` sem tocar o gateway F46.
- **Pronto para 48-1-07/48-1-08:** `computeExperimentReadiness`, `transitionExperiment` e `assertConfigurationEditable` já entregam prontidão, máquina de estados e congelamento; a API administrativa só precisa compor `experiment_not_ready:<reasons>` e `experiment_frozen` nas respostas e passar o `operationId` para a reserva atômica.
- **Estado do banco local:** nenhuma escrita nova — a RPC `lab_create_experiment` não foi executada (os testes usam fakes). O remoto **não** foi tocado (push deliberado só no 48-1-14).
- **Sem pendências ou bloqueios.** Nenhuma superfície produtiva alterada (UI/form do lojista, contrato HTTP de geração, schema público, snapshot, domínio, prompts oficiais, catálogo/seleção e telemetria intactos).

---

*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*

## Self-Check: PASSED

- Os 8 arquivos criados existem no disco (4 fontes em `src/lib/lab/domain/` + 4 suítes em `__tests__/`).
- Commits confirmados no histórico: `6cf418c7` (Task 1), `80c5681e` (Task 2), `ff14d4df` (Task 3).
- Gates reexecutados após o último commit: `npx vitest run src/lib/lab/domain` → 0 (69 testes); `npx vitest run src/lib/lab` → 0 (179 passed + 1 skipped); `npx tsc -p tsconfig.typecheck.json --noEmit` → 0; `npm.cmd run lint` → 0; `architecture-guard` → 0 (9 testes).
- `git status --porcelain prompts/ src/lib/ai/gateway.ts src/lib/ai-cost src/lib/campaign` → vazio.
