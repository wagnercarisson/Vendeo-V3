# Alinhamento — Milestone v1.4 "Experiência SaaS"

**Status:** Discussão exploratória concluída. Decisões registradas abaixo.
**Data:** 2026-07-10
**Próximo passo:** Revisão do artefato pelo time. Após aprovação, decompor em fases com OpenSpecs e planos de execução.

> Este documento é o artefato de alinhamento da milestone. Ele registra as decisões tomadas, invariantes, arquitetura-alvo e critérios de aceite. **Não é roadmap nem plano de implementação.** O fatiamento em fases e o planejamento detalhado vêm depois, em documentos próprios.

---

## Objetivo da Milestone

Organizar o Vendeo como produto SaaS coerente: uma experiência autenticada, navegável, responsiva e consistente para criar, encontrar, revisar e baixar campanhas. A v1.4 não expande o motor de campanha nem adiciona operação avançada de marketing; ela dá estrutura de produto ao que já funciona.

O problema atual não é ausência do motor, mas ausência de uma estrutura de produto coerente ao redor dele. Autenticação, ownership, RLS, persistência de campanhas, página de campanha, histórico inicial e download já existem desde v1.2/v1.3. O que falta é:

- Um **app shell** com navegação estrutural (sidebar + topbar)
- Um **dashboard** que seja a central de trabalho do lojista
- **Rotas padronizadas** em português com redirects
- **Onboarding** que guie o novo usuário sem redirect abrupto
- **Estados vazios** consistentes e orientados à ação
- **Histórico evoluído** com paginação, busca e filtros
- **Responsividade mobile** como padrão desde a fundação
- **Consistência visual** aplicando o design system existente em todas as telas

### Critério de conclusão

> Um novo usuário consegue se cadastrar, configurar a loja guiado, criar a primeira campanha, encontrá-la no dashboard, revisá-la e baixá-la — tudo em uma experiência visual consistente, responsiva e que transmite confiança de produto SaaS profissional.

### O que está no escopo

| Item | Descrição |
|------|-----------|
| App shell | Sidebar + topbar + CTA global "Nova Campanha" + layout responsivo com drawer mobile |
| Dashboard | Landing pós-login com métricas simples, campanhas recentes, CTA e estados vazios guiados |
| Rotas padronizadas | `/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta` |
| Redirects permanentes | `/` → `/dashboard`, `/minhas-campanhas` → `/campanhas`, `/campanha/[id]` → `/campanhas/[id]`, `/store` → `/loja` |
| Onboarding leve | Fluxo guiado pós-login sem wizard pesado: configurar loja → criar primeira campanha |
| Estados vazios | Padrão compartilhado (ícone + título + descrição + CTA) em todas as listas e seções |
| Histórico v2 | Paginação, ordenação, busca textual, filtros por data/status, URL state |
| Componentes base | `Button`, `Card`, `Input`, `Badge`, `EmptyState`, `Skeleton`, `PageHeader` |
| Consistência visual | Aplicar design tokens (bg-/text-/accent-/border-) em telas que ainda usam classes avulsas |
| Responsividade mobile | App shell responsivo desde a Phase 18; todas as fases nascem com breakpoints |

### O que está fora do escopo

| Item | Motivo |
|------|--------|
| Billing / planos | Uso livre durante validação do SaaS |
| Múltiplas lojas | Relação 1:1 user→store mantida |
| Times / permissões | Single-user |
| Analytics avançado (CTR, impressões, gasto) | Dashboard tem métricas básicas de geração apenas |
| Campanhas multi-formato | Motor de campanha único (1080×1080) |
| Calendário / plano semanal | Fase futura |
| CRM / gestão de clientes | Fora do core de geração de campanhas |
| Editor visual livre (Canva-like) | Geração guiada, não livre |
| Geração por IA de imagem (DALL-E, etc) | Reduz previsibilidade e consistência |
| PWA / install prompt | Salvo se surgir como ajuste técnico simples e não desviar escopo |
| OAuth social / Magic link | Exclusão deliberada desde v1.2 |
| Export agendado / programado | Fora do escopo v1.4 |

---

## Princípio de Design da v1.4

> **Alta qualidade visual a serviço da ação.** Toda decisão estética deve melhorar confiança, legibilidade ou velocidade de uso. Se uma escolha visual deixar o fluxo menos claro, ela deve ser descartada.

### Direção visual

- **Visual dark premium**, baseado no `design-system/vendeo-v3/MASTER.md`: dark mode profundo (`#020617`), alto contraste (respeitando WCAG — mínimo 4.5:1 para texto normal), acento verde (`#22C55E`), transições suaves (200ms), foco acessível, ícones Lucide consistentes
- **Layout SaaS limpo**, com boa hierarquia e baixa fricção. O dashboard deve parecer a central de trabalho do lojista, não uma landing page nem um painel de mídia
- **Sem elementos decorativos** que atrapalhem leitura, performance ou fluxo
- **Beleza por acabamento**: espaçamento, tipografia, contraste, estados hover/focus, thumbnails bem apresentados, microcopy clara — não por complexidade visual gratuita

### Nota sobre o design system existente

O `design-system/vendeo-v3/MASTER.md` permanece válido como guia macro da v1.4: dark mode profundo, alto contraste, acento verde, transições suaves, foco acessível, ícones consistentes e responsividade obrigatória. Porém, ele não deve ser aplicado literalmente onde carregar premissas de "financial dashboard", landing page ou componentes em light mode.

O preview de dashboard em `pages/dashboard.md` descreve um painel ad-platform (impressões, cliques, CTR, gasto total) que **não reflete o Core Value do Vendeo**. Este artefato deve ser tratado como obsoleto para a v1.4 — seus princípios visuais centrais (cores, tipografia, spacing) permanecem, mas layout, componentes e métricas devem seguir o produto real de geração de campanhas.

A interpretação para a v1.4: usar os princípios visuais do MASTER.md adaptando layout, tipografia e componentes ao SaaS operacional de geração de campanhas para lojistas — não a dashboard financeiro nem landing horizontal.

### Resumo

> Dashboard premium, mas não ornamental. Profissional, mas não analítico demais. Bonito porque é claro, consistente e confiável; prático porque coloca a próxima ação sempre à vista. Dashboard mínimo em dados, mas não mínimo em acabamento.

---

## Lembrete Operacional para OpenSpecs

> Toda fase da v1.4 deve preservar o princípio: **alta qualidade visual a serviço da ação**. Nenhuma decisão visual, rota nova ou abstração técnica deve dificultar o fluxo principal de criar uma campanha publicável.
>
> Incluir este lembrete no cabeçalho de cada OpenSpec de fase (18–22) como critério de aceite transversal.

---

## Invariantes

Estes invariantes são absolutos. Nenhuma fase pode violá-los. Reafirmam e estendem os invariantes da v1.3.

1. **Core Value preservado** — Nenhuma feature da v1.4 pode adicionar atrito ao fluxo de criar uma campanha. O motor de geração continua sendo o centro do produto.
2. **Rotas em português** — Todas as rotas user-facing do app são em português (`/dashboard`, `/campanhas`, `/loja`, `/conta`). Código interno permanece em inglês. Redirects permanentes mantêm compatibilidade com rotas antigas.
3. **App shell como fundação** — Toda página autenticada vive dentro do app shell. Navegação ad-hoc com links locais ("← Voltar") é substituída pela sidebar/topbar.
4. **Mobile não é fase final** — O app shell nasce responsivo na Phase 18. Cada fase respeita breakpoints. A Phase 22 faz hardening e validação completa, não criação do zero.
5. **Sem loja não é bloqueio** — Usuário logado sem loja acessa o dashboard normalmente, vê estado guiado com CTA para configurar. Redirect abrupto para `/store` é eliminado.
6. **Dashboard não é painel de mídia** — Métricas são de geração: total de campanhas, taxa de sucesso, última campanha, campanhas recentes. Nada de CTR, impressões, gasto ou analytics de anúncios.
7. **Navegação previsível** — Sidebar tem seções fixas: Dashboard, Campanhas, Loja, Conta. "Nova Campanha" é CTA persistente na topbar ou destaque da sidebar.
8. **Estados vazios orientam ação** — Toda lista vazia ou seção sem dados mostra um estado vazio com: ícone, título, descrição e CTA claro para o próximo passo.
9. **Componentes compartilhados** — Toda UI usa os componentes base (`Button`, `Card`, `Input`, `Badge`, `EmptyState`, `Skeleton`, `PageHeader`) em vez de classes avulsas. Nenhum componente compartilhado é criado antes da necessidade real.
10. **Design tokens aplicados em todas as telas** — Nenhuma página autenticada usa classes de cor avulsas (`gray-*`, `blue-*`, `slate-*` inline). Toda cor vem dos tokens `bg-*`, `text-*`, `accent-*`, `border-*`.

---

## Ledger de Decisões

### D1 — URL naming: português nas rotas, inglês no código

`DECIDIDO`

- Rotas user-facing (autenticadas) em português: `/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta`
- Código interno: diretórios `campaign/`, `store/`, `account/` em inglês (já é o padrão)
- Redirects permanentes (via middleware ou `next.config`):
  - `/` → `/dashboard`
  - `/minhas-campanhas` → `/campanhas`
  - `/campanha/[id]` → `/campanhas/[id]`
  - `/store` → `/loja`
- Task explícita da Phase 18, não detalhe solto
- Rotas antigas mantêm redirect 301 por compatibilidade

### D2 — App shell mobile nasce na Phase 18

`DECIDIDO`

- Phase 18 entrega sidebar funcional em desktop e drawer/hamburger em mobile
- Topbar com CTA "Nova Campanha" visível em ambos os breakpoints
- Phase 22 faz hardening, testes de fluxo completo e validação cross-browser, **não** cria o comportamento mobile do zero

### D3 — Usuário sem loja não é redirect abrupto

`DECIDIDO`

- Usuário logado sem loja acessa `/dashboard` normalmente
- Dashboard mostra estado guiado: "Configure sua loja para criar sua primeira campanha"
- CTA leva para `/loja`
- Após salvar loja, volta para dashboard ou segue para `/campanhas/nova`
- Elimina o redirect seco atual (`if (!store) redirect("/store")`)
- `getCurrentStore` retorna `null` sem redirecionar; o dashboard trata o estado vazio

### D4 — Dashboard usa dados existentes, sem analytics novo

`DECIDIDO`

- Consome `listCampaigns()` e novos helpers agregados (`countCampaigns`, `successRate`, `getLatestCampaign`)
- Métricas: total de campanhas, campanhas prontas (ready), taxa de sucesso (ready / total), última campanha
- Nada de CTR, impressões, gasto, cliques ou analytics de anúncios
- Se os dados agregados não existirem como helpers, criá-los com SQL simples (COUNT, GROUP BY)

### D5 — Ordem das fases ajustada

`DECIDIDO`

A ordem original era App Shell → Dashboard → Histórico → Onboarding → Mobile. Ajustada para:

```
Phase 18 — App Shell + UI base + rotas
Phase 19 — Onboarding leve + estados vazios fundacionais
Phase 20 — Dashboard
Phase 21 — Histórico & Busca
Phase 22 — Mobile hardening
```

**Motivação:** onboarding e estados vazios vêm antes do dashboard para que ele já nasça sabendo lidar com usuário novo, sem loja e sem campanha. Isso evita refatorar o dashboard depois para adicionar tratamento de primeiro acesso.

> ✅ **Sincronizado em 2026-07-10:** `.planning/ROADMAP.md` e `.planning/REQUIREMENTS.md` atualizados para refletir esta ordem.

### D6 — Component library enxuta

`DECIDIDO`

Escopo mínimo e necessário para as fases 18-22:

- `Button` — primary (accent-green), secondary outline, ghost
- `Card` — bg-surface, border, rounded-xl
- `Input` — Padrão do MASTER.md com validação inline
- `Badge` — ready (green), error (red), etc.
- `EmptyState` — ícone + título + descrição + CTA
- `Skeleton` — loading states consistentes
- `PageHeader` — título + breadcrumb + ações opcionais

**O que NÃO fazer:** `DataTable`, `DropdownMenu`, abstrações grandes ou design system completo antes da necessidade real. Nada de componentes super-abstratos que não têm uso imediato nas fases 18-22.

### D7 — Direção visual do dashboard

`DECIDIDO`

Composição do dashboard v1.4:

```
┌──────────────────────────────────────────────────┐
│ Topo: saudação + contexto da loja + CTA principal│
├──────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ 47       │ │ 43       │ │ 91%      │           │
│ │ Total    │ │ Prontas  │ │ Sucesso  │           │
│ └──────────┘ └──────────┘ └──────────┘           │
│                                                   │
│ ┌────────────────────────────────────────────┐   │
│ │ Campanhas Recentes (3-5 itens)             │   │
│ │                                            │   │
│ │ ┌──┬──────────────────────────────────┬──┐ │   │
│ │ │🖼│ Tênis Runner Pro    02/07  ✅   │→│ │   │
│ │ ├──┼──────────────────────────────────┼──┤ │   │
│ │ │🖼│ Café Gourmet         01/07  ✅   │→│ │   │
│ │ ├──┼──────────────────────────────────┼──┤ │   │
│ │ │🖼│ Sofá 3 Lugares       30/06  ❌   │→│ │   │
│ │ └──┴──────────────────────────────────┴──┘ │   │
│ │                                            │   │
│ │ [Ver todas as campanhas →]                 │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ Card de próximo passo (um dos):                   │
│ ┌────────────────────────────────────────────┐   │
│ │ 🎯 Crie sua primeira campanha              │   │
│ │ [Criar Campanha]                           │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ Links discretos: "Configurar loja"                │
└──────────────────────────────────────────────────┘
```

- Saudação: "Bom dia, {{storeName}}" ou "Bem-vindo ao Vendeo" (primeiro acesso)
- Card de próximo passo é adaptativo: criar primeira campanha, configurar loja, revisar última, ver histórico
- "Ver todas" → `/campanhas`
- "Configurar loja" → `/loja`
- CTA principal "Nova Campanha" na topbar (persistente em todo o app)

---

## Arquitetura-Alvo

```
ARQUITETURA PÓS-V1.4
═══════════════════════════════════════════════════════════

                         ┌──────────────────────────┐
                         │        Browser           │
                         │  @supabase/ssr cookie    │
                         │  (sessão SSR)            │
                         └────────────┬─────────────┘
                                      │
                      ┌───────────────┼───────────────┐
                      │               │               │
                 middleware.ts   Server Component  Route Handler
                 (getClaims)     (getClaims)       (getClaims)
                 renova sessão   resolve loja      valida ownership
                 redirect auth   decide estado     executa operação
                      │               │               │
                      ▼               ▼               │
              ┌──────────────┐ ┌──────────────┐       │
              │ /login       │ │ Páginas:     │       │
              │ /signup      │ │ /dashboard   │       │
              │ /check-email │ │ /campanhas   │       │
              │ /auth/confirm│ │ /campanhas/  │       │
              │ (públicas)   │ │   nova       │       │
              └──────────────┘ │ /campanhas/  │       │
                               │   [id]       │       │
                               │ /loja        │       │
                               │ /conta       │       │
                               └──────────────┘       │
                                                      │
                 ┌────────────────────────────────────┘
                 │                    │
                 ▼                    ▼
      ┌──────────────────┐   ┌──────────────────┐
      │ Cliente sessão   │   │ supabaseAdmin    │
      │ (createServer-   │   │ (service role)   │
      │  Client + RLS)   │   │ + ownership      │
      │                  │   │ verificado antes │
      │ SELECTs          │   │                  │
      │ (campaigns,      │   │ Mutations        │
      │  stores, etc.)   │   │ (generate-image, │
      │                  │   │  download, etc.) │
      └────────┬─────────┘   └────────┬─────────┘
               │                      │
               ▼                      ▼
      ┌──────────────────────────────────────────────┐
      │              Supabase DB + Storage            │
      │                                                │
      │  public.campaigns           (RLS: SELECT)      │
      │  public.stores              (RLS: SELECT)      │
      │  public.store_brand_assets  (RLS: SELECT)      │
      │  public.store_brand_profiles(RLS: SELECT)      │
      │  public.store_visual_signatures(RLS: SELECT)   │
      │  public.generation_events   (default-deny)     │
      │                                                │
      │  storage.buckets:                               │
      │    campaign-images/   (privado + signed URLs)   │
      │    store-brand-assets (público + RLS SELECT)    │
      │    visual-signatures/ (público + RLS SELECT)    │
      │    store-logos/       (legado — cleanup pend.)  │
      └────────────────────────────────────────────────┘
```

### Fluxo de navegação pós-v1.4

```
SIGNUP                    ONBOARDING                USO REGULAR
════════                  ═════════                 ═══════════

[Signup]                  [/dashboard]              [/dashboard]
    │                         │                         │
    ▼                         ▼                         │
[/check-email]        [Empty state guiado]              │
    │                  "Configure sua loja"              │
    ▼                         │                         │
[Confirma email]              ▼                         │
    │                    [/loja]                         │
    ▼                         │                         │
[Login]                       │                         │
    │                         ▼                         │
    ▼                   [/dashboard]                    │
[/dashboard]           [Empty state guiado]              │
    │                  "Crie sua primeira"               │
    │                  campanha                          │
    │                         │                         │
    │                         ▼                         │
    │                   [/campanhas/nova]                │
    │                         │                         │
    │                         ▼                         │
    │                   [/campanhas/[id]]                │
    │                         │                         │
    └─────────────────────────┼─────────────────────────┘
                              │
                              ▼
                     [/campanhas] ← histórico
                     [/campanhas/[id]] ← revisão/download
                     [/campanhas/nova] ← nova geração
```

**Mudanças em relação ao fluxo atual (v1.3):**

| Comportamento | v1.3 | v1.4 |
|---------------|------|------|
| Landing pós-login | `/` (formulário) | `/dashboard` |
| Sem loja | Redirect `/store` | Dashboard com empty state + CTA |
| Navegação | Links locais em cada página | Sidebar + topbar global |
| Nova campanha | Só pelo formulário em `/` | CTA global na topbar |
| Campanhas | `/minhas-campanhas` | `/campanhas` |
| Campanha específica | `/campanha/[id]` | `/campanhas/[id]` |
| Loja | `/store` | `/loja` |
| Conta | Sem página dedicada | `/conta` |
| Mobile | Não tratado | App shell responsivo |

---

## Mapa de Rotas (pós-v1.4)

### Rotas públicas (sem auth)

| Rota | Descrição |
|------|-----------|
| `/login` | Login (existente, consolidado) |
| `/signup` | Cadastro (existente) |
| `/check-email` | Confirmação de email (existente) |
| `/forgot-password` | Recuperação de senha (existente) |
| `/update-password` | Atualização de senha (existente) |
| `/auth/confirm` | Callback de confirmação (existente) |

### Rotas autenticadas (dentro do app shell)

| Rota | Descrição | Fase |
|------|-----------|------|
| `/dashboard` | Landing pós-login com métricas e recentes | 19 base/empty states; 20 conteúdo completo |
| `/campanhas` | Lista de campanhas com busca e filtros | 21 |
| `/campanhas/nova` | Formulário de geração (migrado de `/`) | 18 |
| `/campanhas/[id]` | Página da campanha (migrado de `/campanha/[id]`) | 18 |
| `/loja` | Identidade da loja (migrado de `/store`) | 18 |
| `/conta` | Configurações da conta (nova rota) | 18 |

### API routes

| Rota | Descrição | Fase |
|------|-----------|------|
| `/api/campaign/generate-image` | Geração de campanha (existente) | — |
| `/api/campaign/[id]/download` | Download do original (existente) | — |
| `/api/campaign/[id]/publication-copy` | Edição de publication copy (existente) | — |
| Helper/Server Query `listCampaigns(storeId, params)` | Listagem paginada via Server Component + RLS. API route apenas se houver necessidade comprovada de consumo client-side | 21 |

### Redirects permanentes (301)

| De | Para | Fase |
|----|------|------|
| `/` | `/dashboard` | 18 |
| `/minhas-campanhas` | `/campanhas` | 18 |
| `/campanha/[id]` | `/campanhas/[id]` | 18 |
| `/store` | `/loja` | 18 |
| `/campaign/preview` | `/campanhas/nova` ou 410 | 18 |

---

## Fatiamento Macro Sugerido

> Abaixo, um fatiamento sugerido para decomposição. **Não é plano de implementação definitivo** — o detalhamento de cada fase, com tarefas, dependências e verificação, será feito nos planos de execução GSD. A ordem é indicativa e sequencial.

```
DEPENDÊNCIAS:  F18 → F19 → F20 → F21 → F22

Onde:
  F18 — App Shell + UI base + rotas (fundação)
  F19 — Onboarding leve + estados vazios fundacionais
  F20 — Dashboard
  F21 — Histórico & Busca
  F22 — Mobile hardening + validação
```

---

### F18 — App Shell + UI Base + Rotas

**O quê:**
- Componentes base: `Button`, `Card`, `Input`, `Badge`, `EmptyState`, `Skeleton`, `PageHeader`
- App shell com sidebar + topbar + main content area
- Sidebar: links Dashboard, Campanhas, Loja, Conta + seção ativa destacada
- Topbar: logo + CTA "Nova Campanha" persistente + menu de conta (config, sair)
- Comportamento mobile: sidebar vira drawer com hamburger toggle
- Layout tolera `store = null` (sidebar e topbar funcionam, dashboard decide o que mostrar)
- Migração de rotas: `/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta`
- Redirects permanentes (301) das rotas antigas
- Middleware atualizado com novas rotas públicas vs autenticadas
- AuthHeader substituído pelo app shell (header local removido)
- Consistência visual: aplicar design tokens em todas as páginas que usam classes avulsas (campanha [id], minhas-campanhas)
- Testes: 20+ testes (componentes, layout, redirects, mobile toggle)

**Não faz:**
- Dashboard (F20)
- Onboarding (F19)
- Busca/filtros (F21)
- Métricas agregadas

---

### F19 — Onboarding Leve + Estados Vazios Fundacionais

**O quê:**
- Estado vazio de dashboard para usuário sem loja: "Configure sua loja para começar"
- Estado vazio de dashboard para usuário com loja, sem campanhas: "Crie sua primeira campanha"
- Estado vazio de `/campanhas` para usuário sem campanhas: "Nenhuma campanha ainda"
- Estado vazio de `/campanhas` com filtro sem resultado: "Nenhuma campanha encontrada para este filtro"
- Estado vazio de `/loja` (não se aplica, loja sempre existe se chegou aqui — mas tratar estado de carregamento)
- Onboarding pós-login: primeiro acesso detectado, dashboard mostra CTA guiado
- Configuração de loja integrada: CTA → `/loja` → formulário → retorno ao dashboard
- `getCurrentStore` mantém comportamento atual (retorna `Store | null`); o redirecionamento seco `if (!store) redirect("/store")` é removido das páginas que passam a tratar `store=null` na UI: `/dashboard`, `/campanhas`, `/campanhas/[id]`. Páginas que dependem funcionalmente de loja (ex.: `/campanhas/nova`) mantêm redirect intencional para `/loja` ou `/dashboard` com guidance
- Microcopy clara em todos os estados vazios
- Testes: 15+ testes (estados vazios, onboarding flow, sem-loja)

**Não faz:**
- Conteúdo do dashboard (métricas, cards) — só estados vazios
- Evolução do histórico (busca, filtros)
- Mobile hardening

---

### F20 — Dashboard

**O quê:**
- Rota `/dashboard` com server component
- Helpers agregados: `countCampaigns(storeId)`, `successRate(storeId)`, `getLatestCampaign(storeId)`
- Bloco de métricas: total de campanhas, campanhas prontas, taxa de sucesso
- Seção "Campanhas Recentes": últimas 3-5 com thumbnail, nome, data, status, link
- Card de próximo passo adaptativo:
  - Sem campanhas → "Crie sua primeira campanha"
  - Com campanhas → "Revise sua última campanha" ou "Criar nova campanha"
- Saudação: "Bom dia, {{storeName}}" (hora do dia) ou "Bem-vindo ao Vendeo" (primeiro acesso)
- Layout responsivo: métricas em grid (3 col desktop, 1 col mobile)
- Links discretos: "Ver todas as campanhas →", "Configurar loja"
- Estados vazios reutilizam componentes da F19
- Testes: 20+ testes (helpers, renderização, responsividade, estados)

**Não faz:**
- Analytics avançado (CTR, impressões)
- Gráficos ou charts
- Data range picker
- Exportação de dados

---

### F21 — Histórico & Busca

**O quê:**
- Evoluir `listCampaigns()` para contrato de query com:
  - Paginação (offset + limit, cursor-based ou page-based)
  - Ordenação (data, nome, status)
  - Busca textual por nome do produto
  - Filtros por status (`ready`, `error`) e data (range)
- URL state reflete busca/filtros (compartilhável)
- UI de `/campanhas` com:
  - Campo de busca textual
  - Filtros visuais (dropdowns ou chips)
  - Lista paginada com thumbnails
  - Estado vazio para busca sem resultado
  - Paginação (carregar mais ou páginas numeradas)
- Helper de contagem total com filtros aplicados (para paginação)
- Remoção do `limit(50)` fixo
- Testes: 25+ testes (query builder, paginação, busca, filtros, URL state)

**Não faz:**
- Export em lote
- Seleção múltipla
- Comparação entre campanhas

---

### F22 — Mobile Hardening

**O quê:**
- Revisão de todas as telas em viewports mobile (320px–768px)
- Touch targets mínimos de 44×44px em todos os elementos interativos
- Drawer da sidebar funcionando em mobile com foco gerenciado e fechamento ao navegar
- Formulário de campanha em mobile: inputs largura total, botões acessíveis
- Página de campanha: imagem redimensionável, texto legível sem zoom
- Dashboard em mobile: métricas empilhadas, cards em coluna única
- Histórico em mobile: busca e filtros em overlay ou accordion
- Testes de responsividade (viewport simulator, breakpoint checks)
- Acessibilidade: `prefers-reduced-motion`, foco visível, `aria-*` no drawer
- Testes: 15+ testes de responsividade e acessibilidade mobile

**Não faz:**
- PWA / install prompt
- App Shell nativo
- Versão mobile-first do formulário de campanha (já deve estar responsivo desde F18)

---

## Matriz de Componentes por Fase

| Componente | F18 | F19 | F20 | F21 | F22 |
|------------|:---:|:---:|:---:|:---:|:---:|
| `Button` | Criar | — | — | — | Revisar |
| `Card` | Criar | — | — | — | Revisar |
| `Input` | Criar | — | — | — | Revisar |
| `Badge` | Criar | — | — | — | Revisar |
| `EmptyState` | Esboço | Finalizar | — | — | Revisar |
| `Skeleton` | Criar | — | — | — | Revisar |
| `PageHeader` | Criar | — | — | — | Revisar |
| App Shell | Criar | — | — | — | Hardening mobile |
| Redirects | Implementar | — | — | — | Verificar |
| Sidebar mobile | Drawer | — | — | — | Hardening |
| Dashboard | — | Estados vazios | Conteúdo | — | Responsivo |
| Campanhas list | — | Estados vazios | — | Busca/filtros | Responsivo |
| Onboarding | — | Fluxo | — | — | Responsivo |

---

## Fronteiras: Cliente de Sessão vs Service Role

### Novas operações da v1.4

| Operação | Cliente | Auth exigida | Ownership |
|----------|---------|-------------|-----------|
| **Dashboard** | | | |
| `GET /dashboard` (SC) | Sessão + RLS | ✅ middleware | ✅ RLS via subquery |
| `countCampaigns(storeId)` | Sessão + RLS (preferencial) / Admin (se necessário) | ✅ middleware ou API | ✅ RLS via subquery / ownership explícito |
| `successRate(storeId)` | Sessão + RLS (preferencial) / Admin (se necessário) | ✅ middleware ou API | ✅ RLS via subquery / ownership explícito |
| `getLatestCampaign(storeId)` | Sessão + RLS | ✅ middleware | ✅ RLS via subquery |
| **Campanhas v2** | | | |
| `GET /campanhas` (SC) | Sessão + RLS | ✅ middleware | ✅ RLS via subquery |
| `listCampaigns(storeId, query)` | Sessão + RLS (preferencial) / Admin (se necessário) | ✅ middleware ou API | ✅ RLS via subquery / ownership explícito |
| **Conta** | | | |
| `GET /conta` (SC) | Sessão | ✅ middleware | N/A (próprio usuário) |
| **Loja** | | | |
| `GET /loja` (SC) | Sessão + RLS | ✅ middleware | ✅ (já existente) |
| `PATCH /api/store` | Admin | ✅ `requireApiUser()` | ✅ (já existente) |

### Estratégia de cliente

- **SELECT em `campaigns` e `stores`:** Preferir cliente de sessão + RLS sempre que possível (simplicidade, RLS já isola por tenant)
- **Helpers agregados (`countCampaigns`, `successRate`):** Tentar primeiro com cliente de sessão + RLS. Usar `supabaseAdmin` (service role) com ownership verificado apenas se houver limitação técnica (ex.: RLS não cobre agregacões complexas ou tabelas sem política adequada)
- **Mutações:** `supabaseAdmin` (service role) com ownership verificado (já é o padrão existente e permanece)

---

## Pendências da Investigação

### Bucket `store-logos` — Status

**Inventário:** 0 objetos.
**Decisão v1.2:** Cleanup tracking separado, não bloqueia.
**Decisão v1.4:** Segue pendente. Incluir cleanup como tarefa de baixa prioridade na F18 ou criar tarefa avulsa.

### `listCampaigns()` — Evolução necessária

**Estado atual:** `SELECT ... .limit(50)` fixo, sem parâmetros de busca ou filtro.
**Necessidade v1.4:** Contrato de query com paginação, ordenação, busca textual e filtros.
**Decisão:** Não refatorar na F18. Manter como está até F21, quando o contrato de query será definido. A F18 só migra a rota e aplica o app shell.

### Middleware — Rotas atualizadas

O middleware atual (`src/middleware.ts`) precisa ser atualizado na F18 para refletir as novas rotas:
- Adicionar: `/dashboard`, `/campanhas/:path*`, `/loja`, `/conta`
- Remover: `/minhas-campanhas` (ou manter como fallback do redirect)
- Manter: `/campanha/:path*` como fallback do redirect ou remover após redirect 301 consolidado

---

*Documento criado: 2026-07-10*
*Última atualização: 2026-07-10*
*Próximo passo: revisão do artefato pelo time. Após aprovação, iniciar planejamento das fases via OpenSpec.*
