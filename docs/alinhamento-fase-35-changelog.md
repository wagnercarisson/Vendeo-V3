# Alinhamento Fase 35 — Changelog / Novidades do Produto (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                        ✓
  ├── F31.1 — Modelo Comercial — Formulário                       ✓
  ├── F31.2 — Diretores por Intenção                              ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                 ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                              ✓
  ├── F33 — Verificação de CNPJ para Liberação do Freemium        ✓
  ├── F34 — Prontidão de Loja para Geração (Store Readiness)      ✓
  └── F35 — Changelog / Novidades do Produto (comunicação)        ← esta fase

F36 (Stripe / Monetização Pública) virá em seguida dentro da v1.5.
```

O Vendeo já tem 14 fases de frontend implementadas — app shell, dashboard, busca, criação de campanha, fluxo de conta, admin operacional, créditos, legal, readiness. Cada fase entrega valor real ao lojista: a IA de copy melhorou, o dashboard mostra métricas, créditos são gerenciados, a conta tem extrato, a loja tem direção visual, a base legal está documentada.

**Problema:** Nenhuma dessas entregas é comunicada ao lojista de forma estruturada. O usuário que volta ao Vendeo depois de alguns dias não sabe o que mudou — descobre novas funcionalidades por acaso ou simplesmente não descobre. Isso gera:

- Subutilização de funcionalidades entregues (ex: lojista não sabe que pode ver extrato em `/conta`)
- Frustração quando uma mudança comportamental pega o usuário desprevenido (ex: CNPJ obrigatório na F32)
- Sensação de produto "parado" mesmo com entregas frequentes
- Dependência de comunicação externa (email, WhatsApp) para informar o que podia ser comunicado dentro do produto

**Oportunidade:** O changelog no Vendeo não é release notes técnico — é a voz do produto falando com o lojista. Cada fase vira uma história contada no momento e no tom certos.

---

## Propósito

1. **Criar a fonte de dados de changelog** — arquivos Markdown com frontmatter em `content/changelog/`, versionados no repositório, editáveis por qualquer pessoa do time
2. **Página dedicada `/novidades`** — listagem cronológica completa de todas as mudanças, organizada por fase/milestone, com badges de categoria e indicador de conteúdo novo
3. **Item fixo na sidebar** — "Novidades" como quinto item de navegação, com indicador visual de novidades
4. **Card ou modal de anúncio na dashboard** — para entradas relevantes, anúncio contextual no topo da dashboard (card como padrão, modal para mudanças críticas)
5. **Indicador de novidades via localStorage** — sem requisição extra, sem back-end, sem Supabase. Apenas comparar `last_seen_id` com o ID da entrada mais recente
6. **Rotina documentada de atualização** — procedimento em `docs/changelog.md` para adicionar entries ao final de cada fase

**Entrega verificável:**
- `content/changelog/` com ao menos 3 entries de exemplo (F30, F32, F34)
- Página `/novidades` funcionando com entries ordenadas por data
- Sidebar com item "Novidades" + indicador de conteúdo novo
- Badges de categoria (feature, improvement, fix) com as cores do design system
- Card de anúncio na dashboard apenas para entries com `announcement: "card"` (ou modal para `"modal"`)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F34)

```
                                    ANTES (F34)                      DEPOIS (F35)
═══════════════════════════════════════════════════════════════════════════════════════════════

Fonte de dados:
  Changelog                         inexistente                      content/changelog/*.md
  Formato                           —                                 Markdown + frontmatter YAML
  Versionamento                     —                                 Git (arquivos no repositório)

Página de novidades:
  /novidades                        inexistente                      listagem cronológica completa
  Entries por fase                  —                                 agrupadas por versão/data
  Badges de categoria               —                                 feature / improvement / fix

Sidebar:
  Itens                             4 (Dashboard, Campanhas,         5 (+ Novidades)
                                      Loja, Conta)
  Indicador de novidades            inexistente                      badge/ponto quando há conteúdo novo

Dashboard:
  Card de anúncio                   inexistente                      card discreto para entries
                                                                      com announcement: "card"
  Controle de exibição              —                                 descartável (uma vez)

localStorage:
  Última entrada vista              inexistente                      vendeo:last_seen_changelog_id
  Comparação                        —                                 usado no indicador da sidebar

Rotina de atualização:
  Documentação                      inexistente                      docs/changelog.md
  Passos                            —                                 documentados + exemplo

Tom editorial:
  Conteúdo atual                    silêncio                         comunicação de produto
                                                                     em português claro
```

---

## Realinhamento de Escopo (vs. discussão inicial)

### O que muda

| Item | Discussão inicial | Realinhado (F35) |
|------|-------------------|------------------|
| **Fonte de dados** | `data/changelog.json` (JSON estático) | `content/changelog/*.md` com frontmatter — markdown é mais editável e permite tom editorial melhor |
| **Formato de conteúdo** | Release notes técnicas | Comunicação de produto. "Melhoramos a legibilidade das peças" em vez de "Refatorado `CampaignRenderer`" |
| **Entrada na sidebar** | Sugerido AccountMenu como alternativa | Sidebar fixa. AccountMenu pode receber link secundário, mas o entry point principal é a sidebar |
| **Modal vs Card** | Sugerido modal para entradas importantes | **Card como padrão**; modal como exceção para mudança crítica (fluxo, catálogo, política, cobrança, bloqueio). Controlado por `announcement: "card" | "modal" | "none"` no frontmatter |
| **Supabase** | Considerado para targeting e analytics | Adiado. localStorage resolve o caso de uso atual sem dependência de banco |
| **Público vs. privado** | Questionado se entries podem ser por plano de usuário | Todas as entries são públicas para todos os lojistas por enquanto. Segmentação por plano é futura |

---

## Decisões de Alinhamento

### D1 — Fonte de dados: Markdown com frontmatter em `content/changelog/`

`DECIDIDO`

```
content/changelog/
  2026-07-30-fase-30-legal-foundation.md   ← apenas .md — parser fica em src/lib/
  2026-07-31-fase-32-freemium-cnpj.md
  2026-08-01-fase-34-store-readiness.md
```

Cada arquivo:

```md
---
id: "fase-30-legal-foundation"
title: "Fundação Legal"
date: "2026-07-30"
milestone: "v1.5"
category: "feature"
importance: "major"
announcement: "card"
---

## O que mudou

- Agora o Vendeo tem páginas públicas de Termos, Privacidade e Cookies.
- O aceite legal passou a ser registrado no onboarding.
- Usuários que precisam reaceitar documentos verão um aviso dentro da conta.
```

**Campos de frontmatter:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | Sim | Identificador único (slug) |
| `title` | string | Sim | Título da entry (ex: "Fundação Legal") |
| `date` | string (ISO) | Sim | Data de publicação |
| `milestone` | string | Não | Milestone associada (ex: "v1.5") |
| `category` | `"feature" | "improvement" | "fix"` | Sim | Categoria visual da entry |
| `importance` | `"major" | "minor"` | Sim | Se `major`, destaque visual na listagem |
| `announcement` | `"none" | "card" | "modal"` | Sim | `"none"`: sem anúncio. `"card"`: card discreto na dashboard. `"modal"`: modal para mudança crítica |

**Por que Markdown em `content/` e não JSON ou `/public`:**

```
           Markdown + content/        JSON estático           /public/ cru
           ───────────────────        ─────────────           ────────────
Editável   ✓ qualquer dev edita       ✗ chato de editar      ✓ qualquer dev edita
             sem quebrar array          (vírgula, aspas)       sem ferramenta extra
           ✓ diff amigável            ✓ diff ok               ✓ diff amigável
           ✓ frontmatter tipado       ✓ tipado nativamente    ✗ sem tipo

Parser     ✓ server component         ✓ import direto         ✗ fetch runtime
           ✓ parseia no build         ✓ tree-shakeable        ✗ parsing extra
           ✓ ordena no server                                  ✗ expõe raw

Evolução   ✓ fácil adicionar campo    ✗ schema lock-in        ✗ mesma limitação
           ✓ fácil migrar p/ DB       ✓ fácil migrar p/ DB    ✗ mais trabalho
```

---

### D2 — Página dedicada `/novidades` na sidebar

`DECIDIDO`

```
Sidebar (pós-F35):
┌──────────────────────┐
│  Dashboard           │
│  Campanhas           │
│  Loja                │
│  Conta               │
│  Novidades        ◉  │  ← novo item + indicador
└──────────────────────┘

AccountMenu:
┌──────────────────────┐
│  email@loja.com.br   │
│  ─────────────────── │
│  Configurações       │
│  Novidades        ◉  │  ← link secundário (mesma página)
│  Sair                │
└──────────────────────┘
```

A página `/novidades`:

```
┌────────────────────────────────────────────────────────────┐
│  Novidades                                                  │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Feature]  Fundação Legal             30 Jul 2026  │   │  ← badge categoria
│  │  ● ● ●                                                │   │  ← importância (3 dots)
│  │  Agora o Vendeo tem páginas públicas de Termos,       │   │
│  │  Privacidade e Cookies...                              │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐    │   │
│  │  │  O que mudou                                  │    │   │  ← conteúdo MD renderizado
│  │  │  • Páginas públicas de Termos, Privacidade    │    │   │
│  │  │  • Aceite legal no onboarding                 │    │   │
│  │  └───────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Improvement]  Store Readiness        01 Aug 2026  │   │
│  │  ● ● ○                                                │   │
│  │  Agora sua loja precisa estar com...                  │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

### D3 — Indicador de novidades via localStorage

`DECIDIDO`

Sem Supabase, sem requisição extra, sem estado global.

Dois controles separados no `localStorage`:

| Chave | Atualizado em | Efeito |
|-------|---------------|--------|
| `vendeo:last_seen_changelog_id` | Ao visitar `/novidades` | Controla o indicador da sidebar |
| `vendeo:dismissed_changelog_announcement_id` | Ao fechar o card na dashboard | Controla a exibição do card |

```typescript
// hooks/use-changelog-state.ts

const SEEN_KEY = "vendeo:last_seen_changelog_id";
const DISMISSED_KEY = "vendeo:dismissed_changelog_announcement_id";

export function useChangelogState() {
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    setLastSeenId(localStorage.getItem(SEEN_KEY));
    setDismissedId(localStorage.getItem(DISMISSED_KEY));
  }, []);

  // Chamado ao abrir /novidades. Se houver anúncio ativo, também o dispensa.
  const markChangelogAsViewed = (latestEntryId: string, latestAnnouncementId?: string) => {
    localStorage.setItem(SEEN_KEY, latestEntryId);
    setLastSeenId(latestEntryId);
    if (latestAnnouncementId) {
      localStorage.setItem(DISMISSED_KEY, latestAnnouncementId);
      setDismissedId(latestAnnouncementId);
    }
  };

  const dismissAnnouncement = (id: string) => {
    localStorage.setItem(DISMISSED_KEY, id);
    setDismissedId(id);
  };

  const hasUnseen = (latestId: string): boolean => {
    if (!latestId) return false;
    return lastSeenId !== latestId;
  };

  const isAnnouncementVisible = (entryId: string): boolean => {
    if (!entryId) return false;
    return dismissedId !== entryId;
  };

  return { lastSeenId, dismissedId, markChangelogAsViewed, dismissAnnouncement, hasUnseen, isAnnouncementVisible };
}
```

**Regras:**
- `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` é chamado ao abrir `/novidades`
  - Atualiza `last_seen_changelog_id` (faz o indicador da sidebar sumir)
  - Se um `latestAnnouncementId` for passado (entry com anúncio ativo), também atualiza `dismissed_changelog_announcement_id` (faz o card/modal sumir)
- `dismissAnnouncement` é chamado ao fechar o card ou modal — atualiza APENAS `dismissed_changelog_announcement_id`, sem afetar o indicador da sidebar
- O indicador na sidebar compara `lastSeenId` com o `id` da entry mais recente
- O card/modal na dashboard só aparece se `dismissedId !== entryId`
- Se o usuário nunca viu novidades, o indicador aparece
- Se uma nova entry for adicionada, o indicador reaparece (e o anúncio também, se `announcement !== "none"`)
- A sidebar usa o hook em um componente client (apenas o indicador é client-side, a sidebar server é mantida)

**Por que localStorage é suficiente:**
- O changelog é igual para todos os usuários (não há segmentação por plano)
- Não precisamos de analytics de leitura (por enquanto)
- Não há necessidade de registrar visualização no servidor
- Zero infra, zero latência, zero estado global

---

### D4 — Anúncio contextual: card como padrão, modal como exceção

`DECIDIDO`

O frontmatter `announcement` controla o tipo de anúncio:

| Valor | Comportamento | Quando usar |
|-------|---------------|-------------|
| `"none"` | Nenhum anúncio. Entry aparece apenas em `/novidades` | Atualizações menores, correções, entries históricas |
| `"card"` | Card descartável no topo da dashboard (padrão) | Novas funcionalidades, melhorias relevantes, mudanças não críticas |
| `"modal"` | Modal com uma ação (fechar ou "Ver novidades") | Mudança crítica de fluxo, catálogo, política, cobrança, bloqueio ou ação obrigatória |

**Card (padrão):**

```
┌────────────────────────────────────────────────────────────┐
│  🎉 Novidade                                               │
│                                                             │
│  Fundação Legal                                             │
│  Agora o Vendeo tem páginas públicas de Termos,            │
│  Privacidade e Cookies. Confira as novidades.              │
│                                                             │
│  [Ver novidades]  [×]                                      │
└────────────────────────────────────────────────────────────┘
```

**Modal (exceção):**
- Exibido uma vez ao acessar o app (após login), se ainda não dispensado
- Título + descrição + CTA "Ver novidades" + botão fechar
- Fechar o modal chama `dismissAnnouncement` (não `markChangelogAsViewed`)
- **Usar com moderação** — apenas para mudanças que o usuário PRECISA saber antes de continuar

**Regras gerais (ambos os tipos):**
- Anúncio aparece apenas se `announcement !== "none"` E o entry não foi dispensado
- Dispensar (fechar card ou modal) chama `dismissAnnouncement` para aquela entry
- `dismissAnnouncement` NÃO atualiza `lastSeenId` — dispensar não marca novidades como visualizadas
- Apenas UM anúncio por vez — o mais recente com `announcement !== "none"`
- Se o usuário clicar "Ver novidades", é redirecionado para `/novidades` (que chama `markChangelogAsViewed` passando o `id` do anúncio ativo, se houver)
- Após visitar `/novidades`, o anúncio também desaparece porque `markChangelogAsViewed` atualiza ambas as chaves

---

### D5 — Tom editorial: comunicação de produto, não release notes técnicas

`DECIDIDO`

Toda entry de changelog deve responder a três perguntas:

1. **O que mudou** (em português claro, sem jargão técnico)
2. **Por que isso importa para o lojista** (qual problema resolve)
3. **O que ele precisa fazer (se algo)** (ação necessária ou nula)

```
✅ "Agora sua loja precisa de uma direção visual antes de gerar campanhas.
   Configure as cores e o logo da sua loja em Loja > Direção Visual."

❌ "Adicionado guard de readiness no server component de /campanhas/nova
   e no endpoint /api/campaign/generate-image com retorno 412."
```

**Exemplos de entries (a serem criadas no seed de exemplo):**

| Fase | Título | Categoria | announcement | Tom |
|------|--------|-----------|--------------|-----|
| F30 | Fundação Legal | feature | `"none"` | "O Vendeo agora tem Termos de Uso, Política de Privacidade e Uso Aceitável. Durante o cadastro, você declara ciência da privacidade e aceita os termos." |
| F32 | Freemium com CNPJ | feature | `"card"` | "Agora você cria sua loja com CNPJ e ganha 10 créditos de boas-vindas. Lojas criadas antes dessa fase precisam atualizar o cadastro." |
| F34 | Loja mais completa | improvement | `"none"` | "Sua loja precisa de uma direção visual (cores e logo) e dados fiscais para gerar campanhas. A gente guia você em cada passo." |

---

### D6 — Frequência de atualização

`DECIDIDO`

Atualizar o changelog:
- **Obrigatório:** ao final de cada fase que tenha impacto visível ao usuário (UI nova, fluxo novo, mudança comportamental, correção perceptível)
- **Recomendado:** agrupar entries por milestone (ex: entries de F30, F31.1, F31.2, F31.3 viram uma única entrada "Pacote v1.5 — Intenções Comerciais" ou entradas separadas, a critério editorial)
- **Não obrigatório:** fases exclusivamente de infraestrutura, refatoração interna, testes, ou documentação sem impacto no usuário

**Exemplo de entries para o seed:**

```
content/changelog/
  2026-07-30-fase-30-legal-foundation.md    ← feature (major, announcement: none)  — histórica, sem anúncio
  2026-07-31-fase-32-freemium-cnpj.md       ← feature (major, announcement: card)  — card na dashboard
  2026-08-01-fase-34-store-readiness.md     ← improvement (minor, announcement: none) — entrada de apoio
```

Apenas a entry mais impactante deve gerar anúncio no seed. Entradas históricas ou de apoio o usuário descobre ao visitar `/novidades`.

---

### D7 — Sem Supabase (por enquanto)

`DECIDIDO`

O changelog da F35 é 100% estático:
- Dados em `content/changelog/*.md`
- Estado de leitura em `localStorage`
- Parse feito no server component (build time ou request time)

**Supabase será considerado se/quando:**

| Necessidade | Gatilho |
|-------------|---------|
| Targeting por plano (ex: feature só para premium) | Plano pago com features exclusivas |
| Analytics de leitura (quantos leram, quais entries) | Time de produto precisar de dados |
| Controle via admin (publicar/edit entry sem deploy) | Volume de entries passar de 1-2 por semana |
| Read receipts server-side (saber se user X leu entry Y) | Base de usuários > 100+ |

---

### D8 — Parser de frontmatter: simples + controlado, sem dependências externas

`DECIDIDO`

O changelog precisa parsear frontmatter YAML e renderizar markdown. Duas opções:

| Abordagem | Prós | Contras |
|-----------|------|---------|
| `gray-matter` + `react-markdown` | Robusto, suporta edge cases, ecosistema maduro | +2 dependências, bundle maior, complexidade para conteúdo simples (só headings, parágrafos, listas) |
| Parser próprio + renderer controlado | Zero dependências, bundle zero, fail fast se formato inesperado | Precisa ser implementado, suporta apenas subconjunto de markdown |

**Decisão:** Parser próprio de frontmatter + renderer controlado.

**Motivos:**
- O conteúdo do changelog é editorialmente controlado — headings (`##`), parágrafos e listas (`- `) cobrem 100% do uso previsto
- Frontmatter é simples o suficiente para um parser de ~30 linhas (split em `---`, parse de chaves:valor)
- Zod valida o frontmatter parseado e quebra o build se inválido
- Zero dependências novas = zero superfície de vulnerabilidade, zero breaking changes de lib
- Se no futuro o conteúdo exigir tabelas, links complexos ou imagens, migrar para `gray-matter` + `react-markdown` é trivial (troca a implementação interna de `get-changelog.ts`, o contrato externo não muda)

```typescript
// src/lib/changelog/parse-frontmatter.ts — ~30 linhas, sem dependências

// Provedor de conteúdo: no servidor, lê do filesystem.
// Em teste, recebe string mockada.
export interface ParseResult {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(raw: string): ParseResult {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new Error("Frontmatter inválido: deve começar com ---");
  }
  const endIndex = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (endIndex === -1) {
    throw new Error("Frontmatter inválido: --- de fechamento não encontrado");
  }
  const frontmatter: Record<string, unknown> = {};
  for (let i = 1; i < endIndex; i++) {
    const [key, ...rest] = lines[i].split(":");
    frontmatter[key.trim()] = rest.join(":").trim();
  }
  return {
    frontmatter,
    body: lines.slice(endIndex + 1).join("\n").trim(),
  };
}
```

```typescript
// src/lib/changelog/render-markdown.ts — renderer controlado

// Suporta: ## heading, parágrafos, - listas, **negrito**
// Retorna HTML sanitizado (apenas tags permitidas: h2, p, ul, li, strong)
// Se encontrar sintaxe não suportada, lança erro no build (não em runtime)

export function renderMarkdown(md: string): string;
```

**E se o conteúdo exigir markdown mais rico no futuro?**
- O contrato `ChangelogEntry.body` é string — a implementação do renderer muda internamente
- `renderMarkdown` vira `renderMarkdown(content, options)` que pode delegar para `react-markdown` quando necessário
- Nenhum arquivo de entry precisa ser alterado

**Fail fast no build (Zod):**

```typescript
// src/lib/changelog/schema.ts
import { z } from "zod"; // já existe no projeto?

export const ChangelogFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  milestone: z.string().optional(),
  category: z.enum(["feature", "improvement", "fix"]),
  importance: z.enum(["major", "minor"]),
  announcement: z.enum(["none", "card", "modal"]),
});

// O projeto já tem Zod — validação fail fast no build/CI.
```

---

```
ARQUIVOS NOVOS:
════════════════

content/
  changelog/
    2026-07-30-fase-30-legal-foundation.md ← entry exemplo 1 (apenas .md — sem parser aqui)
    2026-07-31-fase-32-freemium-cnpj.md    ← entry exemplo 2
    2026-08-01-fase-34-store-readiness.md  ← entry exemplo 3

src/lib/
  changelog/
    types.ts                              ← ChangelogEntry, ChangelogCategory, Frontmatter
    get-changelog.ts                      ← parser + ordenação + validação Zod
    __tests__/
      get-changelog.test.ts               ← 4+ testes

src/hooks/
  use-changelog-state.ts                  ← localStorage (dois controles) + markChangelogAsViewed +
                                             dismissAnnouncement + hasUnseen + isAnnouncementVisible

src/components/
  changelog/
    changelog-card.tsx                     ← card de entry individual (badge + conteúdo renderizado)
    changelog-list.tsx                     ← lista de entries ordenadas
    changelog-announcement.tsx            ← card de anúncio na dashboard
    sidebar-badge.tsx                     ← indicador de novidades na sidebar (client component)

src/app/
  (app)/
    novidades/
      page.tsx                            ← página /novidades (server component)


ARQUIVOS MODIFICADOS:
══════════════════════

src/components/shell/sidebar.tsx
  ← Adicionar NAV_ITEMS com item "Novidades" + ícone (Megaphone, Newspaper ou Sparkles)
  ← Verificar pathname para active state (/novidades)

src/components/shell/sidebar-drawer.tsx
  ← Re-renderiza automaticamente (usa <Sidebar />) — sem alteração estrutural
  ← O indicador de badge precisa ser client-side (ver D3)

src/components/shell/app-shell.tsx
  ← Nenhuma alteração (Sidebar é usado como componente, badge fica dentro)

src/components/shell/account-menu.tsx
  ← Adicionar link "Novidades" entre Configurações e Sair
  ← Opcional: indicador de badge usando o mesmo hook

src/app/(app)/dashboard/page.tsx
  ← Adicionar <ChangelogAnnouncement /> após <VerificationBanners /> e
     <ReadinessCheckBanner />, antes do conteúdo principal
  ← Buscar latestEntry com announcement !== "none"
  ← Passar para o componente client-side

docs/
  changelog.md                            ← Rotina documentada de atualização
```

---

## Contratos de Integração

### Types

```typescript
// src/lib/changelog/types.ts

export type ChangelogCategory = "feature" | "improvement" | "fix";
export type ChangelogImportance = "major" | "minor";

export interface ChangelogFrontmatter {
  id: string;
  title: string;
  date: string;        // ISO date
  milestone?: string;  // ex: "v1.5"
  category: ChangelogCategory;
  importance: ChangelogImportance;
  announcement: "none" | "card" | "modal";
}

export interface ChangelogEntry {
  frontmatter: ChangelogFrontmatter;
  body: string;        // markdown content (minus frontmatter)
  slug: string;        // derived from filename
}
```

### getChangelog()

```typescript
// src/lib/changelog/get-changelog.ts

// Retorna todas as entries, ordenadas por data DESC
export async function getAllEntries(): Promise<ChangelogEntry[]>;

// Retorna a entry mais recente com announcement !== "none" (ou null)
export async function getLatestAnnouncement(): Promise<ChangelogEntry | null>;

// Retorna entry por ID
export async function getEntryById(id: string): Promise<ChangelogEntry | null>;
```

### ChangelogAnnouncement

```typescript
// src/components/changelog/changelog-announcement.tsx
// Client component que:
// 1. Recebe a latestEntry como prop (server-side)
// 2. Verifica isAnnouncementVisible(entry.id)
// 3. Se visível, exibe card ou modal conforme announcement type
// 4. Ao fechar → dismissAnnouncement(entry.id) (só dispensa, não marca como visto)
// 5. Ao clicar "Ver novidades" → navega para /novidades
//    (/novidades chama markChangelogAsViewed(latestEntryId, entry.id))

interface ChangelogAnnouncementProps {
  entry: ChangelogEntry | null;
}
```

### useChangelogState

```typescript
// src/hooks/use-changelog-state.ts

interface UseChangelogStateReturn {
  lastSeenId: string | null;
  dismissedId: string | null;
  markChangelogAsViewed: (latestEntryId: string, latestAnnouncementId?: string) => void;
  dismissAnnouncement: (id: string) => void;
  hasUnseen: (latestId: string) => boolean;
  isAnnouncementVisible: (entryId: string) => boolean;
}

export function useChangelogState(): UseChangelogStateReturn;
```

---

## Testes

14+ testes seguindo padrão do repositório:

### getChangelog (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `getAllEntries()` com 3 arquivos → retorna 3 entries ordenadas por data DESC | Leitura e ordenação |
| 2 | `getLatestAnnouncement()` com 1 entry `announcement: "card"` → retorna a entry | Filtro correto |
| 3 | `getLatestAnnouncement()` sem entries com `announcement !== "none"` → null | Sem anúncio = null |
| 4 | `getEntryById("fase-30-legal-foundation")` → retorna frontmatter + body parseados | Parse completo |

### useChangelogState (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 5 | `hasUnseen()` sem nada em localStorage → `true` | Primeiro acesso |
| 6 | `markChangelogAsViewed(id)` + `hasUnseen(mesmoId)` → `false` | Visita a `/novidades` limpa indicador |
| 7 | `markChangelogAsViewed(id, announcementId)` → `lastSeenId` e `dismissedId` atualizados | Visita também dispensa anúncio ativo |
| 8 | `dismissAnnouncement(id)` + `isAnnouncementVisible(mesmoId)` → `false`, mas `hasUnseen(outroId)` → `true` | Dispensa não afeta indicador da sidebar |

### ChangelogList (2 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 8 | Renderiza entries com badges de categoria → categoria aparece com cor correta | Visual consistente |
| 9 | Renderiza entries sem conteúdo → estado vazio tratado | Robustez |

### ChangelogAnnouncement (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 10 | Entry com `announcement: "card"` e não dispensada → card aparece | Anúncio visível |
| 11 | Entry com `announcement: "none"` → card não aparece | Filtro correto |
| 12 | Card descartado → desaparece e `dismissAnnouncement` é chamado | Dispensa funcional |
| 13 | Card dispensado NÃO altera `lastSeenId` → sidebar badge continua ativo | Separação correta |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **localStorage limpo (troca de dispositivo/navegador) → usuário vê novidades antigas de novo** | Aceitável. É um repeat de no máximo 1-3 cards. O changelog é conteúdo útil, não spam. Se virar problema, migrar para Supabase |
| **Sidebar badge piscando sem parar se algo der errado** | Hook compara ID exato, não timestamp. Se localStorage corromper, `lastSeenId` fica null → badge aparece até usuário visitar `/novidades` |
| **Equipe esquece de atualizar changelog no final das fases** | Rotina documentada em `docs/changelog.md`. Checklist de revisão da fase inclui "Changelog atualizado?" |
| **Markdown permite formatação inconsistente entre entries** | Validação com Zod + fail fast no build. Frontmatter mal formatado quebra o CI |
| **Changelog vira "release notes técnico" em vez de comunicação de produto** | Critério editorial documentado na D5. Code review para entries garante tom adequado |
| **Card de anúncio acumula se usuário não acessar por semanas** | Apenas UM card aparece (o mais recente). Ao visitar `/novidades`, todas as entries são marcadas como vistas |
| **Fases frequentes geram muitas entries pequenas** | Agrupar entries menores por milestone. A página `/novidades` é scrollável; múltiplas entries não são problema |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Supabase como fonte de dados** | F35 usa markdown estático. Migração para DB será considerada quando houver necessidade de targeting, analytics ou controle admin |
| **Read receipts no servidor** | localStorage é suficiente para o caso de uso atual. Servidor-side só com Supabase |
| **Changelog por plano de usuário (free vs premium)** | Não há planos distintos ainda. Quando houver, a segmentação pode usar o mesmo frontmatter + filtro no server |
| **Notificação push/email de novidades** | O changelog é consultivo (usuário vê quando acessa o produto). Notificação ativa é canal separado (futuro) |
| **Admin UI para publicar entries** | Enquanto a frequência for 1-2 entries por fase, editar markdown e commitar é mais rápido que construir UI. Se a frequência aumentar, considerar CMS leve ou admin UI |
| **Feed RSS/JSON de changelog** | Expor o changelog como API pública é útil para integrações, mas não é necessário para o MVP. Fazer apenas se solicitado |
| **Internacionalização (i18n)** | Produto é brasileiro. Changelog em PT-BR. i18n é fase futura se houver expansão |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Fonte de dados: Markdown com frontmatter em `content/changelog/`. JSON e `/public` descartados
- [ ] D2 — Página dedicada `/novidades` na sidebar como entry point principal. AccountMenu como secundário
- [ ] D3 — Indicador de novidades via localStorage. Sem Supabase, sem requisição extra
- [ ] D4 — Card como padrão, modal como exceção. Controlado por `announcement: "none" | "card" | "modal"`. Dispensa separada de visita a `/novidades`
- [ ] D5 — Tom editorial: comunicação de produto em português claro, não release notes técnicas
- [ ] D6 — Frequência: obrigatório ao final de cada fase com impacto visível. Agrupamento por milestone a critério editorial
- [ ] D7 — Sem Supabase. Dados estáticos + localStorage. Supabase só se surgir necessidade de targeting, analytics ou controle admin
- [ ] D8 — Parser próprio de frontmatter + renderer controlado. Sem gray-matter ou react-markdown. Zod para validação (já existe no projeto). Fail fast no build

### Fonte de dados
- [ ] `content/changelog/` contém apenas arquivos `.md` — sem `index.ts` ou parser no diretório de dados
- [ ] `content/changelog/*.md` — ao menos 3 entries de exemplo (F30, F32, F34)
  - [ ] Todas com frontmatter válido (id, title, date, category, importance, announcement)
  - [ ] Conteúdo em português claro, tom de produto (D5)
  - [ ] Apenas a entry mais recente com `announcement: "card"` (F32); demais com `"none"`
- [ ] `content/changelog/` tratado no `.gitignore`? Não — deve ser versionado

### Lib
- [ ] `src/lib/changelog/types.ts` — ChangelogEntry, ChangelogCategory, ChangelogFrontmatter
- [ ] `src/lib/changelog/parse-frontmatter.ts` — parser simples (~30 linhas), sem gray-matter
  - [ ] Lança erro se `---` de abertura/fechamento ausente
  - [ ] Lança erro se chave obrigatória faltando
- [ ] `src/lib/changelog/render-markdown.ts` — renderer controlado (headings, parágrafos, listas, negrito)
  - [ ] Lança erro no build se sintaxe não suportada
- [ ] `src/lib/changelog/schema.ts` — schema Zod do frontmatter, fail fast no build/CI
- [ ] `src/lib/changelog/get-changelog.ts` — getAllEntries(), getLatestAnnouncement(), getEntryById()
  - [ ] Parse de frontmatter YAML
  - [ ] Ordenação por data DESC
  - [ ] Diretório vazio → retorna array vazio (não quebra)
  - [ ] Frontmatter inválido → throw (fail fast no build)

### Página /novidades
- [ ] `src/app/(app)/novidades/page.tsx` — server component
  - [ ] Busca todas as entries via getAllEntries()
  - [ ] Passa para ChangelogList (client-only via indicador de badge)
  - [ ] Breadcrumb: Dashboard > Novidades
  - [ ] PageHeader com título "Novidades"
  - [ ] Se não houver entries: EmptyState

### Componentes
- [ ] `src/components/changelog/changelog-card.tsx` — card de entry individual
  - [ ] Badge de categoria com cor (feature=green, improvement=blue, fix=amber)
  - [ ] Título + data
  - [ ] Indicador de importância (visual discreto)
  - [ ] Conteúdo markdown renderizado
- [ ] `src/components/changelog/changelog-list.tsx` — lista de entries
  - [ ] Múltiplos ChangelogCard ordenados
  - [ ] Separação visual entre entries
- [ ] `src/components/changelog/changelog-announcement.tsx` — card ou modal na dashboard
  - [ ] Exibe apenas se `announcement !== "none"` E entry não dispensada
  - [ ] Se `announcement: "card"` → card discreto
  - [ ] Se `announcement: "modal"` → modal com ação
  - [ ] Botão "Ver novidades" → /novidades (que chama `markChangelogAsViewed` com o id do anúncio)
  - [ ] Botão fechar (×) → dismissAnnouncement (não afeta o indicador da sidebar)
- [ ] `src/components/changelog/sidebar-badge.tsx` — indicador client-side
  - [ ] Usa useChangelogState
  - [ ] Exibe badge/ponto se hasUnseen

### Sidebar
- [ ] `src/components/shell/sidebar.tsx`
  - [ ] NAV_ITEMS adicionado: { href: "/novidades", label: "Novidades", icon: Sparkles/Newspaper }
  - [ ] Active state funcional (pathname === "/novidades" ou startsWith)
  - [ ] SidebarBadge integrado

### AccountMenu
- [ ] `src/components/shell/account-menu.tsx`
  - [ ] Link "Novidades" entre Configurações e Sair
  - [ ] SidebarBadge (opcional) ou apenas link

### Dashboard
- [ ] `src/app/(app)/dashboard/page.tsx`
  - [ ] Import getLatestAnnouncement()
  - [ ] Renderizar <ChangelogAnnouncement entry={latestAnnouncement} /> — o hook decide visibilidade; `/novidades` chama `markChangelogAsViewed`
  - [ ] Posicionamento: após banners, antes do conteúdo principal
  - [ ] Não quebrar se latestAnnouncement === null

### Hook
- [ ] `src/hooks/use-changelog-state.ts`
  - [ ] Duas chaves: `vendeo:last_seen_changelog_id` e `vendeo:dismissed_changelog_announcement_id`
  - [ ] `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` → atualiza SEEN_KEY e, se announcementId presente, DISMISSED_KEY
  - [ ] `dismissAnnouncement(id)` → localStorage.setItem(DISMISSED_KEY, id) apenas
  - [ ] `hasUnseen(latestId)` → comparação simples (lastSeenId !== latestId)
  - [ ] `isAnnouncementVisible(entryId)` → dismissedId !== entryId
  - [ ] SSR-safe: só acessa localStorage no useEffect
  - [ ] Testado com mock de localStorage

### Rotina de atualização
- [ ] `docs/changelog.md` — procedimento documentado
  - [ ] Quando atualizar
  - [ ] Como criar entry (passo a passo)
  - [ ] Template de frontmatter
  - [ ] Exemplo de entry
  - [ ] Critérios editoriais (D5)
  - [ ] Checklist: "Changelog atualizado?" no template de fase

### Testes
- [ ] getChangelog (4 testes)
- [ ] useChangelogState (4 testes)
- [ ] ChangelogList (2 testes)
- [ ] ChangelogAnnouncement (4 testes)

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### UAT Local
- [ ] /novidades lista entries ordenadas com badges corretas
- [ ] Sidebar mostra "Novidades" com indicador quando há conteúdo novo
- [ ] `markChangelogAsViewed(id)` atualiza `last_seen_changelog_id` → indicador da sidebar some
- [ ] `markChangelogAsViewed(id, announcementId)` também atualiza `dismissed_changelog_announcement_id` → anúncio desaparece
- [ ] Dashboard mostra card/modal para entry com `announcement: "card"`/`"modal"` e não dispensada
- [ ] Fechar card → card desaparece (dismissAnnouncement), mas sidebar badge continua ativo (dispensa ≠ visualização)
- [ ] Clicar "Ver novidades" → /novidades (que chama markChangelogAsViewed passando o id do anúncio ativo)
- [ ] Sidebar badge some APENAS após visitar /novidades, não ao fechar card
- [ ] AccountMenu tem link "Novidades"
- [ ] Sidebar badge some após visitar /novidades
- [ ] Dashboard sem entries → sem card (não quebra)
- [ ] /novidades sem entries → EmptyState (não quebra)
- [ ] Regressão: sidebar, dashboard, account menu continuam funcionais

---

*Documento criado: 2026-07-30*
*Baseado no alinhamento da milestone v1.5, discussão entre dois agentes com consolidação das recomendações (Markdown em content/, página dedicada, sidebar fixa, indicador via localStorage, dois controles separados (visita × dispensa), announcement: none/card/modal no frontmatter, parser próprio sem gray-matter, fail fast no build, tom editorial de produto, sem Supabase).*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
