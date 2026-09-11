---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 17
subsystem: testing
tags: [vitest, f37.2, ui, modal, ndjson, gates, admin, route-guards]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 07
    provides: rota POST /api/campaign/[id]/problem-report
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 09
    provides: CampaignApprovalView com dois botões + campaign-problem-modal
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 10
    provides: modal de relato (NDJSON/JSON, fechamentos sem efeito)
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 11
    provides: client regenerating + pending v2
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 12
    provides: fila admin campaign-reports (lista/detalhe/rota revisado)
provides:
  - testes 16.1-16.9 (flag/legado, gates, dois botões/modal, regenerating, pending v2, admin, guards da rota, NDJSON eligible/error)
affects: [37-2-18 (regressão e co-migração)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server component admin renderizado via `render(await Page({ searchParams/params }))` com serviços mockados"
    - "NDJSON consumido no cliente com ReadableStream real + gate manual para assertar estado de processamento"

key-files:
  created:
    - src/__tests__/api/campaign-problem-report-route.test.ts
    - src/__tests__/api/campaign-approval-view-problem.test.tsx
    - src/__tests__/api/admin-campaign-reports.test.tsx
  modified: []

key-decisions:
  - "Contrato real do NDJSON usa {type:'result'} (não o shorthand {type:'done'} do PLAN) — o modal reconhece 'result' como sucesso"
  - "Gates de download/copy assertados pela função real isDeliveryReleased/computeApprovalState + leitura das rotas (fonte), determinístico e sem re-mock da rota inteira"
  - "Arquivo de UI criado como campaign-approval-view-problem.test.tsx (não sobrescreve o campaign-approval-view.test.tsx da F37.1)"
  - "16.9 usa um ReadableStream com gate manual: enfileira a fase image_generation, segura o result e só libera após assertar 'Gerando a nova arte...'"

patterns-established:
  - "Admin server page testado por render direto do async component com requireAdmin + correção-reports mockados (espelha admin/reviews/__page.test.tsx)"
  - "Erro do NDJSON assertado como PT-BR e sem router.refresh(); sucesso como router.refresh() + onClose"

requirements-completed: [F37.2-17]

# Metrics
duration: 30min
completed: 2026-09-11
---

# Phase 37.2 Plan 17: Testes UI/Gates/Admin/Rota Summary

**46 testes verdes (16.1-16.9): flag off/legado e gates 403 preservados, dois botões + modal de relato com fechamentos sem efeito, regenerating/pending v2 na página, fila admin com decisão corrente por attempt_number e o consumo real do NDJSON eligible (result/error) + ramo JSON**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-11T13:35:00Z
- **Completed:** 2026-09-11T13:41:00Z
- **Tasks:** 3
- **Files modified:** 3 (novos)

## Accomplishments

- **16.1** flag off (`not_enabled`) e legado (`legacy`) seguem com entrega imediata; rotas download/publication-copy mantêm o gate `isDeliveryReleased` → 403.
- **16.2/16.8** `regenerating` e `pending` pós-recuperação mantêm download/copy 403 até aprovação explícita (`approved` → liberado).
- **16.3** `pending` v1 exibe [Aprovar arte] + [Informar problema]; modal abre com preview/orientação/campo; vazio e pontuação → erro amigável **sem fetch**; Cancelar/X/ESC/backdrop fecham sem efeito.
- **16.4** `regenerating` exibe "Corrigindo a arte..." sem download/copy/approve (não cai no ReadyView).
- **16.5** `pending` v2 exibe apenas [Aprovar arte] (aprova a v2) sem [Informar problema] nem retorno à v1.
- **16.9** NDJSON eligible consome o stream (fase → `result` → `router.refresh()` + fecha); `error` exibe PT-BR e **não** chama refresh; ramo JSON `blocked`/`unclear` exibe a orientação.
- **16.6** fila admin: decisão corrente pela maior `attempt_number`, filtros repassados, detalhe v1 × v2 com histórico por `attempt_number` e aprovação derivada, marcação ortogonal via botão + rota admin.
- **16.7** guards da rota `problem-report`: CSRF→403, auth→401, UUID→400, 404, ownership→404, flag off→403, não-ready→409, body vazio/pontuação/extra→400, begin `already_consumed`/`campaign_not_pending`/`no_active_candidate`/`analysis_in_progress`/`rate_limit_exceeded`→409; `blocked`→200 JSON e `eligible`→NDJSON.

## Task Commits

Each task was committed atomically:

1. **Task 1 (16.1/16.2/16.8) + 16.7 — guards/gates da rota problem-report** - `c10fb2a4` (test)
2. **Task 2 (16.3/16.4/16.5/16.9) — UI de revisão, modal e consumo NDJSON** - `70f482f4` (test)
3. **Task 3 (16.6) — fila admin de relatos de correção** - `a230f149` (test)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/api/campaign-problem-report-route.test.ts` — 21 testes: gates 16.1/16.2/16.8 + guards/status 16.7 (inclui blocked 200 e eligible NDJSON).
- `src/__tests__/api/campaign-approval-view-problem.test.tsx` — 16 testes: dois botões/modal (16.3), regenerating (16.4), pending v2 (16.5) e consumo NDJSON/JSON (16.9).
- `src/__tests__/api/admin-campaign-reports.test.tsx` — 9 testes: listagem/filtros/decisão corrente, detalhe v1 × v2 + histórico + aprovação derivada e marcação revisado (16.6).

## Decisions Made

- O contrato real do NDJSON é `{ type: "result" }` (o PLAN citava `{ type: "done" }` como shorthand). O modal reconhece `result` como sucesso e `error` como falha — os mocks usam o literal real.
- Os gates foram assertados via as funções reais `computeApprovalState`/`isDeliveryReleased` (fonte única usada pelas duas rotas) + leitura de `download/route.ts` e `publication-copy/route.ts` do disco, evitando re-mockar a rota completa (espelha `campaign-download.test.ts`).
- O arquivo de UI foi criado como `campaign-approval-view-problem.test.tsx` para não sobrescrever os testes F37.1 já existentes em `campaign-approval-view.test.tsx`.
- 16.9 usa um `ReadableStream` real com um gate manual: a fase `image_generation` é enfileirada, o `result` fica preso até o teste assertar "Gerando a nova arte...", garantindo o estado de processamento de forma determinística.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Arquivo de teste da UI renomeado para não colidir com a suíte F37.1**
- **Found during:** Task 2
- **Issue:** O `files_modified` do PLAN listava `src/__tests__/api/campaign-approval-view.test.tsx`, que já existe com os testes F37.1 (17.1-17.5) — sobrescrevê-lo apagaria cobertura existente.
- **Fix:** Criado `src/__tests__/api/campaign-approval-view-problem.test.tsx` (conforme instrução explícita de execução), preservando o arquivo F37.1 intacto.
- **Files modified:** `src/__tests__/api/campaign-approval-view-problem.test.tsx` (novo)
- **Verification:** Suíte F37.1 e nova suíte passam juntas; typecheck limpo.
- **Committed in:** `70f482f4` (Task 2 commit)

**2. [Rule 1 - Bug] Literal do evento terminal NDJSON corrigido para `result`**
- **Found during:** Task 2
- **Issue:** O PLAN descrevia `{type:"done"}` como evento terminal; a implementação real emite `{type:"result"}` (rota + modal). Mockar `done` faria o modal não reconhecer o sucesso.
- **Fix:** Mocks NDJSON usam `{ type: "result", campaignId, campaignUrl }` e assertam `router.refresh()` no sucesso.
- **Files modified:** `src/__tests__/api/campaign-approval-view-problem.test.tsx`
- **Verification:** Teste de sucesso NDJSON verde (refresh + fechamento do modal).
- **Committed in:** `70f482f4` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Ambos necessários para não destruir cobertura existente e para alinhar os testes ao contrato real do NDJSON. Sem scope creep — apenas os 3 arquivos de teste previstos foram criados.

## Issues Encountered

- `getByText("Revisado")` colidia entre o cabeçalho da tabela e a célula da linha revisada; ajustado para `getAllByText(...).length >= 2`.
- `notFound` mockado como `(...args) => mockNotFound(...args)` gerou erro de typecheck (spread em função zero-arg); ajustado para `() => mockNotFound()`. Nenhum arquivo de aplicação foi alterado.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16.1-16.9 cobertos e verdes (46 testes, 3 arquivos); typecheck limpo.
- Pronto para o plano 37-2-18 (regressão e co-migração de fixtures) e 37-2-19 (verificação final).
- Nenhum bloqueio.

---
*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-11*
