---
phase: 35-changelog-novidades
plan: 02
subsystem: core-library
tags: [changelog, server-only, fs, zod, localStorage, react-hooks, ssr-safe]

# Dependency graph
requires:
  - phase: 35-01
    provides: "types.ts, parse-frontmatter.ts, schema.ts (Zod), render-markdown.ts, format-date.ts + 3 seeds content/changelog (F30, F32, F34)"
provides:
  - "get-changelog.ts — leitura/validação/ordenação server-only (getAllEntries, getLatestAnnouncement, getEntryById)"
  - "use-changelog-state.ts — hook SSR-safe com 2 chaves localStorage independentes (F35-STATE-01..06)"
affects: [35-03, 35-04, 35-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-only module via `import \"server-only\"` + fs/promises readdir/readFile + parseFrontmatter + Zod parse (fail fast no build)"
    - "Hook SSR-safe: localStorage acessado APENAS em useEffect/handlers; estado inicial null; sync entre abas via evento `storage` + evento customizado `vendeo:changelog-viewed`"
    - "Teste de SSR-safety: captura do estado do primeiro render via closure + spy de getItem nas chaves exatas"

key-files:
  created:
    - src/lib/changelog/get-changelog.ts
    - src/hooks/use-changelog-state.ts
    - src/lib/changelog/__tests__/get-changelog.test.ts
    - src/hooks/__tests__/use-changelog-state.test.ts
  modified: []

key-decisions:
  - "Parâmetro opcional `dir` nas 3 funções públicas (default CHANGELOG_DIR) para testes com fixtures em mkdtemp — contrato do spec sem argumento permanece idêntico"
  - "readdir ENOENT → retorna [] (diretório vazio/não existe não quebra); demais erros propagam (fail fast)"
  - "Hook dispara evento customizado `vendeo:changelog-viewed` + usa listener de `storage` para sync entre abas sem estado global (D3)"

patterns-established:
  - "Teste de hook com harness de primeiro-render: renderHook + closure captura o estado inicial antes dos efeitos para provar SSR-safety"
  - "Testes com fixtures em fs.mkdtemp + afterEach rm(recursive) para cenários de diretório vazio/inválido sem tocar o diretório real"

requirements-completed: [F35-CONTENT-06, F35-STATE-01, F35-STATE-02, F35-STATE-03, F35-STATE-04, F35-STATE-05, F35-STATE-06]

# Metrics
duration: 9min
completed: 2026-07-31
---

# Phase 35 Plan 02: Core Library Summary

**Módulo server-only de leitura/validação/ordenação de changelog (get-changelog.ts, fail fast no build) + hook client SSR-safe de estado de leitura com 2 chaves localStorage independentes (use-changelog-state.ts)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-31T14:39:30Z
- **Completed:** 2026-07-31T14:47:10Z
- **Tasks:** 2 (ambas TDD: RED → GREEN)
- **Files modified:** 4 criados

## Accomplishments

- `get-changelog.ts` (server-only): `getAllEntries` ordena por data DESC (comparaçao lexicográfica ISO), `getLatestAnnouncement` retorna a entry mais recente com `announcement !== "none"`, `getEntryById` busca por id — todos com diretório vazio → `[]`/null e frontmatter inválido → throw (fail fast)
- Seeds reais de 35-01 (F30/F32/F34) validados sem throw — o gate "fail fast no build" funciona com o conteúdo real
- `use-changelog-state.ts`: chaves `vendeo:last_seen_changelog_id` e `vendeo:dismissed_changelog_announcement_id`; `markChangelogAsViewed` atualiza SEEN + (opcional) DISMISSED; `dismissAnnouncement` atualiza APENAS DISMISSED; `hasUnseen` compara ID exato; `isAnnouncementVisible` = `dismissedId !== entryId`; sync entre abas via `storage` + evento `vendeo:changelog-viewed`; zero estado global, zero Supabase (D3/D7)
- 13 cenários de teste (7 get-changelog + 6 hook), typecheck limpo, sem novas dependências (D8)

## Task Commits

Cada task foi commitada atomicamente (TDD RED → GREEN):

1. **Task 1: get-changelog.ts — leitura, validação e ordenação** - `c655934` (test: failing tests) + `70e3c64` (feat: implement)
2. **Task 2: use-changelog-state.ts — dois controles de localStorage SSR-safe** - `0e3055c` (test: failing tests) + `fc733e5` (feat: implement)

**Plan metadata:** `(próximo commit — docs)`

## Files Created/Modified

- `src/lib/changelog/get-changelog.ts` - Leitura de `content/changelog/*.md` com fs/promises, parseFrontmatter, validação Zod e ordenação por data DESC; exporta `CHANGELOG_DIR`, `getAllEntries`, `getLatestAnnouncement`, `getEntryById`
- `src/lib/changelog/__tests__/get-changelog.test.ts` - 7 cenários: diretório real (ordem F34→F32→F30), fixtures com announcement, id inexistente, diretório vazio, frontmatter inválido (throw)
- `src/hooks/use-changelog-state.ts` - Hook client com estado inicial null, leitura de localStorage só em useEffect/handlers, listeners `storage` + `vendeo:changelog-viewed`, `markChangelogAsViewed`/`dismissAnnouncement`/`hasUnseen`/`isAnnouncementVisible`
- `src/hooks/__tests__/use-changelog-state.test.ts` - 6 cenários: SSR-safe (primeiro render null), mark com e sem announcementId, dismiss sem tocar SEEN_KEY, ids vazios, hasUnseen com nova entry

## Decisions Made

- **Parâmetro `dir` opcional:** as 3 funções públicas aceitam um diretório alternativo (default `CHANGELOG_DIR` = `content/changelog`). Contrato do spec (chamadas sem argumento) permanece idêntico; existe apenas para os testes criarem fixtures com `fs.mkdtemp` sem tocar o diretório real (T-35-04).
- **ENOENT → `[]`:** `readdir` com diretório inexistente retorna lista vazia (não quebra); demais erros propagam. Frontmatter inválido (parse ou Zod) sempre lança — fail fast no build (T-35-05).
- **Sync entre abas sem estado global (D3):** useEffect registra listener de `storage` (outras abas) + `vendeo:changelog-viewed` (mesma aba — badge da sidebar some imediatamente após navegar para /novidades em navegação client-side).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste 1 do hook: impossibilidade de observar o estado inicial `null` via `result.current`**
- **Found during:** Task 2 (GREEN — teste falhando)
- **Issue:** `renderHook` do @testing-library/react executa efeitos sincronamente dentro do `act()` — ao retornar, o estado já está populado pelo `useEffect`. A asserção original `result.current.lastSeenId` ser `null` (com valores pré-existentes no localStorage) era impossível de satisfazer, e `expect(getItemSpy).not.toHaveBeenCalled()` capturava as chamadas legítimas do efeito.
- **Fix:** Reescrevi o Test 1 para provar SSR-safety de forma observável: capturar o retorno do hook no PRIMEIRO render (via closure `firstRender.state` no callback do renderHook) e asserir que é `null` — se o render lesse localStorage, o estado inicial viria populado. Complementado com spy de `getItem` verificando que o efeito lê exatamente as 2 chaves contratuais (nenhuma outra).
- **Files modified:** `src/hooks/__tests__/use-changelog-state.test.ts`
- **Verification:** 6/6 cenários do hook passam; typecheck limpo
- **Committed in:** fc733e5 (parte do commit GREEN da Task 2)

**2. [Rule 1 - Bug] TypeScript estreitava a variável de captura do primeiro render para `never`**
- **Found during:** Task 2 (typecheck após fix do Test 1)
- **Issue:** `let firstRenderState: UseChangelogStateReturn | null` era estreitada para `never` pelo control-flow do TS após o assignment na closure, gerando `TS2339` nas linhas de asserção.
- **Fix:** Substituída por um holder objeto `{ state: UseChangelogStateReturn | null }` — mutação de propriedade não é estreitada pelo control-flow.
- **Files modified:** `src/hooks/__tests__/use-changelog-state.test.ts`
- **Verification:** `npm run typecheck` limpo
- **Committed in:** fc733e5 (parte do commit GREEN da Task 2)

---

**Total deviations:** 2 auto-fixed (2 bug)
**Impact on plan:** Ajustes restritos ao arquivo de teste do hook para tornar a prova de SSR-safe observável e compilável. Nenhuma mudança de escopo; o comportamento implementado segue exatamente o plano.

## Issues Encountered

Nenhum além dos auto-fixes documentados acima. O comportamento de `renderHook` (efeitos síncronos) exigiu repensar a estratégia de asserção do teste SSR-safe — resolvido com o harness de primeiro render.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Core library completa para os planos 35-03 (página /novidades + componentes) e 35-04 (app shell + dashboard): `getAllEntries`/`getLatestAnnouncement`/`getEntryById` prontos para consumo server-side, e `useChangelogState` pronto para o fluxo `latestEntryId` server→client por prop
- O `slug` derivado do filename (`2026-08-01-fase-34-store-readiness`) e o `id` do frontmatter (`fase-34-store-readiness`) estão disponíveis para a UI do 35-03 (navegação por slug, exibição de data sem fuso)

## Self-Check: PASSED

- ✅ `src/lib/changelog/get-changelog.ts` existe
- ✅ `src/hooks/use-changelog-state.ts` existe
- ✅ `src/lib/changelog/__tests__/get-changelog.test.ts` existe
- ✅ `src/hooks/__tests__/use-changelog-state.test.ts` existe
- ✅ Commits `c655934`, `70e3c64`, `0e3055c`, `fc733e5` no git log
- ✅ 13/13 cenários de teste passando; `npm run typecheck` limpo

---
*Phase: 35-changelog-novidades*
*Completed: 2026-07-31*
