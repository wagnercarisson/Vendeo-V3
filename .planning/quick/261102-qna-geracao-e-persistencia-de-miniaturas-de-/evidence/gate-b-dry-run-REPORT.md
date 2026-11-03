# Gate B — dry-run local preparatório

**Data:** 2026-11-02 (UTC)
**Branch:** `perf/miniaturas-campanhas`
**Commit:** `c703acdf`
**Worktree:** limpo antes da execução
**Ambiente:** Supabase local em **`http://127.0.0.1:57781`** (loopback; porta confirmada por TCP)
**`--expected-url`:** `http://127.0.0.1:57781` (correspondência exata de origem)
**Modo:** `--dry-run` (somente leitura). **Nenhum `--write`.**

## Comandos executados (segredos omitidos)

As credenciais foram carregadas do `.env.local` pelo CLI; nenhuma chave foi impressa.

```text
node node_modules/tsx/dist/cli.mjs scripts/campaign-thumbnails/backfill.ts \
  --env local --expected-url http://127.0.0.1:57781 \
  --dry-run --limit 10 --batch-size 5 --concurrency 2 \
  --report .../evidence/gate-b-dry-run-01.json

# lotes seguintes com o cursor keyset emitido:
# 02: --limit 25 --batch-size 10 --concurrency 2 --after <cursor-01>
# 03: --limit 25 --batch-size 10 --concurrency 2 --after <cursor-02>
# 04: --limit 25 --batch-size 10 --concurrency 2 --after <cursor-03>
```

## Escopo e completude

| Item | Resultado |
|---|---|
| Campanhas `ready` no banco local | **67** |
| Campanhas `ready` com `storage_path` não nulo | **67** |
| Itens inspecionados no dry-run | **67** |
| Caminhos únicos | **67** (0 duplicados) |
| Cobertura relatório × banco | **idêntica** (`coverageMatches: true`) |
| Cursor final | `null` ⇒ **inventário completo** |

Todas as 67 artes são do **fluxo legado**: `{storeId}/{campaignId}.jpg`. Nenhuma v2/novo fluxo `ready` no banco local.

## Contadores agregados

| Outcome | Contagem |
|---|---|
| `would_create` | **67** |
| `already_exists` | 0 |
| `missing_original` | 0 |
| `access_error` | 0 |
| `invalid_format` | 0 |
| `ineligible` | 0 |
| `failed` | 0 |
| `created` | 0 |
| `seen` / `eligible` | 67 / 67 |

## Verificações

- Somente campanhas `ready`; `storage_path` canônico e prefixado pelo `store_id`.
- Nenhum path com `/inputs/`, `/logo`, `signature`, `bench/` ou `lab/`.
- Nenhum path arbitrário; todos casam com os shapes canônicos.
- Cursors com **microssegundos integrais** (`...249074+00:00`, `...321887+00:00`, `...569938+00:00`); último cursor `null`.
- Nenhuma URL assinada, token ou segredo nos relatórios (`secretLeak: false`).
- Nenhuma geração de miniatura, upload, alteração de campanha/crédito ou de arquivo original.

## Amostra de caminhos

```text
48b212f8-2b0f-4679-b553-122a601bacac/c5dbccd2-419a-4019-8617-06ac2569f880.jpg
48b212f8-2b0f-4679-b553-122a601bacac/4c34d320-ed68-4864-acae-6d1adfc07c82.jpg
48b212f8-2b0f-4679-b553-122a601bacac/ee68456a-94b0-49c3-bafa-b8100ef2d512.jpg
48b212f8-2b0f-4679-b553-122a601bacac/5bce5f2b-e8f8-43f4-aab2-7f2d9b65f4a5.jpg
48b212f8-2b0f-4679-b553-122a601bacac/91aee995-b6a3-45bd-92d6-5419f725ad88.jpg
```

## Anomalias

Nenhuma. Todos os 67 originais estão presentes, legíveis e elegíveis; todas as miniaturas estão ausentes (`would_create`).

## Relatórios

- `evidence/gate-b-dry-run-01.json` (10 itens)
- `evidence/gate-b-dry-run-02.json` (25 itens)
- `evidence/gate-b-dry-run-03.json` (25 itens)
- `evidence/gate-b-dry-run-04.json` (7 itens; cursor `null`)
- `evidence/gate-b-inventory-verification.json` (conferência banco × relatórios)

## Recomendação para o primeiro lote com escrita

Iniciar com o **mesmo lote já validado**: `--limit 10 --batch-size 5 --concurrency 2 --write --confirm-env local`, sem `--after` (início do inventário), gravando relatório próprio. Conferir os 10 `created`/`already_exists` e a integridade dos originais; depois avançar em lotes de **25**, sempre com o cursor keyset do relatório anterior, até `cursor: null`. Reexecuções são idempotentes por `upsert:false`.

**Gate B permanece NÃO concluído.** Nenhuma escrita foi executada; a autorização para `--write` continua pendente.
