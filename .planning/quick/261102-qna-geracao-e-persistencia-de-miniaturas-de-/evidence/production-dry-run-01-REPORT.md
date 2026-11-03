# Produção — dry-run de miniaturas (amostra 10)

**Data:** 2026-11-03
**Projeto:** Vendeo-V3
**Ref:** `gvbzwihwgzujwsviufgy`
**Origem exata:** `https://gvbzwihwgzujwsviufgy.supabase.co`
**Modo:** `--dry-run` (somente leitura). **Sem `--write`.**

## Comando (credenciais omitidas)

```text
node node_modules/tsx/dist/cli.mjs scripts/campaign-thumbnails/backfill.ts \
  --env production \
  --expected-url https://gvbzwihwgzujwsviufgy.supabase.co \
  --dry-run --limit 10 --batch-size 5 --concurrency 2 \
  --env-file <arquivo local de credenciais> \
  --report .../evidence/production-dry-run-01.json
```

As credenciais foram carregadas de arquivo local, sem eco, sem impressão e sem gravação em evidências.

## Contadores

| Outcome | Contagem |
|---|---|
| `seen` / `eligible` | 10 / 10 |
| `would_create` | **10** |
| `already_exists` | 0 |
| `missing_original` | 0 |
| `access_error` | 0 |
| `invalid_format` | 0 |
| `ineligible` | 0 |
| `failed` | 0 |
| `created` | 0 |

## Cursor emitido

`2026-07-15T19:18:39.222192+00:00|bb33fc7b-8176-4e2e-855d-4d9c7d2bac85`

Microssegundos preservados.

## Amostra de caminhos

```text
48b212f8-2b0f-4679-b553-122a601bacac/c5dbccd2-419a-4019-8617-06ac2569f880.jpg
48b212f8-2b0f-4679-b553-122a601bacac/4c34d320-ed68-4864-acae-6d1adfc07c82.jpg
48b212f8-2b0f-4679-b553-122a601bacac/ee68456a-94b0-49c3-bafa-b8100ef2d512.jpg
48b212f8-2b0f-4679-b553-122a601bacac/5bce5f2b-e8f8-43f4-aab2-7f2d9b65f4a5.jpg
eaf7775b-0c62-4132-90e0-fcf4c8b7da38/4bf0376c-814f-4428-a5ff-a7c2305eec8e.jpg
```

Todos canônicos, prefixados pela loja; nenhum `/inputs/`, logo, assinatura, bench/lab.

## Anomalias

Nenhuma. Todas as 10 miniaturas estão ausentes (`would_create`); originais acessíveis e válidos.

## Status

- Produção **não alterada** (somente leitura).
- Inventário **não ampliado**; amostra de 10 para revisão.
- Nenhum segredo/URL assinada no relatório; varredura de segredos = 0.
- Ampliação depende de autorização explícita.
