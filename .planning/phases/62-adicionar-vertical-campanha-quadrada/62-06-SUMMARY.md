---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 06
subsystem: campaign-format-addition
tags: [list, dashboard, download, batch, pending, offline, awaiting-review]

requires:
  - phase: 62-adicionar-vertical-campanha-quadrada
    provides: jornada do detalhe aceita do 62-05
provides:
  - leitura em lote das adições para lista/dashboard
  - apresentação informativa dos dois formatos sem nova campanha
  - download format-aware com adição
  - exclusão das adições das pendências 1:1 legadas
affects: [62-06, 62-07]

key-files:
  created:
    - src/lib/campaign/format-addition/list-summary.ts
    - src/lib/campaign/__tests__/format-addition-list.test.ts
    - src/lib/campaign/__tests__/format-addition-regressions.test.ts
    - src/app/api/campaign/[id]/download/__tests__/route.addition.test.ts
  modified:
    - src/lib/campaign/list.ts
    - src/lib/dashboard/campaigns.ts
    - src/app/api/campaign/[id]/download/route.ts
    - src/lib/product-1-1/pending/pending-operations-repository.ts
    - src/lib/dashboard/__tests__/campaigns.test.ts
    - src/lib/product-9-16-two-stage/__tests__/pending-operations-repository.test.ts
    - src/__tests__/lib/campaign/list.test.ts
    - src/lib/campaign/__tests__/format-presentation-wiring.test.ts
    - src/lib/campaign/__tests__/campaign-list-joint.test.ts
    - src/lib/campaign/square-base/__tests__/boundaries.contract.test.ts

key-decisions:
  - "Lista/dashboard leem as adições em três consultas fixas por página; nunca por card."
  - "O DTO do cliente recebe apenas `formatAddition` sanitizado (estado/refunded); operationId/path/URL ficam server-only."
  - "A miniatura continua a quadrada; a adição não cria card/linha nem repointa storage_path."
  - "Download 1:1 com adição aceita ?format estrito; 9:16 só serve o vertical entregue, sem fallback."
  - "Adições são excluídas da fila de pendências 1:1 legadas; o suporte continua pela identidade documentada."
  - "Chips de lista/dashboard já eram informativos; a integração foi feita no DTO/apresentação, sem ação/modal."

requirements-completed: [ADD-READ-10, ADD-DELIV-07, ADD-SUPPORT-11, LIST-ADD-14, DASH-ADD-15, DL-ADD-16]

duration: ~45 min
completed: 2026-11-23
---

# Phase 62 Plan 06 — lista, dashboard, download e pendências

**Adição visível em lote, sem duplicar campanha, sem ação em lista/dashboard e com download estrito por formato**

> **Status: EXECUTADO LOCALMENTE/OFFLINE EM 2026-11-23 — AGUARDANDO O REVIEW STOP; NÃO ACEITO; `62-07` NÃO INICIADO.**
> Nenhum banco, Storage, provider, migration, ambiente, segredo/flag, merge, push,
> deploy, sync ou archive foi acionado.

## Performance

- **Tasks:** 4/4 executadas
- **Files modified:** 14 (4 criados, 10 alterados)

## Commit

| Commit | Conteúdo |
|---|---|
| `c86be002` | leitura em lote, DTOs, download format-aware, pendência e testes |

## Contrato implementado

- **Leitura em lote:** `readFormatAdditionListSummaries` faz 3 consultas fixas
  (`campaign_format_additions`, crédito e artefato vertical) por página,
  independentemente do número de cards. Deriva `delivered`/`processing`/
  `unknown`/`absent(+refunded)` com `Map<campaignId, summary>`.
- **DTO lista/dashboard:** `formatAddition` carrega apenas
  `{format:"9:16", state, refunded}`. `operationId` permanece server-only;
  nenhum path/URL/snapshot é exposto.
- **Apresentação:** `buildIndividualFormatPresentation` recebe a adição e
  mantém um único card/linha; conjunto e 9:16 individual não mudam; campanha sem
  adição preserva `absent/not_requested`.
- **Miniatura:** permanece a quadrada; a adição não repointa
  `campaigns.storage_path` nem usa arte original como fallback.
- **Download:** para campanha 1:1, `?format=1:1`/ausente serve o quadrado;
  `?format=9:16` exige adição `delivered` + artefato vertical íntegro; inválido/
  duplicado/não entregue falha fechado, sem fallback. Ownership, nome seguro e
  Content-Type preservados.
- **Pendências:** operações presentes em `campaign_format_additions` são
  removidas da fila `reserved`/`art_uploaded` legada 1:1; nenhum painel novo.

## Gates

| Gate | Resultado |
|---|---|
| Foco 62-06 (lista, dashboard, download, pendência, regressões, guards) | **8 arquivos / 92 testes PASS** |
| `typecheck` | exit **0** |
| `lint` | exit **0** |
| `build` | exit **0** — 102/102 páginas |
| Suíte global | **exit 0** — 863 arquivos + 2 skipped (865); **10.751 testes PASS** + 10 skipped |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Desvios e limitações

- **Componentes de lista/dashboard não precisaram de alteração:** já renderizam
  os chips sem `href`/ação/modal; a integração foi feita no DTO e na matriz de
  apresentação. Nenhum comportamento de geração foi adicionado.
- **Fakes/offline:** sem prova de RLS, locks, concorrência PostgREST, Storage ou
  provider reais.
- **Pendência legada:** a exclusão é best-effort se a tabela de adições ainda não
  existir no ambiente (feature inativa); com a migration aplicada, a leitura
  exclui as operações.
- **`62-07` não iniciado.** Nenhum ambiente ou segredo foi configurado.

## Next

Review Stop do `62-06`. Não iniciar `62-07` sem aprovação explícita.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Executed: 62-06, awaiting review, 2026-11-23*
