# 29-02: Empty States + Error States + Microcopy + Admin Visual Harmonization ✅

## Tasks
- **29-02-01:** Empty state "Sem campanhas" com MegaphoneIcon + CTA "Criar campanha"
- **29-02-02:** Empty state "Busca sem resultados" com "Limpar filtros"
- **29-02-03:** Empty state "Nenhuma transação ainda" em /conta
- **29-02-04:** Empty state "Nenhum lojista cadastrado" em admin/users
- **29-02-05:** Empty state "Aguardando dados de geração" em admin/metrics
- **29-02-06:** Empty state "Nenhum erro registrado" em admin/campaigns/errors
- **29-02-07:** Empty state "Créditos insuficientes" no fluxo de geração
- **29-02-08:** Error state "Não foi possível gerar a campanha" com "Tentar novamente"
- **29-02-09:** Error state "Créditos insuficientes" com role="status" (business state)
- **29-02-10:** Error state "Você atingiu o limite de gerações" (rate limit)
- **29-02-11:** Banner "Geração temporariamente indisponível" via generationPaused
- **29-02-12:** Modal de créditos acessível (role="dialog", aria-modal, focus management)
- **29-02-13:** Microcopy revisado — 14 substituições de jargão técnico, CTAs padronizados
- **29-02-14:** Admin harmonizado — 6 superfícies dark OLED (bg-white→bg-bg-surface, text-gray→text-foreground, etc.)

## Commits
- `38cd4dc` — feat(29-02): empty states, error states, microcopy, admin harmonization, modal a11y

## Verification
- ✅ TypeScript compile pass
- ✅ Lint pass
- ✅ 889 tests pass (3 tests updated for new microcopy)
