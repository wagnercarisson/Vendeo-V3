## ADDED Requirements

### Requirement: Página /novidades — listagem cronológica

O sistema SHALL prover a página `src/app/(app)/novidades/page.tsx` (server component) que:

- Busca todas as entries via `getAllEntries()`
- Renderiza `PageHeader` com título "Novidades" e breadcrumb "Dashboard > Novidades"
- Passa as entries para `ChangelogList`
- Quando não há entries, renderiza `EmptyState` (não quebra)
- A página chama `markChangelogAsViewed` no client (via componente client) ao ser acessada — atualiza `last_seen_changelog_id` e, se houver anúncio ativo, também `dismissed_changelog_announcement_id`

#### Scenario: Página renderiza entries ordenadas

- **WHEN** `/novidades` é acessada com entries no diretório (ex: 3 seeds + F35)
- **THEN** renderiza `PageHeader` "Novidades"
- **AND** renderiza a lista com as entries na ordem cronológica DESC

#### Scenario: Página sem entries renderiza EmptyState

- **WHEN** `/novidades` é acessada sem entries
- **THEN** renderiza `EmptyState` sem quebrar

#### Scenario: Visita marca novidades como visualizadas

- **WHEN** o usuário acessa `/novidades`
- **THEN** `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` é chamado no client
- **AND** o indicador da sidebar some e o anúncio ativo é dispensado

### Requirement: ChangelogCard — card de entry individual

O sistema SHALL prover o componente `ChangelogCard` (`src/components/changelog/changelog-card.tsx`) que renderiza uma entry com:

- Badge de categoria com cor do design system: `feature` = verde, `improvement` = azul, `fix` = amber
- Título e data formatada (pt-BR)
- Indicador de importância visual discreto (major = destaque, minor = sutil)
- Conteúdo markdown renderizado via `renderMarkdown`

A formatação da data SHALL respeitar o fuso brasileiro sem distorção: SHALL formatar `dd/mm/aaaa` a partir da string ISO `YYYY-MM-DD` sem conversão de timezone (NÃO usar `new Date("YYYY-MM-DD").toLocaleDateString("pt-BR")` sem mitigação, pois pode deslocar para o dia anterior no fuso UTC-3).

#### Scenario: Card renderiza badge, título, data e conteúdo

- **WHEN** `ChangelogCard` recebe uma entry válida
- **THEN** exibe badge de categoria com a cor correspondente, título, data e conteúdo renderizado

#### Scenario: Data é formatada em pt-BR sem shift de dia

- **WHEN** entry tem `date: "2026-07-31"` e o ambiente roda em fuso brasileiro
- **THEN** a data exibida é `31/07/2026` (não `30/07/2026`)

#### Scenario: Badge de categoria usa a cor correta

- **WHEN** entry tem `category: "feature"`
- **THEN** badge usa a variante verde (`accent-green`)
- **WHEN** entry tem `category: "improvement"`
- **THEN** badge usa a variante azul (`accent-blue`)
- **WHEN** entry tem `category: "fix"`
- **THEN** badge usa a variante amber (`accent-amber`)

### Requirement: ChangelogList — lista de entries

O sistema SHALL prover o componente `ChangelogList` (`src/components/changelog/changelog-list.tsx`) que:

- Renderiza múltiplos `ChangelogCard` na ordem recebida (já ordenada por data DESC)
- Separa visualmente as entries
- Sem conteúdo → renderiza estado vazio tratado (não quebra)

#### Scenario: Lista renderiza múltiplos cards ordenados

- **WHEN** `ChangelogList` recebe uma array de entries
- **THEN** renderiza um `ChangelogCard` por entry, com separação visual

#### Scenario: Lista vazia renderiza estado tratado

- **WHEN** `ChangelogList` recebe array vazio
- **THEN** renderiza estado vazio sem quebrar

### Requirement: ChangelogAnnouncement — card ou modal na dashboard

O sistema SHALL prover o componente client `ChangelogAnnouncement` (`src/components/changelog/changelog-announcement.tsx`) com props `{ entry: ChangelogEntry | null }` que:

- Recebe a latestEntry como prop (server-side)
- Exibe anúncio APENAS se `entry` existir, `entry.frontmatter.announcement !== "none"` E `isAnnouncementVisible(entry.frontmatter.id)` retornar `true`
- Se `announcement: "card"` → card discreto no topo da dashboard
- Se `announcement: "modal"` → modal com ação (exibido uma vez após login, se não dispensado)
- Botão "Ver novidades" → navega para `/novidades` (que chama `markChangelogAsViewed` com o id do anúncio ativo)
- Botão fechar (×) → chama `dismissAnnouncement(entry.frontmatter.id)` — apenas dispensa, não marca como visto
- Retorna `null` quando `entry` é `null` (não quebra)

#### Scenario: Card aparece para entry com announcement card não dispensada

- **WHEN** `entry.frontmatter.announcement === "card"` e `isAnnouncementVisible(entry.frontmatter.id)` retorna `true`
- **THEN** card discreto é exibido

#### Scenario: Anúncio não aparece para announcement none

- **WHEN** `entry.frontmatter.announcement === "none"`
- **THEN** nenhum anúncio é exibido

#### Scenario: Card descartado desaparece

- **WHEN** o usuário fecha o card
- **THEN** `dismissAnnouncement(entry.frontmatter.id)` é chamado
- **AND** o card desaparece

#### Scenario: Dispensar não altera lastSeenId

- **WHEN** o usuário fecha o card
- **THEN** `lastSeenId` NÃO é alterado
- **AND** o badge da sidebar continua ativo

#### Scenario: "Ver novidades" navega para /novidades

- **WHEN** o usuário clica "Ver novidades"
- **THEN** navega para `/novidades`
- **AND** `/novidades` chama `markChangelogAsViewed` com o id do anúncio ativo

#### Scenario: Componente não quebra sem entry

- **WHEN** `entry` é `null`
- **THEN** o componente retorna `null` sem erro

### Requirement: SidebarBadge — indicador de novidades

O sistema SHALL prover o componente client `SidebarBadge` (`src/components/changelog/sidebar-badge.tsx`) que:

- Usa `useChangelogState`
- Recebe `latestEntryId?: string | null` **por prop** (vindo do server via layout → AppShell → Sidebar — o componente SHALL NÃO importar módulos `server-only`)
- Exibe badge/ponto visual quando `hasUnseen(latestEntryId)` retorna `true`
- Não renderiza nada quando não há conteúdo novo ou quando `latestEntryId` é `null`/vazio (não quebra)

#### Scenario: Badge aparece com conteúdo novo

- **WHEN** `hasUnseen(latestEntryId)` retorna `true`
- **THEN** badge/ponto é exibido ao lado do item "Novidades" na sidebar

#### Scenario: Badge some após visitar /novidades

- **WHEN** `lastSeenId` iguala `latestEntryId` após visita a `/novidades`
- **THEN** badge/ponto deixa de ser exibido

#### Scenario: Badge não renderiza sem latestEntryId

- **WHEN** `latestEntryId` é `null` ou vazio
- **THEN** o componente não renderiza indicador e não lança erro
