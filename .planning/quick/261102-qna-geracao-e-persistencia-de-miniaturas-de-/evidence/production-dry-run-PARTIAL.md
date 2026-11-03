# Produção — dry-run ampliado (parcial, interrompido por caminho inesperado)

**Data:** 2026-11-03
**Projeto:** Vendeo-V3 (`gvbzwihwgzujwsviufgy`)
**Origem:** `https://gvbzwihwgzujwsviufgy.supabase.co`
**Modo:** `--dry-run` (somente leitura). **Sem `--write`.**

## Progresso

| Lote | Itens | `would_create` | `ineligible` | Falhas |
|---|---|---|---|---|
| 01 | 10 | 10 | 0 | 0 |
| 02 | 25 | 25 | 0 | 0 |
| 03 | 25 | 25 | 0 | 0 |
| 04 | 25 | 25 | 0 | 0 |
| 05 | 25 | 25 | 0 | 0 |
| 06 | 25 | 25 | 0 | 0 |
| 07 | 25 | 25 | 0 | 0 |
| 08 | 25 | 25 | 0 | 0 |
| 09 | 25 | 24 | **1** | 0 |
| **Total** | **210** | **209** | **1** | **0** |

Contadores agregados: `seen 210`, `eligible 209`, `ineligible 1`, `would_create 209`, `already_exists 0`, `missing_original 0`, `access_error 0`, `invalid_format 0`, `failed 0`, `created 0`. Paths únicos: **210**; duplicados entre páginas: **0**.

**Cursor final emitido:** `2026-10-06T17:41:37.11533+00:00|d0907e36-250b-4834-a5f7-553286d87687`
**Cobertura:** **parcial** — o inventário não chegou a `cursor: null`.

## Anomalia (parada obrigatória)

Campanha `830d104a-4982-4832-8824-1ddca688fd63`
Loja `6e1b0fb1-2855-4ee7-bc6f-c9b74ae97147`
Path: **`6e1b0fb1-2855-4ee7-bc6f-c9b74ae97147/830d104a-4982-4832-8824-1ddca688fd63/v3.jpg`**
Outcome: `ineligible` / `path_not_eligible`.

O contrato atual (`thumbnail-path.ts` / quick 261102-qna) cobre apenas:
- legado `{store}/{campaign}.jpg`;
- correção v2 `{store}/{campaign}/v2.jpg`;
- novo fluxo `.../product-1-1/{operation}/art-1024.jpg`.

`v3.jpg` **não** é um caminho canônico coberto. Não foi gerada miniatura, não houve escrita e o inventário foi interrompido conforme o critério de parada.

## Estado

- Produção **não alterada** (somente leitura).
- Nenhum segredo/URL assinada nas evidências.
- Restam lotes até `cursor: null`, mas a ampliação está **parada aguardando decisão** sobre o caminho `v3.jpg`.
