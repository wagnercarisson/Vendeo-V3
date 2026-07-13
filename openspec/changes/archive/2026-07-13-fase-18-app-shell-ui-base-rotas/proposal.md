## Why

O Vendeo hoje funciona como um formulário em `/` com páginas soltas (`/store`, `/campanha/[id]`, `/minhas-campanhas`). Não há estrutura de produto: sem navegação global, sem sidebar, sem topbar consistente, sem página de dashboard, sem página de conta. Rotas são em inglês misturado com português. O header global (`AuthHeader`) só tem "Minhas Campanhas" e "Sair". Não há tratamento mobile. A experiência não transmite confiança de produto SaaS profissional — essencial para a milestone v1.4 (Experiência SaaS).

## What Changes

- **Criar 7 componentes base de UI**: `Button` (primary/secondary/ghost, disabled, loading), `Card`, `Input` (label, placeholder, erro inline), `Badge` (status colorido), `EmptyState` (ícone + título + descrição + CTA), `Skeleton` (placeholder animado), `PageHeader` (título + breadcrumbs opcionais + ações)
- **Construir o App Shell**: sidebar com links Dashboard/Campanhas/Loja/Conta + destaque da rota ativa, topbar com logo + CTA "Nova Campanha" + menu de conta (Configurações/Sair), drawer mobile com hamburger + overlay + fechamento ao navegar/pressionar Escape
- **Migrar rotas para o padrão definido**: `/dashboard` (placeholder), `/campanhas` (ex-`/minhas-campanhas`), `/campanhas/nova` (ex-`/`), `/campanhas/[id]` (ex-`/campanha/[id]`), `/loja` (ex-`/store`), `/conta` (nova — mínima útil)
- **Redirects permanentes (301)** em `next.config.ts` para todas as rotas antigas
- **Atualizar middleware** com o novo conjunto de rotas: matcher inclui `/dashboard`, `/campanhas/:path*`, `/loja`, `/conta`; redirect autenticado → `/dashboard`
- **Substituir o `AuthHeader`** pelo App Shell (sidebar + topbar assumem suas responsabilidades)
- **Aplicar design tokens** (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`) nas telas migradas
- **Remover arquivos de páginas antigas**: `src/app/minhas-campanhas/`, `src/app/campanha/[id]/`, `src/app/store/`, `src/app/campaign/preview/`
- **Limpar root layout**: remover `<header>` com AuthHeader, manter apenas html/body/fonts/globals
- **Criar `/conta`** (mínima útil: email via `claims.email` como identidade primária, link update-password, botão sair) e **placeholder `/dashboard`** (PageHeader + EmptyState)
- **25+ testes**: 7 de componentes, 6-8 do shell, 5 de redirects, 2-3 de middleware, 3+ de integração

## Capabilities

### New Capabilities

- `ui-base-components`: 7 componentes base enxutos (Button sem asChild/Slot, Card, Input, Badge, EmptyState, Skeleton, PageHeader) em `src/components/ui/`
- `app-shell`: App Shell com sidebar + topbar + drawer mobile + menu de conta, responsivo, tolerante a `store = null`
- `route-redirects`: 5 redirects 301 em `next.config.ts` (`/` → `/dashboard`, `/minhas-campanhas` → `/campanhas`, `/campanha/:id` → `/campanhas/:id`, `/store` → `/loja`, `/campaign/preview` → `/campanhas/nova`)
- `conta-page`: Página de conta mínima útil (email como identidade primária, link update-password, botão sair)
- `dashboard-placeholder`: Página de dashboard placeholder (PageHeader + EmptyState, conteúdo chega na F20)

### Modified Capabilities

- `auth-middleware`: Atualizar matcher para novas rotas (`/dashboard`, `/campanhas/:path*`, `/loja`, `/conta`); remover rotas antigas do matcher; redirect autenticado → `/dashboard`
- `campaign-page-ui`: Migrar de `/campanha/[id]` para `/campanhas/[id]`; substituir emoji icons por Lucide; aplicar tokens de design
- `campaign-list-ui`: Migrar de `/minhas-campanhas` para `/campanhas`; aplicar tokens de design
- `campaign-input-ui`: Migrar de `/` para `/campanhas/nova`; aplicar tokens de design
- `store-identity-ui`: Migrar de `/store` para `/loja`; conferir tokens já existentes
- `auth-header`: Remover `AuthHeader`; responsabilidades absorvidas pelo App Shell
- `auth-logout`: Adaptar `LogoutButton` para usar tokens de design (`slate-*` → `text-text-*`/`accent-*`)

## Impact

- **Novos**: `src/components/ui/` (7 componentes), `src/components/shell/` (5 componentes), `src/app/(app)/` (estrutura de diretórios + layout), `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/conta/page.tsx`
- **Novos testes**: `src/__tests__/components/ui/*.test.tsx`, `src/__tests__/components/shell/*.test.tsx`, `src/__tests__/next.config.test.ts`, `src/__tests__/middleware.test.ts`
- **Migrados**: `src/app/(app)/campanhas/page.tsx` (ex `/minhas-campanhas`), `src/app/(app)/campanhas/nova/page.tsx` (ex `/`), `src/app/(app)/campanhas/[id]/` (ex `/campanha/[id]`), `src/app/(app)/loja/page.tsx` (ex `/store`)
- **Modificados**: `src/app/layout.tsx` (remover AuthHeader), `src/app/page.tsx` (redirect `/dashboard`), `src/middleware.ts` (novo matcher), `next.config.ts` (+ redirects 301), `src/components/auth/logout-button.tsx` (tokens), `src/app/api/campaign/generate-image/route.ts` (campaignUrl → `/campanhas/${id}`)
- **Removidos**: `src/components/auth/auth-header.tsx`, `src/app/minhas-campanhas/`, `src/app/campanha/[id]/`, `src/app/store/`, `src/app/campaign/preview/`
- **Arquivos .spec.ts removidos**: arquivos spec das páginas antigas que não são mais necessários (`/store/page.spec.ts`, etc.)
- **Nenhuma alteração**: `lib/`, `(auth)/`, `tailwind.config.ts`, banco de dados, storage
