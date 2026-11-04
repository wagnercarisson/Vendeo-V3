# 59-02 — Plano da prova de provider vertical 9:16

**Versão:** 1 (dry-run preparado em 2026-11-04)
**Estado:** **NÃO EXECUTADA — nenhuma chamada paga realizada.**
**Ambiente previsto:** homolog (`vendeo-homolog`), loja de teste autorizada, chave de homolog.
**Proibido:** produção, chave de produção, banco, flag, migration, campanha real.

## 1. Objetivo

Provar, antes de consolidar o pipeline vertical, que `openai.images.edit` aceita o tamanho
**`1152x2048`** e devolve bytes 9:16 decodificáveis, com dimensão real, custo e falhas observáveis.
O controle **`1024x1024`** de cada modelo isola o efeito do tamanho novo.

## 2. Matriz (14 chamadas planejadas)

| Modelo | Qualidade | Amostras `1152x2048` | Controle `1024x1024` |
|---|---|---:|---:|
| `gpt-image-2.5-sunburst` | `low` | 3 | 1 |
| `gpt-image-2.5-sunburst` | `medium` | 3 | — |
| `gpt-image-2` | `low` | 3 | 1 |
| `gpt-image-2` | `medium` | 3 | — |

- **Amostras:** 3 por combinação modelo × qualidade = 12.
- **Controles:** 1 por modelo = 2.
- **Total:** **14 chamadas planejadas**.
- Retries e fallback contam na matriz e no teto.
- Combinação não executada por orçamento/erro fica explicitamente **`pending`** (nunca “comprovada”).

## 3. Teto e estimativa pré-definida

- **Teto da prova:** **US$ 3,00** (três dólares), separado do orçamento da UAT funcional.
- **Estimativa vertical:** `estimado = image_unit_usd × 2,5`.
  - **`2,5`** é PROVISÓRIO e conservador: **2,25** (razão de área 1152×2048 / 1024×1024) + **0,25** de margem.
  - Versão: `f59-vertical-9-16-v1`.
  - O valor só é calibrado DEPOIS da medição; nunca é apresentado como custo real.
- Antes de cada chamada: `canAfford`/`remainingBudgetBlocks`; sem saldo ⇒ PARA e marca restantes como `pending`.
- Cobrança: sempre o **maior** custo conhecido (`providerReportedUsd`, `calculatedFromUsageUsd` ou `estimatedUsd`).

## 4. Insumos de referência

Ordem de referências: **`[primary, identity]`**.

1. **Primária:** 1 imagem real de produto da loja de teste autorizada.
2. **Identidade:** 1 imagem de identidade da mesma loja, se existir.

- Formato de envio: data URL (`data:image/png;base64,...`), montada em memória pelo harness.
- Se a identidade não existir: registrar **`identityImageUrl: ausente`** e executar somente com a primária.
- **NUNCA fabricar identidade**, logo ou produto.
- Nenhum byte de imagem é persistido na evidência.

## 5. Prompt

`promptSource: "fixed"`.

A prova é focada em PROVIDER/CUSTO e usa um briefing fixture FIXO e versionado no harness,
derivado do baseline 1:1. O harness **não** importa `prompt/composition` nem
`composeVerticalProductPrompt`; a composição vertical real é exercitada nos planos de
composição/geração. O valor `"vertical"` fica reservado para uma execução futura que já
disponha do compositor.

## 6. Comandos

### Dry-run (seguro, sem provider)

```powershell
npx tsx --tsconfig tsconfig.json scripts/f59/vertical-provider-proof.ts --dry-run --unit-usd=0.03
```

Saída esperada: **14** chamadas, total estimado **0,03 × 2,5 × 14 = 1,05** e teto **US$ 3,00**.

Sem `--unit-usd`/`--unit-usd-file`, o harness imprime a matriz com **“estimativa indisponível”**
e sai com código **2**.

### Apply (somente com autorização humana registrada)

```powershell
npx tsx --tsconfig tsconfig.json scripts/f59/vertical-provider-proof.ts `
  --apply --authorized=<token-literal-do-responsavel> `
  --unit-usd=<valor> `
  --pricing-file=<json-da-linha-ai_model_pricing> `
  --primary-image=<caminho-da-imagem-primaria> `
  [--identity-image=<caminho-da-imagem-de-identidade>]
```

Exige, cumulativamente:

- `--apply`;
- `--authorized=<token>` não vazio;
- `OPENAI_API_KEY` de homolog presente (nunca impressa);
- fonte de `image_unit_usd` (dry-run e apply);
- imagem primária legível.

Sem qualquer um desses itens: exit **2** com
**`PROVA NÃO AUTORIZADA - NENHUMA CHAMADA EXECUTADA`**.

## 7. Fontes de custo

- **Unit cost (`image_unit_usd`):** `--unit-usd=0.03` ou `--unit-usd-file` no formato
  `{"modelo|qualidade": valor}`. Obrigatório nos dois modos; nunca inventado.
- **Token pricing (`ai_model_pricing`):** `--pricing-file` com a linha real
  (`input_token_usd_per_1m`, `output_token_usd_per_1m`, `cached_input_token_usd_per_1m`,
  `image_unit_usd`, `image_token_usd_per_1m`, `image_input_token_usd_per_1m`,
  `image_cached_input_token_usd_per_1m`, `version_id`/`id`).
  - Sem o arquivo, `calculatedFromUsageUsd` fica `null` (não inventado) e o relatório registra `calc: null`.
  - Se, ao final, não houver custo reportado, calculado nem usage, o resultado é **`cost_unknown`** e a prova PARA.

## 8. Critérios de aceite por chamada

| Critério | Evidência |
|---|---|
| Request aceito | `status = succeeded` |
| Bytes decodificáveis | decode completo via `sharp` |
| Dimensão real registrada | `returnedWidth × returnedHeight` |
| Sem evidência de crop | dimensão devolvida registrada; desvio de proporção explícito |
| Custo dentro do teto | `chargedUsd` e `remainingUsd` |
| Fallback observável | `target`/`isRetry` registrados |
| Custo vs estimativa | `estimatedUsd`, `providerReportedUsd`, `calculatedFromUsageUsd`, `deviationUsd` |

## 9. Regras de parada

- **Orçamento insuficiente:** PARA antes da próxima chamada; restantes ficam `pending`.
- **Resultado `unknown`** (timeout/abort/erro sem usage): persistir `unknown`, cobrar a estimativa
  conservadora, marcar `requiresReconciliation: true`, **PARAR** e exigir reconciliação.
  **Nenhum retry cego.**
- **Dimensão inesperada:** registrar falha fechada; não há upscale, crop, pad ou aceite silencioso.
- **Combinação que não produza 9:16:** excluída COM evidência; nunca substituída silenciosamente.

## 10. Evidências e separação de orçamento

Evidência incremental em `scripts/f59/evidence/vertical-provider-proof-<runId>.json`, com:

`model`, `quality`, `requestedSize`, `returnedWidth`, `returnedHeight`, `latencyMs`,
`providerReportedUsd`, `calculatedFromUsageUsd`, `estimatedUsd`, `chargedUsd`, `deviationUsd`,
`target`, `isRetry`, `status`, `startedAt`, `finishedAt`.

**Nunca** registra prompt, chave, bytes de imagem ou conteúdo do usuário.

O orçamento da prova é **separado** do orçamento da UAT funcional; nenhuma despesa de UAT entra
no teto de US$ 3,00.

## 11. Gate humano pendente

A execução paga é um **checkpoint humano bloqueante**. Antes dela, o responsável deve confirmar:
ambiente = homolog, loja de teste, chave de homolog, saldo suficiente, teto aprovado e o token
literal de `--authorized`. Sem esse aceite, a prova permanece **`pending`**.
