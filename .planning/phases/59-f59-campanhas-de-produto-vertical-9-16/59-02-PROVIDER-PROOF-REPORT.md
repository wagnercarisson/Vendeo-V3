# 59-02 — Relatório da prova de provider vertical 9:16

**Data:** 2026-11-04
**Status:** **DRY-RUN CONCLUÍDO — NENHUMA CHAMADA PAGA EXECUTADA.**
**Checkpoint:** aguardando autorização humana específica para a matriz paga.

## 1. Fonte compartilhada (reutilizada integralmente)

| Item | Valor observado |
|---|---|
| Tabela de configuração | `image_model_pair_config` (`scope = new_flow`) |
| Config version | `0c8925d5-5aff-4c90-a007-9dd32750b80f` |
| Origem | `human_decision` |
| Primário | `gpt-image-2.5-sunburst` / `medium` |
| Fallback | `gpt-image-2` / `low` |
| Tabela de pricing | `ai_model_pricing` (vigente, `effective_until IS NULL`) |
| Pricing principal | `386fb02c-b0e8-4ec9-a8c6-573b4ca58f19` — `image_unit_usd` 0,044 |
| Pricing fallback | `d25c9ecc-0c91-44db-a4b9-e057a0a78215` — `image_unit_usd` 0,042 |

Nenhum catálogo, seleção, tabela ou tarifa exclusiva de 9:16 foi criado. A leitura foi somente
leitura; nenhuma escrita em banco, flag ou campanha.

## 2. Ambiente

| Item | Situação |
|---|---|
| Ambiente | local/homolog `127.0.0.1:57781` (Supabase local; sem produção) |
| Loja | `Loja Mega Vale` (`3dc7d274-0b57-45ba-883a-7b235056feda`), `is_test_store = true` |
| Credencial | `OPENAI_API_KEY` presente no `.env.local` (não exibida; não é chave de produção) |
| Provider | `openai.images.edit` via `UpstreamImagesAdapter` |
| Produção | **proibida** |
| Banco/flag/migration | **não escritos** |

**Ambiente não executado:** nenhuma chamada foi feita; a linha acima é o alvo proposto.

## 2.1 Insumos escolhidos para o checkpoint

**Loja de teste:** `Loja Mega Vale` — `3dc7d274-0b57-45ba-883a-7b235056feda`.

| Insumo | Origem | Arquivo local | Metadados |
|---|---|---|---|
| Primária | `campaign-images/3dc7d274.../0193e1ad.../inputs/7dd7057c-...jpg` | `C:\Users\wagne\AppData\Local\Temp\f59-proof-inputs\primary.jpg` | JPEG, 1080×1080, sRGB, 248.650 B, SHA-256 `307538f1…d0b62d1d` |
| Identidade | `visual-signatures/3dc7d274.../270a11b4-...png` | `C:\Users\wagne\AppData\Local\Temp\f59-proof-inputs\identity.png` | PNG, 1024×1024, sRGB, 810.119 B, SHA-256 `c0dd2d5b…bdbf07d8` |

- Produto da primária: **Fone Bluetooth NovaSound X1** (campanha `0193e1ad-eda0-49c7-946e-c10b4c0ed4e4`).
- A identidade é a assinatura visual da loja; o SHA-256 coincide com a referência congelada `c0dd2d5b…` do `input_snapshot`.
- Nenhum byte de imagem foi persistido no repositório; os arquivos ficam apenas no diretório temporário acima.
- A chave `OPENAI_API_KEY` está presente no `.env.local` (valor não exibido; `process.env` não a contém).

## 3. Matriz derivada (8 chamadas)

| # | Modelo | Qualidade | Tamanho | Papel | Status |
|---:|---|---|---|---|---|
| 1–3 | `gpt-image-2.5-sunburst` | `medium` | `1152x2048` | principal | `pending` |
| 4 | `gpt-image-2.5-sunburst` | `medium` | `1024x1024` | principal | `pending` |
| 5–7 | `gpt-image-2` | `low` | `1152x2048` | fallback | `pending` |
| 8 | `gpt-image-2` | `low` | `1024x1024` | fallback | `pending` |

**Todas as 8 chamadas estão `pending`.** Nenhuma combinação foi comprovada.
A matriz é derivada da configuração vigente; se ela mudar, a matriz muda com ela.

## 4. Dry-run observado

```powershell
npx tsx --tsconfig tsconfig.json scripts/f59/vertical-provider-proof.ts --dry-run
```

Resultado:

- chamadas planejadas: **8** (3 amostras + 1 controle por par único);
- estimativa principal: **0,110000** por chamada (0,044 × 2,5);
- estimativa fallback: **0,105000** por chamada (0,042 × 2,5);
- total estimado: **US$ 0,860000**;
- teto: **US$ 3,00**;
- chamadas ao provider: **0**;
- exit code: **0**.

## 5. Custos por chamada (campos a preencher no apply)

| Campo | Situação nesta rodada |
|---|---|
| `estimatedUsd` | 0,110000 (principal) / 0,105000 (fallback) |
| `providerReportedUsd` | **null** — nenhuma chamada |
| `calculatedFromUsageUsd` | **null** — nenhuma chamada |
| `chargedUsd` | **0** — nenhuma chamada |
| `deviationUsd` | **0** |
| `unknown` | **0** |
| `unsupported_dimension` | **0** |
| `dimension_mismatch` | **0** |
| `cost_unverified` | **0** |
| Retries automáticos do SDK | **0** (`maxRetries: 0` no loader da prova) |

Nenhum valor de custo real é inferido a partir do dry-run.

## 6. Evidência

- O harness grava JSON incremental apenas em `--apply`.
- Nesta rodada, **nenhum arquivo de evidência de chamada foi criado**.
- Nenhum prompt, chave, byte de imagem ou conteúdo do usuário foi registrado.

## 7. Itens obrigatórios para o checkpoint pago

1. Confirmar **ambiente local/homolog** (`127.0.0.1:57781`) e a **Loja Mega Vale** como loja de teste.
2. Confirmar a **chave de homolog** presente no `.env.local` e o saldo/orçamento disponível.
3. Aprovar o **teto de US$ 3,00** e a matriz derivada de **8 chamadas**.
4. Aprovar os insumos escolhidos: primária `primary.jpg` (Fone Bluetooth NovaSound X1) e identidade `identity.png` (assinatura da Loja Mega Vale).
5. Confirmar que configuração/pricing observados são os vigentes no momento da execução.
6. Fornecer o **token literal** de `--authorized`.

## 8. Declarações

- **Nenhuma chamada paga foi executada.**
- **Nenhuma campanha, crédito, banco, flag ou migration foi alterada.**
- **UAT funcional e produção NÃO estão autorizadas** por este relatório.
- O orçamento da prova é **separado** do orçamento da UAT.
- Se uma combinação não suportar `1152x2048`, a prova para e apresenta a evidência; não há troca
  silenciosa de modelo/configuração.

## 8.1 Comando final proposto

```powershell
npx tsx --tsconfig tsconfig.json scripts/f59/vertical-provider-proof.ts `
  --apply `
  --authorized=<token-literal-do-responsavel> `
  --primary-image="C:\Users\wagne\AppData\Local\Temp\f59-proof-inputs\primary.jpg" `
  --identity-image="C:\Users\wagne\AppData\Local\Temp\f59-proof-inputs\identity.png"
```

- A credencial é lida do `.env.local` e passada explicitamente ao loader da prova.
- `maxRetries: 0` e a credencial validada já estão no harness.
- O comando só deve ser executado após o aceite explícito dos insumos e do gasto.

## 9. Próximo passo

Apresentar este relatório no checkpoint humano. Somente após o aceite explícito o executor poderá
rodar `--apply` com o token autorizado, dentro da matriz e do teto acima.
