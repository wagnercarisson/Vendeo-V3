## Context

A F23 entregou `TextProvider` + `CopyDirectorService` — IA de copy persuasiva funcional e testável. A F24 entregou `CreditService` + ledger imutável com SQL functions atômicas — a camada financeira do produto. Ambas são fundações prontas, mas não integradas ao pipeline real de geração.

**Estado atual (pós-F24):**
- Copy determinístico: `buildCaption()` + `buildHashtags()` concatenam nome + descrição + CTA
- Sem saldo check, reserva ou estorno — cada geração custa dinheiro real sem proteção financeira
- Sem rate limit — usuário pode gerar 100 campanhas em 1 minuto
- `mandatoryArtworkText` não existe no formulário, schema ou pipeline
- Onboarding não concede créditos iniciais
- Copy Director + Image Director não estão integrados ao `POST /api/campaign/generate-image`

**Esta fase resolve todos esses gaps de uma vez**, integrando Copy Director, créditos, rate limit e mandatoryArtworkText no pipeline de geração.

## Goals / Non-Goals

**Goals:**
- Pipeline financeiro: `COST_PER_GENERATION = 1`, saldo check (402), reserva, confirmação e estorno na rota `generate-image`
- Copy Director integrado: `CopyDirectorService.generateCopy()` substitui `buildCaption()`/`buildHashtags()` determinísticos
- Pipeline paralelo: Copy Director ∥ Image Director em `Promise.all` (copy não influencia arte)
- Rate limit: 10 gerações/hora e 30/dia por loja (429 antes de qualquer chamada de IA)
- `mandatoryArtworkText`: campo opcional no formulário → schema → input snapshot → Image Director brief (excluído do Copy Director)
- Onboarding grant: 5 créditos na criação da loja via RPC transacional
- Retry seletivo: Copy Director com fallback Gemini (até 2 tentativas); Image Director sem retry externo
- Compatibilidade retroativa: campanhas v1.3/v1.4 sem `title` continuam funcionando
- 34+ testes validando fluxo completo, 402, 429, estorno, retry, idempotência, onboarding, mandatoryArtworkText

**Non-Goals:**
- Entrega parcial (`partial_ready` com só arte ou só copy) — feature futura
- UI de créditos na topbar ou `/conta` (F27)
- Stripe Checkout / Webhook / `credit_orders` (F26)
- Observabilidade estruturada (logging com campaignId, phase, duration_ms) — F28
- Gemini como provider primário de texto — entra apenas como fallback de retry
- Provider Anthropic — fora do escopo da v1.5
- Campanhas multi-formato (Stories, Landscape)
- Reuso de asset entre tentativas de retry

## Decisions

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

**Motivo:** Rate limit, saldo check e validação de input não devem ser transmitidos como eventos NDJSON — são condições de barreira que produzem HTTP status code padrão (429, 402, 409). A reserva de crédito precisa do `campaignId`, que só existe após criar a campanha — então a reserva acontece entre o pré-stream e o paralelo.

### D2 — Copy Director ∥ Image Director em paralelo

```
Promise.all([
  CopyDirectorService.generateCopy(briefCopy),     ← não vê arte
  ImageGenerationService.generateImage(briefVisual) ← não vê copy
])
```

**Justificativa:** O copy (texto) **não influencia** a arte (imagem). O Image Director recebe `CampaignBrief` com dados do produto e identidade visual — não o resultado do Copy Director. Portanto, os dois ramos são independentes e podem executar simultaneamente, cortando a latência total pela metade.

**Implicações:**
- Se um ramo falha e o outro não → campanha inteira é erro (com estorno)
- Se ambos falham → estorno único (idempotente)
- `AbortController` aborta o ramo remanescente quando o outro falha

### D3 — Rate limit + saldo check antes de qualquer chamada de IA

O invariante da milestone é: **"Controle de custos precede geração"**. Isso inclui o `InputValidationService` — se ele usa IA paga, o bloqueio por saldo insuficiente ou rate limit precisa vir antes.

```
Ordem correta:
  [rate limit guard] → [registra tentativa] → [saldo check] → [InputValidationService] → [criar campanha] → [reservar] → [IA paralela]
```

**Registro imediato da tentativa:** O INSERT em `generation_rate_events` acontece logo após o guard, com `campaign_id = null`, porque a campanha ainda não existe. Isso garante que o `InputValidationService` (que também consome IA) já está coberto pela janela de rate limit.

**Reserva com race condition:** Duas requisições simultâneas podem passar no `getBalance` e só uma vencer no `reserve_credit`. Se `reserveCredit` levantar `saldo_insuficiente`, a rota retorna **402**, não 500.

### D4 — `generation_rate_events`: tabela própria para rate limit

O rate limit usa tabela própria, não sobrecarrega `generation_events` (que tem CHECK constraint específica para visual signature/brand profile).

```sql
CREATE TABLE IF NOT EXISTS public.generation_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'generation_attempt',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_rate_events_lookup
  ON public.generation_rate_events (store_id, event_type, created_at DESC);
```

### D5 — `mandatoryArtworkText`: campo visual, não de copy

| Aspecto | Decisão |
|---------|---------|
| **UI** | Campo opcional no formulário de campanha, abaixo do CTA |
| **Schema** | `mandatoryArtworkText?: string` no `GenerateImageRequestSchema` |
| **Input snapshot** | Guardado em `inputSnapshot.mandatoryArtworkText` |
| **Image Director** | Recebe no prompt/brief visual: *"Incluir obrigatoriamente na arte..."* |
| **Copy Director** | **NÃO recebe** — excluído do `CopyDirectorInput` |
| **publication_copy_snapshot** | **NÃO entra** — é contrato visual, não de copy |

**Motivo da exclusão do Copy Director:** texto obrigatório na arte (ex.: "Imagens meramente ilustrativas") não é copy persuasiva. Se incluído no Copy Director, a IA pode repeti-lo na legenda, poluindo a mensagem comercial.

### D6 — `COST_PER_GENERATION = 1` (fixo na v1.5)

```typescript
export const COST_PER_GENERATION = 1;
```

Definido em `src/lib/image-generation/config.ts`. Fixo para todas as gerações na v1.5. Futuro: variável por complexidade.

### D7 — Retry seletivo com fallback de provider (Copy Director)

Copy Director: retry explícito de até **2 tentativas** com fallback de provider na segunda tentativa:

| Tentativa | Provider | Quando |
|-----------|----------|--------|
| 1ª | Primário (OpenAI GPT-4o, configurado por `TEXT_PROVIDER`) | Sempre |
| 2ª | Alternativo (Gemini, ativado por `TEXT_FALLBACK_PROVIDER`) | Se 1ª falhou com erro retryable |

**Classificação de erro para retry:**

| Classificação | Erros | Ação |
|--------------|-------|------|
| **Retryable** | timeout, rate limit do provider, erro 5xx, `MalformedResponseError`, falha de rede | Retry com fallback Gemini |
| **Não retryable** | saldo insuficiente, input inválido (Zod), safety/content policy block | Falha imediata |

**Image Director: sem retry externo.** O `ImageGenerationService.generateImage()` já possui retry interno de provider/review. Adicionar retry externo multiplicaria custo sem benefício.

**AbortSignal no ramo remanescente:** Quando um ramo falha, o `AbortController` aborta o ramo que ainda está rodando. A F25 inclui a propagação do `signal` do `CopyDirectorService` para `TextProvider.generateText()`.

### D8 — Campanha completa ou nada

| Estado final | Significa | Cobrança |
|-------------|-----------|----------|
| `ready` | Copy OK + Arte OK + Persistência OK | 1 crédito |
| `error` | Qualquer falha após tentativas de retry | 0 crédito (estorno) |

Entrega parcial (`partial_ready`) está **fora do escopo** da v1.5.

### D9 — Onboarding grant: 5 créditos na criação da loja

**Opção A (recomendada) — RPC transacional:**
Criar SQL function `create_store_with_initial_grant()` que executa INSERT store + `grant_credits` na mesma transação.

```
[1] Valida input + requireUser
[2] Chama RPC create_store_with_initial_grant(...)
    ├── INSERT store
    ├── grant_credits(storeId, 5, 'onboarding', onboarding_${storeId})
    └── Se qualquer passo falhar → ROLLBACK
[3] Retorna store data (201)
```

**Opção B (fallback):** Se a RPC não for viável, o handler faz INSERT store → grant → se grant falhar, DELETE store.

**Idempotência:** `onboarding_${storeId}` garante que mesmo se a rota for chamada duas vezes para a mesma loja, o grant não duplica.

### D10 — `publication_copy_snapshot` compatível retroativo

```typescript
{
  title?: string;       // NOVO: opcional. Presente em campanhas F25+.
  caption: string;      // existente
  hashtags: string[];   // existente
  cta_post: string;     // existente
}
```

- Campanhas v1.3/v1.4 → snapshot sem `title` (funciona como antes)
- Campanhas F25+ → snapshot com `title` (vindo do Copy Director)
- `getEffectivePublicationCopy()` inclui `title` tratando como opcional
- `validatePublicationCopy()` aceita `title?` sem exigir
- `PATCH /api/campaign/[id]/publication-copy` schema aceita `title?`

## Mapa de Rotas

| Rota | Mudança |
|------|---------|
| `POST /api/campaign/generate-image` | Adiciona rate limit guard, saldo check, reserva, Copy Director, paralelismo, retry seletivo, estorno, `mandatoryArtworkText` no schema |
| `POST /api/store` | Adiciona `grantCredits(5, "onboarding")` após criação da loja |

## Estrutura de Código

### Arquivos modificados
- `src/app/api/campaign/generate-image/route.ts` — Fluxo reestruturado em 3 zonas
- `src/app/api/store/route.ts` — Grant de créditos após INSERT store
- `src/lib/image-generation/config.ts` — Adiciona `COST_PER_GENERATION = 1`
- `src/lib/campaign/image-processor.ts` — `buildPublicationCopySnapshot` aceita `title?` ou substituído pelo Copy Director
- `src/lib/campaign/display.ts` — `getEffectivePublicationCopy()` inclui `title?`
- `src/lib/campaign/publication-copy.ts` — `validatePublicationCopy()` aceita `title?`
- `src/lib/copy/copy-director-service.ts` — `generateCopy()` propaga AbortSignal

### Arquivos novos
- `src/lib/text-provider/gemini.ts` — `GeminiTextProvider` (fallback de retry)
- `src/lib/rate-limit/types.ts` — `RateLimitConfig`, `GenerationRateEvent`
- `src/lib/rate-limit/rate-limit.ts` — `checkRateLimit(storeId)`, `recordGenerationAttempt(storeId, userId, campaignId?)`
- `src/lib/rate-limit/__tests__/rate-limit.test.ts` — 5+ testes
- `src/components/campaign/mandatory-artwork-field.tsx` — Campo opcional no formulário
- `supabase/migrations/20260717000001_create_generation_rate_events.sql` — DDL + índices + RLS

## Configuração Gemini (fallback de texto)

| Variável | Obrigatória? | Padrão | Descrição |
|----------|:---:|--------|-----------|
| `TEXT_FALLBACK_PROVIDER` | Não | (vazio = desligado) | `gemini` para ativar fallback |
| `GEMINI_API_KEY` | Se fallback ativo | — | Chave de API Google Gemini |
| `GEMINI_TEXT_MODEL` | Não | `gemini-3.1-flash-lite` | Modelo usado no fallback de texto |

## Contratos de Integração

### Mapper: `CampaignBrief → CopyDirectorInput`

```typescript
function mapBriefToCopyDirectorInput(
  brief: CampaignBrief,
  input: CampaignInput,
): CopyDirectorInput {
  const store = brief.store;
  const brandProfile = brief.brandProfile;
  return {
    productName: input.productName,
    description: input.description,
    offer: buildOfferText(input),
    storeName: store?.name ?? '',
    segment: store?.segment ?? '',
    toneOfVoice: store?.toneOfVoice,
    positioning: store?.positioning,
    shortDescription: store?.shortDescription,
    slogan: store?.slogan,
    brandPersonality: brandProfile?.brand_personality,
    campaignGuidelines: brandProfile?.campaign_guidelines ?? input.campaignDetails,
  };
}
```

### `mandatoryArtworkText` no Image Director

```typescript
const briefComMandatoryArtwork = {
  ...brief,
  campaignInput: {
    ...brief.campaignInput,
    mandatoryArtworkText: parsed.data.mandatoryArtworkText,
  },
};
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Estorno em race condition** — dois ramos tentam estornar a mesma reserva | Idempotência com `refund_${txId}`. Segunda chamada retorna refund existente |
| **Custo de IA sem retorno** — Copy Director pago mesmo em falha | Retry seletivo reduz falhas. Rate limit + saldo check previnem abuso |
| **Paralelismo aumenta complexidade de erro** — estado "um ramo falhou, outro está rodando" | `AbortController` no ramo bem-sucedido quando o outro falha. Custo de IA perdido é aceito como operacional |
| **`mandatoryArtworkText` esquecido no Image Director** | Teste #26 valida propagação. Code review verifica `briefComMandatoryArtwork` |
| **Onboarding grant falha e loja é criada sem saldo** | D9: grant falha → criação da loja falha (transação atômica) |
| **Rate limit consulta lenta** | Índice composto `(store_id, event_type, created_at DESC)`. Volume baixo (dezenas a centenas por usuário/dia) |
| **Retry aumenta latência** — 2 tentativas de 500ms + 1s = até 1.5s extras | Aceitável para público controlado (3-5 usuários) |
| **Resposta malformada da IA não acionava retry** — `CopyDirectorService.parseResult()` usava fallback determinístico silencioso, sem lançar erro. Retry Gemini nunca era exercitado por esse caminho | F25 modifica `parseResult()`: remove fallback determinístico da cadeia de parse; JSON e regex são os únicos tiers. Se ambos falharem, lança `MalformedResponseError`. O pipeline captura como retryable e tenta Gemini |
| **publication_copy_snapshot com `title` quebra UI legada** | `title` é opcional. UI trata ausência. Testes de compatibilidade |
