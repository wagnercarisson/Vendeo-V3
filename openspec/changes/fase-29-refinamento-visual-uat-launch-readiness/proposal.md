## Why

A v1.5 está com 7/8 fases concluídas e ~889 testes passando — todas as capacidades funcionais estão implementadas. O que falta para o lançamento externo controlado não é funcionalidade nova, mas **polimento, verificação e operação**: loading states que não existem (tela em branco durante carregamento), error states que vazam detalhes internos, empty states ausentes, microcopy com jargão técnico, mobile não verificado em superfícies recentes, peça gerada sem checklist de publicabilidade, canal de feedback inexistente, critérios de lançamento não documentados e UAT externo não executado.

Esta fase transforma o Vendeo de "funcional internamente" para "confiável, publicável e operável com lojistas reais".

## What Changes

1. **Loading states** — 12 rotas críticas ganham `loading.tsx` com skeletons dedicados (shimmer, aspect ratio preservado, sem layout shift, dark mode)
2. **Error boundaries** — `error.tsx` no grupo (app) com fallback genérico + "Tentar novamente"; `error.tsx` no admin sem vazar detalhes internos
3. **Empty states** — 7 estados padronizados (ilustração, mensagem, CTA) usando componente `EmptyState` existente
4. **Error states específicos** — saldo insuficiente, rate limit, geração pausada, falha de geração com recuperação (estorno automático transparente)
5. **Microcopy PT-BR** — revisão nos 7 fluxos críticos: tom comercial, sem jargão técnico ("Copy Director", "geração", "rate limit"), orientado a ação
6. **Mobile hardening** — regressão mobile das superfícies F23-F28 (320-768px, touch targets >=44px, zero overflow, modais utilizáveis)
7. **Legibilidade da peça gerada** — checklist de 10 critérios: contraste, hierarquia visual, safe zones, CTA visual, produto não cortado, sem emojis, CTA não domina composição, produto longo com regra de redução, estado sem imagem como erro, equivalência preview/export
8. **Canal de feedback** — **decisão pendente na F29**: WhatsApp (recomendação) ou Discord como canal primário; email como fallback; SLA documentado. A decisão deve ser tomada e registrada antes do UAT.
9. **Critérios de expansão/pausa/go-no-go** — documentados e aprovados pelo time
10. **UAT externo** — pool beta de 3-5 lojistas; primeira execução com 1-2 lojistas; correção de bloqueantes; reexecução dos cenários afetados; expansão após bloqueantes resolvidos; evidências registradas; decisão explícita final
11. **Launch flags + métricas + cleanup** — verificação de feature flags, métricas de saúde visíveis, cleanup 90d validado

## Capabilities

### New Capabilities

- `loading-states`: 12 loading.tsx para rotas críticas com variantes de skeleton (card, table, form, preview, stats), shimmer adaptado ao dark mode, dimensões estáveis sem layout shift
- `error-boundaries`: 2 error.tsx — fallback genérico no grupo (app) com reset e mensagem clara em PT-BR; fallback admin sem vazar detalhes internos (stack trace, connection string)
- `empty-states`: 7 estados padronizados — sem campanhas, busca sem resultados, sem transações, admin sem lojas, admin sem métricas, admin sem erros, saldo zero — com EmptyState (icon?, title, description, action?)
- `error-states-specific`: Tratamento visual e textual para falha de geração, saldo insuficiente, rate limit e geração pausada — com mensagens orientadas a ação e caminhos de recuperação
- `mobile-harden-areas`: Verificação mobile 320-768px das áreas F23-F28: /conta, topbar saldo/menu, /campanhas/nova, /admin/*, /admin/metrics — touch targets >=44px, zero overflow, sem botões sobrepostos, modais utilizáveis
- `microcopy-ptbr`: Revisão de microcopy nos 7 fluxos críticos — tom comercial confiável, sem jargão, consistência de "Solicitar créditos" e "Fale com o time" em todo o produto
- `legibility-checklist`: Checklist de 10 critérios para auditoria visual de peças geradas — contraste WCAG AA, hierarquia (preço principal), safe zones, CTA visual (não botão UI), produto não cortado, sem emojis, CTA não domina composição, produto longo com regra de redução, estado sem imagem como erro explícito, equivalência visual preview/export
- `uat-externo`: Planejamento, execução e registro de UAT externo com 8 cenários mínimos, pool beta 3-5 lojistas (primeira execução 1-2), evidências por sessão, correção de bloqueantes, reexecução e decisão final
- `admin-visual-harmonization`: Harmonização das 6 superfícies admin com design system dark OLED (remoção de bg-white, bg-gray-*, text-gray-*, bg-red-50, bg-green-50, text-green-*) + avaliação do componente campaign-adjustments-panel.tsx

### Modified Capabilities

- Nenhuma — F29 não altera requisitos de specs existentes. Todas as mudanças são UI/UX, operacionais ou de verificação.

## Impact

- **Novos arquivos**: 12 `loading.tsx` (rotas), 2 `error.tsx` (grupos), 2 componentes (`error-state.tsx`, `loading-skeleton.tsx`), docs de launch-readiness
- **Arquivos modificados**: `empty-state.tsx`, `skeleton.tsx`, `card.tsx`, páginas de campanhas, conta, admin, loja, dashboard — alterações de microcopy, empty states e mobile
- **Nenhuma alteração em**: serviços, APIs, banco de dados, provedores de IA, pipeline de geração, wallet/ledger, auth
- **Documentação**: `docs/launch-readiness/` (canal feedback, critérios expansão, cleanup, UAT), `docs/operations/support-runbook.md` (validação)
- **Configuração**: Verificação de feature flags existentes (VENDEO_V15_ENABLED, etc.) — nenhuma flag nova
