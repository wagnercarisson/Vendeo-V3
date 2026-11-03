# Produção — preenchimento final das 236 restantes

**Data:** 2026-11-03
**Projeto:** Vendeo-V3 (`gvbzwihwgzujwsviufgy`)
**Origem:** `https://gvbzwihwgzujwsviufgy.supabase.co`
**Escopo:** 236 campanhas restantes do inventário aprovado (246 − 10 do piloto).
**Modo:** `--write --confirm-env production`, lotes de 25 (último 11), concorrência 2, cursor do piloto.

## Lotes executados

| Lote | Itens | `created` | `already_exists` | Falhas |
|---|---|---|---|---|
| 01 | 25 | 25 | 0 | 0 |
| 02 | 25 | 25 | 0 | 0 |
| 03 | 25 | 25 | 0 | 0 |
| 04 | 25 | 25 | 0 | 0 |
| 05 | 25 | 25 | 0 | 0 |
| 06 | 25 | 25 | 0 | 0 |
| 07 | 25 | 25 | 0 | 0 |
| 08 | 25 | 25 | 0 | 0 |
| 09 | 25 | 25 | 0 | 0 |
| 10 | 11 | 11 | 0 | 0 |
| **Total** | **236** | **236** | **0** | **0** |

Todos os paths dos lotes foram pré-checados contra o inventário aprovado; nenhum path novo ou duplicado entrou na escrita.

## Consolidação final

| Verificação | Resultado |
|---|---|
| Miniaturas do inventário | **246/246** |
| WebP válido | **246/246** |
| Maior aresta ≤288 | **246/246** |
| Peso | **7.392–26.010 bytes** |
| Bucket privado + signed URL | **true** |
| Originais intactos (SHA-256/bytes) | **true** |
| Campanhas inalteradas | **true** |
| Créditos/transações inalterados | **true** |
| Hashes das 10 miniaturas do piloto | **inalterados** |
| Varredura final read-only | **246 `already_exists`**, 0 falhas, cursor `null` |

## Campanha v3 verificada explicitamente

`830d104a-4982-4832-8824-1ddca688fd63`:

- original: `…/v3.jpg`;
- miniatura: `…/v3.thumb-v1.webp`;
- varredura final: **`already_exists`**;
- WebP **288×288**, **15.408 bytes**.

## Campanhas novas após o inventário

A varredura final (somente leitura, `limit 500`) viu **246 campanhas**, exatamente o inventário aprovado: **0 campanhas novas**. Nenhuma reconciliação adicional necessária neste momento.

## Evidência

- `evidence/production-batches-summary.json`
- `evidence/production-precheck-batch-01..10.json`
- `evidence/production-write-batch-01..10.json`
- `evidence/production-final-pre.json`
- `evidence/production-final-post.json`
- `evidence/production-final-dry-run.json`
- `evidence/production-approved-inventory.json`

Sem credenciais, conteúdo comercial ou URLs assinadas.

## Estado

- Produção recebeu **somente as 246 miniaturas derivadas** (10 do piloto + 236 agora).
- Originais, campanhas, créditos e configurações intocados.
- Sem commit, merge, push ou deploy.
- Próximo passo: publicação conjunta das duas quicks, mediante autorização separada.
