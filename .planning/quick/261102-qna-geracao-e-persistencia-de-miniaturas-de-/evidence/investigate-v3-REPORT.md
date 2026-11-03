# Investigação read-only — campanha `830d104a…` / `v3.jpg`

**Data:** 2026-11-03
**Ambiente:** produção Vendeo-V3 (`gvbzwihwgzujwsviufgy`), somente leitura.
**Sem credenciais, conteúdo comercial, URLs assinadas ou derivados.**

## 1. Como versões são nomeadas/persistidas

- `campaign_art_versions.version_number` tem `CHECK (version_number BETWEEN 1 AND 3)` (`20260901000001_f37_1_create_campaign_art_versions.sql:21`).
- O fluxo legado de regeneração `complete_campaign_regeneration` aceita `p_version_number BETWEEN 2 AND 3` (`20260905000001_f37_2_correction_rpcs.sql:159-227`) e persiste o path recebido.
- O fluxo atual de correção (`complete_campaign_correction_v2`) grava **v2** em `{storeId}/{campaignId}/v2.jpg` (`correction-reports.ts:585`), sem criar v3.
- Não há chamador TypeScript atual de `complete_campaign_regeneration`; o v3 observado é histórico/legado, mas o schema e a RPC o suportam.
- O contrato atual de miniaturas cobre apenas legado, v2 e novo fluxo; não cobre v3.

## 2. Registros da campanha (apenas metadados)

Campanha:
- `status = ready`
- `approval_status = approved`
- `rejection_count = 2`
- `approved_version_id = c85f5eac-ddd3-46ca-9b06-327212bf75d8` (a linha v3)
- `approved_at = 2026-09-07T23:28:48Z`
- `storage_path = 6e1b0fb1-…/830d104a-…/v3.jpg`

Versões:
| v | status | asset_status | storage_path |
|---|---|---|---|
| 1 | rejected | discarded | `NULL` (deleted) |
| 2 | rejected | discarded | `NULL` (deleted) |
| **3** | **approved** | **active** | `…/v3.jpg` |

A linha v3 (`c85f5eac…`) é a versão aprovada e ativa; as anteriores foram descartadas. O caminho em `campaigns.storage_path` aponta exatamente para ela.

## 3. Objeto no Storage

- `v3.jpg` existe no bucket `campaign-images`.
- JPEG **1080×1080**, sRGB, 245.151 bytes.
- `v1/v2` não existem mais no Storage (paths anulados e deletados); a pasta contém `inputs/` e `v3.jpg`.

## 4. Isolamento / contrato

- Campanhas com `storage_path` terminando em `/v3.jpg`: **1**.
- Campanhas com `/v4.jpg`: **0**.
- Campanhas com `/v2.jpg`: **2**.

**Conclusão:** é um caso **isolado**, mas **legítimo** de versão sucessiva (v3) do fluxo histórico de regeneração. Não é arquivo arbitrário nem arte órfã: é a arte final aprovada e referenciada pelo caminho canônico.

## 5. Menor ajuste necessário

**Adicionar v3 ao contrato canônico de caminho** — preferencialmente aceitar `v2.jpg` **e** `v3.jpg` (ou `v[2-3].jpg`) em `thumbnail-path.ts`, com testes.

Impacto:
- **Gerador automático:** nenhum código atual produz v3; não é necessário alterar os três call sites. Se o fluxo legado de regeneração for reativado, ele precisará de uma chamada de geração no ponto de persistência (fora deste ajuste).
- **Backfill:** passará a classificar este caminho como elegível e gerar `v3.thumb-v1.webp`; sem mudança de inventário/guardas/limites.
- **Consumidores:** nenhuma alteração; `deriveThumbnailPath` central passa a derivar `v3.thumb-v1.webp`, e dashboard/listagem assinam a miniatura normalmente.
- **Schema/migrations:** nenhuma.
- **Alternativa:** excluir a campanha do backfill e deixar placeholder — rejeitada porque há arte final aprovada.

Nenhuma alteração de código/allowlist foi feita nesta rodada.
