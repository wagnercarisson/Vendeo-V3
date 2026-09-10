---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 01
subsystem: docs
tags: [runbook, tracking, f37.2, renumbering, roadmap]

# Dependency graph
requires:
  - phase: 37.1-approval-gate-candidata-unica
    provides: F37.1 concluída (15/15 plans, 2379 testes, 4 gates verdes, UAT 6/6) + trackings da F37 em fatias 37.1/37.2/37.3
  - phase: fase-45-briefing-contextual-do-diretor-de-arte
    provides: F45 concluída (8/8 plans, 2427 testes) incorporada à branch da F37
provides:
  - 6 runbook files + ROADMAP raiz consistentes com a F37.2 realinhada (Correção Única por Não Conformidade) em execução (source of truth = pasta real `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`)
  - 37.3 eliminada dos trackings (consolidada na 37.2); zero resíduos de estado atual da antiga 37.2 ("Correção Visual/Criativa")
  - `.planning/ROADMAP.md` com "### Sub-fase 37.2 — Correção Única por Não Conformidade" (Em execução) e sem "### Sub-fase 37.3"
affects: [phase 37.2 execution (37-2-02..37-2-19), F37.2 verification/tracking]

# Tech tracking
tech-stack:
  added: []
  patterns: [grep-verification of runbook consistency, in-place markdown edits, chronological history preserved]

key-files:
  created: [.planning/phases/37.2-correcao-unica-por-nao-conformidade/37-2-01-SUMMARY.md]
  modified: [ROADMAP.md, .planning/ROADMAP.md, .planning/STATE.md, .planning/PROJECT.md, .planning/MILESTONES.md, .planning/REQUIREMENTS.md]

key-decisions:
  - "F37.2 realinhada (Correção Única por Não Conformidade) substitui a antiga 37.2 (Correção Visual Com Referência) e elimina a 37.3 (consolidada nesta fatia) — decisão do usuário 2026-09-10"
  - "Source of truth nos trackings = pasta real da fatia `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/` (padrão F37.1/F38.1), não a expressão guarda-chuva `fase-37-revisao-aprovacao-arte/`"
  - "current_phase: 37 mantido; F44 (Temas de Campanha) e Stripe/Monetização Pública permanecem fora da numeração"
  - "Notas históricas de fases concluídas e textos da fatia abandonada em docs/ não foram reescritos (apenas o estado atual dos trackers)"

patterns-established:
  - "Grep-verificação de resíduos de estado atual com padrões precisos (Correção Visual/Criativa, Correção Factual de Briefing, briefPatch → zero ocorrências) antes de declarar consistência"

requirements-completed: [F37.2-01]

# Metrics
duration: 25min
completed: 2026-09-10
---

# Phase 37.2 Plan 01: Trackings F37.2 realinhada Summary

**Trackings dos 6 runbooks + ROADMAP raiz alinhados à F37.2 realinhada (Correção Única por Não Conformidade) em execução, com source of truth = pasta real `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`, 37.3 eliminada (consolidada na 37.2) e zero resíduos de estado atual da antiga 37.2/37.3**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 2
- **Files modified:** 6 (ROADMAP raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `.planning/REQUIREMENTS.md`)

## Accomplishments

- **Task 1 — Grep-verificação (zero resíduos):** padrões de estado atual `Correção Visual/Criativa`, `Correção Factual de Briefing`, `briefPatch` executados nos 6 arquivos → **0 ocorrências** (saída "OK: zero residuos de antiga 37.2/37.3 no estado atual"). Pré-requisitos confirmados sem edição: `.planning/STATE.md` `current_phase: 37`; `.planning/ROADMAP.md` já continha "### Sub-fase 37.2 — Correção Única por Não Conformidade" (do commit de criação do plano) e **não** continha "### Sub-fase 37.3".
  - **Divergência encontrada e tratada:** o estado pré-existente dos trackers (após o commit de criação do plano `3988bde9`) já havia sido parcialmente atualizado para a 37.2 realinhada, diferindo do pré-estado assumido pelo PLAN. Aplicou-se o **mínimo delta** para atingir o estado final especificado (37.2 realinhada presente, 37.3 ausente, zero resíduos). Nenhuma alteração de design/escopo.
- **Task 2 — Preenchimento dos trackings:**
  - `.planning/ROADMAP.md`: nota "Phase numbering" com "fatias 37.1/37.2; 37.2 realinhada = Correção Única por Não Conformidade em execução; 37.3 eliminada" + fonte da F37.2; goal da Phase 37 ajustado para "fatias 37.1/37.2"; dependência "Antecede a 37.2 realinhada"; 37.1 goal "(37.2)"; **"### Sub-fase 37.2"** com **Status: Em execução — 19/19 plans (8 waves)** e renumeração sem a expressão antiga; rodapé "Last updated: 2026-09-10".
  - `ROADMAP.md` (raiz): linha da F37 atualizada para "37.1 CONCLUÍDA; 37.2 realinhada em execução; 37.3 eliminada"; nova sub-linha **37.2 = Correção Única por Não Conformidade (EM EXECUÇÃO)**; tabela Progress com linha `| 37.2. Correção Única por Não Conformidade | v1.5 | 0/19 | ◆ In progress | — |` e linha 37 ajustada. **Nenhuma linha 37.3 criada.**
  - `.planning/STATE.md`: `current_phase: 37` mantido; `stopped_at` atualizado; "Last updated" 2026-09-10; parágrafo da F37.2 realinhada inserido na seção Phase 37; "Current Position" e tabela de fases atualizadas. (Linhas com mojibake pré-existente foram editadas via script UTF-8 para não agravar a corrupção.)
  - `.planning/PROJECT.md`: bloco v1.5 + bloco F37 atualizados com a F37.2 realinhada em execução, source of truth e 37.3 eliminada; rodapé com nova entrada "Last updated: 2026-09-10" e o texto anterior preservado como "Histórico anterior".
  - `.planning/MILESTONES.md`: "In Progress" e "Known Gaps" atualizados para fatias 37.1/37.2, 37.2 realinhada em execução e 37.3 eliminada.
  - `.planning/REQUIREMENTS.md`: nota da seção F37 atualizada (fatias 37.1/37.2; 37.3 eliminada) + nova subseção **"Correção Única por Não Conformidade (F37.2) — em execução"** mapeando F37.2-01..19 para `37-2-CONTEXT.md`/`tasks.md`; **nenhuma linha F37.3**.
- **Verificação de aceitação:** `.planning/ROADMAP.md` contém "Correção Única por Não Conformidade" e não contém "### Sub-fase 37.3"; `.planning/STATE.md` com `current_phase: 37`; `.planning/PROJECT.md`/`MILESTONES.md` citam F37.2 realinhada + 37.3 eliminada; `.planning/REQUIREMENTS.md` cita F37.2-01..19; zero resíduos dos 3 padrões; nenhum tracking cita `fase-37-revisao-aprovacao-arte` como fonte da verdade da fatia.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Grep-verificação do estado atual dos trackings** — verificação apenas, sem edição (zero resíduos já confirmado); incluída no commit da Task 2
2. **Task 2: Atualizar os 6 trackings para a F37.2 realinhada + SUMMARY** — `(commit da Task 2)` (docs)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `ROADMAP.md` — linha F37 + sub-linha 37.2 + tabela Progress (raiz)
- `.planning/ROADMAP.md` — Phase numbering + goal Phase 37 + dependência + sub-fase 37.2 (Em execução) + rodapé
- `.planning/STATE.md` — `stopped_at` + Last updated + parágrafo F37.2 + Current Position + tabela de fases
- `.planning/PROJECT.md` — bloco v1.5 + bloco F37 + rodapé
- `.planning/MILESTONES.md` — In Progress + Known Gaps
- `.planning/REQUIREMENTS.md` — seção F37 + nova subseção F37.2
- `.planning/phases/37.2-correcao-unica-por-nao-conformidade/37-2-01-SUMMARY.md` — este registro

## Decisions Made

- D10 respeitado: migrations e trackings da F37.2 realinhada; source of truth = pasta real da fatia (decisão do usuário 2026-09-10); 37.3 eliminada; F44/Stripe fora da numeração
- `current_phase: 37` mantido (F37 permanece a fase ativa do milestone v1.5)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Estado pré-existente dos trackers já parcialmente atualizado (divergência de pré-estado)**

- **Found during:** Task 1 (grep-verificação)
- **Issue:** O PLAN assumia o pré-estado com "### Sub-fase 37.3" presente e o goal antigo da 37.2, mas o commit de criação do plano (`3988bde9`) já havia inserido a seção 37.2 realinhada e removido a 37.3, deixando resíduos parciais (line 6 "fatias 37.1/37.2/37.3", line 539 "correção factual de briefing", line 555 com a expressão antiga, além de referências em PROJECT/MILESTONES/STATE).
- **Fix:** Aplicado o mínimo delta para atingir o estado final especificado pelo PLAN/CONTEXT (37.2 realinhada presente, 37.3 eliminada, zero resíduos dos 3 padrões). Nenhuma mudança de escopo/design.
- **Files modified:** os 6 trackings.
- **Verification:** grep dos 3 padrões → 0 ocorrências; verify automatizado do PLAN (Task 2) verde.
- **Committed in:** commit da Task 2.

**2. [Rule 3 - Blocking] Mojibake pré-existente em linhas do `.planning/STATE.md`**

- **Found during:** Task 2 (edição do STATE.md)
- **Issue:** As linhas 554/555/749 do `STATE.md` contêm texto com mojibake armazenado (ex.: `RevisÃ£o`, `Ãšnica`, `CONCLUÃDA`), impossibilitando casamento exato por ferramenta de edição de texto.
- **Fix:** Edições dessas linhas realizadas por script Node.js lendo/gravando em UTF-8, com âncoras ASCII-only; o restante do arquivo preservado byte-a-byte.
- **Files modified:** `.planning/STATE.md`.
- **Verification:** leitura UTF-8 confirmou as substituições; `current_phase: 37` intacto.
- **Committed in:** commit da Task 2.

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Nenhum scope creep. Ambos necessários para atingir o estado final especificado com os trackers já parcialmente modificados e com corrupção de encoding pré-existente.

## Issues Encountered

Nenhum bloqueio. A divergência de pré-estado foi resolvida por mínimo delta; a corrupção de encoding pré-existente foi contornada sem agravá-la.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 37-2-01 (trackings) completo — base de tracking alinhada com a fonte da verdade `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`
- Próximo: **37-2-02** (M1 — tabelas `campaign_correction_reports`/`campaign_correction_submissions` + troca do CHECK `asset_status` (`superseded`) + **db push [BLOCKING]**) — requer Supabase linkado (`SUPABASE_ACCESS_TOKEN`); plano com `autonomous: false`
- Sem gates de CI neste plano (markdown apenas; verificação por grep)

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
