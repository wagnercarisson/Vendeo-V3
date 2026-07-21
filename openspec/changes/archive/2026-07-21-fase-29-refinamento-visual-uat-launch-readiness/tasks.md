## 1. Componentes Base

- [x] 1.1 Estender `Skeleton` com prop `variant`: `card`, `table`, `form`, `preview`, `stats` — cada variante com dimensões estáveis e classes tailwind
- [x] 1.2 Adaptar shimmer do `Skeleton` para dark mode: opacidade variável (0.05 → 0.15) sem animação colorida
- [x] 1.3 Criar `loading-skeleton.tsx` com variantes reutilizáveis (wrapper que usa Skeleton com variant)
- [x] 1.4 Criar `error-state.tsx` — componente reutilizável de error state (ícone, título, descrição, action opcional)

## 2. Loading States — 12 Rotas

- [x] 2.1 `/dashboard/loading.tsx` — skeleton de cards + saldo
- [x] 2.2 `/campanhas/loading.tsx` — skeleton de lista com 6 cards em grid
- [x] 2.3 `/campanhas/nova/loading.tsx` — skeleton de formulário
- [x] 2.4 `/campanhas/[id]/loading.tsx` — skeleton de preview + copy (aspect ratio 1:1)
- [x] 2.5 `/conta/loading.tsx` — skeleton de perfil + extrato
- [x] 2.6 `/loja/loading.tsx` — skeleton de identidade
- [x] 2.7 `/admin/loading.tsx` — skeleton de admin dashboard
- [x] 2.8 `/admin/users/loading.tsx` — skeleton de tabela
- [x] 2.9 `/admin/users/[id]/loading.tsx` — skeleton de detalhe
- [x] 2.10 `/admin/campaigns/errors/loading.tsx` — skeleton de erros
- [x] 2.11 `/admin/audit-log/loading.tsx` — skeleton de audit
- [x] 2.12 `/admin/metrics/loading.tsx` — skeleton de cards

## 3. Error Boundaries — 2 Grupos

- [x] 3.1 Criar `(app)/error.tsx` — Client Component com fallback genérico, mensagem PT-BR clara, botão "Tentar novamente" com `reset()`
- [x] 3.2 Criar `(app)/admin/error.tsx` — Client Component com mensagem segura, sem stack trace ou detalhes internos, botão "Tentar novamente" com `reset()`
- [x] 3.3 Adicionar `role="alert"` em error.tsx (app e admin) para notificar leitores de tela
- [x] 3.4 Garantir foco visível (focus-visible:ring-2) nos botões dos error.tsx

## 4. Empty States — 7 Implementações

- [x] 4.1 Adicionar empty state "Sem campanhas" em `/campanhas/page.tsx` — EmptyState com ícone MegaphoneIcon, title, description, CTA "Criar campanha"
- [x] 4.2 Adicionar empty state "Busca sem resultados" em `/campanhas/client.tsx` — EmptyState com action "Limpar filtros" que reseta search
- [x] 4.3 Adicionar empty state "Sem transações" em `/conta/page.tsx` — EmptyState informativo sem action
- [x] 4.4 Adicionar empty state "Nenhum lojista cadastrado" em `/admin/users/page.tsx`
- [x] 4.5 Adicionar empty state "Aguardando dados de geração" em `/admin/metrics/page.tsx`
- [x] 4.6 Adicionar empty state "Nenhum erro registrado" em `/admin/campaigns/errors/page.tsx`
- [x] 4.7 Adicionar empty state "Créditos insuficientes" + CTA "Solicitar créditos" nas telas de geração com saldo zero

## 5. Error States Específicos

- [x] 5.1 Tratar falha de geração com explicação da causa + estorno automático transparente + "Tentar novamente"
- [x] 5.2 Tratar saldo insuficiente como estado de negócio — "Créditos insuficientes" + CTA, sem erro de sistema
- [x] 5.3 Tratar rate limit — "Você atingiu o limite" + informar horário de restauração
- [x] 5.4 Tratar geração pausada (VENDEO_GENERATION_PAUSED) — banner "Geração temporariamente indisponível" + CTA "Entre em contato"
- [x] 5.5 Adicionar `role="alert"` nos banners e mensagens de erro específicos (saldo, rate limit, geração pausada, falha)
- [x] 5.6 Implementar acessibilidade do modal de créditos: role="dialog", aria-modal, aria-labelledby, foco inicial, fechamento Escape, retorno de foco

## 6. Microcopy PT-BR

- [x] 6.1 Revisar `/campanhas/nova` — título, placeholder, tooltips, botão desabilitado
- [x] 6.2 Revisar `/campanhas` — título, busca vazia, filtros
- [x] 6.3 Revisar `/campanhas/[id]` — status, ações, metadados
- [x] 6.4 Revisar `/conta` — saldo, extrato, CTA de créditos
- [x] 6.5 Revisar `/dashboard` — cards, boas-vindas, dicas
- [x] 6.6 Revisar `/loja` — formulário, upload
- [x] 6.7 Revisar `/admin/*` — ações admin sem jargão interno desnecessário
- [x] 6.8 Padronizar "Solicitar créditos" e "Fale com o time" em todo o produto

## 7. Mobile Hardening — 6 Áreas

- [x] 7.1 Verificar e ajustar `/conta` mobile: saldo, extrato, paginação, CTA de créditos (320-768px, touch targets >=44px)
- [x] 7.2 Verificar e ajustar topbar/app shell mobile: saldo e menu do usuário
- [x] 7.3 Verificar `/campanhas/nova` mobile: saldo insuficiente, botão desabilitado, tooltip, CTA
- [x] 7.3.1 Adicionar inputMode="decimal" no campo de preço e inputMode="numeric" nos campos de valor promocional/desconto
- [x] 7.4 Verificar `/campanhas` e `[id]` mobile: estados novos de erro/loading e copy gerada
- [x] 7.5 Verificar `/admin/*` mobile: triagem mínima (tabelas adaptadas para cards em <=640px)
- [x] 7.6 Verificar `/admin/metrics` mobile: cards adaptados e health banner legível

## 8. Legibilidade da Peça Gerada

- [x] 8.1 Criar constante `LEGIBILITY_CHECKLIST` com 10 critérios: contraste, hierarquia, safe zones, CTA visual, produto não cortado, sem emojis, CTA não domina composição, produto longo com ellipsis/redução, estado sem imagem tratado como erro, preview=export equivalentes
- [x] 8.2 Realizar auditoria visual de amostra representativa de peças geradas contra o checklist
- [x] 8.3 Documentar achados e classificar como Blocker/F29/Accept/Post-v1.5
- [x] 8.4 Corrigir achados Blocker e Fix identificados na auditoria

## 9. Admin Visual Harmonization

- [x] 9.1 Varrer usos de bg-white, bg-gray-*, text-gray-*, bg-red-50, bg-green-50, text-green-* nas 6 superfícies admin e substituir por tokens dark OLED
- [x] 9.2 Alinhar `/admin` (dashboard) ao dark OLED
- [x] 9.3 Alinhar `/admin/users` e `/admin/users/[id]` ao dark OLED
- [x] 9.4 Alinhar `/admin/metrics` ao dark OLED
- [x] 9.5 Alinhar `/admin/campaigns/errors` ao dark OLED
- [x] 9.6 Alinhar `/admin/audit-log` ao dark OLED
- [x] 9.7 Verificar se `campaign-adjustments-panel.tsx` está em uso no fluxo atual; se sim, alinhar ao dark OLED; se não, registrar como Accept/Monitor

## 10. Operacional — Launch Readiness

- [x] 10.1 Verificar feature flags: VENDEO_V15_ENABLED, VENDEO_CREDITS_CHARGING_ENABLED, VENDEO_COPY_DIRECTOR_ENABLED, VENDEO_RATE_LIMIT_ENABLED, VENDEO_GENERATION_PAUSED
- [x] 10.2 Verificar `/admin/metrics` — dados coerentes, thresholds alinhados, health state funcional
- [x] 10.3 Validar função SQL `cleanup_generation_events_90d()` — execução manual sem erro
- [x] 10.4 Validar runbook em `docs/operations/support-runbook.md` — comando cleanup correto
- [x] 10.5 Criar `docs/launch-readiness/channel-feedback.md` — decisão do canal (a definir na F29), SLA, responsável
- [x] 10.6 Criar `docs/launch-readiness/expansion-pause-criteria.md` — critérios de expansão, pausa e go/no-go
- [x] 10.7 Criar `docs/launch-readiness/cleanup-90d-decision.md` — decisão D8 registrada, revisão D+30
- [x] 10.8 Documentar decisão do canal de feedback e registrar localização dos links no produto

## 11. UAT Externo

- [x] 11.1 Preparar pool beta de 3-5 lojistas para rollout controlado
- [x] 11.2 Preparar roteiro de UAT com 8 cenários mínimos
- [x] 11.3 Executar UAT inicial com 1-2 lojistas
- [x] 11.4 Registrar evidências: data, usuário/loja, cenário, resultado, bugs, severidade, decisão em `docs/launch-readiness/uat-results/`
- [x] 11.5 Corrigir problemas bloqueantes encontrados no UAT
- [x] 11.6 Reexecutar cenários afetados pelas correções
- [x] 11.7 Expandir UAT para demais lojistas do pool após bloqueantes resolvidos
- [x] 11.8 Realizar reunião de revisão final com time: métricas, feedback qualitativo, bugs pendentes, riscos aceitos
- [x] 11.9 Registrar decisão explícita: expandir / pausar / manter controlado

## 12. Regressão e Verificação Final

- [x] 12.1 Executar `npm run build` — build bem-sucedido
- [x] 12.2 Executar `npm run typecheck` — zero erros de tipo
- [x] 12.3 Executar `npm run lint` — zero erros de lint
- [x] 12.4 Executar `npx vitest run` — todos os testes passando
- [x] 12.5 Verificar que nenhuma rota existente foi quebrada por loading/error/empty state novo
- [x] 12.6 Executar UAT local: fluxo completo de geração funciona como antes (login → criar campanha → preview → exportar)

## 13. Validação Visual Final (Checklist Manual)

- [x] 13.1 Verificar todas as rotas em desktop (1024px+) — sem overflow, loading/error/empty states funcionais
- [x] 13.2 Verificar mobile 320px — sem horizontal scroll nas rotas do lojista
- [x] 13.3 Verificar mobile 375px — touch targets >= 44px, sem botões sobrepostos
- [x] 13.4 Verificar mobile 768px (tablet) — layout adaptado, sem quebras
- [x] 13.5 Verificar admin utilizável em mobile (triagem mínima)
- [x] 13.6 Revisar estados loading/error/empty contra design system — cores, tokens, tipografia corretos
- [x] 13.7 Auditar peça gerada contra checklist de legibilidade (10 critérios)
- [x] 13.8 Verificar equivalência preview vs export em amostra representativa
