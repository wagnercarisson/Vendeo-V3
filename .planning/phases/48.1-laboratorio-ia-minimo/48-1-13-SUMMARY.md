---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-13
subsystem: testing
tags:
  [
    contract-guard,
    regression,
    vitest,
    typecheck,
    lint,
    build,
    image-generation,
    additive-seam,
    lab,
  ]

# Dependency graph
requires:
  - phase: 48.1-laboratorio-ia-minimo (48-1-01..48-1-12)
    provides: bounded context src/lib/lab/**, harness de gateway, execução/snapshots imutáveis, API/UI admin e as duas suítes de contrato
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: gateway/adapters/registry que o laboratório reutiliza e que este plano prova intactos
  - phase: 47-catalogo-e-selecao-de-modelos-admin
    provides: ai_model_catalog / ai_model_selection que o laboratório só lê (nunca escreve)
provides:
  - "scripts/verify/48-1-13-contract-guard.mjs — guard executável de contrato congelado: base SHA persistida (nunca HEAD), frozenPaths, migrations, gateway, prompts byte-a-byte, seam aditivo, referências proibidas, contrato externo/allowlist e relatório JSON"
  - "prova por git diff de que a F48.1 é estritamente aditiva: 156 arquivos alterados, 0 violação (frozen, contrato externo, referências proibidas)"
  - "regressão completa verde (333 arquivos / 3585 testes + 1 skipped) sem co-migração de testes irmãos"
affects: [48-1-14, 48.2+]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard de contrato de fase com base SHA persistida em 48.1-BASELINE.txt + allowlist de arquivos alterados"
    - "Prova de seam aditivo via git diff -U0 (nenhuma linha de produção removida)"
    - "Relatório JSON de evidência no stdout para registro no SUMMARY"

key-files:
  created:
    - scripts/verify/48-1-13-contract-guard.mjs
  modified:
    - .planning/phases/48.1-laboratorio-ia-minimo/48-1-13-PLAN.md

key-decisions:
  - "Base do diff lida de .planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt com trim() + ^[0-9a-f]{40}$; --base <sha> opcional; HEAD nunca é default (senão o diff ficaria vazio no encerramento)"
  - "Comparação dos prompts oficiais com EOL normalizado (core.autocrlf=true no Windows) para evitar falso positivo CRLF×LF"
  - "Allowlist de arquivos alterados inclui openspec/changes/fase-48-1-laboratorio-ia-minimo/** (a fase editou seus próprios artefatos de change durante execução/revisão)"
  - "docs/alinhamento-fase-44-temas-de-campanhas permanece fora do diff e dos commits da F48.1 (frente F44)"
  - "Nenhum teste irmão precisou de co-migração: o seam buildDirectorPrompt é 100% aditivo (0 linhas removidas no diff -U0)"
  - "Arquivos não rastreados são reportados no JSON como informativos (untrackedFiles) e não entram na prova de não-mudança, que usa o diff vs base"

patterns-established:
  - "Guard de contrato de fase com base SHA persistida + relatório JSON (evolução do precedente 47-07)"

requirements-completed:
  - lab-isolation
  - lab-scenarios
  - lab-experiments
  - lab-runs
  - lab-gateway-harness
  - lab-artifacts
  - lab-admin-api
  - lab-admin-ui
  - lab-human-evaluation

# Metrics
duration: 11 min
completed: 2026-09-16
---

# Phase 48.1 Plan 13: Regressão e Co-migração de Fixtures Summary

**Regressão completa verde (333 arquivos / 3585 testes) + guard executável de contrato congelado que prova por `git diff` que a F48.1 é estritamente aditiva (156 arquivos alterados, 0 violação) — sem co-migração de testes irmãos e sem nenhuma alteração de produção.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-16T21:23:00-03:00
- **Completed:** 2026-09-16T21:34:30-03:00
- **Tasks:** 3
- **Files modified:** 2 (1 criado + 1 ajuste de planejamento)

## Accomplishments

- **Suíte completa verde sem resíduos:** `npx vitest run` → 333 arquivos / 3585 testes + 1 skipped, exit 0. Nenhum teste de F46/F47 quebrou.
- **Co-migração dispensada (e comprovada):** o seam aditivo `buildDirectorPrompt` em `ImageGenerationService` tem **0 linhas removidas** no `git diff -U0`, então nenhum teste irmão precisou ser tocado — `image-generation-service.test.ts` e `route.test.ts` permanecem byte-a-byte como estavam.
- **Guard de contrato congelado executável** (`scripts/verify/48-1-13-contract-guard.mjs`): base SHA persistida (nunca `HEAD`), 14 `frozenPaths`, migrations restritas a `*f48_1*`, `gateway.ts`/`model-resolver.ts` sem referências ao laboratório, 16 prompts oficiais comparados com a base, seam aditivo, varredura de referências proibidas em código produtivo e no laboratório, contrato externo + allowlist de arquivos alterados e relatório JSON no stdout.
- **Os 3 gates verdes:** `npm run typecheck` (exit 0), `npm run lint` (exit 0), `npm run build` (exit 0).
- **Não-mudança do contrato externo comprovada:** UI/form do lojista, schema público, snapshot/domínio, prompts oficiais, `src/lib/ai/gateway.ts` e a migration F47 do catálogo/seleção não aparecem no diff da fase; `generation_events` e `campaign-images` não ganharam nenhuma referência do laboratório.

## Task Commits

Each task was committed atomically:

1. **Task 1: Suíte completa, resíduos e co-migração do seam aditivo** - `a9c1150d` (docs)
2. **Task 2: Guard de contrato congelado + os 3 gates** - `f0c769a8` (test)
3. **Task 3: Varredura de não-mudança do contrato externo e evidências** - `8ee17f97` (test)

**Plan metadata:** `docs(48-1-13): complete regressao e co-migracao plan` (commit do SUMMARY)

## Files Created/Modified

- `scripts/verify/48-1-13-contract-guard.mjs` — guard de contrato congelado (ESM, sem dependência nova; só `node:child_process`/`node:fs`/`node:path`); exit 1 em qualquer violação.
- `.planning/phases/48.1-laboratorio-ia-minimo/48-1-13-PLAN.md` — alinhamento da allowlist do guard para incluir `openspec/changes/fase-48-1-laboratorio-ia-minimo/**` (ajuste de planejamento feito antes da execução; commitado como resíduo da fase).

**Nenhum arquivo de produção foi criado ou modificado.** Os dois arquivos listados em `files_modified` como candidatos a co-migração (`src/lib/image-generation/services/__tests__/image-generation-service.test.ts` e `src/app/api/campaign/generate-image/__tests__/route.test.ts`) **não foram alterados**.

## Evidências (Task 1 + Task 2 + Task 3)

### Suíte e gates (exit codes reais)

| Comando | Resultado | Exit |
| --- | --- | --- |
| `npx vitest run` | 333 arquivos / 3585 testes + 1 skipped | **0** |
| `npx vitest run src/lib/ai src/lib/ai-cost` | 25 arquivos / 294 testes | **0** |
| `npx vitest run src/lib/image-generation src/app/api/campaign/generate-image` | 8 arquivos / 245 testes | **0** |
| `npx vitest run src/lib/ai src/lib/ai-cost src/lib/image-generation src/app/api/campaign/generate-image` | 33 arquivos / 539 testes | **0** |
| `npm run typecheck` | `tsc -p tsconfig.typecheck.json --noEmit` | **0** |
| `npm run lint` | `eslint .` | **0** |
| `npm run build` | `npm run check:cnae && next build` | **0** |
| `node scripts/verify/48-1-13-contract-guard.mjs` | 0 violações | **0** |

### Co-migração dos testes irmãos

**Nenhuma co-migração foi necessária.** Justificativa: o seam `buildDirectorPrompt(brief, context, options?)` adicionado ao `ImageGenerationService` (48-1-05) é **puramente aditivo** — `git diff -U0 <base> -- src/lib/image-generation/services/image-generation-service.ts` mostra **0 linhas removidas** e nenhuma linha removida casa `generateImage|buildPromptVariables|assemblePrompt|brief_review_confirmed`. `generateImage` continua chamando os mesmos métodos privados com os mesmos parâmetros/estado, portanto as assinaturas e expectativas dos testes irmãos permanecem válidas e verdes.

### Relatório JSON do guard (base = `48.1-BASELINE.txt`)

`base`: `75ab54cf23eee1a6a31b500a5a2646398aada6eb` (origem: `.planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt`)

```json
{
  "base": "75ab54cf23eee1a6a31b500a5a2646398aada6eb",
  "baseOrigin": ".planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt",
  "changedFiles": "<156 arquivos — lista completa omitida por tamanho>",
  "f48_1Migrations": [
    "supabase/migrations/20260915000002_f48_1_create_lab_tables.sql",
    "supabase/migrations/20260915000003_f48_1_lab_immutability_and_reserve.sql"
  ],
  "frozenViolations": [],
  "externalContractViolations": [],
  "forbiddenReferences": [],
  "promptsUnchanged": true,
  "promptsChecked": 16,
  "additiveSeam": true,
  "seamRemovedLines": 0,
  "untrackedFiles": ["docs/alinhamento-fase-44-temas-de-campanhas"],
  "violationCount": 0
}
```

Saída humana correspondente:

```
base: 75ab54cf23eee1a6a31b500a5a2646398aada6eb (origem: .planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt)
arquivos alterados: 156
paths congelados: OK
prompts: OK (16 arquivos idênticos à base)
seam aditivo: OK (linhas removidas no seam: 0)
referências proibidas: 0
contrato externo/allowlist: OK
migrations f48_1: 2
48-1-13 contract guard PASS: 0 violações.
```

### Prova de falha do guard (exit 1)

| Cenário | Resultado |
| --- | --- |
| `--base 0000000000000000000000000000000000000000` (ref inexistente) | exit **1** — "base ... não existe neste repositório" |
| `--base HEAD` (não-SHA) | exit **1** — "base inválida ... esperado SHA de 40 hex minúsculos" |
| `--base <commit raiz>` (prompts criados depois da base) | exit **1** — 131 violações de paths congelados, `prompts: VIOLADO`, 2064 violações de contrato externo/allowlist |

### Checks de working tree

- `git status --porcelain` das superfícies de produção (gateway, model-resolver, model-registry, ai-cost, campaign, campaign-intelligence, snapshot, `providers/openai.ts`, `image-generation/schema.ts`, `prompts/`, `components/flow`, `generate-image/route.ts`) → **vazio**.
- `git diff --name-only <base> -- docs/alinhamento-fase-44-temas-de-campanhas` → **vazio**.
- `Get-ChildItem supabase/migrations -like "*f48*"` → exatamente **2** arquivos.

## Decisions Made

- **Base do diff:** `48.1-BASELINE.txt` (SHA do 48-1-01) com `trim()` + `^[0-9a-f]{40}$`; `--base <sha>` opcional; `HEAD` jamais é default — senão o diff de encerramento ficaria vazio e a prova de não-mudança seria inválida (T-48-1-103).
- **EOL normalizado** na comparação dos prompts oficiais (`core.autocrlf=true` neste repositório): `git show <base>:<path>` devolve LF enquanto o working tree tem CRLF; sem normalização haveria falso positivo em todos os 16 prompts.
- **Allowlist inclui os artefatos de change da própria fase** (`openspec/changes/fase-48-1-laboratorio-ia-minimo/**`), porque a fase legitimamente ajustou `design.md`/`specs/**` durante execução e revisão.
- **Arquivos não rastreados** são reportados no JSON (`untrackedFiles`) como informação, sem entrar na prova de não-mudança — a prova é o diff vs base. `docs/alinhamento-fase-44-temas-de-campanhas` (frente F44) é explicitamente proibido na allowlist e permanece não rastreado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm` não executa em pipeline no PowerShell 5.1**
- **Found during:** Task 2 (execução dos 3 gates)
- **Issue:** `npm run typecheck 2>&1 | Select-Object ...` falha com "Não é possível executar um documento no meio de um pipeline: C:\WINDOWS\system32\npm".
- **Fix:** usar `npm.cmd run <script>`.
- **Files modified:** nenhum (apenas forma de invocação do comando).
- **Verification:** `npm.cmd run typecheck|lint|build` → exit 0.
- **Committed in:** n/a (sem alteração de arquivo).

**2. [Rule 2 - Missing Critical] Verificação de leitura do `ai_model_catalog` no commit da Task 2**
- **Found during:** Task 3 (revisão do escopo do guard)
- **Issue:** o check de "`ai_model_catalog` somente leitura" (item 3 da Task 3) acabou presente já no arquivo commitado pela Task 2, porque o guard foi escrito como artefato único antes de ser dividido em dois commits.
- **Fix:** nenhum código a corrigir — é superset do escopo da Task 2 e não enfraquece nenhuma asserção. Documentado aqui para rastreabilidade.
- **Files modified:** `scripts/verify/48-1-13-contract-guard.mjs` (já no commit `f0c769a8`).
- **Verification:** `node scripts/verify/48-1-13-contract-guard.mjs` → exit 0; `rg "ai_model_catalog" scripts/verify/48-1-13-contract-guard.mjs` → presente.
- **Committed in:** `f0c769a8`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical) — nenhuma alteração de produção.
**Impact on plan:** Ambos são operacionais/de rastreabilidade. Nenhum scope creep: a única superfície tocada é o próprio guard (artefato de verificação).

## Issues Encountered

- **Nenhuma co-migração foi necessária.** O plano previa a possibilidade de ajustar dois testes irmãos; a prova por `git diff -U0` mostrou que o seam é 100% aditivo, então ambos permaneceram intocados. Isso é o resultado esperado pelo requirement "Caminho real de geração reutilizado sem duplicação" → cenário "Pipeline de produção não muda de comportamento".
- **Arquivo de baseline** lido com sucesso (`75ab54cf23eee1a6a31b500a5a2646398aada6eb`); o guard valida o formato e falha explicitamente em BOM/UTF-16/linha vazia/ref inexistente.

## User Setup Required

None - no external service configuration required.

## Known Stubs

Nenhum. O guard é um script de verificação determinístico, sem valores vazios hardcoded que fluam para UI, sem placeholders e sem fontes de dados não conectadas.

## Threat Flags

Nenhum. O plano não introduz nova superfície de rede, autenticação, acesso a arquivos ou schema em fronteira de confiança — apenas um script de verificação read-only executado localmente.

## Next Phase Readiness

- **Pronto para o 48-1-14** (UAT local com IA real, migration remota deliberada e verificação final): a fase está provada aditiva e verde nos 4 gates (vitest/typecheck/lint/build) + guard de contrato com 0 violação.
- **Pendências herdadas pelo 48-1-14:** a migration `lab_*` ainda **não** foi aplicada no remoto (decisão D16: push deliberado após a UAT local) e `VENDEO_LAB_ENABLED=false` deve permanecer em produção.
- **Resíduo conhecido e aceito:** `docs/alinhamento-fase-44-temas-de-campanhas` continua não rastreado no working tree (frente F44, fora do escopo da F48.1) — o guard falha se ele entrar no diff/commits da fase.
- **Sem bloqueios** para a verificação da fase.

---

_Phase: 48.1-laboratorio-ia-minimo_
_Completed: 2026-09-16_
