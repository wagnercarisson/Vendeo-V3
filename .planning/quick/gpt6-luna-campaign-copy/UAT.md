# Quick gpt6-luna — UAT da janela local (sessão manual)

**Escopo:** `vendeo-homolog` local. Autorização estreita `isolated_pilot`+`test_stores`; cap **US$3,00**
(base 1,00 + **adicional US$2,00**); `test_stores=true`; `all_stores=false`. **Produção desligada; B2.3 intacta.**

## Seleções vigentes (via admin, pelo responsável)
- **Copy:** `campaign_copy` → **`openai/gpt-6-luna`** (chat-completions; sem fallback). *(1ª operação rodou em `gpt-4o`; as demais em `gpt-6-luna`.)*
- **Imagem:** par **`gpt-image-2.5-flare/medium`** + **`gpt-image-2/low`** (pricing completo).

## Execuções (calls por operação; provider real)
| # | imagem | copy | custo (estim.) |
|---|--------|------|----------------|
| 1 | `image_primary` 0,136 | `copy_initial` 0,0200 (gpt-4o) | 0,156 |
| 2 | `image_primary` 0,044 (flare med) | `copy_initial` 0,0007 (Luna) | 0,0447 |
| 3 | `image_primary` 0,044 (flare med) | `copy_initial` 0,0007 (Luna) | 0,0447 |

Todas **`released`**; **sem `unknown`**, sem fallback, sem retry. `copy_initial` de Luna = **0,0007** (derivada do
pricing do alvo: 2000×0,10 + 1000×0,50 /1e6).

## Gasto / ledger (antes → depois)
- **`spent`:** 0,156 → **0,2454** (Δ ≈ **0,0894**); **`cap` = 3,00**.
- **Ledger de crédito:** operações `delivered`/`published` (1 crédito cada).

## Campanhas preservadas (inspeção)
- `20d54b1d-…` “Red Bull Summer 250ml **Figo & Maçã**” (sessão anterior).
- `6ecef78c-…` e `e043e52e-…` “Red Bull Summer 250ml **Morango & Pêssego**” (janela do Luna).

## Estado final DESLIGADO
- Flag `product_1_1_test_stores_enabled=false`; `all_stores=false`; **autorização revogada** (`habilitadora_vigente=0`);
  **geração pausada** (`VENDEO_GENERATION_PAUSED=true`); Next religado.
- **Sem** produção/deploy; **sem** reabrir/incrementar a B2.3; contadores intactos.

## Nota
Números do painel podem não estar todos disponíveis ainda; **não** foram feitas novas gerações para buscá-los.
