---
phase: 40-campos-comerciais-avisos-brief
plan: 06
subsystem: testing
tags: [validity, legal-notice, helpers, brief, d3, d4, d5]

# Dependency graph
requires:
  - phase: 40-04
    provides: Helpers exportados buildMandatoryArtworkText/buildValidityDisplayText/formatDDMM + body assembly + restore
provides:
  - Testes 1-8 (seção 7): displayText dos 6 modos + formatDDMM + endDate fora do body + preservação na troca de intent
  - Testes 9-15 (seção 8): 4 combinações checkbox×texto no body, default true, constante única sem divergência, migração legada + shape novo
  - Casos 8.8 no brief.test.ts: validity→displayText e mandatoryArtworkText→legalNotice.text via buildCampaignBriefFromFlat + ausência canônica
affects: [40-08 (regressão), 40-09 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [testes de helpers puros via renderHook + fetch mock (padrão nav test), teste 14 lê componentes reais via fs.readFileSync]

key-files:
  created: [src/components/flow/__tests__/use-campaign-form-validity.test.ts, src/components/flow/__tests__/use-campaign-form-notice.test.ts]
  modified: [src/lib/campaign/__tests__/brief.test.ts]

key-decisions:
  - "Teste 18 prompt-side coberto no 40-07; aqui cobre-se 1-15 e 8.8"
  - "8.8 usa buildCampaignBriefFromFlat (mapper puro da fronteira) — não mock do domínio"

patterns-established:
  - "Validade displayText 'nu' sem prefixo (D5) testado deterministicamente"
  - "Ausência canônica testada: campos ausentes nunca fabricados como { enabled: false }"

requirements-completed: [F40-01, F40-02, F40-04, F40-05, F40-06, F40-07, F40-08, F40-15]

# Metrics
duration: 25min
completed: 2026-08-14
---

# Plan 40-06: Testes 1-15 + Casos 8.8 Summary

**Suítes de teste da seção 7 (validade da oferta, testes 1-8) e seção 8 (checkbox ilustrativo × texto obrigatório, testes 9-15) criadas em dois arquivos novos, mais casos 8.8 de validity/legalNotice no brief.test.ts via buildCampaignBriefFromFlat**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-14T14:15:00Z
- **Completed:** 2026-08-14T14:40:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 novos, 1 estendido)

## Accomplishments
- `use-campaign-form-validity.test.ts` — testes 1-8 + bônus D4: buildValidityDisplayText (vazio/until-date/range/today/stock/custom com e sem prefixo), formatDDMM, body com `validity === 'até 30/09'` sem validityEndDate/StartDate, preservação de validade na troca de intent
- `use-campaign-form-notice.test.ts` — testes 9-15 + verificações: 4 combinações do body (constante / constante\\ntexto / só texto / ausente), default `showIllustrativeNotice: true`, teste 14 lê os componentes via fs.readFileSync (zero plural, zero placeholder hardcoded), buildMandatoryArtworkText 4 combinações, migração legada + restore de shape novo (free + espelho)
- `brief.test.ts` — casos 8.8: `buildCampaignBriefFromFlat({ validity: 'até 30/09' })` → `commercial.validity = { enabled: true, displayText }`; `mandatoryArtworkText` concatenado → `legalNotice.text` integral (nova linha preservada) + `getCampaignLegalNotice` retorna o valor; ausência canônica → ambos ausentes + helper undefined

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: use-campaign-form-validity.test.ts — testes 1-8** - `d6be71c` (test)
2. **Task 2: use-campaign-form-notice.test.ts — testes 9-15** - `d6be71c` (test)
3. **Task 3: brief.test.ts — casos 8.8** - `d6be71c` (test)

**Plan metadata:** `d6be71c` (test(40-06))

## Files Created/Modified
- `src/components/flow/__tests__/use-campaign-form-validity.test.ts` - Testes 1-8 + bônus D4 (9 it())
- `src/components/flow/__tests__/use-campaign-form-notice.test.ts` - Testes 9-15 + verificações (10 it())
- `src/lib/campaign/__tests__/brief.test.ts` - Casos 8.8 (3 it() + describe novo)

## Decisions Made
None - followed plan as specified. O padrão de renderHook + fetch stub do nav test foi reutilizado conforme previsto.

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Comportamento de D3/D4/D5 coberto deterministicamente; helper `buildMandatoryArtworkText` testado nas 4 combinações
- Verificações: 3 suítes → 43/43; typecheck exit 0
- Próximo: 40-08 (route fixtures + regressão completa)

---
*Phase: 40-campos-comerciais-avisos-brief*
*Completed: 2026-08-14*
