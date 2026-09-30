---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-03
subsystem: domain
tags: [lab-bench, prompt-base, deterministic, pure-module, oferta-1-1]

# Dependency graph
requires:
  - phase: 48-2-4-02
    provides: "núcleo contribution-based do compositor (composePromptBlocks) e COMPOSER_VERSION da fase"
  - phase: 48-2-4-01
    provides: "config-registry (DEFAULT_BENCH_CONFIG / BenchRecorteConfig) e contratos de schemas"
provides:
  - "BENCH_DEFAULT_PROMPT_BASE + BENCH_DEFAULT_PROMPT_BASE_VERSION (prompt-base padrão versionado da fase)"
  - "resolveBenchDefaultPromptBase(config) chaveado pelo recorte multidimensional"
  - "conteúdo do padrão apenas complementar (sem hierarquia de oferta nem formato 1:1)"
  - "contrato de preservação integral e determinismo do prompt-base editado (sem IA)"
affects: [48-2-4-08 (API/UI), 48-2-4-09 (UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prompt-base padrão como artefato versionado em código, resolvido por assinatura do recorte"
    - "Fail-closed determinístico para recorte sem padrão (bench_prompt_base_not_found)"
    - "Módulo puro auto-contido (sem policies/**, sem IA, sem I/O)"

key-files:
  created:
    - src/lib/lab/bench/domain/prompt-base.ts
    - src/lib/lab/bench/__tests__/prompt-base.contract.test.ts
  modified: []

key-decisions:
  - "Assinatura do recorte sobre as 6 dimensões do config-registry (BENCH_REGISTRY_DIMENSIONS), na ordem canônica; modelo/qualidade não pertencem ao recorte"
  - "Conteúdo complementar focado em acabamento/coerência/restrição estética, evitando qualquer termo de hierarquia comercial ou formato"
  - "Módulo auto-contido: importa apenas config-registry e o tipo BenchConfig — sem policies/**, branding-prompt-mapping ou identity-direction"

patterns-established:
  - "Prompt-base padrão versionado resolvido por configuração: registry Map<assinatura, {version, content}> extensível sem reescrever o módulo"

requirements-completed:
  - "cap: lab-bench-prompt-base"
  - "spec: lab-bench-prompt-base"
  - "D6"
  - "tasks: 4.1, 4.2, 4.3, 4.4"

# Metrics
duration: 2min
completed: 2026-09-30
---

# Phase 48.2.4 Plan 03: Prompt-base padrão versionado e resolvido por configuração Summary

**Prompt-base padrão versionado (`48.2.4-oferta-1-1-v1`) resolvido por configuração via assinatura do recorte multidimensional, com conteúdo apenas complementar, preservação integral e determinismo provados sem IA.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-30T15:49:04Z
- **Completed:** 2026-09-30T15:50:36Z
- **Tasks:** 2
- **Files modified:** 2 (2 criados, 0 modificados)

## Accomplishments

- Módulo puro `prompt-base.ts` com `BENCH_DEFAULT_PROMPT_BASE`, `BENCH_DEFAULT_PROMPT_BASE_VERSION` (`"48.2.4-oferta-1-1-v1"`) e `resolveBenchDefaultPromptBase(config)` retornando `{ version, content }`.
- Resolução **chaveada pelo recorte multidimensional** (as 6 dimensões do `config-registry`); extensível para outros recortes sem reescrever o módulo; recorte sem padrão falha de forma determinística (`bench_prompt_base_not_found`).
- Conteúdo do padrão **apenas complementar** (acabamento, coerência geral, restrição estética) — não repete a hierarquia de oferta nem a orientação de formato 1:1 das políticas.
- Contrato com 12 testes provando carregamento/resolução por configuração, complementaridade, preservação integral (padrão e editado, verbatim sem filtragem), determinismo com entrada editada e ausência de IA/rede; módulo auto-contido (sem `policies/**`, `branding-prompt-mapping` ou `identity-direction`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar prompt-base.ts (padrão versionado resolvido por configuração)** - `dac36b4a` (feat)
2. **Task 2: Provar preservação integral, determinismo e ausência de IA** - `d0606c91` (test)

**Plan metadata:** _(commit de metadados feito pelo orquestrador)_

## Files Created/Modified

- `src/lib/lab/bench/domain/prompt-base.ts` — módulo puro: versão estável da fase, `BENCH_DEFAULT_PROMPT_BASE`, registry `Map<assinatura, {version, content}>`, `resolveBenchDefaultPromptBase(config)` e `BenchPromptBaseError` (`bench_prompt_base_not_found`).
- `src/lib/lab/bench/__tests__/prompt-base.contract.test.ts` — 12 testes de contrato (resolução por configuração, complementaridade, preservação verbatim, determinismo, pureza/auto-contenção).

## Decisions Made

- **Assinatura do recorte** sobre as 6 dimensões de `BENCH_REGISTRY_DIMENSIONS` (`pipeline`, `formato`, `intencao`, `tipoConteudo`, `estrutura`, `tema`), na ordem canônica. `modelo`/`qualidade` não integram o recorte governado (pertencem aos presets) e são ignorados pela resolução.
- **Conteúdo complementar** deliberadamente sem termos de preço/selo/validade/desconto/hierarquia comercial e sem "quadrado"/"1:1"/"formato"/"peça única".
- **Auto-contenção**: `prompt-base.ts` importa somente `./config-registry` e o tipo `BenchConfig` de `./schemas` — não importa `policies/types.ts`, `branding-prompt-mapping.ts` nem `identity-direction.ts`, honrando a restrição de execução em onda.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docstring continha o literal `process.env`, colidindo com o gate de pureza do plano**
- **Found during:** Task 1 (criação do `prompt-base.ts`), na verificação estática `<verify>` (`$s -match "process\.env|..."`).
- **Issue:** O comentário de módulo descrevia "sem `process.env`", e a checagem estática de pureza (que busca o literal) reprovava o arquivo.
- **Fix:** Reescrita do comentário para "sem variáveis de ambiente", preservando o significado sem o literal proibido.
- **Files modified:** `src/lib/lab/bench/domain/prompt-base.ts`
- **Verification:** Gate estático `VERIFY-TASK1-OK`; `npm run typecheck` exit 0.
- **Committed in:** `dac36b4a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Correção cosmética necessária apenas para satisfazer o gate de pureza estático. Sem mudança de comportamento nem scope creep.

## Issues Encountered

- O executor do shell Windows não resolve `npm` diretamente no PowerShell; as verificações foram executadas via `npm.cmd` (mesmos scripts `typecheck`/`test` do `package.json`), sem alterar os comandos do plano.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Padrão versionado e resolvido por configuração disponível para a página server/API/UI (Planos 08/09) carregarem `defaultPromptBase` + versão como props iniciais (D6), mantendo a edição do operador e a preservação integral pelo compositor.
- Evidência de versão do padrão pronta para ser registrada na persistência (Planos 01/07).
- Sem bloqueios.

---
*Phase: 48.2.4-experimento-deterministico-oferta-1-1*
*Completed: 2026-09-30*

## Self-Check: PASSED

- FOUND: src/lib/lab/bench/domain/prompt-base.ts
- FOUND: src/lib/lab/bench/__tests__/prompt-base.contract.test.ts
- FOUND: .planning/phases/48.2.4-experimento-deterministico-oferta-1-1/48-2-4-03-SUMMARY.md
- FOUND: dac36b4a
- FOUND: d0606c91
