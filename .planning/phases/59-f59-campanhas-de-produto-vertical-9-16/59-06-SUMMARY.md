---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "06"
subsystem: recovery
tags: [recovery, admin, pending, format-dispatch, vertical, fail-closed]

requires:
  - phase: 59-01
    provides: contrato neutro de formato persistido
  - phase: 59-04
    provides: store/probe vertical 1080x1920
  - phase: 59-05
    provides: projeção vertical com expectedArtifactPath
provides:
  - adaptador de formato para a fila administrativa de pendências
  - repositório de pendências format-agnóstico com projeção/sonda injetadas
  - rotas image-recovery e admin/product-1-1-pending despachando por formato persistido
  - evidência de formato na lista/admin, fail-closed por linha
affects: [59-08, 59-09]

tech-stack:
  added: []
  patterns:
    - formato lido exclusivamente de campaigns.input_snapshot
    - injeção de interface para manter product-1-1 sem import vertical
    - fail-closed por linha na listagem (formatUnavailable + indeterminate)
    - path vertical esperado no input da projeção

key-files:
  created:
    - src/lib/product-vertical-9-16/recovery/format-dispatch.ts
    - src/lib/product-vertical-9-16/recovery/pending-adapter.ts
    - src/lib/product-vertical-9-16/__tests__/recovery.integration.test.ts
    - src/app/api/admin/product-1-1-pending/__tests__/route-format.test.ts
    - src/app/api/campaign/__tests__/image-recovery-format.test.ts
  modified:
    - src/lib/product-1-1/pending/pending-operations-repository.ts
    - src/app/api/campaign/[id]/image-recovery/route.ts
    - src/app/api/admin/product-1-1-pending/route.ts
    - src/app/(app)/admin/product-1-1-pending/page.tsx
    - src/app/(app)/admin/product-1-1-pending/resolution-form.tsx

key-decisions:
  - "O formato governa a sonda e a projeção; não existe fallback silencioso para 1:1."
  - "A flag vertical NÃO é consultada na recuperação."
  - "O repositório recebe resolveFormat/verticalArtifacts por interface e não importa o módulo vertical."
  - "Linha com formato indisponível não derruba a lista: vira formatUnavailable + indeterminate."
  - "A resolução admin só injeta projeção vertical quando há estado persistido."

requirements-completed: [REQ-59-09]

duration: 35min
completed: 2026-11-04
---

# Phase 59 Plan 06: Recuperação vertical completa

**Sondas, projeções e evidência administrativa passam a seguir o formato persistido, com fail-closed e sem regeneração.**

## Accomplishments

- `format-dispatch.ts` e `pending-adapter.ts` isolam o conhecimento do formato e do runtime vertical.
- `pending-operations-repository` aceita resolvedor de formato e prober vertical por injeção; 1:1 permanece o default histórico.
- `image-recovery` resolve o formato antes da sonda, retorna 503 para formato indisponível e usa o perfil vertical somente no 9:16.
- Admin GET/POST e a página listam `Vertical 9:16` / `Quadrado 1:1` / `Formato indisponível`.
- Projeção vertical usa o `expectedArtifactPath` derivado do store/campaign/operation.

## Task Commits

1. **Task 1-3: recuperação/admin por formato persistido** — `6555240e`

## Validation

| Gate | Resultado |
|---|---|
| `recovery.integration.test.ts` | 14 testes passando (happy path, invalid/absent/indeterminate, admin/resolução, listagem) |
| Rotas novas de recuperação/admin | 9 testes passando |
| Suíte focada Wave 5 | 70 arquivos / 823 testes passando |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `openspec validate ... --strict` | valid |
| `git diff --check` | limpo |

## Deviations from Plan

- A suíte de recuperação cobre o serviço real com fakes e a projeção com path esperado; a validação de listagem/detalhe completa via mappers de `display.ts` não foi executada com banco real (fora do escopo local). O shape projetado (`ready` + path vertical) é verificado nos testes.
- Nenhuma migration, seed, flag aplicada, chamada paga, push ou deploy.

## Next Phase Readiness

- Wave 6 (UI de restore/lista/detalhe e homologação local) segue bloqueada até autorização.
- Gates de banco/concorrência/crédito real continuam pendentes.
