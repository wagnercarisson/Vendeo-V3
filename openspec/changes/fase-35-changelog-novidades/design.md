## Context

O Vendeo entrega valor ao lojista em 14 fases de frontend, mas nenhuma entrega é comunicada de forma estruturada dentro do produto. A F35 cria a voz do produto: um changelog editorial (não release notes técnico) com fonte de dados em `content/changelog/*.md`, página dedicada `/novidades`, item fixo na sidebar com indicador, card/modal de anúncio na dashboard e indicador de novidades via localStorage — sem Supabase, sem requisição extra, sem estado global.

**Dependências:** F30 (termo "Fundação Legal" na entry seed), F32 (Freemium CNPJ na entry seed), F34 (Store Readiness na entry seed), design system (`openspec/design-system/MASTER.md`), `zod` (^3.24.4, já no projeto).

**Divergência de numeração:** o artefato de alinhamento renumera a v1.5 — F35 = Changelog/Novidades, F36 = Stripe/Monetização Pública. `STATE.md`/`ROADMAP.md` ainda listam F35 = Stripe e serão atualizados após aprovação.

## Goals / Non-Goals

**Goals:**
- Fonte de dados `content/changelog/*.md` com frontmatter YAML, versionada no repositório
- Página `/novidades` com listagem cronológica (data DESC), badges de categoria e indicador de importância
- "Novidades" como 5º item da sidebar com indicador de conteúdo novo; link secundário no AccountMenu
- Card discreto (padrão) ou modal (exceção) na dashboard, controlado por `announcement: "none" | "card" | "modal"`
- Indicador via localStorage com dois controles independentes (visita × dispensa)
- Parser próprio de frontmatter + renderer controlado, zero dependências novas
- Validação Zod fail-fast no build (frontmatter inválido quebra o build/CI)
- Tom editorial: comunicação de produto em português claro (D5)
- Rotina documentada em `docs/changelog-update.md` (guia já existente, criado no alinhamento da F35)
- 3 entries de exemplo (F30, F32, F34) — apenas a mais relevante para anúncio no seed (F32) com `announcement: "card"`; F34 continua sendo a mais recente da lista por data
- 14+ testes (get-changelog, useChangelogState, ChangelogList, ChangelogAnnouncement)

**Non-Goals:**
- Supabase como fonte de dados ou read receipts server-side — adiado até haver targeting por plano, analytics de leitura ou controle admin
- Changelog segmentado por plano de usuário — todas as entries são públicas
- Notificação push/email de novidades — changelog é consultivo
- Admin UI para publicar entries — editar markdown e commitar é mais rápido nesta frequência
- Feed RSS/JSON de changelog — apenas se solicitado
- Internacionalização (i18n) — produto brasileiro, changelog em PT-BR
- `gray-matter` ou `react-markdown` — conteúdo editorial controlado não justifica dependências

## Decisions

### D1 — Fonte de dados: Markdown com frontmatter em `content/changelog/`

`DECIDIDO`

Cada entry é um arquivo `.md` com frontmatter YAML, versionado no repositório:

```
content/changelog/
  2026-07-30-fase-30-legal-foundation.md   ← feature (major, announcement: none) — histórica
  2026-07-31-fase-32-freemium-cnpj.md      ← feature (major, announcement: card) — card na dashboard
  2026-08-01-fase-34-store-readiness.md    ← improvement (minor, announcement: none) — apoio
```

```md
---
id: "fase-30-legal-foundation"
title: "Fundação Legal"
date: "2026-07-30"
milestone: "v1.5"
category: "feature"
importance: "major"
announcement: "none"
---

## O que mudou

- Agora o Vendeo tem páginas públicas de Termos, Privacidade e Cookies.
```

**Por que Markdown em `content/` e não JSON estático ou `/public`:** editável por qualquer dev sem quebrar array, diff amigável, frontmatter tipado via Zod, parse no server component/build, fácil migrar para DB no futuro. JSON sofre schema lock-in e `/public` expõe raw sem tipo.

### D2 — Página dedicada `/novidades` + item fixo na sidebar

`DECIDIDO`

Sidebar pós-F35: Dashboard, Campanhas, Loja, Conta, **Novidades ◉** (5º item). AccountMenu recebe link secundário "Novidades" entre Configurações e Sair.

`/novidades` é server component: busca `getAllEntries()`, passa para `ChangelogList` (client-only para o indicador de badge), com `PageHeader`, breadcrumb "Dashboard > Novidades" e `EmptyState` quando não há entries.

**Fluxo de `latestEntryId` (server → client):** o layout server `src/app/(app)/layout.tsx` busca `getAllEntries()` (server-only) e deriva `latestEntryId = entries[0]?.frontmatter.id ?? null`, passando como `latestChangelogEntryId` para `<AppShell>`. O AppShell (client) e o `SidebarDrawer` (client) apenas repassam a prop — NUNCA importam `get-changelog`/`server-only`. O `Sidebar` (client) recebe `latestEntryId` e passa para `<SidebarBadge />`. Isso evita que componentes client importem código server-only; o valor é opcional (`string | null`) e o shell renderiza sem quebrar quando null.

### D3 — Indicador de novidades via localStorage (dois controles separados)

`DECIDIDO`

Sem Supabase, sem requisição extra, sem estado global. Duas chaves no `localStorage`:

| Chave | Atualizado em | Efeito |
|-------|---------------|--------|
| `vendeo:last_seen_changelog_id` | Ao visitar `/novidades` | Controla o indicador da sidebar |
| `vendeo:dismissed_changelog_announcement_id` | Ao fechar card/modal na dashboard | Controla a exibição do anúncio |

**Regras:**
- `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` é chamado ao abrir `/novidades` — atualiza SEEN_KEY e, se houver anúncio ativo, também DISMISSED_KEY
- `dismissAnnouncement(id)` é chamado ao fechar card/modal — atualiza APENAS DISMISSED_KEY, sem afetar o indicador da sidebar
- Indicador da sidebar: `hasUnseen(latestId)` compara `lastSeenId !== latestId`
- Card/modal só aparece se `isAnnouncementVisible(entryId)` → `dismissedId !== entryId`
- SSR-safe: hook só acessa `localStorage` no `useEffect` (component client, indicador apenas é client-side; sidebar server é mantida)

**Por que localStorage é suficiente:** changelog é igual para todos os usuários, sem segmentação por plano, sem analytics de leitura, sem necessidade de registrar visualização no servidor. Zero infra, zero latência, zero estado global.

### D4 — Anúncio contextual: card como padrão, modal como exceção

`DECIDIDO`

O frontmatter `announcement` controla o tipo de anúncio:

| Valor | Comportamento | Quando usar |
|-------|---------------|-------------|
| `"none"` | Nenhum anúncio. Entry aparece apenas em `/novidades` | Atualizações menores, correções, históricas |
| `"card"` | Card descartável no topo da dashboard (padrão) | Novas funcionalidades, melhorias relevantes |
| `"modal"` | Modal com uma ação (fechar ou "Ver novidades") | Mudança crítica: fluxo, catálogo, política, cobrança, bloqueio |

**Regras gerais:**
- Apenas UM anúncio por vez — o mais recente com `announcement !== "none"`
- Anúncio aparece apenas se `announcement !== "none"` E não foi dispensado
- Dispensar chama `dismissAnnouncement` — NÃO atualiza `lastSeenId`
- "Ver novidades" navega para `/novidades`, que chama `markChangelogAsViewed(latestEntryId, entry.frontmatter.id)`
- Após visitar `/novidades`, o anúncio também some (ambas as chaves atualizadas)

### D5 — Tom editorial: comunicação de produto

`DECIDIDO`

Toda entry responde a três perguntas: **O que mudou** (português claro, sem jargão técnico), **Por que isso importa para o lojista**, **O que ele precisa fazer (se algo)**.

```
✅ "Agora sua loja precisa de uma direção visual antes de gerar campanhas.
   Configure as cores e o logo da sua loja em Loja > Direção Visual."

❌ "Adicionado guard de readiness no server component de /campanhas/nova
   e no endpoint /api/campaign/generate-image com retorno 412."
```

### D6 — Frequência de atualização

`DECIDIDO`

- **Obrigatório:** ao final de cada fase com impacto visível ao usuário (UI nova, fluxo novo, mudança comportamental, correção perceptível)
- **Recomendado:** agrupar entries menores por milestone a critério editorial
- **Não obrigatório:** fases exclusivamente de infraestrutura, refatoração interna, testes ou documentação sem impacto no usuário

### D7 — Sem Supabase (por enquanto)

`DECIDIDO`

Changelog 100% estático: dados em `content/changelog/*.md`, estado de leitura em `localStorage`, parse no server component. Supabase será considerado se/quando houver targeting por plano, analytics de leitura, controle admin ou read receipts server-side (gatilhos documentados no artefato).

### D8 — Parser próprio de frontmatter + renderer controlado

`DECIDIDO`

| Abordagem | Prós | Contras |
|-----------|------|---------|
| `gray-matter` + `react-markdown` | Robusto, suporta edge cases | +2 dependências, bundle maior, complexidade para conteúdo simples |
| **Parser próprio + renderer controlado** | **Zero dependências, bundle zero, fail fast** | Suporta subconjunto de markdown |

**Decisão:** parser próprio. O conteúdo é editorialmente controlado — headings (`##`), parágrafos e listas (`- `) cobrem 100% do uso previsto. Frontmatter é simples o suficiente para um parser de ~30 linhas (split em `---`, parse de chaves:valor, com **remoção de aspas simples/duplas opcionais de valores escalares** para o Zod receber valor limpo — `"none"` → `none`). Zod valida o frontmatter e quebra o build se inválido. Se o conteúdo exigir markdown rico no futuro, migrar para `gray-matter` + `react-markdown` troca apenas a implementação interna de `get-changelog.ts` — o contrato `ChangelogEntry` não muda.

**Renderizador controlado:** `renderMarkdown(md)` suporta `## heading`, parágrafos, `- listas`, `**negrito**` e retorna HTML sanitizado (apenas `h2, p, ul, li, strong`). **Todo texto bruto é HTML-escapado antes de aplicar as tags permitidas** — HTML cru (ex: `<script>`) nunca é emitido como HTML interpretável; é escapado ou lança erro no build. Sintaxe não suportada lança erro no build (não em runtime).

**Fuso horário:** `date` é string ISO `YYYY-MM-DD` sem componente de hora, representando a data de publicação no fuso brasileiro. Ordenação usa comparação lexicográfica da string (sem conversão de fuso); formatação para exibição (`dd/mm/aaaa`) NÃO usa `new Date("YYYY-MM-DD").toLocaleDateString("pt-BR")` sem mitigação — o parser ISO UTC pode deslocar a data para o dia anterior em UTC-3. Formatar a partir dos campos da string ou com mitigação explícita.

**Fail fast no build (Zod):** `ChangelogFrontmatterSchema` valida id, title, date (regex `^\d{4}-\d{2}-\d{2}$`), milestone (opcional), category, importance, announcement.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **localStorage limpo (troca de dispositivo) → usuário vê novidades antigas de novo** | Aceitável. Repeat de no máximo 1-3 cards. Se virar problema, migrar para Supabase |
| **Sidebar badge piscando se algo der errado** | Hook compara ID exato, não timestamp. Se localStorage corromper, `lastSeenId` fica null → badge aparece até visitar `/novidades` |
| **Equipe esquece de atualizar changelog no final das fases** | Rotina documentada em `docs/changelog-update.md`. Checklist de revisão da fase inclui "Changelog atualizado?" |
| **HTML cru em entry causa XSS no renderer** | Renderer HTML-escapa todo texto bruto antes de aplicar tags permitidas; HTML cru é escapado ou lança erro no build |
| **Fuso horário desloca a data exibida em um dia** | `date` tratada como string ISO sem timezone; ordenação lexicográfica; formatação sem `new Date(ISO)` sem mitigação |
| **Markdown permite formatação inconsistente entre entries** | Validação Zod + fail fast no build. Frontmatter mal formatado quebra o CI |
| **Changelog vira release notes técnico** | Critério editorial na D5. Code review para entries garante tom adequado |
| **Card de anúncio acumula se usuário não acessar por semanas** | Apenas UM card (o mais recente). Ao visitar `/novidades`, tudo é marcado como visto |
| **Fases frequentes geram muitas entries pequenas** | Agrupar por milestone. Página `/novidades` é scrollável |
| **Parser próprio muito limitado no futuro** | Contrato `ChangelogEntry.body` é string — trocar implementação interna de `renderMarkdown`/parser é trivial, sem alterar entries |

## Migration Plan

Sem migration SQL — dados estáticos + localStorage, sem mudança de schema de banco. Deploy é o deploy normal do Next.js na Vercel; as entries de changelog entram no build. **Rollback:** reverter o commit da F35; nenhum dado persistente é afetado (localStorage do usuário é idiossincrático e reconciliado naturalmente).

**Pós-aprovação:** atualizar `.planning/STATE.md` e `ROADMAP.md` com a renumeração F35 = Changelog/Novidades, F36 = Stripe/Monetização Pública.

## Open Questions

Nenhuma. Todas as decisões de arquitetura estão documentadas e alinhadas (D1-D8 no documento de alinhamento da F35). A dúvida aberta do artefato ("zod já existe no projeto?") foi resolvida: sim, `zod ^3.24.4` presente em `package.json`.
