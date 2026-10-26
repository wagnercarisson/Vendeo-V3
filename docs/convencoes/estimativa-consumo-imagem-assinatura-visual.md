# Estimativa de consumo da imagem da Assinatura Visual

Versão: `vs-image-usage-v1`
Data de aprovação: `2026-10-26`
Tamanho coberto: `1024x1024`

## Objetivo

Registrar de forma versionada e auditável o **consumo estimado de tokens** da
imagem gerada na Assinatura Visual, sem alterar os tokens reais das demais
chamadas (orquestrador, validação e perfil) e sem recalcular o histórico.

Esta convenção separa três conceitos que não devem ser confundidos:

| Conceito | O que é | Onde fica |
|---|---|---|
| Consumo real | Tokens reportados pelo provider na chamada | Campos atuais de tokens do evento (`prompt_tokens`, `completion_tokens`, `metadata.provider_usage_raw` etc.) |
| Consumo estimado | Parâmetros aprovados de tokens da imagem (`vs-image-usage-v1`) | `metadata` JSONB do evento (chaves `image_usage_*`) |
| Cobrança confirmada | Custo financeiro reconciliado do provider | Não é produzido por esta estimativa; `provider_reported_cost_usd` não é preenchido por este caminho |

O valor em `estimated_cost_usd` é uma **estimativa operacional**, não uma
cobrança confirmada e não um teto de cobrança.

## Tabela aprovada

| Modelo | Qualidade | Entrada estimada (texto) | Saída estimada (imagem) |
|---|---|---:|---:|
| `gpt-image-2.5-flare` | `low` | 350 | 250 |
| `gpt-image-2.5-flare` | `medium` | 350 | 500 |
| `gpt-image-2.5-sunburst` | `low` | 400 | 250 |
| `gpt-image-2.5-sunburst` | `medium` | 400 | 500 |

Origem: observação manual na plataforma OpenAI de **uma execução por
combinação**, seguida de arredondamento e margem adicional aprovados pelo
usuário. Não são tokens medidos automaticamente nem média estatística
representativa. Não representam garantia ou teto de cobrança.

Combinação, modelo, qualidade ou tamanho não coberto **não** recebe
silenciosamente a estimativa de outra opção. O lookup é exato por
`modelo + qualidade + tamanho`.

## Arquivo de configuração responsável

`src/lib/ai-cost/visual-signature-image-usage.ts`

- centraliza a tabela, a versão (`vs-image-usage-v1`), a data, o tamanho, a
  origem e o lookup exato;
- não contém tarifas em USD — apenas tokens estimados;
- não é espalhado por adapters, rotas ou serviços.

O cálculo e a leitura das tarifas ficam em
`src/lib/ai-cost/visual-signature-image-cost.ts`.

## Fórmula

```
estimated_cost_usd =
  componente_texto_orquestrador (tokens REAIS do provider)
  + componente_estimado_imagem (tokens estimados vs-image-usage-v1)

componente_estimado_imagem =
  (input_text_tokens_estimados / 1.000.000) * input_token_usd_per_1m
  + (output_image_tokens_estimados / 1.000.000) * image_token_usd_per_1m
```

Regras de tarifa:

- a **entrada textual** da imagem usa `input_token_usd_per_1m`;
- a **saída de imagem** usa `image_token_usd_per_1m`;
- `input_token_usd_per_1m` **não** é tratado como tarifa de entrada de imagem;
- `output_token_usd_per_1m` (texto) **não** é usado como saída de imagem;
- `image_unit_usd` **não** é usado neste cálculo por token;
- tarifas do orquestrador **não** são reutilizadas para precificar a imagem;
- tarifas vêm exclusivamente da tabela `ai_model_pricing` já existente, com a
  linha vigente (`effective_until IS NULL`) e a dimensão de qualidade.

O componente genérico de **US$ 0,065** (`responses:image_generation`) **não** é
somado neste caminho. O caminho legado (sem configuração dedicada válida)
permanece inalterado.

### Cache, tarifa de código e usage incompleto

- **Cache não é contado duas vezes:** `cached_tokens` é um subconjunto da
  entrada reportada. O cálculo desconta os tokens cacheados da tarifa normal de
  entrada e cobra somente esses tokens pela tarifa de cache — tanto no breakdown
  detalhado quanto no agregado.
- **`code_default` não é tarifa tabelada:** o bootstrap de código do leitor de
  pricing é tratado como **indisponível** somente neste caminho novo
  (`orchestrator_pricing`/`image_pricing` ausente). A cadeia legada continua
  aceitando o bootstrap normalmente.
- **Ausência de usage não é zero:** se a entrada ou a saída não foram reportadas
  (e não podem ser derivadas com segurança), o componente textual fica
  desconhecido (`orchestrator_input_usage`/`orchestrator_output_usage`) e a
  cobertura é `partial`. Um valor **explicitamente zero** continua sendo zero
  reportado e não impede a cobertura `complete`.

## Escopo de aplicação

Aplicado somente na geração da **Assinatura Visual** quando:

1. a operação usa `visual_signature_model_config` com configuração dedicada
   válida;
2. o alvo efetivamente enviado (`image_model`, `image_quality`, tamanho) está
   coberto pela tabela acima.

O orquestrador é precificado com os tokens reais disponíveis. A validação
(`visual_signature_validation`) e o perfil de marca continuam como chamadas
separadas, com o mecanismo atual. Campanhas e outros consumidores do estimador
compartilhado não são alterados.

## Registro e auditabilidade

Sem tabela, coluna ou migration nova. O evento existente de
`generation_events` passa a registrar no `metadata` JSONB:

- `image_usage_origin`: `manual_observation_openai_platform_with_rounding_and_margin`;
- `image_usage_estimated`: `true`;
- `image_usage_estimate_version`: `vs-image-usage-v1`;
- `image_usage_estimate_approved_at`: `2026-10-26`;
- `image_usage_model`, `image_usage_quality`, `image_usage_size`;
- `image_usage_config_version_id` (versão congelada da configuração dedicada);
- `image_usage_input_text_tokens` e `image_usage_output_image_tokens`;
- `image_usage_pricing_version` e `orchestrator_pricing_version`;
- tarifas efetivamente usadas
  (`image_usage_pricing_input_text_usd_per_1m`,
  `image_usage_pricing_output_image_usd_per_1m`);
- `image_usage_component_usd`, `image_usage_text_component_usd`,
  `image_usage_coverage` e `image_usage_missing`.

Os campos atuais de tokens reais são preservados. As médias estimadas **não**
preenchem `prompt_tokens`, `completion_tokens` nem
`metadata.provider_usage_raw`. `provider_reported_cost_usd` não é usado nem
preenchido por este caminho.

Os campos de custo existentes consumidos pelo admin
(`estimated_cost_usd`, `text_component_usd`, `image_tool_component_usd`,
`pricing_version`, `cost_formula_version`, `cost_estimation_note`) recebem o
resultado nas **novas** gerações. A listagem e o detalhe exibem o total como
**Estimado**, nunca como custo reportado pelo provider. O histórico não é
recalculado nem reclassificado.

## Tarifa ou informação ausente

Se faltar tarifa ou dimensão necessária:

- o evento é marcado como **parcial/desconhecido** (`cost_source =
  not_available`, nota `visual_signature_image_usage_estimate_partial`);
- `image_usage_missing` lista o que faltou (ex.: `image_pricing`,
  `image_output_image`, `orchestrator_usage`);
- nenhum valor é inventado (sem zero artificial e sem US$ 0,065);
- a geração **não** é bloqueada nem disparada novamente por ausência de
  pricing.

## Preservação de histórico e snapshots

- eventos anteriores a esta versão permanecem com seus valores originais;
- nenhum backfill, recálculo ou reclassificação é executado;
- novas gerações carregam a versão, a data, o tamanho, o modelo, a qualidade,
  os tokens estimados, as versões de pricing e a versão da configuração;
- uma revisão futura deve criar uma **nova versão** (ex.: `vs-image-usage-v2`)
  em vez de alterar silenciosamente `vs-image-usage-v1`.

## Revisão futura da estimativa

1. Registrar a nova tabela aprovada em um novo módulo/versão, com data e
   origem.
2. Manter a versão anterior disponível para leitura de eventos históricos.
3. Atualizar os testes de fixtures e o lookup para a nova versão.
4. Não recalcular eventos passados.
5. A atualização automática de tarifas (`ai_model_pricing`) é escopo de outra
   quick/cron; esta convenção não implementa cron.

## Homologação e produção

Homolog e produção executam o **mesmo código, fluxo e regra de cálculo**. Não
há caminho diferente por ambiente nesta estimativa. O que varia é apenas o
conteúdo vigente de `ai_model_pricing` e de `visual_signature_model_config`,
lidos em runtime.

## Limitações desta versão

- Os parâmetros são estimativas aprovadas por observação manual, não medição
  automática.
- A disponibilidade das dimensões de tarifa depende do conteúdo vigente de
  `ai_model_pricing`; tarifa ausente resulta em estimativa parcial/desconhecida.
- Não há garantia de que o custo estimado coincida com a cobrança final do
  provider.
- Não há cron, painel novo ou reconciliação financeira nesta entrega.
