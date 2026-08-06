---
phase: 36-onboarding-navegacao-por-abas
plan: 04
subsystem: ui
tags: [react, a11y, tabs, legal, onboarding, nextjs]

requires:
  - phase: 36-02
    provides: tabs.ts / tab-state.ts / draft-store.ts (pure contracts — OnboardingTab, computeTabUnlock, computeTabState, StoreDraft)
  - phase: 36-03
    provides: use-onboarding-tabs (activeTab/setActiveTab/tabStates/saveStatus + popstate + drift callbacks), autoSave/saveStatus em use-store-form
provides:
  - StoreTabs (ARIA tablist/tab/tabpanel + roving tabindex + variante mobile compacta)
  - LegalAcceptancePanel (coluna lateral global D3 + enum LegalAcceptanceState)
  - store-identity-form refatorado para painel 3 abas consumindo useOnboardingTabs
  - store-page-client parsing ?tab= + compat required= + loja/page.tsx userId
affects: [36-05, 36-06]

> **D16 — supersede (pós-implementação):** este plano descreve o comportamento **soft-block** original (aba bloqueada renderizava painel de motivo + link "Voltar para X", motivo APENAS no painel ativo, formulário da aba bloqueada editável). Tudo isso foi **substituído pelo hard-block (D16)** por decisão de produto pós-UAT. Fonte da verdade atual: `openspec/.../design.md` (seção D16) + specs. Linhas deste arquivo com "painel ativo", "'Voltar para X'" e "bloqueio" referem-se ao estado a implementar — re-verificar conforme D16.

tech-stack:
  added: []
  patterns:
    - "ARIA tabs (tablist/tab/tabpanel, roving tabindex, aria-disabled + motivo no botão, aria-live) — hard-block D16"
    - "Aceite legal como coluna lateral global (desktop sticky / mobile compacto)"
    - "Deep-link em aba bloqueada → redireciona/sincroniza para a primeira aba anterior válida + aviso (D16)"

key-files:
  created:
    - src/components/flow/store-tabs.tsx
    - src/components/flow/legal-acceptance-panel.tsx
  modified:
    - src/components/flow/store-identity-form.tsx
    - src/components/flow/store-page-client.tsx
    - src/app/(app)/loja/page.tsx

key-decisions:
  - "StoreTabs recebe children (painel ativo renderizado pelo form); **D16 (hard-block): aba bloqueada não fica ativa e o motivo fica acessível no próprio botão (tooltip/aria-label/aria-describedby) — nunca no painel ativo**"
  - "LegalAcceptancePanel recebe acceptance via prop (derivação no form via getAcceptanceStatus — current→accepted, outdated→needs_reacceptance, never→pending)"
  - "Drift preservado: modais DriftDecisionModal/DriftCriticalModal + executeStep2Save intactos; interceptação orquestrada pelo hook (onDriftNavigate/onDriftLeave); flags driftSaveIntercept/driftNavIntercept/pendingNavUrl permanecem no componente"
  - "acceptedTerms/setAcceptedTerms agora vêm de useStoreForm (fonte única p/ autoSave mínimo válido)"

patterns-established:
  - "Refatoração wizard→abas preserva blocos críticos (drift modals, executeStep2Save, lookup CNPJ, upload logo) como unidade"

requirements-completed:
  - F36-TABS-03
  - F36-TABS-04
  - F36-TABS-05
  - F36-LEGAL-01
  - F36-LEGAL-02
  - F36-IDENTITY-UI-01
  - F36-IDENTITY-UI-03
  - F36-IDENTITY-UI-04
  - F36-IDENTITY-UI-05
  - F36-IDENTITY-UI-06
  - F36-IDENTITY-UI-07

duration: 45min
completed: 2026-08-05
---

# Phase 36 Plan 04: Onboarding por Abas — UI Summary

**StoreTabs ARIA + LegalAcceptancePanel + refatoração do wizard 2-steps para painel de 3 abas consumindo useOnboardingTabs, com parsing de `?tab=` e composição em /loja**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-05T15:00:00Z
- **Completed:** 2026-08-05T15:45:00Z
- **Tasks:** 3 (executadas em 3 segmentos)
- **Files modified:** 5

## Accomplishments

- **StoreTabs**: container ARIA tabs completo (`role="tablist"/"tab"/"tabpanel"`, `aria-selected`/`aria-controls`/`aria-describedby`/`aria-live`), roving tabindex com ArrowLeft/ArrowRight (circular) + Home/End, badge por estado via `aria-label` (nunca cor sozinha), variante mobile-compact com labels `labelMobile` (Dados/Perfil/Visual), ponto discreto, botão "Continuar" fixo e touch targets ≥ 44px (F22).
- **LegalAcceptancePanel**: coluna lateral global (D3) — desktop `lg:sticky top-6` dentro do grid, mobile compacto sem sticky; enum `LegalAcceptanceState` (`pending`/`accepted`/`needs_reacceptance`); CTA "Revisar e aceitar"/"Revisar aceite" com `aria-expanded`/`aria-pressed`; recebe estado via prop (derivação no form).
- **store-identity-form refatorado**: wizard 2 steps → painel 3 abas (dados/posicionamento/direcao-visual) consumindo `useOnboardingTabs` (36-03); aceite legal removido do formulário e movido para a coluna global; CNPJ opcional (máscara + lookup `GET /api/cnpj/lookup` mantidos, aviso "Fiscal pendente"); restauração de rascunho via `restoreDraft` no auto-load (banco prevalece em campos persistidos); **deep-link em aba bloqueada NÃO ativa a aba — redireciona/sincroniza para a primeira aba anterior válida + aviso "Complete esta etapa para liberar {aba}" (D16)**; microcopy card na aba Posicionamento (D9); badge "Necessário" mantido na aba Direção Visual (D7).
- **store-page-client + loja/page**: parsing de `?tab=` (validado por `isOnboardingTab`) com resolução `?tab=` → compat `required=` → default `dados`; `fiscal=pending` → `fiscalPending` (banner na aba Dados); `message=` preservado; `userId` repassado para `restoreDraft`; sem leitura/escrita de `localStorage("store_id")`.
- **Drift preservado (D13)**: modais `DriftDecisionModal`/`DriftCriticalModal` e `executeStep2Save` pós-decisão intactos; interceptação de saída orquestrada pelo hook (`options.onDriftNavigate`/`onDriftLeave`); `use-drift-detection.ts` byte-idêntico (git diff vazio); endpoints de realinhar/ignorar/dismiss inalterados.

## Task Commits

1. **Task 1: StoreTabs + LegalAcceptancePanel** - `e3b065f` (feat)
2. **Task 2: store-page-client ?tab= + loja/page composition** - `80a47a7` (feat)
3. **Task 3: store-identity-form wizard→painel 3 abas** - `db27591` (feat)

**Plan metadata:** SUMMARY.md (docs) — commitado pelo orquestrador na sequência de tracking.

## Files Created/Modified

- `src/components/flow/store-tabs.tsx` - Container ARIA tabs (tablist/tab/tabpanel, roving tabindex, aria-describedby, aria-live, badges, variante mobile compacta com "Continuar" fixo)
- `src/components/flow/legal-acceptance-panel.tsx` - Coluna lateral global de aceite legal (D3), enum LegalAcceptanceState, CTA com aria-expanded
- `src/components/flow/store-identity-form.tsx` - Refatoração central: wizard→3 abas, aceite global, CNPJ opcional, restauração de draft, drift preservado
- `src/components/flow/store-page-client.tsx` - Parsing `?tab=` + compat `required=` + `fiscal=`/`message=`
- `src/app/(app)/loja/page.tsx` - Repassa `userId` ao client

## Decisions Made

- `StoreTabs` recebe `children` (painel ativo) — **D16 (hard-block): aba bloqueada NUNCA vira painel ativo; o motivo fica acessível no próprio botão (aria-label/aria-describedby/tooltip) e o clique/seta nela não dispara `onTabChange`.**
- `LegalAcceptancePanel` é presentacional: recebe `acceptance` via prop; a derivação via `getAcceptanceStatus` (current→accepted, outdated→needs_reacceptance, never→pending) acontece no form (task 3).
- `acceptedTerms`/`setAcceptedTerms` agora vêm de `useStoreForm` (fonte única) para que o mínimo válido do `autoSave` (POST draft) reflita o aceite confirmado no modal — a 36-03 já havia adicionado esse par ao hook.
- Drift: o caminho de save (botão Salvar da Direção Visual) mantém `executeStep2Save` pós-decisão; o caminho de saída de contexto (troca de aba/navegação/back-forward) deixa a navegação para o resume do hook (ref `driftFromSaveRef`), evitando dupla gravação.

## Deviations from Plan

- **None - plan executed as written.** (As duas primeiras tentativas de subagente retornaram vazias; a task 3 foi executada inline pelo orquestrador, seguindo o fallback de runtime — sem desvio de conteúdo.)

## Issues Encountered

- Subagente `gsd-executor` retornou vazio (sem commits/SUMMARY) ao tentar o plano 36-04 inteiro e a task 3 isolada — o runtime não retornou o sinal de conclusão. Resolvido via segmentação (tasks 1 e 2 por subagente; task 3 inline no orquestrador), conforme fallback de runtime do workflow.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para **36-05** (redirects/banners → `?tab=`) e **36-06** (testes de componente/hook + regressão + checkpoint humano).
- ⚠️ BLOQUEADOR pendente (36-01): `supabase db push` (migration `create_store_draft`) deve ser aplicado pelo usuário antes da verificação final — necessário para o modo draft da rota em runtime.

---

*Phase: 36-onboarding-navegacao-por-abas*
*Completed: 2026-08-05*
