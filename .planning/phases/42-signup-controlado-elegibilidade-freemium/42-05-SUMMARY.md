---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 05
subsystem: admin
tags: [admin, reviews, labels, d11, verification, freemium]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: Motor de elegibilidade revisado (42-04) que emite os novos motivos `situacao_nao_ativa`, `localizacao_oficial_indisponivel`, `segmento_cnae_divergente`, `dados_oficiais_incompletos`
provides:
  - 4 novos labels de motivo em VERIFICATION_REASON_LABELS (D11) com `situacao_suspensa` mantido como legado (D8)
  - ReviewDetail (informado × oficial): razão social, nome fantasia, similaridade %, cidade/UF, CNAE + descrição, situação cadastral original, histórico de raiz
  - Filtro `?reason=` aceita os novos motivos; defer com label (sem motivo cru); ReviewActions intactas
affects: [42-17 (testes admin), 42-19 (regressão), 42-20 (UAT admin)]

# Tech tracking
tech-stack:
  added: []
  patterns: [expansão de labels via getLabel, componente presentacional server de revisão com MASTER tokens, query adicional de histórico de raiz por cnpj_root_hash]

key-files:
  created: [src/app/(app)/admin/reviews/review-detail.tsx]
  modified: [src/lib/admin/labels.ts, src/lib/admin/__tests__/labels.test.ts, src/app/(app)/admin/reviews/page.tsx]

key-decisions:
  - "4 novos labels de motivo adicionados (situacao_nao_ativa, localizacao_oficial_indisponivel, segmento_cnae_divergente, dados_oficiais_incompletos); situacao_suspensa permanece como legado histórico (D8)"
  - "ReviewDetail é componente server presentacional integrado por linha via <details> (accordion) — não quebra tabela/tabs/filtro/ReviewActions"

patterns-established:
  - "Badges de motivo sempre via getLabel(VERIFICATION_REASON_LABELS, r) — nunca motivo cru; filtro por motivo via contains('verification_reasons', [reason]) sem lista fixa"

requirements-completed: ["admin-reviews"]

# Metrics
duration: 18min
completed: 2026-08-17
---

# Phase 42 Plan 05: Admin — Labels D11 + ReviewDetail informado × oficial

**4 novos labels de motivo de revisão (D11) + componente ReviewDetail com visão informado × oficial (razão social, fantasia, similaridade %, cidade/UF, CNAE + descrição, situação cadastral original, histórico de raiz) integrado à fila /admin/reviews por accordion, mantendo situacao_suspensa legado e ações existentes intactas**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-17T20:30:00Z
- **Completed:** 2026-08-17T20:48:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- **Task 1 (TDD):** 4 novos labels em `VERIFICATION_REASON_LABELS` com textos exatos do D11; `situacao_suspensa` preservado (D8). Testes RED→GREEN (40/40 no labels.test.ts).
- **Task 2:** `review-detail.tsx` criado (server presentacional, MASTER tokens) exibindo informado × oficial: nome, cidade/UF informadas (colunas `city`/`state`), segmento, similaridade % (via `compareBusinessName`), razão social, nome fantasia, cidade/UF oficiais, situação cadastral original, CNAE principal + descrição, histórico de raiz (via `freemium_entitlements` por `cnpj_root_hash`). Integrado em `reviews/page.tsx` por linha via `<details>`/`<summary>` sem quebrar tabela, badges, tabs, filtro ou `ReviewActions`.
- **Task 3:** Filtro `?reason=` confirmado aceitando os novos motivos (usa `contains("verification_reasons", [reasonFilter])` — sem lista fixa); badge de defer renderiza label via `getLabel` (nunca motivo cru); `ReviewActions` inalterado.

## Task Commits

1. **Task 1 (RED): Testes dos 4 novos labels** - `36f40f9` (test)
2. **Task 1 (GREEN): Implementação dos 4 novos labels** - `3582d2e` (feat)
3. **Task 2+3: ReviewDetail informado × oficial + integração + filtro/label** - `c041844` (feat)

## Files Created/Modified
- `src/lib/admin/labels.ts` - 4 novos labels em VERIFICATION_REASON_LABELS (situacao_nao_ativa, localizacao_oficial_indisponivel, segmento_cnae_divergente, dados_oficiais_incompletos)
- `src/lib/admin/__tests__/labels.test.ts` - 5 novos testes (4 labels + legado + getLabel)
- `src/app/(app)/admin/reviews/review-detail.tsx` - NOVO componente presentacional informado × oficial com histórico de raiz
- `src/app/(app)/admin/reviews/page.tsx` - select estendido (city, state, segment, cnpj_root_hash), query de freemium_entitlements por root, integração do ReviewDetail por linha

## Decisions Made
- Segui o plano conforme especificado. `verification_data` armazena apenas `{signals, score}` — cidade/UF informadas foram lidas das colunas `city`/`state` da store (não do verification_data), conforme padrão de dados real.

## Deviations from Plan

Nenhuma — plano executado como escrito. (Nota: a rota `store/route.ts` persiste `verification_data = { signals, score }` sem cidade/UF informadas; o ReviewDetail usa as colunas `city`/`state`/`segment` da store para a visão "informado", que é a fonte real desses dados.)

## Issues Encountered
- O executor subagente retornou vazio duas vezes sem executar (problema de runtime); o plano foi executado inline pelo orquestrador como fallback. Sem impacto no resultado.

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Admin de revisão pronto para consumir os novos motivos do motor (42-04); 42-17 (testes admin 47-53) pode testar labels novos+legado, visão informado × oficial, filtro e defer com label.
- 42-19 (regressão) cobre landing/login/risk-service co-migrados; 42-20 UAT admin (20.13).

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*