---
phase: 40-campos-comerciais-avisos-brief
plan: 03
subsystem: ai
tags: [prompt, image-director, d6, reframe, legal-notice]

# Dependency graph
requires:
  - phase: fase-40-campos-comerciais-avisos-brief
    provides: D6 decision — remover hardcode incondicional → bloco condicional de composição
provides:
  - 4 prompts de direção de imagem sem a imposição "SEMPRE acrescente ... 'Imagem meramente ilustrativa'"
  - Bloco condicional de composição nos 4 prompts (exibir exatamente o texto informado; tipografia mínima em área lateral)
  - Linhas condicionais de {{mandatoryArtworkText}} e de validade intactas
affects: [40-07 (testes 16-17 prompt reframe + checks de conteúdo), 40-09 (UAT item 6)]

# Tech tracking
tech-stack:
  added: []
  patterns: [prompt engineering — instrução condicional em vez de imposição fixa; diff mínimo 1:1 por arquivo]

key-files:
  created: []
  modified: [prompts/campaign-image-director.md, prompts/campaign-image-director-offer.md, prompts/campaign-image-director-spotlight.md, prompts/campaign-image-director-exclusive.md]

key-decisions:
  - "D6: remover 'SEMPRE acrescente ... Imagem meramente ilustrativa' e inserir bloco condicional (exatamente o texto do CONTEXT :171-174)"
  - "Linha condicional do campo {{mandatoryArtworkText}} mantida nos 4; linhas de validade {{validity}} intactas (D5)"

patterns-established:
  - "Reframe de prompt: instrução condicional substitui imposição incondicional mantendo a inteligência visual do UAT-3"

requirements-completed: [F40-11, F40-12, F40-13]

# Metrics
duration: 12min
completed: 2026-08-14
---

# Plan 40-03: Reframe do Aviso Ilustrativo nos 4 Prompts Summary

**Reframe D6 aplicado nos 4 prompts do diretor de imagem: a imposição incondicional "SEMPRE acrescente ... 'Imagem meramente ilustrativa'" substituída pelo bloco condicional de composição, com a linha condicional do campo {{mandatoryArtworkText}} e as linhas de validade intactas**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-14T12:40:00Z
- **Completed:** 2026-08-14T12:52:00Z
- **Tasks:** 3
- **Files modified:** 4 (todas prompts de direção de imagem)

## Accomplishments
- Substituição exata (1 linha → 1 linha) nos 4 arquivos: `prompts/campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md`
- Bloco condicional inserido (texto exato do CONTEXT): "Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte. Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço."
- Verificações: `SEMPRE acrescente` → 0 em todos os 4; bloco condicional → 1 em cada; linha condicional do campo `{{mandatoryArtworkText}}` → 1 em cada (F40-12); `**Validade da oferta:** {{validity}}` intacta em director.md:82 e offer.md:83, ausente em spotlight/exclusive (estrutura original, D5)
- Diff mínimo confirmado: `git diff --stat prompts/` → 4 arquivos, 4 inserções + 4 remoções (nada além)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: campaign-image-director.md** - `5140348` (feat)
2. **Task 2: campaign-image-director-offer.md** - `5140348` (feat)
3. **Task 3: spotlight + exclusive** - `5140348` (feat)

**Plan metadata:** `5140348` (feat(40-03))

## Files Created/Modified
- `prompts/campaign-image-director.md` - Linha SEMPRE → bloco condicional (linha 130)
- `prompts/campaign-image-director-offer.md` - Idem (linha 131)
- `prompts/campaign-image-director-spotlight.md` - Idem (linha 129)
- `prompts/campaign-image-director-exclusive.md` - Idem (linha 138)

## Decisions Made
None - followed plan as specified (D6). O texto exato do bloco condicional veio do CONTEXT (`:171-174`), sem variação.

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Os 4 prompts reframed prontos para os Testes 16-17 (40-07) que garantem ausência do SEMPRE e presença do bloco condicional
- O conjunto de variáveis/keys permanece idêntico (EXPECTED_KEYS = 38 será verificado no 40-07 Teste 20)
- Próximo: 40-04 (form state + helpers + body assembly)

---
*Phase: 40-campos-comerciais-avisos-brief*
*Completed: 2026-08-14*
