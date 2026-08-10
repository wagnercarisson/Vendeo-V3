## Context

A F38 entregou a **fonte única do custo em créditos** (`credit_operation_costs`), mas o custo que o Vendeo **paga à OpenAI/Gemini** continua apurado de forma fragmentada e pouco confiável. O inventário do estado atual (explorado em código) mostra **três mundos de telemetria que não conversam** (`generation_events` no banco, `MetricsWriter` JSONL local / no-op em produção, `logPipelineEvent` console.log) e **captura não uniforme**: o pipeline de campanha insere eventos inline na rota (4 inserts), a assinatura visual usa o helper `insertGenerationEvent`, e **brand profile, revisão de imagem e validação de input não geram evento nenhum** — mesmo fazendo chamadas reais de IA.

**7 furos verificados em código que corrompem a apuração hoje:**

| # | Furo | Evidência | Decisão que sana |
|---|------|-----------|------------------|
| 1 | Copy da campanha grava `estimated_cost_usd: NULL` (usage descartado) | `route.ts:593` chama `estimateAiCost` sem usage; `CopyDirectorService` descarta o usage que o `TextProviderResult` já traz | D3/D4/D7/D9 |
| 2 | `metadata.totalCost` grava o **nome do provider** em vez do custo | `route.ts:642` | D7/D11 |
| 3 | Modelos reais sem preço na tabela TS: `gemini-3.1-flash-lite` e `gpt-image-2` → `estimateAiCost` retorna `null`/fallback cego | `cost-estimator.ts` (OPENAI_PRICING/GEMINI_PRICING) | D8/D9 |
| 4 | Revisão (`ImageReviewService`) e validação (`InputValidationService`) — vision gpt-4o cara — **somem da contabilidade** | só vão ao `MetricsWriter` | D5/D7/D11 |
| 5 | Evento de assinatura visual sem `estimated_cost_usd` nem tokens, apesar de o provider retornar usage | `generation-events.ts` | D7/D11 |
| 6 | `attempt_number` sempre 1, mesmo com até 3 tentativas no loop real de revisão/recomposição | `image-generation-service.ts` | D5/D11 |
| 7 | `duration_ms` representa o pipeline inteiro, não a chamada individual | `route.ts:555` | D6/D11 |

**Problema estratégico:** sem custo real confiável por chamada, não há como calibrar preço de crédito (F39), identificar gargalos por etapa/modelo/provider, nem responder "quanto custou essa entrega". A F38.1 cria a **trilha granular de IA** e as **views de apuração** que transformam telemetria em inteligência econômica.

**Unidade econômica:** a **entrega** (campanha aprovada / assinatura visual gerada), composta por várias chamadas de IA:

```text
campaign_delivery
  ├── input/content validation        (vision — gpt-4o)
  ├── copy director                   (text — openai/gemini)
  ├── image composition               (image — Responses API / gpt-image-2)
  ├── image review                    (vision — gpt-4o)
  ├── recomposition / revision        (image + review, attempt 2..n)
  └── final approval                  (F37 — decisão, não custa IA)

visual_signature_generation
  ├── art direction                   (prompt assembly — NÃO é IA)
  ├── image generation                (image — Responses API)
  └── semantic validation             (vision — Responses API)

brand_profile_generation
  ├── brand profiler / director       (vision — gpt-4o)
  └── text-only inference             (text — gpt-4o)
```

**Relação com a F38 (eixo de créditos):** F38 define "quanto o usuário paga/debita" (`credit_operation_costs`, créditos); a 38.1 responde "quanto essa entrega custou para o Vendeo" (`generation_events`, USD estimado). As duas camadas **não se misturam** e se encontram apenas nas views de reconciliação (D10). F39 (Stripe) consumirá o custo real apurado aqui.

**Dependências:** F24 (ledger `credit_transactions` — reconciliação por leitura), F25/F28 (pipeline + telemetria existentes, `admin_get_metrics`), F29.1.1 (VS), F37 (aprovação — decisão, não custa IA), F38 (`credit_operation_costs` — eixo créditos), F39 (Stripe — consumirá o custo real). O alinhamento de escopo (Q&A + revisão) está documentado em `docs/alinhamento-fase-38.1-apuracao-custos-de-ia.md` — fonte da verdade das decisões D1–D12.

## Goals / Non-Goals

**Goals:**
- **Evento por chamada real de IA, agregado por entrega** — cada chamada (copy, validação, geração de imagem, revisão, recomposição, assinatura, brand profile) grava `generation_events` próprio com tokens, custo e duração da chamada; a entrega soma tudo via `operation_run_id` (D1)
- **Semântica econômica correta por domínio** — campanha: reprovações/regenerações **do mesmo request** fazem parte da **mesma entrega** (loop interno); o run é persistido na campanha (`campaigns.operation_run_id`) **preparando** a F37 reabrir cross-request (D1/D2); assinatura visual: **cada geração é uma entrega debitável separada** (nova tentativa pós-falha técnica = novo `operation_run_id`)
- **Custo real primeiro, USD depois** — tokens/usage gravados sempre que existirem; custo em colunas separadas (`provider_reported_cost_usd` + `estimated_cost_usd`) com `cost_source` auditável (5 valores) e valor contábil `accounting_cost_usd = COALESCE(provider_reported_cost_usd, estimated_cost_usd)` derivado nas views (D3/D4)
- **Tabela de preço como dado** — `ai_model_pricing` versionada (`effective_from`/`effective_until`, preços nullable + CHECK `at_least_one_price`), seeds verificáveis (source_url/effective_from, incl. `gemini-3.1-flash-lite` e `gpt-image-2`), RPC `admin_set_ai_model_price` + `GET`/`PUT /api/admin/ai-model-pricing` — **sem página** (D8)
- **Camada única de registro `AiCostTracker`** (best-effort, nunca lança) substituindo os 4 inserts inline da rota de campanha, os inserts de VS e o helper `insertGenerationEvent` (que delega ao tracker) (D7)
- **Estimador refatorado** — `resolveAiCost` resolve por fonte `provider_reported → pricing_table → fallback_static → not_available`; corrige gemini-3.1-flash-lite, gpt-image-2, cached/image tokens; mapeia as `source` antigas (D9)
- **Views/RPCs de apuração e reconciliação (sem UI)** — `admin_ai_operation_costs`, `admin_campaign_delivery_costs`, `admin_ai_cost_by_provider_model`, `admin_ai_cost_by_stage`, `admin_ai_cost_by_store`, `admin_cost_vs_credits` (USD × créditos) + RPC `admin_get_ai_costs`; somam **apenas call-level** (anti-dupla-contagem, D1/D6/D10)
- **Furos 1–7 corrigidos**; `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros
- **50 testes novos** (10 resolveAiCost + 8 tracker + 10 pipeline + 6 VS + 4 brand profile + 6 pricing/API + 6 views/RPC) + verificação SQL/integrada I1–I6 + regressão completa
- **Trackings atualizados** (`.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`) registrando a F38.1 como desdobramento da F38 — ver runbook na D1

**Non-Goals:**
- Página admin de preços (`/admin/ai-model-pricing`) — fase curta futura (D8)
- Tabela `operation_runs` — coluna `operation_run_id` + views bastam (D1)
- Tela/dashboard de reconciliação — só views/RPCs (D10)
- Cobrança dinâmica / ajuste de preço de crédito / margem mínima — F39 (Stripe); a 38.1 só mede e reconcilia
- Tema (`theme_id`) — coluna preparada; instrumentação quando temas existirem
- Deprecação formal de `/api/campaign/generate` (legado) — fora de escopo (só testes o usam)
- Remoção do `MetricsWriter` — mantido para debug local; deixa de ser fonte de custo
- Alteração de `reserve_credit`/`credit_transactions` (F24) — ledger financeiro intacto; reconciliação é por leitura
- Evoluir `admin_get_metrics` (F28) — mantido compatível; novas métricas em views próprias
- i18n — produto PT-BR

## Decisions

### D1 — Semântica das camadas: entrega / rastreio técnico / chamada

`DECIDIDO`

```
operation_run_id  = tentativa econômica/entrega agrupada  (UUID por request)
trace_id          = rastreio técnico do fluxo             (já existe no pipeline)
generation_event  = cada chamada real de IA               (1 linha por chamada)
```

- **`operation_run_id`** agrupa todas as chamadas de uma mesma entrega econômica. Regras por domínio:
  - **Campanha** (`campaign_delivery`): nesta fase o run nasce no início do request e cobre o **request/loop interno** (validação → copy → imagem → revisão → recomposição) — reprovação/regeneração dentro do mesmo request **não** abre novo run. O `operation_run_id` é **persistido na campanha** (`campaigns.operation_run_id`, coluna nova na migration — D2) no momento da criação, **preparando** a F37 para reabrir o mesmo run ao recompor a campanha em um request posterior; a mecânica de reabertura cross-request em si é escopo da F37. Nesta fase, requests independentes ainda criam novo run.
  - **Assinatura visual** (`visual_signature`): cada request de geração é **um run** (uma geração debitável). Falha técnica/erro grotesco de sistema → estorno e a **nova tentativa é outro run** (novo debit). Não usar a semântica "até aprovação" da campanha.
  - **Brand profile** (`brand_profile`): cada request de geração/realinhamento é um run.
  - **Tema** (`theme`): tipo preparado no schema (`theme_id`), instrumentação futura.
- **`trace_id`**: pipeline já o usa; VS e brand profile **passam a gerar** um `trace_id` por request e propagá-lo às chamadas filhas. `operation_run_id` e `trace_id` podem ser o mesmo UUID no caso simples, mas **são colunas separadas** com semânticas distintas.
- **`generation_event`**: cada chamada de IA real vira uma linha com `generation_type`, `provider`, `model`, `attempt_number`, `duration_ms` (da chamada), tokens e custo.

**Regra operacional:** um `operation_run_id` tem **um** evento agregado da entrega (delivery marker, ex.: `campaign_pipeline`/`visual_signature`/`brand_profile_*`) e **N chamadas** (call-level).

**Regra anti-dupla-contagem (custo/duração):** o delivery marker **não grava custo nem tokens** (`estimated_cost_usd = NULL`, `provider_reported_cost_usd = NULL`, tokens NULL). Ele existe para compatibilidade com `admin_get_metrics` (F28), preservando apenas `status`, `duration_ms` (pipeline, com `metadata.duration_is_pipeline: true`) e metadados operacionais. **Custo e duração econômicos são apurados exclusivamente somando eventos call-level** por `operation_run_id` nas views (D10). Views de custo filtram `generation_type` por `*_call`/call-level ou excluem os tipos delivery.

### D2 — Schema: novas colunas em `generation_events`

`DECIDIDO`

```sql
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS operation_run_id       UUID;            -- D1 — agrupador econômico
  ADD COLUMN IF NOT EXISTS operation_run_type     TEXT;            -- D1 — campaign_delivery|visual_signature|brand_profile|theme
  ADD COLUMN IF NOT EXISTS visual_signature_id    UUID REFERENCES public.store_visual_signatures(id);
  ADD COLUMN IF NOT EXISTS theme_id               UUID;            -- futuro (temas) — apenas preparado
  ADD COLUMN IF NOT EXISTS cached_input_tokens    INTEGER;
  ADD COLUMN IF NOT EXISTS image_tokens           INTEGER;
  ADD COLUMN IF NOT EXISTS provider_reported_cost_usd REAL;        -- D3 — dado externo quando existir
  ADD COLUMN IF NOT EXISTS cost_source            TEXT;            -- D3/D4 — enum 5 valores
  ADD COLUMN IF NOT EXISTS pricing_version        TEXT;            -- D4/D8 — versão de preço usada

ALTER TABLE public.generation_events
  ADD CONSTRAINT chk_generation_events_cost_source
  CHECK (cost_source IN ('provider_reported','pricing_table','fallback_static','manual_unknown','not_available'));

ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_generation_events_type;
ALTER TABLE public.generation_events
  ADD CONSTRAINT chk_generation_events_type CHECK (generation_type IN (
    'campaign_pipeline','campaign_copy','campaign_input_validation',
    'campaign_image','campaign_image_review',
    'visual_signature','visual_signature_image','visual_signature_validation',
    'brand_profile_without_logo','brand_profile_with_logo',
    'brand_profile_vision','brand_profile_text'
  ));

-- D1/D2 — preparo do reuso cross-request (F37): run persistido na campanha
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS operation_run_id UUID;    -- run econômico da entrega (reuso F37)
```

- **`campaigns.operation_run_id`** é preenchido na criação da campanha (rota `generate-image`, D11) com o `operation_run_id` do run — **preparando** a F37 (reabertura cross-request). Índice próprio: `CREATE INDEX IF NOT EXISTS idx_campaigns_operation_run_id ON public.campaigns(operation_run_id)`. A coluna nasce **preenchida** nesta fase (não opcional no fluxo de geração); não é FK para `generation_events` (o run vive nos eventos; a campanha só guarda a referência para reuso).

- **`operation_run_type`: sem CHECK enum no banco** (padrão do repositório: enums versionados no TS)
- **`cost_source`: CHECK explícito** (D4) — conjunto fechado de classificação de custo
- **Índices novos:** `(operation_run_id)`, `(visual_signature_id)`, `(operation_run_type)`, `(cost_source)`, `(provider, model)`
- **Retenção:** `cleanup_generation_events_90d()` (F28) cobre as novas colunas automaticamente (DELETE por `created_at`). Sem mudança
- **RLS:** mantém **default-deny** (sem policy para `authenticated`, apenas service_role) — como hoje. Admin lê via RPC `SECURITY DEFINER` (D10)
- **`pricing_version`:** UUID da linha `ai_model_pricing` usada, `'code_default'` quando veio do fallback em código, `NULL` quando não se aplica (ex.: `provider_reported` sem uso de tabela)

### D3 — Custo: colunas separadas + regra mental

`DECIDIDO`

```text
provider_reported_cost_usd = dado externo direto, quando o provider reportar custo
estimated_cost_usd         = cálculo interno do Vendeo (sempre preenchido quando viável)
accounting_cost_usd        = COALESCE(provider_reported_cost_usd, estimated_cost_usd)
                            → valor contábil usado nas views/RPCs de apuração
cost_source                = como estimamos ou classificamos o custo usado
```

- **`provider_reported_cost_usd`**: preenchido **somente** quando o provider entrega custo financeiro explícito. Não é sobrescrito por cálculo nosso.
- **`estimated_cost_usd`**: o custo que o Vendeo usa para apuração — calculado pelo estimador (D4/D8). Nunca sobrescreve `provider_reported_cost_usd`.
- **`accounting_cost_usd`**: derivado nas views/RPCs (D10) como `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` — **não é coluna** no banco. Regra: evento com `provider_reported_cost_usd` presente **não some** da apuração quando `estimated_cost_usd` estiver NULL.
- **Regra de registro:** tokens/usage são gravados **sempre** que existirem, mesmo que o custo em USD fique `NULL` (ex.: `not_available`). Custo real primeiro, USD depois — a trilha permanece auditável.

### D4 — `cost_source`: enum de 5 valores + mapeamento das sources atuais

`DECIDIDO`

| `cost_source` | Significado | Mapeamento das sources atuais (`estimateAiCost`) |
|---|---|---|
| `provider_reported` | Provider entregou custo financeiro direto | (novo) — `provider_reported_cost_usd` |
| `pricing_table` | Custo calculado com a tabela `ai_model_pricing` | `openai_published_pricing`, `gemini_published_pricing` |
| `fallback_static` | Provider sem usage e/ou modelo sem preço → valor estático configurado | `configured_fallback`, `configured_fallback_unknown_model_with_usage` |
| `manual_unknown` | Custo inserido/ajustado manualmente sem origem automática | (novo) — preço manual de modelo desconhecido |
| `not_available` | Sem usage E sem preço/config → custo desconhecido (tokens ainda registrados) | `null` retornado hoje → agora grava evento com tokens + custo NULL |

- **Mudança de comportamento importante:** hoje `estimateAiCost` pode retornar `null`. Na 38.1, o `AiCostTracker` **sempre grava o evento**; o `estimated_cost_usd` é `NULL` apenas quando `cost_source = 'not_available'`. O evento existe mesmo sem custo.
- O `metadata.costSource` atual (imagem) é **promovido a coluna** `cost_source`; o campo no metadata deixa de ser fonte.

### D5 — `generation_type` granular + inventário de chamadas cobertas

`DECIDIDO`

Inventário de chamadas reais de IA e o `generation_type` de cada uma:

| Domínio | Chamada | Arquivo(s) | `generation_type` | Camada |
|---|---|---|---|---|
| Campanha | Validação de input (vision) | `input-validation-service.ts` | `campaign_input_validation` | call |
| Campanha | Copy director (text) | `text-provider/openai.ts` + `gemini.ts` → `copy-director-service.ts` | `campaign_copy` | call |
| Campanha | Composição de imagem (image) | `image-generation/providers/openai.ts` | `campaign_image` | call |
| Campanha | Revisão de arte (vision) | `image-review-service.ts` | `campaign_image_review` | call |
| Campanha | Agregado da entrega | `generate-image/route.ts` | `campaign_pipeline` | delivery |
| VS | Geração de imagem (image) | `ai-image-generator.ts` | `visual_signature_image` | call |
| VS | Validação semântica (vision) | `ai-image-generator.ts` (validator) | `visual_signature_validation` | call |
| VS | Agregado da entrega | `generate-without-logo/route.ts` | `visual_signature` | delivery |
| Brand profile | Visão profiler/director | `brand-profiler.ts`, `brand-director.ts` | `brand_profile_vision` | call |
| Brand profile | Inferência texto-only | `text-only-inference-service.ts` | `brand_profile_text` | call |
| Brand profile | Agregado da entrega | rotas `/brand-profile/*` | `brand_profile_without_logo` / `brand_profile_with_logo` | delivery |
| Tema (futuro) | — | — | `theme_generation` (futuro) | — |

- Tipos **existentes mantidos** (backward compat com `admin_get_metrics` e dados históricos): `campaign_pipeline`, `campaign_copy`, `campaign_image`, `visual_signature`, `brand_profile_without_logo`, `brand_profile_with_logo`.
- Tipos **novos**: `campaign_input_validation`, `campaign_image_review`, `visual_signature_image`, `visual_signature_validation`, `brand_profile_vision`, `brand_profile_text`.
- `campaign_image_review` e `campaign_input_validation` cobrem as chamadas vision que **hoje somem** da contabilidade.
- `brand_profile_*` call-level + delivery: hoje **nenhum** evento de brand profile existe — a fase os introduz de verdade.

### D6 — Duração por chamada e por entrega

`DECIDIDO`

- **`generation_events.duration_ms` = duração da chamada individual** (novo padrão). O evento call-level mede o tempo entre início e fim daquela chamada de IA.
- **Duração da entrega** = `SUM(duration_ms)` por `operation_run_id` via views (D10). Sem tabela `operation_runs` (D1).
- **Correção do furo 7:** hoje os eventos de campanha usam `durationMs` do pipeline inteiro (`route.ts:555`) para copy e imagem — passa a ser medido **por chamada** no ponto de execução de cada uma.
- O delivery marker (`campaign_pipeline`/`visual_signature`) **não grava custo nem tokens** (anti-dupla-contagem, D1): mantém apenas `duration_ms` da entrega (pipeline) com `metadata` indicando `duration_is_pipeline: true` — para não quebrar `admin_get_metrics` que usa `AVG(duration_ms)` dos eventos `campaign_pipeline`. O call-level é sempre por chamada, com custo e tokens. Views de custo **somam apenas call-level**.

### D7 — `AiCostTracker`: camada única de registro (best-effort)

`DECIDIDO`

Novo módulo `src/lib/ai-cost/tracker.ts` (server-only), **único** caminho de escrita de custo:

```typescript
interface CostEvent {
  operationRunId: string;
  operationRunType: "campaign_delivery" | "visual_signature" | "brand_profile" | "theme";
  traceId: string;
  storeId: string;
  userId?: string | null;
  campaignId?: string | null;
  visualSignatureId?: string | null;
  themeId?: string | null;
  generationType: GenerationEventType;      // D5
  provider: string;
  model: string;
  attemptNumber: number;
  durationMs: number;
  status: GenerationEventStatus;
  errorType?: string | null;
  tokens?: { promptTokens?: number; completionTokens?: number;
             totalTokens?: number; cachedInputTokens?: number; imageTokens?: number };
  cost?: { providerReportedCostUsd?: number | null;
           estimatedCostUsd?: number | null;
           costSource: CostSource;           // D4
           pricingVersion?: string | null };
  metadata?: Record<string, unknown>;
}

class AiCostTracker {
  constructor(client?: SupabaseClient);       // default supabaseAdmin
  async record(event: CostEvent): Promise<void>;   // best-effort — nunca lança
  startRun(type: CostEvent["operationRunType"]): { operationRunId: string; traceId: string };
}
```

- **Substitui** os 4 inserts inline do `generate-image/route.ts`, os inserts do `generate-without-logo/route.ts` e o helper `insertGenerationEvent` (que passa a delegar ao tracker — mantendo compatibilidade do teste/uso existente).
- **Furos corrigidos:** copy com custo real (D3/D4 + usage exposto, D9); `metadata.totalCost` correto (soma real, não nome do provider); `attempt_number` granular vindo do loop de revisão.
- **Padrão de exposição de usage:** os serviços expõem `usage`/custo via **callback opcional** (evita quebrar contratos públicos):
  ```typescript
  onCall?: (info: { provider: string; model: string; usage?: TokenUsage; durationMs: number }) => void
  ```
  Aplicado em: `CopyDirectorService.generateCopy`, `InputValidationService.validate`, `ImageReviewService.review`, `AiImageGenerator.generate`, `VisualSignatureValidator`, `BrandProfilerWithoutLogoService`, `BrandDirector`, `TextOnlyInferenceService`. No `ImageGenerationService`, o `onMetricsEvent` existente é ampliado com usage/custo por tentativa.
- **`operation_run_id`/`trace_id` são propagados** por um objeto de contexto de telemetria (`opts.telemetry`/param opcional) criado na rota via `tracker.startRun(...)`.
- **Delivery marker sem custo:** o `record` do delivery (ex.: `campaign_pipeline`/`visual_signature`) recebe `cost: null`/sem `estimatedCostUsd` e sem tokens — a duração fica no `durationMs` com `metadata.duration_is_pipeline: true` (anti-dupla-contagem, D1/D6).
- **Geração nunca é bloqueada por telemetria** — qualquer falha de escrita é logada e ignorada (padrão atual best-effort).

### D8 — `ai_model_pricing`: tabela + seeds + RPC/API admin (sem página)

`DECIDIDO`

**Tabela versionada:**

```sql
CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              TEXT NOT NULL,
  model                 TEXT NOT NULL,
  input_token_usd_per_1m        NUMERIC,          -- NULL p/ modelos só de imagem
  output_token_usd_per_1m       NUMERIC,          -- NULL p/ modelos só de imagem
  cached_input_token_usd_per_1m NUMERIC,
  image_unit_usd                NUMERIC,          -- custo por imagem (ex.: dall-e-3, gpt-image-2)
  image_token_usd_per_1m        NUMERIC,          -- image tokens (Responses API)
  effective_from         TIMESTAMPTZ NOT NULL,
  effective_until        TIMESTAMPTZ,             -- NULL = vigente
  source_url             TEXT,
  source_note            TEXT,
  updated_by             UUID REFERENCES auth.users(id),  -- NULL p/ seeds de sistema
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ai_model_pricing_at_least_one_price CHECK (
    input_token_usd_per_1m IS NOT NULL
    OR output_token_usd_per_1m IS NOT NULL
    OR cached_input_token_usd_per_1m IS NOT NULL
    OR image_unit_usd IS NOT NULL
    OR image_token_usd_per_1m IS NOT NULL
  )
);
```

- **Versionamento por `effective_from`/`effective_until`**: atualizar preço = RPC fecha a linha vigente (`effective_until = now()`) e abre nova (`effective_from = now()`). O `pricing_version` do evento referencia a linha usada (D2).
- **Seeds (bootstrap inicial)** — modelos hoje em produção, com defaults da tabela TS atual + correções de furos (3). **Tratados como valores verificáveis, não definitivos:** cada seed leva `source_url` + `source_note` + `effective_from` apontando para a fonte pública consultada no momento do seed; o teste (44) valida **estrutura** (pelo menos uma dimensão de preço presente, `source_url`/`effective_from` preenchidos, `effective_until` NULL), **não** canoniza o valor do preço para sempre:
  ```
  openai   gpt-4o                input 2.50  output 10.00
  openai   gpt-4o-mini           input 0.15  output 0.60
  openai   gpt-5.5               input 5.00  output 30.00  cached 0.50
  openai   gpt-image-2           image_unit 0.040
  openai   dall-e-3              image_unit 0.040
  gemini   gemini-2.0-flash      input 0.10  output 0.40
  gemini   gemini-3.1-flash-lite input 0.10  output 0.40  (NOVO — modelo default real do Gemini)
  ```
  > **Nota:** `gpt-image-2`/`dall-e-3` não definem `input_token_usd_per_1m`/`output_token_usd_per_1m` — a coluna é nullable e o CHECK `chk_ai_model_pricing_at_least_one_price` exige pelo menos uma dimensão válida. Valores devem ser conferidos contra a fonte pública antes de fixar o seed.
- **Defaults em código** permanecem (`DEFAULT_AI_MODEL_PRICING` no módulo do estimador) como fallback de bootstrap — usados quando a tabela não tem a linha (fail-open equivalente ao padrão F38 D5, com `source` refletindo isso).
- **RLS:** service_role apenas; `authenticated` não lê (preços internos não são dado público do cliente).
- **RPC `admin_set_ai_model_price`** (SECURITY DEFINER, `SET search_path=''`, transacional):
  ```
  admin_set_ai_model_price(
    p_actor_id UUID, p_provider TEXT, p_model TEXT,
    p_input NUMERIC, p_output NUMERIC, p_reason TEXT,
    p_cached NUMERIC DEFAULT NULL, p_image_unit NUMERIC DEFAULT NULL,
    p_image_token NUMERIC DEFAULT NULL, p_source_url TEXT DEFAULT NULL,
    p_source_note TEXT DEFAULT NULL
  ) RETURNS JSONB { id (nova linha), provider, model, effective_from, previous_id }
  ```
  - **`p_reason` vem antes dos parâmetros com `DEFAULT`** (regra de assinatura do Postgres: parâmetro sem default não pode suceder parâmetro com default).
  - `p_input`/`p_output` aceitam `NULL` (modelo só de imagem); o CHECK da tabela garante pelo menos uma dimensão.
  - Fecha a vigente + abre a nova na mesma transação; `p_reason` obrigatório (rastreabilidade).
- **API admin:** `GET /api/admin/ai-model-pricing` (lista vigentes + histórico) e `PUT /api/admin/ai-model-pricing` (chama o RPC) — sob `requireAdmin` + zod. **Sem página** nesta fase.

### D9 — Estimador refatorado (`estimateAiCost` → resolução por fonte)

`DECIDIDO`

O `estimateAiCost` deixa de ser a única fonte e passa a ser o **resolvedor** de custo:

```
resolveCost(provider, model, usage?, providerReportedCostUsd?) → {
  estimatedCostUsd, providerReportedCostUsd?, costSource, pricingVersion
}
  1. providerReportedCostUsd presente  → costSource = 'provider_reported'
  2. senão, linha ai_model_pricing (vigente) p/ provider+model
       + usage disponível              → calcula por tokens → costSource = 'pricing_table'
       + modelo image sem usage        → usa dimensão da linha (image_token_usd_per_1m
                                         e/ou image_unit_usd) → costSource = 'pricing_table'
  3. senão, modelo conhecido em código  → defaults (bootstrap) → costSource = 'pricing_table'
  4. senão, fallback_static configurado (VENDEO_AI_FALLBACK_COST_USD, default 0.15)
                                        → costSource = 'fallback_static'
  5. senão                              → costSource = 'not_available' (tokens registrados, custo NULL)
```

- **Correções incorporadas:**
  - Copy com `usage` real (furo 1) — o `CopyDirectorService` expõe usage (D7) e o resolvedor calcula por tokens.
  - `gemini-3.1-flash-lite` e `gpt-image-2` na tabela/seeds (furo 3).
  - Cached tokens (`input_tokens_details.cached_tokens`) e image tokens (`output_tokens_details.image_tokens`) contabilizados.
  - `manual_unknown` para preço inserido manualmente sem origem automática.
- **Refatoração:** preços movem da `Record` TS para a tabela (D8); o TS vira default bootstrap. Os testes existentes do estimator (`cost-estimator.test.ts`) são adaptados ao novo contrato e mantidos.

### D10 — Views/RPCs de apuração e reconciliação (sem UI)

`DECIDIDO`

**Views** (consomem `generation_events` evoluído; acesso via RPC admin, não GRANT direto):

| View | Agrupamento | Serve para |
|------|-------------|------------|
| `admin_ai_operation_costs` | por `operation_run_id` | custo total, duração total, nº de chamadas, nº de tentativas (recomposições), status da entrega |
| `admin_campaign_delivery_costs` | por `campaign_id` | custo da campanha por etapa (detalhe por `generation_type`) |
| `admin_ai_cost_by_provider_model` | por `provider`+`model` | gargalos por modelo/provedor |
| `admin_ai_cost_by_stage` | por `generation_type` | gargalos por etapa (copy vs review vs imagem) |
| `admin_ai_cost_by_store` | por `store_id` | custo por loja (apuração) |
| `admin_cost_vs_credits` | por `campaign_id`/VS | **reconciliação** — custo USD × créditos debitados × margem |

**Reconciliação (`admin_cost_vs_credits`)** — a ponte com a F38:
```sql
-- valor contábil de cada evento: accounting_cost_usd = COALESCE(provider_reported_cost_usd, estimated_cost_usd)
--   (garante que evento com só provider_reported não some da apuração — revisão)
-- apuração soma APENAS eventos call-level por operation_run (delivery markers têm custo NULL — D1/D6)
-- por campanha:  generation_events (call-level, SUM accounting_cost_usd p/ operation_run)
--                JOIN credit_transactions (type='deduction', campaign_id, metadata.feature='campaign_pipeline')
-- por VS:        generation_events.visual_signature_id
--                JOIN store_visual_signatures.metadata->>'credit_tx_id' = credit_transactions.id
-- saída:         operation_run_id, domain, custo_usd_total, creditos_debitados,
--                margem_estimada, etapas_mais_caras (top generation_type), regeneracoes
```

**RPC admin `admin_get_ai_costs(p_store_id?, p_user_id?, p_provider?, p_model?, p_generation_type?, p_hours, p_operation_run_id?)`** (SECURITY DEFINER) — apuração filtrada, mesmo padrão do `admin_get_metrics`. **Sem página/tela** nesta fase.

**`admin_get_metrics` (F28) inalterado** — continua consumindo `campaign_pipeline`/`visual_signature` para as métricas operacionais existentes; os dados novos não quebram o RPC.

### D11 — Instrumentação por serviço (mapeamento concreto)

`DECIDIDO`

| Arquivo | Mudança |
|---|---|
| `src/app/api/campaign/generate-image/route.ts` | Remove os 4 inserts inline; usa `tracker.startRun('campaign_delivery')` no início e `tracker.record(...)` por chamada (via callbacks); corrige `metadata.totalCost`; `attempt_number` por tentativa real; `duration_ms` por chamada; **persiste `operation_run_id` em `campaigns.operation_run_id` na criação da campanha** (D1/D2) |
| `src/lib/image-generation/services/image-generation-service.ts` | `onMetricsEvent`/novo callback expõe `usage` (do `generateWithRetry`) e `attempt_number` por chamada (image + review); tracker registra `campaign_image` e `campaign_image_review` com esses dados |
| `src/lib/image-generation/services/input-validation-service.ts` | callback `onCall` com usage do `chat.completions`; rota registra `campaign_input_validation` |
| `src/lib/copy/copy-director-service.ts` | callback `onCall` com usage/provider/model do `TextProviderResult`; rota registra `campaign_copy` com custo real (furo 1) |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` | `tracker.startRun('visual_signature')`; delega ao `insertGenerationEvent` (que usa o tracker) ou usa tracker direto; preenche `visual_signature_id`, custo e tokens |
| `src/lib/visual-signature/ai-image-generator.ts` | expõe usage (Responses API) para `visual_signature_image`; validator expõe usage para `visual_signature_validation`; `provider_reported_cost_usd` quando provider trouxer |
| `src/lib/visual-signature/brand-profiler.ts` | callback `onCall` em `callVision`/`callVisionFull` (usage do `chat.completions`) |
| `src/lib/brand-assets/brand-director.ts` | callback `onCall` (usage) |
| `src/lib/brand-assets/text-only-inference-service.ts` | callback `onCall` (usage) |
| Rotas `/api/store/[id]/brand-profile/*` | registram `brand_profile_*` (delivery + call) via tracker — **hoje sem nenhum evento** |
| `src/lib/visual-signature/generation-events.ts` | delega ao tracker (mantém API externa p/ compat de testes) |
| `src/lib/ai-cost/cost-estimator.ts` + `src/lib/ai-cost/tracker.ts` | resolvedor (D9) + camada única de escrita (D7) |
| `src/lib/ai-cost/index.ts` | exports do resolvedor + tracker |

### D12 — Extensibilidade para novos provedores/modelos (sem fase própria)

`DECIDIDO`

- **`provider` e `model` permanecem `TEXT`, sem CHECK fechado no banco** — o resolvedor (D9) trabalha com qualquer string.
- **Novo modelo** entra por `ai_model_pricing` (seed/RPC) + normalizador/adapter de usage — **sem migration** quando a etapa já existir (`generation_type` já cobre).
- **Novo provider** deve emitir um `AiCallInfo` **normalizado** (contrato D7): `{ provider, model, usage?, durationMs, providerReportedCostUsd? }`. O adapter traduz a forma nativa do SDK (usage/tokens) para `TokenUsage`.
- **Sem linha de preço** → evento ainda é gravado como `fallback_static` ou `not_available` (D4) — a chamada nunca some da apuração.
- **Só novo tipo de etapa** (ex.: `campaign_upscale`, `theme_generation`) exige expandir `generation_type` (D5) — único caso de migration.
- **Novo provider não quebra views** — agrupamentos por `provider`/`model` são dinâmicos (D10).

### Runbook de trackings (D1 da fase — F38.1 como desdobramento da F38)

A F38.1 é um **desdobramento da F38** (mesmo milestone v1.5), registrado nos trackings como sub-fase `38.1`, seguindo o padrão das fases `29.1.1/29.1.2/29.3/31.1`. **Não** há renumeração de fases nesta fase.

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `.planning/STATE.md` | Adicionar seção "Phase 38.1 — Apuração de Custos de IA por Entrega" (após a Fase 38) com plans/status; atualizar "Current Position" (linha ~429-431) e a linha 431 mencionando a F38.1 como desdobramento; frontmatter "Last updated" |
| 2 | `.planning/ROADMAP.md` | Adicionar linha na tabela Progress: `38.1 | Apuração de Custos de IA por Entrega | ... | ○ Pending/In progress` e seção de detalhes "Phase 38.1" (goal/success criteria/dependencies, fonte `openspec/changes/fase-38-1-ai-cost-accounting/`); atualizar contagem de fases da milestone v1.5 e rodapé "Last updated" |
| 3 | `.planning/REQUIREMENTS.md` | Adicionar requisitos da F38.1 na seção v1.5 quando os specs OpenSpec forem aprovados (pré-requisitos F38.1-01..0N derivados dos specs) |
| 4 | `.planning/PROJECT.md` | Adicionar a F38.1 à lista de target features do v1.5 |
| 5 | `ROADMAP.md` (raiz) | Atualizar a linha 38/nota de numbering para mencionar "38.1 = Apuração de Custos de IA por Entrega" como desdobramento da F38 |

**Regras gerais (como fases anteriores fizeram):**
- Artefatos históricos (alinhamentos F24–F38, quick-plans) **não são reescritos** — refletem o estado da época
- O `openspec/changes/fase-38-1-ai-cost-accounting/` é a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele
- A atualização dos trackings acontece **no planejamento/execução** da fase (tarefas dedicadas em `tasks.md`), após aprovação dos specs

### Estrutura de arquivos (ref.)

```
supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql
  ← generation_events: novas colunas (D2) + CHECK cost_source (D4) + CHECK generation_type (D5) + índices
  ← campaigns.operation_run_id + índice (D1/D2 — preparo reuso F37)
  ← ai_model_pricing + seeds + RPC admin_set_ai_model_price (D8) + RLS service_role
  ← Views admin_ai_* e admin_cost_vs_credits (D10) + RPC admin_get_ai_costs (D10)

src/lib/ai-cost/types.ts                         ← NOVO — COST_SOURCES, CostSource, OPERATION_RUN_TYPES,
                                                    OperationRunType, TokenUsage, CostResolution, AiCostEvent,
                                                    AiCallInfo (D1/D4/D7)
src/lib/ai-cost/tracker.ts                       ← NOVO — AiCostTracker (D7)
src/lib/ai-cost/ai-model-pricing.ts              ← NOVO — DEFAULT_AI_MODEL_PRICING + fonte tabela (D8)
src/lib/ai-cost/cost-estimator.ts                ← refatora → resolveAiCost (D9)
src/lib/ai-cost/index.ts                         ← exports

src/app/api/admin/ai-model-pricing/route.ts      ← NOVO — GET lista + PUT (RPC) (D8)
src/app/api/admin/ai-costs/route.ts              ← NOVO — GET apuração (RPC admin_get_ai_costs) (D10)

src/app/api/campaign/generate-image/route.ts     ← tracker + fixes furos 1/2/7 + attempt/duration (D7/D11)
src/lib/image-generation/services/image-generation-service.ts   ← expõe usage/attempt (D11)
src/lib/image-generation/services/input-validation-service.ts   ← callback onCall (D11)
src/lib/image-generation/services/image-review-service.ts       ← callback onCall (D11)
src/lib/copy/copy-director-service.ts            ← callback onCall (D11)

src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts ← tracker + cost (D11)
src/lib/visual-signature/ai-image-generator.ts   ← expõe usage (D11)
src/lib/visual-signature/generation-events.ts    ← delega ao tracker (D11)

src/lib/visual-signature/brand-profiler.ts       ← callback onCall (D11)
src/lib/brand-assets/brand-director.ts           ← callback onCall (D11)
src/lib/brand-assets/text-only-inference-service.ts ← callback onCall (D11)
Rotas /api/store/[id]/brand-profile/*            ← registram brand_profile_* (D11)
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Custo real corrompido por chamada não instrumentada** (chamada nova esquecida) | Contrato de teste "cada processo relevante grava evento" (19-38); `AiCostTracker` como único caminho de escrita; callback `onCall` obrigatório nos serviços que chamam IA |
| **Custo do provider divergente do nosso cálculo / provider_reported fora da apuração** | Colunas separadas `provider_reported_cost_usd`/`estimated_cost_usd` (D3); valor contábil `accounting_cost_usd = COALESCE(...)` garante que o reportado **nunca some** da apuração (D3/D10); teste 48 |
| **Dupla contagem de custo/duração (delivery marker × call-level)** | Regra explícita D1/D6/D7: delivery marker grava custo/tokens NULL, só status + `duration_ms` (com `duration_is_pipeline: true`); views de custo somam **apenas call-level**; testes 24/45/I5 |
| **Quebra do `admin_get_metrics`/métricas operacionais (F28)** | `campaign_pipeline`/`visual_signature` mantidos como delivery markers; `duration_ms` do delivery preservado (D6); verificação I6 |
| **Tabela de preço desatualizada em produção** | Seeds + defaults em código (bootstrap); RPC `admin_set_ai_model_price` com versionamento e reason; `pricing_version` no evento permite auditar qual versão foi usada |
| **Falha de escrita de telemetria derruba geração** | `AiCostTracker.record` best-effort — nunca lança (D7); teste 12 |
| **Semântica de entrega misturada (campanha vs VS)** | D1 regra por domínio; testes 22 (campanha: mesmo run) e 31 (VS: novo run pós-falha) |
| **Reuso cross-request do run (F37) prometido além do executado** | Nesta fase o run cobre o request/loop interno; `campaigns.operation_run_id` é persistido na criação (D1/D2) **preparando** a F37 reabrir o mesmo run — a mecânica de reabertura é escopo F37; requests independentes criam novo run nesta fase (spec transactional-pipeline + testes) |
| **Usage ausente em alguns providers (Gemini/image)** | `not_available`/`fallback_static` preservam o evento com tokens; custo NULL não apaga a chamada (D4) |
| **Reconciliação frágil por falta de vínculo** | `visual_signature_id` + `campaign_id` como FKs; VS liga ao ledger via `metadata.credit_tx_id` (D10); migration garante os vínculos |
| **Escopo puxa UI admin** | Decisões do Q&A: pricing e reconciliação **sem página** nesta fase (D8/D10) — medir primeiro, exibir depois |
| **Caminho legado ainda chamado** | Verificado: UI usa apenas `generate-image`; legado só em testes. Fora de escopo (Realinhamento) |
| **Regressão nas rotas de geração críticas** | Refatoração com testes migrados no mesmo PR; suíte completa (`npx vitest run`) roda antes do merge; regressão explícita de pipeline (402/409/estorno), VS (F29.1.1), gates F32/F33/F34/F36, legal (F30), créditos (F24/F38) |
| **Seeds de preço com valores desatualizados** | Seeds tratados como bootstrap verificável (estrutura, não valor canonizado — teste 44); RPC admin permite correção sem deploy |

## Migration Plan

- **Migration SQL única**: `supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql` com: ALTER de `generation_events` (colunas D2 + CHECK `cost_source` D4 + CHECK `generation_type` expandido D5 + índices), **ALTER de `campaigns` (`operation_run_id UUID` + índice, D1/D2)**, `ai_model_pricing` + seeds (D8) + RLS service_role, views `admin_ai_*` + `admin_cost_vs_credits` (D10) + RPC `admin_get_ai_costs` (D10) + RPC `admin_set_ai_model_price` (D8). **Não toca** `reserve_credit`/`credit_transactions` (F24) nem `admin_get_metrics` (F28)
- **Deploy**: normal na Vercel (migração + código no mesmo PR). Rollback: reverter o commit; as tabelas/RPC/views novas ficam órfãs mas inofensivas; seeds `ON CONFLICT DO NOTHING`
- **Pós-aprovação**: aplicar o runbook de trackings (F38.1 como desdobramento da F38) — ver item D1
- **Revert commands**: documentar na própria migration (comentário de rollback por objeto criado)
- **Sem mudança de API pública de leitura** de crédito; `reserve_credit` assinatura inalterada; `generation_events` ganha colunas novas com `IF NOT EXISTS` (migração retrocompatível com dados existentes)

## Open Questions

Nenhuma. Todas as decisões (D1–D12) estão documentadas no alinhamento e neste design. A fase NÃO altera `reserve_credit`/`credit_transactions` (F24) nem `admin_get_metrics` (F28); NÃO cria `operation_runs`; NÃO inclui UI admin de pricing/reconciliação (D8/D10). A única exceção de compatibilidade é o helper `insertGenerationEvent` (VS) que **delega** ao tracker mantendo sua API externa (D7/D11).

## Closing — Fechamento como camada de ESTIMATIVA OPERACIONAL GRANULAR (2026-08-09)

Após o UAT manual, a F38.1 é fechada com a seguinte delimitação explícita:

### O que a F38.1 entrega (e o que NÃO entrega)

- **Entrega:** estimativa operacional **por chamada/entrega** — custo granular por `operation_run_id`, eventos call-level por etapa, pricing versionável em `ai_model_pricing`, `GET/PUT /api/admin/ai-model-pricing`, `GET /api/admin/ai-costs`, separação `estimated_cost_usd` × `provider_reported_cost_usd`, reconciliação USD × créditos (`admin_cost_vs_credits`), `margem_estimada` null quando `credit_unit_usd_value` ausente, registros de `campaign`/`visual_signature`/`brand_profile`.
- **Não entrega (fora de escopo, fase futura):** reconciliação financeira final; integração com a **Costs API / dashboard da OpenAI** (custo financeiro real agregado, não custo exato por geração/`operation_run_id`); `billable_cost_usd` e precificação real de créditos; página admin de pricing.
- **Limitação conhecida:** para Responses API + `image_generation` tool, o `usage` retornado na chamada cobre o modelo textual/orquestrador, mas **não expõe toda a camada econômica da ferramenta de imagem**. Por isso o ajuste provisório (abaixo) é **estimativa calibrada**, não custo real.

### Ajuste provisório versionável da tool image_generation (fórmula v2)

Para uma prévia mais realista de custo no beta, `resolveAiCost` passa a aplicar, **apenas** quando `generation_type = campaign_image` E `imageGenerationTool = true` (Responses API image_generation):

```
estimated_cost_usd = text_component_usd + image_tool_component_usd
```

- `text_component_usd` = cálculo atual por tokens do modelo textual/orquestrador.
- `image_tool_component_usd` = valor **versionável por unidade de imagem** da tool, vindo de:
  1. preferencialmente `ai_model_pricing` (`provider = 'openai'`, `model = 'responses:image_generation'`, `image_unit_usd`); ou
  2. default bootstrap explícito em código (`DEFAULT_AI_MODEL_PRICING["responses:image_generation"]`), com `source_note`/`effective_from` na seed da migration;
  3. atualizável via `GET/PUT /api/admin/ai-model-pricing`.
- Valor inicial provisório: **USD 0.065 por imagem** (calibrado dos UATs de 2026-08-09; `source_note` registra "F38.1 beta estimate calibrated from OpenAI dashboard/Costs CSV; provisional until provider cost reconciliation").
- **Não hardcoda valor escondido no estimator** — o estimator só resolve a linha versionável; o valor é dado.

**Regras de aplicação (anti-dupla-cobrança):**

- Não aplicar o componente em `visual_signature`/`brand_profile` nem no fallback `gpt-image-2` (Image API) — usam outros caminhos de precificação.
- `provider_reported_cost_usd` **permanece reservado** para custo informado pelo provider / reconciliação futura confiável — **nunca** é preenchido com o ajuste provisório.
- `estimated_cost_usd` pode incluir o ajuste provisório.
- Se a tool pricing não existir (nem tabela nem bootstrap), mantém só o componente textual e marca `cost_estimation_note` como parcial (`responses_image_generation_tool_without_unit_pricing`).

**Metadata esperado no evento `campaign_image`:**

```
cost_formula_version: "responses_image_generation_v2"
text_component_usd
image_tool_component_usd
image_tool_pricing_provider
image_tool_pricing_model
image_tool_pricing_version
cost_estimation_note: "provisional_image_tool_unit_cost_until_provider_reconciliation"
provider_usage_raw (mantido — usage bruto sanitizado já existente)
```

**Provedores futuros:** Gemini/Anthropic/outros entram por **adapter + pricing catalog**, nunca por lógica OpenAI hardcoded no estimator:
`provider = "<provider>"`, `model = "image_generation:<caminho-ou-nome>"`, `image_unit_usd = ...` (mesmo contrato; o mapeamento provider→model da tool fica em `IMAGE_GENERATION_TOOL_MODELS` no cost-estimator).

### Decisões de fechamento

- F38.1 é camada de **estimativa operacional granular**, adequada para prévia de custos e calibração de beta — **não** é contabilidade financeira final/reconciliada.
- OpenAI Costs API/dashboard serão tratados em fase futura.
- `provider_reported_cost_usd` não é usado para estimativa calibrada.
- `billable_cost_usd` e precificação real de créditos ficam para fase futura.
- Incidente das 56 linhas históricas (ver VERIFICATION.md) foi **aceito/documentado** como perda de telemetria sem impacto contábil.
