---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 10
subsystem: ui
tags: [react, modal, ndjson, f37.2, accessibility]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 07
    provides: rota problem-report (JSON guidance / NDJSON stream)
provides:
  - campaign-problem-modal.tsx (modal de 1 etapa)
  - campaign-approval-view.tsx com [Aprovar arte] + [Informar problema]
affects: [37-2-11 (page/client), 37-2-17 (testes UI)]

# Tech tracking
tech-stack:
  added: []
  patterns: [modal acessível role=dialog/aria-modal, ramificação Content-Type (JSON × NDJSON), leitura de stream getReader/TextDecoder]

key-files:
  created: [src/components/campaign/campaign-problem-modal.tsx]
  modified: [src/components/campaign/campaign-approval-view.tsx, src/__tests__/api/campaign-approval-view.test.tsx, src/__tests__/api/campaign-page.test.tsx]

key-decisions:
  - "Modal ramifica por Content-Type: application/x-ndjson consome o stream (getReader/TextDecoder) até done/error; application/json exibe guidance"
  - "Durante o processamento o modal não fecha (ESC/backdrop/X/Cancelar bloqueados); em done → router.refresh() + onClose()"
  - "Vazio/só pontuação validado no clique (regex Unicode) — sem chamar a API"
  - "[Aprovar arte] desabilitado com caso em processamento (approvalDisabled); [Informar problema] só quando showProblemReport"

patterns-established:
  - "UI de revisão com dois caminhos; modal de relato a11y (role=dialog, aria-modal, touch ≥ 44px, object-contain)"

requirements-completed: [F37.2-10]

# Metrics
duration: 45min
completed: 2026-09-10
---

# Phase 37.2 Plan 10: UI do Relato de Problema Summary

**Modal "Informar problema" de 1 etapa (preview + orientação corrigível×não + textarea obrigatório, envio com ramificação JSON/NDJSON) e evolução da revisão com [Aprovar arte] + [Informar problema] e guarda de UX**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 (2 arquivos)
- **Files modified:** 4

## Accomplishments

- **Task 1 — Modal:** `campaign-problem-modal.tsx` com `role="dialog"`/`aria-modal`, preview da candidata (`object-contain`), orientação do que é/não é corrigível, `label` "Descreva o problema na arte" + textarea obrigatório, botões [Enviar para análise]/[Cancelar], touch ≥ 44px e tema dark.
- **Task 2 — Fechamentos/validação/envio:** [Cancelar]/X/ESC/backdrop fecham sem efeito (bloqueados durante processamento); validação no clique de vazio/pontuação (sem API); envio ramifica por `Content-Type` — **JSON** exibe `analysisState`/`guidance`; **NDJSON** é consumido (`getReader`/`TextDecoder`, fases `input_validation`/`image_generation`/`done`/`error`) com `router.refresh()` + `onClose()` no `done`.
- **Task 3 — View:** dois botões (`Aprovar arte` primário + `Informar problema` secundário via `showProblemReport`), `approvalDisabled` desabilita ambos com caso em processamento; v2 sem [Informar problema]; microcopy/a11y/tema.

## Task Commits

1. **Task 1 + Task 2: modal** — `b68b28d1` (feat)
2. **Task 3: view + co-migração de testes** — `9ed679ad` (feat)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/components/campaign/campaign-problem-modal.tsx` — modal de relato (novo)
- `src/components/campaign/campaign-approval-view.tsx` — dois botões + guarda de UX
- `src/__tests__/api/campaign-approval-view.test.tsx` / `campaign-page.test.tsx` — co-migração do rótulo do botão primário

## Decisions Made

- Modal não fecha durante o processamento para não abandonar o stream.
- `showProblemReport`/`approvalDisabled` são props opcionais (default false) — a página (37-2-11) passa os valores derivados do estado.
- Rótulo do botão primário alterado para "Aprovar arte" (spec R1), co-migrando os testes existentes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Testes existentes assertavam o rótulo antigo do botão primário**
- **Found during:** Task 3
- **Issue:** `campaign-approval-view.test.tsx`/`campaign-page.test.tsx` usavam `/aprovar e liberar campanha/i`; o spec define o primário como "Aprovar arte".
- **Fix:** regexes atualizadas para `/aprovar arte/i` (4 asserções).
- **Files modified:** os 2 arquivos de teste.
- **Verification:** `npx vitest run` dos 2 arquivos → 13/13.
- **Committed in:** `9ed679ad`.

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Co-migração necessária; sem scope creep.

## Issues Encountered

Nenhum bloqueio. Typecheck limpo; testes 13/13.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Modal e view prontos; a página (37-2-11) deve passar `showProblemReport` (v1 sem consumo) e `approvalDisabled` (`regenerating`).
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
