---
phase: 35-changelog-novidades
plan: 01
subsystem: content, library
tags: [changelog, markdown, frontmatter, zod, typescript, xss, tdd, pt-br]

# Dependency graph
requires:
  - phase: 30-legal-foundation
    provides: entry seed F30 (Fundação Legal — feature/major)
  - phase: 32-freemium-anti-abuso-cnpj
    provides: entry seed F32 (Freemium CNPJ — feature/major, announcement card)
  - phase: 34-store-readiness
    provides: entry seed F34 (Store Readiness — improvement/minor, mais recente)
provides:
  - content/changelog/ com 3 entries seed editoriais (F30, F32, F34) em PT-BR
  - src/lib/changelog/types.ts — contrato ChangelogEntry/ChangelogFrontmatter
  - src/lib/changelog/parse-frontmatter.ts — parser YAML próprio, zero dependências
  - src/lib/changelog/schema.ts — ChangelogFrontmatterSchema (Zod, fail-fast no build)
  - src/lib/changelog/render-markdown.ts — renderer controlado com HTML sanitizado
  - src/lib/changelog/format-date.ts — dd/mm/aaaa sem shift de fuso UTC-3
affects: [35-02-get-changelog, 35-03-componentes-changelog, 35-04-app-shell-dashboard]

# Tech tracking
tech-stack:
  added: []  # zero dependências novas (D8) — zod e vitest já presentes
  patterns:
    - "Módulos puros (sem server-only/fs/supabase) para contratos compartilhados client/server"
    - "Parser de frontmatter próprio (~30 linhas) em vez de gray-matter"
    - "Renderer controlado com HTML-escape ANTES das tags (defesa em profundidade contra XSS)"
    - "TDD red-green por feature: testes primeiro, commit test(...) seguido de feat(...)"

key-files:
  created:
    - content/changelog/2026-07-30-fase-30-legal-foundation.md
    - content/changelog/2026-07-31-fase-32-freemium-cnpj.md
    - content/changelog/2026-08-01-fase-34-store-readiness.md
    - src/lib/changelog/types.ts
    - src/lib/changelog/parse-frontmatter.ts
    - src/lib/changelog/schema.ts
    - src/lib/changelog/render-markdown.ts
    - src/lib/changelog/format-date.ts
    - src/lib/changelog/__tests__/parse-frontmatter.test.ts
    - src/lib/changelog/__tests__/schema.test.ts
    - src/lib/changelog/__tests__/render-markdown.test.ts
    - src/lib/changelog/__tests__/format-date.test.ts
  modified: []

key-decisions:
  - "D1 + D8: fonte de dados em Markdown com frontmatter em content/changelog/, sem gray-matter/react-markdown"
  - "Parser próprio remove aspas de valores escalares antes do Zod (announcement: \"card\" → card)"
  - "Renderer faz HTML-escape de todo texto bruto antes de aplicar tags — saída nunca contém HTML cru interpretável (T-35-01)"
  - "formatChangelogDate divide a string ISO em partes (sem new Date) para evitar o shift de dia em UTC-3"
  - "Sintaxe não suportada (h1, links, imagens, blockquote, code fence) lança Error no build/CI, nunca em runtime"

patterns-established:
  - "Changelog: corpo editorial com seções ## O que mudou / ## Por que isso importa / ## O que você precisa fazer"
  - "Seed: apenas F32 com announcement \"card\" (única com anúncio); F34 (2026-08-01) mais recente por data"
  - "Fuso: date é string civil YYYY-MM-DD; ordenação lexicográfica; formatação por split, sem new Date(ISO)"

requirements-completed: [F35-CONTENT-01, F35-CONTENT-02, F35-CONTENT-03, F35-CONTENT-04, F35-CONTENT-05]

# Metrics
duration: 24min
completed: 2026-07-31
---

# Phase 35 Plan 01: Foundation Summary

**Fonte de dados `content/changelog/` com 3 entries seed editoriais (F30/F32/F34) + core library pura de changelog (types, parser de frontmatter próprio, schema Zod fail-fast, renderer markdown sanitizado e formatador de data pt-BR sem shift de fuso) — 17 cenários de teste, zero dependências novas**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-31T14:13:00Z
- **Completed:** 2026-07-31T14:37:02Z
- **Tasks:** 3 (2 TDD red-green)
- **Files modified:** 12 (8 produção/dados + 4 testes)

## Accomplishments

- `content/changelog/` criado com exatamente 3 entries `.md` em PT-BR editorial (D5): F30 feature/major/`none`, F32 feature/major/`card` (única com anúncio), F34 improvement/minor/`none` (mais recente por data, `2026-08-01`); corpos restritos ao subconjunto `## / parágrafo / - lista / **negrito**`
- Core library pura de changelog: `types.ts` (ChangelogCategory, ChangelogImportance, ChangelogFrontmatter, ChangelogEntry com slug), `parse-frontmatter.ts` (~30 linhas, split no primeiro `:`, remove aspas de escalares, erro sem `---` de abertura/fechamento), `schema.ts` (Zod com regex `^\d{4}-\d{2}-\d{2}$` e enums — fail fast no build)
- Renderer controlado `render-markdown.ts` com HTML-escape ANTES das tags (whitelist h2/p/ul/li/strong; `<script>` → `&lt;script&gt;`) e erro em sintaxe não suportada; `format-date.ts` formata `dd/mm/aaaa` por split da string ISO (proibido `new Date(ISO)` por causa do shift UTC-3), com fail-safe em formato inválido
- 17 cenários de teste passando (parser 5, schema 4, renderer 5, date 3) via TDD red-green com commits `test(...)` → `feat(...)` por feature; `npm run typecheck` limpo

## Task Commits

Each task was committed atomically:

1. **Task 1: Seed content/changelog — 3 entries editoriais (D1, D5)** - `6ce05f1` (feat)
2. **Task 2: Core Library — types + parse-frontmatter + schema (TDD)** - `0adf07f` (test, RED) + `7e82cc7` (feat, GREEN)
3. **Task 3: Renderer controlado + formatação de data (TDD)** - `939719b` (test, RED) + `b0bbf2b` (feat, GREEN)

**Plan metadata:** `27634af` (docs: complete changelog foundation plan — SUMMARY + self-check)

## Files Created/Modified

- `content/changelog/2026-07-30-fase-30-legal-foundation.md` - Entry seed F30 (feature/major, announcement none) — Termos, Privacidade e Uso Aceitável
- `content/changelog/2026-07-31-fase-32-freemium-cnpj.md` - Entry seed F32 (feature/major, announcement card) — CNPJ obrigatório + 10 créditos de boas-vindas
- `content/changelog/2026-08-01-fase-34-store-readiness.md` - Entry seed F34 (improvement/minor, announcement none, data mais recente) — dados da loja antes de gerar campanhas
- `src/lib/changelog/types.ts` - Tipos do contrato: ChangelogCategory, ChangelogImportance, ChangelogFrontmatter, ChangelogEntry (slug derivado do filename)
- `src/lib/changelog/parse-frontmatter.ts` - Parser YAML próprio sem dependências: valida delimitadores, parseia `chave: valor`, remove aspas de escalares, preserva `:` interno, retorna body trimado
- `src/lib/changelog/schema.ts` - ChangelogFrontmatterSchema (Zod): id/title min(1), date regex, enums category/importance/announcement; rejeita valores fora dos enums (ZodError)
- `src/lib/changelog/render-markdown.ts` - Renderer controlado: whitelist h2/p/ul/li/strong, escapeHtml antes das tags, `**negrito**` após escape, erro em `# `/`> `/```/links/imagens
- `src/lib/changelog/format-date.ts` - formatChangelogDate: split da string ISO → `dd/mm/aaaa` com zero-padding, sem conversão de fuso; fail-safe devolve a própria string
- `src/lib/changelog/__tests__/parse-frontmatter.test.ts` - 5 cenários do parser (válido, aspas, dois-pontos, sem abertura, sem fechamento)
- `src/lib/changelog/__tests__/schema.test.ts` - 4 cenários do schema (válido, category inválida, date inválida, id/title vazio)
- `src/lib/changelog/__tests__/render-markdown.test.ts` - 5 cenários do renderer (h2/p/ul/li, negrito, escape XSS, h1 lança, link/imagem lança)
- `src/lib/changelog/__tests__/format-date.test.ts` - 3 cenários de data (sem shift, zero-padding, fail-safe)

## Decisions Made

- **D1 + D8:** Markdown com frontmatter em `content/changelog/` + parser/renderer próprios — zero dependências novas (zod e vitest já estavam no projeto); troca futura para gray-matter/react-markdown não muda o contrato `ChangelogEntry`
- **D5:** corpos editoriais respondendo às três perguntas (o que mudou / por que importa / o que o lojista precisa fazer), sem jargão técnico, restritos ao subconjunto do renderer
- **T-35-01 (XSS):** escape de TODO texto bruto antes de aplicar tags — verificado por teste que `<script>` cru não aparece na saída e `&lt;script&gt;` sim
- **D8/fuso:** `formatChangelogDate` opera sobre a string ISO (split), nunca `new Date(ISO)` + `toLocaleDateString`, evitando o deslocamento de dia em UTC-3 (teste: `2026-07-31` → `31/07/2026`)
- **F34 alinhada ao template:** `docs/changelog-update.md` já continha o exemplo com os mesmos id/title/date/valores da entry F34 — a entry seed segue o padrão documentado

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Ambiente Windows: `npm` e `rg` não executam diretamente no pipeline do PowerShell — resolvido usando `npm.cmd run typecheck` e a ferramenta Grep/Select-String para os checks de sanidade (sem impacto no plano)
- Teste extra adicionado em `format-date.test.ts` (fail-safe: entrada fora do regex devolve a string intacta) para cobrir o comportamento especificado na ação do Task 3 — contagem efetiva de 17 cenários (≥ 11 exigidos)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Contratos prontos para o plano 35-02 (`get-changelog.ts` server-only com getAllEntries/getLatestAnnouncement/getEntryById e `use-changelog-state` SSR-safe): types, parser, schema e renderer validados por 17 testes
- Entries seed validáveis: F34 mais recente por data (ordenável lexicograficamente), F32 única com `announcement: "card"` (getLatestAnnouncement deve retorná-la)
- Zero dependências novas — sem lockfile ou bundle impactados

## TDD Gate Compliance

- Task 2: RED `0adf07f` (test) → GREEN `7e82cc7` (feat) ✓
- Task 3: RED `939719b` (test) → GREEN `b0bbf2b` (feat) ✓
- REFACTOR não aplicado (implementações mínimas e limpas — nenhum commit de refactor necessário)
- Nenhuma violação de gate; todos os RED falharam por módulo ausente (motivo correto), todos os GREEN passaram

## Self-Check: PASSED

- `content/changelog/` com 3 arquivos `.md` ✓ (`Get-ChildItem` retorna 3)
- `src/lib/changelog/*.ts` (8 módulos + 4 testes) existem ✓
- Commits: `6ce05f1`, `0adf07f`, `7e82cc7`, `939719b`, `b0bbf2b` ✓ (`git log` verificado)
- 17/17 testes passando em `src/lib/changelog/` ✓
- `npm run typecheck` limpo ✓
- Grep `server-only|supabase|fs` em `src/lib/changelog` vazio ✓ (módulos puros)

---
*Phase: 35-changelog-novidades*
*Completed: 2026-07-31*
