# Produção — piloto com escrita de 10 campanhas

**Data:** 2026-11-03
**Projeto:** Vendeo-V3 (`gvbzwihwgzujwsviufgy`)
**Origem:** `https://gvbzwihwgzujwsviufgy.supabase.co`
**Escopo:** 10 campanhas, lote 5, concorrência 2, `--write --confirm-env production`.
**Sem `--after`.** Nenhuma ampliação além dos 10.

## Comando (credenciais omitidas)

```text
node node_modules/tsx/dist/cli.mjs scripts/campaign-thumbnails/backfill.ts \
  --env production \
  --expected-url https://gvbzwihwgzujwsviufgy.supabase.co \
  --write --confirm-env production \
  --limit 10 --batch-size 5 --concurrency 2 \
  --env-file <arquivo local de credenciais> \
  --report .../evidence/production-write-pilot-01.json
```

## Estado prévio

- 10 originais baixados e hasheados (SHA-256 + bytes) — `production-write-pilot-pre.json`.
- 10 miniaturas ausentes.
- Bucket privado (`public=false`).
- Campanhas e créditos fotografados por hash/contagem:
  - `campaignsSha256`: `0915eb46…`
  - `creditsSha256`: `96686c5f…`
  - `creditTransactionsCount`: 142

## Resultado da escrita

| Outcome | Contagem |
|---|---|
| `created` | **10** |
| `already_exists` | 0 |
| `missing_original` | 0 |
| `access_error` | 0 |
| `invalid_format` | 0 |
| `ineligible` | 0 |
| `failed` | 0 |

### Miniaturas criadas

Todas **WebP 288×288**, entre **12.228 e 18.920 bytes**:

| Campanha | Bytes | Dimensão | SHA-256 (12) |
|---|---|---|---|
| c5dbccd2-419a-4019-8617-06ac2569f880 | 17.340 | 288×288 | 07f61fb6057f |
| 4c34d320-ed68-4864-acae-6d1adfc07c82 | 18.066 | 288×288 | fb3b3111ac40 |
| ee68456a-94b0-49c3-bafa-b8100ef2d512 | 18.920 | 288×288 | 1925af418a92 |
| 5bce5f2b-e8f8-43f4-aab2-7f2d9b65f4a5 | 17.642 | 288×288 | 2d298ca562bb |
| 4bf0376c-814f-4428-a5ff-a7c2305eec8e | 12.228 | 288×288 | 6c580947987f |
| f6a85ce2-3611-4142-849f-6f5e461092c9 | 15.846 | 288×288 | 626b2888ecf9 |
| 1b41018e-3ebc-4c58-bd5a-89794652eacc | 13.086 | 288×288 | 39c28fa68e19 |
| 91439d22-ea32-46a3-a474-4615544ad40b | 12.774 | 288×288 | 15f9ad6f7a81 |
| 91aee995-b6a3-45bd-92d6-5419f725ad88 | 13.030 | 288×288 | 5da818829f01 |
| bb33fc7b-8176-4e2e-855d-4d9c7d2bac85 | 13.392 | 288×288 | 8740a90da569 |

## Conferências pós-escrita

| Verificação | Resultado |
|---|---|
| WebP válido | **true** (10/10) |
| Maior aresta ≤288 | **true** (288×288) |
| Bucket privado | **true** |
| Signed URL privada disponível | **true** |
| Originais intactos (SHA-256/bytes) | **true** |
| Campanhas inalteradas (hash/contagem) | **true** |
| Créditos/transações inalterados | **true** |
| Miniaturas criadas | **10/10** |

## Reexecução idempotente

| Outcome | Contagem |
|---|---|
| `already_exists` | **10** |
| `created` | 0 |
| `failed` | 0 |

- Hashes das miniaturas idênticos antes/depois (`hashesEqual: true`).
- Originais/campanhas/créditos continuaram intactos.
- Nenhuma sobrescrita.

## Evidência

- `evidence/production-write-pilot-01.json`
- `evidence/production-write-pilot-01-rerun.json`
- `evidence/production-write-pilot-pre.json`
- `evidence/production-write-pilot-post.json`
- `evidence/production-write-pilot-rerun.json`

Sem credenciais ou URLs assinadas.

## Status

- Piloto **concluído com sucesso**; nenhuma divergência.
- Lote **não ampliado**: restam **236** campanhas do inventário de 246.
- Produção recebeu somente as **10 miniaturas derivadas**; originais e dados comerciais intocados.
- Nenhum commit/merge/push/deploy.
- Próximo passo (restante) depende de autorização explícita.
