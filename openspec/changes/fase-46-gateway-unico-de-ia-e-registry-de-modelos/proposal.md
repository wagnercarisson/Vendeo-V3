## Why

As chamadas de IA estão pulverizadas no código: ~13 call sites em ~10 serviços, cada um instanciando seu próprio client (`new OpenAI()`), escolhendo o modelo por uma env-var própria (`OPENAI_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_GENERATION_RESPONSES_MODEL`, `IMAGE_VALIDATION_MODEL`, `OPENAI_BRAND_DIRECTOR_MODEL`, `OPENAI_TEXT_ONLY_INFERENCE_MODEL`, `OPENAI_TEXT_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `GEMINI_TEXT_MODEL`, `GEMINI_MODEL`, …) e emitindo telemetria (ou não) por conta própria. Esse arranjo produz três problemas:

1. **Configuração frágil e cara de operar** — trocar um modelo exige editar env-var e redeploy; a decisão de modelo está espalhada por 13+ variáveis.
2. **Telemetria inconsistente** — o inventário encontrou furos reais: `emitMetricsEvent` grava o modelo de imagem (gpt-5.5) para as fases de validação/revisão de visão (gpt-4o); o fallback `images.edit` retorna sem tokens; a geração de assinatura visual não soma o componente da tool de imagem; e há **callers produtivos sem contexto de telemetria** — `POST /logo` e `retry-brand-director` (`BrandDirectorService.analyze()` sem `onCall`), `visual-signature/server-actions.ts` (`generateVariations`/`generateAutomatic` via `AiImageGenerator.generate`) e as rotas `visual-signature/approve` e `visual-signature/restore` (via `BrandProfilerWithoutLogoService.generate`).
3. **Ausência de um ponto único de controle** — não existe allowlist de modelos validados nem um lugar onde a chamada de IA "acontece" de forma auditável.

Esta fase reorganiza e concentra as chamadas **preservando integralmente o comportamento atual**. O controle de seleção pelo admin (catálogo + persistência + tela) é o Change B; aqui entregamos a fundação: registry em código com os defaults atuais, gateway único com adapters por protocolo, telemetria obrigatória e remoção das env-vars de modelo.

## What Changes

- **Novo registry de modelos em código** (`src/lib/ai/model-registry.ts`): fonte única da verdade por **capacidade**, com configuração `{ capability, segment, primary: { provider, model, protocol }, fallback?: { provider, model, protocol } }`, agrupada em 3 segmentos (texto, visual, imagem), com os **defaults atuais exatos** (gpt-5.5, gpt-image-2, gpt-4o, gpt-4o-mini, gemini-3.1-flash-lite, …) e o **protocolo** de wire (`chat-completions` | `responses` | `images` | `gemini`) declarado **tanto no primary quanto no fallback** (cada alvo é independente; o **default inicial** de `campaign_copy` tem `primary` `chat-completions` e `fallback` `gemini` — configuração, não regra). A compatibilidade é validada por **capacidade + provider + modelo + protocolo** em cada alvo (não apenas por segmento). Nenhuma mudança de modelo nesta fase: o default do registry é o valor efetivo hoje.
- **Interface `AiModelResolver`** (`src/lib/ai/model-resolver.ts`): seam de resolução de modelo. O registry em código é a implementação inicial; o Change B poderá decorar/substituir o resolver (seleção persistida) **sem refazer o gateway**.
- **Novo AI Gateway** (`src/lib/ai/gateway.ts`): camada única de execução + telemetria, apoiada por **adapters por protocolo** (`chat-completions`, `responses`, `images`, `gemini`). Os serviços deixam de instanciar providers e de emitir `onCall` individualmente; continuam responsáveis por prompts, regras de negócio, retry e timeout. O gateway executa **uma tentativa** e **não decide o alvo nem o fallback automaticamente**: o **alvo de fallback configurado** (default inicial Gemini) e os **fallbacks técnicos** `images.edit`/`json_object` são **segunda chamada explícita** feita pelo serviço orquestrador, que conhece apenas `primary`/`fallback` — nunca o provider que ocupa cada posição.
- **Telemetria obrigatória e correta**: **cada tentativa HTTP real** normaliza `usage` e emite **exatamente um envelope de telemetria** (`AiCallInfo` estendido com `capability`, `protocol`, `status` e `errorType`), registrando `success`, `failed` ou `timeout`. A persistência permanece **best-effort** (não bloqueia a geração — o `AiCostTracker` é fail-open por design); o contexto de telemetria é **obrigatório em produção** e o sink nulo é permitido apenas em testes com adapter falso. Correção dos furos identificados: modelo real em validation/review; contexto de telemetria garantido em **todos os callers produtivos** (`POST /logo`, `retry-brand-director`, `visual-signature/server-actions.ts`, `visual-signature/approve`, `visual-signature/restore`); fallback `images.edit` registrado (com `not_available`/custo por unidade e duração); componente da tool somado para `campaign_image` **e** `visual_signature_image`.
- **Migração incremental** das 11 capacidades, uma por vez, atrás de testes de invariante, **preservando comportamento** (defaults idênticos; retry/backoff/global-timeout onde já estão; `AbortSignal` propagado; JSON mode/structured outputs preservados).
- **Remoção das env-vars de modelo/provider**: runtime e `.env.example` passam a ter apenas as **chaves de API** (`OPENAI_API_KEY`, `GEMINI_API_KEY`) e variáveis **operacionais** (timeout, qualidade, debug, fallback de custo). `OPENAI_MODEL`, `OPENAI_TEXT_MODEL`, `OPENAI_BRAND_DIRECTOR_MODEL`, `OPENAI_TEXT_ONLY_INFERENCE_MODEL`, `IMAGE_GENERATION_RESPONSES_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_VALIDATION_MODEL`, `IMAGE_PROVIDER`, `TEXT_PROVIDER`, `TEXT_FALLBACK_PROVIDER`, `GEMINI_TEXT_MODEL`, `GEMINI_MODEL` são removidas do runtime — as chaves de API são a única configuração de IA em env-var.
- **Módulo legado `campaign-intelligence`** entra como capacidade `campaign_spec` (default `gpt-4o-mini`), roteada pelo gateway. **Não é removido nesta fase** — a ausência de chamador na UI não prova ausência de consumidores externos; a exclusão será avaliada posteriormente com evidência. Para registrar corretamente essa chamada (sem rotulá-la como `campaign_copy`), inclui uma **migration mínima** que estende o CHECK `chk_generation_events_type` e o tipo TS `GenerationEventType` com o literal `campaign_spec`.

## Capabilities

### New Capabilities

- `ai-model-registry`: registro central de modelos por capacidade/segmento, com defaults testados e validados, allowlist de modelos, resolução de chave de API por provider e eliminação das env-vars de modelo como mecanismo de configuração.
- `ai-invocation-gateway`: camada única de execução de chamadas de IA com adapters por protocolo (Chat Completions, Responses, Images, Gemini), contrato único de request/result/usage e telemetria obrigatória por chamada.

### Modified Capabilities

- `ai-cost-accounting`: a telemetria passa a ser **obrigatória e emitida pela camada única** (não mais por serviço), com o **modelo real** da chamada, e corrige os furos (modelo errado em validation/review; contexto ausente em `POST /logo`/`retry-brand-director`/`server-actions`/`approve`/`restore`; fallback sem tokens; componente da tool em `campaign_image` e `visual_signature_image`).
- `ai-image-generation`: o provider de imagem passa a ser executado via gateway (adapters `responses`/`images`), preservando o comportamento atual de geração, fallback `images.edit`, tamanho/qualidade e uso de identidade.
- `text-provider`: a execução de texto (OpenAI/Gemini) passa a ser feita via gateway, preservando o contrato `TextProviderResult` e o **alvo de fallback configurado** (default inicial Gemini, substituível pelo admin no Change B).
- `ai-campaign-intelligence`: a capacidade `campaign_spec` (legado) passa a ser resolvida pelo registry e executada via gateway, mantendo `gpt-4o-mini` como default.

## Impact

- **Código novo**: `src/lib/ai/model-registry.ts`, `src/lib/ai/model-resolver.ts` (interface `AiModelResolver`), `src/lib/ai/gateway.ts`, `src/lib/ai/adapters/{chat-completions,responses,images,gemini}.ts`, `src/lib/ai/api-keys.ts` (definido em `design.md`). A interface `ImageProvider` (`image-generation/providers/types.ts`) é **mantida** como contrato de domínio/seam de testes, com implementação delegando ao gateway.
- **Serviços migrados (sem mudança de fluxo)**:
  - `src/lib/image-generation/providers/openai.ts` (responses + images.edit)
  - `src/lib/image-generation/services/input-validation-service.ts` e `image-review-service.ts`
  - `src/lib/copy/copy-director-service.ts` + `src/lib/text-provider/openai.ts`/`gemini.ts`
  - `src/lib/campaign/correction-intent-service.ts`
  - `src/lib/visual-signature/ai-image-generator.ts` (imagem + validação) e `identity-art-director.ts`
  - `src/lib/visual-signature/brand-profiler.ts`
  - `src/lib/brand-assets/brand-director.ts` e `text-only-inference-service.ts`
  - `src/lib/campaign-intelligence/providers/openai.ts`
- **Callers produtivos que passam a emitir telemetria** (hoje sem contexto de telemetria):
  - `src/app/api/store/[id]/logo/route.ts` e `src/app/api/store/[id]/logo/retry-brand-director/route.ts` (via `BrandDirectorService.analyze`).
  - `src/lib/visual-signature/server-actions.ts` — `generateVariations` e `generateAutomatic` (via `AiImageGenerator.generate`).
  - `src/app/api/store/[id]/visual-signature/approve/route.ts` (2 call sites) e `src/app/api/store/[id]/visual-signature/restore/route.ts` (via `BrandProfilerWithoutLogoService.generate`).
  - Todos passam contexto de telemetria ao gateway; nenhum caminho produtivo emite IA fora da camada única.
- **Configuração**: `.env.example` e runtime — remoção das env-vars de modelo/provider; permanecem apenas chaves de API + operacionais. **Deploy**: as envs só podem ser removidas da Vercel **depois** do deploy que passa a ler apenas as chaves.
- **Testes**: co-migração de suites que referenciam `IMAGE_GENERATION_RESPONSES_MODEL` (`generate-image/route.test.ts`, `campaign-generate.test.ts`, `concurrency.test.ts`, `regression-master-switch.test.ts`) e `TEXT_FALLBACK_PROVIDER` (`generate-image/route.test.ts`); novo seam de mock no gateway.
- **Banco**: **sem novas tabelas** nesta fase (catálogo/seleção persistidos são o Change B); inclui apenas a **extensão do CHECK `chk_generation_events_type`** (e do tipo TS `GenerationEventType`) para o literal `campaign_spec`. **Sem mudança de UI/formulário/schema público/snapshot/domínio.**
- **Referência de design**: a UI do Change B seguirá `openspec/design-system/MASTER.md` (dark OLED, lucide-react, sem emojis); o Change A não tem superfície visual.
