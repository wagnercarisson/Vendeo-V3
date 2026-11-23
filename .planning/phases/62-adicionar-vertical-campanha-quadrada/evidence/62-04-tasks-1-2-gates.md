# 62-04 — Tasks 1–2 — Evidência de gates

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Baseline:** `00892728` (aceite do 62-03)
**Escopo:** somente Tasks 1–2 do 62-04. Tasks 3–4 não iniciadas. Sem banco, Storage, provider, geração, migration aplicada, flag em ambiente, merge, push, deploy, sync ou archive.

## Commit

| Commit | Conteúdo |
|---|---|
| `d0291d24` | portas, composition root, abertura/replay e preparação direta + testes |
| `73712ac7` | cobertura de saldo 1/zero e continuação sem saldo |
| `210c44ea` | plano: correções de replay/checksum/client |
| `0924adcf` | replay por request, checksum confirmado e client injetado |

## Correções dirigidas

- Replay consulta `request_id` antes da operação ativa; R1/R2 estornados e R1 com R2 ativo cobertos.
- `confirmedSourceChecksumSha256` comparado com a ponte antes de economia/reserva; divergência bloqueia sem RPC.
- `readLink`/`readLinkByRequest` usam o `client` injetado; teste do root com client fake.
- Identidade durável incompleta falha fechado.

## Gates dirigidos

| Gate | Comando | Resultado |
|---|---|---|
| Preparação (regressão) | `npx vitest run src/lib/product-9-16-two-stage/orchestration/__tests__/preparation-step.contract.test.ts` | PASS |
| Abertura/replay | `npx vitest run src/lib/campaign/format-addition/orchestration/__tests__/run-addition.contract.test.ts` | PASS |
| Combinado | os dois arquivos | **2 arquivos / 23 testes PASS** |

## Gates gerais

| Gate | Resultado real |
|---|---|
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** (não cobre TypeScript) |
| `npm.cmd run build` | exit **0**; 102/102 páginas |
| Suíte global (reexecução) | **exit 0**; **853 arquivos PASS + 2 skipped (855)**; **10.656 testes PASS + 10 skipped (10.666)** |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Flakiness observada

Primeira execução global: 1 falha em `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx` (`readinessAfter > readinessBefore`). O teste isolado passou **16/16** e a reexecução global passou integralmente. Arquivo não relacionado a esta fatia; não corrigido aqui.

## Limitações

- Fakes/offline: sem prova de locks, RLS, concorrência ou PostgREST reais.
- Duas abas simuladas, não concorrência real.
- O composition root exige `authorizeProductFlow` injetado pela rota do 62-05; ausente ⇒ fail-closed.
- Preparação direta é helper; não é executada na abertura nesta fatia.
- Tasks 3–4 (expansão, entrega, falha/unknown) não iniciadas.
