## Context

F29 é a última fase da v1.5 — não adiciona novas features de produto. O Vendeo tem ~889 testes passando, todas as capacidades funcionais entregues (F23-F28) e launch controls implementados. O que existe agora: telas em branco durante carregamento (sem loading.tsx), erros não tratados com stack trace exposto, lists sem empty states, microcopy inconsistente com jargão técnico, mobile não verificado em 6 áreas pós-F22, peça gerada sem checklist de publicabilidade, canal de feedback inexistente e UAT externo não executado.

A abordagem da F29 é cirúrgica: cada mudança mapeada no alinhamento (12 loading.tsx, 2 error.tsx, 7 empty states, 4 error states, 7 fluxos de microcopy, 6 áreas mobile, 10 critérios de legibilidade, 8 cenários UAT). Nada é redesenhado — tudo é verificado, padronizado e polido contra o design system existente.

### Arquitetura atual relevante

- **Next.js App Router** com Server Components por padrão, Client Components onde há interatividade
- **Grupos de rotas**: `(app)` para autenticado, `(app)/admin` para admin
- **Componentes base**: `Skeleton` (existe, sem variantes), `EmptyState` (existe, usado parcialmente), `Card` (existe)
- **Tema**: Dark mode OLED via Tailwind + CSS custom properties
- **Design system**: `openspec/design-system/MASTER.md` — tokens, grid, tipografia, cores
- **Feature flags**: via env vars (`VENDEO_V15_ENABLED`, `VENDEO_GENERATION_PAUSED`, etc.)

## Goals / Non-Goals

**Goals:**
- 12 rotas críticas com loading.tsx + skeleton dedicado (sem tela em branco)
- 2 error boundaries (app + admin) com mensagens claras e sem vazamento de dados
- 7 empty states padronizados com EmptyState
- 4 error states específicos com mensagens orientadas a ação
- Microcopy revisado em 7 fluxos — tom comercial, consistente, sem jargão
- 6 áreas mobile verificadas (320-768px) com critérios fixos
- Checklist de legibilidade documentado e aplicado na auditoria
- Canal de feedback definido e documentado
- Critérios de expansão/pausa/go-no-go documentados e aprovados
- UAT externo executado com evidências
- Launch flags + métricas + cleanup 90d verificados

**Non-Goals:**
- Redesenho de UI/UX (mobile, navegação, layout global)
- Novas features de produto (Stripe, múltiplas lojas, test A/B)
- Job automático de cleanup 90d (adiado para D+30)
- Editor visual livre / Canva-like
- Experiência admin mobile-first
- Refatoração de F22 (mobile hardening base)
- Integração com APIs externas (Instagram, etc.)

## Decisions

### D1 — loading.tsx por rota (não componente genérico)

Cada uma das 12 rotas recebe seu próprio `loading.tsx` usando variantes do `Skeleton`. Next.js usa o `loading.tsx` mais próximo na árvore de rotas, então criar por rota é o padrão natural do App Router.

**Alternativa considerada:** Componente `<Suspense>` genérico em layout. Rejeitado porque não aproveita o mecanismo nativo do App Router e daria menos controle por rota.

### D2 — Skeleton estendido com variantes (não componentes separados)

Em vez de criar `CardSkeleton`, `TableSkeleton`, etc., o `Skeleton` existente ganha prop `variant` com tipos `card | table | form | preview | stats`.

**Alternativa considerada:** Componentes separados para cada variante. Rejeitado por proliferação de arquivos. Uma prop `variant` mantém o componente coeso e permite loading.tsx conciso.

### D3 — Error boundaries por grupo, não por rota

Dois `error.tsx`: um em `(app)/` (cobre todas as rotas autenticadas) e um em `(app)/admin/` (cobre admin). Next.js propaga erros não tratados para o error boundary mais próximo. Rotas de campanha não precisam de error.tsx próprio — são cobertas pelo grupo (app).

**Alternativa considerada:** error.tsx em cada rota. Rejeitado por duplicação — o fallback genérico serve para todas as rotas do grupo. Admin tem tratamento diferenciado (não vazar detalhes internos).

### D4 — EmptyState mantido como está

O componente `EmptyState` existente já tem a interface correta `{ icon?, title, description, action? }`. Nenhuma modificação de interface é necessária — apenas novos usos nas 7 listas/tabelas.

### D5 — Microcopy como revisão de arquivos, não camada de i18n

A revisão de microcopy é aplicada diretamente nos arquivos de página/componente. Não há implementação de i18n neste momento — o Vendeo é PT-BR only.

**Alternativa considerada:** Introduzir i18next ou similar. Rejeitado — F29 não deve introduzir infraestrutura nova. Microcopy é revisado in-place.

### D6 — Mobile com verificação manual em dispositivo real

A verificação mobile é checklist manual (dispositivo real ou emulador) usando os critérios definidos. Não há testes automatizados de responsividade nesta fase.

### D7 — Canal de feedback

**Decisão pendente na F29.** O canal primário (WhatsApp ou Discord), fallback (email) e SLA devem ser decididos e registrados antes do UAT. Links para o canal escolhido aparecem na topbar, dashboard e /conta. Sem formulário in-app no escopo base — se implementado, será somente se couber sem atrasar a F29.

### D8 — Auditoria visual contra design system

A auditoria usa o design system existente como fonte da verdade. Achados são classificados em 4 níveis (Blocker, Fix, Accept/Monitor, Post-v1.5). Só Blocker e Fix entram na F29.

### D9 — Achados UI/UX da varredura pré-F29

A varredura pré-F29 identificou problemas de UI/UX nas superfícies do Vendeo usando a skill `ui-ux-pro-max` como checklist consultivo e referência de boas práticas. A fonte soberana para resolução de conflitos é o design system do Vendeo:

- `openspec/design-system/MASTER.md` — tokens, grid, tipografia, cores, ícones, espaçamento
- `openspec/design-system/CAMPAIGN_VISUAL_SYSTEM.md` — sistema visual da campanha gerada
- `openspec/design-system/CAMPAIGN_ART_DIRECTION.md` — direção de arte da campanha

**Regra:** qualquer recomendação genérica da skill que conflite com o design system aprovado do Vendeo é descartada em favor de `MASTER.md`.

**Classificação dos achados:**

| Classe | Ação |
|--------|------|
| **Blocker F29** | Impede UAT externo ou publicabilidade. Deve ser corrigido |
| **Fix F29** | Correção de polish dentro da fase |
| **Accept / Monitor** | Conhecido, não bloqueia beta controlado |
| **Post-v1.5** | Melhoria futura fora do lançamento |

**Achados mapeados na varredura:**

| # | Superfície | Achado | Classe | Ação |
|---|-----------|--------|--------|------|
| 1 | `/admin/*` | bg-white, bg-gray-*, text-gray-* em contraste com dark OLED do design system | Blocker | Alinhar ao dark mode |
| 2 | `/admin/*` | Componente `campaign-adjustments-panel.tsx` em estilo claro | Fix | Verificar uso; se ativo, alinhar ao dark OLED; se inativo, Accept/Monitor |
| 3 | `/campanhas/nova` | Campos monetários sem teclado mobile adequado | Fix | Adicionar inputMode decimal/numeric |
| 4 | Error states | Falta role="alert" e aria-live em mensagens de erro | Fix | Adicionar atributos de acessibilidade |
| 5 | Modal de créditos | Falta role="dialog", aria-modal, aria-labelledby, foco gerenciado | Fix | Implementar acessibilidade do modal |
| 6 | Microcopy | Jargão técnico (Badge Promocional, Caption, CTA, Audit Log, Healthy/Attention/Pause/N/D) | Blocker | Substituir por PT-BR comercial |
| 7 | Peça gerada | CTA visual pode dominar composição; produto longo sem regra de redução; estado sem imagem não tratado | Fix | Incorporar regras no checklist |
| 8 | Preview vs export | Preview e export sem garantia de equivalência visual | Fix | Verificar equivalência |
| 9 | Botões/CTAs | Foco visível e touch target mínimo 44px não verificado | Fix | Verificar em todas as superfícies |

**Só Blocker e Fix entram na F29.** Achados Accept/Monitor e Post-v1.5 são registrados e deixados para fases futuras.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Escopo creep** — "já que estamos polindo, vamos melhorar X" | Achados classificados em 4 níveis. Só Blocker e Fix entram na F29. Explícito no design. |
| **UAT inconclusivo** — lojista não completa cenários | 8 cenários estruturados. Canal de feedback direto. Time acompanha em tempo real. |
| **Mobile real vs emulador** — falha em dispositivo real | Testar em dispositivos reais antes do UAT. Responsividade é critério de aceite. |
| **Microcopy inconsistente** — revisão parcial | Revisão cobre 7 fluxos obrigatórios. Revisão cruzada entre membros do time. |
| **Falsa sensação de conclusão** — build verde não é UX boa | Critérios de aceite incluem verificação visual e UAT com lojistas reais. |
| **Cleanup 90d esquecido** — ninguém executa função SQL | Runbook documentado (F28). F29 valida comando. Reavalia D+30. |
| **Go/No-Go ambíguo** — time sem critérios claros | Critérios de expansão/pausa documentados e aprovados no artefato de launch readiness. Revisão final com decisão explícita. |
