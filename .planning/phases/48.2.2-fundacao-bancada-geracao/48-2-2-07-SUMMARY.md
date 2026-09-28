---
phase: 48.2.2-fundacao-bancada-geracao
plan: 48-2-2-07
subsystem: ui
tags: [next.js, react, tailwind, lucide-react, lab, bancada, ndjson, vitest, testing-library]

# Dependency graph
requires:
  - phase: 48.2.2
    provides: API administrativa da bancada (`/api/admin/laboratorio/bancada/{stores,branding,presets,estimate,inputs,runs,runs/[id]}`), signer restrito de branding e presets habilitados (planos 03/04/06)
  - phase: 48.1
    provides: primitivos locais do laboratório (`lab-select`, `lab-textarea`, `lab-table`, `confirm-dialog`, `disabled-notice`) e padrão de painel de execução NDJSON
provides:
  - Página `/admin/laboratorio/bancada` (server) com guarda de ambiente e leitura server-side de lojas/presets
  - Entrada "Bancada" na navegação interna do laboratório (sem segundo link na nav principal)
  - Contêiner cliente `BenchWorkbench` (operationId estável por fingerprint + runId/references elevados do upload em draft)
  - Painéis de branding (somente leitura, com direção tipográfica), produto/oferta, upload multipart, prompt manual, formato/modelo/qualidade com dimensões travadas, estimativa, execução NDJSON, resultado/download e evidências
  - Suíte de contrato de UI `bench-ui.contract.test.tsx` (17 testes verdes)
affects: [48-2-2-08, 48.2.3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server page + contêiner cliente: a página lê server-side e um componente cliente coordena estado entre painéis"
    - "operationId estável por fingerprint (arquivos+loja) elevado do upload em draft para a confirmação"
    - "Stream NDJSON consumido com exatamente um evento terminal (done/error)"
    - "Testes de contrato de UI em jsdom com fetch mockado; nenhuma chamada de rede/provider"
    - "Custo exibido por cobertura (complete/partial/missing) via formatCostByCoverage"

key-files:
  created:
    - src/app/(app)/admin/laboratorio/bancada/page.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-store-selector.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-branding-panel.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-campaign-form.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-image-upload.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-prompt-editor.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-preset-selector.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-estimate-panel.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-execution-panel.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-evidence-panel.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx
  modified:
    - src/app/(app)/admin/laboratorio/layout.tsx

key-decisions:
  - "Contêiner cliente dedicado (BenchWorkbench) criado porque a página é server component e o fluxo upload→runId→execução exige estado compartilhado entre painéis"
  - "operationId gerado pelo contêiner por fingerprint (arquivos+loja) e reutilizado entre upload e confirmação; trocar de loja invalida o draft"
  - "Estimativa é buscada no clique em 'Gerar imagem' e exibida antes da confirmação; partial nunca vira valor exato"
  - "Painel de evidências busca o detalhe do run após o terminal e baixa por URL assinada (nenhum bucket/path do cliente)"
  - "Nenhuma ação de cancelamento de geração ativa na UI; mensagem de concorrência orienta aguardar (reconciliação automática)"

patterns-established:
  - "Bancada UI: server page + contêiner cliente + painéis finos com data-testid estáveis"
  - "Contrato de UI travado por testes de componente (jsdom + fetch mockado) e greps de fonte para proibições"

requirements-completed: [lab-admin-ui, lab-generation-bench]

# Metrics
duration: 18min
completed: 2026-09-28
---

# Phase 48.2.2 Plan 48-2-2-07: UI desktop da bancada de geração Summary

**Bancada desktop em `/admin/laboratorio/bancada` com fluxo completo (loja → branding → produto/oferta → upload em draft → prompt → formato/modelo/qualidade → estimativa → confirmação → execução NDJSON → resultado/download → evidências), estado de ambiente desabilitado sem acesso a dados e sem promessa de cancelamento.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-09-28T20:55:00Z (aprox.)
- **Completed:** 2026-09-28T21:13:26Z
- **Tasks:** 3
- **Files modified:** 13 (12 criados + 1 modificado)

## Accomplishments
- Página `/admin/laboratorio/bancada` (server component) com `getLabEnvironment()` → `<DisabledNotice reason>` no caminho bloqueado, sem tocar tabelas/storage/provider; leitura server-side de lojas (`listBenchTestStores`) e presets (`listBenchPresets`) apenas no caminho habilitado.
- Entrada "Bancada" adicionada a `LAB_NAV_ITEMS` — um único link "Laboratório" na navegação principal permanece intacto (nenhum arquivo de nav principal modificado).
- Fluxo mínimo completo: seletor de loja de teste, branding somente leitura (com **direção tipográfica** e logo/assinatura por URL assinada), formulário produto/oferta com validação no blur, upload multipart que cria o run em **`draft`** (`bench/{runId}/inputs/...` em `lab-artifacts`), prompt manual (sem concatenar branding), formato/modelo/qualidade com dimensões travadas como badges e preset desabilitado com motivo.
- Estimativa com cobertura (`complete`/`partial` → "a partir de US$ X"/`missing` → "indisponível"), confirmação explícita ("Confirmar geração", `confirmed: true`), execução via `POST /runs` com `operationId`/`runId`/`references` do upload e stream NDJSON de **um único** terminal, resultado com download por URL assinada e painel de evidências distinguindo usage/calculado/estimado.
- Suíte de contrato de UI com **17 testes verdes**; `npm run typecheck` exit 0 e `npm run lint` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Página + navegação interna + estado desabilitado** - `70514b91` (feat)
2. **Task 2: Branding, produto/oferta, upload em draft, prompt e presets** - `bbbe8d86` (feat)
3. **Task 3: Estimativa, confirmação, execução NDJSON, resultado e evidências** - `02d61517` (feat)

**Plan metadata:** (commit de metadados deste plano)

## Files Created/Modified
- `src/app/(app)/admin/laboratorio/layout.tsx` - item "Bancada" em `LAB_NAV_ITEMS` (guarda e `<nav>` intactos)
- `src/app/(app)/admin/laboratorio/bancada/page.tsx` - server page com guarda de ambiente e leitura server-side
- `.../bancada/_components/bench-workbench.tsx` - contêiner cliente (operationId/runId, coordenação dos painéis)
- `.../bancada/_components/bench-store-selector.tsx` - seletor "Loja de teste" (reusa `lab-select`)
- `.../bancada/_components/bench-branding-panel.tsx` - branding completo somente leitura (inclui "Direção tipográfica")
- `.../bancada/_components/bench-campaign-form.tsx` - formulário produto/oferta com validação no blur
- `.../bancada/_components/bench-image-upload.tsx` - upload multipart para `/inputs` (draft) + metadados
- `.../bancada/_components/bench-prompt-editor.tsx` - editor manual de "Prompt"
- `.../bancada/_components/bench-preset-selector.tsx` - Formato/Modelo/Qualidade + dimensões travadas
- `.../bancada/_components/bench-estimate-panel.tsx` - estimativa por cobertura (`formatCostByCoverage`)
- `.../bancada/_components/bench-execution-panel.tsx` - Gerar imagem/Confirmar geração + NDJSON de terminal único
- `.../bancada/_components/bench-evidence-panel.tsx` - evidências (prompt/config/latência/usage/custo/erro) + download
- `.../bancada/_components/__tests__/bench-ui.contract.test.tsx` - contrato de UI (17 testes)

## Decisions Made
- **Contêiner cliente dedicado:** a página é server component (guarda de ambiente + leitura server-side obrigatórias por contrato); o estado compartilhado (operationId/runId/references) exige um contêiner cliente. Criado `bench-workbench.tsx` e estendido nas Tasks 2 e 3.
- **operationId por fingerprint:** o contêiner mantém `{ id, fingerprint }`; o upload usa `getOperationId(fingerprint de arquivos+loja)` e reporta o `operationId` ao contêiner, que o repassa à execução — garantindo que o `POST /runs` resolva o mesmo draft criado no upload. Trocar de loja invalida o upload/draft.
- **Estimativa no clique:** "Gerar imagem" busca `GET /estimate` e exibe o painel de estimativa antes de abrir a confirmação; `partial`/`missing` não bloqueiam.
- **Evidências após o terminal:** o contêiner busca `GET /runs/[id]` ao concluir e renderiza o painel de evidências com download por URL assinada.
- **Sem cancelamento:** nenhuma ação de cancelamento de geração ativa; a mensagem de `bench_run_already_active` orienta aguardar (recuperação automática por reconciliação).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Criado contêiner cliente `bench-workbench.tsx` (não listado em `<files>`)**
- **Found during:** Task 1 (planejamento da página) e aplicado nas Tasks 2 e 3
- **Issue:** o objetivo do plano exige um contêiner que "mantém um `operationId` estável (reutilizado por fingerprint) e eleva o `runId` devolvido pelo upload (draft)". A página é, por contrato de aceitação, um **server component** (`getLabEnvironment()` + `<DisabledNotice>` + leitura server-side), portanto não pode manter estado. Sem um contêiner cliente, o fluxo upload → `runId`/`references` → `POST /runs` não funciona.
- **Fix:** criado `bancada/_components/bench-workbench.tsx` como contêiner cliente (dono de `storeId`, `branding`, `campaign`, `prompt`, `presetId`, `upload`, `runId`/`references`/`operationId` e das evidências) e estendido nas Tasks 2 e 3.
- **Files modified:** `src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx` (criado; modificado nas Tasks 2 e 3)
- **Verification:** `npm run typecheck` exit 0; `bench-ui.contract.test.tsx` verde; `git diff --name-only` não lista a navegação principal do admin.
- **Committed in:** `70514b91` (Task 1), estendido em `bbbe8d86` (Task 2) e `02d61517` (Task 3)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessário para que o fluxo mínimo exigido pelo plano funcione ponta a ponta. Nenhuma mudança de escopo: os 12 arquivos nomeados no plano foram entregues e o contêiner é um primitivo de UI fino e coeso.

## Issues Encountered
- Caminho relativo do import de `disabled-notice` na página (ajustado de `../../` para `../` na Task 1) — corrigido antes do commit da Task 1.
- O botão de confirmação do primitivo `confirm-dialog` usa `data-testid="lab-confirm-button"` (contrato do primitivo reutilizado); os testes foram ajustados para esse testid.
- Caractere "→" em comentários disparava o detector de emoji dos testes de fonte; substituído por texto.
- `gsd-sdk query state.update-progress` retornou `Progress field not found in STATE.md` (handler incompatível com o STATE.md compacto deste projeto); o STATE.md foi atualizado manualmente e `gsd-sdk query roadmap.update-plan-progress 48.2.2` atualizou o ROADMAP (8 planos / 7 summaries, "In Progress").

## User Setup Required
None - no external service configuration required. Nenhuma chamada paga foi executada e nenhum provider foi tocado; o upload usa o Supabase local (bancada desabilitada fora do ambiente local).

## Next Phase Readiness
- UI da bancada operável ponta a ponta com segurança financeira visível (estimativa + confirmação) e evidência completa; pronta para `48-2-2-08` (testes transversais + UAT local/CHECKPOINT 3).
- Nenhuma dependência nova de UI; apenas `lucide-react` (já presente) e primitivos existentes.
- Produção intocada: nenhum arquivo de navegação principal, nenhum bucket `campaign-images`, nenhuma rota de cancelamento.

## Self-Check: PASSED

---
*Phase: 48.2.2-fundacao-bancada-geracao*
*Completed: 2026-09-28*
