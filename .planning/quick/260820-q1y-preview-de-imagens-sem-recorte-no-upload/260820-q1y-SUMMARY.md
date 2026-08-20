---
phase: 260820-q1y-preview-de-imagens-sem-recorte-no-upload
plan: 01
subsystem: ui
tags: [campaign-image-upload, preview, object-contain, aspect-square, css-only, react-testing-library]

# Dependency graph
requires:
  - phase: 41-midia-de-campanha-mobile
    provides: CampaignImageUpload multi-imagem com grid grid-cols-3, badges Principal/Câmera, botão Remover, resolveSrc
provides:
  - "Preview de upload sem recorte: célula aspect-square + bg-bg-elevated + img object-contain"
  - "Teste render do componente real (sem mock) travando object-contain/ausência de object-cover, badges e onRemove(id)"
affects: [verificação humana opcional do preview no formulário de campanha]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thumb object-contain do repo (visual-signature-approval-modal.tsx:607): container `aspect-square rounded-lg overflow-hidden bg-bg-elevated border border-border-light relative` + img `w-full h-full object-contain` aplicado ao preview do upload"
    - "Teste render de componente real com `within(preview)` para desambiguar texto 'Câmera' (badge vs botão da área de ações)"

key-files:
  created:
    - src/components/flow/__tests__/campaign-image-upload.test.tsx
  modified:
    - src/components/flow/campaign-image-upload.tsx

key-decisions:
  - "Célula do preview migrada de h-20 (80px) para aspect-square com bg-bg-elevated — padrão repo (visual-signature-approval-modal.tsx:607); fotos verticais 9:16 ganham altura útil e a área neutra distribui ao redor da imagem"
  - "object-cover → object-contain no <img>: imagem inteira visível sem corte, alinhado aos demais thumbs do repo"
  - "Zero mudança de lógica: resolveSrc, objectUrls, handlers onAdd/onRemove, props, grid e MAX_CAMPAIGN_IMAGES intocados"

patterns-established:
  - "Preview de imagem do upload segue o mesmo padrão visual dos thumbs de assinatura visual (aspect-square + object-contain + bg-bg-elevated)"

requirements-completed: [Q1Y-UI-01]

# Metrics
duration: 6min
completed: 2026-08-20
---

# Quick 260820-q1y: Preview de Imagens Sem Recorte no Upload Summary

**Preview do upload de campanha migrado de `object-cover` (corte de fotos verticais/horizontais) para `object-contain` em célula `aspect-square` com fundo `bg-bg-elevated`, seguindo o padrão de thumb do repo — mudança estritamente de classes CSS, com 5 testes de render do componente real travando o novo comportamento e badges/onRemove intactos**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-20T19:05:00Z (aproximado)
- **Completed:** 2026-08-20T19:07:00Z (aproximado)
- **Tasks:** 3 (2 com commit, 1 verificação)
- **Files modified:** 2 (1 componente + 1 teste novo)

## Accomplishments
- Preview do `CampaignImageUpload` mostra a imagem inteira sem corte: container do item agora `relative rounded-lg overflow-hidden bg-bg-elevated border border-border-light aspect-square` e `<img>` `w-full h-full object-contain` (padrão exato de visual-signature-approval-modal.tsx:607)
- Teste render novo (5 testes) importa e renderiza o componente REAL (sem mock): object-contain presente / object-cover ausente, badges Principal e Câmera dentro do preview (`within(preview)`), botão Remover por item chamando `onRemove("img-1")`, e smoke de estado vazio + erro com contrato de props inalterado
- Regressão completa: 3 testes irmãos que mockam `CampaignImageUpload: () => null` passam SEM alteração, typecheck e lint limpos, diff restrito aos 2 arquivos do plano

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Trocar preview para célula aspect-square + object-contain** - `594bf37c` (feat)
2. **Task 2: Criar teste render do preview (object-contain, badges, onRemove)** - `87f40a1c` (test)
3. **Task 3: Gates de regressão — testes irmãos + typecheck + lint** - verificação, sem commit próprio

## Files Created/Modified
- `src/components/flow/campaign-image-upload.tsx` - Preview: container ganhou `bg-bg-elevated` + `aspect-square`; `<img>` trocou `h-20 object-cover` por `h-full object-contain`. Nenhuma outra alteração (lógica, handlers, props, grid intactos)
- `src/components/flow/__tests__/campaign-image-upload.test.tsx` - Novo: 2 describes ("preview sem recorte (Q1Y)" com 4 testes + "contrato preservado (Q1Y)" com 1 smoke), componente real renderizado, `URL.createObjectURL`/`revokeObjectURL` stubbed como safety net (jsdom 29 não implementa de forma confiável)

## Decisions Made
- **Célula quadrada `aspect-square` em vez de manter `h-20`:** fotos 9:16 contidas em 80px de altura teriam só ~45px de largura útil; `aspect-square` distribui a área neutra ao redor e dá mais altura útil ao caso mais comum (mobile vertical). Impacto no grid aceito: com 4 imagens (3+1) a 4ª segue na linha seguinte com 2 células vazias — comportamento idêntico ao atual, só célula maior
- **`bg-bg-elevated` no container:** fundo sólido escuro (`#1E293B`) para a área neutra do `object-contain`, evitando sobras transparentes inconsistentes com o tema

## Deviations from Plan

None - plan executed exactly as written. As 3 tasks foram executadas na ordem, verificações automatizadas passaram em todas (zero `object-cover` no componente; 5/5 testes do arquivo novo; 9 testes irmãos; typecheck exit 0; lint exit 0; `git diff --stat` com exatamente os 2 arquivos do plano).

## Issues Encountered
- `rg` não está no PATH do ambiente Windows — a verificação da Task 1 foi feita com a ferramenta de busca de conteúdo equivalente (grep) no arquivo-alvo, com o mesmo resultado esperado pelo plano (zero `object-cover`; `object-contain`/`aspect-square`/`bg-bg-elevated` presentes nas linhas 82 e 87)
- PowerShell 5.1 não permite pipeline direto de `npm` (`npm.cmd`) — os gates da Task 3 foram executados via `cmd /c` e vitest direto via `npx vitest run`, produzindo os mesmos comandos do plano

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Preview sem recorte pronto para verificação humana opcional: adicionar foto vertical de mobile no formulário e conferir que o produto aparece completo na célula quadrada
- Badges "Principal"/"Câmera" e botão "Remover" cobertos por teste automatizado (não regrediram)
- Nenhum blocker; escopo proibido (pipeline, reviewer, director, compressão, HEIC/EXIF, schema, rota, storage, limites, copy) intocado

## Self-Check: PASSED

- FOUND: `src/components/flow/campaign-image-upload.tsx` (modificado)
- FOUND: `src/components/flow/__tests__/campaign-image-upload.test.tsx` (criado)
- FOUND: `.planning/quick/260820-q1y-preview-de-imagens-sem-recorte-no-upload/260820-q1y-SUMMARY.md`
- FOUND: commit `594bf37c` (Task 1 — feat)
- FOUND: commit `87f40a1c` (Task 2 — test)

---
*Phase: 260820-q1y-preview-de-imagens-sem-recorte-no-upload*
*Completed: 2026-08-20*