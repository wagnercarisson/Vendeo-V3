---
phase: 36-onboarding-navegacao-por-abas
plan: 05
subsystem: ui
tags: [redirects, onboarding, tabs, readiness, nextjs]

requires:
  - phase: 36-04
    provides: parsing ?tab= no /loja (isOnboardingTab) + compat required= (D6/D12)
provides:
  - Guard /campanhas/nova redireciona para ?tab=dados&fiscal=pending / ?tab=direcao-visual&message=needs-visual-direction (com returnTo)
  - Pós-cadastro CNPJ (cadastro/cnpj + cnpj-update-form) redireciona para ?tab=dados&fiscal=pending ou ?tab=direcao-visual&message=cnpj-updated
  - ReadinessBanner e cnpj-update-banner apontam para targets ?tab= com mensagem contextual
  - Testes de redirect/banners migrados para ?tab= com 1 cenário de compat required=
affects: [36-06]

tech-stack:
  added: []
  patterns:
    - "Destino canônico de pendência: /loja?tab=<aba>&<param contextual> com returnTo preservado (encodeURIComponent)"

key-files:
  created: []
  modified:
    - src/app/(app)/campanhas/nova/page.tsx
    - src/app/(app)/cadastro/cnpj/page.tsx
    - src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx
    - src/components/readiness/readiness-banner.tsx
    - src/components/legacy/cnpj-update-banner.tsx
    - src/components/flow/__tests__/store-identity-form.redirect-messages.test.ts
    - src/components/readiness/__tests__/readiness-banner.test.tsx
    - src/app/(app)/cadastro/cnpj/__tests__/page.test.tsx

key-decisions:
  - "cnpj-update-form usa o estado de readiness/missing para decidir o destino pós-atualização: cadastro_fiscal pendente → ?tab=dados&fiscal=pending; brand_profile pendente → ?tab=direcao-visual&message=cnpj-updated; loja pronta → returnTo/dashboard (preservado)"

patterns-established:
  - "Banners e guards nunca perdem a mensagem contextual (fiscal=pending, message=needs-visual-direction, message=cnpj-updated) — o /loja exibe o banner na aba alvo (D12)"

requirements-completed:
  - F36-IDENTITY-UI-02
  - F36-READINESS-03

duration: 6min
completed: 2026-08-05
---

# Phase 36 Plan 05: Migração de Redirects e Banners para ?tab= Summary

**Todos os pontos de entrada de pendência (guard de geração, pós-cadastro CNPJ e banners do dashboard) migrados do hack `?required=` para targets canônicos `?tab=` do onboarding por abas, com `returnTo` e mensagens contextuais preservados — 5 arquivos de origem + 3 arquivos de teste atualizados**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-05T15:22:00Z
- **Completed:** 2026-08-05T15:28:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- **Guard `/campanhas/nova`** (F36-IDENTITY-UI-02): `cadastro_fiscal` → `/loja?tab=dados&fiscal=pending&returnTo=/campanhas/nova`; `brand_profile` → `/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova`. Import e lógica de `getStoreReadiness` intactos; sem localStorage/loading state novos.
- **Pós-cadastro CNPJ** (F36-READINESS-03): `cadastro/cnpj/page.tsx` redireciona para `/loja?tab=dados&fiscal=pending&returnTo=${returnTo}`; `cnpj-update-form.tsx` decide pelo readiness/missing — fiscal pendente → `?tab=dados&fiscal=pending`, brand profile pendente → `?tab=direcao-visual&message=cnpj-updated`, loja pronta → `returnTo`/`/dashboard` (comportamento original preservado).
- **Banners do dashboard**: `missingToDisplay` do ReadinessBanner emite `?tab=dados&fiscal=pending&returnTo=/dashboard` (cadastro_fiscal) e `?tab=direcao-visual&message=needs-visual-direction` (brand_profile); `cnpj-update-banner` aponta para `?tab=dados&fiscal=pending&returnTo=/dashboard`. Diff mínimo (apenas hrefs).
- **Testes migrados**: `readiness-banner.test.tsx` asserta as URLs canônicas `?tab=` (com decode de `&amp;` do renderToString); `store-identity-form.redirect-messages.test.ts` usa `tab=direcao-visual`/`tab=dados+fiscal=pending` como alvos primários e mantém exatamente 1 cenário de compat `required=visual-direction` → `direcao-visual` (D6), espelhando a resolução de `store-page-client`.
- **Compat `required=`**: zero targets ativos restantes nos arquivos de origem — apenas a nota de compat em `store-page-client.tsx` (36-04) e o cenário de teste de transição.

## Task Commits

1. **Task 1: Guard /campanhas/nova + redirect /cadastro/cnpj para ?tab=** - `3441054` (feat)
2. **Task 2: ReadinessBanner + cnpj-update-banner para ?tab=** - `c929e5d` (feat)
3. **Task 3: Atualizar testes existentes de redirect/banners** - `1e0a00a` (test)

**Plan metadata:** SUMMARY.md (docs) — commitado pelo orquestrador na sequência de tracking.

## Files Created/Modified

- `src/app/(app)/campanhas/nova/page.tsx` - Redirect do guard: `?tab=dados&fiscal=pending&returnTo=/campanhas/nova` e `?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova`
- `src/app/(app)/cadastro/cnpj/page.tsx` - Redirect pós-cadastro CNPJ: `/loja?tab=dados&fiscal=pending` com returnTo
- `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx` - Roteamento pós-atualização por estado de readiness (fiscal pendente / brand profile / pronto)
- `src/components/readiness/readiness-banner.tsx` - `missingToDisplay` com hrefs `?tab=` canônicos (D12)
- `src/components/legacy/cnpj-update-banner.tsx` - href → `/loja?tab=dados&fiscal=pending&returnTo=/dashboard`
- `src/components/flow/__tests__/store-identity-form.redirect-messages.test.ts` - Cenários `tab=` + 1 compat `required=visual-direction`
- `src/components/readiness/__tests__/readiness-banner.test.tsx` - Assert das URLs `?tab=` (com decodeHtml)
- `src/app/(app)/cadastro/cnpj/__tests__/page.test.tsx` - Test do redirect atualizado para `?tab=dados&fiscal=pending` (Rule 1)

## Decisions Made

- `cnpj-update-form` usa o estado de readiness/missing (já buscado no fluxo) para escolher o destino pós-atualização, seguindo a regra simples do plano: pendência fiscal primeiro → `?tab=dados&fiscal=pending`; senão brand profile → `?tab=direcao-visual&message=cnpj-updated`; loja pronta → `returnTo`/`/dashboard` (comportamento pré-existente mantido).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Path do `cnpj-update-form.tsx` corrigido**
- **Found during:** Task 1 (redirect /cadastro/cnpj)
- **Issue:** O plano lista `src/components/flow/cnpj-update-form.tsx`, mas o arquivo real fica em `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx` (já sinalizado no 36-PATTERNS.md como "see note in cadastro/cnpj/page.tsx")
- **Fix:** Alvo editado no caminho real; sem mudança de conteúdo além do redirect
- **Files modified:** src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx
- **Verification:** typecheck/lint limpos; suíte `cadastro/cnpj/__tests__/page.test.tsx` verde
- **Committed in:** 3441054 (Task 1)

**2. [Rule 1 - Bug] `cadastro/cnpj/__tests__/page.test.tsx` assertava o redirect antigo `?required=cadastro-fiscal`**
- **Found during:** Task 1 (redirect /cadastro/cnpj)
- **Issue:** A mudança da página para `?tab=dados&fiscal=pending` quebrava as 2 asserções do teste de redirect existente
- **Fix:** Expectativas atualizadas para `/loja?tab=dados&fiscal=pending&returnTo=%2Fdashboard` e `...returnTo=%2Fcampanhas%2Fnova`
- **Files modified:** src/app/(app)/cadastro/cnpj/__tests__/page.test.tsx
- **Verification:** 2 testes verdes
- **Committed in:** 3441054 (Task 1)

---

**Total deviations:** 2 auto-fixed (1 blocking — path do arquivo; 1 bug — teste de redirect quebrado pela mudança)
**Impact on plan:** Corretivos necessários para o plano funcionar como escrito (caminho real do arquivo) e para a suíte não regredir. Sem escopo creep.

## Issues Encountered

- `renderToString` do React escapa `&` → `&amp;` nos hrefs renderizados, fazendo as asserções de URL canônica falharem — resolvido com helper `decodeHtml` no teste do ReadinessBanner (assert sobre a URL decodificada, mantendo as strings canônicas no teste).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Todos os fluxos de entrada (guard de geração, pós-cadastro CNPJ, banners do dashboard) apontam para targets `?tab=` canônicos com `returnTo` e mensagens contextuais preservados.
- Compat `required=` legado continua aceito pelo `/loja` (36-04) e coberto por 1 teste de transição.
- Pronto para **36-06** (testes de endpoint/gates/draft→fiscal, regressão, checkpoint humano).
- ⚠️ BLOQUEADOR pendente (36-01): `supabase db push` (migration `create_store_draft`) deve ser aplicado pelo usuário antes da verificação final — necessário para o modo draft da rota em runtime.

## Self-Check: PASSED

- [x] `src/app/(app)/campanhas/nova/page.tsx` contém `tab=dados&fiscal=pending` (grep OK)
- [x] `src/app/(app)/cadastro/cnpj/page.tsx` contém `tab=dados&fiscal=pending` (grep OK)
- [x] `src/components/readiness/readiness-banner.tsx` contém `tab=direcao-visual&message=needs-visual-direction` (grep OK)
- [x] Commits: 3441054, c929e5d, 1e0a00a (git log OK)
- [x] `npm run typecheck` limpo | `npm run lint` limpo
- [x] 3 suítes verdes (12 testes): redirect-messages, readiness-banner, cadastro/cnpj page

---

*Phase: 36-onboarding-navegacao-por-abas*
*Completed: 2026-08-05*
