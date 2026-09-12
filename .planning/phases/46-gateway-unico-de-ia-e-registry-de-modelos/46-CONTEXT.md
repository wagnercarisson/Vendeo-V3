# Phase 46: Gateway Único de IA e Registry de Modelos — Context

**Gathered:** 2026-09-12
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/`)
**Change A (fundação).** A seleção administrativa de modelos (catálogo + persistência + tela) é o **Change B** (`openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/`) e depende desta fundação.

<domain>
## Phase Boundary

As chamadas de IA estão **pulverizadas** no código: ~13 call sites em ~10 serviços, cada um instanciando o próprio client (`new OpenAI()` / `new GoogleGenerativeAI()`), escolhendo o modelo por uma **env-var própria** (14 envs de modelo/provider) e emitindo telemetria (ou não) por conta própria. Esta fase **reorganiza e concentra** as chamadas em uma **camada única de execução + telemetria**, com um **registry de modelos em código** por capacidade, **preservando integralmente o comportamento atual**.

**O que esta fase entrega (Change A):**

1. **Registry de modelos em código** (`src/lib/ai/model-registry.ts`): fonte única da verdade por **capacidade** → `AiModelConfig { capability, segment, primary: AiModelTarget, fallback?: AiModelTarget }`, com `AiModelTarget = { provider, model, protocol }` e `protocol` declarado **em cada alvo** (primary e fallback). Agrupado em 3 segmentos (`text` | `vision` | `image`). Defaults **idênticos** aos valores efetivos de hoje. Allowlist de modelos validada por **capacidade + provider + modelo + protocolo** (nunca só por segmento).
2. **Interface `AiModelResolver`** (`src/lib/ai/model-resolver.ts`): seam de resolução (`resolve(capability): AiModelConfig`, opcionalmente `listCapabilities()`). O registry em código é a implementação inicial; o Change B poderá decorar/substituir o resolver **sem refazer o gateway**. O gateway depende **apenas da interface**.
3. **AI Gateway único** (`src/lib/ai/gateway.ts`): `invoke(capability, request, telemetry, target = "primary")`. Resolve a config via resolver, seleciona o **alvo explícito** (`primary`/`fallback`) e o adapter pelo `protocol` **do alvo**, executa **uma tentativa** (sem retry e **sem fallback automático**), normaliza `usage` e emite **um envelope de telemetria por tentativa real** via sink injetável. O contexto de telemetria é **obrigatório em produção**.
4. **Adapters por protocolo** (`src/lib/ai/adapters/{chat-completions,responses,images,gemini}.ts`): `chat-completions` (OpenAI Chat: texto, visão, JSON mode/structured outputs), `responses` (Responses API: tool `image_generation` e visão), `images` (`images.edit` multi-imagem), `gemini` (`generateContent`). Contrato único de request/result/usage; `AbortSignal` propagado.
5. **Módulo de chaves** (`src/lib/ai/api-keys.ts`): `getApiKey(provider)` com **switch exaustivo**; fail-fast em produção sem chave.
6. **Telemetria obrigatória e correta**: `AiCallInfo` estendido com `capability`, `protocol`, `status`, `errorType`. Persistência **best-effort** (o `AiCostTracker` é fail-open por design). Correção dos furos identificados (modelo real em validation/review; `onCall` em todos os callers produtivos; fallback `images.edit` registrado; componente da tool somado em `campaign_image` **e** `visual_signature_image`).
7. **Migração incremental** das **11 capacidades**, uma por vez, atrás de testes de invariante, **preservando comportamento** (defaults idênticos; retry/backoff/global-timeout onde já estão; `AbortSignal` propagado; JSON mode/structured outputs preservados).
8. **Remoção das 14 env-vars de modelo/provider** do runtime e `.env.example` — restam apenas as chaves de API (`OPENAI_API_KEY`, `GEMINI_API_KEY`) + variáveis operacionais.
9. **Legado `campaign-intelligence`** entra como capacidade `campaign_spec` (default `gpt-4o-mini`), roteada pelo gateway. **Não é removido nesta fase.** Inclui uma **migration mínima** que estende o CHECK `chk_generation_events_type` e o tipo TS `GenerationEventType` com o literal `campaign_spec`.

**O que esta fase NÃO entrega (Change B / Non-Goals):**

- Seleção de modelo via admin/persistência (catálogo, tela, depreciação) — **exclusivamente F47**.
- Mudança de UI, formulário, contrato HTTP público, schema público, snapshot, domínio ou prompts.
- Reescrita de prompts, regras de negócio, retry/backoff ou timeout global.
- Unificação de streaming (o pipeline NDJSON é do route handler; providers são non-streaming).
- Remoção do módulo legado `campaign-intelligence`.
- Reconciliação financeira real (a fase mantém **estimativa** com `costEstimationNote` enquanto não houver `provider_reported_cost_usd`).

**Estado real verificado em código (2026-09-12):**

- `src/lib/ai/` **não existe** ainda — todos os arquivos do gateway/registry/resolver/adapters/api-keys são novos.
- **28 leituras de env-var de modelo/provider** em `src/` (grep `process.env.*_MODEL|_PROVIDER`), distribuídas por: `image-generation/config.ts` (`IMAGE_GENERATION_RESPONSES_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_PROVIDER`), `text-provider/{openai,gemini,factory}.ts` (`OPENAI_TEXT_MODEL`, `GEMINI_TEXT_MODEL`, `GEMINI_MODEL`, `TEXT_PROVIDER`, `TEXT_FALLBACK_PROVIDER`), `campaign-intelligence/providers/openai.ts` (`OPENAI_MODEL`), `visual-signature/{server-actions,ai-image-generator,brand-profiler}.ts`, `brand-assets/{brand-director,text-only-inference-service}.ts`, `campaign/generate-image/route.ts` (`TEXT_FALLBACK_PROVIDER`).
- **11 instanciações de provider** (`new OpenAI()` ×10, `new GoogleGenerativeAI()` ×1) em: `campaign-intelligence/providers/openai.ts:72`, `visual-signature/brand-profiler.ts:128`, `visual-signature/ai-image-generator.ts:64,210`, `text-provider/openai.ts:19`, `text-provider/gemini.ts:22`, `brand-assets/brand-director.ts:48`, `brand-assets/text-only-inference-service.ts:20`, `image-generation/providers/openai.ts:56`, `image-generation/services/image-review-service.ts:352`, `image-generation/services/input-validation-service.ts:111`.
- `AiCallInfo` (`src/lib/ai-cost/types.ts:103`) hoje tem **apenas** `provider`, `model`, `usage?`, `durationMs`, `providerReportedCostUsd?` — **sem** `capability`/`protocol`/`status`/`errorType`. (O `status`/`errorType` de `types.ts:130-131` pertencem a `AiCostEvent`, o contrato de persistência.)
- Furo 1 confirmado: `image-generation-service.ts:135-142` (`emitMetricsEvent`) hardcoda `IMAGE_GENERATION_RESPONSES_MODEL` (imagem) para as fases de validação/revisão de visão.
- Furo 4 confirmado: `cost-estimator.ts:194` aplica o componente da tool **apenas** quando `generationType === "campaign_image"`; `cost-estimator.test.ts:332` ancora explicitamente que `visual_signature` **não** soma a tool (anti-dupla-cobrança) — a F46 estende a fórmula a `visual_signature_image` e co-migra esse teste.
- Migration precedente: `supabase/migrations/20260906000003_f37_2_generation_events_type.sql` (CHECK `chk_generation_events_type` idempotente DROP/ADD + bloco REVERT; 15 valores atuais incl. `theme_direction`/`theme_generation`/`campaign_correction_analysis`).
- `.env.example`: `OPENAI_API_KEY` (:7), `OPENAI_MODEL=gpt-4o-mini` (:10), `IMAGE_PROVIDER=openai` (:15), `# IMAGE_GENERATION_RESPONSES_MODEL=gpt-5.5` (:19), `# VISION_REVIEW_MODEL=gpt-4o` (:23), `# TEXT_FALLBACK_PROVIDER=gemini` (:34), `# GEMINI_API_KEY=` (:35), `# GEMINI_TEXT_MODEL=gemini-3.1-flash-lite` (:36).

## Constraints

- **Preservação de comportamento (D5/D7):** defaults idênticos; nenhum modelo muda nesta fase; mesmos prompts/parâmetros; retry/backoff/timeout onde já estão; `AbortSignal` propagado; JSON mode/structured outputs preservados.
- **Superfície externa intacta:** UI/form, contrato HTTP, schema público, snapshot/domínio, prompts e `ImageProvider` (contrato interno/seam de testes, com implementação **delegando ao gateway**) **inalterados**.
- **Gateway faz uma tentativa:** sem retry e **sem fallback automático**; o orquestrador seleciona o alvo (`primary`/`fallback`) e aplica os gates de fallback (D4/D4.1).
- **Sem override por env:** não há fallback transitório lendo `*_MODEL`; a única configuração de IA em env-var são as chaves de API.
- **Ordem de deploy (D5):** (1) deploy do código que lê só chaves; (2) remoção das envs de modelo na Vercel. **Nunca o inverso.**
- **Migration aditiva (D6):** o rollback **de código** mantém o CHECK com `campaign_spec`; o bloco REVERT só se aplica **antes de existir evento `campaign_spec`**.
- **Sink:** contexto de telemetria **obrigatório em produção**; sink no-op permitido **apenas em testes** com adapter falso. O gateway **nunca** cria run implícito.
- **`campaign_spec`:** a migration + o tipo TS são **[BLOCKING]** antes de migrar `campaign_spec`.
- **Sem novas tabelas:** apenas a extensão do CHECK de telemetria. Sem novas dependências.

## Dependencies

- F38/F38.1/F38.2.1 (custos de IA — `AiCostTracker`, `resolveAiCost`, `cost-estimator`, snapshot econômico; a telemetria desta fase alimenta essa contabilidade)
- F23/F25 (Text Provider + Copy Director + Gemini fallback; pipeline)
- F31.x (prompts por intent, revisor, quality gate — consumidores de visão)
- F41 (multi-imagem — o fallback `images.edit` multi-imagem e as referências determinísticas)
- F43/F45 (estado atual do pipeline de imagem e dos prompts — **não** alterados)
- Precedente de migration: F37.2 `20260906000003_f37_2_generation_events_type.sql` (CHECK idempotente + REVERT)

</domain>

<decisions>
## Implementation Decisions

### D1 — Registry por capacidade, com defaults idênticos ao comportamento atual
`DECIDIDO`. `src/lib/ai/model-registry.ts` exporta um mapa **capacidade → configuração** `{ capability, segment, primary: AiModelTarget, fallback?: AiModelTarget }`, com `AiModelTarget = { provider, model, protocol }`, agrupado em 3 segmentos. Granularidade **por capacidade** (visual usa gpt-4o para review/brand e gpt-4o-mini para validação de VS; imagem usa mainline gpt-5.5 **e** edit fallback gpt-image-2). O **`protocol`** (`chat-completions` | `responses` | `images` | `gemini`) é obrigatório **em cada alvo** — cada alvo é independente. Compatibilidade validada por **capacidade + provider + modelo + protocolo**. O default inicial de `campaign_copy` tem `primary` `chat-completions` e `fallback` `gemini`.

```ts
type AiProtocol = "chat-completions" | "responses" | "images" | "gemini";
interface AiModelTarget { provider: string; model: string; protocol: AiProtocol; }
interface AiModelConfig {
  capability: string;
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

- **Fallback é alvo configurável, não provider fixo**: o registry fornece apenas o **default inicial** (`campaign_copy.fallback = { provider: gemini, model: gemini-3.1-flash-lite, protocol: gemini }`). Serviço e gateway **não conhecem** qual provider ocupa cada posição.
- **Validação `primary ≠ fallback`**: o registry SHALL rejeitar `primary` e `fallback` com o mesmo `provider` + `model`.

### D1.1 — Interface `AiModelResolver` como seam de resolução (prepara o Change B)
`DECIDIDO`. `src/lib/ai/model-resolver.ts` define `AiModelResolver` com `resolve(capability): AiModelConfig` (e opcionalmente `listCapabilities()`). O `ModelRegistry` é a implementação inicial. O gateway depende **apenas da interface**. No Change B, um `PersistedModelResolver` poderá decorar o registry e ser injetado **sem refazer o gateway**.

### D2 — Gateway único com adapters por protocolo, contrato único
`DECIDIDO`. `src/lib/ai/gateway.ts` expõe `invoke(capability, request, telemetry, target = "primary")`, onde `target: "primary" | "fallback"` é a **seleção explícita do orquestrador**. O gateway: (1) resolve a config via resolver e seleciona o alvo indicado; (2) escolhe o adapter pelo `protocol` **do alvo selecionado**; (3) executa **uma tentativa** (sem retry e sem fallback automático); (4) normaliza `usage`; (5) emite **um envelope por tentativa real** via sink injetável. O orquestrador aciona o fallback numa **segunda `invoke(..., target: "fallback")` explícita**.

### D3 — Telemetria: envelope por tentativa real, persistência best-effort
`DECIDIDO`. (1) **Cada tentativa HTTP real emite exatamente um envelope** (inclusive falha/timeout). (2) O envelope registra `status` (`success` | `failed` | `timeout`) e `errorType` quando houver, com provider, `capability`, `protocol`, **modelo real**, `usage` (ou `not_available`) e duração. (3) **Persistência best-effort** — `resolveAiCost` + `AiCostTracker.record` (fail-open; nunca lança); um envelope pode não chegar ao banco e a geração não pode falhar por isso. (4) **Contexto de telemetria obrigatório em produção**; sink nulo/no-op **apenas em testes** com adapter falso. (5) O gateway **não** grava direto no banco — emite para um **sink injetável**; rotas que precisam de buffering/ordenação (VS bufferiza até conhecer `visual_signature_id`; brand-profile distingue vision×text por ordem) passam o próprio sink.
`AiCallInfo` SHALL ganhar `capability`, `protocol`, `status`, `errorType` (aditivo, retrocompatível).

### D4 — Retry, timeout e fallback permanecem no serviço/rota (o gateway não decide fallback)
`DECIDIDO`. `ImageGenerationService.generateWithRetry` (state machine, backoffs, `global_timeout`) e os timeouts das rotas continuam onde estão. `AbortSignal` propagado ao adapter. Fallbacks são **segunda chamada explícita**:
- **Fallback de modelo (alvo configurado):** `invoke(capability, request, telemetry, target: "fallback")` quando o erro é `retryable === true`, existe `fallback` configurado e ele **difere** do primary. O gateway resolve o alvo pelo registry — **não conhece Gemini**.
- **Fallback técnico `images.edit`:** segunda `invoke("campaign_image_edit", request, telemetry, target: "primary")` (protocolo `images`) **somente** quando a Responses falha por **erro de capability** e há imagem primary. Falha + sucesso = **duas chamadas reais e dois envelopes**.
- **Fallback técnico `json_object`:** o orquestrador da campanha legada refaz a chamada **somente** quando o erro é de capability relacionado a `response_format`/`json_schema`.
- **Auth/configuração e safety NÃO acionam fallback.** **Erros de parsing do domínio** (ex.: `MalformedResponseError`) **não** são normalizados pelo gateway — seguem classificados pelo orquestrador.

### D4.1 — Contrato de erro preserva os gates de fallback atuais
`DECIDIDO`. O gateway normaliza **erros HTTP/provider** em `AiInvocationError` (`kind` = `timeout` | `auth` | `rate_limit` | `capability` | `network` | `content_filter` | `provider_error`; `httpStatus`; `retryable`; `code`; `message` sanitizada sem vazar chave/URL). Gates preservados exatamente:
- **Fallback de modelo:** `retryable === true` e fallback configurado ≠ primary. Retryable atuais: `MalformedResponseError`, `ProviderRateLimitError`, `Provider5xxError`, `NetworkError`, `AbortError` (via `isRetryableError`) — logo `rate_limit` e `timeout` **acionam** o fallback, como hoje.
- **`images.edit`:** só por erro de `capability` do Responses + imagem primary.
- **`json_object`:** só por `capability` de `response_format`/`json_schema`.
- **Auth/configuração e safety:** não acionam fallback.
- `retryable` decidido **uma vez** na normalização.

### D5 — Migração incremental por capacidade; envs removidas só após o corte
`DECIDIDO`. Cada capacidade migrada individualmente, com testes existentes verdes (defaults idênticos). Envs de modelo removidas do runtime no fim; o registry lê **apenas** `OPENAI_API_KEY`/`GEMINI_API_KEY` via `api-keys.ts`. **Ordem de deploy:** (1) deploy do código que lê só chaves; (2) remoção das envs na Vercel. **Sem override por env.**

### D6 — Legado `campaign-intelligence` entra como `campaign_spec`
`DECIDIDO`. `POST /api/campaign/generate` + `OpenAIProvider` legado passam a `invoke("campaign_spec", …)` com default `gpt-4o-mini`. O código **não é removido**. Migration mínima estende o CHECK `chk_generation_events_type` (`supabase/migrations/*_f46_generation_events_type.sql`) e o tipo TS `GenerationEventType` (`src/lib/visual-signature/types.ts:102`) com o literal `campaign_spec`, no padrão idempotente DROP/ADD + REVERT da F37.2. A extensão é **aditiva**; o rollback de código mantém o CHECK.

### D7 — Correção dos furos e cobertura de todos os caminhos produtivos
`DECIDIDO`. 1. **Modelo real**: `AiCallInfo.model` vem do registry/adapter (não hardcoded) — corrige validation/review. 2. **`onCall` garantido em todos os caminhos**: `POST /logo` e `retry-brand-director` (via `analyze()`), `visual-signature/server-actions.ts` (`generateVariations`/`generateAutomatic`), `visual-signature/approve` (2 call sites) e `visual-signature/restore` (via `profiler.generate()`). 3. **Fallback `images.edit`**: adapter `images` normaliza ausência de usage (`not_available`) + duração + custo por unidade. 4. **VS image**: `invoke("visual_signature_image")` marca `imageGenerationTool: true` + `generationType`; `cost-estimator.ts` soma o componente da tool em `campaign_image` **e** `visual_signature_image` (hoje só `campaign_image` — `cost-estimator.ts:194`), com testes separados por capacidade. 5. **Cobertura total**: nenhum caminho de IA fica fora do gateway; teste de inventário garante que todo `import` de serviço de IA em rota/action produtiva emite telemetria.
**Semântica de custo:** a F46 garante **atribuição** (provider/modelo/etapa), **usage** correto e **fórmula estimativa** correta — não chama toda estimativa de "custo real"; mantém `costEstimationNote` enquanto não houver `provider_reported_cost_usd`.

### D8 — Env-vars finais
`DECIDIDO`. **Ficam (chaves):** `OPENAI_API_KEY`, `GEMINI_API_KEY`. **Ficam (operacionais):** `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`, `IMAGE_GENERATION_QUALITY`, `IMAGE_GENERATION_DEBUG`, `METRICS_ENABLED`, `VENDEO_AI_FALLBACK_COST_USD`/`VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD`, `VENDEO_AI_CREDIT_UNIT_USD_VALUE`. **Saem:** as 14 envs de modelo/provider (`OPENAI_MODEL`, `OPENAI_TEXT_MODEL`, `OPENAI_BRAND_DIRECTOR_MODEL`, `OPENAI_TEXT_ONLY_INFERENCE_MODEL`, `IMAGE_GENERATION_RESPONSES_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_VALIDATION_MODEL`, `IMAGE_PROVIDER`, `TEXT_PROVIDER`, `TEXT_FALLBACK_PROVIDER`, `GEMINI_TEXT_MODEL`, `GEMINI_MODEL`).

### Decisões consolidadas (ex-open questions)
1. **`api-keys.ts`**: `getApiKey(provider)` com **switch exaustivo** por provider (fail-fast em produção sem chave).
2. **Sink**: contexto de telemetria **obrigatório em produção**; sink no-op **apenas em testes controlados** com adapter falso. O gateway nunca cria run implícito.
3. **`ImageProvider`**: mantida como **contrato interno/seam de testes**, com implementação **delegando ao gateway**. Decisão da F46, não da F47.

Questões de persistência (CHECK de seleção, depreciação de modelo, catálogo editável) permanecem **exclusivamente na F47**.

### D-trackings — Numeração F46/F47/Stripe
`DECIDIDO`. **F46 = Gateway Único de IA e Registry de Modelos (v1.5)** é a próxima fase numerada após F45 (concluída em 2026-09-05). **F47 = Catálogo e Seleção de Modelos Admin (Change B)** é a sucessora. **F44 = Temas de Campanha permanece fora da numeração** (adicionada pelo runbook da própria F44); **Stripe/Monetização Pública fora da numeração** (iniciativa diferida v1.7+). Runbook: `ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `AGENTS.md`. O plano 46-01 faz a **grep-verificação** com zero resíduos de estado atual; artefatos históricos não são reescritos.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte da verdade (OpenSpec F46)
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/proposal.md` — Why / What Changes / Capabilities / Impact (13 call sites, 14 envs, 3 problemas, furos 1–7, callers produtivos sem telemetria)
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/design.md` — decisões D1–D8 + estado real verificado (linhas) + Mapping código/testes + Migration Plan + Risks + decisões consolidadas
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/tasks.md` — 9 planos (46-01..46-09, 5 ondas) com sub-tarefas; base direta dos PLAN.md
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/specs/ai-model-registry/spec.md` — capability nova (ADDED): registry por capacidade, defaults, chaves, allowlist, `AiModelResolver`, fallback inicial, validação de alvos distintos, envs eliminadas
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/specs/ai-invocation-gateway/spec.md` — capability nova (ADDED): gateway, adapters por protocolo, contrato de resultado/usage, contrato de erro, envelope por tentativa, retry/timeout/cancelamento, comportamento preservado
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/specs/ai-cost-accounting/spec.md` — delta: telemetria call-level obrigatória pela camada única, modelo real, cobertura de todos os caminhos, views/RPC inalteradas
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/specs/ai-image-generation/spec.md` — delta MODIFIED/ADDED: provider/modelo via registry, execução via gateway, fallback `images.edit` como segunda chamada, telemetria com modelo real + componente da tool
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/specs/text-provider/spec.md` — delta ADDED/MODIFIED/REMOVED: fallback configurável pelo registry, `OpenAITextProvider` via gateway, `createTextProvider` sem `TEXT_PROVIDER`
- `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/specs/ai-campaign-intelligence/spec.md` — delta ADDED: `campaign_spec` via registry/gateway, telemetria, literal no enum
- `openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/` — **Change B (fora do escopo)**: persistência da seleção/catálogo; consome o seam `AiModelResolver`

### Código novo (a criar)
- `src/lib/ai/model-registry.ts`, `src/lib/ai/model-resolver.ts`, `src/lib/ai/gateway.ts`, `src/lib/ai/adapters/{chat-completions,responses,images,gemini}.ts`, `src/lib/ai/api-keys.ts`

### Código afetado (estado real 2026-09-12)
- Telemetria: `src/lib/ai-cost/types.ts` (`AiCallInfo` :103), `src/lib/ai-cost/tracker.ts`, `src/lib/ai-cost/cost-estimator.ts` (:194), `src/lib/ai-cost/ai-model-pricing.ts`, `src/lib/ai-cost/resolve-ai-cost`
- Imagem: `src/lib/image-generation/config.ts`, `providers/openai.ts` (:56, fallback `images.edit`), `providers/types.ts` (`ImageProvider`), `services/image-generation-service.ts` (`emitMetricsEvent` :135-142; `generateWithRetry`; `assemblePrompt`), `services/input-validation-service.ts` (:111), `services/image-review-service.ts` (:352)
- Texto: `src/lib/text-provider/{openai,gemini,factory}.ts`, `src/lib/copy/copy-director-service.ts`, `src/lib/campaign/correction-intent-service.ts`
- VS/Brand: `src/lib/visual-signature/{ai-image-generator,brand-profiler,identity-art-director,server-actions,types}.ts`, `src/lib/brand-assets/{brand-director,text-only-inference-service}.ts`
- Legado: `src/lib/campaign-intelligence/providers/openai.ts` + `src/app/api/campaign/generate/route.ts`
- Rotas/actions (furos 2/5/6/7): `src/app/api/store/[id]/logo/route.ts`, `src/app/api/store/[id]/logo/retry-brand-director/route.ts`, `src/lib/visual-signature/server-actions.ts`, `src/app/api/store/[id]/visual-signature/approve/route.ts` (2 call sites), `src/app/api/store/[id]/visual-signature/restore/route.ts`
- Enum de evento: `src/lib/visual-signature/types.ts` (`GenerationEventType` :102)
- Migration: `supabase/migrations/*_f46_generation_events_type.sql` (nova; precedente `20260906000003_f37_2_generation_events_type.sql`)
- Config: `.env.example` (:7-36)

### Testes (co-migração/alvo)
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` (`TEXT_FALLBACK_PROVIDER` :929/:960; `IMAGE_GENERATION_RESPONSES_MODEL`)
- `src/lib/ai-cost/__tests__/{tracker,cost-estimator,ai-model-pricing,admin-service,operation-runs-service}.test.ts`
- `src/lib/image-generation/services/__tests__/{image-generation-service,input-validation-service}.test.ts` + `src/app/api/campaign/generate-image/__tests__/campaign-generate.test.ts`, `concurrency.test.ts`, `regression-master-switch.test.ts`
- Suites irmãs **sem co-migração** (regressão de não-mudança): rota/schema/snapshot/domínio/UI/form/prompts

### Precedentes
- `.planning/phases/45-briefing-contextual-do-diretor-de-arte/` — formato de fase (trackings no planejamento + plans + UAT)
- `.planning/phases/43-revisao-brief-pre-geracao/` — trackings/registro e helpers puros
- `.planning/phases/38-1-ai-cost-accounting/` — `AiCostTracker`, `resolveAiCost`, `cost-estimator`, migration idempotente
- `.planning/phases/37.2-correcao-unica-por-nao-conformidade/` — migration do CHECK de `generation_events` (padrão DROP/ADD + REVERT)

</canonical_refs>

<specifics>
## Specific Ideas

- **Ordem de implementação (design Migration Plan):** (1) resolver + registry (com `protocol`) + gateway + adapters + chaves, sem migrar serviços; (2) migration CHECK `campaign_spec` + tipo TS **[BLOCKING]**; (3) migrar capacidades uma a uma (gates verdes a cada passo); (4) corrigir furos + cobrir todos os callers produtivos; (5) remover envs do runtime/`.env.example`, deploy, só então remover da Vercel; (6) rollback por capacidade mantendo o CHECK aditivo.
- **Seam de mock no gateway:** testes unitários do gateway usam adapter falso + sink controlado; o sink no-op só é aceito nesses testes.
- **Buffering/ordenação preservados:** VS bufferiza até conhecer `visual_signature_id`; brand-profile distingue vision×text por ordem — o sink injetável preserva.
- **Dois envelopes no fallback de imagem:** falha no Responses + sucesso no Images = duas tentativas reais, dois envelopes; nunca um.
- **`campaign_spec` sem rótulo incorreto:** não usar `campaign_copy` para a chamada legada.
- **Teste de inventário (46-06):** garante que todo `import`/chamada de serviço de IA em rota/action produtiva emite telemetria — nenhum caminho fora da camada única.
- **Semântica de custo honesta:** estimativa com `costEstimationNote`; `provider_reported_cost_usd` só quando o provedor reportar.
- **grep-verificação (trackings):** padrões precisos para F46/F47/F44/Stripe (nunca coringa que gere falso positivo em nota histórica); F44 não pode aparecer como fase numerada no estado atual.
- **Gates por etapa:** `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` verdes a cada plano.

</specifics>

<deferred>
## Deferred Ideas

- **F47 — Catálogo e Seleção de Modelos Admin (Change B)** — persistência da seleção, catálogo editável, depreciação de modelo, tela admin; consome o `AiModelResolver` sem refazer o gateway (`openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/`).
- **Remoção do módulo legado `campaign-intelligence`** — só com evidência de ausência de consumidores, em fase futura.
- **Unificação de streaming** — fora do escopo (providers non-streaming; pipeline NDJSON é do route handler).
- **Reconciliação financeira real** (`provider_reported_cost_usd`) — fase própria; a F46 mantém estimativa.
- **F44 — Temas de Campanha** (`themeId`) — fora da numeração desta fase.
- **Monetização pública / Stripe** — iniciativa diferida não numerada (v1.7+).

</deferred>

<key_requirements>
## Key Requirements

> Derivados diretamente do `tasks.md` (9 planos / 5 ondas). Cada PLAN.md referencia os IDs `F46-XX` correspondentes.

### 46-01 — Trackings, baseline e registry (onda 1)
- F46-01: Registrar F46 nos runbooks de trackings; grep-verificação de nomenclatura com zero resíduos
- F46-02: Inventário/baseline das 11 capacidades (serviço → protocolo → adapter → default) + baseline dos furos/caminhos sem telemetria (`file:line`) + baseline de testes
- F46-03: Criar `model-resolver.ts` (`AiModelResolver`) e `model-registry.ts` (`AiModelConfig` com `protocol` no primary e no fallback) com defaults idênticos (D1/D1.1)
- F46-04: Testes unitários do registry (resolução por capacidade, protocolos `responses`×`images`, default inicial de `campaign_copy`, visão com modelos distintos, allowlist, `primary ≠ fallback`)
- F46-05: Migration de extensão do CHECK `chk_generation_events_type` + tipo TS `GenerationEventType` com `campaign_spec` (idempotente, aditiva) (D6)

### 46-02 — Gateway, contrato e adapters (onda 1)
- F46-06: `api-keys.ts` com `getApiKey(provider)` (switch exaustivo; fail-fast em produção) + testes
- F46-07: `gateway.ts` com `invoke(capability, request, telemetry, target)` — alvo explícito, adapter por protocolo, uma tentativa, usage normalizado, um envelope por tentativa, contexto obrigatório (D2/D3/D4)
- F46-08: Adapters `chat-completions`/`responses`/`images`/`gemini` com contrato único; `AbortSignal` propagado
- F46-09: Estender `AiCallInfo` com `capability`/`protocol`/`status`/`errorType`; testes de envelope (success/failed/timeout), usage normalizado/ausente, sem retry/fallback, signal, modelo real
- F46-10: Contrato de erro `AiInvocationError` (`kind`/`httpStatus`/`retryable`/`code`/`message` sanitizada) preservando os gates (D4.1)
- F46-11: Sink padrão (`resolveAiCost` + `AiCostTracker`) + interface de sink injetável; testes de buffering/ordenação e best-effort

### 46-03 — Migração das capacidades de TEXTO (onda 2)
- F46-12: Migrar `campaign_copy` (`copy-director-service.ts` + `text-provider/openai.ts`/`gemini.ts`) preservando `TextProviderResult`; fallback configurado como segunda `invoke(..., target: "fallback")` explícita
- F46-13: Migrar `campaign_correction_analysis` (`correction-intent-service.ts`)
- F46-14: Migrar `brand_profile_text` (`text-only-inference-service.ts`)
- F46-15: Migrar `campaign_spec` legado (`campaign-intelligence/providers/openai.ts`); fallback `json_schema`→`json_object` como segunda `invoke` explícita
- F46-16: Gates + co-migração de testes de texto (sem mudança de comportamento)

### 46-04 — Migração das capacidades de VISÃO (onda 2)
- F46-17: Migrar `campaign_input_validation` (`input-validation-service.ts`) e `campaign_image_review` (`image-review-service.ts`) com modelo real
- F46-18: Migrar `brand_profile_vision` (`brand-profiler.ts`, `brand-director.ts`)
- F46-19: Migrar `visual_signature_validation` (`ai-image-generator.ts` validator)
- F46-20: Corrigir o furo 1 (`emitMetricsEvent` deixa de hardcodar o modelo de imagem)
- F46-21: Gates + co-migração de testes de visão (custo pelo pricing do modelo real)

### 46-05 — Migração das capacidades de IMAGEM (onda 2)
- F46-22: Migrar `campaign_image` (adapter `responses` com tool `image_generation`) preservando tamanho/qualidade
- F46-23: Migrar `campaign_image_edit` como segunda `invoke` explícita (adapter `images`); corrigir o furo 3 (`not_available` + duração + estimativa por unidade); dois envelopes
- F46-24: Migrar `visual_signature_image` + corrigir o furo 4 (`imageGenerationTool: true` + `generationType`); estender `cost-estimator.ts` para `campaign_image` **e** `visual_signature_image` (testes separados)
- F46-25: Gates + co-migração de testes de imagem/fallback; asserir que fallback gera dois eventos

### 46-06 — Cobertura de telemetria em todos os callers produtivos (onda 3)
- F46-26: `POST /api/store/[id]/logo` com contexto de telemetria (furo 2)
- F46-27: `POST /api/store/[id]/logo/retry-brand-director` (furo 2)
- F46-28: `visual-signature/server-actions.ts` (`generateVariations`/`generateAutomatic`) (furo 5)
- F46-29: `visual-signature/approve` (2 call sites) e `visual-signature/restore` (furos 6/7)
- F46-30: Teste de inventário (nenhum caminho produtivo fora da camada única)
- F46-31: Testes dos caminhos (evento call-level com custo, modelo real, duração; regressão)

### 46-07 — Remoção das env-vars de modelo (onda 3)
- F46-32: Grep-confirmação de que nenhum serviço lê env-var de modelo/provider; remover leituras residuais
- F46-33: Atualizar `.env.example` (manter apenas chaves + operacionais; remover as 14)
- F46-34: Co-migrar testes que referenciam `IMAGE_GENERATION_RESPONSES_MODEL` e `TEXT_FALLBACK_PROVIDER`
- F46-35: Confirmar que o alvo de fallback inicial está no registry antes de remover `TEXT_FALLBACK_PROVIDER`
- F46-36: Registrar a ordem de deploy (código lê só chaves primeiro; Vercel depois) (D5)

### 46-08 — Regressão e não-mudança do contrato externo (onda 4)
- F46-37: Regressão completa (vitest total) + corrigir resíduos de fixtures/asserções
- F46-38: typecheck/lint/build; verificar UI/form/schema público/snapshot/domínio/prompts intactos
- F46-39: Equivalência de defaults (registry × comportamento pré-F46) e ausência de drift nos prompts

### 46-09 — Verificação final (onda 5)
- F46-40: Gerar `46-VERIFICATION.md` (goal-backward) e `46-UAT.md` (roteiro humano: campanha, VS, brand profile, copy, logo — comportamento idêntico)
- F46-41: Confirmar 4 gates verdes + critérios da proposta (registry com `protocol` no primary/fallback, `AiModelResolver`, gateway/adapters com alvo explícito, envelope por tentativa, contrato de erro, todos os callers com telemetria, migration `campaign_spec` aditiva, estimativa correta em `campaign_image`+`visual_signature_image`, envs removidas, comportamento preservado)
- F46-42: Atualizar registros (AGENTS.md/STATE/ROADMAP) e preparar arquivamento do change após aprovação

</key_requirements>

---

*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Context gathered: 2026-09-12 via OpenSpec change artifacts (fase-46)*
