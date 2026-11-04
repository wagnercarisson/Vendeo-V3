# 59-02 — Calibração do multiplicador vertical

**Status:** **NÃO CALIBRADO — nenhuma chamada paga executada.**
**Multiplicador provisório:** **2,5** (razão de área **2,25** + margem de segurança **0,25**).
**Versão:** `f59-vertical-9-16-v1`.

## 1. Regra pré-definida

`estimado = image_unit_usd × 2,5`

O `image_unit_usd` é a tarifa REAL da fonte compartilhada (`ai_model_pricing` vigente por
modelo+qualidade) — a mesma usada pelo fluxo 1:1. O multiplicador foi definido **antes** da
primeira chamada paga; a calibração posterior só pode confirmar ou propor ajuste com evidência.

## 2. Configuração e pricing observados (dry-run)

| Papel | Modelo | Qualidade | `image_unit_usd` | Estimativa/chamada | Pricing version |
|---|---|---|---:|---:|---|
| principal | `gpt-image-2.5-sunburst` | `medium` | 0,044 | 0,110 | `386fb02c-b0e8-4ec9-a8c6-573b4ca58f19` |
| fallback | `gpt-image-2` | `low` | 0,042 | 0,105 | `d25c9ecc-0c91-44db-a4b9-e057a0a78215` |

Config version: `0c8925d5-5aff-4c90-a007-9dd32750b80f`.

## 3. Evidência disponível

| Chamadas | Custo estimado | Custo reportado | Custo calculado | Desvio |
|---:|---|---|---|---|
| 0 | US$ 0,86 (matriz derivada) | — | — | — |

Nenhuma linha de chamada real existe. Não há base para confirmar ou ajustar o multiplicador.

## 4. Veredito

**Não calibrado.** O valor **2,5** permanece provisório e conservador até a execução da matriz
derivada da configuração efetiva do 1:1, dentro do teto de **US$ 3,00**.

## 5. Critério de confirmação futura

- Se o maior custo real conhecido não superar a estimativa, o multiplicador 2,5 é **confirmado conservador**.
- A confirmação EXIGE custo real apurado (reportado ou calculado por usage). Sem nenhum deles, o
  resultado é `cost_unverified`: a prova para e exige reconciliação.
- Dimensão devolvida divergente é `dimension_mismatch`: reprova a chamada, preserva o custo e para a
  prova.
- Se superar, o relatório deve propor `multiplicador >= 2,5 × (maior razão cobrado/estimado)`.
- Qualquer `unknown` exige **reconciliação** antes de nova chamada.
- Qualquer `unsupported_dimension` **para a prova** e exige revisão da configuração; não há troca
  silenciosa de modelo/qualidade.
- Combinações não executadas permanecem **`pending`**; o relatório nunca as trata como comprovadas.

## 6. Limites

- A calibração é da prova técnica; não é orçamento de UAT nem de produção.
- Nenhum custo real é inferido do dry-run.
- Nenhuma configuração, catálogo, tabela ou tarifa exclusiva de 9:16 é criada.
