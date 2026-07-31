## 1. Seed de Dados — content/changelog/

- [ ] 1.1 Criar `content/changelog/` com 3 entries de exemplo (apenas `.md`, sem parser no diretório de dados):
  - `2026-07-30-fase-30-legal-foundation.md` — feature, major, announcement: none (tom: "O Vendeo agora tem Termos de Uso, Política de Privacidade e Uso Aceitável...")
  - `2026-07-31-fase-32-freemium-cnpj.md` — feature, major, announcement: card (tom: "Agora você cria sua loja com CNPJ e ganha 10 créditos de boas-vindas...")
  - `2026-08-01-fase-34-store-readiness.md` — improvement, minor, announcement: none (tom: "Sua loja precisa de uma direção visual...")
- [ ] 1.2 Garantir que cada entry tem frontmatter completo (id, title, date, milestone, category, importance, announcement) e body em português claro respondendo: o que mudou, por que importa, o que o lojista precisa fazer
- [ ] 1.3 Garantir que apenas a entry mais relevante para anúncio no seed (F32) tem `announcement: "card"`; F30 e F34 com `"none"` — F34 continua sendo a mais recente da lista (data `2026-08-01`), F32 é apenas o anúncio ativo

## 2. Core Library — Tipos, Parser e Renderer

- [ ] 2.1 Criar `src/lib/changelog/types.ts` com `ChangelogCategory`, `ChangelogImportance`, `ChangelogFrontmatter`, `ChangelogEntry` (slug derivado do filename) conforme contrato da spec `changelog-content`
- [ ] 2.2 Criar `src/lib/changelog/parse-frontmatter.ts` com `parseFrontmatter(raw): ParseResult` — lança erro se `---` de abertura/fechamento ausente; split de chaves:valor preservando `:` no valor; **remover aspas simples/duplas opcionais de valores escalares** (ex: `"none"` → `none`) para o Zod receber valor limpo
- [ ] 2.3 Criar `src/lib/changelog/render-markdown.ts` com `renderMarkdown(md): string` — suporta `## heading`, parágrafos, `- listas`, `**negrito**`; retorna HTML sanitizado (h2, p, ul, li, strong); **escapa texto bruto antes de aplicar tags permitidas (HTML cru como `<script>` é escapado ou lança erro)**; lança erro em build se sintaxe não suportada
- [ ] 2.4 Criar `src/lib/changelog/schema.ts` com `ChangelogFrontmatterSchema` (Zod) — valida id/title (string min 1), date (regex `^\d{4}-\d{2}-\d{2}$`), milestone opcional, category/importance/announcement enums
- [ ] 2.5 Verificar `npm run typecheck` — zero erros após criação dos módulos

## 3. Core Library — get-changelog.ts

- [ ] 3.1 Criar `src/lib/changelog/get-changelog.ts` com `import "server-only"`:
  - `getAllEntries(): Promise<ChangelogEntry[]>` — lê `content/changelog/*.md`, parseia frontmatter, valida com Zod, deriva slug do filename, ordena por data DESC
  - `getLatestAnnouncement(): Promise<ChangelogEntry | null>` — entry mais recente com `announcement !== "none"` (ou null)
  - `getEntryById(id: string): Promise<ChangelogEntry | null>`
- [ ] 3.2 Comportamentos: diretório vazio → `[]` (não quebra); frontmatter inválido → throw (fail fast no build); data igual → ordem estável de leitura
- [ ] 3.3 Verificar `npm run typecheck` — zero erros

## 4. Hook use-changelog-state

- [ ] 4.1 Criar `src/hooks/use-changelog-state.ts` (client hook) com duas chaves: `vendeo:last_seen_changelog_id` e `vendeo:dismissed_changelog_announcement_id`
- [ ] 4.2 Implementar `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` — atualiza SEEN_KEY e, se announcementId presente, DISMISSED_KEY
- [ ] 4.3 Implementar `dismissAnnouncement(id)` — atualiza APENAS DISMISSED_KEY (não afeta lastSeenId)
- [ ] 4.4 Implementar `hasUnseen(latestId)` — `lastSeenId !== latestId` (retorna false se latestId vazio); `isAnnouncementVisible(entryId)` — `dismissedId !== entryId`
- [ ] 4.5 Garantir SSR-safe: acessar `localStorage` apenas em `useEffect`; estado inicial `null`

## 5. Página /novidades

- [ ] 5.1 Criar `src/app/(app)/novidades/page.tsx` (server component) — busca `getAllEntries()`, renderiza `PageHeader` "Novidades", breadcrumb "Dashboard > Novidades", passa entries para `ChangelogList`
- [ ] 5.2 Adicionar componente client (ex: `novidades-client.tsx`) que chama `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` ao montar — atualiza indicador da sidebar e dispensa anúncio ativo
- [ ] 5.3 Garantir `EmptyState` quando não há entries (não quebra)

## 6. Componentes Changelog

- [ ] 6.1 Criar `src/components/changelog/changelog-card.tsx` — badge de categoria (feature=green `accent-green`, improvement=blue `accent-blue`, fix=amber `accent-amber`), título, data pt-BR, indicador de importância, conteúdo via `renderMarkdown`
- [ ] 6.2 Criar `src/components/changelog/changelog-list.tsx` — renderiza `ChangelogCard` por entry com separação visual; estado vazio tratado
- [ ] 6.3 Criar `src/components/changelog/changelog-announcement.tsx` (client) — props `{ entry: ChangelogEntry | null }`; exibe card (padrão) ou modal (exceção) conforme `announcement`; "Ver novidades" → `/novidades`; fechar (×) → `dismissAnnouncement`; retorna null quando entry é null ou `announcement === "none"`
- [ ] 6.4 Criar `src/components/changelog/sidebar-badge.tsx` (client) — usa `useChangelogState`, recebe `latestEntryId`, exibe badge/ponto quando `hasUnseen`; nada quando não há novo
- [ ] 6.5 Verificar estilo conforme design system (dark mode, tokens `bg-*`, `text-*`, `accent-*`, tipografia Poppins/Open Sans)

## 7. Sidebar + AccountMenu — fluxo de latestEntryId

- [ ] 7.1 Modificar `src/app/(app)/layout.tsx` (server component) — buscar a entry mais recente via `getAllEntries()` e derivar `latestEntryId = entries[0]?.frontmatter.id ?? null`; passar como prop `latestChangelogEntryId` para `<AppShell>`
- [ ] 7.2 Modificar `src/components/shell/app-shell.tsx` (client) — aceitar prop `latestChangelogEntryId?: string | null` e repassar para `<Sidebar latestEntryId={...}>` e `<SidebarDrawer latestEntryId={...}>` (NUNCA importar `get-changelog`/`server-only` aqui — só repassa o valor)
- [ ] 7.3 Modificar `src/components/shell/sidebar-drawer.tsx` (client) — aceitar prop `latestEntryId?: string | null` e repassar para `<Sidebar isDrawer onNavigate latestEntryId={...}>`
- [ ] 7.4 Modificar `src/components/shell/sidebar.tsx` (client) — adicionar prop `latestEntryId?: string | null`; adicionar NAV_ITEMS `{ href: "/novidades", label: "Novidades", icon: Sparkles/Newspaper }` como 5º item
- [ ] 7.5 Verificar active state para `/novidades` (pathname === ou startsWith)
- [ ] 7.6 Integrar `SidebarBadge latestEntryId={latestEntryId}` no item "Novidades" (indicador client-side via `useChangelogState`; `latestEntryId` vem do server pelo layout)
- [ ] 7.7 Modificar `src/components/shell/account-menu.tsx` — adicionar link "Novidades" (`/novidades`) entre Configurações e Sair com ícone Lucide (link puro, sem badge, para não duplicar lógica client no menu)

## 8. Dashboard — Anúncio Contextual

- [ ] 8.1 Modificar `src/app/(app)/dashboard/page.tsx` — importar `getLatestAnnouncement()` e `<ChangelogAnnouncement>`
- [ ] 8.2 Renderizar `<ChangelogAnnouncement entry={latestAnnouncement} />` após `<VerificationBanners>` e `<ReadinessCheckBanner>`, antes do conteúdo principal, nos estados `has_store_no_campaigns` e `has_store_with_campaigns`
- [ ] 8.3 Garantir que dashboard não quebra quando `latestAnnouncement === null`

## 9. Rotina de Atualização — docs/changelog-update.md

- [ ] 9.1 Verificar `docs/changelog-update.md` (guia já existente): quando atualizar, passo a passo, template de frontmatter, exemplo, critérios editoriais (D5) e checklist do verify
- [ ] 9.2 Ajustar `docs/changelog-update.md` se necessário durante a implementação (ex: alinhar nome do arquivo de entry, fuso horário da data, exemplo com `announcement: "card"` no seed) — não recriar o arquivo; editar cirurgicamente o guia existente

## 10. Testes

### 10.1 get-changelog (4+ testes)

- [ ] 10.1.1 `getAllEntries()` com 3 arquivos → retorna 3 entries ordenadas por data DESC
- [ ] 10.1.2 `getLatestAnnouncement()` com entry `announcement: "card"` → retorna a entry
- [ ] 10.1.3 `getLatestAnnouncement()` sem entries com anúncio → null
- [ ] 10.1.4 `getEntryById("fase-30-legal-foundation")` → frontmatter + body parseados
- [ ] 10.1.5 Diretório vazio → `[]` (não quebra); frontmatter inválido → throw
- [ ] 10.1.6 `parseFrontmatter` → validação de `---` de abertura/fechamento (erros); remoção de aspas simples/duplas em valores escalares (`"none"` → `none`, `'feature'` → `feature`); valores com `:` preservados
- [ ] 10.1.7 `renderMarkdown` → h2/p/ul/li/strong renderizados; HTML cru escapado (ex: `<script>` vira `&lt;script&gt;`); sintaxe não suportada lança erro
- [ ] 10.1.8 `ChangelogFrontmatterSchema` → válido passa; category/date inválidos quebram
- [ ] 10.1.9 Data `2026-07-31` formatada em pt-BR → `31/07/2026` (sem shift de dia em fuso UTC-3); ordenação por string ISO independe de fuso

### 10.2 use-changelog-state (4+ testes, mock de localStorage)

- [ ] 10.2.1 `hasUnseen()` sem nada em localStorage → `true` (primeiro acesso)
- [ ] 10.2.2 `markChangelogAsViewed(id)` + `hasUnseen(mesmoId)` → `false`
- [ ] 10.2.3 `markChangelogAsViewed(id, announcementId)` → `lastSeenId` e `dismissedId` atualizados
- [ ] 10.2.4 `dismissAnnouncement(id)` → `isAnnouncementVisible(mesmoId)` false, mas `hasUnseen(outroId)` true (dispensa não afeta indicador)

### 10.3 ChangelogList (2 testes)

- [ ] 10.3.1 Renderiza entries com badges de categoria → categoria com cor correta
- [ ] 10.3.2 Lista sem conteúdo → estado vazio tratado

### 10.4 ChangelogAnnouncement (4+ testes)

- [ ] 10.4.1 Entry `announcement: "card"` não dispensada → card aparece
- [ ] 10.4.2 Entry `announcement: "none"` → card não aparece
- [ ] 10.4.3 Card descartado → desaparece e `dismissAnnouncement` é chamado
- [ ] 10.4.4 Card dispensado NÃO altera `lastSeenId` → sidebar badge continua ativo
- [ ] 10.4.5 Entry null → componente retorna null (não quebra)

## 11. Verificação Final

- [ ] 11.1 Executar `npx vitest run src/lib/changelog/__tests__/` — testes de lib passando
- [ ] 11.2 Executar `npx vitest run` — todos os testes (novos + existentes) passando
- [ ] 11.3 Executar `npm run typecheck` — zero erros
- [ ] 11.4 Executar `npm run lint` — zero erros
- [ ] 11.5 Executar `npm run build` — build bem-sucedido (valida fail-fast do parser/renderer em build)
- [ ] 11.6 Verificar `/novidades` renderiza entries ordenadas com badges corretas e datas em pt-BR sem shift de dia
- [ ] 11.7 Verificar sidebar mostra "Novidades" com indicador quando há conteúdo novo; some após visitar `/novidades`
- [ ] 11.8 Verificar dashboard mostra card para entry com `announcement: "card"` não dispensada; fechar card dispensa sem afetar badge da sidebar
- [ ] 11.9 Verificar "Ver novidades" navega para `/novidades` (que chama `markChangelogAsViewed` com id do anúncio)
- [ ] 11.10 Verificar AccountMenu tem link "Novidades"; regressão de sidebar, dashboard e account menu funcionais
- [ ] 11.11 Confirmar `docs/changelog-update.md` consistente com a implementação (template, fuso da data, exemplo de announcement)
- [ ] 11.12 Atualizar `.planning/STATE.md` e `ROADMAP.md` com renumeração: F35 = Changelog/Novidades ✅, F36 = Stripe/Monetização Pública (futura)
