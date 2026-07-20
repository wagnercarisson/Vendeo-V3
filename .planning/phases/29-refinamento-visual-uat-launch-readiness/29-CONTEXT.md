# Phase 29: Refinamento Visual + UAT + Launch Readiness — Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/`

<domain>
## Phase Boundary

F29 é a última fase da v1.5 — não adiciona novas features de produto. O Vendeo tem ~889 testes passando, todas as capacidades funcionais entregues (F23-F28) e launch controls implementados. O que existe agora: telas em branco durante carregamento (sem loading.tsx), erros não tratados com stack trace exposto, lists sem empty states, microcopy inconsistente com jargão técnico, mobile não verificado em 6 áreas pós-F22, peça gerada sem checklist de publicabilidade, canal de feedback inexistente e UAT externo não executado.

A abordagem da F29 é cirúrgica: cada mudança mapeada (12 loading.tsx, 2 error.tsx, 7 empty states, 4 error states, 7 fluxos de microcopy, 6 áreas mobile, 10 critérios de legibilidade, 8 cenários UAT). Nada é redesenhado — tudo é verificado, padronizado e polido contra o design system existente.

**Estado atual (pós-F28):**
- 12 rotas críticas sem loading.tsx — tela em branco durante SSR
- Sem error boundaries no grupo (app) — stack trace exposto em produção
- 7 listas/tabelas sem empty state (campanhas vazias, busca sem resultado, extrato vazio, etc.)
- 4 estados de erro sem tratamento visual (falha de geração, saldo, rate limit, geração pausada)
- Microcopy com jargão técnico em 7 fluxos ("Copy Director", "geração", "rate limit", "Audit Log")
- 6 áreas pós-F22 sem verificação mobile (320-768px)
- Admin com resquícios de estilo claro (bg-white, bg-gray-*, text-gray-*)
- Peça gerada sem checklist de legibilidade documentado
- Canal de feedback inexistente
- Critérios de expansão/pausa/go-no-go não documentados
- UAT externo não executado

**Dependências:** F23 (Copy Director), F24 (Créditos), F25 (Pipeline), F26 (Admin), F27 (Conta/Saldo), F28 (Observabilidade/Launch Controls)

**Nenhuma alteração em:** serviços, APIs, banco de dados, provedores de IA, pipeline de geração, wallet/ledger, auth

**SEC-01/02/03/05:** Já implementados em F24-F26. Fora do escopo da F29.

</domain>

<decisions>
## Implementation Decisions

### D1 — loading.tsx por rota (não componente genérico)

`DECIDIDO`

Cada uma das 12 rotas recebe seu próprio `loading.tsx` usando variantes do `Skeleton`. Next.js usa o `loading.tsx` mais próximo na árvore de rotas, então criar por rota é o padrão natural do App Router.

**Alternativa considerada:** Componente `<Suspense>` genérico em layout. Rejeitado porque não aproveita o mecanismo nativo do App Router e daria menos controle por rota.

### D2 — Skeleton estendido com variantes (não componentes separados)

`DECIDIDO`

Em vez de criar `CardSkeleton`, `TableSkeleton`, etc., o `Skeleton` existente ganha prop `variant` com tipos `card | table | form | preview | stats`.

**Alternativa considerada:** Componentes separados para cada variante. Rejeitado por proliferação de arquivos. Uma prop `variant` mantém o componente coeso e permite loading.tsx conciso.

### D3 — Error boundaries por grupo, não por rota

`DECIDIDO`

Dois `error.tsx`: um em `(app)/` (cobre todas as rotas autenticadas) e um em `(app)/admin/` (cobre admin). Next.js propaga erros não tratados para o error boundary mais próximo.

**Alternativa considerada:** error.tsx em cada rota. Rejeitado por duplicação — o fallback genérico serve para todas as rotas do grupo. Admin tem tratamento diferenciado (não vazar detalhes internos).

### D4 — EmptyState mantido como está

`DECIDIDO`

O componente `EmptyState` existente já tem a interface correta `{ icon?, title, description, action? }`. Nenhuma modificação de interface é necessária — apenas novos usos nas 7 listas/tabelas.

### D5 — Microcopy como revisão de arquivos, não camada de i18n

`DECIDIDO`

A revisão de microcopy é aplicada diretamente nos arquivos de página/componente. Não há implementação de i18n neste momento — o Vendeo é PT-BR only.

**Alternativa considerada:** Introduzir i18next ou similar. Rejeitado — F29 não deve introduzir infraestrutura nova.

### D6 — Mobile com verificação manual em dispositivo real

`DECIDIDO`

A verificação mobile é checklist manual (dispositivo real ou emulador) usando os critérios definidos. Não há testes automatizados de responsividade nesta fase.

### D7 — Canal de feedback

`PENDENTE — decisão na F29`

O canal primário (WhatsApp ou Discord), fallback (email) e SLA devem ser decididos e registrados antes do UAT. Links para o canal escolhido aparecem na topbar, dashboard e /conta. Sem formulário in-app no escopo base.

### D8 — Auditoria visual contra design system

`DECIDIDO`

A auditoria usa o design system existente como fonte da verdade. Achados classificados em 4 níveis (Blocker, Fix, Accept/Monitor, Post-v1.5). Só Blocker e Fix entram na F29.

### D9 — Achados UI/UX da varredura pré-F29

`DECIDIDO`

A varredura pré-F29 identificou problemas de UI/UX nas superfícies do Vendeo usando a skill `ui-ux-pro-max` como checklist consultivo. A fonte soberana para resolução de conflitos é o design system do Vendeo (`openspec/design-system/MASTER.md`). Qualquer recomendação genérica que conflite com o design system aprovado é descartada em favor de `MASTER.md`.

**Achados classificados:**

| Classe | Ação |
|--------|------|
| Blocker F29 | Impede UAT externo ou publicabilidade. Deve ser corrigido |
| Fix F29 | Correção de polish dentro da fase |
| Accept / Monitor | Conhecido, não bloqueia beta controlado |
| Post-v1.5 | Melhoria futura fora do lançamento |

**Achados mapeados:**

| # | Superfície | Achado | Classe |
|---|-----------|--------|--------|
| 1 | `/admin/*` | bg-white, bg-gray-*, text-gray-* em contraste com dark OLED | Blocker |
| 2 | `/admin/*` | campaign-adjustments-panel.tsx em estilo claro | Fix |
| 3 | `/campanhas/nova` | Campos monetários sem teclado mobile adequado | Fix |
| 4 | Error states | Falta role="alert" e aria-live em mensagens de erro | Fix |
| 5 | Modal de créditos | Falta role="dialog", aria-modal, aria-labelledby, foco gerenciado | Fix |
| 6 | Microcopy | Jargão técnico (Badge Promocional, Caption, CTA, Audit Log, etc.) | Blocker |
| 7 | Peça gerada | CTA visual pode dominar composição; produto sem regra de redução | Fix |
| 8 | Preview vs export | Sem garantia de equivalência visual | Fix |
| 9 | Botões/CTAs | Foco visível e touch target mínimo 44px não verificado | Fix |

### D10 — Nenhuma alteração em camadas de dados

`DECIDIDO`

F29 não modifica serviços, APIs, banco de dados, provedores de IA, pipeline de geração, wallet/ledger ou auth. Apenas UI/UX e documentação operacional.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Source (F29)
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/proposal.md` — Why, What Changes, 10 changes, impact
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/design.md` — D1-D9, goals/non-goals, arquitetura, riscos
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/tasks.md` — 13 task groups, tasks detalhadas

### Specs (F29)
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/loading-states/spec.md` — 12 rotas com loading.tsx, Skeleton variants, shimmer dark mode
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/error-boundaries/spec.md` — 2 error.tsx, role="alert", foco visível
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/empty-states/spec.md` — 7 empty states com EmptyState
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/error-states-specific/spec.md` — 4 error states, modal acessível
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/microcopy-ptbr/spec.md` — 7 fluxos, tabela de substituição, consistência CTAs
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/mobile-harden-areas/spec.md` — 6 áreas 320-768px, touch targets >=44px
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/legibility-checklist/spec.md` — 10 critérios de legibilidade
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/admin-visual-harmonization/spec.md` — 6 superfícies admin dark OLED
- `openspec/changes/fase-29-refinamento-visual-uat-launch-readiness/specs/uat-externo/spec.md` — 8 cenários UAT, evidências, decisão final

### Design System
- `openspec/design-system/MASTER.md` — Tokens, grid, tipografia, cores, ícones, espaçamento
- `openspec/design-system/CAMPAIGN_VISUAL_SYSTEM.md` — Sistema visual da campanha gerada
- `openspec/design-system/CAMPAIGN_ART_DIRECTION.md` — Direção de arte da campanha

### Project Requirements
- `.planning/REQUIREMENTS.md` — LAUNCH-01 a LAUNCH-06 mapped to Phase 29

### Componentes Existentes
- `src/components/ui/skeleton.tsx` — Skeleton existente (será estendido com variant)
- `src/components/ui/empty-state.tsx` — EmptyState existente (mantido)
- `src/components/ui/card.tsx` — Card existente

### Launch Config (F28)
- `src/lib/launch-config/config.ts` — getLaunchConfig() com 5 flags
- `docs/operations/support-runbook.md` — Runbook operacional

</canonical_refs>

<specifics>
## Specific Ideas

- `Skeleton` ganha prop `variant: "card" | "table" | "form" | "preview" | "stats"` com dimensões estáveis
- Shimmer dark mode: opacidade variável 0.05 → 0.15, sem animação colorida
- `error.tsx` em (app) com título "Algo deu errado" e "Tentar novamente"
- `error.tsx` em admin com mensagem segura (sem stack trace)
- EmptyState sem campanhas: MegaphoneIcon, "Nenhuma campanha ainda", CTA "Criar campanha"
- Substituições obrigatórias: "Audit Log" → "Histórico de auditoria", "Copy Director" → "Texto da campanha", "rate limit" → "limite de gerações"
- CTAs padronizados: "Solicitar créditos" e "Fale com o time"
- InputMode decimal nos campos de preço, numeric nos campos de desconto/promocional
- Tabelas admin adaptadas para cards em <=640px
- `LEGIBILITY_CHECKLIST` com 10 critérios (constante exportada)
- Admin harmonizado para dark OLED (remover bg-white, bg-gray-*, text-gray-*, bg-red-50, bg-green-50)
- Canal de feedback: decisão pendente na F29 (WhatsApp ou Discord)
- UAT com 8 cenários mínimos, pool beta 3-5 lojistas
- Feature flags verificadas mas não modificadas
- Cleanup 90d: runbook validado, job automático revisado D+30

</specifics>

<deferred>
## Deferred Ideas

- Editor visual livre (Canva-like) — Post-v1.5
- Múltiplas lojas (1:N) — v2
- Integração Instagram API — v2
- Job automático de cleanup 90d — adiado para D+30
- i18n / internacionalização — Vendeo é PT-BR only
- Formulário de feedback in-app — substituído por canal externo
- Mobile hardening completo (refatoração de F22) — fora do escopo
- Redesenho de UI/UX (navegação, layout global) — fora do escopo
- Stripe / monetização pública — v1.6

</deferred>

---

*Phase: 29-refinamento-visual-uat-launch-readiness*
*Context gathered: 2026-07-19 via OpenSpec source of truth*
