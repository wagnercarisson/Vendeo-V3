# Phase 25: Pipeline de Geração Paralelo — Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-25-integracao-transacional-pipeline/`

<domain>
## Phase Boundary

Integrar as fundações das fases anteriores (TextProvider + CopyDirector da F23, CreditService da F24) no pipeline real `POST /api/campaign/generate-image`. Adicionar rate limit, saldo check/reserva/estorno, execução paralela Copy Director ∥ Image Director, retry seletivo com fallback Gemini, campo `mandatoryArtworkText`, e onboarding grant de 5 créditos.

**Estado atual (pós-F24):**
- Copy determinístico: `buildCaption()` + `buildHashtags()` concatenam nome + descrição + CTA em `generate-image/route.ts`
- Sem saldo check, reserva ou estorno — cada geração custa dinheiro real sem proteção financeira
- Sem rate limit — usuário pode gerar N campanhas em 1 minuto
- `mandatoryArtworkText` não existe no formulário, schema ou pipeline
- Onboarding não concede créditos iniciais
- Copy Director + Image Director não estão integrados ao pipeline de geração
- `CopyDirectorService.parseResult()` usa fallback determinístico (3 tiers: JSON → regex → raw)
- `PublicationCopySnapshot` sem `title`
- `getEffectivePublicationCopy()` e `validatePublicationCopy()` sem campo `title`

**Dependências:** F23 (TextProvider + CopyDirectorService), F24 (CreditService + credit_balances + credit_transactions + SQL functions)

</domain>

<decisions>
## Implementation Decisions

### D1 — Pipeline transacional com 3 zonas

O pipeline se divide em três zonas com responsabilidades distintas:

```
PRÉ-STREAM (síncrono, fora do ReadableStream):
  parse + auth + ownership + rate limit + saldo check + input validation + criar campanha + reservar crédito
  → Response HTTP direto (400, 401, 403, 429, 402, 409, 500)
  → Nunca chama IA paga se alguma condição falhar

PARALELO (dentro do ReadableStream):
  Copy Director ∥ Image Director com retry seletivo
  → NDJSON events de progresso

PÓS-PARALELO (dentro do ReadableStream):
  Merge → transcode → upload → updateReady → confirma crédito
  → NDJSON result ou error com estorno
```

### D2 — Copy Director ∥ Image Director em paralelo

`Promise.all` com dois ramos independentes — copy não influencia arte. Se um ramo falha, `AbortController` aborta o remanescente. Campanha completa ou nada (D8).

### D3 — Rate limit + saldo check antes de qualquer chamada de IA

Ordem: rate limit guard → registra tentativa → saldo check → InputValidationService → criar campanha → reservar → IA paralela.

### D4 — `generation_rate_events`: tabela própria para rate limit

Tabela dedicada com colunas `store_id`, `user_id`, `campaign_id?`, `event_type`, `metadata`, `created_at`. Índice composto `(store_id, event_type, created_at DESC)`. INSERT via `supabaseAdmin` (service role).

### D5 — `mandatoryArtworkText`: campo visual, não de copy

| Aspecto | Decisão |
|---------|---------|
| **UI** | Campo opcional no formulário de campanha, abaixo do CTA |
| **Schema** | `mandatoryArtworkText?: string` no `GenerateImageRequestSchema` |
| **Input snapshot** | Guardado em `inputSnapshot.mandatoryArtworkText` |
| **Image Director** | Recebe no brief visual: *"Incluir obrigatoriamente na arte..."* |
| **Copy Director** | **NÃO recebe** — excluído do `CopyDirectorInput` |
| **publication_copy_snapshot** | **NÃO entra** — é contrato visual, não de copy |

### D6 — `COST_PER_GENERATION = 1` (fixo na v1.5)

Definido em `src/lib/image-generation/config.ts`. Fixo para todas as gerações.

### D7 — Retry seletivo com fallback Gemini (Copy Director)

| Tentativa | Provider | Quando |
|-----------|----------|--------|
| 1ª | Primário (OpenAI GPT-4o) | Sempre |
| 2ª | Alternativo (Gemini) | Se 1ª falhou com erro retryable |

Erros retryable: timeout, rate limit do provider, 5xx, `MalformedResponseError`, falha de rede. Não retryable: ZodError, SafetyBlockError, InputConflictError, AuthConfigError, PayloadTooLargeError.

### D8 — Campanha completa ou nada

`ready` = Copy OK + Arte OK + Persistência OK → 1 crédito. `error` = qualquer falha → 0 crédito (estorno).

### D9 — Onboarding grant: 5 créditos na criação da loja

RPC transacional `create_store_with_initial_grant()` que executa INSERT store + `grant_credits` na mesma transação. Idempotência com chave `onboarding_${storeId}`.

### D10 — `publication_copy_snapshot` compatível retroativo

`title?: string` opcional. Campanhas v1.3/v1.4 sem `title` funcionam como antes. Campanhas F25+ com `title` vindo do Copy Director.

### D11 — `parseResult` em 2 tiers (JSON → regex), sem fallback determinístico

Remove o `DETERMINISTIC_FALLBACK` do `parseResult()` para que respostas malformadas da IA acionem o retry Gemini em vez de publicar copy de baixa qualidade. Lança `MalformedResponseError` se ambos falharem.

### D12 — `isRetryableError` para classificação de erros

Função que classifica erros como retryable ou não retryable, usada pelo pipeline para decidir se deve tentar fallback Gemini.

### D13 — Classes de erro em `src/lib/copy/errors.ts`

`MalformedResponseError`, `ProviderRateLimitError`, `Provider5xxError`, `NetworkError`, `SafetyBlockError`, `AuthConfigError`, `PayloadTooLargeError`.

### the agent's Discretion
- Estrutura exata dos testes (quantidade, cenários) desde que 34+ testes
- Implementação do mock da IA para testes sem chamadas HTTP
- Ordem exata das tarefas dentro de cada plano
- Detalhes do `InputValidationService` — se ele usa IA paga, a ordem rate limit guard → saldo check → InputValidationService deve ser respeitada

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline Atual (será modificado)
- `src/app/api/campaign/generate-image/route.ts` — Fluxo atual sequencial (427 linhas, referência para reestruturação em 3 zonas)

### Copy Director (F23)
- `src/lib/copy/copy-director-service.ts` — CopyDirectorService com parseResult 3 tiers (será modificado)
- `openspec/changes/fase-23-text-provider-copy-director/design.md` — D1-D10 do Copy Director
- `openspec/changes/fase-23-text-provider-copy-director/specs/copy-director/spec.md` — Specs do Copy Director

### TextProvider (F23)
- `src/lib/text-provider/types.ts` — TextProvider interface
- `src/lib/text-provider/openai.ts` — OpenAITextProvider pattern (paralelo ao Gemini)
- `src/lib/text-provider/factory.ts` — Factory pattern (será estendido)

### CreditService (F24)
- `src/lib/credit/credit-service.ts` — CreditService com 6 métodos
- `src/lib/credit/types.ts` — CreditOperationOptions
- `openspec/changes/fase-24-wallet-ledger-idempotencia/design.md` — Invariantes financeiros, SQL functions
- `openspec/changes/fase-24-wallet-ledger-idempotencia/specs/credit-sql-functions/spec.md` — grant_credits, reserve_credit, refund_credit

### Campaign Types (modificado)
- `src/lib/campaign/types.ts` — CampaignRecord, PublicationCopySnapshot atual
- `src/lib/campaign/display.ts` — getEffectivePublicationCopy (será modificado)
- `src/lib/campaign/publication-copy.ts` — validatePublicationCopy (será modificado)
- `src/lib/campaign/image-processor.ts` — buildPublicationCopySnapshot (será substituído pelo Copy Director)

### Store Route (modificado)
- `src/app/api/store/route.ts` — POST handler atual (será alterado para onboarding grant)

### Config Pattern
- `src/lib/image-generation/config.ts` — IMAGE_PROVIDER env var pattern (COST_PER_GENERATION será adicionado)

### Existing Migration Pattern
- `supabase/migrations/` — Existing migration naming, RLS, trigger patterns

### OpenSpec Source of Truth (F25)
- `openspec/changes/fase-25-integracao-transacional-pipeline/proposal.md` — Why, What, Capabilities, Impact
- `openspec/changes/fase-25-integracao-transacional-pipeline/design.md` — 10 design decisions (D1-D10), goals/non-goals, risks, código, rota map
- `openspec/changes/fase-25-integracao-transacional-pipeline/tasks.md` — 11 task groups, 96 steps (34+ testes)
- `openspec/changes/fase-25-integracao-transacional-pipeline/specs/transactional-pipeline/spec.md` — Pipeline 3 zonas specs
- `openspec/changes/fase-25-integracao-transacional-pipeline/specs/rate-limit/spec.md` — Rate limit specs
- `openspec/changes/fase-25-integracao-transacional-pipeline/specs/copy-director/spec.md` — Copy Director modificações
- `openspec/changes/fase-25-integracao-transacional-pipeline/specs/mandatory-artwork-text/spec.md` — mandatoryArtworkText specs
- `openspec/changes/fase-25-integracao-transacional-pipeline/specs/onboarding-grant/spec.md` — Onboarding grant specs
- `openspec/changes/fase-25-integracao-transacional-pipeline/specs/campaign-display-contract/spec.md` — Display contract evolução
- `openspec/changes/fase-25-integracao-transacional-pipeline/specs/publication-copy-validation/spec.md` — Publication copy validation evolução

### Project Requirements
- `.planning/REQUIREMENTS.md` — PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06 mapped to Phase 25

</canonical_refs>

<specifics>
## Specific Ideas

- Pipeline reestruturado em 3 zonas: PRÉ-STREAM (síncrono, HTTP direto), PARALELO (NDJSON stream), PÓS-PARALELO (NDJSON)
- Rate limit guard retorna 429 antes de qualquer operação paga — registro imediato da tentativa com `campaign_id = null`
- Saldo check retorna 402 Payment Required se saldo < COST_PER_GENERATION
- Reserva de crédito com `reserve_${campaignId}` — idempotente
- Estorno com `refund_${txId}` — idempotente, campanha erro + limpa storage
- Copy Director com retry Gemini: 1ª OpenAI, 2ª Gemini se retryable — propagação de AbortSignal
- `mandatoryArtworkText` opcional no schema, componente UI, InputSnapshot, Image Director — excluído do Copy Director e publication_copy_snapshot
- `mapBriefToCopyDirectorInput()` extrai CopyDirectorInput do CampaignBrief — `buildOfferText()` monta texto da oferta
- Onboarding grant via `create_store_with_initial_grant()` — RPC transacional, idempotente
- `title?` opcional no snapshot — compatibilidade retroativa v1.3/v1.4
- `GEMINI_MODEL` legado lido como fallback de `GEMINI_TEXT_MODEL`
- AbortController aborta ramo remanescente quando um ramo falha

</specifics>

<deferred>
## Deferred Ideas

- Entrega parcial (`partial_ready` com só arte ou só copy) — feature futura
- UI de créditos na topbar ou `/conta` (F27)
- Stripe Checkout / Webhook / `credit_orders` (F26)
- Observabilidade estruturada (logging com campaignId, phase, duration_ms) — F28
- Gemini como provider primário de texto — entra apenas como fallback de retry
- Provider Anthropic — fora do escopo da v1.5
- Campanhas multi-formato (Stories, Landscape)
- Reuso de asset entre tentativas de retry
- Cache de prompts / otimização de tokens

</deferred>

---

*Phase: 25-integracao-transacional-pipeline*
*Context gathered: 2026-07-17 via OpenSpec source of truth*
