---
phase: 43-revisao-brief-pre-geracao
plan: 11
subsystem: testing
tags: [ui-tests, campaign-brief-review, sections, labels, a11y, d6, d7]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (tasks.md §11 — Testes 11-16)
  - phase: 43-04 (UI revisão)
    provides: CampaignBriefReview (seções, rótulos, custo, loja, ações, estados)
provides:
  - Suíte de testes 11-16 da tela de revisão do brief (campaign-brief-review.test.tsx)
affects: [43-14 (regressão), 43-15 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [render de componente client com useOperationCosts mockado, verificação de classes a11y (min-h-44px/object-contain/aspect-square)]

key-files:
  created: [src/components/flow/__tests__/campaign-brief-review.test.tsx]
  modified: []

key-decisions:
  - "StoreIdentityBlock com identity null não renderiza o bloco — sem fallback visual divergente (decisão 2026-08-21 verificada no teste 12)"

patterns-established:
  - "Cobertura D6/D7/D3 no nível da tela de revisão"

requirements-completed: [F43-27]

# Metrics
duration: 35min
completed: 2026-08-21
---

# Plan 43-11: Testes 11-16 UI do Resumo Summary

**Suíte de testes 11-16 da tela de revisão do brief (`campaign-brief-review.test.tsx`): seções Produto/Oferta/Imagens/Avisos/Custo renderizam com os valores, loja/marca + rótulos Principal/Referência, custo/saldo + Tema reservado, botões a11y ≥44px, estados de preparação/erro e preview sem recorte (D6/D7/D3)**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 1
- **Files modified:** 1 (criado)

## Accomplishments
- **Teste 11 (D6):** seções Produto (nome+descrição), Oferta (tipo/badge/preços BRL/validade "até 30/09/2026"), Imagens (Principal/Referência), Avisos (ilustrativo + texto obrigatório) e Custo renderizam com os valores do brief
- **Teste 12 (D6):** loja/marca no topo — verificado que `StoreIdentityBlock` com `identity={null}` **não** renderiza fallback visual divergente (decisão 2026-08-21); rótulos "Principal"/"Referência" nas 2 thumbnails
- **Teste 13 (D6):** "Vai consumir 1 crédito(s)" + saldo exibidos; **Tema não renderiza** (themeId null — slot reservado F44)
- **Teste 14 (D7):** botão "Confirmar e gerar campanha" com `aria-label` PT-BR e `min-h-[44px]`; botões "Voltar e editar" (header + footer) com `min-h-[44px]`
- **Teste 15 (D3/D7):** estado "Preparando imagens..." (preparing) e erro de preparação claro exibido
- **Teste 16 (D7):** preview das imagens com `object-contain` em célula `aspect-square` (sem recorte, mobile)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Testes 11-16 (render seções, rótulos, custo, a11y/mobile, estados, preview)** - (parte do commit do plano, test)

## Files Created/Modified
- `src/components/flow/__tests__/campaign-brief-review.test.tsx` - Testes 11-16 (novo)

## Decisions Made
- `useOperationCosts` mockado (costCredits 1, enabled true) e `CreditCta` stubado — padrão do campaign-flow-credits.test.tsx
- StoreIdentityBlock com identity null → não renderiza (verificado: nenhum texto "Loja Teste" falso no DOM)

## Deviations from Plan

Nenhuma - plano executado como escrito.

## Issues Encountered
- "Oferta" aparece 2x (header da seção + valor do tipo) → `getAllByText`
- "Voltar e editar" aparece 2x (header + footer) → `getAllByRole`

## User Setup Required
None

## Next Phase Readiness
- D6/D7/D3 validados na tela de revisão
- Validações: typecheck limpo, 6 testes novos passando
- Próximo: 43-12 (testes 17-23 backend/schema/rota/serviço)

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*