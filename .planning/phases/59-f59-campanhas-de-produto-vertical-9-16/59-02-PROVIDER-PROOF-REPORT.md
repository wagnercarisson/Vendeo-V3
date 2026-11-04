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
| Ambiente alvo | homolog (`vendeo-homolog`) |
| Loja | loja de teste autorizada (definir no aceite) |
| Credencial | chave de homolog existente (não criar/usar produção) |
| Provider | `openai.images.edit` via `UpstreamImagesAdapter` |
| Produção | **proibida** |
| Banco/flag/migration | **não escritos** |

**Ambiente não executado:** nenhuma chamada foi feita; a linha acima é o alvo proposto.

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

Nenhum valor de custo real é inferido a partir do dry-run.

## 6. Evidência

- O harness grava JSON incremental apenas em `--apply`.
- Nesta rodada, **nenhum arquivo de evidência de chamada foi criado**.
- Nenhum prompt, chave, byte de imagem ou conteúdo do usuário foi registrado.

## 7. Itens obrigatórios para o checkpoint pago

1. Confirmar **ambiente = homolog** e **loja de teste**.
2. Confirmar **chave de homolog** e saldo/orçamento disponível.
3. Aprovar o **teto de US$ 3,00** e a matriz derivada (8 chamadas na configuração atual).
4. Confirmar que a configuração/pricing observados são os vigentes no momento da execução.
5. Fornecer os caminhos da imagem primária e, se houver, da identidade.
6. Fornecer o **token literal** de `--authorized`.

## 8. Declarações

- **Nenhuma chamada paga foi executada.**
- **Nenhuma campanha, crédito, banco, flag ou migration foi alterada.**
- **UAT funcional e produção NÃO estão autorizadas** por este relatório.
- O orçamento da prova é **separado** do orçamento da UAT.
- Se uma combinação não suportar `1152x2048`, a prova para e apresenta a evidência; não há troca
  silenciosa de modelo/configuração.

## 9. Próximo passo

Apresentar este relatório no checkpoint humano. Somente após o aceite explícito o executor poderá
rodar `--apply` com o token autorizado, dentro da matriz e do teto acima.
