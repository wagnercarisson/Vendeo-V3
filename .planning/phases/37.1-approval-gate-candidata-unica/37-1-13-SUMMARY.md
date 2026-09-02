---
phase: 37.1-approval-gate-candidata-unica
plan: 13
subsystem: testing
tags: [approval-view, tests, campaign-page, ui, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (tasks.md seção 17, spec campaign-page-ui) + CampaignApprovalView/client/page (37-1-09)
provides:
  - Testes 17.1-17.5 da UI de revisão (copy oculto, aprovar→refresh, só candidata, fonte da arte, "Corrigir" ausente sem dialog)
  - Co-migração campaign-page.test.tsx (pending → CampaignApprovalView; sem approval → ReadyView)
  - Co-migração campaign-page-server.test.tsx (page.tsx deriva candidateVersionId apenas em pending; legacy/flag off sem approval)
affects: [37-1-14 (regressão), 37-1-15 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [component tests with testing-library (jsdom), fireEvent (sem user-event instalado), server component derivation mocks]

key-files:
  created: [src/__tests__/api/campaign-approval-view.test.tsx]
  modified: [src/__tests__/api/campaign-page.test.tsx, src/__tests__/api/campaign-page-server.test.tsx]

key-decisions:
  - "Uso de fireEvent (não user-event) — user-event não está instalado no projeto"
  - "Teste 17.5: queryByRole('dialog') → null em qualquer interação (nenhum modal de correção)"

patterns-established:
  - "Teste de componente de revisão: mock useRouter + fetch global; negativo via queryByRole (não getByRole)"

requirements-completed: [F37.1-24]

# Metrics
duration: 30min
completed: 2026-09-01
---

# Phase 37.1 Plan 13: Testes UI de revisão + co-migração de páginas Summary

**Testes 17.1-17.5 da UI de revisão (tasks.md seção 17): copy oculto até aprovar (17.1), aprovar chama `POST /api/campaign/c1/approve` com `{ versionId: "v1" }` + `router.refresh()` (17.2), apenas a candidata ativa sem histórico recuperável (17.3), fonte da arte via prop imageUrl (17.4), botão "Corrigir" ausente e nenhum dialog em qualquer interação (17.5); suítes `campaign-page.test.tsx`/`campaign-page-server.test.tsx` co-migradas para a prop `approval` — 18/18 testes verdes**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 3 (1 criado + 2 co-migrados)

## Accomplishments

- **Task 1 — Testes 17.1-17.4 (copy oculto, aprovar, só candidata, fonte da arte):**
  - Criado `src/__tests__/api/campaign-approval-view.test.tsx` (jsdom, testing-library, `fireEvent` — `@testing-library/user-event` não instalado no projeto; uso de `fireEvent` em vez de adicionar dependência)
  - **17.1:** a revisão NÃO renderiza "Kit de Publicação", "Baixar" nem "Copiar" (copy oculto até aprovar — D2)
  - **17.2:** clicar em "Aprovar e liberar campanha" → `fetch("/api/campaign/c1/approve", { method: "POST", headers, body: JSON.stringify({ versionId: "v1" }) })` e `router.refresh()` chamado (via `waitFor`)
  - **17.3:** apenas a imagem da candidata (alt=productName); `queryByRole("list")` e "versão" ausentes (sem histórico recuperável — decisão 12)
  - **17.4:** a revisão usa `src={imageUrl}` (candidata ativa via prop)
  - **17.5:** `queryByRole("button", { name: /corrigir/i })` → null (ausente); `queryByRole("dialog")` → null antes E depois da interação de aprovar (nenhum modal de correção — decisão 3/D12)
- **Task 2 — Co-migração campaign-page/campaign-page-server:**
  - **`campaign-page.test.tsx`**: novo describe "approval (F37.1)" — fixture com `approval: { state: { status: "pending" }, candidateImageUrl, candidateVersionId }` → renderiza `CampaignApprovalView` ("Aprovar e liberar campanha" + microcopy visíveis); fixture sem approval → `ReadyView` ("Baixar" presente, "Aprovar e liberar campanha" ausente via `queryByRole`); assert negativo corrigido para `queryByRole` (getByRole lança quando ausente)
  - **`campaign-page-server.test.tsx`**: mocks adicionados de `isCampaignApprovalEnabled`/`listArtVersions`/`computeApprovalState`/`getActiveCandidateArtVersion` (display) + `listArtVersions` (persistence); cenários — pending: `props.approval.candidateVersionId = "version-1"` + `candidateImageUrl` (signed URL); legacy (flag on + `[]`): `props.approval` ausente; flag off (not_enabled): `props.approval` ausente (legado usa `campaigns.storage_path`)
- **Verificação de aceitação:** `npx vitest run` das 3 suítes — **18/18 PASS** (approval-view 5, page 8, page-server 5); typecheck com erros apenas em `display.test.ts` (37-1-14); lint sem warnings/errors.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Testes 17.1-17.4 — copy oculto, copy pós-aprovação, só candidata, fonte da arte** - `ca9c05bb` (test)
2. **Task 2: Teste 17.5 (Corrigir ausente) + co-migração campaign-page/campaign-page-server** - `ca9c05bb` (test, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/api/campaign-approval-view.test.tsx` - Testes 17.1-17.5 da UI de revisão
- `src/__tests__/api/campaign-page.test.tsx` - Co-migração: pending → CampaignApprovalView; sem approval → ReadyView
- `src/__tests__/api/campaign-page-server.test.tsx` - Co-migração: page.tsx deriva candidateVersionId apenas em pending

## Decisions Made

- Uso de `fireEvent` em vez de `@testing-library/user-event` (não instalado — sem dependência nova)
- Negativos via `queryByRole` (getByRole lança quando o elemento não existe)
- Teste 17.5 verifica ausência de dialog antes e depois da interação de aprovar

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. Ajuste técnico: `fireEvent` no lugar de `user-event` (biblioteca não instalada; sem adicionar dependência).

## Issues Encountered

- `@testing-library/user-event` não instalado → falha de transform na primeira execução; resolvido com `fireEvent` (já disponível em `@testing-library/react`)
- Assert negativo com `getByRole(...).not.toBeInTheDocument()` lançava `TestingLibraryElementError` → corrigido para `queryByRole` (padrão testing-library)

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Revisão sem entrega/copy; aprovar → POST correto + router.refresh; apenas a candidata ativa; fonte da arte correta
- "Corrigir" ausente — nenhum dialog de correção abre
- Página co-migrada: pending → CampaignApprovalView; approved/legacy/not_enabled → ReadyView
- Próximo: **37-1-14** (regressão completa + co-migração das fixtures de CampaignRecord em `display.test.ts` e demais)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
