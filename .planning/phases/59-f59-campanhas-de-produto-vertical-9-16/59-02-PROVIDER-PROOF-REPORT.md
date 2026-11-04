# 59-02 — Relatório da prova de provider vertical 9:16

**Data:** 2026-11-04
**Status:** **PROVA EXECUTADA — 8/8 chamadas; nenhuma falha; nenhum unknown.**
**Teto:** **US$ 3,00** · **Custo real apurado:** **US$ 0,211210** · **Cobrado contra o teto:** **US$ 0,860000**
**UAT/produção:** **NÃO autorizadas.**

## 1. Fonte compartilhada

| Item | Valor |
|---|---|
| Configuração | `image_model_pair_config` (`scope = new_flow`) |
| Config version | `0c8925d5-5aff-4c90-a007-9dd32750b80f` |
| Origem | `human_decision` |
| Primário | `gpt-image-2.5-sunburst` / `medium` |
| Fallback | `gpt-image-2` / `low` |
| Pricing principal | `386fb02c-b0e8-4ec9-a8c6-573b4ca58f19` — `image_unit_usd` 0,044 |
| Pricing fallback | `d25c9ecc-0c91-44db-a4b9-e057a0a78215` — `image_unit_usd` 0,042 |

Nenhum catálogo, seleção, tabela ou tarifa exclusiva de 9:16 foi criado.

## 2. Ambiente e insumos

| Item | Valor |
|---|---|
| Ambiente | local/homolog `127.0.0.1:57781` |
| Loja de teste | `Loja Mega Vale` — `3dc7d274-0b57-45ba-883a-7b235056feda` |
| Primária | `C:\Users\wagne\AppData\Local\Temp\f59-proof-inputs\primary.jpg` — JPEG 1080×1080, SHA-256 `307538f1…d0b62d1d` |
| Identidade | `C:\Users\wagne\AppData\Local\Temp\f59-proof-inputs\identity.png` — PNG 1024×1024, SHA-256 `c0dd2d5b…bdbf07d8` |
| Credencial | `OPENAI_API_KEY` do `.env.local` (não exibida) |

A identidade coincide com a referência congelada `c0dd2d5b…` do `input_snapshot` da loja.

## 3. Resultado por chamada

| # | Modelo | Qualidade | Solicitado | Devolvido | Latência | Custo real (usage) | Estimativa | Cobrado | Status |
|---:|---|---|---|---|---:|---:|---:|---:|---|
| 1 | `gpt-image-2.5-sunburst` | `medium` | `1152x2048` | 1152×2048 | 29,1 s | 0,029185 | 0,110 | 0,110 | succeeded |
| 2 | `gpt-image-2.5-sunburst` | `medium` | `1152x2048` | 1152×2048 | 20,9 s | 0,029185 | 0,110 | 0,110 | succeeded |
| 3 | `gpt-image-2.5-sunburst` | `medium` | `1152x2048` | 1152×2048 | 17,7 s | 0,029185 | 0,110 | 0,110 | succeeded |
| 4 | `gpt-image-2.5-sunburst` | `medium` | `1024x1024` | 1024×1024 | 22,5 s | 0,031345 | 0,110 | 0,110 | succeeded |
| 5 | `gpt-image-2` | `low` | `1152x2048` | 1152×2048 | 16,7 s | 0,022785 | 0,105 | 0,105 | succeeded |
| 6 | `gpt-image-2` | `low` | `1152x2048` | 1152×2048 | 15,9 s | 0,022785 | 0,105 | 0,105 | succeeded |
| 7 | `gpt-image-2` | `low` | `1152x2048` | 1152×2048 | 15,7 s | 0,022785 | 0,105 | 0,105 | succeeded |
| 8 | `gpt-image-2` | `low` | `1024x1024` | 1024×1024 | 14,6 s | 0,023955 | 0,105 | 0,105 | succeeded |

- **Dimensão:** todas as 8 chamadas devolveram exatamente o tamanho solicitado.
- **Custo reportado pelo provider:** `null` em todas.
- **Custo calculado por usage:** completo em todas; total **US$ 0,211210**.
- **Retries automáticos:** **0** (`maxRetries: 0`).
- **Unknown / cost_unverified / dimension_mismatch / unsupported_dimension:** **0**.

## 4. Orçamento

| Métrica | Valor |
|---|---|
| Teto | US$ 3,00 |
| Cobrado contra o teto (maior custo conhecido) | **US$ 0,860000** |
| Restante do teto | **US$ 2,140000** |
| Custo real apurado | **US$ 0,211210** |
| Desvio real vs. estimativa | **−US$ 0,648790** |
| Chamadas pendentes | **0** |
| Requer reconciliação | **não** |

O valor cobrado contra o teto é conservador (usa o maior entre estimativa e custo real). O custo
real apurado é menor e está registrado separadamente.

## 5. Calibração

**Confirmado conservador.** Maior razão custo real/estimado: **0,284955**. O multiplicador 2,5
permanece o valor pré-definido; nenhum ajuste automático foi aplicado. A folga observada (~3,5×)
pode justificar uma redução futura, mas isso exige decisão explícita e nova versão.

## 6. Evidência

- JSON incremental: `scripts/f59/evidence/vertical-provider-proof-2026-11-04T23-01-50-264Z.json`.
- Calibração: `59-02-VERTICAL-ESTIMATE-CALIBRATION.md`.
- Nenhum prompt, chave, byte de imagem ou conteúdo do usuário foi registrado.

## 7. Declarações

- **Prova técnica executada e concluída dentro do teto.**
- **UAT funcional e produção NÃO estão autorizadas.**
- Nenhuma campanha, crédito, banco, flag ou migration foi alterada.
- Nenhuma troca silenciosa de modelo/configuração; nenhuma dimensão divergente.
- Wave 3 **não iniciada**.

## 8. Próximo passo

Apresentar o resultado ao responsável e aguardar decisão sobre UAT/homolog. A prova não autoriza
produção, ativação de flag ou Wave 3.
