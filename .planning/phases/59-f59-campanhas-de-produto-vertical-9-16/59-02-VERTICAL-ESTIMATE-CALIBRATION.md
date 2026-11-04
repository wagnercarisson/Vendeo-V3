# 59-02 — Calibração do multiplicador vertical

**Status:** **NÃO CALIBRADO — nenhuma chamada paga executada.**
**Multiplicador provisório:** **2,5** (razão de área **2,25** + margem de segurança **0,25**).
**Versão:** `f59-vertical-9-16-v1`.

## 1. Regra pré-definida

`estimado = image_unit_usd × 2,5`

O multiplicador foi definido **antes** da primeira chamada paga. A calibração posterior só pode
confirmar o valor ou propor ajuste com evidência; nunca reescrever retroativamente a regra.

## 2. Evidência disponível

| Chamadas | Custo estimado | Custo reportado | Custo calculado | Desvio |
|---:|---|---|---|---|
| 0 | — | — | — | — |

Nenhuma linha de chamada real existe. Não há base para confirmar ou ajustar o multiplicador.

## 3. Veredito

**Não calibrado.** O valor **2,5** permanece provisório e conservador até a execução da matriz de
**14** chamadas em homolog, dentro do teto de **US$ 3,00**.

## 4. Critério de confirmação futura

- Se o maior custo real conhecido não superar a estimativa, o multiplicador 2,5 é **confirmado conservador**.
- Se superar, o relatório deve propor `multiplicador >= 2,5 × (maior razão cobrado/estimado)`.
- Qualquer `unknown` exige **reconciliação** antes de nova chamada.
- Combinações não executadas permanecem **`pending`**; o relatório nunca as trata como comprovadas.

## 5. Limites

- A calibração é da prova técnica; não é orçamento de UAT nem de produção.
- Nenhum custo real é inferido do dry-run.
