# 62-06 — Evidência de gates (execução local/offline)

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Escopo:** `62-06` apenas. `62-07` não iniciado. Sem banco/Storage/provider/migration/ambiente/segredo/flag/merge/push/deploy/sync/archive.

## Aceite final (2026-11-23)

- **Aprovado tecnicamente, local/offline**, após reconciliação textual (até 4 consultas em lote).
- Reexecução do revisor: **8 arquivos / 92 testes PASS**, OpenSpec strict válido, árvore e diff-check limpos.
- Gates do executor separados: foco **10/110**, global **10.756**, build **0**, typecheck/lint **0**.

## Commit

| Commit | Conteúdo |
|---|---|
| `c86be002` | leitura em lote, DTOs, download format-aware, pendência e testes |
| `60ff6e22` | plano: correções C12–C14 |
| `fe4e1d9d` | bloqueio na resolução direta, falha fechada e outcome unknown |
| `a87a84b3` | fake de pendências compatível com a consulta de adições |

## Correções C12–C14

- **C12:** `findPendingOperation` bloqueia adição antes de probe/RPC/projeção.
- **C13:** tabela ausente (`42P01`/`PGRST205`) preserva compatibilidade; outros
  erros bloqueiam a consulta.
- **C14:** outcome em lote; reserva + `unknown` ⇒ `unknown`; terminais
  prevalecem; 4 consultas fixas sem N+1.

## Gates dirigidos

| Gate | Comando | Resultado |
|---|---|---|
| Lista/lote | `npx vitest run src/lib/campaign/__tests__/format-addition-list.test.ts src/lib/campaign/__tests__/format-addition-regressions.test.ts` | PASS |
| Dashboard | `npx vitest run src/lib/dashboard/__tests__/campaigns.test.ts` | PASS |
| Download | `npx vitest run "src/app/api/campaign/[id]/download/__tests__/route.addition.test.ts"` | PASS |
| Pendência | `npx vitest run src/lib/product-9-16-two-stage/__tests__/pending-operations-repository.test.ts` | PASS |
| Regressões existentes | `list.test.ts`, `format-presentation-wiring.test.ts`, `campaign-list-joint.test.ts` | PASS |
| Boundaries | `square-base` + `joint-boundaries` | PASS |
| Foco total | dez arquivos acima | **10 arquivos / 110 testes PASS** |

## Gates gerais

| Gate | Resultado |
|---|---|
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** |
| `npm.cmd run build` | exit **0**; 102/102 páginas |
| Suíte global | **exit 0**; 863 arquivos + 2 skipped; **10.756 testes PASS** + 10 skipped |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Provas

- Até 4 consultas em lote por página (retornos antecipados podem executar menos)
  com 1 ou 3 adições; nunca consulta por card.
- DTO sem `operationId`/path/URL/snapshot; `formatAddition` só com estado seguro.
- Uma linha/card por campanha; miniatura quadrada preservada; `storage_path`
  inalterado.
- 1:1 com adição: quadrado em `?format=1:1`/ausente; vertical só em `?format=9:16`
  entregue; inválido/duplicado 400; não entregue 409; probe ausente 404;
  indeterminado/leitura 503; sem fallback.
- Adição entregue/processing/refunded/ausente/unknown na apresentação.
- Operação de adição excluída da fila E da resolução direta; operação normal
  permanece. Erro indeterminado falha fechado; tabela ausente preserva o fluxo.
- Reserva + outcome `unknown` ⇒ `unknown` em lista/dashboard; entregue/estornado
  prevalece sobre outcome histórico.
- Conjunto, 9:16 individual, legado e 1:1 sem adição preservados.

## Limitações

- Fakes/offline: sem RLS, locks, concorrência PostgREST, Storage/provider reais.
- A classificação distingue ausência comprovada da tabela de falha indeterminada;
  esta última bloqueia fila e resolução direta.
- Componentes de lista/dashboard já eram informativos; nenhuma ação nova foi
  adicionada.
- `62-07` não iniciado.
