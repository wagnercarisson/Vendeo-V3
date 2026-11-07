# 59-02 — Calibração do multiplicador vertical

**Status:** **PROVA EXECUTADA — 8/8 chamadas; calibração concluída.**
**Multiplicador provisório:** **2,5** (razão de área **2,25** + margem de segurança **0,25**).
**Versão:** `f59-vertical-9-16-v1`.

## 1. Regra pré-definida

`estimado = image_unit_usd × 2,5`

O `image_unit_usd` veio da fonte compartilhada (`ai_model_pricing` vigente por modelo+qualidade),
a mesma usada pelo fluxo 1:1. O multiplicador foi definido **antes** da primeira chamada paga.

## 2. Configuração e pricing usados

| Papel | Modelo | Qualidade | `image_unit_usd` | Estimativa/chamada | Pricing version |
|---|---|---|---:|---:|---|
| principal | `gpt-image-2.5-sunburst` | `medium` | 0,044 | 0,110 | `386fb02c-b0e8-4ec9-a8c6-573b4ca58f19` |
| fallback | `gpt-image-2` | `low` | 0,042 | 0,105 | `d25c9ecc-0c91-44db-a4b9-e057a0a78215` |

Config version: `0c8925d5-5aff-4c90-a007-9dd32750b80f`.

## 3. Resultado real da prova

| Métrica | Valor |
|---|---|
| Chamadas executadas | **8/8** |
| Custo total cobrado contra o teto (conservador) | **US$ 0,860000** de US$ 3,00 |
| Custo real apurado (usage) | **US$ 0,211210** |
| Estimativa das chamadas com custo real | **US$ 0,860000** |
| Desvio real vs. estimativa | **−US$ 0,648790** |
| Maior razão custo real/estimado | **0,284955** |
| Unknown | **0** |
| Custo não apurado | **0** |
| Dimensão divergente | **0** |
| Retries automáticos do SDK | **0** (`maxRetries: 0`) |

## 4. Custo real por chamada

| # | Modelo/qualidade | Tamanho | Custo real (usage) | Estimativa | Razão |
|---:|---|---|---:|---:|---:|
| 1 | `gpt-image-2.5-sunburst` / `medium` | `1152x2048` | 0,029185 | 0,110 | 0,2653 |
| 2 | `gpt-image-2.5-sunburst` / `medium` | `1152x2048` | 0,029185 | 0,110 | 0,2653 |
| 3 | `gpt-image-2.5-sunburst` / `medium` | `1152x2048` | 0,029185 | 0,110 | 0,2653 |
| 4 | `gpt-image-2.5-sunburst` / `medium` | `1024x1024` | 0,031345 | 0,110 | 0,2849 |
| 5 | `gpt-image-2` / `low` | `1152x2048` | 0,022785 | 0,105 | 0,2170 |
| 6 | `gpt-image-2` / `low` | `1152x2048` | 0,022785 | 0,105 | 0,2170 |
| 7 | `gpt-image-2` / `low` | `1152x2048` | 0,022785 | 0,105 | 0,2170 |
| 8 | `gpt-image-2` / `low` | `1024x1024` | 0,023955 | 0,105 | 0,2281 |

Todas as chamadas devolveram exatamente a dimensão solicitada
(`1152×2048` nas amostras e `1024×1024` nos controles).

## 5. Veredito

**Confirmado conservador.** O custo real (US$ 0,211210) ficou **abaixo** da estimativa
(US$ 0,860000); a maior razão real/estimado foi **0,284955**. O multiplicador **2,5** permanece
válido como estimativa pré-chamada conservadora.

O valor cobrado contra o teto foi US$ 0,86 porque o orçamento cobra o MAIOR custo conhecido
(estimativa × real); isso preserva o teto, mas não é o custo real. A calibração usa o custo real
apurado por usage, não o valor cobrado.

**Nenhum ajuste automático foi aplicado.** A folga observada (~3,5×) pode justificar uma redução
futura do multiplicador, mas isso exige decisão explícita e nova versão de pricing — fora desta
prova.

## 6. Critério de confirmação futura

- Se o maior custo real conhecido não superar a estimativa, o multiplicador 2,5 é **confirmado conservador**.
- Se superar, o relatório deve propor `multiplicador >= 2,5 × (maior razão custo real/estimado)`.
- Qualquer `unknown` exige **reconciliação** antes de nova chamada.
- Qualquer `unsupported_dimension` ou `dimension_mismatch` **para a prova** e exige revisão da
  configuração; não há troca silenciosa de modelo/qualidade.
- Combinações não executadas permanecem **`pending`**.

## 7. Limites

- A calibração é da prova técnica; não é orçamento de UAT nem de produção.
- Nenhuma configuração, catálogo, tabela ou tarifa exclusiva de 9:16 foi criada.
- UAT funcional e produção **não estão autorizadas** por esta prova.
