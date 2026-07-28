# Alinhamento Fase 18 — App Shell + UI Base + Rotas (v1.4)

## Contexto

```
v1.4 — Experiência SaaS (milestone)
  ├── Phase 18 — App Shell + UI Base + Rotas                       ← esta fase
  ├── Phase 19 — Onboarding leve + Estados vazios fundacionais
  ├── Phase 20 — Dashboard
  ├── Phase 21 — Histórico & Busca
  └── Phase 22 — Mobile hardening + validação
```

A milestone v1.2 (Contas/Ownership, F7–F11) e v1.3 (Persistência/Entrega, F12–F17) estão concluídas com 579 testes passando. O motor de campanha funciona, a persistência existe, a página individual e a listagem básica foram entregues.

**Problema:** O Vendeo hoje funciona como um formulário em `/` com páginas soltas (`/store`, `/campanha/[id]`, `/minhas-campanhas`). Não há estrutura de produto: sem navegação global, sem sidebar, sem topbar consistente, sem página de dashboard, sem página de conta. Rotas são em inglês misturado com português. O header global (`AuthHeader`) só tem "Minhas Campanhas" e "Sair". Não há tratamento mobile. A experiência não transmite confiança de produto SaaS profissional.

**Dependências:** F7 (middleware, sessão SSR), F8 (signup, login), F9 (`getCurrentStore`), F12 (tabelas), F15 (página de campanha), F16 (listagem de campanhas), F17 (edição publication copy). Design tokens existentes em `tailwind.config.ts` e `globals.css`.

---

## Propósito

1. Criar os 7 componentes base da UI: `Button`, `Card`, `Input`, `Badge`, `EmptyState`, `Skeleton`, `PageHeader`
2. Construir o **App Shell** com sidebar + topbar + área de conteúdo principal, responsivo com drawer mobile
3. **Migrar rotas** para o padrão definido na milestone: `/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta`
4. **Redirects permanentes** (301) das rotas antigas para as novas
5. **Atualizar middleware** com o novo conjunto de rotas públicas vs autenticadas
6. **Substituir o `AuthHeader`** pelo app shell (topbar + sidebar)
7. **Aplicar design tokens** nas telas migradas (consistência visual)
8. **Criar página `/conta`** (mínima útil) e **placeholder `/dashboard`** (conteúdo chega na F20)
9. **20+ testes** (componentes, layout, redirects, mobile toggle)

**Entrega verificável:**
- Usuário autenticado vê sidebar (Dashboard, Campanhas, Loja, Conta) + topbar (logo, CTA "Nova Campanha", menu de conta)
- Sidebar destaca a seção ativa
- Em mobile (<768px), sidebar vira drawer com hamburger toggle
- Navegar entre as seções funciona sem refresh de página
- Rotas antigas (`/`, `/store`, `/campanha/[id]`, `/minhas-campanhas`, `/campaign/preview`) redirecionam 301 para as novas
- Toda UI usa os tokens de design (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`)
- `AuthHeader` não existe mais — substituído pelo shell
- Shell funciona mesmo sem loja (`store = null`): sidebar e topbar não quebram
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F17)

```
                                       ANTES (F17)                        DEPOIS (F18)
═══════════════════════════════════════════════════════════════════════════════════════════

Routes:
  /                               formulário de campanha                 redirect 301 → /dashboard
  /minhas-campanhas               lista de campanhas                     /campanhas (conteúdo migrado)
  /campanha/[id]                  página de campanha                     /campanhas/[id] (conteúdo migrado)
  —                               inexistente                            /campanhas/nova (form migrado de /)
  /store                          configuração da loja                   /loja (conteúdo migrado)
  —                               inexistente                            /conta (mínima útil)
  /campaign/preview               redirect → /minhas-campanhas           redirect → /campanhas/nova

Layout:
  Root layout                     inline <header> com AuthHeader         html + body + fonts (sem header)
  AuthHeader                      "Minhas Campanhas" + "Sair"            REMOVIDO
  App Shell                       ✗ inexistente                          ✓ route group (app)/layout.tsx
  Sidebar                         ✗ inexistente                          ✓ Dashboard, Campanhas, Loja, Conta
  Topbar                          ✗ inexistente                          ✓ logo + CTA "Nova Campanha" + menu conta
  Mobile                          ✗ não tratado                          ✓ drawer com hamburger (funcional)

UI Components:
  Button                          inline <button> em toda parte           ✓ componente base
  Card                            inline <div> em toda parte             ✓ componente base
  Input                           inline <input> em toda parte           ✓ componente base
  Badge                           inline <span> em toda parte            ✓ componente base
  EmptyState                      inline em cada página                  ✓ componente base
  Skeleton                        inline ou inexistente                  ✓ componente base
  PageHeader                      ✗ inexistente                          ✓ componente base

Design Tokens:
  Uso de tokens                   parcial (store usa, outras não)         ✓ todas as telas migradas usam tokens

Middleware:
  Matcher                         rotas antigas                           ✓ rotas novas
  Autenticado →                   /                                      ✓ /dashboard
  Rotas públicas                  /login, /signup, etc.                   ✓ mantido

Store = null:
  Páginas que redirecionam        3 páginas (/, /minhas-campanhas,       ✓ shell tolera null
                                   /campanha/[id])                         páginas funcionais mantêm redirect

Testes                            ✗ específicos da F18                   ~25 novos
```

---

## Decisões de Arquitetura

### D1 — Route group `(app)/` com App Shell layout

`CONFIRMADO`

```
src/app/
├── (auth)/                  # Layout centrado (login, signup, forgot-password, etc.)
├── (app)/                   # Layout com App Shell (dashboard, campanhas/*, loja, conta)
│   ├── layout.tsx           ← App Shell
│   ├── dashboard/
│   │   └── page.tsx
│   ├── campanhas/
│   │   ├── page.tsx
│   │   ├── nova/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── loja/
│   │   └── page.tsx
│   └── conta/
│       └── page.tsx
├── api/                     # API routes (inalterado)
├── auth/                    # signout, confirm (inalterado)
├── layout.tsx               # Root layout: html, body, fonts, globals
└── page.tsx                 # redirect("/dashboard") — redundante pois next.config já faz 301
```

**Motivos:**
- `(auth)/` e `(app)/` têm layouts radicalmente diferentes — não faz sentido compartilhar
- O App Shell resolve auth + sessão uma vez no layout, não em cada página
- Rotas dentro do grupo herdam sidebar + topbar automaticamente
- Rotas antigas continuam funcionando via redirects em `next.config.ts`

**Implementação:**
- `layout.tsx` usa `requirePageUser()` para proteger o grupo inteiro
- `getCurrentStore()` resolvido no layout é opcional — o layout não depende de store para renderizar o shell
- Layout passa `user` via React Context ou prop drilling simples

---

### D2 — Redirects em `next.config.ts`

`CONFIRMADO`

Todos os redirects puramente baseados em path ficam em `next.config.ts` como redirects 301. Nenhum depende de auth — são mapeamentos estruturais.

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/", destination: "/dashboard", statusCode: 301 },
      { source: "/minhas-campanhas", destination: "/campanhas", statusCode: 301 },
      { source: "/campanha/:id", destination: "/campanhas/:id", statusCode: 301 },
      { source: "/store", destination: "/loja", statusCode: 301 },
      { source: "/campaign/preview", destination: "/campanhas/nova", statusCode: 301 },
    ];
  },
};
```

**Motivos:**
- `next.config.ts` redirects executam antes do middleware — mais performáticos
- São configuráveis, testáveis e fáceis de auditar
- Mantém o middleware focado em auth/sessão (única responsabilidade)

**Nota:** `/` e `/store` são removidos do `config.matcher` do middleware — não precisam mais ser interceptados lá.

---

### D3 — `/campaign/preview`: redirect 301 para `/campanhas/nova`

`CONFIRMADO`

Rota legada da era sessionStorage. Redirect 301 para `/campanhas/nova` em `next.config.ts`.

### D3a — Rotas antigas: remoção versus manutenção de arquivos

`CONFIRMADO`

- `next.config.ts` é a fonte única de verdade para os redirects 301
- Arquivos de páginas antigas **são removidos** — sem lógica duplicada, sem wrappers
- Exceção: `src/app/page.tsx` é mantida como fallback mínimo com `redirect("/dashboard")` — redundante com o redirect em next.config, mas não quebra nada e cobre casos em que o redirect do config não execute (ex.: dev server, race conditions)
- Os redirects em `next.config.ts` executam antes de qualquer middleware ou React — as rotas removidas nunca chegam a ser processadas pelo App Router
- Testes existentes que importam caminhos antigos são **migrados** para os novos caminhos em `src/app/(app)/`

**Arquivos removidos:**
- `src/app/minhas-campanhas/` (migrado para `(app)/campanhas/`)
- `src/app/campanha/[id]/` (migrado para `(app)/campanhas/[id]/`)
- `src/app/store/` (migrado para `(app)/loja/`)
- `src/app/campaign/preview/` (redirect via next.config)

---

### D4 — `/dashboard` em F18: placeholder

`CONFIRMADO`

Dashboard recebe conteúdo apenas na F20. Em F18:
- Página Server Component mínima dentro do route group `(app)`
- `<PageHeader title="Dashboard" />` + `<EmptyState>` com mensagem genérica
- Já nasce usando os tokens de design e o App Shell
- A F19 substitui o placeholder por estados vazios contextuais (sem loja, sem campanha)
- A F20 substitui estados vazios por métricas reais

---

### D5 — `/conta` em F18: mínima útil

`CONFIRMADO`

Página de configurações de conta com:
- Email do usuário via `claims.email` como identidade primária, com fallback para `claims.sub?.slice(0, 8)`
- Nome não está disponível no `JwtPayload` atual — se o tipo for estendido no futuro com `name`, deve ser exibido como "Name (email)"
- Link para `/update-password` (rota existente)
- Botão "Sair" (reutiliza o `LogoutButton` existente, com token cleanup — ver D11)
- Nada de billing, planos, preferências avançadas — fora de escopo

**Layout:** Usa `<PageHeader title="Conta" />` + cards de informação.

---

### D6 — `/campanhas` em F18 = `/minhas-campanhas` renomeada (sem evolução)

`CONFIRMADO`

O conteúdo atual de `/minhas-campanhas` é migrado para `/campanhas` sem alterações funcionais:
- `listCampaigns(storeId)` com `LIMIT 50`, filtro `ready`/`error`
- Lista com thumbnail, nome, data, status
- Estado vazio com CTA para criar campanha
- Link "Abrir" → `/campanhas/[id]`, "Baixar" → `/api/campaign/[id]/download`

**Busca, filtros, paginação são F21.** Não antecipar.

---

### D7 — Componentes base: enxutos e pragmáticos

`CONFIRMADO`

Os 7 componentes em `src/components/ui/`:

| Componente | Runtime | O que faz |
|------------|---------|-----------|
| `Button` | Client | `primary` (accent-green), `secondary` (outline), `ghost`. Props: `variant`, `size`, `disabled`, `loading`. Sem `asChild`/Slot — para links, usa-se `<Link>` estilizado com as mesmas classes da variante |
| `Card` | Server | Container com `bg-bg-surface`, `border`, `rounded-xl`. Props: `className`, `children` |
| `Input` | Client | Label, placeholder, erro inline, `onChange`. Props: `label`, `error`, `...input` |
| `Badge` | Server | Status colorido. Props: `variant` (`ready`, `error`, `generating`, `default`) |
| `EmptyState` | Server | Ícone + título + descrição + CTA opcional. Props: `icon`, `title`, `description`, `action` (ReactNode) |
| `Skeleton` | Server | Placeholder de loading animado. Props: `width`, `height`, `rounded` |
| `PageHeader` | Server* | Título + breadcrumbs opcionais + ações. Props: `title`, `breadcrumbs`, `actions` |

*PageHeader é Server Component se breadcrumbs e actions forem estáticos.

**O que NÃO fazer:** `DataTable`, `DropdownMenu`, `Command`, abstrações grandes. Se aparecer necessidade real em F19–F22, cria-se lá.

---

### D8 — Breadcrumbs no PageHeader: suporte opcional simples

`CONFIRMADO`

```typescript
interface Breadcrumb {
  label: string;
  href?: string; // se undefined, é o item atual (sem link)
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
}
```

**Exemplo de uso em `/campanhas/[id]`:**
```
<PageHeader
  title="Tênis Runner Pro"
  breadcrumbs={[
    { label: "Campanhas", href: "/campanhas" },
    { label: "Tênis Runner Pro" },
  ]}
/>
```

**Implementação:** Container flex simples, sem criar sistema de roteamento de breadcrumbs. Cada página declara os seus.

---

### D9 — Drawer mobile: funcional em F18, polimento em F22

`CONFIRMADO`

O App Shell em F18 entrega:
- Sidebar visível em desktop (>768px)
- Hamburger button na topbar em mobile (<768px)
- Drawer desliza da esquerda com os mesmos links da sidebar
- Fecha ao navegar (clicar em link)
- Fecha ao clicar fora (overlay)
- Fecha ao pressionar Escape
- `aria-controls`, `aria-expanded`, `aria-label` no hamburger
- Body scroll lock quando aberto

**Não faz em F18:**
- Animações sofisticadas (fade + slide simples via Tailwind basta)
- `prefers-reduced-motion` (F22)
- Focus trapping completo (F22)
- Testes cross-browser exaustivos (F22)
- Touch targets 44×44 audit (F22)

---

### D10 — Store = null: shell tolera, páginas funcionais mantêm redirect

`CONFIRMADO`

O App Shell (`(app)/layout.tsx`) NÃO depende de `getCurrentStore()`. O layout verifica apenas auth (`requirePageUser()`). A topbar (logo + CTA + menu conta) e a sidebar funcionam sem store.

Páginas que funcionalmente dependem de loja para operar:

| Página | Store necessário? | Comportamento se null |
|--------|:-----------------:|-----------------------|
| `/dashboard` | ✅ (F20) | F18: placeholder. F19: estado vazio guiado |
| `/campanhas` | ✅ (lista) | F18 mantém redirect para `/loja` ou `/dashboard`. F19: estado vazio |
| `/campanhas/nova` | ✅ (form) | Redirect para `/loja` (ou `/dashboard` com guidance). Decidir em F19 |
| `/campanhas/[id]` | ✅ (ownership) | 404 se não for dono. Sem store não chega aqui |
| `/loja` | — | Página de criação/configuração. Store pode ser null (é onde se cria) |
| `/conta` | ❌ | Funciona sem store. Só dados do usuário |

**Resumo:** F18 não remove os redirects existentes (`if (!store) redirect(...)`). A remoção e tratamento de estados vazios é F19. F18 só garante que o shell não quebra quando `store = null`.

---

### D11 — Design token cleanup: telas da F18 apenas

`CONFIRMADO`

Aplicar design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`, `font-heading`, `font-body`) nas seguintes telas:

| Tela | Ação |
|------|------|
| Shell (sidebar + topbar) | Criar com tokens |
| `/dashboard` | Criar com tokens |
| `/campanhas` | Migrar de `/minhas-campanhas` — converter tokens |
| `/campanhas/nova` | Migrar de `/` — converter tokens |
| `/campanhas/[id]` | Migrar de `/campanha/[id]` — converter tokens, substituir emoji icons por Lucide |
| `/loja` | Migrar de `/store` — já usa tokens em grande parte, conferir |
| `/conta` | Criar com tokens |
| `LogoutButton` | Adaptar para tokens (slate-* → text-text-* / accent-*) ou aceitar variant/className |
| Root layout | Remover `<header>` com AuthHeader. Manter html/body/fonts |

**Não escopo:** Componentes de renderização de arte (`campaign-renderer.tsx`, etc.), páginas não autenticadas (auth pages), componentes que não são UI do app.

---

### D12 — AuthHeader substituído pelo App Shell

`CONFIRMADO`

O `AuthHeader` em `src/components/auth/auth-header.tsx` é removido. Suas responsabilidades são absorvidas por:
- **Sidebar:** links estruturais (Dashboard, Campanhas, Loja, Conta)
- **Topbar:** CTA "Nova Campanha" + menu de conta (dropdown com "Configurações" → `/conta` e "Sair")
- **Root layout:** perde o `<header>` — o html/body passa a ser só estrutura base

---

### D13 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **18-01** | Fundação UI + estrutura | 7 componentes base em `src/components/ui/`, estrutura de diretórios do route group `(app)/`, root layout sem AuthHeader, `next.config.ts` redirects |
| **18-02** | App Shell | Sidebar, topbar, CTA "Nova Campanha", menu de conta, drawer mobile, `(app)/layout.tsx`, tolerância a store=null |
| **18-03** | Rotas + migração visual | Migrar `/` → `/campanhas/nova`, `/minhas-campanhas` → `/campanhas`, `/campanha/[id]` → `/campanhas/[id]`, `/store` → `/loja`, criar `/dashboard` placeholder e `/conta`, atualizar middleware, design token cleanup, remover AuthHeader |

```
18-01 ──► 18-02 ──► 18-03
(UI base)  (shell)   (rotas + migração)
```

**Testes distribuídos:**
- 18-01: 7 testes de componentes (1 por componente base)
- 18-02: 6-8 testes (sidebar, topbar, drawer mobile, menu conta, layout geral)
- 18-03: 10+ testes (redirects 301, middleware, página conta, navegação entre rotas)

---

## Estrutura de Código

```
src/
├── components/
│   ├── auth/
│   │   ├── auth-header.tsx             ← REMOVIDO
│   │   └── logout-button.tsx           ← MODIFICADO: tokens cleanup (slate-* → tokens)
│   ├── ui/                              ← NOVO: componentes base
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── empty-state.tsx
│   │   ├── skeleton.tsx
│   │   └── page-header.tsx
│   ├── shell/                           ← NOVO: App Shell
│   │   ├── app-shell.tsx               ← server component que monta sidebar + topbar + children
│   │   ├── sidebar.tsx                  ← sidebar com links e destaque da rota ativa
│   │   ├── sidebar-drawer.tsx           ← versão mobile (drawer com overlay)
│   │   ├── topbar.tsx                   ← logo + CTA + menu de conta
│   │   └── account-menu.tsx            ← dropdown com Configurações + Sair
│   └── flow/                            ← mantido (componentes de domínio existentes)
│
├── app/
│   ├── (auth)/                          ← mantido (inalterado)
│   │   └── layout.tsx
│   ├── (app)/                           ← NOVO: grupo de rotas protegidas
│   │   ├── layout.tsx                   ← App Shell wrapper (auth + shell)
│   │   ├── dashboard/
│   │   │   └── page.tsx                ← NOVO: placeholder
│   │   ├── campanhas/
│   │   │   ├── page.tsx                ← NOVO (conteúdo migrado de /minhas-campanhas)
│   │   │   ├── nova/
│   │   │   │   └── page.tsx            ← NOVO (conteúdo migrado de /)
│   │   │   └── [id]/
│   │   │       ├── page.tsx            ← NOVO (conteúdo migrado de /campanha/[id])
│   │   │       └── client.tsx          ← NOVO (conteúdo migrado + token cleanup)
│   │   ├── loja/
│   │   │   └── page.tsx                ← NOVO (conteúdo migrado de /store)
│   │   └── conta/
│   │       └── page.tsx                ← NOVO: página de conta mínima
│   ├── api/                              ← mantido (inalterado)
│   ├── auth/                             ← mantido (inalterado)
│   ├── layout.tsx                        ← MODIFICADO: remove <header> com AuthHeader
│   └── page.tsx                         ← MODIFICADO: redirect("/dashboard")
│
├── app/ (old)
│   ├── minhas-campanhas/                 ← REMOVIDO (migrado para (app)/campanhas/)
│   ├── campanha/[id]/                    ← REMOVIDO (migrado para (app)/campanhas/[id]/)
│   ├── store/                            ← REMOVIDO (migrado para (app)/loja/)
│   └── campaign/preview/                 ← REMOVIDO (redirect via next.config)
│
├── middleware.ts                        ← MODIFICADO: matcher com novas rotas
│
├── lib/
│   ├── auth/
│   │   └── store-ownership.ts          ← mantido (inalterado)
│   ├── campaign/
│   │   ├── list.ts                     ← mantido (inalterado, F21 evolui)
│   │   └── ...                         ← mantido
│   └── supabase/
│       └── middleware.ts               ← mantido (inalterado)
│
├── next.config.ts                       ← MODIFICADO: redirects 301
└── tailwind.config.ts                   ← mantido (inalterado, tokens já existem)
```

---

## Testes

### `components/ui/*.test.tsx` (7 testes — 1 por componente)

| Teste | O que valida |
|-------|-------------|
| `Button` renderiza variantes `primary`/`secondary`/`ghost` | Classes CSS corretas por variante |
| `Button` desabilitado tem `disabled` attr e estilo | `disabled` attribute + opacidade |
| `Card` renderiza children com classes base | `bg-bg-surface`, `border`, `rounded-xl` |
| `Input` renderiza label + input + mensagem de erro | Label presente, placeholder, erro inline |
| `Badge` renderiza variantes `ready`/`error`/`default` | Cor de fundo e texto por status |
| `EmptyState` renderiza ícone + título + descrição + CTA | Todos os slots preenchidos |
| `Skeleton` aceita `width`/`height`/`rounded` | Estilos aplicados via className |
| `PageHeader` renderiza título + breadcrumbs + ações | Breadcrumbs com/sem link, actions slot |

### `shell/*.test.tsx` (6-8 testes)

| Teste | O que valida |
|-------|-------------|
| App Shell renderiza sidebar + topbar + children | Layout de 3 áreas |
| Sidebar contém links Dashboard, Campanhas, Loja, Conta | Todos os links presentes |
| Sidebar destaca rota ativa | Classe ativa no link correspondente ao pathname |
| Topbar contém CTA "Nova Campanha" | Link → `/campanhas/nova` |
| Menu de conta mostra "Configurações" e "Sair" | Dropdown com ambas as opções |
| Drawer mobile abre/fecha com hamburger | Overlay + menu visível |
| Drawer fecha ao clicar em link | Navegação + fechamento |
| Shell não quebra quando `store = null` | Renderiza sem erro mesmo sem store disponível |

### `next.config.test.ts` — Redirects (4-5 testes)

| Teste | O que valida |
|-------|-------------|
| `/` → `/dashboard` (301) | Redirect configurado |
| `/minhas-campanhas` → `/campanhas` (301) | Redirect configurado |
| `/campanha/:id` → `/campanhas/:id` (301) | Redirect com parâmetro dinâmico |
| `/store` → `/loja` (301) | Redirect configurado |
| `/campaign/preview` → `/campanhas/nova` (301) | Redirect configurado |

### `middleware.test.ts` — Matcher (2-3 testes)

| Teste | O que valida |
|-------|-------------|
| `matcher` contém `/dashboard`, `/campanhas/:path*`, `/loja`, `/conta` | Novas rotas protegidas |
| `matcher` não contém mais `/store/:path*`, `/campanha/:path*`, `/minhas-campanhas` (ou mantém como fallback) | Consistente com redirects |
| Autenticado em rota pública → redirect para `/dashboard` (e não mais `/`) | Comportamento atualizado |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Route group `(app)/` quebra links internos existentes | Mapear todos os `Link` e `redirect()` para rotas antigas antes de migrar. Testar navegação completa |
| Drawer mobile sem focus trap causa problemas de acessibilidade | F18 entrega funcionalidade básica (Escape fecha, overlay fecha). Focus trapping completo em F22 |
| F18 vira "já que vamos mexer..." e escopo cresce | Alignment doc define fronteiras claras. Seção Fora do Escopo é explícita |
| Middleware e next.config redirects em conflito | Redirects em next.config executam primeiro. Middleware só vê a rota final. Testar sequência |
| `store = null` quebra página de campanhas/nova (precisa de store) | Mantido redirect atual para `/loja`. F19 refina com estados vazios |
| Emoji icons em `campanha/[id]/client.tsx` substituídos por Lucide | Tarefa explícita no plano 18-03. Conferir todos os ícones |
| Breadcrumb no PageHeader fica inconsistente entre páginas | Cada página declara seus breadcrumbs. Sem sistema automático — consistência via revisão de código |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Dashboard com métricas | F20 |
| Onboarding completo (estados vazios contextuais, fluxo sem-loja) | F19 |
| Busca, filtros, paginação em `/campanhas` | F21 |
| Mobile hardening (focus trap, prefers-reduced-motion, touch targets) | F22 |
| Billing / planos | Fora da v1.4 |
| Múltiplas lojas (1:N) | Fora da v1.4 |
| Times / permissões | Fora da v1.4 |
| Analytics avançado (CTR, impressões) | Fora da v1.4 |
| Editor visual livre (Canva-like) | Fora da v1.4 |
| PWA / install prompt | Fora da v1.4 |
| Componentes além dos 7 base | D6 explicita: apenas Button, Card, Input, Badge, EmptyState, Skeleton, PageHeader |
| `asChild`/Slot no Button | Sem Radix/Slot no projeto. Para links, usar `<Link>` com classes da variante |
| Supabase gen types | Pós-v1.4 |
| Troca de fontes (Fira Code/Sans) | MASTER.md desatualizado. Fontes atuais (Open Sans + Poppins) mantidas |
| Tema light | Dark mode apenas. Fora da v1.4 |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Route group `(app)/` com App Shell layout
- [ ] D2 — Redirects em `next.config.ts` (301, puramente baseados em path)
- [ ] D3 — `/campaign/preview` → redirect 301 para `/campanhas/nova`
- [ ] D4 — `/dashboard` em F18: placeholder (conteúdo F20)
- [ ] D5 — `/conta` em F18: mínima útil (email via claims.email, nome se disponível com fallback, update-password, sair)
- [ ] D6 — `/campanhas` em F18 = `/minhas-campanhas` renomeada (sem evolução)
- [ ] D7 — Componentes base enxutos: Button (sem asChild/Slot), Card, Input, Badge, EmptyState, Skeleton, PageHeader
- [ ] D8 — Breadcrumbs opcionais no PageHeader via array `{ label, href? }`
- [ ] D9 — Drawer mobile funcional em F18, polimento acessível em F22
- [ ] D10 — Store = null: shell tolera, páginas funcionais mantêm redirect (F19 refina)
- [ ] D11 — Design token cleanup: apenas telas tocadas pela F18
- [ ] D12 — AuthHeader removido, funcionalidade absorvida pelo shell
- [ ] D13 — Três planos de execução: 18-01 (fundação) | 18-02 (shell) | 18-03 (rotas + migração)

### Plano 18-01 — Fundação UI + estrutura
- [ ] `src/components/ui/button.tsx` com variantes primary/secondary/ghost, disabled, loading
- [ ] `src/components/ui/card.tsx` com bg-bg-surface, border, rounded-xl
- [ ] `src/components/ui/input.tsx` com label, placeholder, erro inline
- [ ] `src/components/ui/badge.tsx` com variantes ready/error/generating/default
- [ ] `src/components/ui/empty-state.tsx` com ícone + título + descrição + CTA opcional
- [ ] `src/components/ui/skeleton.tsx` com width/height/rounded animado
- [ ] `src/components/ui/page-header.tsx` com título + breadcrumbs opcionais + actions
- [ ] Estrutura de diretórios `src/app/(app)/` com layout.tsx vazio (esqueleto)
- [ ] `src/app/layout.tsx`: remover `<header>` com AuthHeader, manter html/body/fonts/globals
- [ ] `src/app/page.tsx`: redirect("/dashboard") (simplificado, next.config já faz)
- [ ] `next.config.ts`: adicionar `async redirects()` com 5 redirects 301
- [ ] Testes dos 7 componentes (1 cenário cada)

### Plano 18-02 — App Shell
- [ ] `src/components/shell/sidebar.tsx`: links Dashboard, Campanhas, Loja, Conta + destaque rota ativa
- [ ] `src/components/shell/topbar.tsx`: logo + CTA "Nova Campanha" + account-menu
- [ ] `src/components/shell/account-menu.tsx`: dropdown Configurações + Sair (Lucide icons)
- [ ] `src/components/shell/sidebar-drawer.tsx`: versão mobile com hamburger + overlay + fechamento
- [ ] `src/components/shell/app-shell.tsx`: monta sidebar + topbar + children
- [ ] `src/app/(app)/layout.tsx`: requirePageUser() + app-shell, tolera store=null
- [ ] Testes do shell (6-8 cenários: render, sidebar ativa, topbar, drawer, menu conta, null store)

### Plano 18-03 — Rotas + migração visual
- [ ] Migrar `/campanhas/nova` de `/` (campaign form, sem store redirect mantido)
- [ ] Migrar `/campanhas` de `/minhas-campanhas` (listagem, sem store redirect mantido)
- [ ] Migrar `/campanhas/[id]` de `/campanha/[id]` (página de campanha + client)
- [ ] Migrar `/loja` de `/store` (store onboarding)
- [ ] Criar `/dashboard` placeholder (PageHeader + EmptyState)
- [ ] Criar `/conta` (email, update-password link, sair)
- [ ] `src/middleware.ts`: novo matcher com `/dashboard`, `/campanhas/:path*`, `/loja`, `/conta`
- [ ] Middleware: redirect autenticado → `/dashboard` (em vez de `/`)
- [ ] Remover `src/components/auth/auth-header.tsx`
- [ ] `src/components/auth/logout-button.tsx`: adaptar para usar design tokens (substituir `slate-*`/`blue-*` por `text-text-*`/`accent-*`) ou aceitar `variant`/`className` para uso no shell e `/conta`
- [ ] Design token cleanup nas telas migradas (converter classes raw, substituir emoji por Lucide)
- [ ] Atualizar links internos em todos os componentes (apontar para novas rotas)
- [ ] Migrar testes existentes de rotas antigas para os novos caminhos em `src/app/(app)/`
- [ ] Testes de redirects (next.config) (5 cenários)
- [ ] Testes de middleware matcher (2-3 cenários)

### Verificação final
- [ ] Navegação completa em desktop: sidebar, topbar, CTA, menu conta, todas as seções acessíveis
- [ ] Navegação completa em mobile: hamburger, drawer, fechamento ao navegar
- [ ] Rotas antigas redirecionam 301 para as novas
- [ ] Shell não quebra com store = null
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando (20+ novos + 579 existentes)
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-13*
*Baseado no alinhamento da milestone v1.4, estado atual do código (pós-F17), discussão exploratória do time e decisões registradas no ledger da milestone.*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 18*
