---
phase: 41-midia-de-campanha-mobile
plan: 03
subsystem: prompts
tags: [prompts, director, multimodal, golden]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D6 bloco descritivo 1+N referências + F41-23/F41-24 (golden 38 keys preservado)
provides:
  - 4 prompts do diretor com bloco descritivo 1+N (hardcoded, sem variável nova)
  - Linha de proteção factual intacta nos 4 prompts
  - Golden EXPECTED_KEYS = 38 por intent validado (regressão D6)
affects: [41-11 (teste 21 — bloco presente nos 4 prompts)]

# Tech tracking
tech-stack:
  added: []
  patterns: [bloco descritivo hardcoded sem placeholder novo, input multimodal em vez de variável textual]

key-files:
  created: []
  modified: [prompts/campaign-image-director.md, prompts/campaign-image-director-offer.md, prompts/campaign-image-director-spotlight.md, prompts/campaign-image-director-exclusive.md]

key-decisions:
  - "D6: as imagens entram como input multimodal, não como variável textual — o texto do prompt muda intencionalmente, o conjunto de variáveis (38 keys) não"

requirements-completed: [F41-23, F41-24]

# Metrics
duration: 20min
completed: 2026-08-15
---

# Plan 41-03: Prompts do Diretor — Bloco Descritivo 1+N Summary

**Linha única de referência de imagem substituída pelo bloco descritivo 1+N (1 imagem principal/herói visual + N auxiliares/contexto) nos 4 prompts do diretor, hardcoded e sem variável nova (D6); golden EXPECTED_KEYS = 38 por intent preservado**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-15T17:25:00Z
- **Completed:** 2026-08-15T17:45:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- **4 prompts do diretor** (`campaign-image-director.md:49`, `-offer.md:49`, `-spotlight.md:47`, `-exclusive.md:46`): a linha única `7. **Imagem de referência do produto:** A imagem do produto foi enviada como referência visual fiel...` (numeração `6.` no exclusive) virou o bloco descritivo 1+N:
  `- **Imagens de referência do produto:** Foram enviadas 1 imagem principal (herói visual da composição) e N imagens auxiliares de referência (contexto: ângulos, variações, combos). Use a imagem principal como base fiel do produto {{productName}}. Use as imagens auxiliares apenas como contexto visual — NÃO invente conteúdo, detalhes ou ângulos que não estejam nelas.`
- **Numeração subsequente preservada** (`8. **Identidade da loja:**` nos 3 primeiros; `7.`/`8.` no exclusive)
- **Linha de proteção factual** "A imagem do produto é uma referência factual protegida." **intacta** nos 4 (director:111, offer:112, spotlight:110, exclusive:119)
- **Zero variáveis novas** — única variável no bloco é `{{productName}}` (pré-existente); golden `EXPECTED_KEYS = 38` por intent permanece válido (D6)

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | Substituir linha única pelo bloco 1+N nos 4 prompts | `bdd6827` |
| 2 | Verificar golden EXPECTED_KEYS = 38 por intent | (sem commit — verificação apenas) |

## Files Created/Modified
- `prompts/campaign-image-director.md` - bloco 1+N
- `prompts/campaign-image-director-offer.md` - bloco 1+N
- `prompts/campaign-image-director-spotlight.md` - bloco 1+N
- `prompts/campaign-image-director-exclusive.md` - bloco 1+N

## Validation

- Grep `referência visual fiel` nos 4 prompts → **0 ocorrências** (linha antiga removida)
- Grep `1 imagem principal` → **1 ocorrência por arquivo** (bloco presente)
- Grep `referência factual protegida` → **1 ocorrência por arquivo** (proteção intacta)
- Grep `{{productImages`/`{{auxiliar` → **0 ocorrências** (sem variável nova)
- **Golden:** `image-generation-service.test.ts` → **25 passed** (inclui 8.16 offer/spotlight/exclusive e 9.5 com `toHaveLength(38)`)
- **Prompt reframe:** `prompt-reframe.test.ts` → **4 passed**
- Nenhuma modificação em `image-generation-service.test.ts` (EXPECTED_KEYS = 38 preservado — D6)

## Decisions Made
None - followed plan as specified (D6: texto do prompt muda, conjunto de variáveis não)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- 41-03 (prompts 1+N) completo — os 4 diretores descrevem a presença de imagens primária + auxiliares
- Próximo: 41-05 (provider/service N input_image) e 41-11 (teste 21 valida o bloco presente)
- Sem migrations, sem gates de CI nesta task (markdown apenas + testes golden verdes)

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
