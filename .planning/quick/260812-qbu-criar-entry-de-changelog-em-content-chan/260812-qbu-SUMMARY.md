---
phase: quick-260812-qbu
plan: 01
subsystem: content
tags: [changelog, content, docs, entry, announcement]

# Dependency graph
requires:
  - phase: 35-changelog-novidades
    provides: changelog library (schema zod, get-changelog.ts, tests)
provides:
  - Entry consolidada de changelog 2026-08-12 cobrindo as 5 entregas visíveis ao lojista (vendeo.tech, landing pública, beta fechado, app instalável, card de créditos claro)
affects: [changelog, /novidades, dashboard announcement, get-changelog.test.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Padrão editorial do changelog: 3 seções fixas (O que mudou / Por que isso importa / O que você precisa fazer) + frontmatter completo, português claro para o lojista sem jargão técnico"

key-files:
  created:
    - content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md
    - .planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md
  modified:
    - src/lib/changelog/__tests__/get-changelog.test.ts

key-decisions:
  - "Entry consolidada (uma única entry datada 2026-08-12) em vez de múltiplas entries por quick — segue a recomendação de agrupamento editorial do docs/changelog-update.md"
  - "Sugestões do usuário aplicadas no frontmatter: título 'Vendeo em novo endereço, com acesso mais simples pelo celular', category improvement, importance major, announcement card"
  - "announcement card compatível com o padrão do repo (F35/F36): getLatestAnnouncement passa a retornar a nova entry e o card da F36 cai automaticamente"

patterns-established:
  - "Manutenção de teste do diretório real: expectativas com índices hardcoded (entries[N] e getLatestAnnouncement) precisam refletir a entry mais recente sempre que uma nova entry for adicionada"

requirements-completed: [QBU-01, QBU-02, QBU-03, QBU-04]

# Metrics
duration: 8min
completed: 2026-08-12
---

# Quick 260812-QBU: Entry de changelog consolidada (2026-08-12) Summary

**Entry consolidada de changelog cobrindo as 5 entregas visíveis ao lojista (novo endereço vendeo.tech, landing pública com acesso gratuito, beta fechado, app instalável e card de créditos claro), com validação zod/typecheck/lint verdes e ajuste mínimo das 2 expectativas hardcoded do teste do diretório real — SEM nenhum commit**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-12T19:01:00Z
- **Completed:** 2026-08-12T19:03:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Criada `content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md` com frontmatter completo válido no schema zod (`id`, `title`, `date` 2026-08-12, `milestone` v1.5, `category` improvement, `importance` major, `announcement` card) e as 3 seções do padrão editorial (`## O que mudou`, `## Por que isso importa`, `## O que você precisa fazer`), em português claro para o lojista — cobrindo as 5 entregas visíveis das quicks 260808-rqw (landing + acesso fechado) e 260808-udc (PWA + clareza no card de créditos) e da migração de domínio vendeo.tech.
- Verificação de termos proibidos limpa: nenhuma ocorrência de Vercel, Supabase, DNS, migra, redirect, runbook, branch, PWA, endpoint ou "service worker" na entry (QBU-03).
- Ajustadas as 2 expectativas hardcoded em `get-changelog.test.ts` (ordering do diretório real) e suite verde: 8/8 testes passando, schema zod valida a nova entry (fail-fast), typecheck exit 0, lint exit 0.
- NENHUM commit criado — os 3 arquivos ficam no working tree para revisão humana (QBU-04).

## Task Commits

**Sem commits — execução com regra de no-commit obrigatória (revisão humana antes do commit).**

1. **Task 1: Criar a entry consolidada de changelog (2026-08-12)** — sem commit (arquivo criado no working tree)
2. **Task 2: Validar changelog (schema + testes) e ajustar as 2 expectativas hardcoded** — sem commit (teste modificado + SUMMARY criado no working tree)

## Files Created/Modified

- `content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md` - Entry consolidada de changelog com frontmatter completo e 3 seções editoriais cobrindo as 5 entregas visíveis
- `src/lib/changelog/__tests__/get-changelog.test.ts` - Ajuste mínimo das 2 expectativas hardcoded do diretório real (entries[0] e getLatestAnnouncement) para a nova entry mais recente
- `.planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md` - Este resumo

## Decisions Made

- Entry única consolidada datada 2026-08-12 (não uma entry por quick) — segue a recomendação de agrupamento editorial do `docs/changelog-update.md` ("várias fases pequenas podem virar uma entry de milestone").
- Sugestões do usuário aplicadas integralmente no frontmatter: título "Vendeo em novo endereço, com acesso mais simples pelo celular", `category: "improvement"`, `importance: "major"`, `announcement: "card"` — todas compatíveis com o guia e com o padrão do repo.
- `announcement: "card"` faz a nova entry virar o card ativo da dashboard via `getLatestAnnouncement`; o card da F36 deixa de ser exibido automaticamente (sem ação extra).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Índices hardcoded de entries[1]/entries[2] desatualizados no teste do diretório real**
- **Found during:** Task 2 (re-rodar teste após ajuste das expectativas citadas no plano)
- **Issue:** O plano citava apenas as 2 expectativas de entries[0] e getLatestAnnouncement, mas o teste também tinha asserções hardcoded em `entries[1]` (esperava `fase-35-changelog-novidades`/`2026-07-31`) e `entries[2]` (esperava `fase-34-store-readiness`/`2026-07-30`). Com a nova entry (2026-08-12) no topo da ordenação DESC, esses índices deslocaram em 1 e o teste passou a falhar em `entries[1]` mesmo após o ajuste previsto no plano.
- **Fix:** Deslocou as asserções existentes em 1 posição: `entries[1]` passou a esperar `fase-36-onboarding-navegacao-por-abas`/`2026-08-06` e `entries[2]` passou a esperar `fase-35-changelog-novidades`/`2026-07-31` — exatamente o que o próprio nome do teste prescrito no plano já previa (`novo-endereço 2026-08-12 → F36 → F35 → F34 → F32 → F30`). Nada além disso foi alterado.
- **Files modified:** src/lib/changelog/__tests__/get-changelog.test.ts
- **Verification:** `vitest run src/lib/changelog/__tests__/get-changelog.test.ts` → 8/8 passando
- **Committed in:** sem commit (working tree, regra de no-commit)

---

**Total deviations:** 1 auto-fixed (1 bug de manutenção de teste)
**Impact on plan:** Ajuste mínimo necessário para a suite ficar verde com a nova entry; sem mudança de escopo, sem código funcional de produto.

## Issues Encountered

- `rg` (ripgrep) não está disponível no shell Windows (PowerShell) — a verificação de termos proibidos da Task 1 e as contagens de frontmatter foram feitas com o grep do tooling, com os mesmos patterns do plano (resultado limpo).
- O comando `npm test -- <arquivo>` não produziu saída no shell; o teste foi executado diretamente via `npx vitest run <arquivo>` (mesma suite, mesmos resultados).
- `npm run typecheck` / `npm run lint` não imprimiram saída visível no shell; executados diretamente via `npx tsc -p tsconfig.typecheck.json --noEmit` (exit 0) e `npx eslint .` (exit 0), confirmando verdes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Entry pronta para revisão humana (copy verbatim do plano, sem commits).
- Após aprovação humana, o commit deve incluir os 3 arquivos: a entry (untracked), o teste (modified) e o SUMMARY (untracked).
- A nova entry com `announcement: "card"` substitui automaticamente o card da F36 na dashboard assim que for commitada e deployada.

---

*Phase: quick-260812-qbu*
*Completed: 2026-08-12*
