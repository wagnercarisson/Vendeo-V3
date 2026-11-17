## Why

A expansão 9:16 (F60.3/F60.5) ainda usa um alvo fixo em código — `gpt-image-2.5-sunburst` com qualidade `low` — sem controle administrativo. O responsável precisa escolher, exclusivamente para a expansão, entre Flare e Sunburst em `low` ou `medium`, sem alterar a base quadrada nem o fluxo 1:1, e sem que uma mudança administrativa posterior altere operações já iniciadas.

## What Changes

- Adicionar uma configuração administrativa **singleton** própria da expansão 9:16, restrita a `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` em `low`/`medium`, com motivo obrigatório, idempotência por `operationId`, auditoria na mesma transação e RPC service-only.
- Provisionar explicitamente `gpt-image-2.5-sunburst` / `low` como configuração inicial. Ausência, remoção ou valor inválido da configuração passa a falhar fechado; não há fallback silencioso nem retorno implícito ao Sunburst low.
- Resolver a seleção efetiva no preflight, antes da reserva de 1 crédito e de qualquer chamada paga, reutilizando o catálogo (`campaign_product_image`), o pricing por `modelo + qualidade` e o cálculo contábil existentes.
- Congelar a seleção **por operação**: nova operação grava modelo, qualidade, versão da configuração e origem; continuação, retry e telemetria usam o congelado e ignoram mudanças administrativas posteriores.
- Manter operações anteriores à F60.6 com compatibilidade explícita ao comportamento original (`Sunburst low`), identificada por versão de contrato da operação, sem backfill, sem reescrita de histórico e sem novo custo.
- Fazer o expansor receber o alvo congelado do servidor em vez de constantes fixas. A entrada pública continua recusando `model`/`quality` vindos do chamador; mantém uma única chamada por tentativa autorizada, sem retry oculto, sem fallback e sem mudança de prompt, tamanho `1152x2048` ou entrega JPEG `1080x1920`.
- Distinguir configuração comprovadamente ausente/inválida de falha/indeterminação de leitura: na geração nova não reserva nem chama provider; na continuação reservada retorna processamento recuperável, sem `acquire`, `recordOutcome` ou estorno automático.
- Manter replay, consulta, retomada concluída e entrega comprovada independentes da configuração administrativa vigente.
- Incluir uma migration forward-only para a configuração singleton/RPC/auditoria e para o congelamento na operação. **Nesta rodada a migration é apenas planejada; não será autorada nem aplicada.** O rollback é **operacional e não destrutivo**: suspender novas gerações pelo mecanismo existente, mediante autorização, preservando schema, configurações, seleções congeladas, operações e auditoria; o código de rollback permanece compatível com operações v2 já abertas.

## Capabilities

### New Capabilities

- `product-9-16-expansion-model-config`: configuração administrativa independente do modelo e da qualidade da expansão 9:16, com opções fechadas, motivo, auditoria, provisionamento inicial explícito, leitura estrita e falha fechada quando ausente/inválida.

### Modified Capabilities

- `campaign-vertical-ai-expansion`: o alvo deixa de ser fixo em Sunburst low e passa a ser uma seleção congelada recebida do servidor; qualidade, telemetria, evidência e preflight passam a refletir a seleção, preservando o contrato de saída 1152×2048 → 1080×1920 e a chamada única.
- `product-9-16-two-stage-operation-control`: a operação passa a carregar a seleção de expansão congelada e uma versão de contrato que distingue operações novas de operações legadas com comportamento original explícito.
- `product-9-16-two-stage-orchestration`: a abertura nova valida e congela a seleção antes da reserva; continuação e retry usam o congelado; leitura indeterminada permanece recuperável; entrega/replay não dependem da configuração atual.

## Impact

- **Admin/API:** nova seção em `/admin/ai-model-selection`, novo endpoint `GET/PUT /api/admin/nine-sixteen-expansion-model-config`, schema Zod, view model e serviço de leitura/cache.
- **Banco (planejado):** tabela singleton de configuração da expansão, RPC auditada, extensão dos CHECKs de auditoria; colunas de congelamento e versão de contrato em `product_9_16_two_stage_operations`; nova RPC de abertura com seleção. Sem backfill e sem alteração em `ai_model_selection`, `image_model_pair_config`, `image_generation_config_snapshots` ou preços.
- **Runtime:** `vertical-expansion` (policy/model/transport/telemetry/types/expand), orquestração 9:16 (preflight, abertura/reserva, expansão, continuação), cliente de controle e serviço financeiro.
- **Fora de escopo:** aprovação visual ou comparação de modelos, chamadas pagas, homolog/Docker/saldo/fixtures, mudança de prompt/preparação/algoritmo/entrega, dois formatos por solicitação, alteração de flags, pricing ou dados reais, merge/push/deploy/ativação.
