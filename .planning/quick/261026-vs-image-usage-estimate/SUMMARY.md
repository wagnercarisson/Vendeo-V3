---
status: complete
date: 2026-10-26
quick_id: 261026
slug: vs-image-usage-estimate
branch: feature/fase-47-1-modelos-assinatura-visual
phase: quick
type: execute
tasks_completed: 6/6
db_touched: false
provider_touched: false
env_touched: false
migrations_touched: false
code_commit: 43652290
gap_closure_commit: b46fd472
usage_aggregate_commit: 563e1a09
---

# Quick 261026 — Estimativa versionada do consumo da imagem da Assinatura Visual

## One-liner

As novas gerações da Assinatura Visual com configuração dedicada válida passam a
somar **tokens reais do orquestrador** + **estimativa versionada
`vs-image-usage-v1` da imagem** (350/400 entrada textual e 250/500 saída de
imagem), precificadas pelas tarifas vigentes de `ai_model_pricing`, registradas
separadamente no metadata JSONB e exibidas no admin como **Estimado** — sem
US$ 0,065, sem `provider_reported`, sem recalcular histórico.

## Formula aplicada

```
estimated_cost_usd =
  componente_texto_orquestrador (tokens REAIS do provider)
  + componente_estimado_imagem (tokens estimados vs-image-usage-v1)

componente_estimado_imagem =
  (input_text_tokens_estimados / 1.000.000) * input_token_usd_per_1m
  + (output_image_tokens_estimados / 1.000.000) * image_token_usd_per_1m
```

Fixture de conferência (entrada textual US$5/M + imagem US$30/M):

| Combinação | Componente estimado da imagem |
|---|---:|
| Flare Low | US$ 0,009250 |
| Flare Medium | US$ 0,016750 |
| Sunburst Low | US$ 0,009500 |
| Sunburst Medium | US$ 0,017000 |

## Pré-checagem do contrato de pricing

- `ai_model_pricing.input_token_usd_per_1m` = entrada textual.
- `ai_model_pricing.image_token_usd_per_1m` = tokens de imagem; neste cálculo,
  saída de imagem.
- `output_token_usd_per_1m` é tarifa textual e NÃO foi usada como saída de
  imagem.
- `image_unit_usd` NÃO foi usada neste cálculo.
- Nenhuma tarifa foi extraída de `source_note`; nenhuma migration/coluna nova.
- Tarifa/dimensão ausente ⇒ `not_available` + nota parcial + `image_usage_missing`
  (sem zero artificial e sem US$ 0,065).

**Caveat de dados (não alterado nesta quick):** as linhas de Flare/Sunburst
foram provisionadas na homolog pela F56.2b2c com `input_token_usd_per_1m = 8`
(tarifa de entrada de imagem) e `image_token_usd_per_1m = 30`. O código lê a
coluna conforme o contrato (entrada textual). Até a próxima atualização de
tarifas, o componente textual da imagem nessas linhas usará 8 US$/M, e não os
5 US$/M de referência. Nenhuma tarifa foi corrigida aqui; a atualização da base
é escopo da quick/cron seguinte.

## Files changed

### Criados

- `src/lib/ai-cost/visual-signature-image-usage.ts` — tabela fechada por
  `modelo+qualidade+tamanho`, versão `vs-image-usage-v1`, data `2026-10-26`,
  origem manual e lookup exato.
- `src/lib/ai-cost/visual-signature-image-cost.ts` — cálculo puro + resolução
  tardia de `ai_model_pricing`; componentes textual/imagem, auditoria,
  parcial/desconhecido.
- `docs/convencoes/estimativa-consumo-imagem-assinatura-visual.md` — convenção,
  fórmula, origem, revisão futura, snapshots, homolog/produção.
- Testes: `visual-signature-image-usage.test.ts`,
  `visual-signature-image-cost.test.ts`,
  `visual-signature-image-cost-sink.test.ts`,
  `gateway-visual-signature-image-usage.test.ts`.

### Modificados

- `src/lib/ai/types.ts` — alvo aditivo `visualSignatureImageUsage` no contexto e
  no envelope (ausente ⇒ legado byte-a-byte).
- `src/lib/ai/gateway.ts` — copia o alvo para o envelope de sucesso e falha.
- `src/lib/ai/telemetry-sink.ts` — aplica o caminho estimado somente em
  `visual_signature_image` com alvo; grava `image_usage_*` no metadata.
- `src/lib/ai-cost/types.ts` — auditoria aditiva em `CostResolution`.
- `src/lib/ai-cost/operation-runs-service.ts` — badge do detalhe: nota completa
  → `estimated`; nota parcial → `partial`; nunca `provider_reported`.
- `src/lib/visual-signature/ai-image-generator.ts` — propaga modelo/qualidade/
  tamanho efetivamente enviados; a validação não herda o alvo.
- Testes de `ai-image-generator`, `operation-runs-service` e componentes admin.

## Escopo preservado

- Caminho legado sem configuração dedicada: sem alvo ⇒ `resolveAiCost` e
  US$ 0,065 intactos.
- Validação e perfil: chamadas separadas, mecanismo atual.
- Campanhas, Produto 1:1, prompts, modelos, qualidade, retries, créditos,
  onboarding, F50.4: intocados.
- Nenhum banco, Docker, Supabase CLI, `psql`, provider, migration, backfill,
  flag, env, cron, merge, push ou deploy.

## Validação executada

| Comando | Resultado |
|---|---|
| 4 arquivos novos focados | 28/28 |
| 5 arquivos estendidos (gerador, badge, admin, sink, gateway) | 84/84 |
| Regressão `src/lib/ai-cost`, `src/lib/ai`, `src/lib/visual-signature`, `src/app/api/store`, admin de custos (excluindo integração isolada) | 84 arquivos / **1033 passed**, 7 skipped |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `git diff --check` | limpo |

A suíte ampliada sem exclusão encontrou **1 falha pré-existente de ambiente**:
`image-generation-operations-repository.integration.test.ts` exige runner
isolado/DB (`isolated_integration_requires_runner_and_redacted_preflight`). Não
é falha desta quick; os demais 1033 testes passaram.

## Evidências por camada

1. **Cálculo puro:** quatro combinações, fixtures 5/M + 30/M, componentes exatos;
   entrada textual vs saída de imagem; tarifa ausente → parcial; combinação não
   coberta → desconhecida; falha sem imagem → sem estimativa de saída.
2. **Sink:** tokens reais preservados; `provider_reported_cost_usd` ignorado no
   caminho estimado; sem 0,065; metadata com origem/versão/modelo/qualidade/
   tamanho/tokens/versões de pricing; validação e legado intactos.
3. **Gateway/gerador:** alvo chega à tentativa real (sucesso e falha) e não é
   herdado pela validação; caminho legado sem a propriedade.
4. **Admin:** `deriveEventBadge` e `deriveRunBadge` classificam a estimativa
   completa como `estimated` e a parcial/desconhecida como
   `partial`/`not_available`; componentes admin renderizam "Estimado" e não
   "Custo reportado pelo provider".
5. **Documentação:** convenção versionada e procedimento de revisão.

## Limitações

- Testes são **offline/mocks**: não provam banco real, tarifas vigentes nem
  cobrança do provider.
- As tarifas atuais da homolog para Flare/Sunburst têm a divergência de dados
  descrita acima; o próximo cron/quick de tarifas deve reconciliá-las.
- Não há garantia de que o custo estimado coincida com a cobrança final.
- Nada foi aplicado em banco, homolog ou produção.
- Parado para revisão do Codex antes de publicação.

## Gap closure pós-revisão (commit `b46fd472`)

Três correções pequenas apontadas na revisão, com regressões offline:

1. **Cache sem dupla contagem.** `cached_tokens` passou a ser descontado da
   entrada normal em ambos os formatos (detalhado e agregado) e cobrado somente
   pela tarifa de cache. Exemplo regressivo: 1000 entrada, 200 cacheados, 100
   saída, 5/M + 0,5/M cache + 30/M saída → **US$ 0,0071** (não 0,0081).
2. **`code_default` não é tarifa tabelada neste caminho.** O bootstrap de código
   do leitor de pricing é tratado como indisponível apenas no novo caminho
   (`orchestrator_pricing`/`image_pricing` ausente, cobertura `partial`). A
   cadeia legada continua aceitando o bootstrap normalmente.
3. **Usage incompleto não vira zero.** Se a saída (ou a entrada) não foi
   reportada e não pode ser derivada com segurança, o componente textual fica
   desconhecido (`orchestrator_output_usage`/`orchestrator_input_usage`) e a
   cobertura é `partial`. Saída **explicitamente zero** continua válida e
   mantém `complete`.
4. **Usage agregado completo é aceito.** `promptTokens` + `completionTokens`
   sem breakdown de imagem são contabilizados como uso do orquestrador; a
   imagem é estimada e somada separadamente. A regressão passa pelo
   `normalizeResponsesUsage` do adapter (fixture crua só com
   `input_tokens`/`output_tokens`, sem inventar breakdown) até o sink.

Regressões: `visual-signature-image-cost.test.ts` e
`visual-signature-image-cost-sink.test.ts` → **26/26**; módulos afetados
(`ai-cost`, `ai`, `visual-signature`, admin de custos, sem a integração isolada)
→ **800 passed / 7 skipped**; typecheck/lint/`git diff --check` limpos.
