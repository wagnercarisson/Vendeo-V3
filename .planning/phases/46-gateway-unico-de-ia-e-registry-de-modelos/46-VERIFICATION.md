---
status: passed
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
updated: 2026-09-12
---

# Phase 46: Gateway Único de IA e Registry de Modelos — Verification

**Verificado em:** 2026-09-12 (plano 46-09, Tasks 1–2)
**Fonte da verdade:** `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/`
**Context:** `.planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-CONTEXT.md`
**Status da verificação automatizada:** passed (4 gates verdes + goal-backward sobre as 6 specs + 10 critérios da proposta confirmados)
**UAT humana:** pendente — ver `46-UAT.md` (seção 5 deste documento)

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **275 files / 2720 tests passed** (34,19s) |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | 0 | Sem erros |
| Lint | `npm run lint` (`eslint .`) | 0 | Sem erros |
| Build | `npm run build` (`npm run check:cnae && next build`) | 0 | Build Next.js concluído (check:cnae incluído) |

**Evidência adicional (não-mudança do contrato externo):**

| Verificação | Comando | Resultado |
|---|---|---|
| Caminhos congelados | `git diff --name-only 3e2d7ff1 HEAD -- 'prompts/*.md' 'src/lib/image-generation/schema.ts' 'src/lib/campaign/brief.ts' 'src/components/flow/*' 'src/components/campaign/*'` | **vazio** (UI/form/schema público/snapshot/domínio intactos) |
| Prompt drift | `git diff --name-only 3e2d7ff1 HEAD -- 'prompts/*.md'` | **vazio** (nenhum dos 16 prompts alterado) |
| Envs removidas (14) | grep `process.env.(<14 envs>)` em `src/` + `scripts/` | **0 ocorrências** |
| `.env.example` | inspeção | apenas chaves (`OPENAI_API_KEY`, `GEMINI_API_KEY`) + operacionais — **nenhuma env de modelo/provider** |

### Registro de Execução dos Gates (Task 2 — 2026-09-12)

| Ordem | Comando | Exit | Resultado bruto |
|---|---|---|---|
| 1 | `npx vitest run` | 0 | `Test Files 275 passed (275)` / `Tests 2720 passed (2720)` — 34,19s |
| 2 | `npm run typecheck` | 0 | `tsc -p tsconfig.typecheck.json --noEmit` — sem saída de erro |
| 3 | `npm run lint` | 0 | `eslint .` — sem saída de erro |
| 4 | `npm run build` | 0 | `next build` concluído + `check:cnae` incluído; rotas geradas |

**Critérios da proposta (10/10) confirmados** na seção 4, com evidência concreta por critério. `46-VERIFICATION.md` marcado como `passed`.

---

## 2. Matriz Planos × Gates (fase completa)

| Plan | O que construiu | Testes | Typecheck | Lint | Build |
|------|-----------------|--------|-----------|------|-------|
| 46-01 | Trackings D1 + baseline/inventário das 11 capacidades + registry (`AiModelConfig` com `protocol`) + migration CHECK `campaign_spec` | ✅ | ✓ | ✓ | ✓ |
| 46-02 | api-keys + gateway (`invoke`/alvo explícito/uma tentativa) + adapters por protocolo + `AiCallEnvelope` + contrato de erro + sink + mapa capability→generationType | ✅ | ✓ | ✓ | ✓ |
| 46-03 | Migração das capacidades de TEXTO (copy, correção, brand_profile_text, campaign_spec legado) + proprietário único + remoção da persistência manual | ✅ | ✓ | ✓ | ✓ |
| 46-04 | Migração das capacidades de VISÃO + furo 1 (modelo real) + conversão atômica de todos os callers de visão — 271 files / 2697 testes | ✅ | ✓ | ✓ | ✓ |
| 46-05 | Migração das capacidades de IMAGEM (`campaign_image` responses; `campaign_image_edit` segunda invoke = dois envelopes; `visual_signature_image`) + furos 3/4 + cost-estimator — 272 files / 2702 testes | ✅ | ✓ | ✓ | ✓ |
| 46-06 | Gate global de arquitetura (SDK/wire + persistência manual) + inventário global de telemetria — 275 files / 2719 testes | ✅ | ✓ | ✓ | ✓ |
| 46-07 | Remoção das 14 env-vars de modelo/provider do runtime e `.env.example` + extensão do gate (env-var) + ordem de deploy — 275 files / 2720 testes | ✅ | ✓ | ✓ | ✓ |
| 46-08 | Regressão completa + não-mudança do contrato externo + equivalência de defaults — 275 files / 2720 testes, prompts sem drift | ✅ | ✓ | ✓ | ✓ |
| 46-09 | Verificação final (este documento + `46-UAT.md`) | ✅ | ✓ | ✓ | ✓ |

---

## 3. Goal-Backward sobre as Specs

### 3.1 `ai-model-registry` (capability nova — 8 requirements)

| # | Requirement (spec) | Evidência (arquivo:linha/teste) | Status |
|---|--------------------|----------------------------------|--------|
| 1 | Registro central de modelos por capacidade (`{ capability, segment, primary, fallback? }`; `protocol` em cada alvo; única fonte da verdade) | `src/lib/ai/model-registry.ts:79-136` (`MODEL_REGISTRY`, 11 capacidades; `protocol` no primary e no fallback — ex.: `campaign_copy:83-84`); `model-resolver.ts:15-50` (`AiCapability`/`AiModelTarget`/`AiModelConfig`); `model-registry.test.ts` — "resolve as 11 capacidades com capability/segment/primary consistentes", "campaign_image → responses e campaign_image_edit → images (protocolos distintos no mesmo segmento)", "campaign_copy tem primary chat-completions e fallback gemini" | ✅ passed |
| 2 | Defaults idênticos ao comportamento pré-F46 (gpt-4o, gpt-4o-mini, gpt-5.5, gpt-image-2) | `model-registry.ts:79-136`; `model-registry.test.ts` — "defaults preservados por capacidade (baseline D5)", "visão mantém modelos distintos (campaign_image_review gpt-4o × visual_signature_validation gpt-4o-mini)", "visual_signature_validation usa responses com gpt-4o-mini"; equivalência capacidade a capacidade em `46-08-SUMMARY.md` (11/11, zero divergência) | ✅ passed |
| 3 | Resolução de chaves exclusivamente por `OPENAI_API_KEY`/`GEMINI_API_KEY`; fail-fast em produção | `src/lib/ai/api-keys.ts:20-46` (`getApiKey` com switch exaustivo; `resolveKey` fail-fast quando `NODE_ENV === "production"`); `api-keys.test.ts` — "openai → OPENAI_API_KEY", "gemini → GEMINI_API_KEY", "produção sem chave lança erro de configuração (fail-fast, sem fallback silencioso)", "dev/teste sem chave retorna \"\" (nunca undefined)" | ✅ passed |
| 4 | Allowlist validada por **capacidade + provider + modelo + protocolo**; modelo fora da allowlist/protocolo incompatível rejeitado | `model-registry.ts:29-55` (`MODEL_ALLOWLIST` por provider→modelo→protocolos + `CAPABILITY_PROTOCOLS`); `:138-165` (`assertValidTarget`); `:173-194` (`validateModelConfig`); `model-registry.test.ts` — "rejeita modelo fora da allowlist", "rejeita protocolo incompatível com o modelo", "rejeita protocolo incompatível com a capacidade", "rejeita combinação provider/model trocada (gemini + gpt-4o)", "rejeita combinação provider/model trocada (openai + gemini-3.1-flash-lite)" | ✅ passed |
| 5 | Interface `AiModelResolver` assíncrona (`resolve` + `listCapabilities`); gateway depende **apenas** da interface, injetada por construtor | `model-resolver.ts:56-59` (`AiModelResolver`); `model-registry.ts:231-247` (`ModelRegistry implements AiModelResolver`, `async resolve`); `gateway.ts:46-50` (construtor recebe `resolver`); `model-registry.test.ts` — "resolve() retorna Promise (compatível com o resolver persistido da F47)"; `gateway.test.ts` — "resolve pelo resolver injetado e usa o adapter do protocolo do alvo" | ✅ passed |
| 6 | Alvo de fallback inicial como **configuração** (não regra); sem `if provider === "gemini"` | `model-registry.ts:80-85` (`campaign_copy.fallback = { gemini, gemini-3.1-flash-lite, gemini }`); `gateway.ts:57-62` (`hasFallback` compara provider/model **sem conhecer o nome do provider**); `model-registry.test.ts` — "campaign_copy tem primary chat-completions e fallback gemini (default inicial — configuração, não regra)"; `architecture-guard.test.ts` não encontra lógica condicional por provider | ✅ passed |
| 7 | Validação de alvos distintos (`primary` ≠ `fallback`) | `model-registry.ts:185-192`; `model-registry.test.ts` — "rejeita primary e fallback com o mesmo provider + model", "aceita fallback distinto (provider ou modelo diferente)" | ✅ passed |
| 8 | Env-vars de modelo eliminadas do runtime | `architecture-guard.test.ts:80-81,124-131` (gate proíbe `process.env.<14 envs>` fora de adapters); `.env.example` sem envs de modelo; grep em `src/` + `scripts/` → 0 ocorrências; `46-07-SUMMARY.md` | ✅ passed |

### 3.2 `ai-invocation-gateway` (capability nova — 7 requirements)

| # | Requirement (spec) | Evidência (arquivo:linha/teste) | Status |
|---|--------------------|----------------------------------|--------|
| 1 | Camada única `AiGateway(resolver, adapters)` + `invoke(capability, request, telemetry, target = "primary")`; contexto obrigatório; serviço não instancia provider | `gateway.ts:46-70` (construtor + `invoke` com `target` explícito); `:139-146` (`assertTelemetryContext` exige `sink`); `gateway.test.ts` — "contexto sem sink → rejeita sem executar tentativa", "contexto ausente → rejeita", "target não informado → primary (nunca aciona fallback automaticamente)", "target fallback resolve o alvo configurado"; `architecture-guard.test.ts:86-96` (nenhum `new OpenAI()`/wire fora de adapters) | ✅ passed |
| 2 | Adapters por protocolo (`chat-completions`/`responses`/`images`/`gemini`); adapter pelo `protocol` do alvo; adapter não contém regra de negócio | `src/lib/ai/adapters/{chat-completions,responses,images,gemini}.ts` + `adapters/registry.ts`; `gateway.ts:83` (`adapters.get(selected.protocol)`); `types.ts:158-167` (`AiAdapter`/`AiAdapterRegistry`); `adapters.test.ts` — "ChatCompletionsAdapter — contrato único", "ResponsesAdapter — breakdown granular e tool image_generation", "ImagesAdapter — ausência de usage é explícita", "GeminiAdapter — generateContent e usageMetadata", "adapter não decide o modelo — usa exatamente o modelo do alvo" | ✅ passed |
| 3 | Contrato único de resultado/usage; modelo real; provider sem usage explícito (`not_available`) | `types.ts:96-108` (`AiInvocationResult` com `model` real + `usage`/`usageMeta`); `adapters.test.ts` — "normaliza content/usage e usa o modelo do alvo", "images.edit sem usage marca providerUsageSource=images.edit (nunca zeros)", "usage normalizado no mesmo formato TokenUsage do chat-completions", "imagem presente SEM usage → usageMeta.imageGenerationTool=true" | ✅ passed |
| 4 | Contrato de erro `AiInvocationError` preservando os gates (rate_limit/timeout/network/5xx retryable; auth/safety não; capability para images.edit/json_object; domínio não normalizado) | `types.ts:169-206` (`AiInvocationError`) + `:258-416` (`normalizeAiError`); `gateway.ts:107-125`; `adapters.test.ts` — "rate limit (429) → kind rate_limit e retryable", "timeout (AbortError) → kind timeout e retryable", "5xx → provider_error retryable", "auth (401/403) → auth NÃO retryable", "safety/content_filter → content_filter NÃO retryable", "capability de tool (model_not_found) → kind capability (habilita images.edit)", "capability de response_format/json_schema → kind capability (habilita json_object)", "MalformedResponseError NÃO é normalizado (propaga o original)", "erro desconhecido → provider_error NÃO retryable"; `gateway.test.ts` — "erro de domínio (MalformedResponseError) não é normalizado e propaga o original" | ✅ passed |
| 5 | Um envelope de telemetria por tentativa real (success/failed/timeout), modelo real, usage/`not_available`, duração; persistência best-effort; sink preserva buffering/ordenação | `types.ts:114-132` (`AiCallEnvelope`); `gateway.ts:92-126` (um `emit` por tentativa; `model: result.model` no sucesso / `selected.model` na falha); `telemetry-sink.ts:51-102` (`DefaultAiTelemetrySink` fail-open), `:164-187` (`BufferingAiTelemetrySink`); `gateway.test.ts` — "sucesso emite exatamente um envelope com modelo real, capability e protocol", "falha emite um envelope failed com errorType normalizado e re-lança AiInvocationError", "timeout (AbortError) emite envelope status timeout + errorType timeout", "sink defeituoso não bloqueia a geração (best-effort)"; `telemetry-sink.test.ts` — "record lançando NÃO propaga (fail-open)", "acumula na ordem de emissão e entrega no flush" | ✅ passed |
| 6 | Gateway faz uma tentativa (sem retry/fallback automático); fallback = segunda `invoke` explícita; `AbortSignal` propagado | `gateway.ts:64-127` (uma chamada `adapter.invoke`); `:57-62` (`hasFallback` só informa existência); `gateway.test.ts` — "target fallback resolve o alvo configurado e usa o adapter do protocolo dele", "fallback ausente → erro de capability, sem tentativa e sem envelope", "AbortSignal é propagado ao adapter (mesmo objeto de request)"; `adapters.test.ts` — describe "Adapters — AbortSignal propagado ao provider (D4)" (4 protocolos) | ✅ passed |
| 7 | Comportamento preservado (defaults, prompts, parâmetros, fallback configurado; contrato externo inalterado) | `46-08-SUMMARY.md` (equivalência de defaults 11/11; `git diff 3e2d7ff1 HEAD -- prompts/...` vazio; caminhos congelados vazios); `campaign-spec.test.ts` (Structured Outputs + fallback `json_object`); suites de rota/schema/snapshot/domínio verdes sem co-migração | ✅ passed |

### 3.3 `ai-cost-accounting` (delta — 5 requirements)

| # | Requirement (spec) | Evidência (arquivo:linha/teste) | Status |
|---|--------------------|----------------------------------|--------|
| 1 | Telemetria call-level obrigatória emitida pela camada única; best-effort; fase sem chamada real não gera evento | `gateway.ts:92-136` (emissão por tentativa via `telemetry.sink`); `telemetry-sink.ts:57-102` (`resolveAiCost` + `AiCostTracker.record`, fail-open); `telemetry-sink.test.ts` — "persiste o evento com generationType mapeado e metadata capability/protocol", "record lançando NÃO propaga", "resolveAiCost lançando NÃO propaga e não grava"; confirmação de fase `input_validation` `skipped` sem evento (46-04/46-06) | ✅ passed |
| 2 | Mapa canônico `CAPABILITY_GENERATION_TYPE` (11 capacidades; `campaign_image_edit → campaign_image`; metadata preserva capability/protocol) | `generation-type-map.ts:13-25`; `telemetry-sink.ts:59,142-143` (mapeia + grava `capability`/`protocol` no metadata); `telemetry-sink.test.ts` — "cobre exatamente as 11 capacidades", "campaign_image_edit → campaign_image (fallback de edição pertence à etapa de imagem)", "demais capacidades mapeiam para o próprio literal", "persiste o evento com generationType mapeado e metadata capability/protocol" | ✅ passed |
| 3 | Modelo real reportado por chamada (visão registra gpt-4o, nunca o modelo de imagem) | `gateway.ts:100` (`model: result.model`); `gateway.test.ts` — "sucesso emite exatamente um envelope com modelo real"; `image-tool-telemetry-integration.test.ts` — "campaign_image com imagem e SEM usage chega ao estimador com imageGenerationTool=true"; `cost-estimator.test.ts` — pricing do modelo real (visão) | ✅ passed |
| 4 | Cobertura de telemetria em todos os caminhos (logo, retry-brand-director, server-actions, approve, restore, brand-profile/*, correction-reports) + gate global; fallback images.edit registrado; componente da tool em `campaign_image` **e** `visual_signature_image` | `telemetry-coverage.test.ts:15-39` (14 `KNOWN_CALLERS`), `:93-126` (todo caller com telemetria; nenhum `resolveAiCost` manual; toda rota que instancia serviço de IA com telemetria); `architecture-guard.test.ts:98-122`; `cost-estimator.ts:188-190` (tool somada em `campaign_image` **e** `visual_signature_image`); `cost-estimator.test.ts:332` — "imageGenerationTool=true + visual_signature_image + tool pricing presente → TAMBÉM soma text_component + image_tool_component (F46-05)", `:368/:398` (sem usage → estimativa parcial), `:443` (anti-dupla-cobrança em `visual_signature` genérico); `adapters.test.ts` — "images.edit sem usage marca providerUsageSource=images.edit" | ✅ passed |
| 5 | Views/RPC de apuração inalterados | `46-08-SUMMARY.md` (nenhuma alteração de views/RPC; migration apenas aditiva do CHECK); `operation-runs-service.test.ts` verde | ✅ passed |

### 3.4 `ai-image-generation` (delta — 2 MODIFIED + 2 ADDED)

| # | Requirement (spec) | Evidência (arquivo:linha/teste) | Status |
|---|--------------------|----------------------------------|--------|
| M1 | Image provider resolvido pelo registry (não `IMAGE_PROVIDER`); rota obtém via gateway; `ImageProvider` mantida como contrato interno | `model-registry.ts:121-135` (`campaign_image`/`visual_signature_image` → openai); `architecture-guard.test.ts:124-131` (nenhuma leitura de `IMAGE_PROVIDER`); `providers/openai.ts` delega ao gateway; `46-05-SUMMARY.md` | ✅ passed |
| M2 | Modelo de imagem resolvido pelo registry (`gpt-5.5`); visão `gpt-4o`/`gpt-4o-mini`; fallback edição `gpt-image-2` | `model-registry.ts:101-135`; `model-registry.test.ts` — "defaults preservados por capacidade (baseline D5)", "visão mantém modelos distintos"; `cost-estimator.test.ts` (pricing por modelo do caminho usado) | ✅ passed |
| A1 | Execução via gateway com adapter `responses` (tool `image_generation`); fallback `images.edit` como segunda invoke explícita (2 gatilhos; auth/safety/rate-limit não); dois envelopes | `image-generation/providers/openai.ts` (delega ao gateway); `adapters.test.ts` — "tool image_generation sem imagem na resposta → falha de capability (F46-05 reabertura)"; `46-05-SUMMARY.md` (dois envelopes; gatilhos); `image-tool-telemetry-integration.test.ts` | ✅ passed |
| A2 | Telemetria de imagem com modelo real + componente da tool em `campaign_image` **e** `visual_signature_image` | `gateway.ts:100`; `telemetry-sink.ts:67` (`usageMeta.imageGenerationTool === true` — única fonte); `cost-estimator.ts:188-190`; `cost-estimator.test.ts:332` (VS soma a tool), `:398` (VS sem usage), `:443` (anti-dupla-cobrança) | ✅ passed |

### 3.5 `text-provider` (delta — 1 ADDED + 2 MODIFIED + 1 REMOVED)

| # | Requirement (spec) | Evidência (arquivo:linha/teste) | Status |
|---|--------------------|----------------------------------|--------|
| A1 | Fallback configurável resolvido pelo registry e acionado pelo orquestrador (segunda `invoke(target:"fallback")` explícita; orquestrador não conhece provider) | `model-registry.ts:80-85`; `gateway.ts:57-62` + `:73` (seleção do alvo); `copy-director-service.ts` (dono único de `invoke("campaign_copy")`; rota aciona fallback chamando o serviço com `target: "fallback"` — D11); `46-03-SUMMARY.md` | ✅ passed |
| M1 | `OpenAITextProvider` com modelo do registry (`gpt-4o`), via gateway, preservando `TextProviderResult` | `text-provider/openai.ts` (fachada delegando ao gateway); `model-registry.ts:80-85`; `46-03-SUMMARY.md`; suites de copy verdes | ✅ passed |
| M2 | `createTextProvider` sem `TEXT_PROVIDER`; provider padrão do registry; fora do caminho de produção | `text-provider/factory.ts`; `architecture-guard.test.ts:124-131` (nenhuma leitura de `TEXT_PROVIDER`); `46-03-SUMMARY.md` (fachadas exigem `AiTelemetryContext`; no-op só em teste) | ✅ passed |
| R1 | `TEXT_PROVIDER` env var removida (migration para registry) | `.env.example` sem `TEXT_PROVIDER`; grep 0 ocorrências; `architecture-guard.test.ts` | ✅ passed |

### 3.6 `ai-campaign-intelligence` (delta — 3 ADDED)

| # | Requirement (spec) | Evidência (arquivo:linha/teste) | Status |
|---|--------------------|----------------------------------|--------|
| 1 | `campaign_spec` resolvida pelo registry (`gpt-4o-mini`), sem `OPENAI_MODEL`; via gateway; contrato `CampaignSpec` + fallback `json_schema`→`json_object` preservados; módulo não removido | `model-registry.ts:96-100`; `campaign-intelligence/providers/openai.ts` (via gateway); `campaign-spec.test.ts:85-100` — "campaign_spec — OpenAIProvider via gateway (F46-15)" (capability `campaign_spec`, `request.jsonSchema?.name === "campaign_spec"`); `.env.example` sem `OPENAI_MODEL` | ✅ passed |
| 2 | Telemetria da campanha legada emitida pela camada única (provider, modelo real, usage, duração) | `telemetry-sink.ts`; `campaign-spec.test.ts`; `46-03-SUMMARY.md` (rota usa `AiCostTracker.startRun("campaign_delivery")`, attemptNumber 1 primary / 2 fallback) | ✅ passed |
| 3 | Literal `campaign_spec` no enum (migration idempotente DROP/ADD + REVERT; TS `GenerationEventType`) | `supabase/migrations/20260912000001_f46_generation_events_type.sql:18-32` (CHECK com `campaign_spec`; bloco REVERT comentado `:34-48`); `src/lib/visual-signature/types.ts:102,105-119` (`GenerationEventType` inclui `'campaign_spec'`); `telemetry-sink.test.ts:66` — "campaign_spec → campaign_spec"; migration aplicada no remoto (46-01) | ✅ passed |

---

## 4. Critérios de Aceitação da Proposta (proposal + ROADMAP Success criteria 1–10)

| # | Critério | Evidência concreta | Status |
|---|----------|--------------------|--------|
| 1 | Registry 11 capacidades com `protocol` no primary **e** fallback; allowlist por capacidade+provider+modelo+protocolo; `primary ≠ fallback` rejeitado | `model-registry.ts:29-55,79-136,138-194`; `model-registry.test.ts` (defaults, protocolos, allowlist, primary≠fallback) | ✅ confirmado |
| 2 | `AiModelResolver` (`resolve` + `listCapabilities`); gateway depende só da interface; substituível sem refazer o gateway | `model-resolver.ts:56-59`; `model-registry.ts:231-247`; `gateway.ts:46-50`; `gateway.test.ts:69` (resolver injetado); `model-registry.test.ts:103` (Promise) | ✅ confirmado |
| 3 | Gateway `invoke(capability, request, telemetry, target)` — alvo explícito, adapter por protocolo, uma tentativa, envelope por tentativa, contexto obrigatório | `gateway.ts:64-146`; `gateway.test.ts` (primary/fallback, uma tentativa, envelope, contexto obrigatório, AbortSignal) | ✅ confirmado |
| 4 | Adapters `chat-completions`/`responses`/`images`/`gemini` com contrato único; `AbortSignal` propagado; adapter sem regra de negócio | `src/lib/ai/adapters/*`; `adapters.test.ts` (contrato único + AbortSignal nos 4 protocolos) | ✅ confirmado |
| 5 | Contrato de erro `AiInvocationError` preservando gates (retryable; images.edit só capability+primary; json_object só capability de response_format; auth/safety não) | `types.ts:169-416`; `adapters.test.ts:81-223` (16 testes de normalização) | ✅ confirmado |
| 6 | Telemetria correta: `AiCallEnvelope`; modelo real em validation/review; fallback `images.edit` sem usage (`not_available`+duração+custo/unidade); tool somada em `campaign_image` **e** `visual_signature_image`; views/RPC inalteradas | `types.ts:114-132`; `gateway.ts:100`; `telemetry-sink.ts:67`; `adapters.test.ts` (images.edit sem usage); `cost-estimator.ts:188-190`; `cost-estimator.test.ts:332,398,443`; `telemetry-sink.test.ts` | ✅ confirmado |
| 7 | Migração incremental das 11 capacidades preservando `TextProviderResult`, prompts, parâmetros, retry/backoff/timeout, structured outputs e fallback configurado como segunda invoke | `46-03/04/05/08-SUMMARY.md`; `campaign-spec.test.ts`; `git diff 3e2d7ff1 HEAD -- prompts/` vazio; caminhos congelados vazios | ✅ confirmado |
| 8 | Cobertura de telemetria em todos os callers produtivos hoje sem `onCall` (logo, retry, server-actions, approve, restore); teste de inventário | `telemetry-coverage.test.ts:15-39,93-126`; `architecture-guard.test.ts`; `46-04/46-06-SUMMARY.md` | ✅ confirmado |
| 9 | Legado `campaign-intelligence` como `campaign_spec` via gateway; migration idempotente/aditiva estende CHECK + tipo TS; rollback mantém o CHECK | `model-registry.ts:96-100`; `campaign-spec.test.ts`; `20260912000001_f46_generation_events_type.sql`; `types.ts` (visual-signature) `:119` | ✅ confirmado |
| 10 | Remoção das 14 envs do runtime e `.env.example` (restam chaves+operacionais); ordem de deploy; 4 gates; UAT humano | `.env.example` (chaves+operacionais); grep 0 ocorrências; `architecture-guard.test.ts:124-131`; `46-07-SUMMARY.md` (ordem de deploy D5); **4 gates verdes (seção 1)**; UAT humano — **pendente (checkpoint)** | ✅ confirmado (automatizado) / UAT pendente |

---

## 5. Pendências / Checkpoint

- **UAT humana — EM CHECKPOINT (46-09 Task 3, `gate="blocking"`):** a verificação automatizada e goal-backward acima está **passed**; o fechamento final da fase depende da **execução humana do roteiro** em **`46-UAT.md`** (campanha completa, variações de assinatura visual, brand profile com logo/approve/restore, copy e caminho de logo), confirmando **comportamento idêntico ao atual** e a **telemetria call-level com o modelo real** (copy: gpt-4o; visão: gpt-4o; imagem: gpt-5.5 e gpt-image-2 no fallback). Após a aprovação humana, o Task 4 atualiza os registros (AGENTS.md/STATE/ROADMAP/PROJECT) e prepara o arquivamento do change — sem reescrever artefatos históricos.
- **Sem blockers automatizados.** 4 gates verdes; contrato externo intacto; prompts sem drift; 14 envs removidas do runtime.
- **F44/Stripe:** F44 = Temas de Campanha permanece fora da numeração; Stripe/Monetização Pública segue diferida (v1.7+) — sem resíduos de estado atual.

---

*Fase 46 verificada (automatizada): 4 gates verdes + goal-backward sobre as 6 specs com evidência por requisito + 10 critérios da proposta confirmados. UAT humano pendente (`46-UAT.md`, checkpoint Task 3).*
