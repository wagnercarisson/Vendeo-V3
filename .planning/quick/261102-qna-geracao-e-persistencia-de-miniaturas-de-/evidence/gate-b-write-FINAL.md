# Gate B local — preenchimento das 57 restantes e fechamento local

**Data:** 2026-11-02 (UTC)
**Branch:** `perf/miniaturas-campanhas`
**Commit de código:** `c703acdf`
**Ambiente:** Supabase local `http://127.0.0.1:57781` (loopback)
**`--expected-url`:** `http://127.0.0.1:57781` (correspondência exata)
**Escopo:** fluxo **legado** local. **Não** homolog/produção, v2/novo fluxo, consumidores ou publicação.
**Autorização:** sequência aprovada (cursor do piloto; 25/25/7; concorrência 2; relatórios por lote).

## Sequência executada (segredos omitidos)

```text
--write --confirm-env local --limit 25 --batch-size 10 --concurrency 2 --after <cursor-piloto>
--write --confirm-env local --limit 25 --batch-size 10 --concurrency 2 --after <cursor-02>
--write --confirm-env local --limit 7  --batch-size 7  --concurrency 2 --after <cursor-03>
```

## Resultado por lote

| Lote | Escopo | Limite | `created` | `failed` | Cursor |
|---|---|---|---|---|---|
| Piloto | 10 itens | 10 | **10** | 0 | `...249074+00:00|748a7b29…` |
| 02 | 25 itens | 25 | **25** | 0 | `...321887+00:00|5bfe8cc1…` |
| 03 | 25 itens | 25 | **25** | 0 | `...569938+00:00|50d66249…` |
| 04 | 7 itens | 7 | **7** | 0 | `...568856+00:00|c06b16f5…` |
| **Total** | **57 restantes** | — | **57** | **0** | — |

**67 miniaturas no total** (10 do piloto + 57 restantes).

> Observação: o lote 04 com `--limit 7` ficou saturado e emitiu cursor não nulo. A varredura final a partir do início confirmou **67 itens** e cursor `null`.

## Verificação final

| Verificação | Resultado |
|---|---|
| Miniaturas existentes | **67/67** |
| `allExist` | **true** |
| WebP válido | **true** (67/67) |
| Maior aresta ≤ 288 | **true** (todas 288×288) |
| Peso | **10.562–23.638 bytes** |
| Bucket privado | **true** (`public=false`) |
| Signed URL disponível (acesso privado autorizado) | **true** |
| Originais intactos (SHA-256/bytes) | **true** |
| Campanhas inalteradas | **true** |
| Créditos/contagem de transações inalterados | **true** |
| Hashes das 10 miniaturas do piloto | **idênticos** (sem sobrescrita) |

## Idempotência final

Varredura somente leitura de todos os 67:

| Outcome | Contagem |
|---|---|
| `already_exists` | **67** |
| `created` | 0 |
| `would_create` | 0 |
| `missing_original` / `access_error` / `invalid_format` / `ineligible` / `failed` | 0 |
| Cursor final | **`null`** |

## Evidência

- `evidence/gate-b-write-02.json` (25 `created`)
- `evidence/gate-b-write-03.json` (25 `created`)
- `evidence/gate-b-write-04.json` (7 `created`)
- `evidence/gate-b-final-pre.json` (67 originais + estado comercial antes das 57)
- `evidence/gate-b-final-post.json` (67 miniaturas + integridade)
- `evidence/gate-b-final-dry-run.json` (67 `already_exists`)
- `evidence/gate-b-write-PILOT.md` (piloto)
- `evidence/gate-b-dry-run-REPORT.md` (inventário)

Sem segredos ou URLs assinadas.

## Conclusão

- **Gate B local concluído** para o fluxo legado: 67/67 miniaturas, zero falhas, originais/campanhas/créditos íntegros.
- **Não** representa prontidão de homolog/produção.
- Correção v2 e novo fluxo seguem validados apenas por testes automatizados.
- Commit, merge, push, deploy e troca de consumidores continuam pendentes de autorização separada.
