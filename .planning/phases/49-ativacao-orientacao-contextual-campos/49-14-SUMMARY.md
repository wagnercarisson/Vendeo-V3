---
phase: 49-ativacao-orientacao-contextual-campos
plan: 14
subsystem: ui
tags: [field-guidance, microcopy, mandatory-artwork, gap-closure, presentation-only]

# Dependency graph
requires:
  - phase: 49-12
    provides: "Prova de não-mudança (59 hashes SHA-256) e 4 gates verdes"
  - phase: 49-13
    provides: "Checklist de UAT humana com o achado do cenário 7 (Informações obrigatórias na arte)"
provides:
  - "Fonte única MANDATORY_ARTWORK_HINT/MANDATORY_ARTWORK_PLACEHOLDER alinhada à decisão da UAT"
  - "Base OpenSpec (proposal/design/2 specs) e artefatos de planejamento (49-CONTEXT/49-PATTERNS) consistentes com as novas strings"
  - "Gap da UAT registrado em 49-UAT.md com comportamento observado × esperado"
  - "Reexecução dos 4 gates e da prova de 59 hashes (0 divergências) registrada em 49-GATES.txt"
affects: [49-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap closure de apresentação/conteúdo restrito à fonte única — consumidores herdam a mudança sem co-migração de testes"

key-files:
  created:
    - .planning/phases/49-ativacao-orientacao-contextual-campos/49-14-SUMMARY.md
  modified:
    - src/lib/campaign/field-guidance.ts
    - openspec/changes/fase-49-ativacao-orientacao-contextual-campos/proposal.md
    - openspec/changes/fase-49-ativacao-orientacao-contextual-campos/design.md
    - openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/mandatory-artwork-text/spec.md
    - openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/campaign-field-orientation/spec.md
    - .planning/phases/49-ativacao-orientacao-contextual-campos/49-CONTEXT.md
    - .planning/phases/49-ativacao-orientacao-contextual-campos/49-PATTERNS.md
    - .planning/phases/49-ativacao-orientacao-contextual-campos/49-UAT.md
    - .planning/phases/49-ativacao-orientacao-contextual-campos/49-GATES.txt
    - openspec/changes/fase-49-ativacao-orientacao-contextual-campos/tasks.md
    - .planning/ROADMAP.md
    - ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "Manter o label 'Informações obrigatórias na arte' — a alternativa 'Detalhes obrigatórios na arte' foi descartada porque o campo abrange características, detalhes e restrições"
  - "Placeholder passa a incluir uma restrição real ('Venda proibida para menores'), mantendo exatamente 3 linhas"
  - "Microcopy passa a citar 'restrições' e 'Use preferencialmente uma linha para cada item'"
  - "Fase NÃO marcada como Complete: permanece pendente da re-UAT humana do 49-13 (Task 2/3)"

patterns-established:
  - "Gap closure de conteúdo: alterar apenas a fonte única + base documental; os consumidores leem a constante (sem cópia divergente) e os testes não precisaram de co-migração"

requirements-completed: [mandatory-artwork-text, campaign-field-orientation]

# Metrics
duration: 6min
completed: 2026-09-18
---

# Phase 49 Plan 14: Gap Closure — Microcopy/Placeholder de Informações Obrigatórias na Arte Summary

**Correção de apresentação/conteúdo do campo "Informações obrigatórias na arte": a fonte única passa a citar restrições e o placeholder ganha uma restrição real ("Venda proibida para menores"), com base OpenSpec/planejamento alinhados, gap de UAT registrado e 4 gates + 59 hashes revalidados (0 divergências)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-18T21:44:35Z
- **Completed:** 2026-09-18T21:50:50Z
- **Tasks:** 3
- **Files modified:** 14 (1 de produção + 13 artefatos de documentação/planejamento)

## Accomplishments

- `src/lib/campaign/field-guidance.ts` (único arquivo de produção alterado): `MANDATORY_ARTWORK_HINT` = "Informe características, detalhes ou restrições que precisam aparecer na imagem. Use preferencialmente uma linha para cada item." e `MANDATORY_ARTWORK_PLACEHOLDER` = "Intensidade 8\nTorra clássica\nVenda proibida para menores" (3 linhas reais). Label e demais campos inalterados.
- Base OpenSpec alinhada (proposal/design/2 specs) e artefatos de planejamento (49-CONTEXT D10 + §specifics, 49-PATTERNS) consistentes com as novas strings.
- Gap da UAT registrado em `49-UAT.md` (cenário 7 — observado × esperado, decisão editorial 4.1, referência ao 49-14) e exemplo da pergunta atualizado.
- `49-GATES.txt` recebeu a seção "Reexecução pós-gap-closure (49-14)": 4 gates verdes (exit 0), 59/59 hashes protegidos idênticos ao baseline (0 divergências) e diff desde `SHA_INICIAL_F49` sem caminhos proibidos.
- Tracking sincronizado: ambos os roadmaps listam 14 planos com `13/14` executados; a fase permanece **pendente da re-UAT humana** (não marcada como Complete).

## Task Commits

Each task was committed atomically:

1. **Task 1: Corrigir a microcopy/placeholder e alinhar a base documental** — `ecdd9e26` (fix)
2. **Task 2: Reexecutar os 4 gates e a prova de não-mudança do 49-12** — `98b56620` (docs)
3. **Task 3: SUMMARY do plano e tracking (14 planos, fase pendente da re-UAT)** — `(este commit — SUMMARY + tracking)` (docs)

**Plan metadata:** `(este commit — SUMMARY + tracking + 49-14-PLAN.md)` (docs: complete gap-closure plan)

## Files Created/Modified

- `src/lib/campaign/field-guidance.ts` — microcopy/placeholder canônicos de "Informações obrigatórias na arte" (D10)
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/proposal.md` — seção de Informações obrigatórias na arte
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/design.md` — bloco D10 (microcopy/placeholder)
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/mandatory-artwork-text/spec.md` — requirement do componente
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/campaign-field-orientation/spec.md` — requirement de orientação
- `.planning/phases/49-ativacao-orientacao-contextual-campos/49-CONTEXT.md` — D10 e §specifics
- `.planning/phases/49-ativacao-orientacao-contextual-campos/49-PATTERNS.md` — bloco de mudanças D10/D11
- `.planning/phases/49-ativacao-orientacao-contextual-campos/49-UAT.md` — gap do cenário 7 (observado × esperado) + exemplo atualizado
- `.planning/phases/49-ativacao-orientacao-contextual-campos/49-GATES.txt` — seção "Reexecução pós-gap-closure (49-14)"
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/tasks.md` — 9.6 anotado como pendente de re-UAT (9.5–9.7 não marcados)
- `.planning/ROADMAP.md` / `ROADMAP.md` — 14 planos, `13/14` executados, fase **não** Complete
- `.planning/STATE.md` — 49-14 concluído, total da fase = 14, pendente da re-UAT

## Decisions Made

- **Label mantido:** "Informações obrigatórias na arte" (a alternativa "Detalhes obrigatórios na arte" foi descartada — o campo abrange características, detalhes **e** restrições).
- **Placeholder com restrição:** a terceira linha passa a ser `Venda proibida para menores`, mantendo exatamente 3 linhas reais.
- **Microcopy:** passa a citar "restrições" e "Use preferencialmente uma linha para cada item".
- **Fase não fechada:** a fase permanece pendente da re-UAT humana (49-13 Task 2/3); nenhum tracking marca `Complete`.

## Deviations from Plan

None - plan executed exactly as written.

- A verificação de grep confirmou que não restou a redação antiga da microcopy/placeholder fora dos planos/SUMMARIES históricos. As ocorrências remanescentes de `Peso líquido 500 g` são **valores de entrada de teste** (fixtures multi-linha), não a constante canônica — nenhuma co-migração de teste foi necessária (os testes importam as constantes e afirmam apenas o número de linhas).

## Issues Encountered

None. Os 4 gates passaram na primeira execução; a suíte completa ficou verde em duas execuções consecutivas (345 arquivos / 3660 testes + 1 skipped, exit 0).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Correção de apresentação/conteúdo concluída e rastreada; fences de não-mudança revalidadas.
- **Próximo passo obrigatório:** re-UAT humana de compreensão (49-13 Task 2/3) — só então o veredito final e o fechamento `N/N — Complete` (com `N` dinâmico, hoje 14).

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
