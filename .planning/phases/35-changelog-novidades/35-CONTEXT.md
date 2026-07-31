# Phase 35: Changelog/Novidades - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-35-changelog-novidades/`)

<domain>
## Phase Boundary

O Vendeo já tem 14 fases de frontend implementadas (app shell, dashboard, criação de campanha, fluxo de conta, admin operacional, créditos, legal, readiness), mas nenhuma dessas entregas é comunicada ao lojista de forma estruturada. O usuário que volta ao produto depois de alguns dias descobre novas funcionalidades por acaso ou não descobre — gerando subutilização, frustração com mudanças comportamentais inesperadas e sensação de produto "parado". A F35 cria a voz do produto: um changelog editorial (não release notes técnico) com fonte de dados estática em `content/changelog/*.md`, página dedicada `/novidades`, item fixo na sidebar com indicador, card/modal de anúncio na dashboard e indicador de novidades via localStorage — sem Supabase, sem requisição extra, sem estado global, sem dependências novas.

**Divergência de numeração (documentada):** o artefato de alinhamento renumera a v1.5 — F35 = Changelog/Novidades, F36 = Stripe/Monetização Pública. `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` foram atualizados para refletir essa renumeração.

**Dependências:** F30 (termo "Fundação Legal" na entry seed), F32 (Freemium CNPJ na entry seed), F34 (Store Readiness na entry seed), design system (`openspec/design-system/MASTER.md`), `zod` (^3.24.4, já no projeto), `lucide-react` (já no projeto).
</domain>

<decisions>
## Implementation Decisions

### D1 — Fonte de dados: Markdown com frontmatter em `content/changelog/`
`DECIDIDO`

Cada entry é um arquivo `.md` com frontmatter YAML, versionado no repositório. Seed com 3 entries de exemplo:

| Arquivo | category | importance | announcement |
|---------|----------|------------|--------------|
| `2026-07-30-fase-30-legal-foundation.md` | feature | major | none |
| `2026-07-31-fase-32-freemium-cnpj.md` | feature | major | card |
| `2026-08-01-fase-34-store-readiness.md` | improvement | minor | none |

Apenas a entry mais relevante para anúncio no seed (F32) tem `announcement: "card"`; F30 e F34 com `"none"`. F34 (data `2026-08-01`) é a entry mais recente da lista por data; F32 é apenas o anúncio ativo. Frontmatter: id (slug único), title, date (`YYYY-MM-DD` ISO sem hora, fuso brasileiro), milestone (opcional), category (`feature|improvement|fix`), importance (`major|minor`), announcement (`none|card|modal`). Body em português claro respondendo: o que mudou, por que importa, o que o lojista precisa fazer (D5).

### D2 — Página dedicada `/novidades` + item fixo na sidebar
`DECIDIDO`

Sidebar pós-F35: Dashboard, Campanhas, Loja, Conta, **Novidades ◉** (5º item). AccountMenu recebe link secundário "Novidades" entre Configurações e Sair. `/novidades` é server component: busca `getAllEntries()`, passa para `ChangelogList` (client-only para o indicador de badge), com `PageHeader`, breadcrumb "Dashboard > Novidades" e `EmptyState` quando não há entries.

**Fluxo de `latestEntryId` (server → client):** o layout server `src/app/(app)/layout.tsx` busca `getAllEntries()` (server-only) e deriva `latestEntryId = entries[0]?.frontmatter.id ?? null`, passando como `latestChangelogEntryId` para `<AppShell>`. O AppShell (client) e o `SidebarDrawer` (client) apenas repassam a prop — NUNCA importam `get-changelog`/`server-only`. O `Sidebar` (client) recebe `latestEntryId` e passa para `<SidebarBadge />`. O valor é opcional (`string | null`) e o shell renderiza sem quebrar quando null.

### D3 — Indicador de novidades via localStorage (dois controles separados)
`DECIDIDO`

Sem Supabase, sem requisição extra, sem estado global. Duas chaves no `localStorage`:

| Chave | Atualizado em | Efeito |
|-------|---------------|--------|
| `vendeo:last_seen_changelog_id` | Ao visitar `/novidades` | Controla o indicador da sidebar |
| `vendeo:dismissed_changelog_announcement_id` | Ao fechar card/modal na dashboard | Controla a exibição do anúncio |

- `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` é chamado ao abrir `/novidades` — atualiza SEEN_KEY e, se houver anúncio ativo, também DISMISSED_KEY
- `dismissAnnouncement(id)` é chamado ao fechar card/modal — atualiza APENAS DISMISSED_KEY, sem afetar o indicador da sidebar
- Indicador da sidebar: `hasUnseen(latestId)` compara `lastSeenId !== latestId`
- Card/modal só aparece se `isAnnouncementVisible(entryId)` → `dismissedId !== entryId`
- SSR-safe: hook só acessa `localStorage` no `useEffect` (component client)

### D4 — Anúncio contextual: card como padrão, modal como exceção
`DECIDIDO`

O frontmatter `announcement` controla o tipo de anúncio: `"none"` (nenhum anúncio, entry aparece apenas em `/novidades`), `"card"` (card descartável no topo da dashboard — padrão), `"modal"` (modal com ação fechar ou "Ver novidades" — mudança crítica). Regras: APENAS UM anúncio por vez (o mais recente com `announcement !== "none"`); aparece apenas se não foi dispensado; dispensar NÃO atualiza `lastSeenId`; "Ver novidades" navega para `/novidades`, que chama `markChangelogAsViewed(latestEntryId, entry.frontmatter.id)`; após visitar `/novidades`, o anúncio também some (ambas as chaves atualizadas).

### D5 — Tom editorial: comunicação de produto
`DECIDIDO`

Toda entry responde a três perguntas: **O que mudou** (português claro, sem jargão técnico), **Por que isso importa para o lojista**, **O que ele precisa fazer (se algo)**.

### D6 — Frequência de atualização
`DECIDIDO`

**Obrigatório:** ao final de cada fase com impacto visível ao usuário (UI nova, fluxo novo, mudança comportamental, correção perceptível). **Recomendado:** agrupar entries menores por milestone a critério editorial. **Não obrigatório:** fases exclusivamente de infraestrutura, refatoração interna, testes ou documentação sem impacto no usuário.

### D7 — Sem Supabase (por enquanto)
`DECIDIDO`

Changelog 100% estático: dados em `content/changelog/*.md`, estado de leitura em `localStorage`, parse no server component. Supabase será considerado se/quando houver targeting por plano, analytics de leitura, controle admin ou read receipts server-side.

### D8 — Parser próprio de frontmatter + renderer controlado
`DECIDIDO`

Parser próprio (~30 linhas) — zero dependências, bundle zero, fail fast. Conteúdo editorialmente controlado (headings `##`, parágrafos e listas `- ` cobrem 100% do uso previsto). `renderMarkdown(md)` suporta `## heading`, parágrafos, `- listas`, `**negrito**` e retorna HTML sanitizado (apenas `h2, p, ul, li, strong`). Todo texto bruto é HTML-escapado antes de aplicar as tags permitidas. Sintaxe não suportada lança erro no build (não em runtime). Contrato `ChangelogEntry.body` é string — trocar a implementação interna é trivial sem alterar entries.

**Fuso horário:** `date` é string ISO `YYYY-MM-DD` sem componente de hora, data de publicação no fuso brasileiro. Ordenação por comparação lexicográfica da string. Formatação para exibição (`dd/mm/aaaa`) NÃO usa `new Date("YYYY-MM-DD").toLocaleDateString("pt-BR")` sem mitigação (pode deslocar o dia em UTC-3). Formatar a partir dos campos da string ou com mitigação explícita.

**Fail fast no build (Zod):** `ChangelogFrontmatterSchema` valida id, title, date (regex `^\d{4}-\d{2}-\d{2}$`), milestone (opcional), category, importance, announcement.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Changelog Core
- `openspec/changes/fase-35-changelog-novidades/proposal.md` — What/Why, capabilities (changelog-content, changelog-state, changelog-ui, app-shell, dashboard-inteligente), impact, entrega verificável
- `openspec/changes/fase-35-changelog-novidades/design.md` — Full architecture decisions D1-D8
- `openspec/changes/fase-35-changelog-novidades/specs/changelog-content/spec.md` — Fonte de dados, parseFrontmatter, renderMarkdown, schema Zod, tipos, get-changelog, fuso horário, rotina documentada
- `openspec/changes/fase-35-changelog-novidades/specs/changelog-state/spec.md` — useChangelogState, markChangelogAsViewed, dismissAnnouncement, hasUnseen, isAnnouncementVisible
- `openspec/changes/fase-35-changelog-novidades/specs/changelog-ui/spec.md` — Página /novidades, ChangelogCard, ChangelogList, ChangelogAnnouncement, SidebarBadge
- `openspec/changes/fase-35-changelog-novidades/specs/app-shell/spec.md` — Sidebar 5º item, AccountMenu link, fluxo latestEntryId
- `openspec/changes/fase-35-changelog-novidades/specs/dashboard-inteligente/spec.md` — ChangelogAnnouncement no dashboard
- `openspec/changes/fase-35-changelog-novidades/tasks.md` — Complete task breakdown (11 sections, ~90 tasks)

### UI / Design System
- `openspec/design-system/MASTER.md` — Design tokens: `accent-green` #22C55E (feature), `accent-blue` #3B82F6 (improvement), `accent-amber` #F59E0B (fix); tipografia Poppins/Open Sans; dark mode

### Downstream Dependencies
- `.planning/phases/30-legal-foundation/30-CONTEXT.md` — F30 "Fundação Legal" no seed
- `.planning/phases/32-freemium-anti-abuso-cnpj/32-CONTEXT.md` — F32 "Freemium CNPJ" no seed
- `.planning/phases/34-store-readiness/34-CONTEXT.md` — F34 "Store Readiness" no seed
</canonical_refs>

<specifics>
## Specific Ideas

- **Novos arquivos:** `content/changelog/` (3 entries .md seed), `src/lib/changelog/` (`types.ts`, `parse-frontmatter.ts`, `render-markdown.ts`, `schema.ts`, `get-changelog.ts`, `__tests__/`), `src/hooks/use-changelog-state.ts`, `src/components/changelog/` (4 componentes: changelog-card, changelog-list, changelog-announcement, sidebar-badge), `src/app/(app)/novidades/page.tsx` + componente client (ex: `novidades-client.tsx`)
- **Arquivos modificados:** `src/app/(app)/layout.tsx` (busca `getAllEntries()` no server e injeta `latestChangelogEntryId`), `src/components/shell/app-shell.tsx` (repasse de prop), `src/components/shell/sidebar-drawer.tsx` (repasse de prop), `src/components/shell/sidebar.tsx` (NAV_ITEMS + badge + prop), `src/components/shell/account-menu.tsx` (link "Novidades"), `src/app/(app)/dashboard/page.tsx` (ChangelogAnnouncement após VerificationBanners e ReadinessCheckBanner, antes do conteúdo principal, nos estados `has_store_no_campaigns` e `has_store_with_campaigns`)
- **`docs/changelog-update.md`:** guia JÁ EXISTENTE e consistente (quando atualizar, passo a passo, template, categorias, importância, announcement, checklist do verify). Ajustar cirurgicamente se necessário — NÃO recriar, NÃO duplicar (ex: não criar `docs/changelog.md`)
- **Dependências:** zero novas — parser próprio; `zod` ^3.24.4 presente; `lucide-react` presente
- **Sem migration SQL** — dados estáticos + localStorage; sem mudança de schema de banco
- **Sem mudança de API pública** — sem novas rotas de API
- **Ícone sidebar:** Sparkles ou Newspaper (lucide-react) para "Novidades"
- **Badges categoria:** feature = `accent-green`, improvement = `accent-blue`, fix = `accent-amber`
- **Data pt-BR:** formatar `dd/mm/aaaa` a partir da string ISO, sem `new Date(ISO)` sem mitigação (fuso UTC-3)
</specifics>

<deferred>
## Deferred Ideas

- Supabase como fonte de dados ou read receipts server-side — até haver targeting por plano, analytics de leitura ou controle admin
- Changelog segmentado por plano de usuário — todas as entries são públicas
- Notificação push/email de novidades — changelog é consultivo
- Admin UI para publicar entries — editar markdown e commitar é mais rápido nesta frequência
- Feed RSS/JSON de changelog — apenas se solicitado
- Internacionalização (i18n) — produto brasileiro, changelog em PT-BR
- `gray-matter` ou `react-markdown` — conteúdo editorial controlado não justifica dependências
</deferred>

---

*Phase: 35-changelog-novidades*
*Context gathered: 2026-07-31 via OpenSpec artifacts*
