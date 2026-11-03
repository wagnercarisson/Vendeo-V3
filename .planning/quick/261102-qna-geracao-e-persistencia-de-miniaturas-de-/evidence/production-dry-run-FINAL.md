# Produção — inventário dry-run completo

**Data:** 2026-11-03
**Projeto:** Vendeo-V3 (`gvbzwihwgzujwsviufgy`)
**Origem:** `https://gvbzwihwgzujwsviufgy.supabase.co`
**Modo:** `--dry-run` (somente leitura). **Sem `--write`, geração ou upload.**

## Resultado consolidado

| Métrica | Valor |
|---|---|
| Campanhas `ready` inventariadas | **246** |
| Paths únicos | **246** |
| Duplicados entre páginas | **0** |
| `would_create` | **246** |
| `already_exists` | 0 |
| `missing_original` | 0 |
| `access_error` | 0 |
| `invalid_format` | 0 |
| `ineligible` | 0 |
| `failed` | 0 |
| `created` | 0 |
| Cursor final | **`null`** |
| Inventário completo | **sim** |

## Reinspeção do v3 (substitui o resultado anterior)

Campanha `830d104a-4982-4832-8824-1ddca688fd63`:

- anterior: `ineligible` / `path_not_eligible`;
- atual: **`would_create`**;
- original: `6e1b0fb1-…/830d104a-…/v3.jpg`;
- miniatura derivada: `6e1b0fb1-…/830d104a-…/v3.thumb-v1.webp`.

O item anterior foi removido da contagem e substituído pela reinspeção; não há dupla contagem. O total permanece 246.

## Lotes

| Lote | Itens | Cursor final |
|---|---|---|
| 01 | 10 | emitido |
| 02–08 | 175 | emitidos |
| 09 | 25 (24 would_create + 1 ineligible) | emitido |
| 10 | 25 | emitido |
| 11 | 11 | **null** |
| **Total** | **246** | — |

## Verificações

- Nenhum path inesperado após o suporte a v3 (v2/v3 aceitos estritamente).
- Nenhum `/inputs/`, logo, assinatura, bench ou lab.
- Nenhum original ausente/inválido.
- Nenhum erro de acesso.
- Nenhuma miniatura gerada ou enviada.
- Produção não alterada.
- Sem segredos/URLs assinadas nas evidências.

## Comparação com o ambiente local

Produção tem **246** campanhas `ready` (não 67). O total local não foi usado como premissa.

## Próximo passo (aguardando autorização)

Piloto com escrita de 10 itens a partir do início do inventário, lote 5, concorrência 2, `--write --confirm-env production`, seguido de conferência de WebP/privacidade/integridade e reexecução idempotente. **Nenhuma escrita foi executada nesta rodada.**
