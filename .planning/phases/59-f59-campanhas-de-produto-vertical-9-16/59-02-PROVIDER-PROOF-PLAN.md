# 59-02 � Plano da prova de provider vertical 9:16

**Versão:** 2 (reutiliza a configuração/pricing compartilhados do 1:1)
**Data:** 2026-11-04
**Estado:** **DRY-RUN CONCLUÍDO � NENHUMA CHAMADA PAGA REALIZADA.**
**Ambiente previsto:** homolog (`vendeo-homolog`), loja de teste autorizada, chave de homolog.
**Proibido:** produção, chave de produção, escrita em banco, flag, migration, campanha real.

## 1. Princípio

A prova **NÒO cria** catálogo, seleção, tabela de preços, tarifa ou configuração exclusiva de 9:16.
Ela reutiliza integralmente:

1. o par principal/fallback e as qualidades da **mesma** `image_model_pair_config`
   (`scope = new_flow`) usada pelo fluxo 1:1;
2. a **mesma** linha vigente de `ai_model_pricing` por `provider + model + quality`
   (`effective_until IS NULL`) usada pelo 1:1, incluindo `image_unit_usd`, tarifas de token e
   `id` da linha (versão de pricing).

Se a configuração estiver ausente/incompleta/divergente, ou um par não tiver pricing aplicável,
a prova **falha fechado** e apresenta a evidência; nunca inventa matriz, preço ou troca a
configuração.

## 2. Configuração efetiva observada (2026-11-04)

Fonte: `image_model_pair_config` local (`scope = new_flow`), lida em modo somente leitura.

| Papel | Modelo | Qualidade | `image_unit_usd` | Pricing version |
|---|---|---|---:|---|
| principal | `gpt-image-2.5-sunburst` | `medium` | 0,044 | `386fb02c-b0e8-4ec9-a8c6-573b4ca58f19` |
| fallback | `gpt-image-2` | `low` | 0,042 | `d25c9ecc-0c91-44db-a4b9-e057a0a78215` |

**Config version:** `0c8925d5-5aff-4c90-a007-9dd32750b80f` (origem `human_decision`).

> Esta tabela é uma **fotografia** da fonte vigente, não uma lista fixa. O harness deriva a matriz
> a cada execução; se a configuração mudar, a matriz e as estimativas mudam com ela.

## 3. Matriz derivada (8 chamadas)

Regra: **3 amostras `1152x2048` + 1 controle `1024x1024` por par único configurado**.
Pares repetidos entre principal/fallback são deduplicados.

| # | Modelo | Qualidade | Tamanho | Papel | Estimativa |
|---:|---|---|---|---|---:|
| 1�3 | `gpt-image-2.5-sunburst` | `medium` | `1152x2048` | principal | 0,110 cada |
| 4 | `gpt-image-2.5-sunburst` | `medium` | `1024x1024` | principal | 0,110 |
| 5�7 | `gpt-image-2` | `low` | `1152x2048` | fallback | 0,105 cada |
| 8 | `gpt-image-2` | `low` | `1024x1024` | fallback | 0,105 |

**Total estimado:** **US$ 0,86** · **Teto:** **US$ 3,00**.
**Chamadas planejadas:** **8** (derivadas da configuração acima).

Retries e fallback contam na matriz e no teto. Combinação não executada por orçamento/erro fica
explicitamente **`pending`** (nunca �Scomprovada⬝).

## 4. Estimativa pré-chamada � custo final

- `estimatedUsd = image_unit_usd real da fonte compartilhada � 2,5`.
- **`2,5`** é PROVIS�RIO e conservador: **2,25** (razão de área 1152�2048 / 1024�1024) + **0,25**
  de margem. Versão: `f59-vertical-9-16-v1`.
- A estimativa é separada do custo final: `providerReportedUsd` e `calculatedFromUsageUsd` são
  coletados por chamada; o orçamento cobra o **maior** custo conhecido.
- O valor 2,5 não é custo real; a calibração só confirma ou propõe ajuste após a medição.

## 5. Insumos de referência

Ordem: **`[primary, identity]`**.

1. **Primária:** 1 imagem real de produto da loja de teste autorizada.
2. **Identidade:** 1 imagem de identidade da mesma loja, se existir.

- Formato: data URL (`data:image/png;base64,...`), montada em memória.
- Se a identidade não existir: registrar **`identityImageUrl: ausente`** e executar somente com a primária.
- **NUNCA fabricar identidade**, logo ou produto.
- Nenhum byte de imagem é persistido na evidência.

## 6. Prompt

`promptSource: "fixed"`.

A prova é focada em PROVIDER/CUSTO e usa um briefing fixture FIXO e versionado no harness,
derivado do baseline 1:1. O harness **não** importa `prompt/composition` nem
`composeVerticalProductPrompt`; a composição vertical real é exercitada nos planos de
composição/geração.

## 7. Comandos

### Dry-run (seguro, sem provider)

```powershell
npx tsx --tsconfig tsconfig.json scripts/f59/vertical-provider-proof.ts --dry-run
```

Lê `image_model_pair_config`/`ai_model_pricing` da instância configurada em `.env.local`
(ou `--dotenv=<arquivo>`), deriva a matriz e imprime pares, versões, estimativas e teto.
NÒO chama provider.

### Apply (somente com autorização humana registrada)

```powershell
npx tsx --tsconfig tsconfig.json scripts/f59/vertical-provider-proof.ts `
  --apply --authorized=<token-literal-do-responsavel> `
  --primary-image=<caminho-da-imagem-primaria> `
  [--identity-image=<caminho-da-imagem-de-identidade>] `
  [--dotenv=.env.local]
```

Exige, cumulativamente:

- `--apply`;
- `--authorized=<token>` não vazio;
- `OPENAI_API_KEY` de homolog presente (nunca impressa);
- configuração e pricing compartilhados legíveis;
- imagem primária legível.

Sem qualquer um desses itens: exit **2** com
**`PROVA NÒO AUTORIZADA - NENHUMA CHAMADA EXECUTADA`**.

## 8. Critérios de aceite por chamada

| Critério | Evidência |
|---|---|
| Request aceito | `status = succeeded` |
| Bytes decodificáveis | decode completo via `sharp` |
| Dimensão real registrada | `returnedWidth � returnedHeight` |
| Sem evidência de crop | dimensão devolvida registrada; desvio de proporção explícito |
| Custo dentro do teto | `chargedUsd` e `remainingUsd` |
| Fallback observável | `target`/`isRetry` registrados |
| Custo vs estimativa | `estimatedUsd`, `providerReportedUsd`, `calculatedFromUsageUsd`, `deviationUsd` |
| Rastreabilidade | `model`, `quality`, versão da configuração e versão de pricing |

## 9. Regras de parada

- **Orçamento insuficiente:** PARA antes da próxima chamada; restantes ficam `pending`.
- **Resultado `unknown`** (timeout/abort/erro sem usage): persistir `unknown`, cobrar a estimativa
  conservadora, marcar `requiresReconciliation: true`, **PARAR** e exigir reconciliação.
  **Nenhum retry cego.**
- **Dimensão vertical não suportada:** persistir `unsupported_dimension` com a evidência do
  provider, **PARAR** e exigir revisão. **Nunca trocar modelo, qualidade ou configuração.**
- **Dimensão inesperada:** registrar falha fechada; não há upscale, crop, pad ou aceite silencioso.

## 10. Evidências e separação de orçamento

Evidência incremental em `scripts/f59/evidence/vertical-provider-proof-<runId>.json`, com:

`configVersionId`, `origin`, `model`, `quality`, `pricingVersionId`, `requestedSize`,
`returnedWidth`, `returnedHeight`, `latencyMs`, `providerReportedUsd`, `calculatedFromUsageUsd`,
`estimatedUsd`, `chargedUsd`, `deviationUsd`, `target`, `isRetry`, `status`, `startedAt`,
`finishedAt`.

**Nunca** registra prompt, chave, bytes de imagem ou conteúdo do usuário.

O orçamento da prova é **separado** do orçamento da UAT funcional; nenhuma despesa de UAT entra
no teto de US$ 3,00.

## 11. Gate humano pendente

A execução paga é um **checkpoint humano bloqueante**. Antes dela, o responsável deve confirmar:
ambiente = homolog, loja de teste, chave de homolog, saldo suficiente, teto aprovado e o token
literal de `--authorized`. Sem esse aceite, a prova permanece **`pending`**.
