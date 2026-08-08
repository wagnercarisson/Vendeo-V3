# Alinhamento Fase 38.1 — Apuração de Custos de IA por Entrega (v1.5)

> **Relação com a F38:** desdobramento direto da Tabela de Custos por Operação (F38, ✓). F38 define "quanto o usuário paga/debita" (`credit_operation_costs`, em créditos). A 38.1 responde "quanto essa entrega custou para o Vendeo, onde custou e por quê" (`generation_events`, em USD estimado). As duas camadas **não se misturam**: créditos = preço ao lojista; USD = custo real de IA. Elas se encontram nas views de reconciliação (D10).

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F33 — Verificação CNPJ Freemium                             ✓
  ├── F34 — Prontidão de Loja para Geração                        ✓
  ├── F35 — Changelog / Novidades                                 ✓
  ├── F36 — Onboarding: Navegação por Abas                        ✓
  ├── F37 — Revisão e Aprovação da Arte                           ◆ planejamento
  ├── F38 — Tabela de Custos por Operação (créditos)              ✓
  └── F38.1 — Apuração de Custos de IA por Entrega               ← esta fase
        (custo real de IA por chamada, agregado por entrega)

F39 (Stripe / Monetização Pública — v1.7, pós-beta) consumirá a 38.1:
  o preço do crédito será derivado do custo real de IA apurado aqui.
```

A F38 entregou a **fonte única do custo em créditos** (`credit_operation_costs`), mas o custo que o Vendeo **paga à OpenAI/Gemini** continua apurado de forma fragmentada e pouco confiável. O inventário do estado atual (explorado em código) mostra:

- **Três mundos de telemetria que não conversam:** `generation_events` (banco, best-effort), `MetricsWriter` (JSONL local / **no-op em produção**), `logPipelineEvent` (console.log).
- **Captura não uniforme:** o pipeline de campanha insere eventos inline na rota (4 inserts), a assinatura visual usa o helper `insertGenerationEvent`, e **brand profile, revisão de imagem e validação de input não geram evento nenhum** — mesmo fazendo chamadas reais de IA.
- **Furos verificados em código** que corrompem a apuração hoje (seção "Realinhamento de Escopo", e detalhados nas decisões):
  1. Copy da campanha grava `estimated_cost_usd: NULL` — a rota chama `estimateAiCost` **sem usage** (`route.ts:593`), e o `CopyDirectorService` descarta o `usage` que o `TextProviderResult` já traz.
  2. `metadata.totalCost` grava o **nome do provider** em vez do custo (`route.ts:642`).
  3. Modelos reais sem preço na tabela TS: `gemini-3.1-flash-lite` (default do Gemini) e `gpt-image-2` (fallback de edição) → `estimateAiCost` retorna `null` ou fallback cego.
  4. Revisão (`ImageReviewService`) e validação (`InputValidationService`) são chamadas vision gpt-4o (caras) que **somem da contabilidade**.
  5. Evento de assinatura visual sem `estimated_cost_usd` nem tokens, apesar de o provider retornar `usage`.
  6. `attempt_number` da imagem é sempre 1, mesmo com até 3 tentativas de revisão/recomposição no loop real (`image-generation-service.ts`).
  7. `duration_ms` representa o pipeline inteiro, não a chamada individual.

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

---

## Propósito

1. **Evento por chamada real de IA, agregado por entrega** — cada chamada (copy, validação, geração de imagem, revisão, recomposição, assinatura, brand profile) grava `generation_events` próprio com tokens, custo e duração da chamada; a entrega soma tudo via `operation_run_id`
2. **Semântica econômica correta por domínio** — campanha: reprovações/regenerações fazem parte da **mesma entrega** até aprovação (F37); assinatura visual: **cada geração é uma entrega debitável separada** (salvo falha técnica/erro grotesco de sistema)
3. **Custo real primeiro, USD depois** — registrar consumo real (tokens/usage) sempre que existir, mesmo quando o custo em USD for desconhecido; custo fica em colunas separadas com `cost_source` auditável e valor contábil `accounting_cost_usd = COALESCE(provider_reported_cost_usd, estimated_cost_usd)` derivado nas views
4. **Tabela de preço como dado, não só código** — `ai_model_pricing` versionada (`effective_from`/`effective_until`), com seeds para bootstrap e defaults em código para fallback; administrável via RPC/API admin (sem página nesta fase)
5. **Reconciliar custo real (USD) × créditos debitados** — views/RPCs respondem: "campanha X debitou 1 crédito e custou US$ 0.037; etapas mais caras: review e geração; regenerações: 2; margem estimada por crédito: …"
6. **Observabilidade técnica e contábil unificadas** — um único destino canônico: `generation_events` evoluído + camada `AiCostTracker` por cima. Não criar um segundo ledger. `MetricsWriter`/`logPipelineEvent` deixam de ser fonte de custo
7. **Duração por chamada e por entrega** — `generation_events.duration_ms` vira duração da **chamada individual**; a duração da entrega é agregada por views (sem tabela `operation_runs` nesta fase)
8. **Sem cobrança dinâmica** — a 38.1 mede com precisão e reconcilia; ajuste de preço de crédito/franquia/margem fica para fases futuras com dados reais em mãos

**Entrega verificável:**
- Schema: novas colunas em `generation_events` (`operation_run_id`, `operation_run_type`, `visual_signature_id`, `theme_id`, `cached_input_tokens`, `image_tokens`, `provider_reported_cost_usd`, `cost_source`, `pricing_version`) + CHECK de `generation_type` expandido + coluna `attempt_number` granular
- `AiCostTracker` (camada única, best-effort) substituindo os inserts inline e o helper atual
- Providers/serviços expondo `usage`: copy director, input validation, image review, ai-image-generator, validator, brand profiler/director/text-only
- Tabela `ai_model_pricing` (preços por dimensão: token texto/token imagem/unidade de imagem — nullable com CHECK de ao menos uma) + seeds verificáveis (source_url/effective_from) + RPC `admin_set_ai_model_price` + `GET`/`PUT /api/admin/ai-model-pricing` (sem página)
- Estimador refatorado: resolve `provider_reported → pricing_table → fallback_static → not_available`; corrige gemini-3.1-flash-lite, gpt-image-2, cached/image tokens; mapeia as `source` antigas; valor contábil `accounting_cost_usd` derivado (D3/D10)
- Views/RPCs de apuração e reconciliação (sem UI) — somam apenas call-level (anti-dupla-contagem, D1/D6)
- Furos 1–7 corrigidos; `npx vitest run`, `npm run typecheck`, `npm run lint` — zero erros

---

## Estado Atual / Base Para F38.1

```
                                    ESTADO ATUAL                      DEPOIS (F38.1)
═══════════════════════════════════════════════════════════════════════════════════════════════

Captura:
  Destino canônico                generation_events + MetricsWriter     generation_events evoluído
                                  (JSONL/no-op em prod) + console.log   (única fonte de custo)
  Padrão de insert                inline na rota (4) + helper (VS)      AiCostTracker (camada única)
  Chamadas cobertas               copy, image, pipeline, VS             copy, input_validation,
                                  (brand profile: NENHUMA)              image, image_review, VS image,
                                                                        VS validation, brand profile

Agrupamento:
  Entrega econômica               inexistente                           operation_run_id + type
  Trace técnico                   trace_id só no pipeline               trace_id mantido + propagado
                                                                        (VS/brand profile passam a ter)

Custo:
  Coluna                          estimated_cost_usd (única)            provider_reported_cost_usd
                                                                        + estimated_cost_usd
                                                                        + accounting_cost_usd (derivado
                                                                          = COALESCE(provider_reported_cost_usd,
                                                                                     estimated_cost_usd))
                                                                        + cost_source (5 valores)
                                                                        + pricing_version
  Fonte                           estimateAiCost() hardcoded TS         ai_model_pricing (dado)
                                                                    →  fallback em código
  Copy da campanha                SEMPRE NULL (usage descartado)        custo real por usage
  Modelos sem preço               gemini-3.1-flash-lite, gpt-image-2    presentes na tabela/seeds

Tokens:
  Colunas                         prompt/completion/total (só imagem)   + cached_input_tokens
                                                                        + image_tokens
  attempt_number                  sempre 1 (mesmo com 3 retries)        attempt_number granular

Duração:
  generation_events.duration_ms   pipeline inteiro                      chamada individual
  Duração da entrega              inexistente                           SUM() via views

Apuração:
  Queries                         admin_get_metrics (agg genérica)      views por run/campaign/store/
                                                                        user/provider-model/etapa
  Reconciliação USD × créditos    inexistente                           views de reconciliação
  Admin de preço                  inexistente                           RPC + API admin (sem página)

Caminho legado:
  /api/campaign/generate          só exercitado por testes (UI usa      fora de escopo (não
                                  apenas generate-image)                instrumentado; deprecação
                                                                        formal em fase própria)
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F38.1) |
|------|-------------------|---------------------|
| **`ai_model_pricing` admin** | "editável no /admin" | **RPC/API admin sem página** (decisão do Q&A) — foco da fase é observabilidade/apuração; UI de pricing vira fase curta futura quando os dados mostrarem uso. Seeds + defaults em código garantem bootstrap; RPC versionada + `GET`/`PUT /api/admin/ai-model-pricing` permitem ajuste manual |
| **`operation_runs`** | "tabela própria" | **Coluna `operation_run_id` + views** (decisão do Q&A) — o evento granular já é o ledger; tabela de operações cedo duplicaria status/duração/custo total ("qual tabela é a verdade?"). Tabela `operation_runs` só se o produto exigir lifecycle explícito da entrega (futuro) |
| **Custo do provider** | "uma coluna" | **Colunas separadas**: `provider_reported_cost_usd` (dado externo direto, quando existir) + `estimated_cost_usd` (cálculo interno) + `cost_source` (classificação). Separação preserva auditabilidade e evita sobrescrever medição real com cálculo nosso |
| **Reconciliação** | "tela admin" | **Só views/RPCs** (decisão do Q&A) — base sólida de consulta (por run/campaign/store/user/provider-model/generation_type/attempt, custo total, créditos, margem). UI admin nasce depois, sobre views estáveis |
| **Caminho legado `/api/campaign/generate`** | "instrumentar tudo" | **Fora de escopo** — só exercitado por testes (`campaign-matrix.test.ts`); o frontend chama apenas `/api/campaign/generate-image` (`use-campaign-form.ts:444`). Não instrumentar; deprecação formal em fase própria |
| **`MetricsWriter`** | "manter como fonte" | **Deixa de ser fonte de custo** — `generation_events` vira a trilha canônica. `MetricsWriter` permanece (debug local), mas não é destino contábil; `logPipelineEvent` continua para rastreio técnico apenas |
| **Segundo ledger** | "avaliar" | **Não criar** — `generation_events` evoluído é a trilha granular única; `credit_transactions` (F24) permanece o ledger financeiro de créditos, intocado |

---

## Decisões de Alinhamento

### D1 — Semântica das camadas: entrega / rastreio técnico / chamada

`DECIDIDO`

```
operation_run_id  = tentativa econômica/entrega agrupada  (UUID por request)
trace_id          = rastreio técnico do fluxo             (já existe no pipeline)
generation_event  = cada chamada real de IA               (1 linha por chamada)
```

- **`operation_run_id`** agrupa todas as chamadas de uma mesma entrega econômica. Regras por domínio:
  - **Campanha** (`campaign_delivery`): o run nasce no início do request e cobre **todas as tentativas** (validação → copy → imagem → revisão → recomposição) até a aprovação final (F37). Reprovação/regeneração **não** abre novo run.
  - **Assinatura visual** (`visual_signature`): cada request de geração é **um run** (uma geração debitável). Falha técnica/erro grotesco de sistema → estorno e a **nova tentativa é outro run** (novo debit). Não usar a semântica "até aprovação" da campanha.
  - **Brand profile** (`brand_profile`): cada request de geração/realinhamento é um run.
  - **Tema** (`theme`): tipo preparado no schema (`theme_id`), instrumentação futura.
- **`trace_id`**: pipeline já o usa; VS e brand profile **passam a gerar** um `trace_id` por request e propagá-lo às chamadas filhas. `operation_run_id` e `trace_id` podem ser o mesmo UUID no caso simples, mas **são colunas separadas** com semânticas distintas.
- **`generation_event`**: cada chamada de IA real vira uma linha com `generation_type`, `provider`, `model`, `attempt_number`, `duration_ms` (da chamada), tokens e custo.

**Regra operacional:** um `operation_run_id` tem **um** evento agregado da entrega (delivery marker, ex.: `campaign_pipeline`/`visual_signature`/`brand_profile_*`) e **N chamadas** (call-level).

**Regra anti-dupla-contagem (custo/duração):** o delivery marker **não grava custo nem tokens** (`estimated_cost_usd = NULL`, `provider_reported_cost_usd = NULL`, tokens NULL). Ele existe para compatibilidade com `admin_get_metrics` (F28), preservando apenas `status`, `duration_ms` (pipeline, com `metadata.duration_is_pipeline: true`) e metadados operacionais. **Custo e duração econômicos são apurados exclusivamente somando eventos call-level** por `operation_run_id` nas views (D10). Views de custo filtram `generation_type` por `*_call`/call-level ou excluem os tipos delivery. Assim, nenhum valor é contado duas vezes.

---

### D2 — Schema: novas colunas em `generation_events`

`DECIDIDO`

```sql
-- Migração 2026XXXX: expandir generation_events
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS operation_run_id       UUID;            -- D1 — agrupador econômico (UUID, revisão da proposta)
  ADD COLUMN IF NOT EXISTS operation_run_type     TEXT;            -- D1 — campaign_delivery|visual_signature|brand_profile|theme
  ADD COLUMN IF NOT EXISTS visual_signature_id    UUID REFERENCES public.store_visual_signatures(id);
  ADD COLUMN IF NOT EXISTS theme_id               UUID;            -- futuro (temas) — apenas preparado
  ADD COLUMN IF NOT EXISTS cached_input_tokens    INTEGER;
  ADD COLUMN IF NOT EXISTS image_tokens           INTEGER;
  ADD COLUMN IF NOT EXISTS provider_reported_cost_usd REAL;        -- D3 — dado externo quando existir
  ADD COLUMN IF NOT EXISTS cost_source            TEXT;            -- D3/D4 — enum 5 valores
  ADD COLUMN IF NOT EXISTS pricing_version        TEXT;            -- D4/D8 — versão de preço usada (ou 'code_default'/NULL)

-- operation_run_type: sem CHECK enum no banco (padrão do repositório: enums versionados no TS)
-- cost_source: CHECK explícito (D4) — conjunto fechado de classificação de custo
ALTER TABLE public.generation_events
  ADD CONSTRAINT chk_generation_events_cost_source
  CHECK (cost_source IN ('provider_reported','pricing_table','fallback_static','manual_unknown','not_available'));

-- CHECK de generation_type expandido (D5)
ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_generation_events_type;
ALTER TABLE public.generation_events
  ADD CONSTRAINT chk_generation_events_type CHECK (generation_type IN (
    'campaign_pipeline','campaign_copy','campaign_input_validation',
    'campaign_image','campaign_image_review',
    'visual_signature','visual_signature_image','visual_signature_validation',
    'brand_profile_without_logo','brand_profile_with_logo',
    'brand_profile_vision','brand_profile_text'
  ));
```

- **Índices novos:** `(operation_run_id)`, `(visual_signature_id)`, `(operation_run_type)`, `(cost_source)`, `(provider, model)`.
- **Retenção:** a função `cleanup_generation_events_90d()` (F28) cobre as novas colunas automaticamente (DELETE por `created_at`). Sem mudança.
- **RLS:** mantém **default-deny** (sem policy para `authenticated`, apenas service_role) — como hoje. Admin lê via RPC `SECURITY DEFINER` (D10), padrão `admin_get_metrics`.
- **`pricing_version`:** UUID da linha `ai_model_pricing` usada, `'code_default'` quando veio do fallback em código, `NULL` quando não se aplica (ex.: `provider_reported` sem uso de tabela).

---

### D3 — Custo: colunas separadas + regra mental

`DECIDIDO`

```text
provider_reported_cost_usd = dado externo direto, quando o provider reportar custo
estimated_cost_usd         = cálculo interno do Vendeo (sempre preenchido quando viável)
accounting_cost_usd        = COALESCE(provider_reported_cost_usd, estimated_cost_usd)
                            → valor contábil usado nas views/RPCs de apuração (revisão)
cost_source                = como estimamos ou classificamos o custo usado
```

- **`provider_reported_cost_usd`**: preenchido **somente** quando o provider entrega custo financeiro explícito (raro hoje na OpenAI SDK; futuro/outros provedores podem reportar). Não é sobrescrito por cálculo nosso.
- **`estimated_cost_usd`**: o custo que o Vendeo usa para apuração — calculado pelo estimador (D4/D8). Nunca sobrescreve `provider_reported_cost_usd`.
- **`accounting_cost_usd`**: derivado nas views/RPCs (D10) como `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` — **não é coluna** no banco; é o valor contábil efetivo. Regra: evento com `provider_reported_cost_usd` presente **não some** da apuração quando `estimated_cost_usd` estiver NULL.
- **`cost_source`** (enum fechado, D4): a origem do custo **usado na apuração**.
- **Regra de registro:** tokens/usage são gravados **sempre** que existirem, mesmo que o custo em USD fique `NULL` (ex.: `not_available`). Custo real primeiro, USD depois — a trilha permanece auditável.

---

### D4 — `cost_source`: enum de 5 valores + mapeamento das sources atuais

`DECIDIDO`

| `cost_source` | Significado | Mapeamento das sources atuais (`estimateAiCost`) |
|---|---|---|
| `provider_reported` | Provider entregou custo financeiro direto | (novo) — `provider_reported_cost_usd` |
| `pricing_table` | Custo calculado com a tabela `ai_model_pricing` | `openai_published_pricing`, `gemini_published_pricing` |
| `fallback_static` | Provider sem usage e/ou modelo sem preço → valor estático configurado | `configured_fallback`, `configured_fallback_unknown_model_with_usage` |
| `manual_unknown` | Custo inserido/ajustado manualmente sem origem automática | (novo) — preço manual de modelo desconhecido |
| `not_available` | Sem usage E sem preço/config → custo desconhecido (tokens ainda registrados) | `null` retornado hoje → agora grava evento com tokens + custo NULL |

- **Mudança de comportamento importante:** hoje `estimateAiCost` pode retornar `null` (ex.: gpt-4o sem usage → copy grava `NULL`). Na 38.1, o `AiCostTracker` **sempre grava o evento**; o `estimated_cost_usd` é `NULL` apenas quando `cost_source = 'not_available'`. O evento existe mesmo sem custo.
- O `metadata.costSource` atual (imagem) é **promovido a coluna** `cost_source`; o campo no metadata deixa de ser fonte.

---

### D5 — `generation_type` granular + inventário de chamadas cobertas

`DECIDIDO`

Inventário de chamadas reais de IA (mapeado em código) e o `generation_type` de cada uma:

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
- `campaign_image_review` e `campaign_input_validation` cobrem as chamadas vision que **hoje somem** da contabilidade (só iam ao `MetricsWriter`, no-op em produção).
- `brand_profile_*` call-level + delivery: hoje **nenhum** evento de brand profile existe — a fase os introduz de verdade.

---

### D6 — Duração por chamada e por entrega

`DECIDIDO`

- **`generation_events.duration_ms` = duração da chamada individual** (novo padrão). O evento call-level mede o tempo entre início e fim daquela chamada de IA.
- **Duração da entrega** = `SUM(duration_ms)` por `operation_run_id` via views (D10). Sem tabela `operation_runs` (D1).
- **Correção do furo 7:** hoje os eventos de campanha usam `durationMs` do pipeline inteiro (`route.ts:555`) para copy e imagem — passa a ser medido **por chamada** no ponto de execução de cada uma.
- O delivery marker (`campaign_pipeline`/`visual_signature`) **não grava custo nem tokens** (anti-dupla-contagem, D1): mantém apenas `duration_ms` da entrega (pipeline) com `metadata` indicando `duration_is_pipeline: true` — para não quebrar `admin_get_metrics` que usa `AVG(duration_ms)` dos eventos `campaign_pipeline`. O call-level é sempre por chamada, com custo e tokens. Views de custo **somam apenas call-level**.

---

### D7 — `AiCostTracker`: camada única de registro (best-effort)

`DECIDIDO`

Novo módulo `src/lib/ai-cost/tracker.ts` (server-only), **único** caminho de escrita de custo:

```typescript
// Contrato conceitual
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
  // Estima (via D8) e grava. Nunca lança — best-effort, não bloqueia geração.
  async record(event: CostEvent): Promise<void>;
  // Cria run no início de um request e devolve o id (propaga para as chamadas).
  // operationRunId é UUID (string v4) — coluna UUID no banco; trace_id é TEXT.
  startRun(type: CostEvent["operationRunType"]): { operationRunId: string; traceId: string };
}
```

- **Substitui** os 4 inserts inline do `generate-image/route.ts`, os inserts do `generate-without-logo/route.ts` e o helper `insertGenerationEvent` (que passa a delegar ao tracker — mantendo compatibilidade do teste/uso existente).
- **Furos corrigidos:** copy com custo real (D3/D4 + usage exposto, D9); `metadata.totalCost` correto (soma real, não nome do provider); `attempt_number` granular vindo do loop de revisão.
- **Padrão de exposição de usage:** os serviços expõem `usage`/custo via **callback opcional** (evita quebrar contratos públicos):
  ```typescript
  onCall?: (info: { provider: string; model: string; usage?: {...}; durationMs: number }) => void
  ```
  Aplicado em: `CopyDirectorService.generateCopy`, `InputValidationService.validate`, `ImageReviewService.review`, `AiImageGenerator.generate`, `VisualSignatureValidator`, `BrandProfilerWithoutLogoService`, `BrandDirector`, `TextOnlyInferenceService`. No `ImageGenerationService`, o `onMetricsEvent` existente é ampliado com usage/custo por tentativa.
- **`operation_run_id`/`trace_id` são propagados** por um objeto de contexto de telemetria (`opts.telemetry`/param opcional) criado na rota via `tracker.startRun(...)`.
- **Delivery marker sem custo:** o `record` do delivery (ex.: `campaign_pipeline`/`visual_signature`) recebe `cost: null`/sem `estimatedCostUsd` e sem tokens — a duração fica no `durationMs` com `metadata.duration_is_pipeline: true` (anti-dupla-contagem, D1/D6).
- **Geração nunca é bloqueada por telemetria** — qualquer falha de escrita é logada e ignorada (padrão atual best-effort).

---

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
- **Seeds (bootstrap inicial)** — modelos hoje em produção, com defaults da tabela TS atual + correções de furos (3). **Tratados como valores verificáveis, não definitivos:** cada seed leva `source_url` + `source_note` + `effective_from` apontando para a fonte pública consultada no momento do seed; o teste (44) valida **estrutura** (pelo menos uma dimensão de preço presente, `source_url`/`effective_from` preenchidos, `effective_until` NULL), **não** canoniza o valor do preço para sempre. Preços podem variar por família/modalidade — os valores abaixo devem ser conferidos contra a fonte antes de fixar o seed:
  ```
  openai   gpt-4o                input 2.50  output 10.00
  openai   gpt-4o-mini           input 0.15  output 0.60
  openai   gpt-5.5               input 5.00  output 30.00  cached 0.50
  openai   gpt-image-2           image_unit 0.040  (conferir: OpenAI lista por tokens de imagem/texto, não fixa — verificar na fonte e escolher dimensão certa)
  openai   dall-e-3              image_unit 0.040
  gemini   gemini-2.0-flash      input 0.10  output 0.40
  gemini   gemini-3.1-flash-lite input 0.10  output 0.40  (NOVO — modelo default real do Gemini)
  ```
  > **Nota de revisão (seeds):** `gpt-image-2`/`dall-e-3` não definem `input_token_usd_per_1m`/`output_token_usd_per_1m` — a coluna agora é nullable e o CHECK `chk_ai_model_pricing_at_least_one_price` exige pelo menos uma dimensão válida (token texto, token imagem ou unidade de imagem). O schema não quebra nem força `0` artificial.
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
- **API admin:** `GET /api/admin/ai-model-pricing` (lista vigentes + histórico) e `PUT /api/admin/ai-model-pricing` (chama o RPC) — sob `requireAdmin` + zod. **Sem página** nesta fase (decisão do Q&A).

---

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
  - Cached tokens (`input_tokens_details.cached_tokens`) e image tokens (`output_tokens_details.image_tokens`) contabilizados — gpt-5.5 já tem `cachedInputPer1M`; visão com imagem usa input tokens (altas, detail high).
  - `manual_unknown` para preço inserido manualmente sem origem automática.
- **Refatoração:** preços movem da `Record` TS para a tabela (D8); o TS vira default bootstrap. Os testes existentes do estimator (`cost-estimator.test.ts`) são adaptados ao novo contrato e mantidos.

---

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
-- Conceitual (detalhe no planejamento OpenSpec)
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

---

### D11 — Instrumentação por serviço (mapeamento concreto)

`DECIDIDO`

| Arquivo | Mudança |
|---|---|
| `src/app/api/campaign/generate-image/route.ts` | Remove os 4 inserts inline; usa `tracker.startRun('campaign_delivery')` no início e `tracker.record(...)` por chamada (via callbacks); corrige `metadata.totalCost`; `attempt_number` por tentativa real; `duration_ms` por chamada |
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

---

### D12 — Extensibilidade para novos provedores/modelos (sem fase própria)

`DECIDIDO`

A 38.1 é a fundação que evita migração a cada novo provedor/modelo. Regras:

- **`provider` e `model` permanecem `TEXT`, sem CHECK fechado no banco** — o resolvedor (D9) trabalha com qualquer string.
- **Novo modelo** entra por `ai_model_pricing` (seed/RPC) + normalizador/adapter de usage — **sem migration** quando a etapa já existir (`generation_type` já cobre).
- **Novo provider** deve emitir um `AiCallInfo` **normalizado** (contrato D7): `{ provider, model, usage?, durationMs, providerReportedCostUsd? }`. O adapter traduz a forma nativa do SDK (usage/tokens) para `TokenUsage`.
- **Sem linha de preço** → evento ainda é gravado como `fallback_static` ou `not_available` (D4) — a chamada nunca some da apuração.
- **Só novo tipo de etapa** (ex.: `campaign_upscale`, `theme_generation`) exige expandir `generation_type` (D5) — único caso de migration.
- **Novo provider não quebra views** — agrupamentos por `provider`/`model` são dinâmicos (D10).

---

```
ARQUIVOS MODIFICADOS (principais):
═══════════════════════════════════════════════════════════════

supabase/migrations/2026XXXXXX_create_ai_cost_accounting.sql   ← NOVA migration
  ← generation_events: novas colunas (D2) + CHECK cost_source (D4) + CHECK generation_type (D5) + índices
  ← ai_model_pricing + seeds + RPC admin_set_ai_model_price (D8) + RLS service_role
  ← Views admin_ai_* e admin_cost_vs_credits (D10)

src/lib/ai-cost/tracker.ts                          ← NOVO — AiCostTracker (D7)
src/lib/ai-cost/cost-estimator.ts                   ← refatora → resolveCost (D9)
src/lib/ai-cost/ai-model-pricing.ts                 ← NOVO — DEFAULT_AI_MODEL_PRICING + fonte tabela (D8)
src/lib/ai-cost/index.ts                            ← exports

src/app/api/admin/ai-model-pricing/route.ts         ← NOVO — GET lista + PUT (RPC) (D8)
src/app/api/admin/ai-costs/route.ts                 ← NOVO — GET apuração (RPC admin_get_ai_costs) (D10)

src/app/api/campaign/generate-image/route.ts        ← tracker + fixes furos 1/2/7 + attempt/duration (D7/D11)
src/lib/image-generation/services/image-generation-service.ts   ← expõe usage/attempt (D11)
src/lib/image-generation/services/input-validation-service.ts   ← callback onCall (D11)
src/lib/image-generation/services/image-review-service.ts       ← callback onCall (D11)
src/lib/copy/copy-director-service.ts               ← callback onCall (D11)

src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts ← tracker + cost (D11)
src/lib/visual-signature/ai-image-generator.ts      ← expõe usage (D11)
src/lib/visual-signature/generation-events.ts       ← delega ao tracker (D11)

src/lib/visual-signature/brand-profiler.ts          ← callback onCall (D11)
src/lib/brand-assets/brand-director.ts              ← callback onCall (D11)
src/lib/brand-assets/text-only-inference-service.ts ← callback onCall (D11)
Rotas /api/store/[id]/brand-profile/*               ← registram brand_profile_* (D11)
```

---

## Contratos de Integração

```typescript
// src/lib/ai-cost/types.ts (novo módulo de tipos)

export const COST_SOURCES = [
  "provider_reported", "pricing_table", "fallback_static",
  "manual_unknown", "not_available",
] as const;
export type CostSource = (typeof COST_SOURCES)[number];

export const OPERATION_RUN_TYPES = [
  "campaign_delivery", "visual_signature", "brand_profile", "theme",
] as const;
export type OperationRunType = (typeof OPERATION_RUN_TYPES)[number];

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  imageTokens?: number;
}

export interface CostResolution {
  estimatedCostUsd: number | null;        // cálculo interno do Vendeo (pode ser null = not_available)
  providerReportedCostUsd?: number | null;
  costSource: CostSource;
  pricingVersion?: string | null;         // uuid da linha ai_model_pricing | 'code_default' | null
}

export interface AiCostEvent { /* idem CostEvent do D7 */ }
```

```typescript
// src/lib/ai-cost/cost-estimator.ts — novo contrato (D9)
export function resolveAiCost(params: {
  provider: string;
  model: string;
  usage?: TokenUsage;
  providerReportedCostUsd?: number | null;
}): CostResolution;
```

```typescript
// src/lib/ai-cost/tracker.ts — camada única (D7)
import "server-only";

export class AiCostTracker {
  constructor(client?: SupabaseClient);
  startRun(type: OperationRunType): { operationRunId: string; traceId: string };
  async record(event: AiCostEvent): Promise<void>;   // best-effort — nunca lança
}
```

```typescript
// Callback de usage (D7) — padrão para os serviços
export interface AiCallInfo {
  provider: string;
  model: string;
  usage?: TokenUsage;
  durationMs: number;
}

// CopyDirectorService.generateCopy(input, opts: { signal?, onCall? })  — furo 1
// InputValidationService.validate(name, dataUrl, override?, onCall?)    — furo 4
// ImageReviewService.review(dataUrl, input, onCall?)                    — furo 4
// AiImageGenerator.generate(params & { onCall? })
// VisualSignatureValidator.validate(params & { onCall? })
// BrandProfilerWithoutLogoService.generate(input & { onCall? })
// BrandDirector / TextOnlyInferenceService (mesmo padrão)
```

```sql
-- RPC admin_set_ai_model_price (D8) — assinatura resumida
-- Ordem: p_reason antes dos opcionais (Postgres: param sem default não pode suceder param com default)
SELECT public.admin_set_ai_model_price(
  p_actor_id     := 'uuid',
  p_provider     := 'openai',
  p_model        := 'gpt-4o',
  p_input        := 2.50,
  p_output       := 10.00,
  p_reason       := 'Atualização de tabela',
  p_cached       := NULL,
  p_image_unit   := NULL,
  p_image_token  := NULL,
  p_source_url   := 'https://openai.com/api/pricing/',
  p_source_note  := 'Atualização trimestral'
);
-- → JSONB { id, provider, model, effective_from, previous_id }
```

```sql
-- RPC admin_get_ai_costs (D10) — assinatura resumida
SELECT public.admin_get_ai_costs(
  p_operation_run_id := NULL, p_campaign_id := NULL, p_store_id := NULL,
  p_user_id := NULL, p_provider := NULL, p_model := NULL,
  p_generation_type := NULL, p_hours := 24
);
-- → JSONB com agrupamentos por operation_run, store, provider/model, generation_type,
--   custo_usd_total, creditos_debitados (reconciliação), margem_estimada, regeneracoes
```

```typescript
// API admin (D8)
// GET  /api/admin/ai-model-pricing   (admin) → 200 { prices: [ { id, provider, model,
//                                          input..., effective_from, effective_until, source_note } ] }
// PUT  /api/admin/ai-model-pricing   (admin) → body { provider, model, input, output, cached?,
//                                          imageUnit?, imageToken?, sourceUrl?, sourceNote?, reason }
//                                        → 200 { id, provider, model, effective_from, previous_id }
//                                        → 400 | 403 | 500

// API apuração (D10)
// GET  /api/admin/ai-costs (admin) → query params de filtro → 200 { ...aggregations }
```

---

## Testes

Testes seguindo o padrão do repositório (vitest + Testing Library). Premissa: **cada processo relevante grava evento** — contrato garantido por teste.

### `resolveAiCost` (refatorado — D9) — 10 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | usage + linha na tabela → calcula por tokens, `costSource: pricing_table`, `pricing_version` = uuid da linha | Fonte primária |
| 2 | `providerReportedCostUsd` presente → `provider_reported` (não sobrescreve com cálculo) | D3 |
| 3 | modelo image sem usage (gpt-image-2) → usa a dimensão de imagem da linha (`image_unit_usd`/`image_token_usd_per_1m`) | D8/D9 |
| 4 | gemini-3.1-flash-lite com usage → custo por tokens (não mais NULL) | **furo 3** |
| 5 | gpt-4o **sem usage** → `fallback_static` (0.15) — e NÃO null (furo 1 sanado no fluxo) | D4 |
| 6 | modelo desconhecido + sem usage → `fallback_static` | D4 |
| 7 | tabela sem linha e default em código → `pricing_table` com `pricing_version: 'code_default'` | D8 bootstrap |
| 8 | tabela sem linha E sem default → `not_available` (custo NULL, tokens preservados) | D4 |
| 9 | cached tokens (gpt-5.5) → desconta do input (preço cached) | D9 |
| 10 | `manual_unknown` quando ajuste manual sem origem automática | D4 |

### `AiCostTracker` — 8 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 11 | `record` grava todas as novas colunas (operation_run_id/type, cost_source, pricing_version, cached/image tokens, visual_signature_id) | D2/D7 |
| 12 | `record` **nunca lança** (erro de escrita logado, geração segue) | best-effort D7 |
| 13 | `startRun` gera `operation_run_id` + `trace_id` distintos | D1 |
| 14 | evento sem custo (not_available) ainda grava tokens | D4 |
| 15 | mesmo `operation_run_id` agrupa N chamadas (teste de propagação) | D1 |
| 16 | `cost_source` inválido rejeitado no TS (check) | D4 |
| 17 | `insertGenerationEvent` existente delega ao tracker (retorno compatível) | D11 |
| 18 | `duration_ms` = duração da chamada (não pipeline) | D6 |

### Pipeline de campanha — 10 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 19 | copy registrado com **usage real** e `estimated_cost_usd` preenchido (furo 1) | D11 |
| 20 | `campaign_input_validation` registrado (vision) — não some mais | **furo 4** |
| 21 | `campaign_image_review` registrado por tentativa com `attempt_number` 1..n | **furos 4/6** |
| 22 | recomposição/regeneração **dentro do mesmo operation_run_id** (sem novo run) | D1 |
| 23 | `metadata.totalCost` = soma real das chamadas (não nome do provider) | **furo 2** |
| 24 | delivery `campaign_pipeline` com **custo/tokens NULL**; custo da entrega = soma das chamadas call-level via view | D1/D6 anti-dupla-contagem |
| 25 | falha na revisão → evento `campaign_image_review` `status: failed` + custo dos tokens gastos | D5 |
| 26 | `duration_ms` por chamada (copy ≠ pipeline) | D6 |
| 27 | `operation_run_id` propagado da rota até imagem/review/copy | D1 |
| 28 | regressão: telemetria antiga (campaign_pipeline) preservada p/ `admin_get_metrics` | compat |

### Assinatura visual — 6 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 29 | `visual_signature_image` + `visual_signature_validation` registrados com custo/tokens | D11 |
| 30 | `visual_signature` (delivery) com **custo/tokens NULL**; custo da VS = soma de `visual_signature_image` + `visual_signature_validation` (anti-dupla-contagem D1/D6) | **furo 5** |
| 31 | **nova tentativa após falha técnica = novo `operation_run_id`** (semântica VS, D1) | D1 |
| 32 | `visual_signature_id` preenchido nos eventos | D2 |
| 33 | typographic fallback (sem IA) → sem evento call-level (não inventar chamada) | D5 |
| 34 | `insertGenerationEvent` VS mantém comportamento (approved/rejected p/ F37) | compat |

### Brand profile — 4 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 35 | `brand_profile_vision` (profiler/director) registrado | D11 |
| 36 | `brand_profile_text` (text-only) registrado | D11 |
| 37 | delivery `brand_profile_without_logo`/`_with_logo` registrado (tipos existentes agora usados) | D5 |
| 38 | modo regenerate (realign) gera novo `operation_run_id` | D1 |

### `ai_model_pricing` + API admin — 6 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 39 | `PUT /api/admin/ai-model-pricing` atualiza (fecha vigente + abre nova) via RPC | D8 |
| 40 | versionamento: segunda atualização cria linha nova com `effective_from` novo | D8 |
| 41 | `PUT` sem `reason` → 400 | D8 |
| 42 | `PUT`/`GET` sem admin → 403 | D8 |
| 43 | `authenticated` NÃO lê `ai_model_pricing` (RLS service_role) | D8 |
| 44 | seeds presentes, vigentes (`effective_until` NULL), com `source_url`/`effective_from` e **ao menos uma dimensão de preço** (CHECK) — valida estrutura, não canoniza valor | D8 revisão |

### Views/RPC de apuração — 6 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 45 | `admin_ai_operation_costs` agrupa por run — soma **apenas call-level**, delivery markers excluídos (sem dupla contagem) | D10/D1 |
| 46 | `admin_campaign_delivery_costs` detalha por etapa | D10 |
| 47 | `admin_ai_cost_by_provider_model` e `admin_ai_cost_by_stage` | D10 |
| 48 | `admin_cost_vs_credits` reconcilia USD × créditos por campanha; evento com só `provider_reported_cost_usd` entra via `accounting_cost_usd` | D10/D3 |
| 49 | reconciliação por VS via `store_visual_signatures.metadata.credit_tx_id` | D10 |
| 50 | `admin_get_ai_costs` filtra por store/provider/model/tipo/periodo | D10 |

### Verificação SQL/integrada (obrigatória)

| # | Verificação | O que prova |
|---|-------------|-------------|
| I1 | Migration aplicada em banco real: novas colunas + CHECKs (`cost_source`, `generation_type`, `chk_ai_model_pricing_at_least_one_price`) + índices | Schema íntegro |
| I2 | `admin_set_ai_model_price` real: fechou anterior + abriu nova + retornou ids (com `p_reason` antes dos opcionais) | RPC transacional |
| I3 | RLS: `authenticated` sem acesso a `generation_events` e `ai_model_pricing` | Segurança |
| I4 | `resolveAiCost` real com seeds → `pricing_table` com uuid; seed só de imagem (gpt-image-2) persiste sem token texto (CHECK passa) | Seeds aplicadas |
| I5 | Views retornam linhas com eventos de campanha + VS + brand profile (dados reais/E2E) e **não duplicam delivery markers** | Views funcionam |
| I6 | `admin_get_metrics` (F28) continua respondendo com dados novos | Compat |

### Regressão (obrigatória)
- Pipeline (402/409/estorno), assinatura visual (F29.1.1), gates F32/F33/F34/F36, legal (F30), créditos (F24/F38) inalterados
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Custo real corrompido por chamada não instrumentada** (chamada nova esquecida) | Contrato de teste "cada processo relevante grava evento" (19-38); `AiCostTracker` como único caminho de escrita; callback `onCall` obrigatório nos serviços que chamam IA |
| **Custo do provider divergente do nosso cálculo / provider_reported fora da apuração** | Colunas separadas `provider_reported_cost_usd`/`estimated_cost_usd` (D3); valor contábil `accounting_cost_usd = COALESCE(provider_reported_cost_usd, estimated_cost_usd)` garante que o reportado **nunca some** da apuração (D3/D10); teste 48 |
| **Dupla contagem de custo/duração (delivery marker × call-level)** | Regra explícita D1/D6/D7: delivery marker grava custo/tokens NULL, só status + `duration_ms` (com `duration_is_pipeline: true`); views de custo somam **apenas call-level**; testes 24/45/I5 |
| **Quebra do `admin_get_metrics`/métricas operacionais (F28)** | `campaign_pipeline`/`visual_signature` mantidos como delivery markers; `duration_ms` do delivery preservado (D6); verificação I6 |
| **Tabela de preço desatualizada em produção** | Seeds + defaults em código (bootstrap); RPC `admin_set_ai_model_price` com versionamento e reason; `pricing_version` no evento permite auditar qual versão foi usada |
| **Falha de escrita de telemetria derruba geração** | `AiCostTracker.record` best-effort — nunca lança (D7); teste 12 |
| **Semântica de entrega misturada (campanha vs VS)** | D1 regra por domínio; testes 22 (campanha: mesmo run) e 31 (VS: novo run pós-falha) |
| **Usage ausente em alguns providers (Gemini/image)** | `not_available`/`fallback_static` preservam o evento com tokens; custo NULL não apaga a chamada (D4) |
| **Reconciliação frágil por falta de vínculo** | `visual_signature_id` + `campaign_id` como FKs; VS liga ao ledger via `metadata.credit_tx_id` (D10); migration garante os vínculos |
| **Escopo puxa UI admin** | Decisões do Q&A: pricing e reconciliação **sem página** nesta fase (D8/D10) — medir primeiro, exibir depois |
| **Caminho legado ainda chamado** | Verificado: UI usa apenas `generate-image`; legado só em testes. Fora de escopo (Realinhamento) |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Página admin de preços (`/admin/ai-model-pricing`)** | Fase curta futura, quando os dados mostrarem uso (decisão Q&A D8) |
| **Tabela `operation_runs`** | Coluna + views bastam (D1); tabela só com lifecycle explícito futuro |
| **Tela de reconciliação / dashboard de custos** | Views/RPCs estáveis primeiro; UI nasce depois (decisão Q&A D10) |
| **Cobrança dinâmica / ajuste de preço de crédito / margem mínima** | F39 (Stripe) — a 38.1 só mede e reconcilia |
| **Tema (`theme_id`)** | Coluna preparada; instrumentação quando temas existirem |
| **Deprecação formal de `/api/campaign/generate` (legado)** | Fora de escopo (só testes o usam); deprecação em fase própria |
| **Remoção do `MetricsWriter`** | Mantido para debug local; deixa de ser fonte de custo |
| **Alteração de `reserve_credit`/`credit_transactions` (F24)** | Ledger financeiro intacto; reconciliação é por leitura (views) |
| **Evoluir `admin_get_metrics` (F28)** | Mantido compatível; novas métricas em views próprias (D10) |
| **i18n** | Produto PT-BR |
| **Grularidade de preço por loja/plano** | Preço é global; granularidade é decisão futura (F39) |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Semântica `operation_run_id` (UUID, entrega econômica) / `trace_id` (TEXT, técnico) / `generation_event` (chamada); regras por domínio (campanha até aprovação; VS por geração); **anti-dupla-contagem: delivery marker sem custo/tokens**
- [ ] D2 — Novas colunas em `generation_events` (`operation_run_id` **UUID**) + índices + retenção 90d inalterada
- [ ] D3 — `provider_reported_cost_usd` + `estimated_cost_usd` separados + `accounting_cost_usd = COALESCE(...)` derivado nas views + regra mental
- [ ] D4 — `cost_source` enum de 5 valores + mapeamento das sources atuais; evento existe mesmo sem custo
- [ ] D5 — `generation_type` granular + inventário de chamadas (brand profile e review/validation agora cobertas)
- [ ] D6 — `duration_ms` por chamada; duração da entrega via views (soma call-level); delivery marker preserva métricas F28 **sem custo/tokens**
- [ ] D7 — `AiCostTracker` (camada única, best-effort) + callback `onCall`; substitui inserts inline; delivery marker com `cost: null`
- [ ] D8 — `ai_model_pricing` versionada (preços nullable + CHECK ao menos uma dimensão) + seeds verificáveis (source_url/effective_from) + RPC `admin_set_ai_model_price` (`p_reason` antes dos opcionais) + GET/PUT admin, **sem página**
- [ ] D9 — `resolveAiCost` por fonte (`provider_reported → pricing_table → fallback_static → not_available`); corrige gemini-3.1-flash-lite e gpt-image-2
- [ ] D10 — Views de apuração + `admin_cost_vs_credits` (reconciliação) + RPC `admin_get_ai_costs`, **sem UI**
- [ ] D11 — Instrumentação por serviço (mapeamento de arquivos)
- [ ] D12 — Extensibilidade: `provider`/`model` TEXT sem CHECK fechado; novo modelo/provider via `ai_model_pricing` + adapter de usage (sem migration); sem preço → `fallback_static`/`not_available`; só novo tipo de etapa expande `generation_type`

### Migration
- [ ] Novas colunas `generation_events` (operation_run_id **UUID**, operation_run_type, visual_signature_id, theme_id, cached_input_tokens, image_tokens, provider_reported_cost_usd, cost_source, pricing_version)
- [ ] CHECK `cost_source` (5 valores) + CHECK `generation_type` expandido
- [ ] Índices novos (operation_run_id, visual_signature_id, cost_source, provider+model)
- [ ] Tabela `ai_model_pricing` (preços nullable + CHECK `at_least_one_price`) + seeds com `source_url`/`effective_from` (incl. gemini-3.1-flash-lite, gpt-image-2) + RLS service_role
- [ ] RPC `admin_set_ai_model_price` (transacional, versiona effective_from/until, `p_reason` obrigatório **antes dos opcionais**)
- [ ] Views `admin_ai_*` + `admin_cost_vs_credits` + RPC `admin_get_ai_costs`
- [ ] Revert commands documentados

### Service / rotas
- [ ] `resolveAiCost` cobre os 5 `cost_source`; `not_available` preserva tokens com custo NULL
- [ ] `AiCostTracker.record` nunca lança; `startRun` gera run (UUID) + trace; delivery marker com custo/tokens NULL (anti-dupla-contagem)
- [ ] Pipeline: copy com usage real (furo 1), `metadata.totalCost` correto (furo 2), `attempt_number` granular (furo 6), `duration_ms` por chamada (furo 7)
- [ ] `campaign_input_validation` e `campaign_image_review` registrados (furo 4)
- [ ] VS: eventos com custo/tokens (furo 5) + `visual_signature_id`; nova tentativa pós-falha = novo run
- [ ] Brand profile: `brand_profile_vision`/`_text`/delivery registrados
- [ ] `generation-events.ts` delega ao tracker sem quebrar callers/tests

### Admin / APIs
- [ ] `GET`/`PUT /api/admin/ai-model-pricing` (requireAdmin + zod + RPC), versionamento real
- [ ] `GET /api/admin/ai-costs` com filtros
- [ ] RLS: `authenticated` sem acesso a `generation_events` e `ai_model_pricing`

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### Verificação SQL/integrada (I1–I6)
- [ ] I1 — Migration aplicada em banco real
- [ ] I2 — RPC de pricing versiona (fecha + abre)
- [ ] I3 — RLS sem acesso authenticated
- [ ] I4 — `resolveAiCost` com seeds → `pricing_table`
- [ ] I5 — Views com dados reais (campanha + VS + brand profile)
- [ ] I6 — `admin_get_metrics` (F28) segue respondendo

### UAT Local
- [ ] Gerar campanha → eventos `campaign_input_validation`/`campaign_copy`/`campaign_image`/`campaign_image_review` com tokens e custo, agrupados pelo mesmo `operation_run_id`; delivery `campaign_pipeline` com custo NULL (sem dupla contagem)
- [ ] Rejeitar/recompor campanha (F37/quality gate) → novas tentativas no **mesmo** run
- [ ] Gerar VS → eventos `visual_signature_image`/`visual_signature_validation` com custo; falha técnica → novo run na nova tentativa
- [ ] Gerar brand profile → eventos `brand_profile_*` com custo
- [ ] Query `admin_cost_vs_credits`: campanha debitou 1 crédito, custo em USD, etapas mais caras, regenerações; valor contábil = `COALESCE(provider_reported_cost_usd, estimated_cost_usd)`
- [ ] `PUT /api/admin/ai-model-pricing` altera preço → eventos novos usam `pricing_version` da nova linha
- [ ] Regressão: métricas admin (F28), saldo/extrato, freemium, assinatura visual, legal

---

*Documento criado: 2026-08-08*
*Baseado na exploração do estado atual de contabilidade de IA (inventário de 9 call sites, 7 com uso real de IA), nos furos verificados em código (copy sem usage, totalCost errado, revisão/validação sem evento, VS sem custo, brand profile sem evento, attempt/duration granulares) e nas considerações consolidadas com o agente de planejamento. Decisões do Q&A: `ai_model_pricing` com RPC/API admin sem página; `operation_run_id` como coluna + views (sem tabela `operation_runs`); `provider_reported_cost_usd` e `estimated_cost_usd` como colunas separadas; reconciliação só via views/RPCs (sem tela). Fase focada em medir com precisão e reconciliar — sem cobrança dinâmica.*

**Revisão aplicada (2026-08-08):** 6 ajustes incorporados — (1) `ai_model_pricing` com preços nullable + CHECK `at_least_one_price` (modelos só de imagem não quebram seed nem forçam 0); (2) RPC `admin_set_ai_model_price` com `p_reason` **antes** dos parâmetros com DEFAULT (assinatura válida em Postgres); (3) **anti-dupla-contagem** explícita — delivery marker grava custo/tokens NULL, views de custo somam apenas call-level; (4) valor contábil `accounting_cost_usd = COALESCE(provider_reported_cost_usd, estimated_cost_usd)` nas views/RPCs (provider_reported nunca some da apuração); (5) `operation_run_id` passa a ser **UUID** (trace_id permanece TEXT); (6) seeds tratados como bootstrap verificável (`source_url`/`source_note`/`effective_from`) com teste de estrutura, não de canonização de preço.

**Revisão 2 (2026-08-08):** 3 ajustes finais — (a) teste 30 da VS passa a validar delivery com custo/tokens NULL e custo = soma de `visual_signature_image` + `visual_signature_validation` (consistente com D1/D6); (b) quadro de estado usa o nome completo `COALESCE(provider_reported_cost_usd, estimated_cost_usd)`; (c) nova **D12 — Extensibilidade** para novos provedores/modelos: `provider`/`model` TEXT sem CHECK fechado, novo modelo/provider entra via `ai_model_pricing` + adapter de usage (sem migration), sem preço → `fallback_static`/`not_available`, só novo tipo de etapa expande `generation_type`.

*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
