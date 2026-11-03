# Gate B — piloto local com escrita (10 campanhas)

**Data:** 2026-11-02 (UTC)
**Branch:** `perf/miniaturas-campanhas`
**Commit de código:** `c703acdf`
**Ambiente:** Supabase local `http://127.0.0.1:57781` (loopback)
**`--expected-url`:** `http://127.0.0.1:57781` (correspondência exata)
**Escopo:** 10 campanhas do fluxo **legado**; lote 5, concorrência 2.
**Fora do escopo:** homolog/produção, v2/novo fluxo, consumidores, publicação.

## Comando (segredos omitidos)

```text
node node_modules/tsx/dist/cli.mjs scripts/campaign-thumbnails/backfill.ts \
  --env local --expected-url http://127.0.0.1:57781 \
  --write --confirm-env local \
  --limit 10 --batch-size 5 --concurrency 2 \
  --report .../evidence/gate-b-write-01.json
```

## Estado prévio (capturado antes da escrita)

- 10 originais baixados e hasheados (SHA-256 + bytes) — `gate-b-write-pilot-pre.json`.
- 10 miniaturas ausentes (`thumbnailsExisting: 0`).
- Bucket `campaign-images` privado (`public: false`).
- Campanhas e créditos fotografados para comparação.

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
| `seen` / `eligible` | 10 / 10 |

### Miniaturas criadas

Todas **WebP 288×288**, entre **13.030 e 18.920 bytes**:

| Campanha | Bytes | Dimensão | SHA-256 (12) |
|---|---|---|---|
| c5dbccd2-419a-4019-8617-06ac2569f880 | 17.340 | 288×288 | 07f61fb6057f |
| 4c34d320-ed68-4864-acae-6d1adfc07c82 | 18.066 | 288×288 | fb3b3111ac40 |
| ee68456a-94b0-49c3-bafa-b8100ef2d512 | 18.920 | 288×288 | 1925af418a92 |
| 5bce5f2b-e8f8-43f4-aab2-7f2d9b65f4a5 | 17.642 | 288×288 | 2d298ca562bb |
| 91aee995-b6a3-45bd-92d6-5419f725ad88 | 13.030 | 288×288 | 5da818829f01 |
| e937155b-5126-4f42-af10-42c97148712d | 17.332 | 288×288 | 47e81f7f8d07 |
| f8be1eef-9d00-4ab4-84b6-4522113a7324 | 16.530 | 288×288 | eae0f560df88 |
| 76c1751e-80b4-442f-ac52-38b23e04cdf2 | 15.524 | 288×288 | 150a29c64555 |
| bb4bf598-b359-423e-9e4d-91589d66a927 | 13.138 | 288×288 | 4c0c1c54a8bb |
| 748a7b29-5bbf-4d4a-adfd-66aea6fb19c1 | 15.786 | 288×288 | 296b50ce72ad |

## Conferências pós-escrita

| Verificação | Resultado |
|---|---|
| Todas WebP | **true** |
| Maior aresta ≤ 288 | **true** |
| Acesso privado (bucket `public=false`) + signed URL disponível | **true** |
| Originais intactos (SHA-256/bytes iguais ao pré) | **true** |
| Registros de campanha inalterados | **true** |
| Créditos/contadores de transação inalterados | **true** |
| Miniaturas criadas | **10/10** |

## Idempotência (reexecução dos mesmos 10)

| Outcome | Contagem |
|---|---|
| `already_exists` | **10** |
| `created` | 0 |
| `failed` | 0 |

- Hashes das miniaturas idênticos antes/depois da reexecução (`rerunHashesEqual: true`).
- Originais, campanhas e créditos continuaram inalterados.
- Nenhuma sobrescrita.

## Evidência

- `evidence/gate-b-write-01.json` — escrita (10 `created`)
- `evidence/gate-b-write-01-rerun.json` — reexecução (10 `already_exists`)
- `evidence/gate-b-write-pilot-pre.json` — estado prévio/hashes
- `evidence/gate-b-write-pilot-post.json` — validação pós-escrita
- `evidence/gate-b-write-pilot-rerun.json` — comparação de hashes

Nenhum segredo ou URL assinada foi gravado.

## Limitações e pendências

- Este piloto valida a integração real **somente do fluxo legado**; correção v2 e novo fluxo seguem cobertos por testes automatizados.
- **57 campanhas restantes não foram processadas.** Gate B **não está concluído**.
- Homolog/produção, consumidores e publicação permanecem fora do escopo.

## Recomendação (corrigida)

**Preferencial — continuar pelo cursor final do piloto** (`2026-07-20T01:10:12.249074+00:00|748a7b29-5bbf-4d4a-adfd-66aea6fb19c1`):

- 57 restantes em **25 / 25 / 7**;
- mesmo endpoint, `--write --confirm-env local`, concorrência 2;
- um relatório JSON por lote;
- ao final: **67 miniaturas existentes**, 0 falhas, originais/campanhas/créditos íntegros.

**Alternativa — reiniciar sem `--after`:** o inventário teria **67 itens inspecionados** (10 `already_exists` + 57 novos), portanto **25 / 25 / 17**.

Concluir o **Gate B local** não implica prontidão de homolog/produção. Consumidores, commit, merge, push e deploy exigem autorização separada.
