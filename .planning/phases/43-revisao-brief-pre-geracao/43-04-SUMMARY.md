---
phase: 43-revisao-brief-pre-geracao
plan: 04
subsystem: ui
tags: [campaign-brief-review, review-ui, store-identity, d6, d7]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (D6 conteúdo do resumo, D7 a11y/mobile/microcopy)
  - phase: 43-02 (helpers puros)
    provides: buildValidityDisplayText, buildMandatoryArtworkText, inferIntent, preparedImages
  - phase: 43-03 (hook reviewMode)
    provides: reviewMode/preparing/preparedImages/reviewError/enterReview/exitReview/confirmReview
  - phase: fase-41-midia-de-campanha-mobile
    provides: CampaignImageUpload, preparedImages (productImages[])
provides:
  - Tela intermediária de revisão do brief (campaign-brief-review.tsx) — não modal
  - Botão "Revisar e gerar" no form (substitui "Criar Campanha"); render da revisão quando reviewMode ativo
  - Seções Produto/Oferta/Imagens/Avisos/Custo + StoreIdentityBlock + rótulos Principal/Referência + "Vai consumir X crédito(s)" + slot Tema reservado
  - Identidade real da loja resolvida no server page e propagada até a revisão (decisão 2026-08-21)
affects: [43-10 (testes 1-10), 43-11 (testes 11-16), 43-14 (co-migração fixtures), F44 (slot Tema)]

# Tech tracking
tech-stack:
  added: []
  patterns: [intermediate review screen in same flow, StoreIdentityBlock with real server-resolved snapshot, object-contain previews]

key-files:
  created: [src/components/flow/campaign-brief-review.tsx]
  modified: [src/app/(app)/campanhas/nova/page.tsx, src/components/flow/campaign-page-client.tsx, src/components/flow/campaign-input-form.tsx]

key-decisions:
  - "Identidade resolvida no server page via resolveStoreIdentity + validateIdentityReference (mesma fonte canônica da rota de geração); falha → identity null (StoreIdentityBlock não renderiza, sem fallback divergente)"

patterns-established:
  - "Revisão consome os mesmos derivados que o body (idempotência D4) e as mesmas flags de custo do form (submitDisabled)"

requirements-completed: [F43-25, F43-26]

# Metrics
duration: 60min
completed: 2026-08-21
---

# Plan 43-04: UI Tela de Revisão do Brief Summary

**Tela intermediária de revisão do brief (`campaign-brief-review.tsx`) integrada ao fluxo do form — botão "Revisar e gerar" substitui "Criar Campanha", resumo completo Produto/Oferta/Imagens/Avisos/Custo com loja/marca real no topo, rótulos Principal/Referência, custo/saldo, slot Tema reservado e a11y/mobile (D6/D7)**

## Performance

- **Duration:** 60 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 4
- **Files modified:** 4 + 1 criado + 1 teste co-migrado

## Accomplishments
- **Botão "Revisar e gerar"** substitui "Criar Campanha" no `FormContent`; o submit do form chama `enterReview()` (não dispara POST); bloqueio mantém a lógica `submitDisabled` (custo off/indisponível/saldo insuficiente/blanco)
- **Render da revisão:** `CampaignInputForm` renderiza `CampaignBriefReview` quando `reviewMode` ativo (mesmo padrão do `isSubmitting` → `GenerationProgress`), passando fields/preparedImages/estados + callbacks `onBack`/`onConfirm`
- **`campaign-brief-review.tsx`** (novo componente client): seções **Produto** (nome+descrição), **Oferta** (tipo via `inferIntent`, badge, preços formatados BRL, validade via `buildValidityDisplayText`), **Imagens** (thumbnails `object-contain` em célula `aspect-square`, rótulos "Principal"/"Referência"), **Avisos** (checkbox ilustrativo + texto via `buildMandatoryArtworkText`), **Custo** ("Vai consumir X crédito(s)" + saldo; "Confirmar" bloqueado com custo off/indisponível/saldo insuficiente), **Tema** (slot reservado, não renderiza)
- **Topo com `StoreIdentityBlock`** usando o snapshot real de identidade
- **Ações** "Voltar e editar" (exitReview) e "Confirmar e gerar campanha" (confirmReview) com touch ≥ 44px, `aria-label` PT-BR, loading; microcopy "Revise textos, preços e imagens antes de publicar: a IA pode cometer erros."; estado "Preparando imagens..."; erro de preparação claro
- **Identidade no server page** (`nova/page.tsx`): `resolveStoreIdentity(store)` + `validateIdentityReference(snapshot)` em try/catch (falha → identity null); propagada via `CampaignPageClient` → `CampaignInputForm` → revisão
- **Co-migração mínima:** `campaign-flow-credits.test.tsx` (3 referências "Criar Campanha" → "Revisar e gerar")

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 4: Resolver identidade no server page e propagar até a revisão** - (parte do commit do plano, feat)
2. **Task 1: Botão 'Revisar e gerar' + render da revisão no CampaignInputForm** - (parte do commit do plano, feat)
3. **Task 2: Componente campaign-brief-review (seções + rótulos + custo + Tema)** - (parte do commit do plano, feat)
4. **Task 3: Ações com a11y/mobile/loading + estados** - (parte do commit do plano, feat)

## Files Created/Modified
- `src/components/flow/campaign-brief-review.tsx` - Componente de revisão do brief (novo)
- `src/components/flow/campaign-input-form.tsx` - Botão "Revisar e gerar" + render da revisão + props store/identity
- `src/components/flow/campaign-page-client.tsx` - Aceita e propaga `identity` (StoreIdentityBlock + CampaignInputForm)
- `src/app/(app)/campanhas/nova/page.tsx` - Resolve/valida identidade no server page
- `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx` - Co-migrado (3 referências de label)

## Decisions Made
- Identidade falível no server page: em falha de `resolveStoreIdentity`/`validateIdentityReference`, `identity` vira null e o bloco não renderiza (sem fallback visual divergente — decisão do usuário 2026-08-21 preservada)
- Preview `object-contain` em célula `aspect-square` (nunca corta a imagem, especialmente mobile)

## Deviations from Plan

Co-migração mínima do `campaign-flow-credits.test.tsx` (3 referências "Criar Campanha" → "Revisar e gerar") — necessária porque o label do botão mudou nesta task; está dentro do previsto no plano ("mocks ... co-migrados quando necessário; regressão em 43-14").

## Issues Encountered
- TypeScript: `identity` opcional (`| undefined`) não atribuível ao prop exigido do `StoreIdentityBlock` — corrigido com `identity ?? null` nos dois call sites

## User Setup Required
None

## Next Phase Readiness
- Tela de revisão integrada ao fluxo do form (gate D2 completo de UI)
- Validações: typecheck limpo, 225 testes de flow/nova passando
- Próximo: 43-05 (schema override `brief_review_confirmed` + flag) — backend começa

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*