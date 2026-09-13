# Design — Fase 46: Gateway Único de IA e Registry de Modelos

## Context

Hoje cada serviço de IA é autônomo na tríade **provider + modelo + telemetria**:

- ~13 call sites em ~10 arquivos chamam `new OpenAI()` (ou `new GoogleGenerativeAI()`) diretamente e escolhem o modelo por env-var própria.
- A telemetria call-level é emitida por `onCall`/`onMetricsEvent` **por serviço**, e as rotas montam o evento (`resolveAiCost` + `AiCostTracker.record`). Onde o serviço esquece de chamar o callback, o evento não existe.
- As env-vars de modelo somam 14 (`OPENAI_MODEL`, `OPENAI_TEXT_MODEL`, `OPENAI_BRAND_DIRECTOR_MODEL`, `OPENAI_TEXT_ONLY_INFERENCE_MODEL`, `IMAGE_GENERATION_RESPONSES_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_VALIDATION_MODEL`, `IMAGE_PROVIDER`, `TEXT_PROVIDER`, `TEXT_FALLBACK_PROVIDER`, `GEMINI_TEXT_MODEL`, `GEMINI_MODEL`), além das chaves.

O inventário mapeou 11 **capacidades**. Além dos 4 furos originais, há **callers produtivos de IA sem contexto de telemetria** que entram no escopo desta fase:

| # | Furo / caminho | Onde |
|---|---|---|
| 1 | Modelo errado em validation/review (grava gpt-5.5, chama gpt-4o) | `image-generation-service.ts:emitMetricsEvent` |
| 2 | `onCall` ausente (sem custo/latência) | `api/store/[id]/logo/route.ts`, `logo/retry-brand-director/route.ts` |
| 3 | Fallback `images.edit` sem tokens/usage | `providers/openai.ts:fallbackToImageApi` |
| 4 | VS image sem o componente da tool de imagem | `visual-signature/generate-without-logo/route.ts:resolveAiCost` |
| 5 | `AiImageGenerator.generate` sem `onCall` (`generateVariations`/`generateAutomatic`) | `visual-signature/server-actions.ts:136,233,285` |
| 6 | `profiler.generate()` sem `onCall` (2 call sites) | `api/store/[id]/visual-signature/approve/route.ts:197,589` |
| 7 | `profiler.generate()` sem `onCall` | `api/store/[id]/visual-signature/restore/route.ts:158` |

Todos os caminhos 1–7 SHALL passar contexto de telemetria ao gateway; nenhum serviço/rota produtivo pode emitir chamada de IA fora da camada única.

Esta fase introduz a fundação (registry + gateway + adapters + telemetria obrigatória) **preservando integralmente o comportamento atual**. A persistência da seleção pelo admin é o Change B.

## Goals / Non-Goals

**Goals:**
- Uma **fonte única de configuração de modelo** por capacidade, com defaults iguais aos valores efetivos de hoje.
- Uma **camada única de execução e telemetria**, com adapters por protocolo, de modo que nenhum serviço instancie provider ou emita telemetria individualmente.
- **Telemetria obrigatória e correta** por chamada (provider, modelo real, tokens, duração) e correção dos furos, cobrindo **todos os callers produtivos**.
- **Remoção das env-vars de modelo/provider** do runtime; restam chaves de API + operacionais.
- Migração **incremental e behavior-preserving**; gates verdes por etapa.

**Non-Goals:**
- Seleção de modelo via admin/persistência (Change B).
- Mudança de UI, formulário, contrato HTTP público, schema público, snapshot, domínio ou prompts.
- Reescrita de prompts, regras de negócio, retry/backoff ou timeout global.
- Unificar streaming (o pipeline NDJSON é do route handler; providers são non-streaming).
- Remover o módulo legado `campaign-intelligence` (entra como capacidade `campaign_spec`).

## Decisions

### D1 — Registry por capacidade, com defaults idênticos ao comportamento atual

`src/lib/ai/model-registry.ts` exporta um mapa **capacidade → configuração** `{ capability, segment, primary: AiModelTarget, fallback?: AiModelTarget }`, onde `AiModelTarget = { provider, model, protocol }`, agrupado em 3 segmentos. A granularidade é **por capacidade** porque "visual" hoje usa modelos diferentes (gpt-4o para review/brand; gpt-4o-mini para validação de VS) e "imagem" usa mainline (gpt-5.5) **e** edit fallback (gpt-image-2). O **`protocol`** (`chat-completions` | `responses` | `images` | `gemini`) é obrigatório **em cada alvo** (primary e fallback): cada alvo é independente — o **default inicial** de `campaign_copy` tem `primary` `chat-completions` e `fallback` `gemini`; dois modelos de imagem podem exigir protocolos diferentes (`responses` com tool vs `images.edit`). A compatibilidade é validada por **capacidade + provider + modelo + protocolo**, nunca apenas por segmento.

```ts
type AiCapability =
  | "campaign_copy" | "campaign_correction_analysis" | "brand_profile_text"
  | "campaign_spec" | "campaign_input_validation" | "campaign_image_review"
  | "brand_profile_vision" | "visual_signature_validation"
  | "campaign_image" | "campaign_image_edit" | "visual_signature_image";
type AiProtocol = "chat-completions" | "responses" | "images" | "gemini";

interface AiModelTarget {
  provider: string;
  model: string;
  protocol: AiProtocol;
}

interface AiModelConfig {
  capability: AiCapability;
  segment: "text" | "vision" | "image";
  primary: AiModelTarget;
  fallback?: AiModelTarget;
}
```

| Capacidade | Segmento | Primary (preservado) | Protocolo | Env removida |
|---|---|---|---|---|
| `campaign_copy` | texto | openai `gpt-4o` | `chat-completions` | `OPENAI_TEXT_MODEL` |
| `campaign_correction_analysis` | texto | openai `gpt-4o` | `chat-completions` | — |
| `brand_profile_text` | texto | openai `gpt-4o` | `chat-completions` | `OPENAI_TEXT_ONLY_INFERENCE_MODEL` |
| `campaign_spec` (legado) | texto | openai `gpt-4o-mini` | `chat-completions` | `OPENAI_MODEL` |
| `campaign_input_validation` | visual | openai `gpt-4o` | `chat-completions` | `VISION_REVIEW_MODEL` |
| `campaign_image_review` | visual | openai `gpt-4o` | `chat-completions` | `VISION_REVIEW_MODEL` |
| `brand_profile_vision` | visual | openai `gpt-4o` | `chat-completions` | `OPENAI_BRAND_DIRECTOR_MODEL` |
| `visual_signature_validation` | visual | openai `gpt-4o-mini` | `responses` | `IMAGE_VALIDATION_MODEL` |
| `campaign_image` | imagem | openai `gpt-5.5` | `responses` (tool `image_generation`) | `IMAGE_GENERATION_RESPONSES_MODEL` |
| `campaign_image_edit` | imagem | openai `gpt-image-2` | `images` (`images.edit`) | `IMAGE_EDIT_FALLBACK_MODEL`, `GPT_IMAGE_MODEL` |
| `visual_signature_image` | imagem | openai `gpt-5.5` | `responses` (tool `image_generation`) | `IMAGE_GENERATION_RESPONSES_MODEL` |

- **Fallback é um alvo configurável, não um provider fixo**: o alvo de fallback também é um `AiModelTarget` com o seu `protocol`. O registry em código fornece apenas o **default inicial** (ex.: `campaign_copy.primary = { provider: openai, model: gpt-4o, protocol: chat-completions }` e `campaign_copy.fallback = { provider: gemini, model: gemini-3.1-flash-lite, protocol: gemini }`). O serviço e o gateway **não conhecem** qual provider ocupa cada posição; no Change B o admin poderá configurar `primary = Gemini` / `fallback = OpenAI` (ou sem fallback).
- **Validação `primary ≠ fallback`**: o registry SHALL rejeitar configuração em que `primary` e `fallback` tenham o mesmo `provider` + `model` (evita chamar o mesmo alvo duas vezes).
- **Por quê**: permite allowlist/validação por capacidade e futura seleção admin sem colapsar comportamentos; o protocolo impede validar um modelo pelo segmento errado; os testes ancoram o default.
- **Alternativas**: (a) por segmento — mais simples, muda comportamento e não distingue protocolos; (b) por serviço — reproduz o problema atual.

### D1.1 — Interface `AiModelResolver` **assíncrona** + composição do gateway (seam do Change B)

`src/lib/ai/model-resolver.ts` define o tipo `AiCapability` (union das 11 capacidades) e a interface **assíncrona** `AiModelResolver` com `resolve(capability: AiCapability): Promise<AiModelConfig>` (e `listCapabilities(): AiCapability[]`). O `ModelRegistry` é a implementação inicial (`async resolve()`; o `await` é trivial hoje). **Por que assíncrono agora:** o Change B (F47) consultará seleção persistida + cache por request — naturalmente assíncrona; um contrato síncrono forçaria a F47 a reabrir o gateway ou a criar uma factory de pré-carregamento. O gateway depende **apenas da interface** (nunca do mapa concreto) e a recebe **por construtor**: `class AiGateway { constructor(resolver: AiModelResolver, adapters: AiAdapterRegistry) }` — `invoke` **não** recebe o resolver. No Change B, um `PersistedModelResolver` **decora** o registry e é injetado **sem alterar o gateway**. A composição da instância padrão fica em `src/lib/ai/index.ts` (`new AiGateway(new ModelRegistry(), defaultAdapterRegistry)`).

- **Por quê**: evita que a F47 administrativa precise reabrir o gateway; a decisão do seam é técnica e pertence à F46.
- **Alternativa**: gateway lê o mapa direto — obrigaria refatorar o gateway na F47.

### D2 — Gateway único com adapters por protocolo, contrato único

`src/lib/ai/gateway.ts` expõe `class AiGateway { constructor(resolver: AiModelResolver, adapters: AiAdapterRegistry) }` (injeção por construtor — `invoke` não recebe o resolver) e `invoke(capability, request, telemetry, target = "primary")`, onde `target: "primary" | "fallback"` é a **seleção explícita do orquestrador** (nunca uma decisão do gateway). O gateway:
1. `await resolver.resolve(capability)` (D1.1) e seleciona o **alvo** indicado (`primary` | `fallback`), lendo `primary`/`fallback` do `AiModelConfig`;
2. escolhe o adapter pelo `protocol` **do alvo selecionado** via `adapters.get(protocol)` (`chat-completions` | `responses` | `images` | `gemini`), não por serviço nem por segmento;
3. executa **uma tentativa** (sem retry e **sem fallback automático**);
4. normaliza `usage`;
5. emite **um envelope de telemetria** por tentativa real (D3) via sink injetável.

O orquestrador aciona o fallback numa **segunda `invoke(..., target: "fallback")` explícita**; o gateway não escolhe o alvo sozinho.

Adapters em `src/lib/ai/adapters/`: `chat-completions.ts` (OpenAI chat: texto, visão, JSON mode/structured outputs), `responses.ts` (Responses API: tool `image_generation` e visão), `images.ts` (`images.edit` multi-imagem), `gemini.ts` (`generateContent`).

- **Por quê**: são 4 protocolos de wire distintos; um "client monolítico" misturaria shapes. Os adapters isolam o shape do provider e o gateway dá o contrato comum.
- **Fallback é do orquestrador (ver D4)**: o gateway nunca decide o alvo de modelo (`primary`/`fallback`) nem os fallbacks técnicos (`images.edit`, `json_object`) sozinho.
- **Alternativa**: gateway com `if (provider===...)` — acopla e vaza shape.

### D3 — Telemetria: envelope por tentativa real, persistência best-effort

Contrato explícito (resolve a contradição entre "obrigatória" e `telemetry?`):

1. **Cada tentativa HTTP real emite exatamente um envelope de telemetria** — inclusive quando falha. O envelope é um `AiCallEnvelope` (`extends AiCallInfo`).
2. O envelope registra o **status** `success` | `failed` | `timeout` (e `errorType` quando houver), com provider, `capability`, `protocol`, **modelo real**, `usage` (ou `not_available`), duração e `attempt`.
3. **A persistência é best-effort** e nunca bloqueia a geração: o sink padrão resolve custo (`resolveAiCost`) e grava call-level (`AiCostTracker.record`), que é **fail-open por design** (`tracker.ts` — nunca lança). Um envelope pode não chegar ao banco; a geração não pode falhar por isso.
4. **Contexto de telemetria é obrigatório em produção**: `invoke(capability, request, telemetry)` exige o contexto (run/store/campaign/attempt/sink) nos fluxos de geração. **Sink nulo/no-op é permitido apenas em testes com adapter falso** — nunca em produção.
5. O gateway **não** grava direto no banco: emite para um **sink injetável**. Rotas que precisam de buffering/ordenação (VS buffera até conhecer `visual_signature_id`; brand-profile distingue vision×text por ordem) passam seu próprio sink — comportamento atual preservado.
6. **Separação HTTP × domínio**: o `status` do `AiCallEnvelope` é sempre o resultado **HTTP** da tentativa (`success`/`failed`/`timeout`). A classificação de **domínio** de capacidades estruturadas (JSON) — `empty_response`/`json_parse_failed`/`schema_validation_failed` — é anexada pelo serviço ao **mesmo** envelope (helper reutilizável `withDomainOutcome`) e persistida em `metadata.domainStatus`/`metadata.domainErrorType`. Nunca há um segundo envelope; o `status` HTTP nunca é sobrescrito; a anexação é **best-effort** (falha do sink não escapa nem altera o resultado do serviço) e o caller **não** pode sobrescrever campos canônicos do metadata (`capability`/`protocol`/usage/fórmula).

`AiCallInfo` (hoje em `src/lib/ai-cost/types.ts:103`, sem esses campos) **permanece intacto** (há produtores legados que o constroem sem os campos novos). O gateway e o sink passam a usar um tipo **aditivo** `AiCallEnvelope extends AiCallInfo` com `capability`, `protocol` e `status` **obrigatórios** e `errorType?` **opcional** (ausente em sucesso). `AiTelemetryContext.sink: AiTelemetrySink` é **obrigatório** (não opcional): um contexto de produção sem destino de emissão não passa a validação; testes passam `NoopAiTelemetrySink` explícito e `createDefaultTelemetryContext(...)` injeta o sink padrão. Após todos os produtores legados serem migrados, a consolidação opcional do nome pode ocorrer (deferida).

- **Por quê**: separar "emissão do envelope" (garantida por tentativa) de "persistência" (best-effort) elimina a contradição e mantém o tracker fail-open.
- **Consequência**: `onCall`/`onMetricsEvent` deixam de ser responsabilidade do serviço; o modelo reportado é o **modelo real** resolvido pelo resolver (corrige o furo 1).

### D4 — Retry, timeout e fallback permanecem no serviço/rota (o gateway não decide fallback)

O gateway faz **uma** tentativa e **não** decide fallback automaticamente. `ImageGenerationService.generateWithRetry` (state machine, backoffs, `global_timeout`) e os timeouts das rotas continuam exatamente onde estão. `AbortSignal` é propagado ao adapter.

Fallbacks são **segunda chamada explícita** ao gateway, feita pelo serviço orquestrador, que indica o alvo:

- **Fallback de modelo (alvo configurado)**: o orquestrador chama `invoke(capability, request, telemetry, target: "fallback")` quando o erro é `retryable === true`, existe `fallback` configurado e ele **difere** do primary. O gateway resolve o alvo pelo registry — **não conhece Gemini**. O default inicial de `campaign_copy` tem fallback Gemini, mas isso é configuração, não regra.
- **Fallback técnico `images.edit` (protocolo dedicado)**: o orquestrador de imagem chama uma segunda `invoke("campaign_image_edit", request, telemetry, target: "primary")` (protocolo `images`) por **exatamente dois gatilhos legítimos**, sempre com imagem primary: **(1) retry explícito** (`attempt >= 1`) e **(2) erro de capability do Responses** — a tool/modelo `image_generation` indisponível **ou a resposta da tool sem imagem** (classificada como falha de capability, não sucesso sem arte). Auth/safety/rate-limit NÃO acionam. **Uma falha no Responses seguida de sucesso no Images são duas chamadas reais e dois envelopes de telemetria** — nunca um.
- **Fallback técnico `json_object`**: o orquestrador da campanha legada refaz a chamada explicitamente **somente** quando o erro é de capability relacionado a `response_format`/`json_schema`.
- **Auth/configuração e safety NÃO acionam fallback** (nem o de modelo, nem os técnicos).
- **Erros de parsing do domínio** (ex.: `MalformedResponseError`) **não** são normalizados pelo gateway: continuam classificados pelo orquestrador.

- **Por quê**: "uma tentativa" no gateway e "fallback automático" no gateway são incompatíveis; o orquestrador escolher o alvo (`primary`/`fallback`) e aplicar os gates corretos mantém a contabilidade e o comportamento atuais.

### D4.1 — Contrato de erro preserva os gates de fallback atuais

O gateway SHALL normalizar **erros HTTP/provider** num contrato único (`AiInvocationError`). **Erros de parsing do domínio** (ex.: `MalformedResponseError`) NÃO são normalizados pelo gateway — o orquestrador os classifica (via `isRetryableError`).

| Campo | Valores | Uso atual preservado |
|---|---|---|
| `kind` | `timeout` \| `auth` \| `rate_limit` \| `capability` \| `network` \| `content_filter` \| `provider_error` | `isResponsesApiError` (capability), `detectErrorCode`, `classifyError` |
| `httpStatus` | `number` (ex.: 401/403/429/5xx) | auth (401/403), rate limit (429), retry (5xx) |
| `retryable` | `boolean` | `isRetryableError` (copy) e backoff do `generateWithRetry` |
| `code` | `string` (código do provider quando houver) | telemetria `errorType` |
| `message` | `string` (sanitizada) | logs/`errorMessageSanitized` (sem vazar chave/URL) |

Gates preservados exatamente:
- **Fallback de modelo (`target: "fallback"`)**: acionado quando `retryable === true` e há fallback configurado (diferente do primary). Os erros retryable atuais são **`MalformedResponseError`, `ProviderRateLimitError`, `Provider5xxError`, `NetworkError` e `AbortError`** (via `isRetryableError`) — logo `rate_limit` e `timeout` **acionam** o fallback de modelo, como hoje.
- **Fallback técnico `images.edit`**: acionado **somente** por erro de capability do Responses e quando existe imagem primary.
- **Fallback técnico `json_object`**: acionado **somente** por erro de capability relacionado a `response_format`/`json_schema`.
- **Auth/configuração e safety**: **não** acionam fallback (nem de modelo, nem técnico).
- `retryable` é decidido uma vez na normalização, mantendo exatamente os gates atuais.
- O envelope de telemetria carrega `status` (`success`/`failed`/`timeout`) e `errorType` derivados do contrato.

- **Por quê**: se o gateway reclassificasse erros, os gates de fallback (modelo, Responses→Images, `json_object`) mudariam de comportamento. Preservar `kind`/`httpStatus`/`retryable`/`code` mantém os gates idênticos.

### D5 — Migração incremental por capacidade; envs removidas só após o corte

Cada capacidade é migrada individualmente, com os testes existentes verdes (defaults idênticos). As env-vars de modelo são removidas do runtime no fim da migração; o registry lê **apenas** chaves (`OPENAI_API_KEY`, `GEMINI_API_KEY`) via `api-keys.ts`.

- **Ordem de deploy**: (1) deploy do código que lê só chaves; (2) remoção das envs de modelo na Vercel. Nunca o inverso.
- **Sem override por env**: não há fallback transitório lendo `*_MODEL`; a única configuração de IA em env-var são as chaves de API. O default do registry é o comportamento efetivo.

### D6 — Legado `campaign-intelligence` entra como `campaign_spec`

A rota `POST /api/campaign/generate` e o `OpenAIProvider` legado passam a usar `invoke("campaign_spec", …)` com default `gpt-4o-mini`. A rota SHALL criar o `AiTelemetryContext` e encaminhá-lo por `campaign-intelligence/service.ts` até o provider/gateway (D9) — nenhum caminho produtivo da rota chama IA sem contexto. O código **não é removido** nesta fase. Para registrar corretamente a chamada (sem rotulá-la como `campaign_copy`), a F46 inclui uma **migration mínima** que estende o CHECK `chk_generation_events_type` (`supabase/migrations/...`) e o tipo TS `GenerationEventType` (`src/lib/visual-signature/types.ts:102`) com o literal `campaign_spec`, seguindo o padrão idempotente DROP/ADD + bloco REVERT da migration F37.2 (`20260906000003_f37_2_generation_events_type.sql`).

- **Por quê**: ausência de chamador de UI não prova ausência de consumidor externo; e o enum atual não possui `campaign_spec`, o que forçaria um rótulo incorreto.
- **Nota de escopo**: "sem mudança de banco" passa a ser "sem **novas tabelas**; apenas extensão do CHECK de telemetria".
- **Rollback**: o rollback **de código** mantém o CHECK **aditivo** — o literal `campaign_spec` permanece. O bloco REVERT da migration serve apenas para reverter **antes de qualquer evento `campaign_spec` existir**; depois que eventos podem existir, **não** se remove o literal (removê-lo faria eventos históricos violarem o CHECK).

### D7 — Correção dos furos e cobertura de todos os caminhos produtivos

1. **Modelo real**: `AiCallInfo.model` vem do registry/adapter (não mais hardcoded) — corrige validation/review.
2. **`onCall` garantido em todos os caminhos**: `POST /logo` e `retry-brand-director` (via `analyze()`), `visual-signature/server-actions.ts` (`generateVariations`/`generateAutomatic`, via `AiImageGenerator.generate`), `visual-signature/approve` (2 call sites) e `visual-signature/restore` (via `profiler.generate()`) passam contexto de telemetria ao gateway. **Callers já instrumentados que passam a usar o sink único (D9):** `brand-profile/infer`, `brand-profile/realign`, `brand-profile/generate-without-logo`, `visual-signature/generate-without-logo` (buffering até `visual_signature_id`) e `correction-reports.ts` — `resolveAiCost`/`AiCostTracker.record` manuais são removidos em favor do sink.
3. **Fallback `images.edit`**: adapter `images` normaliza ausência de usage (`not_available`) e registra duração + custo por unidade quando aplicável.
4. **VS image**: `invoke("visual_signature_image")` marca `imageGenerationTool: true` + `generationType`, e o resolvedor de custo passa a somar o componente da tool **também** para `visual_signature_image` — hoje o estimador aplica o componente **apenas** a `campaign_image` (`cost-estimator.ts:194`), o que precisa ser estendido a **ambas** as capacidades (testes separados por capacidade).

5. **Cobertura total dos callers produtivos**: nenhum caminho de IA fica fora do gateway — inclui `server-actions.ts`, `visual-signature/approve` e `visual-signature/restore`. Teste de inventário garante que todo `import` de serviço de IA em rota/action produtiva emite telemetria.

**Semântica de custo (ajuste de promessa):** a F46 garante **atribuição** (provider/modelo/etapa corretos), **usage** correto e **fórmula estimativa** correta. Ela **não** chama toda estimativa de "custo real": a geração via Responses combina o uso do modelo principal com o custo da geração de imagem, logo o valor é uma **estimativa** e mantém a indicação de fórmula provisória (`costEstimationNote`) enquanto não houver custo reportado pelo provedor (`provider_reported_cost_usd`).

### D8 — Env-vars finais

**Ficam** (chaves): `OPENAI_API_KEY`, `GEMINI_API_KEY`.
**Ficam** (operacionais, não são escolha de modelo): `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`, `IMAGE_GENERATION_QUALITY`, `IMAGE_GENERATION_DEBUG`, `METRICS_ENABLED`, `VENDEO_AI_FALLBACK_COST_USD`/`VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD`, `VENDEO_AI_CREDIT_UNIT_USD_VALUE`.
**Saem**: as 14 envs de modelo/provider listadas no Context.

## Risks / Trade-offs

- **[Blast radius]** → migrar 1 capacidade por vez; gates verdes; defaults idênticos; seam de mock no gateway.
- **[Adapter vaza shape do provider]** → contrato único `AiInvocationResult`; adapter não conhece regra de negócio.
- **[Retry/timeout duplicados ou perdidos]** → D4 explícito; teste de que o gateway não faz retry.
- **[Telemetria muda contagem/ordem]** → sink injetável preserva buffering (VS) e ordem (brand-profile); testes de invariante de eventos por run.
- **[Env removida antes do deploy]** → ordem D5; **ausência de API key falha explicitamente** (fail-fast em produção via `getApiKey`); o registry cobre a **remoção das env-vars de modelo**, não a ausência de chave.
- **[`images.edit` sem tokens gera custo errado]** → adapter marca `not_available` e usa `imageUnitCostUsd`; documentado.
- **[Legado quebra consumidor oculto]** → `campaign_spec` mantido e coberto por testes.

## Mapping — código e testes afetados

| Área | Arquivo | Ação |
|---|---|---|
| Registry | `src/lib/ai/model-registry.ts` (novo) | criar (`AiModelConfig` com `protocol`; `ModelRegistry implements AiModelResolver` com `async resolve`) |
| Resolver | `src/lib/ai/model-resolver.ts` (novo) | criar `AiCapability` + interface **assíncrona** `AiModelResolver` (`resolve(): Promise`) (D1.1) |
| Gateway | `src/lib/ai/gateway.ts` (novo) | criar `class AiGateway(resolver, adapters)` (injeção por construtor) + `invoke` |
| Adapters | `src/lib/ai/adapters/{chat-completions,responses,images,gemini}.ts` (novos) | criar |
| Adapters registry | `src/lib/ai/adapters/registry.ts` (novo) | criar `AiAdapterRegistry`/`defaultAdapterRegistry` |
| Composição | `src/lib/ai/index.ts` (novo) | compor `new AiGateway(new ModelRegistry(), defaultAdapterRegistry)` + `invoke` |
| Tipos | `src/lib/ai/types.ts` (novo) | `AiCallEnvelope extends AiCallInfo` (aditivo), `AiTelemetryContext` (**`sink` obrigatório**), `AiInvocationError`, `AiAdapterRegistry`; `AiCallInfo` legado **intacto** |
| Chaves | `src/lib/ai/api-keys.ts` (novo) | criar (`getApiKey(provider): string` com switch exaustivo) |
| Mapa de tipo | `src/lib/ai/generation-type-map.ts` (novo) | criar (`CAPABILITY_GENERATION_TYPE`, 11 capacidades; `campaign_image_edit → campaign_image`) |
| Telemetria | `src/lib/ai/telemetry-sink.ts` (novo) | `AiTelemetrySink` + sink padrão + `NoopAiTelemetrySink` + `createDefaultTelemetryContext` |
| Enum de evento | `src/lib/visual-signature/types.ts` (`GenerationEventType`) | adicionar `campaign_spec` |
| Migration | `supabase/migrations/*_f46_generation_events_type.sql` (nova) | estender CHECK `chk_generation_events_type` com `campaign_spec` + REVERT |
| Imagem | `image-generation/providers/openai.ts` | usar adapters `responses`/`images` |
| Visão campanha | `image-generation/services/input-validation-service.ts`, `image-review-service.ts` | usar gateway; modelo real |
| Visão/orquestração | `image-generation/services/image-generation-service.ts` | emitir telemetria com modelo real; sem hardcode |
| Texto | `copy/copy-director-service.ts`, `text-provider/openai.ts`, `text-provider/gemini.ts` | usar gateway |
| Correção | `campaign/correction-intent-service.ts` | usar gateway |
| VS | `visual-signature/ai-image-generator.ts`, `identity-art-director.ts`, `brand-profiler.ts` | usar gateway; tool flag |
| Brand | `brand-assets/brand-director.ts`, `text-only-inference-service.ts` | usar gateway |
| Legado | `campaign-intelligence/providers/openai.ts`, `campaign-intelligence/service.ts`, `app/api/campaign/generate/route.ts` | usar gateway (`campaign_spec`); rota cria/encaminha o `AiTelemetryContext` até o `invoke` |
| Rotas | `api/store/[id]/logo/route.ts`, `logo/retry-brand-director/route.ts` | passar telemetria |
| VS actions | `visual-signature/server-actions.ts` (`generateVariations`/`generateAutomatic`) | passar telemetria ao `AiImageGenerator.generate` |
| VS approve | `api/store/[id]/visual-signature/approve/route.ts` (2 call sites) | passar telemetria ao `profiler.generate` |
| VS restore | `api/store/[id]/visual-signature/restore/route.ts` | passar telemetria ao `profiler.generate` |
| Brand callers | `api/store/[id]/brand-profile/{infer,realign,generate-without-logo}/route.ts` | fornecer `AiTelemetryContext`/sink; remover `resolveAiCost`/`AiCostTracker.record` manuais |
| VS generate-without-logo | `api/store/[id]/visual-signature/generate-without-logo/route.ts` | sink **buffering** até `visual_signature_id`; remover persistência manual |
| Correção-v2 | `src/lib/campaign/correction-reports.ts` | fornecer `AiTelemetryContext`/sink ao `ImageGenerationService`; remover persistência manual |
| Gate de arquitetura | `src/lib/ai/__tests__/architecture-guard.test.ts` (novo) | proibir SDK/wire fora de adapters, persistência manual de IA fora do sink e env-var de modelo |
| Config | `.env.example` | remover envs de modelo |
| Testes | `generate-image/route.test.ts`, `campaign-generate.test.ts`, `concurrency.test.ts`, `regression-master-switch.test.ts` | co-migrar (`IMAGE_GENERATION_RESPONSES_MODEL`, `TEXT_FALLBACK_PROVIDER`) |

## Migration Plan

1. Criar resolver + registry (com `protocol`) + gateway + adapters + chaves (sem migrar serviços).
2. Aplicar a migration de extensão do CHECK `chk_generation_events_type` (`campaign_spec`) e atualizar o tipo TS — **[BLOCKING]** antes de migrar `campaign_spec`.
3. Migrar capacidades uma a uma; gates verdes a cada passo; defaults idênticos.
4. Corrigir os furos e cobrir **todos os callers produtivos** (D7) — incluindo o componente da tool para `campaign_image` **e** `visual_signature_image`.
5. Remover envs de modelo do runtime e do `.env.example`; deploy; só então remover da Vercel.
6. Rollback: reverter commits por capacidade; **o rollback de código mantém o CHECK aditivo** (o literal `campaign_spec` permanece; o REVERT da migration só se aplica antes de existir evento `campaign_spec`); contrato externo inalterado.

## Decisões consolidadas (ex-open questions)

1. **`api-keys.ts`**: expõe `getApiKey(provider): string` com **switch exaustivo** por provider. **Contrato coerente (nunca `undefined`)**: em produção, chave ausente → erro de configuração explícito (fail-fast); em dev/teste, chave ausente → `""` (string vazia), preservando os caminhos mock/dev.
2. **Sink**: contexto de telemetria **obrigatório em produção**; sink **no-op apenas em testes controlados** com adapter falso. O gateway nunca cria run implícito.
3. **`ImageProvider`**: mantida como **contrato interno/seam de testes**, com implementação **delegando ao gateway**. A decisão é da F46, não da F47.
4. **Caminho único de telemetria (D9, correção de revisão):** o caller fornece `AiTelemetryContext`; o gateway gera **um** envelope por tentativa real; o **sink** é o único que persiste (`resolveAiCost` + `AiCostTracker.record`, best-effort). Nenhum caller resolve custo/grava manualmente. `onCall`, se mantido por compatibilidade, **apenas recebe o envelope já produzido** e não conduz a telemetria de produção.
5. **Mapa canônico capability → generationType (D10, correção de revisão):** `campaign_image_edit` é capacidade do registry mas **não** é `GenerationEventType`; o sink mantém `CAPABILITY_GENERATION_TYPE` cobrindo **as 11 capacidades**, com `campaign_image_edit → campaign_image`, preservando `capability`/`protocol` originais no `metadata` do evento. O mapa tem teste.
6. **Proprietário único da chamada de texto:** `CopyDirectorService` é o **único** que chama `invoke("campaign_copy")` no caminho de produção; `OpenAITextProvider`/`GeminiTextProvider`/`createTextProvider` são **fachadas de compatibilidade/teste** que delegam ao gateway fora do caminho de produção (evita invocação dupla).
7. **Resolver assíncrono + composição (revisão):** `AiModelResolver.resolve(capability): Promise<AiModelConfig>`; `class AiGateway { constructor(resolver, adapters) }`; `invoke` não recebe o resolver; `src/lib/ai/index.ts` compõe `new AiGateway(new ModelRegistry(), defaultAdapterRegistry)`. O `await` prepara o resolver persistido da F47 **sem reabrir o gateway**.
8. **Envelope + sink obrigatório (revisão):** `AiCallEnvelope extends AiCallInfo` (aditivo; `AiCallInfo` legado **intacto** — migração gradual); `AiTelemetryContext.sink: AiTelemetrySink` **obrigatório**; `NoopAiTelemetrySink` explícito em testes; `createDefaultTelemetryContext(...)` injeta o sink padrão.

### Revisões pós-46-02 (correções aprovadas antes do 46-03)

9. **Sink preserva o contrato de persistência completo:** o `AiCallEnvelope` carrega `usageMeta?` (encaminhado pelo gateway a partir do resultado do adapter); o sink usa `envelope.usageMeta.imageGenerationTool === true` como **única** fonte do componente da tool (nunca inferido do protocolo `responses`), preserva `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` do run e o metadata call-level (usage bruto sanitizado + componentes da fórmula). O sink expõe `onCostResolved(cost)` para o caller acumular o custo **sem segunda chamada a `resolveAiCost`** (mesmo `CostResolution` persistido).
10. **Seam de teste do texto (`AiInvoker`):** `CopyDirectorService` é o dono único de `invoke("campaign_copy")` e recebe o invoker/gateway como dependência de teste; `generateCopy` aceita `target`/`telemetry` nas **options** (aditivos). O fallback é a **rota** chamando o serviço de novo com `target: "fallback"` — a rota **não** chama `invoke` diretamente e não conhece provider.
11. **`createTextProvider` fora do caminho de produção:** todos os callers produtivos (rota `generate-image`, `CorrectionIntentService`) param de usar `createTextProvider`; as fachadas remanescentes exigem `AiTelemetryContext` injetado e **não** instanciam `NoopAiTelemetrySink` internamente (no-op **só em teste**); fachadas sem consumidores são removidas.
12. **`campaign_spec` — contexto de run:** a rota legada usa `AiCostTracker.startRun("campaign_delivery")` (não existe `OperationRunType.campaign_spec`), `attemptNumber` 1 no primary e 2 no fallback `json_object`; as novas escritas call-level são intencionais (D6/D9). **Testes reais** de `campaign_spec` (Structured Outputs + fallback `json_object`) e da rota `POST /api/campaign/generate` (sem `--passWithNoTests`).
13. **Soma de custo híbrida:** durante 46-03/46-04 o `callCostSum` da rota combina a acumulação do sink (`onCostResolved`) com o `recordCall` residual das capacidades ainda não migradas; após 46-05 toda a soma vem do sink.
14. **Reabertura 46-05 (imagem):** (a) o adapter `images` **normaliza** o `usage` da Images API quando presente e mantém a ausência explícita (`usage` undefined + `providerUsageSource: "images.edit"`); (b) a resposta da tool `image_generation` **sem imagem** é **falha de capability** (não sucesso sem arte) — o gateway emite envelope `failed`; (c) formalização dos **dois gatilhos legítimos** do `images.edit` — retry explícito (`attempt >= 1`) e erro de capability (incl. imagem ausente), ambos com imagem primary; auth/safety/rate-limit não acionam; (d) o `cost-estimator` aplica o componente por unidade da tool **mesmo sem usage** em `campaign_image`/`visual_signature_image` (estimativa parcial, `textComponentUsd = 0`, nota `provisional_image_tool_unit_cost_without_text_usage`).
15. **Reabertura 46-04 (achado de UAT) — snapshot econômico:** todo caller que cria o `AiTelemetryContext` SHALL propagar `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` (resolvidos uma vez por run pelo helper compartilhado `resolveEconomicSnapshot` em `src/lib/economic/economic-snapshot.ts`). Sem isso, o `DefaultAiTelemetrySink` persiste `null` e a apuração BRL cai no "parâmetro atual (fallback)" em vez do câmbio capturado. Coberto por teste de inventário (`telemetry-coverage.test.ts`).

Questões de persistência (CHECK de seleção, depreciação de modelo, catálogo editável) permanecem **exclusivamente na F47** (`fase-47-catalogo-e-selecao-de-modelos-admin`).
