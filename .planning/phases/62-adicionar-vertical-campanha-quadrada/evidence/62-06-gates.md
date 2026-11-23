# 62-06 — Evidência de gates (execução local/offline)

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Escopo:** `62-06` apenas, parando no Review Stop. `62-07` não iniciado. Sem banco/Storage/provider/migration/ambiente/segredo/flag/merge/push/deploy/sync/archive.

## Commit

| Commit | Conteúdo |
|---|---|
| `c86be002` | leitura em lote, DTOs, download format-aware, pendência e testes |

## Gates dirigidos

| Gate | Comando | Resultado |
|---|---|---|
| Lista/lote | `npx vitest run src/lib/campaign/__tests__/format-addition-list.test.ts src/lib/campaign/__tests__/format-addition-regressions.test.ts` | PASS |
| Dashboard | `npx vitest run src/lib/dashboard/__tests__/campaigns.test.ts` | PASS |
| Download | `npx vitest run "src/app/api/campaign/[id]/download/__tests__/route.addition.test.ts"` | PASS |
| Pendência | `npx vitest run src/lib/product-9-16-two-stage/__tests__/pending-operations-repository.test.ts` | PASS |
| Regressões existentes | `list.test.ts`, `format-presentation-wiring.test.ts`, `campaign-list-joint.test.ts` | PASS |
| Boundaries | `square-base` + `joint-boundaries` | PASS |
| Foco total | oito arquivos acima | **8 arquivos / 92 testes PASS** |

## Gates gerais

| Gate | Resultado |
|---|---|
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** |
| `npm.cmd run build` | exit **0**; 102/102 páginas |
| Suíte global | **exit 0**; 863 arquivos + 2 skipped; **10.751 testes PASS** + 10 skipped |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Provas

- 3 consultas constantes com 1 ou 3 adições; nunca consulta por card.
- DTO sem `operationId`/path/URL/snapshot; `formatAddition` só com estado seguro.
- Uma linha/card por campanha; miniatura quadrada preservada; `storage_path`
  inalterado.
- 1:1 com adição: quadrado em `?format=1:1`/ausente; vertical só em `?format=9:16`
  entregue; inválido/duplicado 400; não entregue 409; probe ausente 404;
  indeterminado/leitura 503; sem fallback.
- Adição entregue/processing/refunded/ausente/unknown na apresentação.
- Operação de adição excluída da pendência 1:1; operação normal permanece.
- Conjunto, 9:16 individual, legado e 1:1 sem adição preservados.

## Limitações

- Fakes/offline: sem RLS, locks, concorrência PostgREST, Storage/provider reais.
- Exclusão da pendência é best-effort quando a tabela de adições não existe
  (feature inativa); com a migration aplicada, a exclusão ocorre.
- Componentes de lista/dashboard já eram informativos; nenhuma ação nova foi
  adicionada.
- `62-07` não iniciado.
