---
phase: 48.2.6-validacao-experimental-produto-intencoes-1-1
plan: 04
subsystem: bench-ui
tags: [bench-ui, intent-matrix, validity, preflight]
requires:
  - phase: 48.2.6
    provides: Shared intent-price validation and schema/snapshot guards from plans 02–03
provides:
  - Explicit compatible intent selection without automatic price-driven changes
  - Preserved validity with explicit removal and commercial state blocking
  - Preflight invalidation for commercial edits while execution-only preset changes preserve approval
affects: [bench-ui, bench-compose, bench-run]
tech-stack:
  added: []
  patterns: [UI delegates commercial validation to shared bench-domain authority]
key-files:
  created: []
  modified:
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-campaign-form.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx
    - src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx
key-decisions:
  - "Price edits preserve current intent; an incompatible selection blocks composition until the user explicitly chooses a compatible intent."
  - "Validity values remain visible/preserved outside Oferta and require explicit removal before compose/run."
  - "Preset/model/quality changes preserve approved text; commercial changes invalidate preflight."
patterns-established:
  - "Bench UI reads available/valid intent from intent-price-matrix.ts and leaves server-side validation authoritative."
requirements-completed: [lab-bench-intent-validation, lab-bench-form-parity, lab-bench-prompt-preflight]
duration: 12min
completed: 2026-10-02
---

# Phase 48.2.6 Plan 04: Escolha explícita e preflight comercial Summary

**A UI da bancada agora preserva preço, intenção e validade durante incompatibilidades, exige correção explícita e bloqueia compose/estimate/run até o estado comercial ficar válido.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-02T20:43:00-03:00
- **Completed:** 2026-10-02T20:55:00-03:00
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- O formulário usa `availableBenchIntents`; editar preço já não reescreve intenção nem apaga valores comerciais.
- Incompatibilidade mostra as opções válidas ou instrução para corrigir preço original isolado.
- Ao trocar para Destaque/Exclusivo, validade fica visível e preservada; o operador tem ação explícita para removê-la.
- Workbench bloqueia composição/aprovação e execução em estado incompatível, incluindo validade fora de Oferta.
- Edições comerciais invalidam a aprovação; troca exclusiva de preset/modelo/qualidade mantém o prompt aprovado byte a byte.
- Testes UI verificam escolha preservada, regularização explícita, bloqueio de effects e caminho de configuração de execução.

## Task Commits

1. **Task 1: Exigir escolha explícita na edição comercial** — `88ce08bc`.
2. **Task 2: Invalidar evidência comercial e preservar aprovação por preset** — `f0461ece`.

**Plan metadata:** pending

## Files Created/Modified

- `bench-campaign-form.tsx` — opções comuns da matriz, preservação de seleção/validade e ações claras de resolução.
- `bench-workbench.tsx` — guard comercial antes de compose/approve/run, invalidando composição em mudanças comerciais.
- `bench-ui.contract.test.tsx` — contratos de preço/intenção/validade, preflight e configuração de execução.

## Decisions Made

- Uma alteração de preço não reinterpreta a intenção escolhida. Se incompatível, UI conserva a escolha e pede nova seleção.
- A validade não é descartada na troca de intenção; remoção é ação explícita e limpa os campos de validade no estado da bancada.
- A UI apenas replica o uso do contrato puro da bancada; APIs/schema seguem autoridade final.

## Deviations from Plan

None - plan executed within the listed bench UI/test files and approved behavior.

## Issues Encountered

- A primeira tentativa delegada interrompeu antes de editar por interpretar `bench-workbench.tsx` como fora de escopo. O arquivo está listado no Plano 04; o artefato e os testes foram executados inline conforme o plano. Nenhum arquivo foi alterado pela tentativa interrompida.

## Verification

- `npm.cmd test -- --run "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"` — PASS, **66 testes**.
- `npm.cmd run typecheck` — PASS.
- `git diff --check` — PASS.
- Protected production/provider/database/migration paths from BASE_SHA — sem alterações.
- Nenhuma leitura remota, consulta/provider, geração paga ou `db push`.

## Self-Check: PASSED

## Next Phase Readiness

- Plan 05 pode integrar o mesmo guard às rotas `/compose` e `/runs`, com preflight stale recusado antes de persistência/CAS/provider.
- CHECKPOINT A continua condicionado aos planos 05–07. Não avançar aos Planos 09–10 sem aprovação humana.

---
*Phase: 48.2.6-validacao-experimental-produto-intencoes-1-1*
*Completed: 2026-10-02*
