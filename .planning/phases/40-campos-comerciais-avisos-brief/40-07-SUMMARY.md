---
phase: 40-campos-comerciais-avisos-brief
plan: 07
subsystem: testing
tags: [prompt-reframe, golden, fixtures, image-generation, image-review, d6]

# Dependency graph
requires:
  - phase: 40-02
    provides: Constante única ILLUSTRATIVE_NOTICE_TEXT (literal singular canônico dos testes)
  - phase: 40-03
    provides: 4 prompts reframed (bloco condicional, SEMPRE removido)
provides:
  - Testes 16-17 (prompt-reframe.test.ts): SEMPRE ausente + bloco condicional + linha mantida nos 4 prompts; checks A (validade) e B (singular)
  - Teste 18 (9.3 prompt-side): legalNotice ausente → vars.mandatoryArtworkText === '' (spotlight/exclusive)
  - Teste 20 (9.5): golden offer com novos campos → EXPECTED_KEYS = 38 + vars.validity/mandatoryArtworkText
  - Fixtures plural→singular co-migradas (image-generation:242/255/272/339/349; image-review:193/199)
  - Cobertura reviewer-side Testes 18/19/21 verificada em blocos existentes (:225-240, :252-271, :273-294)
affects: [40-08 (route fixtures), 40-09 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [teste de conteúdo de prompt via fs.readFileSync, mapeamento de semântica tasks.md → testes existentes sem redefinição]

key-files:
  created: [src/lib/campaign/__tests__/prompt-reframe.test.ts]
  modified: [src/lib/image-generation/services/__tests__/image-generation-service.test.ts, src/lib/image-generation/services/__tests__/image-review-service.test.ts]

key-decisions:
  - "Teste 18 prompt-side criado como teste dedicado (não altera estrutura dos goldens 8.16) — aceito pelo plano (alternativa equivalente)"
  - "Testes 18/19/21 reviewer-side mapeados para blocos existentes sem reescrita (fonte da verdade tasks.md seção 9)"

patterns-established:
  - "Checks de conteúdo de prompt leem os arquivos .md reais (fs.readFileSync) — nunca mock"

requirements-completed: [F40-02, F40-11, F40-12, F40-13, F40-14, F40-15, F40-16]

# Metrics
duration: 22min
completed: 2026-08-14
---

# Plan 40-07: Testes 16-21 + Co-migração de Fixtures Summary

**Testes de prompt reframe (16-17) com leitura real dos 4 arquivos .md, Teste 18 (legalNotice off → mandatoryArtworkText vazio), Teste 20 (golden 38 keys com novos campos), co-migração plural→singular em image-generation-service.test.ts e image-review-service.test.ts, e cobertura reviewer-side dos Testes 18/19/21 verificada em blocos existentes**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-14T13:25:00Z
- **Completed:** 2026-08-14T13:47:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 novo, 2 co-migrados)

## Accomplishments
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` criado — Testes 16-17 + checks A/B: SEMPRE ausente nos 4, bloco condicional + linha mantida presentes nos 4, LINHA_VALIDADE em director/offer e ausente em spotlight/exclusive, singular via constante sem plural
- Teste 18 (9.3 prompt-side) — `it('9.3 legalNotice ausente → mandatoryArtworkText vazio no prompt (spotlight e exclusive)')`: `expect(vars.mandatoryArtworkText).toBe('')` nas 2 intents
- Teste 20 (9.5) — `it('9.5 golden offer com novos campos preenchidos mantém 38 keys (D6)')`: `toHaveLength(38)`, `EXPECTED_KEYS` sort igual, `vars.validity === 'até 30/09'`, `vars.mandatoryArtworkText === 'Imagem meramente ilustrativa'`
- Co-migração fixtures (10.2/10.3): image-generation-service.test.ts 5 ocorrências plural→singular (242/255/272/339/349); image-review-service.test.ts 2 ocorrências (193/199)
- Cobertura reviewer-side verificada (sem reescrita): Teste 18 → `:225-240` + `:252-260` (legalNoticeText '   ' e ausente → seção ''); Teste 19 → `:273-284` (validityText 'Até 30/09' → toContain) + `:286-294` (ausente → ''); Teste 21 → `:262-271` (singular → toContain) + `:188-205` (fidelidade semântica + CRITICA)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: prompt-reframe.test.ts — Testes 16-17 + checks A/B** - `1511527` (test)
2. **Task 2: Co-migração fixtures + Testes 18/20 — image-generation-service.test.ts** - `1511527` (test)
3. **Task 3: Co-migração fixtures — image-review-service.test.ts (10.3)** - `1511527` (test)

**Plan metadata:** `1511527` (test(40-07))

## Files Created/Modified
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` - Testes 16-17 + checks A/B (fs.readFileSync dos 4 prompts)
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - 5 fixtures plural→singular + Testes 18 e 20
- `src/lib/image-generation/services/__tests__/image-review-service.test.ts` - 2 fixtures plural→singular

## Decisions Made
- Teste 18 prompt-side como teste dedicado (em vez de adicionar asserts nos goldens 8.16) — o plano permite explicitamente a forma alternativa equivalente
- Testes 18/19/21 reviewer-side cobertos por testes existentes (mapeamento tabela do context), sem redefinição de semântica

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. As duas variantes aceitas pelo plano foram usadas conforme previsto (teste dedicado para 18; verificação para 19/21).

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Testes 16-21 prontos; fixtures de image-generation/review no singular canônico
- Verificações: `npx vitest run` dos 3 arquivos → 49/49; grep plural → 0 nos 2 arquivos co-migrados
- Próximo: 40-05 (ValidityField + seções D8), 40-06 (testes 1-15 + 8.8) e 40-08 (route fixtures + regressão)

---
*Phase: 40-campos-comerciais-avisos-brief*
*Completed: 2026-08-14*
