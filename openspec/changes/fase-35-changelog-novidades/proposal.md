## Why

O Vendeo já tem 14 fases de frontend implementadas (app shell, dashboard, criação de campanha, fluxo de conta, admin operacional, créditos, legal, readiness), mas nenhuma dessas entregas é comunicada ao lojista de forma estruturada. O usuário que volta ao produto depois de alguns dias descobre novas funcionalidades por acaso ou simplesmente não descobre — gerando subutilização de features entregues, frustração com mudanças comportamentais que pegam o usuário desprevenido, sensação de produto "parado" e dependência de canais externos (email, WhatsApp) para comunicar o que podia ser comunicado dentro do produto.

## What Changes

- **Fonte de dados de changelog** — arquivos Markdown com frontmatter YAML em `content/changelog/`, versionados no repositório, editáveis por qualquer pessoa do time (sem JSON, sem `/public`, sem Supabase)
- **Página dedicada `/novidades`** — listagem cronológica completa das mudanças, com badges de categoria (feature/improvement/fix) e indicador de importância (major/minor)
- **Item fixo na sidebar** — "Novidades" como quinto item de navegação com indicador visual de conteúdo novo; link secundário no AccountMenu
- **Card/modal de anúncio na dashboard** — card discreto (padrão) ou modal (mudança crítica), controlado por `announcement: "none" | "card" | "modal"` no frontmatter
- **Indicador de novidades via localStorage** — sem requisição extra, sem back-end, sem Supabase; dois controles separados: visita a `/novidades` (indicador da sidebar) × dispensa do anúncio (card/modal)
- **Parser próprio de frontmatter + renderer controlado** — zero dependências novas; Zod (já existente no projeto) valida frontmatter com fail fast no build
- **Rotina documentada de atualização** — guia `docs/changelog-update.md` (já criado no alinhamento da F35) usado no verify para decidir registrar ou não uma novidade; a implementação pode ajustá-lo se necessário

**Entrega verificável:** 3 entries de exemplo em `content/changelog/` (F30, F32, F34), página `/novidades` funcional, sidebar com indicador, badges de categoria com cores do design system, card de anúncio na dashboard apenas para `announcement !== "none"`, e `npm run typecheck`, `npm run lint`, `npx vitest run` sem erros.

**Divergência de numeração (documentada):** este change adota a numeração do artefato de alinhamento F35 (Changelog/Novidades) e desloca Stripe/Monetização Pública para F36. `.planning/STATE.md` e `ROADMAP.md` ainda listam F35 = Stripe; serão atualizados após aprovação deste change.

## Capabilities

### New Capabilities

- `changelog-content`: Fonte de dados estática `content/changelog/*.md` com frontmatter YAML (id, title, date, milestone, category, importance, announcement), parser próprio sem dependências, renderer controlado (h2, parágrafos, listas, negrito) e módulo `get-changelog.ts` com `getAllEntries()`, `getLatestAnnouncement()`, `getEntryById()` — ordenação por data DESC, validação Zod fail-fast no build
- `changelog-state`: Hook `useChangelogState` com dois controles independentes de localStorage (`vendeo:last_seen_changelog_id` e `vendeo:dismissed_changelog_announcement_id`), funções `markChangelogAsViewed`, `dismissAnnouncement`, `hasUnseen`, `isAnnouncementVisible` — SSR-safe
- `changelog-ui`: Página `/novidades` (server component) + componentes `changelog-card` (badge de categoria, data, importância, conteúdo renderizado), `changelog-list`, `changelog-announcement` (card padrão / modal exceção), `sidebar-badge` (indicador client-side)

### Modified Capabilities

- `app-shell`: Sidebar ganha 5º item "Novidades" (`/novidades`, ícone Lucide) com indicador de novidades; AccountMenu ganha link secundário "Novidades" entre Configurações e Sair
- `dashboard-inteligente`: Dashboard renderiza `<ChangelogAnnouncement entry={latestAnnouncement} />` após `VerificationBanners` e `ReadinessCheckBanner`, antes do conteúdo principal; não quebra quando `latestAnnouncement === null`

## Impact

- **Novos arquivos**: `content/changelog/` (3 entries .md de exemplo), `src/lib/changelog/` (`types.ts`, `parse-frontmatter.ts`, `render-markdown.ts`, `schema.ts`, `get-changelog.ts`, `__tests__/`), `src/hooks/use-changelog-state.ts`, `src/components/changelog/` (4 componentes), `src/app/(app)/novidades/page.tsx`
- **Guia de rotina**: `docs/changelog-update.md` (já existente — pode ser ajustado pela implementação, não recriado)
- **Arquivos modificados**: `src/app/(app)/layout.tsx` (busca `getAllEntries()` no server e injeta `latestChangelogEntryId`), `src/components/shell/app-shell.tsx` (repasse de prop `latestChangelogEntryId` → Sidebar/SidebarDrawer), `src/components/shell/sidebar-drawer.tsx` (repasse de prop), `src/components/shell/sidebar.tsx` (NAV_ITEMS + badge + prop), `src/components/shell/account-menu.tsx` (link "Novidades"), `src/app/(app)/dashboard/page.tsx` (ChangelogAnnouncement)
- **Dependências**: zero novas — parser próprio; `zod` já presente (^3.24.4); `lucide-react` já presente para ícones
- **Sem migration SQL** — dados estáticos + localStorage
- **Sem mudança de API pública** — sem novas rotas de API
- **Dependências de fases anteriores**: F30 (terminologia de Fundação Legal na entry seed), F32 (Freemium CNPJ na entry seed), F34 (Store Readiness na entry seed)
