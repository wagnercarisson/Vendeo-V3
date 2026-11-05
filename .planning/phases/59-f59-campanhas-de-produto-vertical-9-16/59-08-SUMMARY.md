---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "08"
subsystem: delivery
tags: [restore, download, detail, thumbnail, vertical, fail-closed]

requires:
  - phase: 59-06
    provides: recuperação/admin por formato persistido
  - phase: 59-07
    provides: criação, flag e seletor de formato
provides:
  - restore com formato/versão pela tabela neutra
  - pausa vertical sem troca silenciosa para 1:1
  - download dispatch vertical com gate e attachment
  - detalhe vertical aspect-[9/16] com object-contain
  - listagem por miniatura vertical preservada
affects: [59-09, 59-10]

tech-stack:
  added: []
  patterns:
    - formato persistido como fonte única também em restore/download/detalhe
    - classificação exclusiva por resolveCampaignFormat
    - import dinâmico do runtime vertical
    - fail-closed sem fallback 1:1
    - miniatura vertical pelo path já versionado

key-files:
  created:
    - src/__tests__/lib/campaign-display-format.test.ts
    - src/__tests__/app/campaign-detail-format.test.tsx
    - src/__tests__/app/nova-format-paused.test.tsx
    - src/components/flow/__tests__/use-campaign-form-restore-format.test.ts
    - src/lib/campaign/__tests__/campaign-list-format.test.ts
  modified:
    - src/lib/campaign/display.ts
    - src/app/(app)/campanhas/nova/page.tsx
    - src/components/flow/campaign-brief-review.tsx
    - src/components/flow/campaign-input-form.tsx
    - src/components/flow/use-campaign-form.ts
    - src/app/api/campaign/[id]/download/route.ts
    - src/app/(app)/campanhas/[id]/page.tsx
    - src/app/(app)/campanhas/[id]/client.tsx
    - src/__tests__/api/campaign-download.test.ts

key-decisions:
  - "display.ts consome a MESMA tabela neutra e não importa o módulo vertical."
  - "Pares malformados/incoerentes viram formatUnavailable e bloqueiam, nunca 1:1 silencioso."
  - "A pausa preserva o formato hidratado do rascunho; não força troca."
  - "Download/detalhe consultam o formato persistido e falham fechado quando indisponível."
  - "Card/listagem não foram redesenhados; a miniatura vertical usa o path já suportado."

requirements-completed: [REQ-59-09, REQ-59-10, REQ-59-12]

duration: 45min
completed: 2026-11-04
---

# Phase 59 Plan 08: Restauração e entrega por formato

**O vertical chega ao lojista: restore pausado sem troca silenciosa, download/dispatch vertical e detalhe 9:16.**

## Accomplishments

- `CampaignFormRestore` ganhou formato, versão e indisponibilidade.
- `display.ts` classifica exclusivamente por `resolveCampaignFormat`, sem variante local e sem import vertical.
- O restore hidrata 1:1/9:16 e nunca converte vertical em 1:1; formato indisponível pausa.
- A página nova resolve o formato server-side e bloqueia rascunho vertical com a flag OFF.
- A revisão do brief mostra `Formato` com hint `1080 × 1920 px` só no vertical e some no legado.
- O download usa probe/download verticais no 9:16, preserva o gate `delivered + integral` e falha 503 em formato inválido.
- O detalhe usa container `aspect-[9/16]` com `object-contain`; o 1:1 mantém o markup atual.
- A listagem continua usando `deriveThumbnailPath`, agora provado também para o path vertical.

## Task Commits

1. **Task 1-3: restore/download/detalhe por formato** — `3664736c`
2. **Fix pós-revisão: pausa apenas rascunho restaurado** — `d08d71b1`

## Validation

| Gate | Resultado |
|---|---|
| Suítes de restore/display/download/detalhe/lista/flow | **73 arquivos / 721 testes passando** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `git diff --check` | limpo |
| `display.ts` sem import vertical | 0 ocorrências |
| `client.tsx` sem `object-cover` | 0 ocorrências |

## Deviations from Plan

- Adicionei `src/__tests__/app/nova-format-paused.test.tsx` para provar a pausa na página (vertical + flag OFF e formato indisponível), além dos arquivos previstos.
- O teste do detalhe cobre o client (frame/objeto) e guardas estruturais da página; não executa a página server-side com Storage real.
- Nenhum card/listagem foi alterado. Sem banco real, build, homologação, seed, flag, chamada paga, push ou deploy.

## Next Phase Readiness

- Wave 7/59-09 (telemetria, runbook e gates locais) permanece bloqueada até autorização.
- Validação visual/homolog e build continuam gates separados.
