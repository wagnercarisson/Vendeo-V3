---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-08
subsystem: ui
tags: [react, nextjs, bench, preflight, policies, prompt-base, identity, attempts, zod]

# Dependency graph
requires:
  - phase: 48.2.4
    provides: policies versionadas, prompt-base padrão, resolução fail-closed, revalidação server-side do preflight, transporte canônico de identidade, linhagem de tentativas e API administrativa da bancada (planos 01–07)
provides:
  - Painel read-only de políticas/versões + versão do compositor e do prompt-base padrão
  - Prompt-base padrão semeado no editor por props iniciais (reposição explícita, nunca automática)
  - Versões exibidas no preflight e invalidação reforçada (prompt-base/config/modelo-qualidade)
  - BenchPreflightEvidenceView/preflightEvidence alinhados ao BenchPreflightEvidenceSchema estrito (presetId, config canônica, policyVersions, promptBaseVersion, identityReference)
  - Painel de tentativas por linhagem + CTA "Nova tentativa"
  - Linha da referência canônica de identidade (sem URL assinada) e evidências com custo calculado × reportado separados
affects: [48.2.4 verificação, UAT técnico/comercial da bancada]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Props iniciais resolvidas server-side (page.tsx) para o padrão/políticas — UI não espera POST /compose para exibir o padrão"
    - "Evidência do preflight capturada na aprovação com todos os campos do schema estrito"
    - "Componentes de painel presentacionais reutilizando card/badge/button e DataRow local"

key-files:
  created:
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-policies-panel.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-attempts-panel.tsx
  modified:
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-preflight-panel.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-prompt-editor.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-branding-panel.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-evidence-panel.tsx
    - src/app/(app)/admin/laboratorio/bancada/page.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx

key-decisions:
  - "O prompt-base padrão é resolvido server-side a partir de DEFAULT_BENCH_CONFIG e entregue como prop inicial; o editor é semeado na abertura e a reposição é explícita (botão)."
  - "A config canônica da evidência é montada no workbench a partir dos defaults do registry + modelo/qualidade do preset selecionado — idêntica à resolução server-side de POST /runs."
  - "A identidade transportada é exibida/evidenciada apenas como { kind, variantType, storagePath }, sem URL assinada."

patterns-established:
  - "Painel de políticas/versões: lista id+versão em JetBrains Mono, somente leitura"
  - "Tentativas por linhagem com empty state e CTA que cria novo draft via POST /runs/[id]/attempts"

requirements-completed: ["cap: lab-admin-ui", "spec: lab-admin-ui", "spec: lab-bench-prompt-base", "D16", "tasks: 8.5, 8.6, 8.7"]

# Metrics
duration: 8min
completed: 2026-09-30
---

# Phase 48.2.4 Plan 08: UI da bancada — políticas/versões, prompt-base padrão, identidade e tentativas

**Bancada evoluída (mesma rota, desktop-only) exibindo políticas/versões e prompt-base padrão editável, referência canônica de identidade, evidências com custos separados e tentativas por linhagem com "Nova tentativa", com evidência de preflight alinhada ao schema estrito.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-30T13:20:00Z
- **Completed:** 2026-09-30T13:28:00Z
- **Tasks:** 3
- **Files modified:** 9 (2 criados, 7 modificados)

## Accomplishments
- Painel read-only de políticas habilitadas (id + versão), versão do compositor e versão do prompt-base padrão.
- Prompt-base padrão resolvido server-side e semeado no editor por props iniciais; reposição explícita via botão (nunca automática).
- `invalidatePreflight` reforçado (prompt-base, configuração multidimensional e modelo/qualidade) e versões exibidas no preflight.
- `BenchPreflightEvidenceView`/`preflightEvidence` alinhados ao `BenchPreflightEvidenceSchema` estrito (`presetId`, `config`, `policyVersions`, `promptBaseVersion`, `identityReference`), evitando 400 por campo ausente em `POST /runs`.
- Referência canônica de identidade (`{ kind, variantType, storagePath }`, sem URL assinada) e evidências com `prompt_sent`, prompt-base usado, versões e custo calculado × reportado separados.
- Painel de tentativas por linhagem + CTA "Nova tentativa" (cria novo draft reaproveitando as entradas).

## Task Commits

Each task was committed atomically:

1. **Task 1: Painel de políticas/versões e prompt-base padrão editável** - `a8f9d8f8` (feat)
2. **Task 2: Identidade + tentativas + "Nova tentativa" + invalidação reforçada** - `6984cdc9` (feat)
3. **Task 3: Testes de UI** - `bb24a2d5` (test)

**Plan metadata:** `pending` (docs: complete plan)

## Files Created/Modified
- `bench-policies-panel.tsx` (novo) - painel read-only de políticas/versões + versão do compositor/prompt-base padrão.
- `bench-attempts-panel.tsx` (novo) - lista de tentativas por linhagem + CTA "Nova tentativa" (empty state).
- `bench-workbench.tsx` - estado de políticas/versões/prompt-base/identidade/tentativas; evidência estrita; invalidação reforçada; "Nova tentativa".
- `bench-preflight-panel.tsx` - `BenchPreflightEvidenceView` estendida + exibição das versões.
- `bench-prompt-editor.tsx` - semeadura pelo padrão e reposição explícita.
- `bench-branding-panel.tsx` - linha "Identidade enviada ao modelo" (sem URL assinada).
- `bench-evidence-panel.tsx` - prompt-base usado, versões, custo reportado separado.
- `page.tsx` - resolução server-side do prompt-base padrão/versão e políticas como props iniciais.
- `__tests__/bench-ui.contract.test.tsx` - 14 novos testes de contrato (39 no total).

## Decisions Made
- Config canônica da evidência montada no workbench a partir dos defaults do registry + modelo/qualidade do preset — mesma forma resolvida pelo servidor em `POST /runs` (`resolveBenchConfig({ ...DEFAULT_BENCH_CONFIG, modelo, qualidade })`).
- O prompt-base padrão é resolvido por `resolveBenchDefaultPromptBase(DEFAULT_BENCH_CONFIG)` no server component (o recorte não depende de modelo/qualidade) e entregue como props iniciais.
- Testes validam a fixture `PREFLIGHT_EVIDENCE` diretamente contra `BenchPreflightEvidenceSchema` (strict) e o corpo do `POST /runs`.

## Deviations from Plan

None - plan executed exactly as written. (Nota de sequenciamento: `bench-workbench.tsx` é listado em ambas as tasks; por conter a fiação das duas, foi commitado na Task 1, e `page.tsx` na Task 2, conforme os `files` do plano.)

## Issues Encountered
- `bench-execution.contract.test.ts` apresentou timeouts de 5s no ambiente (processamento de imagem com `sharp`); **pré-existente e não relacionado** a este plano (não toca `src/lib/lab/bench/execution/**`). Todos os 23 testes passam com `--testTimeout=60000`.
- Comentários dos novos componentes foram redigidos sem os literais proibidos (comparação/votação/ranking) para satisfazer as guardas de contrato da UI.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI da bancada pronta para verificação da fase (`npm run typecheck` exit 0; `bench-ui.contract.test.tsx` verde com 39 testes).
- Nenhuma dependência nova de UI; desktop-only; sem comparação lado a lado/votação/ranking.
- STATE.md/ROADMAP.md não foram alterados (o orquestrador é o dono dessas escritas).

## Self-Check: PASSED

---
*Phase: 48.2.4-experimento-deterministico-oferta-1-1*
*Completed: 2026-09-30*
