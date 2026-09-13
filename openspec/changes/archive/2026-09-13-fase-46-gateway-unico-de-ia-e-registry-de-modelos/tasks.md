# Tasks — Fase 46: Gateway Único de IA e Registry de Modelos

> Divide a implementação em **plans pequenos (46-01..46-09)** por ondas. Executar somente após revisão/aprovação dos artefatos (proposal/design/specs). Cada plano mantém os 4 gates verdes (vitest/typecheck/lint/build). Specs de referência: `specs/ai-model-registry/spec.md`, `specs/ai-invocation-gateway/spec.md`, `specs/ai-cost-accounting/spec.md`, `specs/ai-image-generation/spec.md`, `specs/text-provider/spec.md`, `specs/ai-campaign-intelligence/spec.md`. Design: `design.md`. **Nota (revisão 2026-09-12):** o DAG de execução é serializado por `depends_on` nos PLAN.md (planos que tocam o mesmo arquivo não rodam em paralelo) — as ondas abaixo refletem essa serialização.

## 1. Plan 46-01 — Trackings, baseline e registry (onda 1)

- [x] 1.1 Registrar F46 nos runbooks de trackings conforme padrão de fases anteriores; grep-verificação de nomenclatura com zero resíduos
- [x] 1.2 Inventário/baseline: mapear as 11 capacidades → serviço → protocolo → adapter → default atual; registrar baseline dos furos/caminhos sem telemetria (logo, retry-brand-director, server-actions, approve, restore — evidência `file:line`) e baseline de testes
- [x] 1.3 Criar `src/lib/ai/model-resolver.ts` com a interface `AiModelResolver` (seam para o Change B) e `src/lib/ai/model-registry.ts` com o mapa capacidade → `AiModelConfig { capability, segment, primary: { provider, model, protocol }, fallback?: { provider, model, protocol } }` e defaults idênticos aos atuais (design D1/D1.1)
- [x] 1.4 Testes unitários do registry: resolução por capacidade, `primary.protocol` correto por capacidade (`responses` × `images`), **default inicial** de `campaign_copy` (`primary.protocol = chat-completions`, `fallback.protocol = gemini`), defaults preservados, visão com modelos distintos (gpt-4o × gpt-4o-mini), allowlist rejeita modelo/protocolo inválido, **validação `primary ≠ fallback`** (mesmo `provider`+`model` rejeitado). Nenhum teste deve codificar "sempre chamar Gemini" — só o teste do default inicial do registry menciona Gemini.
- [x] 1.5 Migration de extensão do CHECK `chk_generation_events_type` (+ tipo TS `GenerationEventType`) com `campaign_spec`, idempotente; extensão **aditiva** — o rollback de código mantém o CHECK, e o REVERT só se aplica antes de existir evento `campaign_spec` (design D6)

## 2. Plan 46-02 — Gateway, contrato e adapters (onda 2)

- [x] 2.1 Criar `src/lib/ai/api-keys.ts` com `getApiKey(provider)` e **switch exaustivo** por provider; fail-fast em produção sem chave + testes
- [x] 2.2 Criar `src/lib/ai/gateway.ts` com `invoke(capability, request, telemetry, target = "primary")`: resolve config via `AiModelResolver`, seleciona o **alvo explícito** (`primary`/`fallback`) e o adapter pelo `protocol` do alvo, executa **uma tentativa** (sem retry e **sem fallback automático**), normaliza usage, emite **um envelope por tentativa** via sink injetável; contexto de telemetria obrigatório em produção (design D2/D3/D4)
- [x] 2.3 Criar adapters `chat-completions`, `responses`, `images`, `gemini` em `src/lib/ai/adapters/` com contrato único de request/result/usage; propagar `AbortSignal`
- [x] 2.4 Criar `AiCallEnvelope extends AiCallInfo` (aditivo) em `src/lib/ai/types.ts` com `capability`, `protocol`, `status`, `errorType?` e **`usageMeta?`** (inclui `imageGenerationTool` — fonte da verdade do componente da tool, nunca inferida do protocolo `responses`); **`AiCallInfo` legado intacto**; testes: envelope por tentativa (success/failed/timeout), contrato de usage normalizado, ausência de usage explícita, sem retry/fallback, propagação de signal, modelo real, `usageMeta` encaminhado pelo gateway
- [x] 2.5 Implementar o **contrato de erro normalizado** (`AiInvocationError`: `kind`/`httpStatus`/`retryable`/`code`/`message` sanitizada) para erros HTTP/provider — **erros de parsing do domínio** (`MalformedResponseError`) seguem classificados pelo orquestrador. Preservar os gates: **fallback de modelo** acionado por `retryable === true` (`MalformedResponseError`/`ProviderRateLimitError`/`Provider5xxError`/`NetworkError`/`AbortError`) com fallback configurado ≠ primary; **`images.edit`** só por erro de `capability` do Responses + primary; **`json_object`** só por `capability` de `response_format`/`json_schema`; **auth/configuração e safety** não acionam fallback. Testes por `kind` e por gate
- [x] 2.6 Definir o sink padrão (`resolveAiCost` + `AiCostTracker`) e a interface de sink injetável; o sink **preserva** `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` (snapshot contábil do run) e o metadata call-level (usage bruto + componentes da fórmula), usa `envelope.usageMeta.imageGenerationTool` (nunca o protocolo) e expõe `onCostResolved(cost)` para acumulação **sem segunda chamada a `resolveAiCost`**; testes de buffering/ordenação e de persistência best-effort (sink no-op **apenas em teste** — proibido instanciar `NoopAiTelemetrySink` em código produtivo)

## 3. Plan 46-03 — Migração das capacidades de TEXTO (onda 3)

- [x] 3.1 Migrar `campaign_copy`: `CopyDirectorService` é o **dono único** de `invoke("campaign_copy")` e recebe um `AiInvoker`/gateway como **seam de teste**; `generateCopy` recebe `target` e `telemetry` **nas options** (aditivos). O alvo de fallback é acionado pelo **orquestrador chamando o serviço de novo com `target: "fallback"`** (a rota **não** chama `invoke` direto; sem `if provider === "gemini"`). `OpenAITextProvider`/`GeminiTextProvider` deixam de instanciar SDK e de ler env de modelo; **proibido** instanciar `NoopAiTelemetrySink` internamente — fachadas exigem `AiTelemetryContext` injetado (removê-las se ficarem sem consumidores). **Remover `createTextProvider` de todos os callers produtivos** (rota `generate-image` inclusive). A persistência de `campaign_copy` passa ao sink; a acumulação usa `onCostResolved` (mesmo `CostResolution`), **sem segunda chamada a `resolveAiCost`** — soma **híbrida** (sink + recordCall residual) preservada durante 46-03/04 e integralmente no sink após 46-05. Delivery marker (`campaign_pipeline`) preservado
- [x] 3.2 Migrar `campaign_correction_analysis` (`correction-intent-service.ts`) para o gateway; **remover `createTextProvider`** do serviço; a rota `problem-report` fornece `AiTelemetryContext`/sink; classificação de erro de domínio (`json_parse_failed`/`schema_validation_failed`/`empty_response`) preservada
- [x] 3.3 Migrar `brand_profile_text` (`text-only-inference-service.ts`) para o gateway; a rota `brand-profile/infer` fornece `AiTelemetryContext`/sink; sem leitura de env de modelo
- [x] 3.4 Migrar `campaign_spec` legado (`campaign-intelligence/providers/openai.ts` + `service.ts` + `app/api/campaign/generate/route.ts`): a rota cria o `AiTelemetryContext` via `AiCostTracker.startRun("campaign_delivery")` (não existe `OperationRunType.campaign_spec`), `attemptNumber` 1 no primary e 2 no fallback `json_object`, e o encaminha por `service.ts` até `invoke("campaign_spec", …)`. **Testes reais** (sem `--passWithNoTests`): novo teste de `campaign_spec` (Structured Outputs + fallback `json_object` por erro de `capability`) e teste dedicado de `POST /api/campaign/generate`
- [x] 3.5 Rodar gates e co-migrar testes de texto: o `route.test.ts` da `generate-image` testa primary→fallback (a rota chama o serviço 2× com targets distintos); o teste do `CopyDirectorService` assere **dois envelopes** com gateway/adapter/sink falsos. Sem mudança de comportamento

## 4. Plan 46-04 — Migração das capacidades de VISÃO (onda 4)

- [x] 4.1 Migrar `campaign_input_validation` (`input-validation-service.ts`) e `campaign_image_review` (`image-review-service.ts`) para o gateway, com **modelo real** na telemetria
- [x] 4.2 Migrar `brand_profile_vision` (`brand-profiler.ts`, `brand-director.ts`) para o gateway
- [x] 4.3 Migrar `visual_signature_validation` (`ai-image-generator.ts` validator) para o gateway
- [x] 4.4 Corrigir o furo 1: `emitMetricsEvent` deixa de hardcodar o modelo de imagem; validação/revisão reportam o modelo de visão real
- [x] 4.5 Rodar gates e co-migrar testes de visão (sem mudança de comportamento; custo pelo pricing do modelo real)

## 5. Plan 46-05 — Migração das capacidades de IMAGEM (onda 5)

- [x] 5.1 Migrar `campaign_image` (`image-generation/providers/openai.ts`, adapter `responses` com tool `image_generation`) preservando tamanho/qualidade
- [x] 5.2 Migrar `campaign_image_edit` como **segunda `invoke` explícita** do orquestrador (adapter `images`, `images.edit`), preservando o gating e a ordem determinística das referências; corrigir o furo 3 (usage ausente → `not_available` + duração + estimativa por unidade); garantir **dois envelopes** (falha + fallback)
- [x] 5.3 Migrar `visual_signature_image` (`ai-image-generator.ts`) e corrigir o furo 4 (`imageGenerationTool: true` + `generationType`); estender `cost-estimator.ts` para somar o componente da tool a **`campaign_image` e `visual_signature_image`** (hoje só `campaign_image` — `cost-estimator.ts:194`), com **testes separados por capacidade** e mantendo a nota de fórmula provisória quando não houver `provider_reported_cost_usd`
- [x] 5.4 Rodar gates e co-migrar testes de imagem/fallback (provider + rota); asserir que fallback gera dois eventos

## 6. Plan 46-06 — Telemetria em todos os callers produtivos + gate global de arquitetura (onda 6)

- [x] 6.1 `POST /api/store/[id]/logo`: passar contexto de telemetria ao gateway (corrige o furo 2)
- [x] 6.2 `POST /api/store/[id]/logo/retry-brand-director`: idem
- [x] 6.3 `src/lib/visual-signature/server-actions.ts` (`generateVariations`/`generateAutomatic`): passar contexto de telemetria ao `AiImageGenerator.generate` (furo 5)
- [x] 6.4 `visual-signature/approve` (2 call sites) e `visual-signature/restore`: passar contexto de telemetria ao `BrandProfilerWithoutLogoService.generate` (furos 6/7)
- [x] 6.5 Gate global de arquitetura sobre `src/` (fora de `src/lib/ai/adapters/**`: init direto de SDK, `chat.completions.create`, `responses.create`, `images.edit`, `generateContent`; env-var de modelo adicionada no 46-07) + teste de inventário dos callers produtivos (nenhum caminho fora da camada única)
- [x] 6.6 Testes dos caminhos: evento call-level com custo, modelo real e duração; regressão de comportamento

## 7. Plan 46-07 — Remoção das env-vars de modelo (onda 7)

- [x] 7.1 Confirmar por grep que nenhum serviço lê env-var de modelo/provider; remover leituras residuais
- [x] 7.2 Atualizar `.env.example`: manter apenas chaves (`OPENAI_API_KEY`, `GEMINI_API_KEY`) + operacionais; remover as 14 envs de modelo/provider
- [x] 7.3 Co-migrar testes que referenciam `IMAGE_GENERATION_RESPONSES_MODEL` (`generate-image/route.test.ts`, `campaign-generate.test.ts`, `concurrency.test.ts`, `regression-master-switch.test.ts`) e `TEXT_FALLBACK_PROVIDER` (`generate-image/route.test.ts`)
- [x] 7.4 Confirmar que o **alvo de fallback inicial está registrado no registry** antes de remover `TEXT_FALLBACK_PROVIDER`, e que o orquestrador o aciona como segunda `invoke(..., target: "fallback")` sem conhecer o provider
- [x] 7.5 Registrar a ordem de deploy: código que lê só chaves primeiro; remoção das envs na Vercel somente depois (design D5)

## 8. Plan 46-08 — Regressão e não-mudança do contrato externo (onda 8)

- [x] 8.1 Rodar regressão completa (vitest total) e corrigir resíduos de fixtures/asserções
- [x] 8.2 Rodar typecheck, lint e build; verificar UI/form/schema público/snapshot/domínio/prompts intactos (suites de não-mudança)
- [x] 8.3 Verificar equivalência de defaults (registry × comportamento pré-F46) e ausência de drift nos prompts

## 9. Plan 46-09 — Verificação final (onda 9)

- [x] 9.1 Gerar `46-VERIFICATION.md` (goal-backward sobre specs/critérios) e `46-UAT.md` (roteiro humano: campanha, VS, brand profile, copy, logo — comportamento idêntico ao atual)
- [x] 9.2 Confirmar 4 gates verdes e os critérios da proposta (registry com `protocol` no primary e no fallback, interface `AiModelResolver`, gateway/adapters por protocolo com alvo explícito `primary`/`fallback`, envelope por tentativa real, contrato de erro preservando os gates de fallback, **todos os callers produtivos com telemetria** — logo, retry-brand-director, server-actions, approve, restore —, migration `campaign_spec` aditiva com rollback de código preservando o CHECK, estimativa correta em `campaign_image`+`visual_signature_image`, envs removidas, comportamento preservado)
- [x] 9.3 Atualizar registros (AGENTS.md/STATE/ROADMAP) e preparar arquivamento do change após aprovação

> **Nota:** a seleção administrativa de modelos (catálogo + persistência + tela) é o **Change B** (`fase-47-catalogo-e-selecao-de-modelos-admin`) e depende desta fundação.
