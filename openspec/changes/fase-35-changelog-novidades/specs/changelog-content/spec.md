## ADDED Requirements

### Requirement: Fonte de dados de changelog em content/changelog/

O sistema SHALL prover a fonte de dados de changelog como arquivos Markdown com frontmatter YAML em `content/changelog/`, versionados no repositório. Cada arquivo SHALL conter:

- Frontmatter YAML delimitado por `---` com os campos: `id` (string, obrigatório, slug único), `title` (string, obrigatório), `date` (string ISO `YYYY-MM-DD`, obrigatório, data de publicação em fuso brasileiro — sem componente de hora), `milestone` (string, opcional, ex: "v1.5"), `category` (`"feature" | "improvement" | "fix"`, obrigatório), `importance` (`"major" | "minor"`, obrigatório), `announcement` (`"none" | "card" | "modal"`, obrigatório)
- Body em Markdown (apenas `## heading`, parágrafos, `- listas`, `**negrito**`) respondendo a três perguntas: o que mudou, por que importa para o lojista, o que ele precisa fazer

O diretório SHALL conter ao menos 3 entries de exemplo: F30 (`fase-30-legal-foundation`, feature/major/announcement none, data `2026-07-28`), F32 (`fase-32-freemium-cnpj`, feature/major/announcement card, data `2026-07-29`), F34 (`fase-34-store-readiness`, improvement/minor/announcement none, data `2026-07-30`). No seed inicial, apenas a entry mais relevante para anúncio (F32) SHALL ter `announcement: "card"`; demais `"none"`. F34 é a entry mais recente do seed inicial por data.

**Conteúdo vivo (dogfooding):** ao final da fase (após o próprio changelog ser implementado), o diretório SHALL conter também a entry F35 (`fase-35-changelog-novidades`, feature/major/announcement card, data `2026-07-31`) como a entry mais recente por data e o anúncio ativo da dashboard. A regra "apenas F32 com card" é uma propriedade do seed inicial, não uma regra permanente do changelog.

#### Scenario: Diretório possui ao menos 3 entries de exemplo com frontmatter válido

- **WHEN** `content/changelog/` é inspecionado
- **THEN** contém ao menos 3 arquivos `.md` (F30, F32, F34)
- **AND** cada arquivo tem frontmatter válido com id, title, date, category, importance e announcement

#### Scenario: Apenas a entry mais relevante gera anúncio no seed inicial

- **WHEN** as entries de exemplo do seed são validadas
- **THEN** apenas a entry F32 tem `announcement: "card"`
- **AND** F30 e F34 têm `announcement: "none"`
- **AND** a entry mais recente do seed por data é a F34 (`2026-07-30`), que não gera anúncio

#### Scenario: Após o dogfooding, a entry F35 é a mais recente e o anúncio ativo

- **WHEN** o diretório contém a entry F35 (implementação da própria fase)
- **THEN** a entry F35 (`2026-07-31`) é a mais recente por data
- **AND** `getLatestAnnouncement()` retorna a F35 (announcement `"card"`)

### Requirement: Parser de frontmatter sem dependências externas

O sistema SHALL prover `parseFrontmatter(raw: string): ParseResult` em `src/lib/changelog/parse-frontmatter.ts` que:

- Lança erro se a primeira linha não for `---` (frontmatter de abertura ausente)
- Lança erro se o `---` de fechamento não for encontrado
- Parseia linhas `chave: valor` (split no primeiro `:`, valores com `:` preservados)
- **Remove aspas simples/duplas opcionais de valores escalares** (ex: `"none"` → `none`, `'v1.5'` → `v1.5`) — o valor retornado ao Zod NUNCA contém aspas
- Retorna `{ frontmatter: Record<string, unknown>, body: string }` com o body trimado

#### Scenario: Parse de frontmatter válido

- **WHEN** `parseFrontmatter` recebe um raw com frontmatter completo e body
- **THEN** retorna `frontmatter` com as chaves parseadas e `body` com o conteúdo após o `---` de fechamento

#### Scenario: Parse remove aspas de valores escalares

- **WHEN** `parseFrontmatter` recebe `announcement: "none"` e `category: 'feature'`
- **THEN** o frontmatter retornado tem `announcement === "none"` e `category === "feature"` (sem aspas)
- **AND** a validação Zod do enum aceita os valores sem falha

#### Scenario: Valores com dois-pontos preservam o texto completo

- **WHEN** `parseFrontmatter` recebe uma chave cujo valor contém `:` (ex: título "Lançamento: v1.5")
- **THEN** o valor retornado preserva o texto inteiro após o primeiro `:`

#### Scenario: Frontmatter sem abertura lança erro

- **WHEN** `parseFrontmatter` recebe raw que não começa com `---`
- **THEN** lança `Error` com mensagem indicando frontmatter de abertura ausente

#### Scenario: Frontmatter sem fechamento lança erro

- **WHEN** `parseFrontmatter` recebe raw com `---` de abertura mas sem fechamento
- **THEN** lança `Error` com mensagem indicando `---` de fechamento não encontrado

### Requirement: Renderer controlado de markdown

O sistema SHALL prover `renderMarkdown(md: string): string` em `src/lib/changelog/render-markdown.ts` que:

- Suporta `## heading` (→ `<h2>`), parágrafos (→ `<p>`), listas `- ` (→ `<ul><li>`), `**negrito**` (→ `<strong>`)
- Retorna HTML sanitizado contendo apenas as tags permitidas: `h2`, `p`, `ul`, `li`, `strong`
- **Escapa todo texto bruto (HTML-escape) ANTES de aplicar as tags permitidas** — texto cru como `<script>` ou `<b>` é escapado (`&lt;script&gt;`), nunca passado como HTML cru
- **HTML cru não permitido no body** — se o body contiver tags HTML não suportadas, o conteúdo é escapado ou a renderização lança erro no build; nunca há saída de HTML não sanitizado
- Lança erro no build se encontrar sintaxe de markdown não suportada (ex: tabelas, links, imagens, `#` heading único)
- Não lança em runtime — o conteúdo é validado em build/CI

#### Scenario: Renderiza subconjunto suportado de markdown

- **WHEN** `renderMarkdown` recebe conteúdo com heading, parágrafo e lista
- **THEN** retorna HTML com `h2`, `p`, `ul`/`li` nas posições correspondentes

#### Scenario: Renderiza negrito

- **WHEN** `renderMarkdown` recebe texto com `**negrito**`
- **THEN** retorna HTML com `<strong>` no trecho correspondente

#### Scenario: Texto bruto é escapado

- **WHEN** `renderMarkdown` recebe texto com HTML cru (ex: `<script>` ou `<b>`)
- **THEN** o HTML cru é escapado (`&lt;script&gt;`, `&lt;b&gt;`)
- **AND** a saída NÃO contém tags HTML não permitidas como HTML interpretável

#### Scenario: Sintaxe não suportada lança erro

- **WHEN** `renderMarkdown` recebe sintaxe fora do subconjunto permitido
- **THEN** lança `Error` indicando sintaxe não suportada

### Requirement: Schema Zod do frontmatter — fail fast no build

O sistema SHALL prover `ChangelogFrontmatterSchema` (Zod) em `src/lib/changelog/schema.ts` que valida:

- `id`: string não vazia
- `title`: string não vazia
- `date`: regex `^\d{4}-\d{2}-\d{2}$`
- `milestone`: string opcional
- `category`: enum `["feature", "improvement", "fix"]`
- `importance`: enum `["major", "minor"]`
- `announcement`: enum `["none", "card", "modal"]`

Frontmatter inválido SHALL lançar erro no build/CI (fail fast), não em runtime.

#### Scenario: Frontmatter válido passa na validação

- **WHEN** o frontmatter contém todos os campos obrigatórios com valores válidos
- **THEN** a validação Zod passa sem erros

#### Scenario: Frontmatter com category inválida quebra

- **WHEN** o frontmatter tem `category` fora do enum
- **THEN** a validação Zod lança erro

#### Scenario: Frontmatter com date em formato inválido quebra

- **WHEN** o frontmatter tem `date` fora do formato `YYYY-MM-DD`
- **THEN** a validação Zod lança erro

### Requirement: Tipos de changelog

O sistema SHALL prover os tipos em `src/lib/changelog/types.ts`:

```typescript
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

#### Scenario: Tipos expostos cobrem o contrato

- **WHEN** os tipos são importados
- **THEN** `ChangelogEntry`, `ChangelogFrontmatter`, `ChangelogCategory` e `ChangelogImportance` estão disponíveis e tipados conforme o contrato

### Requirement: get-changelog — leitura, validação e ordenação

O sistema SHALL prover `src/lib/changelog/get-changelog.ts` com as funções:

- `getAllEntries(): Promise<ChangelogEntry[]>` — lê todos os `.md` de `content/changelog/`, parseia frontmatter, valida com Zod, deriva `slug` do filename e retorna ordenado por data DESC
- `getLatestAnnouncement(): Promise<ChangelogEntry | null>` — retorna a entry mais recente com `announcement !== "none"` (por data DESC), ou `null` se nenhuma existir
- `getEntryById(id: string): Promise<ChangelogEntry | null>` — retorna a entry com o id informado, ou `null` se não existir

Comportamento SHALL:
- Diretório vazio → retorna array vazio (não quebra)
- Frontmatter inválido (parse ou Zod) → lança erro (fail fast no build)
- Ordenação sempre por data DESC (mais recente primeiro); empates de data resolvidos por ordem estável de leitura

#### Scenario: getAllEntries retorna entries ordenadas por data DESC

- **WHEN** existem 4 arquivos `.md` no diretório (F35, F34, F32, F30)
- **THEN** retorna entries na ordem F35 (2026-07-31) → F34 (2026-07-30) → F32 (2026-07-29) → F30 (2026-07-28)

#### Scenario: getLatestAnnouncement retorna entry com anúncio

- **WHEN** existe entry com `announcement: "card"` e outra com `announcement: "none"`
- **THEN** retorna a entry com `announcement: "card"`

#### Scenario: getLatestAnnouncement retorna null sem anúncios

- **WHEN** nenhuma entry tem `announcement !== "none"`
- **THEN** retorna `null`

#### Scenario: getEntryById retorna entry parseada

- **WHEN** `getEntryById("fase-30-legal-foundation")` é chamado
- **THEN** retorna a entry com frontmatter e body parseados

#### Scenario: getEntryById retorna null para id inexistente

- **WHEN** `getEntryById` é chamado com um id que não existe
- **THEN** retorna `null`

#### Scenario: Diretório vazio não quebra

- **WHEN** `content/changelog/` está vazio ou não existe
- **THEN** `getAllEntries()` retorna `[]` e `getLatestAnnouncement()` retorna `null`

### Requirement: Data de publicação sem distorção de fuso horário

O sistema SHALL tratar `date` como string ISO `YYYY-MM-DD` (data de publicação em fuso brasileiro, sem componente de hora/minuto/segundo e sem offset de timezone). O sistema SHALL:

- Usar `date` apenas como data civil (calendário), nunca como instante de tempo com timezone
- Ordenar por comparação lexicográfica da string `YYYY-MM-DD` (ordenar por data = ordenar pela string ISO, sem conversão de fuso)
- Formatar para exibição (ex: `dd/mm/aaaa` em pt-BR) a partir dos campos da string ISO diretamente ou de forma que NÃO dependa do fuso horário da máquina/servidor — NÃO usar `new Date("YYYY-MM-DD")` + `toLocaleDateString("pt-BR")` sem mitigação, pois o parser ISO UTC pode deslocar a data para o dia anterior no fuso brasileiro (UTC-3)

#### Scenario: Formatação não desloca a data para o dia anterior

- **WHEN** `date` é `"2026-07-31"` e o sistema é executado em fuso brasileiro (America/Sao_Paulo, UTC-3)
- **THEN** a exibição formatada é `31/07/2026` (NÃO `30/07/2026`)

#### Scenario: Ordenação por data usa comparação da string ISO

- **WHEN** entries têm dates `2026-07-28`, `2026-07-29`, `2026-07-30` e `2026-07-31`
- **THEN** a ordem DESC por data é `2026-07-31` → `2026-07-30` → `2026-07-29` → `2026-07-28` independente do fuso horário do servidor

### Requirement: Rotina de atualização documentada

O sistema SHALL manter `docs/changelog-update.md` (guia já existente, criado no alinhamento da F35) como a referência de rotina de atualização do changelog, contendo:

- Quando atualizar (obrigatório ao final de cada fase com impacto visível; recomendado agrupar por milestone; não obrigatório para infra/refatoração/testes)
- Passo a passo de como criar uma entry (arquivo, nome, frontmatter, tom)
- Template de frontmatter com todos os campos
- Exemplo de entry completo
- Critérios editoriais (D5): o que mudou, por que importa, o que o lojista precisa fazer
- Checklist "Changelog atualizado?" incluído no template de revisão de fase

A implementação SHALL revisar o guia existente e ajustá-lo cirurgicamente se necessário (ex: alinhar nome de arquivo, fuso horário da data, exemplo de announcement) — SHALL NÃO recriar ou duplicar em outro caminho (ex: não criar `docs/changelog.md`).

#### Scenario: docs/changelog-update.md contém os elementos da rotina

- **WHEN** `docs/changelog-update.md` é lido
- **THEN** contém quando atualizar, passo a passo, template de frontmatter, exemplo e critérios editoriais
- **AND** nenhum arquivo `docs/changelog.md` duplicado é criado
