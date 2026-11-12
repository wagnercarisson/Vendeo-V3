## Why

A F60 já controla a operação 9:16 em duas etapas (`base` e `expansion`), mas a etapa `base` ainda não existe como unidade executável: hoje só o orquestrador público 1:1 sabe compor prompt, congelar configuração, adquirir copy, gerar a arte 1024×1024 e persistir. Chamar `runProductOneToOneGeneration` como atalho arrastaria crédito, resposta pública e entrega para dentro da etapa, criando um segundo dono desses efeitos.

Esta fatia entrega apenas a base quadrada como etapa interna reutilizável pelo futuro orquestrador 9:16, preservando integralmente o fluxo 1:1 atual.

## What Changes

- Cria um **módulo server-only de composição da base quadrada**, sem rota, UI, admin, flag ou orquestrador público.
- Recebe **identidade e autorização explícitas** (`storeId`, `campaignId`, `operationId`, `authorization`) e a **autorização de tentativa da etapa `base` já adquirida na F60** (`attempt.number`, `target`, token), sem adquirir etapa, contar tentativas ou decidir retry.
- **Reutiliza** `composeProductPrompt` e `PRODUCT_1_1_PROMPT_BASE` sem alterar prompt, políticas ou compositor e sem expor `promptBase` no contrato público; substituição, se necessária, fica em dependência de teste.
- **Reutiliza** `runNewFlowPreflight`, `buildProductOneToOneSnapshot`, `buildProductOneToOneFrozenEvidence` e `persistProductOneToOneSnapshot` para resolver a configuração uma única vez na **primeira composição**, congelá-la e persistir snapshot + binding + evidência antes de qualquer efeito pago.
- **Distingue primeira composição de retomada**: a retomada lê o snapshot/evidência já congelados e usa a configuração e o conteúdo originais; não resolve a configuração vigente e recusa entrada divergente na mesma operação antes de qualquer chamada. Como o schema permite **um binding e uma evidência por snapshot**, snapshot já vinculado a outra operação conflita e snapshot sem binding bloqueia; não se compõe outra base no mesmo snapshot.
- **Congela o conteúdo completo da operação** (briefing estruturado, contexto de copy, intenção, direção de fundo, seleções de referência e versões de composição) na evidência existente; arte e copy de retomada usam esse conteúdo, nunca um preço/briefing novo recebido no reenvio.
- **Reutiliza** o gateway e o adapter de imagem existentes com o par congelado do snapshot e **exatamente uma** invocação por chamada, com alvo explícito e sem retry/fallback oculto; `maxRetries: 0` e preservação de `usage` usam as opções aditivas já existentes da F60.3.
- **Reutiliza** a conversão `resizeToJpeg1024` e a decodificação de data URL existentes; a arte é validada por conteúdo pela F60.1.
- **Reutiliza** a F60.1 para persistir, recuperar e revalidar `square_original` (`origin: "provider_generation"`, `source: { kind: "none" }`), inclusive adoção de órfão íntegro com evidência durável e bloqueio conservador quando linha/objeto divergem.
- **Reutiliza** a geração, aquisição e persistência de copy existentes (`createDefaultProductOneToOneCopyOps`, `ProductOneToOneCopyAcquisitionClient`, `drainCopyTask`, `recordCopyState`, `readCopyDelivery`), preservando copy concluída em retomadas e mantendo copy independente da arte.
- **Garante uma única requisição de copy por execução**: o runner existente recebe um invoker próprio com adapters textuais sem retry oculto (`maxRetries: 0` aditivo nos adapters OpenAI de texto; Gemini sem camada de retry), sem alterar o gateway padrão legado.
- **Reutiliza** a telemetria existente para todas as chamadas: copy pelo runner atual e imagem por `buildAttemptTelemetry` + gateway/sink único, com `operationId` correlacionável entre base e expansão.
- Retorna **resultado tipado com copy e arte distinguíveis**: arte `created`/`reused`, copy `completed` (gerada/reutilizada), `failed`, `in_progress`, `waiting`, `unavailable` ou `not_requested`, ou falha tipada da arte preservando a evidência da chamada e o desfecho da copy.
- **Não** reserva, confirma, estorna ou consulta crédito; **não** altera `campaigns`, `campaign-images`, entrega, download, UI, ativação ou o fluxo 1:1.
- **Não** propõe migration: a tabela/bucket da F60.1, as tabelas de snapshot/copy e as tabelas/RPCs da F60 já cobrem o contrato. As restrições reais foram conferidas antes desta conclusão.

## Capabilities

### New Capabilities

- `campaign-square-base-composition`: etapa interna reutilizável que compõe e persiste a base quadrada de uma operação 9:16, com copy e arte distinguíveis, conteúdo/configuração congelados respeitados em retomadas, uma chamada de imagem e uma requisição de copy por execução sob autorização F60, persistência/recuperação `square_original` pela F60.1 e telemetria correlacionável.

### Modified Capabilities

<!-- Nenhuma capability existente muda de requisito. A F60, a F60.1, a F60.3 e o fluxo 1:1 são reutilizados sem alteração de contrato. -->

## Impact

- **Código novo**: biblioteca em `src/lib/campaign/square-base/**`, separando contratos puros (entrada, resultado, política de artefato, conteúdo congelado) da implementação server-only (prompt, snapshot, estado congelado, copy, transporte, arte, orquestração).
- **Compartilhado (aditivo)**: opção `maxRetries` nos adapters OpenAI de texto (`chat-completions` e `responses`), com default atual preservado; o módulo compõe um invoker de copy sem retry oculto e mantém `defaultAiGateway`/`defaultAdapterRegistry` intactos.
- **Reutilização**: F60 (`classifyProviderFailure`, tipos de falha/tentativa), F60.1 (`persistCompositionArtifact`, `retrieveCompositionArtifact`, `getArtifactByIdentity`, `CompositionArtifactStorage`, evidência/checksum), F60.3 (opções de transporte `maxRetries: 0`/`preserveUsageWithoutImage`), fluxo 1:1 (preflight, snapshot/evidência, `composeProductPrompt`, `resizeToJpeg1024`, copy, `buildAttemptTelemetry`, `AiGateway`).
- **Intocado**: `runProductOneToOneGeneration`, `product_1_1_campaign_artifacts`, `campaign-images`, crédito/duas etapas, `campaigns`, UI, rotas, flags, ativação, laboratório, prompts, políticas e compositor. O comportamento legado dos adapters textuais não muda sem a opção explícita.
- **Banco/Storage**: nenhuma migration, tabela, bucket, coluna, policy, RPC ou índice novo. Reutiliza `campaign_composition_artifacts`/`campaign-internal-artifacts` (F60.1), `image_generation_config_snapshots`/`product_1_1_snapshot_frozen_evidence`/`product_1_1_snapshot_content_binding`, `product_1_1_copy_state`/`product_1_1_copy_cancellations` e `generation_events`.
- **Restrições reais confirmadas**: `campaign_composition_artifacts` aceita `square_original`/`provider_generation` e é imutável por trigger; a copy é por `(campaign_id, operation_id)` com até 6 tentativas (3 auto + 3 manual) e trava a linha de crédito quando existe; o snapshot é único por campanha e idempotente por `(campaign_id, operation_id)`; a autoridade financeira continua em `product_1_1_campaign_credit_operations`.
- **Fora de escopo**: reserva/estorno/confirmação de créditos, expansão 9:16, preparação 1152, UI, entrega pública/download, ativação, orquestrador 9:16, alteração dos prompts/compositor, novos modelos/qualidades, migration e chamadas pagas nesta rodada.
- **Testes**: offline primeiro, com provider/DB/Storage simulados nas fronteiras e o módulo real; Sharp/decoder reais; reutilização dos apoios existentes (`src/lib/campaign/__tests__/support/**`, fixtures e fakes). Qualquer prova real fica em gate separado, explicitamente autorizado, no homolog existente, sem reconstruir infraestrutura.
