# 59-02 — Relatório da prova de provider vertical 9:16

**Data:** 2026-11-04
**Status:** **DRY-RUN CONCLUÍDO — NENHUMA CHAMADA PAGA EXECUTADA.**
**Checkpoint:** aguardando autorização humana específica para a matriz paga.

## 1. Ambiente

| Item | Situação |
|---|---|
| Ambiente alvo | homolog (`vendeo-homolog`) |
| Loja | loja de teste autorizada (definir no aceite) |
| Credencial | chave de homolog existente (não criar/usar produção) |
| Provider | `openai.images.edit` via `UpstreamImagesAdapter` |
| Produção | **proibida** |
| Banco/flag/migration | **não tocados** |

**Ambiente não executado:** nenhuma chamada foi feita; a linha acima é o alvo proposto, não uma
execução.

## 2. Matriz planejada (14 chamadas)

| # | Modelo | Qualidade | Tamanho | Tipo | Status |
|---:|---|---|---|---|---|
| 1–3 | `gpt-image-2.5-sunburst` | `low` | `1152x2048` | amostra | `pending` |
| 4–6 | `gpt-image-2.5-sunburst` | `medium` | `1152x2048` | amostra | `pending` |
| 7 | `gpt-image-2.5-sunburst` | `low` | `1024x1024` | controle | `pending` |
| 8–10 | `gpt-image-2` | `low` | `1152x2048` | amostra | `pending` |
| 11–13 | `gpt-image-2` | `medium` | `1152x2048` | amostra | `pending` |
| 14 | `gpt-image-2` | `low` | `1024x1024` | controle | `pending` |

**Todas as 14 combinações estão `pending`.** Nenhuma combinação foi comprovada.

## 3. Dry-run observado

Comando executado:

```powershell
npx tsx --tsconfig tsconfig.json scripts/f59/vertical-provider-proof.ts --dry-run --unit-usd=0.03
```

Resultado:

- chamadas planejadas: **14**;
- estimativa por chamada: **0,075000** (0,03 × 2,5);
- total estimado: **US$ 1,050000**;
- teto: **US$ 3,00**;
- chamadas ao provider: **0**;
- exit code: **0**.

A fonte `--unit-usd=0.03` é apenas um exercício de dry-run. No apply, a fonte real de
`image_unit_usd` deve ser fornecida pelo operador (`--unit-usd` ou `--unit-usd-file`) e conferida
no checkpoint.

## 4. Custos por chamada (campos a preencher no apply)

| Campo | Situação nesta rodada |
|---|---|
| `estimatedUsd` | 0,075000 (estimativa provisória de dry-run) |
| `providerReportedUsd` | **null** — nenhuma chamada |
| `calculatedFromUsageUsd` | **null** — nenhuma chamada; token pricing não fornecido |
| `chargedUsd` | **0** — nenhuma chamada |
| `deviationUsd` | **0** |
| `unknown` | **0** — nenhum resultado desconhecido |

Nenhum valor de custo real é inferido a partir do dry-run.

## 5. Evidência

- O harness grava JSON incremental apenas em `--apply`.
- Nesta rodada, **nenhum arquivo de evidência de chamada foi criado**.
- Nenhum prompt, chave, byte de imagem ou conteúdo do usuário foi registrado.

## 6. Itens obrigatórios para o checkpoint pago

1. Confirmar **ambiente = homolog** e **loja de teste**.
2. Confirmar **chave de homolog** e saldo/orçamento disponível.
3. Aprovar o **teto de US$ 3,00** e a matriz de 14 chamadas.
4. Fornecer/confirmar a fonte real de `image_unit_usd` por modelo+qualidade.
5. Fornecer o `--pricing-file` da linha `ai_model_pricing` (para `calculatedFromUsageUsd`).
6. Fornecer os caminhos da imagem primária e, se houver, da identidade.
7. Fornecer o **token literal** de `--authorized`.

## 7. Declarações

- **Nenhuma chamada paga foi executada.**
- **Nenhuma campanha, crédito, banco, flag ou migration foi alterada.**
- **UAT funcional e produção NÃO estão autorizadas** por este relatório.
- O orçamento da prova é **separado** do orçamento da UAT.

## 8. Próximo passo

Apresentar este relatório no checkpoint humano. Somente após o aceite explícito o executor poderá
rodar `--apply` com o token autorizado, dentro da matriz e do teto acima.
