## Context

A expansão 9:16 nasceu na F60.3 com alvo fixo: `gpt-image-2.5-sunburst` em qualidade `low`, resolvido por linha ativa de `ai_model_catalog` na capability `campaign_product_image`, provider `openai`, protocolo `images` (`src/lib/campaign/vertical-expansion/policy.ts`, `model.ts`). A F60.5 integrou o percurso (base quadrada → preparação 1152 → expansão → entrega), mas a seleção continuou fixa e cada operação nova lê o catálogo/pricing no momento da chamada.

O padrão administrativo já existe para o par do Produto 1:1: RPC auditada com motivo e idempotência (`admin_set_image_model_pair_config`), autorização `requireAdmin`, leitura em cache curto com invalidação, view model tolerante, formulário restrito ao catálogo elegível e aviso de cobertura de pricing. A expansão precisa do mesmo padrão, porém para **uma única seleção modelo + qualidade**, independente do par 1:1/base quadrada, e com congelamento por operação.

IDs confirmados sem dedução: `ai_model_catalog` é semeado pela migration `20261005000001_f56_1_model_pair_config.sql` com `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` (ambos `campaign_product_image`/`openai`/`images`, `active`) e `gpt-image-2`. As qualidades elegíveis são `low` e `medium` (`ELIGIBLE_IMAGE_QUALITIES`). O inventário de pricing já cobre `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` em `low`/`medium`.

## Goals / Non-Goals

**Goals:**
- Permitir ao admin escolher, só para a expansão 9:16, Flare ou Sunburst em `low` ou `medium`, com motivo obrigatório, auditoria e idempotência.
- Resolver a seleção efetiva antes de qualquer reserva/chamada paga, congelá-la por operação e preservá-la em continuação, retry e telemetria.
- Manter operações anteriores com o comportamento original Sunburst low de forma explícita, sem backfill nem reescrita de histórico.
- Manter a independência da base quadrada e do fluxo 1:1, reutilizando catálogo, pricing, cálculo contábil, autorização e auditoria existentes.
- Preservar o contrato de uma chamada por tentativa, sem retry oculto/fallback, e a saída 1152×2048 → JPEG 1080×1920.

**Non-Goals:**
- Aprovar visualmente, comparar ou escolher o “melhor” modelo; executar chamadas pagas ou provas reais.
- Mudar prompt, preparação quadrada, algoritmo de expansão, validação de saída ou entrega.
- Criar tabela paralela de tarifas, valores fixos, cópia de preços entre modelos ou cobertura por `image_unit_usd`.
- Alterar flags, pricing, dados reais, homolog, Docker, saldo, fixtures, login de teste, merge, push, deploy ou ativação.
- Congelar a seleção na base quadrada/1:1 ou alterar `image_model_pair_config`/`ai_model_selection`.

## Decisions

### D1 — Configuração administrativa própria, singleton e sem par/fallback

Criar `nine_sixteen_expansion_model_config` (scope singleton `'expansion'`) com `model`, `quality`, `config_version_id`, `reason`, `updated_by`, `updated_at`, `created_at`. A escrita ocorre exclusivamente pela RPC `admin_set_nine_sixteen_expansion_model_config(p_actor_id, p_model, p_quality, p_reason, p_operation_id)`, que:

- exige ator, motivo não vazio, `operation_id` UUID e qualidade em `low|medium`;
- recebe o ator **derivado no servidor** por `requireAdmin` (consulta a `admin_users`); o corpo do navegador não contém nem escolhe `actor_id`;
- revalida na própria RPC, antes da escrita, que `p_actor_id` existe em `admin_users` (ator administrativo), rejeitando ator ausente/não administrador;
- aceita somente `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` (lista fechada da expansão, não todo o catálogo elegível do 1:1);
- confirma linha ativa no catálogo `campaign_product_image`/`openai`/`images` antes de gravar;
- faz upsert singleton, renova `config_version_id` e audita na mesma transação (`admin_audit_log`, nova ação e novo `target_type`), estendendo os CHECKs preservando todos os valores existentes;
- é idempotente por `operation_id`: **mesmo `operation_id` + mesmo conteúdo** devolve replay idempotente sem nova versão/auditoria; **mesmo `operation_id` + conteúdo diferente** devolve conflito (`operation_id_conflict`) sem gravação, sem nova versão e sem auditoria adicional.

Não haverá `DELETE`/reset: ausência é falha, não um estado válido. A migration provisiona explicitamente `gpt-image-2.5-sunburst`/`low` com motivo de provisionamento inicial; isso é uma linha real, não um default em código. Se a linha for removida ou ficar inválida, a execução falha fechado.

**Alternativas rejeitadas:** reutilizar `image_model_pair_config` (forma de par principal/fallback, CHECK de escopo e semântica do 1:1), `ai_model_selection` (não tem qualidade e é a seleção legada), `feature_flags` (sem modelo/qualidade/versão), `ai_model_catalog` como estado mutável (compartilhado com 1:1 e sem motivo/auditoria).

### D2 — Reaproveitamento

| Necessidade | Mecanismo reutilizado | O que NÃO é copiado |
|---|---|---|
| Autorização admin | `requireAdmin` + `apiHandler` | nova regra de acesso |
| Validação de entrada | Zod em `src/lib/admin/schemas.ts`, `.strict()` | schema do par principal/fallback |
| Persistência auditada | padrão da RPC F56.1 (motivo, `operation_id`, auditoria transacional, grants service-only) | colunas de par/fallback |
| Catálogo | `AiModelCatalogService` + capability `campaign_product_image` | allowlist produtiva nova |
| Pricing/cobertura | `AiModelPricingService`, `evaluatePricingCoverage`, `resolveTargetCoverage`, `imageUnitUsd` como estimativa | tabela/valores paralelos |
| Custo contábil | `BufferingAiTelemetrySink` + cálculo existente por tokens e `pricingVersion` | fórmula própria por modelo |
| Freeze | linha de operação `product_9_16_two_stage_*` e abertura/reserva atômica existentes | snapshot JSONB ou tabela de par |
| Leitura admin | padrão `view + readError`, cache curto e invalidação do F56.1 | par principal/fallback |
| UI | seção na página unificada `/admin/ai-model-selection`, componentes/estilos existentes | nova tela isolada |

### D3 — Congelamento por operação na linha de controle

Adicionar à `product_9_16_two_stage_operations` (nullable, sem backfill): `expansion_model`, `expansion_quality`, `expansion_config_version_id`, `expansion_selection_origin`. Relaxar o CHECK de `contract_version` para `1|2` e adicionar CHECK cruzado:

- `contract_version = 1` ⇒ todas as colunas de seleção `NULL` (operação legada);
- `contract_version = 2` ⇒ modelo na lista fechada, qualidade `low|medium`, versão UUID e origem `'configured'` obrigatórios.

Criar `product_9_16_open_operation_v2(...)` que recebe a seleção já validada pelo preflight, grava a operação com `contract_version = 2` e reserva na **mesma transação**. A função v1 permanece intacta para rollback/legado; a v2 rejeita seleção ausente/inválida e recusa converter operação existente de v1 para v2 (`operation_config_conflict`/`operation_origin_conflict`). O cliente escolhe v2 quando há seleção (geração nova) e v1 apenas para reabrir operação v1 existente ou em testes explícitos. **Abrir uma operação inexistente sem seleção é proibido no runtime**: isso impediria a criação acidental de uma operação “legada” nova e reintroduziria o fallback silencioso. A v1 só pode resolver operação v1 já existente.

**Por que a operação e não outros lugares:**
- `campaigns.input_snapshot` é JSONB de conteúdo e não é o mecanismo dedicado de congelamento; usar chaves novas misturaria conteúdo com configuração de execução.
- `image_generation_config_snapshots` é única por campanha e modelada como par principal/fallback, compartilhada com a base quadrada/1:1; a expansão precisa de seleção única e independente.
- Uma tabela nova de snapshot por operação duplicaria a âncora que já existe (`campaign_id, operation_id`) e exigiria outra escrita/transação.
- A abertura da operação já é o ponto atômico de reserva; congelar ali impede que uma mudança administrativa entre preflight e execução afete a operação.

**Garantias de banco:**
- **Imutabilidade após a abertura:** a seleção congelada só é gravada no `INSERT` da operação v2. `service_role` permanece apenas com `SELECT`; não existe caminho de `UPDATE` de `expansion_*`/`contract_version`. Um trigger `BEFORE UPDATE` rejeita qualquer alteração desses campos, inclusive por funções futuras, preservando a seleção e a versão originais.
- **Autoridade administrativa:** a rota deriva o ator de `requireAdmin`/`admin_users`; o corpo não aceita ator. A RPC rejeita `p_actor_id` nulo ou não pertencente a `admin_users`, sem gravar configuração nem auditoria.
- **Idempotência administrativa:** o `operation_id` é a chave de replay. Conteúdo idêntico devolve o resultado existente; conteúdo divergente gera conflito explícito, sem sobrescrever a configuração vigente e sem auditoria adicional.
- **Concorrência na abertura:** a unicidade `(campaign_id, operation_id)` e a transação de abertura garantem **uma reserva, uma operação e uma seleção**. Duas aberturas concorrentes da mesma identidade convergem para a vencedora; uma seleção divergente é recusada com conflito e não sobrescreve a seleção gravada.

### D4 — Compatibilidade explícita com operações anteriores

`contract_version = 1` é a marca explícita de operação anterior à F60.6. A resolução devolve `selectionOrigin = 'legacy_sunburst_low'` com `gpt-image-2.5-sunburst`/`low`, exatamente o comportamento original, e registra essa origem na telemetria/evidência. Não há `UPDATE`/backfill de histórico. Em `contract_version = 2`, seleção ausente, incompleta ou inválida é corrupção/configuração indisponível e falha fechado — nunca cai no legado.

### D5 — Preflight, falhas e ausência vs leitura indeterminada

- **Geração nova:** antes da reserva, ler a configuração administrativa em modo estrito; se ausente/inválida → `configuration_unavailable` definitivo, zero reserva/provider. Se leitura falhar → `configuration_unavailable` com razão de leitura, zero reserva/provider. Se ok, validar catálogo ativo + cobertura de usage para `model+quality`; qualquer falha → zero reserva/provider. Sucesso devolve a seleção + `configVersionId` e ela é congelada na abertura.
- **Continuação/retry:** ler a seleção congelada da operação; v1 → legado explícito; v2 incompleta/inválida → definitivo sem `acquire`/provider; v2 com leitura indeterminada → `processing` recuperável, sem `acquire`, `recordOutcome` ou estorno.
- **Antes de adquirir a tentativa de expansão:** executar preflight read-only da seleção efetiva (catálogo + pricing). Configuração comprovadamente inválida/ausente → falha definitiva sem `acquire`; leitura indeterminada → recuperável sem `acquire`.
- **Replay/consulta/entrega comprovada:** não consultam a configuração administrativa nem o preflight; operação entregue/estornada/desconhecida segue a autoridade financeira e os artefatos.

Taxonomia preservada: `configuration_missing`/`model_unavailable`/`pricing_unavailable`/`configuration_read_failed` continuam causas técnicas distintas, sem código público novo. `image_unit_usd` permanece estimativa opcional; cobertura insuficiente de usage permanece bloqueante e custo insuficiente permanece `null`/`not_available`.

### D6 — Expansor orientado à seleção congelada

`expandVerticalToNineSixteen(input, deps)` continua recusando `model`/`quality` vindos da entrada pública. A seleção chega por `deps` server-only (não pelo payload do navegador) como `ExpansionSelection { model, quality, configVersionId, origin }`. `resolveExpansionTarget` passa a resolver a linha ativa **para o modelo selecionado** (não mais `EXPECTED_MODEL` fixo) e `resolveExpansionPricing` usa `model+quality` da seleção. O request ao gateway usa `quality: selection.quality`; `isValidExpansionRequest` valida a qualidade esperada da seleção. `ExpansionCallEvidence` e a telemetria passam a carregar `quality: low|medium`, `configVersionId` e `selectionOrigin`. Permanecem: uma única `images.edit`, `maxRetries: 0`, sem fallback, timeout ≤180 s, validação exata 1152×2048/9:16 e exportação 1080×1920.

### D7 — Superfície administrativa

Nova seção “Imagem de campanhas — Expansão 9:16” em `/admin/ai-model-selection`, com:
- dois selects (Flare/Sunburst e low/medium), restritos às listas fechadas;
- motivo obrigatório, `operationId` idempotente por fingerprint, feedback de sucesso/erro;
- cobertura de pricing por combinação exibida como aviso (não bloqueia salvar, mas a execução exige cobertura completa);
- texto explícito de escopo: afeta somente novas operações de expansão 9:16, não altera base quadrada, 1:1 nem operações em andamento;
- estado vazio/falha de leitura renderizado sem 500; a ausência de linha é mostrada como configuração ausente (execução falha fechado);
- o view model descreve apenas o estado conhecido (vigente/ausente/erro), sem `productionActive` fixo e sem declarar ativação; seleção de modelo não é flag de ativação.

Endpoint `GET/PUT /api/admin/nine-sixteen-expansion-model-config`; `GET` devolve view model; `PUT` valida, chama a RPC e invalida o cache.

### D8 — Compatibilidade técnica das quatro combinações

As quatro combinações usam o mesmo protocolo `images` (`images.edit`), o mesmo tamanho `1152x2048`, a mesma validação de retorno e o mesmo pipeline de exportação; qualidade é um campo já aceito pelo adapter. Não é necessário outro protocolo, tamanho ou processamento. Catálogo e pricing têm linhas para `flare`/`sunburst` em `low`/`medium`; `image_unit_usd` pode faltar sem bloquear a cobertura de usage.

**Lacuna de evidência (não de contrato):** a prova real da F60.3 cobriu apenas Sunburst `low` em 1152×2048; Flare em `low`/`medium` e Sunburst `medium` não foram provados nesse pipeline. A aprovação é decisão do usuário; esta change não executa prova paga. Se o provider devolver tamanho/proporção diferente para alguma combinação, a validação de saída falha, a tentativa é classificada e o crédito é estornado conforme a F60 — sem fallback silencioso.

### D9 — Migration: necessária, mas fora desta rodada

A migration é indispensável por dois motivos: (1) configuração administrativa persistida, auditada e independente não existe em nenhuma tabela atual com a forma correta; (2) o congelamento por operação exige colunas/contrato na linha de controle. Plano:

1. Conferir unicidade do timestamp real UTC (`YYYYMMDDHHmmss`) na worktree e branches conhecidas.
2. Criar tabela singleton, RLS service-only, grants, RPC auditada e CHECKs de auditoria preservando todos os valores existentes.
3. Provisionar explicitamente Sunburst `low` (idempotente; sem sobrescrever configuração humana já existente).
4. Adicionar colunas/CHECKs de congelamento, o trigger de imutabilidade e a RPC `_v2`; manter a v1 intacta.
5. **Rollback operacional não destrutivo:** suspender novas gerações pelo mecanismo de flag/ativação existente, mediante autorização; preservar tabela de configuração, seleções congeladas, operações, reservas e auditoria. O código de rollback SHALL continuar compatível com operações `contract_version = 2` já abertas (lê a seleção congelada e conclui/estorna conforme a autoridade existente). Não há promessa de remover schema sem perder histórico; qualquer remoção estrutural futura é uma decisão separada e destrutiva, não este rollback.
6. Aplicação em ambiente autorizado é gate separado; nenhuma migration será autorada/aplicada nesta rodada.

### Surfaces afetadas

- **Novos:** `src/lib/ai/nine-sixteen-expansion-model-config.ts`, `...-service.ts`, `...-view.ts`; `src/app/api/admin/nine-sixteen-expansion-model-config/route.ts`; seção/formulário em `src/app/(app)/admin/ai-model-selection/`; migration F60.6.
- **Alterados:** `src/lib/admin/schemas.ts`; `src/app/(app)/admin/ai-model-selection/page.tsx`; `src/lib/campaign/vertical-expansion/{policy,model,transport,telemetry,types,expand}.ts`; `src/lib/product-9-16-two-stage/{types,two-stage-operation-client,two-stage-financial-service}.ts`; `orchestration/{types,run-nine-sixteen,expansion-step,delivery-deps}.ts` (e status/reconstruction apenas se necessário para expor a seleção congelada).
- **Intocados:** `ai_model_selection`, `image_model_pair_config`, `image_generation_config_snapshots`, `campaigns`, crédito, Storage, prompt, preparação, exportação e entrega.

### Testes delimitados

- Admin: opções fechadas (2 modelos × 2 qualidades), rejeição de `gpt-image-2`/qualidade inválida, motivo/`operationId`, `requireAdmin`, ator administrativo revalidado, RPC e auditoria, cache/invalidação, leitura ausente vs falha.
- Idempotência administrativa: mesmo `operationId` + mesmo conteúdo → replay sem nova versão/auditoria; mesmo `operationId` + conteúdo diferente → conflito sem gravação/auditoria adicional.
- Independência: salvar expansão não altera par 1:1, snapshot da base ou campanha; salvar 1:1 não altera expansão.
- Transporte: cada uma das quatro combinações chega ao request (`model`/`quality`), telemetria/evidência com versão/origem; uma chamada, sem retry/fallback.
- Congelamento: nova operação grava seleção; continuação/retry usa congelado mesmo após mudança admin; v1 → `legacy_sunburst_low`; v2 sem seleção → falha fechada.
- Banco: seleção imutável após abertura; concorrência cria uma reserva/operação/seleção; seleção divergente não sobrescreve a vencedora.
- Pricing: cobertura por modelo/qualidade, `medium` sem tarifa bloqueia, `image_unit_usd` ausente mantém estimativa `null` e não bloqueia, custo pós-chamada por tokens.
- Indeterminação: geração nova sem reserva/provider; continuação recuperável sem `acquire`/`recordOutcome`/estorno.
- Replay/entrega/consulta não leem configuração administrativa.
- Regressões: F60.4/base, F60.5/continuação/delivery, 1:1, 1152→1080, probe e telemetria; typecheck, lint, build, `git diff --check`, `openspec validate --strict`.
- Tudo offline com DB/Storage/provider simulados.

## Risks / Trade-offs

- **Flare/medium não provados em 1152×2048** → o gate de saída rejeita e a operação estorna; a escolha é decisão do usuário e uma prova paga futura é gate separado.
- **Mudança na abertura da operação** → RPC v2 separada, v1 preservada, testes de contrato/idempotência/concorrência e rollback operacional não destrutivo, com código compatível com operações v2 já abertas.
- **Cache administrativo defasado** → TTL curto + invalidação no PUT; operações já abertas usam o congelado, então a defasagem não altera execução em andamento.
- **Configuração ausente após provisionamento** → falha fechada explícita, sem reserva/provider; o admin vê estado vazio e a mensagem de configuração indisponível.
- **Pricing de `medium` incompleto** → admin pode salvar com aviso, mas a execução bloqueia antes do gasto; consistente com o padrão F56.1.
- **Corrida preflight × mudança admin** → o valor validado no preflight é o congelado, com `configVersionId`; não há releitura entre preflight e abertura.

## Decisões encerradas

- As quatro combinações Flare/Sunburst em `low`/`medium` estão **autorizadas no escopo**.
- Comparação e aprovação dos modelos pertencem ao usuário; a change não cria checkpoint de prova paga nem aprovação visual.
- A ausência de prova visual/real de alguma combinação **não é bloqueador da implementação**; o gate de saída e o estorno existentes permanecem.
- O histórico administrativo segue o padrão vigente + `admin_audit_log` existentes, sem nova tela de histórico.
- A aplicação da migration permanece uma **autorização separada**, não uma decisão pendente de arquitetura.

Não há pergunta arquitetural pendente para iniciar o planejamento GSD.
