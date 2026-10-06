---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 11
subsystem: testing
tags: [f56.1, isolamento, rpc-auditada, idempotencia, uat, open-source-guard, supabase-isolado]

# Dependency graph
requires:
  - phase: 56.1-contrato-produtivo-modelos-e-fallback (planos 01-10)
    provides: configuração do par, catálogo elegível, snapshot, política de falhas, resposta pública, instrumentação, tela admin
provides:
  - Guard de isolamento e não-regressão do fluxo legado (new-flow-isolation.contract.test.ts)
  - Evidência de UAT local sem provider com teste REAL da RPC auditada na instância isolada
  - Verificação da fase (56-1-VERIFICATION.md) com 27 REQ-IDs e 55 tasks OpenSpec mapeadas
affects: [F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard de arquitetura comportamental: invoca buildAiModelSelectionView e asserta o conjunto OFERECIDO (não apenas conteúdo de arquivo)"
    - "Teste transacional REAL de RPC auditada via REST na instância Supabase descartável isolada, com actor válido (GoTrue) para a FK updated_by → auth.users"
    - "Evidência de UAT com identidade de instância + comandos exatos; contagem de auditoria e config_version_id antes/depois"

key-files:
  created:
    - src/lib/ai/__tests__/new-flow-isolation.contract.test.ts
    - .planning/phases/56.1-contrato-produtivo-modelos-e-fallback/56-1-UAT.md
    - .planning/phases/56.1-contrato-produtivo-modelos-e-fallback/56-1-VERIFICATION.md
  modified: []

key-decisions:
  - "Guard de isolamento invoca buildAiModelSelectionView com serviços fake e prova que o conjunto oferecido é exatamente LEGACY_SELECTION_CAPABILITIES (sem campaign_product_image nem gpt-image-2.5-flare/sunburst)."
  - "Teste REAL da RPC auditada executado na instância descartável isolada (vendeo-f561-isolated, REST 55321 / DB 55322) — gravação, exatamente 1 linha de auditoria e reenvio idempotente com o MESMO operation_id."
  - "p_actor_id válido obtido via GoTrue admin API para satisfazer a FK image_model_pair_config.updated_by → auth.users(id)."
  - "Validação coberta e restrita: typecheck/lint/build/suíte relevante/OpenSpec strict/db lint local; nenhum db push, nenhuma promoção, 0 chamadas pagas, 0 crédito."

patterns-established:
  - "Guard contratual de não-vazamento entre fluxo novo e legado com assertiva comportamental sobre o conjunto efetivamente oferecido."
  - "Prova transacional de RPC auditada (gravação + auditoria única + idempotência por operation_id) na instância isolada, complementando db reset/db lint e mocks."

requirements-completed: [REQ-56.1-03, REQ-56.1-07, REQ-56.1-11]

# Metrics
duration: ~28 min
completed: 2026-10-06
---

# Phase 56.1 Plan 11: Guard de isolamento, teste real da RPC e verificação da fase

**Fechamento da F56.1 com guard de isolamento do legado verde, teste transacional REAL da RPC `admin_set_image_model_pair_config` na instância Supabase descartável isolada (gravação + auditoria única + idempotência) e verificação mapeando os 27 REQ-IDs e as 55 tasks OpenSpec.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-10-06T14:40:00Z (aprox.)
- **Completed:** 2026-10-06T14:46:00Z (aprox.)
- **Tasks:** 4/4 concluídas (Tasks 1-4); Task 5 = checkpoint humano (STOP)
- **Files modified:** 3 (novo teste + UAT + VERIFICATION)

## Accomplishments

- **Guard de isolamento e não-regressão** (`new-flow-isolation.contract.test.ts`, 7 testes verdes): prova (a) `ImagesAdapter`/`defaultAdapterRegistry` sem `quality`; (b) `buildAiModelSelectionView` oferece exatamente as 11 `LEGACY_SELECTION_CAPABILITIES`, sem `campaign_product_image`; (c) nenhum alvo legado referencia `gpt-image-2.5-flare`/`gpt-image-2.5-sunburst`; (d) `MODEL_ALLOWLIST` produtivo intocado; (e) cadeia `resolveAiCost` preservada; (f) arquivos do novo fluxo não criam campanha nem importam crédito/ledger e o adapter carrega o SDK dinamicamente.
- **Teste REAL da RPC auditada** na instância isolada: `p_actor_id` válido via GoTrue → gravação (`success:true`, `idempotent:false`) → **exatamente 1** linha em `admin_audit_log` (`action='image_model_pair_config_update'`) → reenvio com o MESMO `operation_id` (`idempotent:true`, `config_version_id` inalterado, auditoria permanece 1).
- **Gates completos verdes:** typecheck, lint, build, suíte relevante (`ai`+`ai-cost`+`api/admin`: 894 passed / 7 skipped) e `openspec validate --strict` (com escopo). `supabase db lint --local --fail-on error` EXIT 0.
- **Verificação da fase** (`56-1-VERIFICATION.md`): 27/27 REQ-IDs e 55/55 tasks OpenSpec mapeados com evidência; fronteira F56.1×F56.2 confirmada.
- **Não-push / não-ativação / não-promoção:** nenhum `db push` remoto, nenhuma chamada paga, 0 crédito, fluxo legado intocado (exceto mudanças declarativas).

## Task Commits

1. **Task 1: Guard de isolamento e não-regressão do legado** — `264b0788` (test)
2. **Task 2: Teste REAL da RPC auditada na instância isolada** — `90fc61a3` (test)
3. **Task 3: Gates completos e evidência de validação local sem provider** — `0aa4c8e2` (docs)
4. **Task 4: Verificação da fase e checkpoint humano final** — `87fa0daa` (docs)

**Plan metadata:** (este SUMMARY) — commit dedicado.

## Files Created/Modified

- `src/lib/ai/__tests__/new-flow-isolation.contract.test.ts` — Guard de arquitetura (7 testes) que prova o não-vazamento da capacidade nova para a seleção legada e a preservação dos caminhos legados.
- `.planning/phases/56.1-contrato-produtivo-modelos-e-fallback/56-1-UAT.md` — Evidência de UAT local sem provider: identidade da instância isolada, teste REAL da RPC, gates e limitações.
- `.planning/phases/56.1-contrato-produtivo-modelos-e-fallback/56-1-VERIFICATION.md` — Verificação da fase com 27 REQ-IDs e 55 tasks OpenSpec mapeados.

## Decisions Made

- O guard de isolamento usa **assertiva comportamental** sobre o conjunto oferecido (`buildAiModelSelectionView`), não apenas grep de arquivo — se a view voltar a iterar `ALL_CAPABILITIES`, o teste falha (12 ≠ 11).
- O teste REAL da RPC exige `p_actor_id NOT NULL` + FK `updated_by → auth.users`; criou-se um usuário de teste via GoTrue admin API na instância isolada (nunca na stack compartilhada `Vendeo_V3`).
- A idempotência é demonstrada por `operation_id`: a contagem global da ação na instância isolada é 1 por operação distinta; reenvios nunca duplicam.
- Tracking (`.planning/STATE.md`/`.planning/ROADMAP.md`) **permanece com o orquestrador** — este plano não os modificou.

## Deviations from Plan

None - plan executed exactly as written (o worktree já continha a inserção da Task 2 da RPC no PLAN.md, feita pelo orquestrador; nenhuma ação do executor alterou artefatos de planejamento além dos previstos nas Tasks).

## TDD Gate Compliance

- Task 1 estava marcada `tdd="true"`, mas o plano é `type: execute` (não `tdd`), então o portão TDD de nível de plano não se aplica.
- O guard testado é uma **regressão de comportamento pré-existente** (a isolação foi implementada nos planos 01/08/09). Não houve artefato de produção novo a implementar (GREEN vazio); o commit único é `test(56-1-11)` (`264b0788`). O teste falha explicitamente se qualquer invariante regredir.

## Issues Encountered

- **Medição de contagem inicial no PowerShell:** `@($null).Count` retornou 1 para uma resposta REST vazia (`[]`), gerando um falso "1" na primeira passagem. Corrigido com uma segunda passagem instrumentada que lê o corpo bruto (`[]`) e usa contagem robusta → **contagem prévia real = 0**. Nenhum impacto nos dados; a evidência final no UAT reflete a medição correta.
- **`openspec validate --strict` sem escopo:** a versão instalada retorna "Nothing to validate" (EXIT 1); a validação efetiva foi feita com escopo (`openspec validate <change> --strict` e `--changes --strict`), ambas válidas.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- F56.1 com o **checkpoint humano final (Task 5) APROVADO** no escopo preparatório/local — ver "UAT Humano" abaixo.
- Nenhuma ativação, `db push`, promoção ou geração paga foi executada.
- A integração transacional (snapshot real, não-débito, política sobre geração real) é da **F56.2**.

## UAT Humano

O responsável **APROVOU** o UAT humano da F56.1 no **escopo preparatório/local** (instância descartável/isolada `vendeo-f561-isolated`, REST `55321` / DB `55322`).

- **Teste humano do par Flare:** salvou primário `gpt-image-2.5-flare`/`medium` + fallback `gpt-image-2`/`medium` (motivo "Teste") → versão `f314d801-87be-479c-9c01-4d574b9d892f`, `operation_id` `600af8d0-090a-4419-807d-0282afb60afd`, com **exatamente 1** linha de auditoria (`action='image_model_pair_config_update'`).
- **Restauração do par inicial:** primário `gpt-image-2.5-sunburst`/`medium` + fallback `gpt-image-2`/`medium` (motivo "teste") → versão `b3fa7b83-a0aa-48db-8f02-9bcbdd32bbe8`, `operation_id` `ce191171-ea5d-4381-840b-07ad860a6c1d`, com **exatamente 1** linha de auditoria.
- **Não é promoção:** o teste do par Flare foi revertido ao par inicial aprovado; a escolha do par **permanece decisão humana** do responsável, não promoção/ativação.
- Histórico de auditoria **preservado** (4 linhas: `5958d23c`→`c949372c`, `884e9260`→`cca10e2f`, `600af8d0`→`f314d801`, `ce191171`→`b3fa7b83`). Nenhum `db push`, provider, geração paga ou ativação.
- O lifecycle OpenSpec (`/opsx-verify` → `/opsx-sync` → `/opsx-archive`) e o passo de verificação GSD **NÃO** foram executados (parada por instrução do responsável antes de verify/sync/archive).

---

*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*

## Self-Check: PASSED

- FOUND: src/lib/ai/__tests__/new-flow-isolation.contract.test.ts
- FOUND: .planning/phases/56.1-contrato-produtivo-modelos-e-fallback/56-1-UAT.md
- FOUND: .planning/phases/56.1-contrato-produtivo-modelos-e-fallback/56-1-VERIFICATION.md
- FOUND: 264b0788 (Task 1)
- FOUND: 90fc61a3 (Task 2)
- FOUND: 0aa4c8e2 (Task 3)
- FOUND: 87fa0daa (Task 4)
- `.planning/STATE.md` e `.planning/ROADMAP.md` não modificados por este plano ✅
