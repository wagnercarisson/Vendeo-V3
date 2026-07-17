# Alinhamento Fase 25 — Integração Transacional do Pipeline (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director (fundação IA de texto)                 ✓
  ├── F24 — Wallet + Ledger + Idempotência (fundação financeira)                ✓
  ├── F25 — Integração Transacional do Pipeline                                 ← esta fase
  ├── F26 — Pagamento (Stripe Checkout + Webhook + credit_orders)
  ├── F27 — Conta + Saldo Visível (UI de créditos no app shell e /conta)
  ├── F28 — Observabilidade + Deploy + Operação
  └── F29 — Refinamento Visual + Experiência Publicável + Launch Readiness
```

A F23 entregou `TextProvider` + `CopyDirectorService` — IA de copy persuasiva funcional e testável. A F24 entregou `CreditService` + ledger imutável com SQL functions atômicas — a camada financeira do produto. Ambas são **fundações prontas, mas não integradas ao pipeline**.

A F25 é a **cola transacional** que conecta essas fundações no pipeline real de geração. Hoje:

- O copy ainda é determinístico (concatena nome + descrição + CTA) — `CopyDirectorService` nunca é chamado
- Não há saldo check, reserva de crédito ou estorno — cada geração custa dinheiro real sem proteção financeira
- Não há rate limit — um usuário pode gerar 100 campanhas em 1 minuto
- `mandatoryArtworkText` não existe no formulário, schema ou pipeline
- O onboarding não concede créditos iniciais — loja nasce sem saldo

**Esta fase resolve todos esses gaps de uma vez**, integrando Copy Director, créditos, rate limit e mandatoryArtworkText no `POST /api/campaign/generate-image`.

**Dependências:** F23 (CopyDirectorService, TextProvider) + F24 (CreditService, migrations de crédito). Ambas concluídas.

---

## Propósito

1. **Pipeline financeiro** — `COST_PER_GENERATION = 1`, saldo check (402), reserva, confirmação e estorno na rota `generate-image`
2. **Copy Director integrado** — `CopyDirectorService.generateCopy() + PublicationCopySnapshot` vindo do resultado da IA, substituindo `buildCaption()`/`buildHashtags()` determinísticos
3. **Pipeline paralelo** — Copy Director + Image Director executam em `Promise.all` (copy não influencia arte)
4. **Rate limit** — 10 gerações/hora e 30/dia por loja (equivalente ao usuário na relação 1:1 da v1.5), verificado antes de qualquer chamada de IA
5. **`mandatoryArtworkText`** — campo opcional no formulário que, quando preenchido, vira texto obrigatório na arte (exclusivo do Image Director)
6. **Onboarding grant** — 5 créditos gratuitos na criação da loja (`POST /api/store`)
7. **Retry seletivo com fallback Gemini** — Copy Director faz até 2 tentativas: 1ª com provider primário (OpenAI), 2ª com Gemini como fallback em erros retryable. Image Director usa apenas retry interno existente, sem retry externo da F25
8. **Compatibilidade retroativa** — campanhas v1.3/v1.4 sem `title` continuam funcionando

**Entrega verificável:**
- `POST /api/campaign/generate-image` com fluxo completo: rate limit → saldo check → reserva → Copy Director ∥ Image Director → merge → confirmação → ready
- Rate limit 10/h + 30/dia por loja → 429 HTTP antes de qualquer operação paga
- Saldo insuficiente → 402 Payment Required antes de qualquer operação paga
- Falha após reserva → `refundCredit` + `updateCampaignError`
- `mandatoryArtworkText` no formulário, schema, input snapshot e brief do Image Director — **excluído** do Copy Director
- Onboarding: 5 créditos concedidos na criação da loja
- `generation_rate_events` para controle de rate limit (tabela própria)
- 30+ testes (fluxo completo, 402, 429, estorno, retry, idempotência, onboarding, mandatoryArtworkText)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F24)

```
                                    ANTES (F24)                         DEPOIS (F25)
═══════════════════════════════════════════════════════════════════════════════════════════

Copy no pipeline:
  Geração                          buildCaption() + buildHashtags()    CopyDirectorService.generateCopy()
                                   (determinístico)                   (IA com fallback)
  publication_copy_snapshot        { caption, hashtags, cta_post }    { title?, caption, hashtags, cta_post }

Créditos no pipeline:
  Saldo check                      inexistente                        creditService.getBalance() → 402
  Reserva                          inexistente                        creditService.reserveCredit()
  Estorno                          inexistente                        creditService.refundCredit()
  COST_PER_GENERATION              inexistente                        1 crédito por geração

Rate limit:
  Controle                         inexistente                        10/h + 30/dia
  Tabela                           inexistente                        generation_rate_events
  HTTP status                      —                                  429

Pipeline:
  Execução                         sequencial: valida → IA → persist  paralelo: [Copy Director ∥ Image Director]
  Retry copy                       inexistente                        retry seletivo com fallback Gemini
  Retry imagem                     inexistente                        apenas retry interno (existente)

mandatoryArtworkText:
  UI                               inexistente                        campo opcional no formulário
  Schema                           inexistente                        GenerateImageRequestSchema
  Input snapshot                   inexistente                        guardado para auditoria
  Image Director                   inexistente                        recebe como instrução visual
  Copy Director                    —                                  EXPLICITAMENTE NÃO recebe

Onboarding:
  Grant inicial                    inexistente                        5 créditos (grant_credits)
  Idempotência                     —                                  onboarding_{storeId}

Geração paralela:
  Ramo copy                        —                                  CopyDirectorService.generateCopy()
  Ramo image                       ImageGenerationService             ImageGenerationService (inalterado)
  Merge                            —                                  publication_copy_snapshot = copy result
  Falha única → estorno            —                                  qualquer ramo → estorno + error
```

---

## Fluxo Detalhado

```
POST /api/campaign/generate-image — FLUXO PÓS-F25
═══════════════════════════════════════════════════════════════════════════════════════

PRÉ-STREAM (fora do ReadableStream):
──────────────────────────────────

  [1] Parse JSON body
  [2] Reject legacy identity fields (breaking guard)
  [3] Validate productImageDataUrl presence + size
  [4] Zod schema validation (GenerateImageRequestSchema)
      → inclui mandatoryArtworkText (optional)
  [5] Auth: requireSameOrigin + requireApiUser
  [6] Ownership: requireOwnership(storeId, userId)
  
  [7] RATE LIMIT GUARD ← NOVO
      └── Consulta generation_rate_events: COUNT(*) WHERE store_id = ?
          AND created_at > NOW() - INTERVAL '1 hour'
      └── Se >= 10 → 429 Too Many Requests (sem stream, sem IA)
      └── Mesma consulta para janela de 24h
      └── Se >= 30 → 429 Too Many Requests

  [8] REGISTRA TENTATIVA DE GERAÇÃO ← NOVO
      └── INSERT INTO generation_rate_events (store_id, user_id, campaign_id = null, event_type = 'generation_attempt')
      └── Acontece IMEDIATAMENTE após passar no guard, antes de qualquer operação paga
      └── campaign_id = null porque a campanha ainda não existe
      └── O registro permanece mesmo se a geração falhar (já consumiu a vaga na janela)

  [9] SALDO CHECK ← NOVO
      └── creditService.getBalance(storeId) → balance
      └── Se balance < COST_PER_GENERATION (1) → 402 Payment Required

  [10] Resolve store identity + buildCampaignBrief
  [11] InputValidationService (productImageCheck)
       → 409 se conflict/low-confidence
       → SEGURO: rate limit registrado + saldo check já executaram

  [12] Create campaign record (status = 'generating')
       → campaignId, storagePath
  
  [13] RESERVA DE CRÉDITO ← NOVO
       └── creditService.reserveCredit(storeId, 1, {
             campaignId,
             idempotencyKey: `reserve_${campaignId}`
           })
       └── Se saldo_insuficiente (race condition: duas requisições passaram no getBalance) → 402 Payment Required
       └── Se outro erro → 500

DENTRO DO STREAM (ReadableStream):
───────────────────────────────────

  [14] RAMO PARALELO (Promise.all) ← NOVO
       ┌──────────────────────────────────────────────────────────┐
       │  Promise.all([                                          │
       │    copyDirectorTask(),       ← RETRY SELETIVO           │
       │    imageGenerationTask()     ← sem retry externo        │
       │  ])                                                     │
       └──────────────────────────────────────────────────────────┘

       copyDirectorTask():
         providers = [primary, fallback]  ← fallback = Gemini (se configurado)
         for attempt = 1 to 2:
           try:
             provider = providers[attempt - 1]
             result = await copyDirector.generateCopy(mappedInput, {
               signal: abortController.signal,    ← aborta se o outro ramo falhar
               providerOverride: provider          ← 1ª=primário, 2ª=fallback
             })
             → { title, caption, hashtags[], cta_post }
             emit({ type: "phase", phase: "copy_done" })
             return result
           catch (err):
             if attempt < 2 AND isRetryable(err):
               emit({ type: "phase", phase: "copy_retry", attempt })
               await delay(500ms * attempt)
               continue
             throw err  → falha do ramo
         throw err

       imageGenerationTask():
         try:
           result = await imageService.generateImage(
             briefComMandatoryArtworkText,  ← NOVO campo propagado
             onPhase, abortController.signal
           )
           emit({ type: "phase", phase: "image_done" })
         catch (err):
           throw err  → falha do ramo (sem retry externo — ImageGenerationService
                        já tem retry interno de provider/review)

  [15] Se QUALQUER ramo falhou → ERROR
       ├── updateCampaignError(campaignId, message)
       ├── creditService.refundCredit(txId, "generation_failed", {
       │     idempotencyKey: `refund_${txId}`
       │   })
       └── emit({ type: "error", ... })

  [16] Se AMBOS OK → MERGE
       ├── publicationCopySnapshot = copyDirectorResult
       │   (substitui buildCaption + buildHashtags)
       ├── transcodeToJpeg(buffer)
       ├── uploadCampaignImage(storeId, campaignId, jpeg)
       ├── updateCampaignReady(campaignId, {
       │     generationMetadata,
       │     renderSnapshot,
       │     publicationCopySnapshot  ← vindo do Copy Director
       │   })
       ├── Crédito: confirmado (reserva já é definitiva — no-op)
       └── emit({ type: "result", campaignId, campaignUrl })

  [17] Se persistência falha após merge → COMPENSAÇÃO
       ├── deleteCampaignImage(storagePath)  ← limpa storage
       ├── updateCampaignError(campaignId)
       ├── creditService.refundCredit(txId, "persistence_failed")
       └── emit({ type: "error", ... })
```

---

## Decisões de Arquitetura

### D1 — Pipeline transacional com 3 zonas

`DECIDIDO`

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

---

### D2 — Copy Director ∥ Image Director em paralelo

`DECIDIDO` (confirma D2 da milestone)

```
Promise.all([
  CopyDirectorService.generateCopy(briefCopy),   ← não vê arte
  ImageGenerationService.generateImage(briefVisual) ← não vê copy
])
```

**Justificativa:** O copy (texto) **não influencia** a arte (imagem). O Image Director recebe `CampaignBrief` com dados do produto e identidade visual — não o resultado do Copy Director. Portanto, os dois ramos são independentes e podem executar simultaneamente, cortando a latência total pela metade (o mais lento define o tempo).

**Implicações:**
- Se um ramo falha e o outro não → campanha inteira é erro (com estorno)
- Se ambos falham → estorno único (idempotente)
- A arquitetura permite no futuro: modo sequencial (se copy passar a influenciar a arte), ou "gerar copy hoje, revisar, gerar imagem amanhã"

---

### D3 — Rate limit + saldo check antes de qualquer chamada de IA

`DECIDIDO`

O invariante da milestone é: **"Controle de custos precede geração"** (I6 do alinhamento v1.5). Isso inclui o `InputValidationService` — se ele usa IA paga, o bloqueio por saldo insuficiente ou rate limit precisa vir antes.

```
Ordem correta (F25):
  [rate limit guard] → [registra tentativa] → [saldo check] → [InputValidationService] → [criar campanha] → [reservar] → [IA paralela]
                                                                                                                ↑
                                                                                                    reserva precisa de campaignId
```

**Registro imediato da tentativa:** O INSERT em `generation_rate_events` acontece logo após o guard, com `campaign_id = null`, porque a campanha ainda não existe. Isso garante que o `InputValidationService` (que também consome IA) já está coberto pela janela de rate limit. Se a geração chegar ao fim, o `campaign_id` pode ser atualizado opcionalmente — mas não é requisito.

**Reserva com race condition:** Duas requisições simultâneas podem passar no `getBalance` e só uma vencer no `reserve_credit`. Se `reserveCredit` levantar `saldo_insuficiente`, a rota retorna **402**, não 500. A segunda requisição perdeu a corrida, mas o saldo realmente não é mais suficiente — o comportamento é correto.

---

### D4 — `generation_rate_events`: tabela própria para rate limit

`DECIDIDO`

O rate limit usa tabela própria, não sobrecarrega `generation_events` (que tem CHECK constraint específica para visual signature/brand profile e será usada para telemetria na F28).

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

**Consulta de rate limit (janela deslizante SQL):**

```sql
-- Contagem na última hora (por loja)
SELECT COUNT(*) FROM public.generation_rate_events
WHERE store_id = $1
  AND event_type = 'generation_attempt'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Contagem nas últimas 24h (por loja)
SELECT COUNT(*) FROM public.generation_rate_events
WHERE store_id = $1
  AND event_type = 'generation_attempt'
  AND created_at > NOW() - INTERVAL '24 hours';
```

**INSERT** na tabela ocorre **imediatamente** após passar pelo guard, com `campaign_id = null`. Isso garante que o `InputValidationService` (que também consome IA) já está coberto pela janela de rate limit. Se a geração chegar ao fim, o `campaign_id` pode ser atualizado opcionalmente — mas não é requisito. Se a geração falhar, o evento permanece (já consumiu uma "vaga" na janela — consistente com rate limit de tentativas, não de sucessos).

---

### D5 — `mandatoryArtworkText`: campo visual, não de copy

`DECIDIDO` (confirma D7 da F23, agora implementado)

| Aspecto | Decisão |
|---------|---------|
| **UI** | Campo opcional no formulário de campanha, abaixo do CTA |
| **Schema** | `mandatoryArtworkText?: string` no `GenerateImageRequestSchema` |
| **Input snapshot** | Guardado em `inputSnapshot.mandatoryArtworkText` |
| **`CampaignBrief.campaignInput`** | Propagado como `mandatoryArtworkText` |
| **Image Director** | Recebe no prompt/brief visual: *"Incluir obrigatoriamente na arte, em tipografia mínima legível: [texto]"* |
| **Copy Director** | **NÃO recebe** — excluído do `CopyDirectorInput` |
| **publication_copy_snapshot** | **NÃO entra** — é contrato visual, não de copy |

**Motivo da exclusão do Copy Director:** texto obrigatório na arte (ex.: "Imagens meramente ilustrativas", "Consulte condições na loja") não é copy persuasiva. Se incluído no Copy Director, a IA pode repeti-lo na legenda, poluindo a mensagem comercial. A melhor instrução é a ausência do campo.

**Fronteira mantida desde a F23:**

```
Copy Director (texto persuasivo):      Image Director (arte visual):
  productName                            productName
  description                            description
  offer                                  offer
  storeName                              storeName
  segment                                segment
  toneOfVoice                            brandProfile (cores, estilo)
  positioning                            identity (logo, assinatura)
  slogan                                 mandatoryArtworkText ← SÓ AQUI
  brandPersonality
  campaignGuidelines
```

---

### D6 — `COST_PER_GENERATION = 1` (fixo na v1.5)

`DECIDIDO`

```typescript
export const COST_PER_GENERATION = 1;
```

- Fixo para todas as gerações na v1.5
- Definido em `src/lib/image-generation/config.ts` (constante existente de config)
- Futuro: variável por complexidade (com/sem IA de copy, com/sem retry, resolução, etc.)

---

### D7 — Retry seletivo com fallback de provider (Copy Director)

`DECIDIDO`

**Copy Director:** retry explícito de até **2 tentativas** com fallback de provider na segunda tentativa:

| Tentativa | Provider | Quando |
|-----------|----------|--------|
| 1ª | Primário (OpenAI GPT-4o, configurado por `TEXT_PROVIDER`) | Sempre |
| 2ª | Alternativo (Gemini, ativado por `TEXT_FALLBACK_PROVIDER`) | Se 1ª falhou com erro retryable |

**Classificação de erro para retry:**

| Classificação | Erros | Ação |
|--------------|-------|------|
| **Retryable** | timeout, rate limit do provider, erro 5xx da API, resposta malformada, falha temporária de rede, indisponibilidade do provider | Retry com fallback para Gemini na 2ª tentativa |
| **Não retryable** | saldo insuficiente, input inválido (Zod), safety/content policy block, auth/config missing, payload grande, erro de schema determinístico | Falha imediata do ramo (sem retry) |

**Gemini como fallback de texto:** A F25 inclui a implementação do `GeminiTextProvider` em `src/lib/text-provider/gemini.ts`, ativado apenas como fallback de retry (não como provider primário). O provider Gemini não precisa estar funcional para a F25 ser considerada completa — se a chave de API Gemini não estiver configurada, o segundo retry simplesmente não acontece (cai direto em estorno).

> **Modelos recomendados para Gemini (texto):**
> - Padrão custo/latência: `gemini-3.1-flash-lite`
> - Fallback com mais qualidade: `gemini-3.5-flash`
> - Usar nomes estáveis específicos em produção (não aliases `latest`)
> - Config via `GEMINI_TEXT_MODEL`

**Imagem — nota futura:** Se o Vendeo vier a usar Gemini como provider de imagem, o modelo correto hoje é `gemini-3.1-flash-image` (equilibra performance, inteligência, custo e latência). Isso **não** está no escopo da F25 — a imagem segue no `ImageGenerationService` atual, sem retry externo.

**Modelos Imagen — não usar:** Modelos Imagen (Google) estão deprecated e serão desligados em 17 de agosto de 2026. Não devem ser usados para nenhuma nova implementação. A Google recomenda Gemini (`gemini-3.1-flash-image`) como substituto para geração de imagem.

**Image Director:** **sem retry externo.** O `ImageGenerationService.generateImage()` já possui retry interno de provider/review (`image-generation-service.ts`). Adicionar retry externo em cima disso multiplicaria custo sem benefício. A F25 documenta que o retry interno existente é a fonte da verdade.

**AbortSignal no ramo remanescente:** Quando um ramo falha definitivamente, o `AbortController` aborta o ramo que ainda está rodando. O `CopyDirectorService.generateCopy()` precisa propagar o `signal` recebido para `TextProvider.generateText()` — hoje o `TextProvider` suporta `signal` na interface, mas o `CopyDirectorService` não o repassa. A F25 inclui essa propagação.

**Comportamento:**
- Copy falha retryable → retry (Gemini) → Copy OK + Image OK → campanha ready (1 crédito)
- Copy falha retryable → retry (Gemini) → Copy falha definitiva → aborta Image + estorno
- Copy falha não retryable → aborta Image + estorno (sem retry)
- Image falha (retry interno esgotado) → aborta Copy + estorno
- Ambos falham → estorno único (idempotente)

**Contrato de produto:** campanha completa ou nada. `ready` = arte + copy + publicação pronta. `error` = estorno, sem cobrança.

---

### D8 — Campanha completa ou nada (entrega parcial FORA do escopo)

`DECIDIDO`

A F25 **não** implementa entrega parcial (`partial_ready` com só arte ou só copy). O contrato é binário:

| Estado final | Significa | Cobrança |
|-------------|-----------|----------|
| `ready` | Copy OK + Arte OK + Persistência OK | 1 crédito |
| `error` | Qualquer falha após tentativas de retry | 0 crédito (estorno) |

**Entrega parcial** (ex.: "arte gerada, copy falhou — pode tentar gerar copy depois") é uma feature futura, que exigiria:
- Novo estado de campanha
- UI de retry por ramo
- Cobrança parcial / reuso de asset
- Contrato de campanha incompleta

**Isso fica fora do escopo da v1.5** ou, no máximo, como pós-lançamento.

---

### D9 — Onboarding grant: 5 créditos na criação da loja

`DECIDIDO`

O `POST /api/store` (criação da loja) é modificado para conceder 5 créditos automaticamente. Como o INSERT da loja acontece antes do grant, a atomicidade precisa de uma das duas abordagens:

**Opção A (recomendada) — RPC transacional:**
Criar uma SQL function `create_store_with_initial_grant()` que executa INSERT store + `grant_credits` na mesma transação. Se o grant falhar, o INSERT da loja é revertido automaticamente.

```
[1] Valida input + requireUser
[2] Chama RPC create_store_with_initial_grant(...)
    ├── INSERT store
    ├── grant_credits(storeId, 5, 'onboarding', onboarding_${storeId})
    └── Se qualquer passo falhar → ROLLBACK (loja não criada)
[3] Retorna store data (201)
```

**Opção B — Compensação explícita:**
Se não for possível criar a RPC, o handler faz:

```
[1] Valida input + requireUser
[2] INSERT store
[3] Se INSERT OK → creditService.grantCredits(...)
[4] Se grantCredits falhar → DELETE store recém-criada + retorna erro 500
```

**Escolha: Opção A (RPC transacional)** é preferível por atomicidade real. A Opção B é o fallback se a RPC se mostrar inviável.

**Idempotência:** A chave `onboarding_${storeId}` garante que mesmo se a rota for chamada duas vezes para a mesma loja, o grant não duplica. O INSERT da store é protegido por `requireOwnership` + unique constraint — não há risco de loja duplicada.

---

### D10 — `publication_copy_snapshot` compatível retroativo

`DECIDIDO`

O snapshot gerado pelo Copy Director tem `title` obrigatório no output do serviço, mas **opcional** no `PublicationCopySnapshot` armazenado em JSONB:

```typescript
// publication_copy_snapshot (JSONB) — schema evolui sem migration
{
  title?: string;       // NOVO: opcional. Presente em campanhas F25+.
  caption: string;      // existente
  hashtags: string[];   // existente
  cta_post: string;     // existente
}
```

- Campanhas v1.3/v1.4 existentes → snapshot sem `title` (funciona como antes)
- Campanhas F25+ → snapshot com `title` (vindo do Copy Director)
- A F25 **inclui** a atualização do contrato de exibição e edição para aceitar `title?`:
  - `getEffectivePublicationCopy()` em `src/lib/campaign/display.ts` — passa a incluir `title` do snapshot, tratando como opcional
  - `validatePublicationCopy()` em `src/lib/campaign/publication-copy.ts` — `title` passa a ser aceito mas não exigido
  - Edição manual de copy (`PATCH /api/campaign/[id]/publication-copy`) — schema aceita `title?`

---

## Modelo de Dados — Nova Tabela

### `generation_rate_events`

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

ALTER TABLE public.generation_rate_events ENABLE ROW LEVEL SECURITY;

-- Apenas leitura para o owner (se necessário para UI)
CREATE POLICY "owner_select_generation_rate_events" ON public.generation_rate_events
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.generation_rate_events TO authenticated;
```

---

## Mapa de Rotas

### Rotas modificadas

| Rota | Mudança |
|------|---------|
| `POST /api/campaign/generate-image` | Adiciona rate limit guard, saldo check, reserva de crédito, Copy Director step, pipeline paralelo, retry seletivo, estorno em falha, `mandatoryArtworkText` no schema |
| `POST /api/store` | Adiciona `grantCredits(5, "onboarding")` após criação da loja |

---

## Estrutura de Código

```
ARQUIVOS MODIFICADOS:
══════════════════════

src/app/api/campaign/generate-image/route.ts   ← MODIFICADO (pesado)
  # Fluxo reestruturado em 3 zonas:
  #   PRÉ-STREAM: rate limit + saldo check + reserva
  #   PARALELO: Copy Director ∥ Image Director com retry
  #   PÓS: merge + persist + confirmação/estorno

src/app/api/store/route.ts                      ← MODIFICADO (leve)
  # Após INSERT store → creditService.grantCredits(5)

src/lib/image-generation/config.ts              ← MODIFICADO (leve)
  # Adiciona COST_PER_GENERATION = 1

src/lib/campaign/image-processor.ts             ← MODIFICADO (leve)
  # buildPublicationCopySnapshot aceita title?
  # OU substituído pela chamada ao Copy Director

src/lib/campaign/display.ts                    ← MODIFICADO
  # getEffectivePublicationCopy() inclui title? do snapshot

src/lib/campaign/publication-copy.ts           ← MODIFICADO
  # validatePublicationCopy() aceita title? sem exigir

src/lib/copy/copy-director-service.ts          ← MODIFICADO
  # generateCopy() propaga AbortSignal para TextProvider


ARQUIVOS NOVOS:
════════════════

src/lib/text-provider/
├── gemini.ts                                    ← NOVO
│   # GeminiTextProvider (fallback de retry do Copy Director)

src/lib/rate-limit/
├── types.ts                                    ← NOVO
│   # RateLimitConfig, GenerationRateEvent
├── rate-limit.ts                                ← NOVO
│   # checkRateLimit(storeId): { allowed, remaining, resetTime }
│   # recordGenerationAttempt(storeId, userId, campaignId?)
└── __tests__/
    └── rate-limit.test.ts                       ← NOVO (5+ testes)

src/components/campaign/
├── mandatory-artwork-field.tsx                  ← NOVO
│   # Campo opcional no formulário de campanha

supabase/
└── migrations/
    └── 20260717000001_create_generation_rate_events.sql   ← NOVO
        # DDL + índices + RLS
```

---

## Contratos de Integração

### Mapper: `CampaignBrief → CopyDirectorInput`

O pipeline precisa montar o `CopyDirectorInput` a partir do `CampaignBrief` + dados do formulário:

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
    offer: buildOfferText(input),   // montado de badge + preços
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

function buildOfferText(input: CampaignInput): string {
  // Ex.: "50% OFF — de R$ 99,90 por R$ 49,90"
  const parts: string[] = [];
  if (input.badgeText) parts.push(input.badgeText);
  if (input.originalPriceCents && input.discountedPriceCents) {
    const original = (input.originalPriceCents / 100).toFixed(2);
    const discounted = (input.discountedPriceCents / 100).toFixed(2);
    parts.push(`de R$ ${original} por R$ ${discounted}`);
  } else if (input.discountedPriceCents) {
    const discounted = (input.discountedPriceCents / 100).toFixed(2);
    parts.push(`por R$ ${discounted}`);
  }
  return parts.join(' — ') || `${input.productName} em oferta`;
}
```

### `mandatoryArtworkText` no Image Director

O `CampaignBrief` já possui `campaignInput` que é propagado para o Image Director. O `mandatoryArtworkText` é adicionado a este objeto:

```typescript
// No pipeline, antes de chamar ImageGenerationService:
const briefComMandatoryArtwork = {
  ...brief,
  campaignInput: {
    ...brief.campaignInput,
    mandatoryArtworkText: parsed.data.mandatoryArtworkText,
  },
};
```

### Configuração Gemini (fallback de texto)

| Variável | Obrigatória? | Padrão | Descrição |
|----------|:---:|--------|-----------|
| `TEXT_FALLBACK_PROVIDER` | Não | (vazio = desligado) | `gemini` para ativar fallback no retry do Copy Director |
| `GEMINI_API_KEY` | Se fallback ativo | — | Chave de API Google Gemini |
| `GEMINI_TEXT_MODEL` | Não | `gemini-3.1-flash-lite` | Modelo usado no fallback de texto. `.env.local` pode ter `GEMINI_MODEL` (legado); padronizar para `GEMINI_TEXT_MODEL` |
| `GEMINI_IMAGE_MODEL` | Futuro | — | `gemini-3.1-flash-image` (não implementado na F25) |

> O fallback Gemini é opcional. Se `TEXT_FALLBACK_PROVIDER` não estiver configurado ou `GEMINI_API_KEY` estiver vazia/desabilitada, o segundo retry do Copy Director simplesmente não acontece — falha retryable na 1ª tentativa cai direto em estorno.

### Classificação de erro para retry

```typescript
function isRetryableError(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  if (err instanceof ProviderRateLimitError) return true;
  if (err instanceof Provider5xxError) return true;
  if (err instanceof MalformedResponseError) return true;
  if (err instanceof NetworkError) return true;
  // Não retryable:
  if (err instanceof ZodError) return false;
  if (err instanceof SafetyBlockError) return false;
  if (err instanceof InputConflictError) return false;
  if (err instanceof AuthConfigError) return false;
  if (err instanceof PayloadTooLargeError) return false;
  return false; // default: não retry
}
```

---

## Testes

34+ testes em `src/app/api/campaign/generate-image/__tests__/route.test.ts` (seguindo padrão do repo):

### Fluxo principal (8 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | Saldo suficiente + rate limit OK → fluxo completo → ready | 1 crédito reservado, campanha pronta |
| 2 | Saldo insuficiente → 402, sem chamada de IA | `getBalance` retorna 0, retorna 402 |
| 3 | Rate limit excedido (10/h) → 429, sem chamada de IA | Contagem na janela >= 10 |
| 4 | Rate limit excedido (30/dia) → 429, sem chamada de IA | Contagem na janela >= 30 |
| 5 | Copy result vira `publication_copy_snapshot` | `title`, `caption`, `hashtags`, `cta_post` no snapshot |
| 6 | Copy Director + Image Director executam em paralelo | Ambos chamados, resultado mergeado |
| 7 | Geração com `mandatoryArtworkText` → snapshot não tem o campo | `publication_copy_snapshot` sem `mandatoryArtworkText` |
| 8 | Geração sem `mandatoryArtworkText` → pipeline funciona | Campo opcional ausente não quebra |

### Estorno e falha (8 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 9 | Image Director falha → estorno + campaign error | `refundCredit` chamado, status = `error` |
| 10 | Copy Director falha → estorno + campaign error | `refundCredit` chamado, status = `error` |
| 11 | Ambos falham → estorno único (idempotente) | `refundCredit` chamado uma vez |
| 12 | Persistência falha após merge → estorno + limpa imagem | `deleteCampaignImage` + `refundCredit` |
| 13 | Reserva idempotente: mesma `reserve_${campaignId}` → não duplica | Segunda chamada retorna mesma tx |
| 14 | Refund idempotente: mesma `refund_${txId}` → não duplica | Segunda chamada retorna mesmo refund |
| 15 | Aborto por timeout global → estorno | `refundCredit` chamado, status = `error` |
| 16 | Erro não retryable no Copy Director → falha imediata (sem retry) | Ramo falha na primeira tentativa |

### Retry seletivo (6 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 17 | Copy falha retryable → retry (Gemini) OK → campanha ready (1 crédito) | Retry com fallback bem-sucedido |
| 18 | Copy falha retryable → retry (Gemini) falha → estorno | Retry + fallback esgotados, estorna |
| 19 | Copy falha retryable → Gemini não configurado → estorno (sem fallback) | `TEXT_FALLBACK_PROVIDER` ausente |
| 20 | Image falha (retry interno esgotado) → estorno | `ImageGenerationService` não conseguiu recuperar |
| 21 | Image recupera via retry interno → campanha ready | Retry interno existente funciona |
| 22 | Copy falha definitiva (não retryable) → estorno imediato | Erro não retryable, sem retry |

### Onboarding grant (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 23 | Criação de loja + grant de 5 créditos | Store criada, saldo = 5 |
| 24 | Grant idempotente: mesma loja → não duplica saldo | `onboarding_${storeId}` protege |
| 25 | Grant falha → criação da loja falha | Store não é criada sem créditos |

### mandatoryArtworkText (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 26 | `mandatoryArtworkText` preenchido → presente no `inputSnapshot` | Dado preservado para auditoria |
| 27 | `mandatoryArtworkText` preenchido → presente no brief do Image Director | Image Director recebe o campo |
| 28 | `mandatoryArtworkText` preenchido → AUSENTE no `CopyDirectorInput` | Fronteira copy × arte mantida |

### Compatibilidade retroativa (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 29 | Campanha existente (v1.3/v1.4) sem `title` → UI não quebra | `getEffectivePublicationCopy` trata `title?` |
| 30 | Campanha F25 com `title` → `title` presente no snapshot | Copy Director produz `title` |
| 31 | Edição manual de copy em campanha antiga → `title` opcional | `validatePublicationCopy` aceita sem `title` |
| 32 | Edição manual de copy em campanha F25 → `title` presente | Schema aceita `title?` |

### Rate limit tabela (2 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 33 | INSERT em `generation_rate_events` imediatamente após guard | Evento registrado antes de qualquer IA |
| 34 | Evento permanece mesmo se geração falhar | Tentativa consumiu vaga na janela |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Estorno em race condition** — dois ramos tentam estornar a mesma reserva | Idempotência com `refund_${txId}`. Segunda chamada retorna refund existente |
| **Custo de IA sem retorno** — Copy Director pago mesmo em falha | Retry seletivo reduz falhas. Custo de tentativas perdidas é aceito como custo operacional. Rate limit + saldo check previnem abuso |
| **Paralelismo aumenta complexidade de erro** — estado "um ramo falhou, outro está rodando" | `AbortController` no ramo bem-sucedido quando o outro falha. Mas a IA já pode ter custado dinheiro — aceito como custo operacional |
| **`mandatoryArtworkText` esquecido no Image Director** — campo existe no schema mas não chega no prompt | Teste #26 valida propagação. Code review verifica `briefComMandatoryArtwork` |
| **Onboarding grant falha e loja é criada sem saldo** | D9: grant falha → criação da loja falha. Teste #24 valida |
| **Rate limit consulta lenta** — COUNT(*) em tabela grande sem índice apropriado | Índice composto `(store_id, event_type, created_at DESC)`. Tabela de volume baixo (dezenas a centenas por usuário/dia) |
| **Retry aumenta latência** — 2 tentativas de 500ms + 1s = até 1.5s extras | Aceitável para o público controlado (3-5 usuários). Se latência for problema, reduzir para 1 retry ou ajustar backoff |
| **publication_copy_snapshot com `title` quebra UI legada** | `title` é opcional. UI trata ausência. Teste #28 valida compatibilidade |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Entrega parcial (`partial_ready`, "só arte" ou "só copy") | Feature futura. Exige estado novo, UI nova, cobrança parcial |
| UI de créditos na topbar ou `/conta` | F27 |
| Stripe Checkout / Webhook / `credit_orders` | F26 |
| Observabilidade (logging estruturado, telemetria de IA, alertas) | F28 |
| Dashboard operacional | F28 |
| Cleanup de 90 dias (retenção) | Job agendado pós-lançamento (D+30) |
| Provider Anthropic | Fora do escopo da v1.5 |
| Gemini como provider primário de texto | Gemini entra como **fallback de retry** no Copy Director (D7). Provider primário contínua sendo OpenAI |
| `generation_events` populado para campanhas (telemetria) | F28 — a tabela será usada para telemetria, não para rate limit |
| Campanhas multi-formato (Stories, Landscape) | Fora do escopo da v1.5 |
| Múltiplas lojas (1:N) | Milestone futura |
| Reuso de asset entre tentativas de retry | Otimização futura |

---

## Contratos com Fases Futuras

### F26 — Pagamento

A F25 não depende de pagamento para funcionar. Com o onboarding grant de 5 créditos + rate limit, o usuário pode gerar campanhas gratuitamente no lançamento controlado. A F26 adicionará a compra de créditos.

**Contrato:** `CreditService.grantCredits` e `CreditService.getBalance` já estão prontos. A F26 chama `grantCredits` via webhook de pagamento. A F25 já opera o `reserve`/`refund` no pipeline.

### F27 — UI de saldo

A F25 não tem UI de saldo — o rate limit e saldo check são server-side. A F27 adicionará:
- Saldo visível na topbar
- Seção de créditos em `/conta`
- Diálogo de compra (que chama a rota da F26)

**Contrato:** A F25 expõe `creditService.getBalance()` e `creditService.getHistory()` que a F27 consumirá.

### F28 — Observabilidade

A F25 produz logs de rate limit, saldo check, reserva, estorno e execução paralela — mas como `console.*` simples. A F28 estruturará esses logs com `campaignId`, `phase`, `duration_ms`, `status` e registrará telemetria de IA em `generation_events`.

**Contrato:** A F25 insere em `generation_rate_events` para rate limit. A F28 pode usar esta tabela para métricas de tentativas, taxa de sucesso por janela, etc.

---

## Decisões de Alinhamento

- [ ] D1 — Pipeline transacional com 3 zonas (pré-stream, paralelo, pós)
- [ ] D2 — Copy Director ∥ Image Director em paralelo (Promise.all)
- [ ] D3 — Rate limit + saldo check antes de qualquer chamada de IA (incluindo InputValidationService)
- [ ] D4 — `generation_rate_events` como tabela própria para rate limit
- [ ] D5 — `mandatoryArtworkText` é campo visual, excluído do Copy Director
- [ ] D6 — `COST_PER_GENERATION = 1` (fixo na v1.5)
- [ ] D7 — Retry seletivo com fallback Gemini (Copy Director), sem retry externo de imagem
- [ ] D8 — Campanha completa ou nada (entrega parcial fora de escopo)
- [ ] D9 — Onboarding grant: 5 créditos na criação da loja, falha se grant falhar
- [ ] D10 — `publication_copy_snapshot` com `title?` opcional, compatível retroativo

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Pipeline em 3 zonas
- [ ] D2 — Paralelismo Copy ∥ Image
- [ ] D3 — Rate limit + saldo check antes de IA
- [ ] D4 — `generation_rate_events` tabela própria
- [ ] D5 — `mandatoryArtworkText` visual, não copy
- [ ] D6 — `COST_PER_GENERATION = 1`
- [ ] D7 — Retry seletivo com fallback Gemini (Copy Director), sem retry externo de imagem
- [ ] D8 — Campanha completa ou nada
- [ ] D9 — Onboarding grant 5 créditos
- [ ] D10 — `title?` opcional retroativo

### Pipeline generate-image
- [ ] Rate limit guard (10/h + 30/dia) executa antes de qualquer IA
- [ ] Saldo check (`getBalance >= 1`) executa antes de qualquer IA
- [ ] 402 Payment Required quando saldo insuficiente
- [ ] 429 Too Many Requests quando rate limit excedido
- [ ] Reserva de crédito (`reserveCredit`) após criar campanha
- [ ] Copy Director + Image Director em Promise.all
- [ ] Retry seletivo do Copy Director com fallback Gemini; Image Director usa retry interno existente
- [ ] `publication_copy_snapshot` populado pelo Copy Director
- [ ] Falha → `refundCredit` + `updateCampaignError`
- [ ] Estorno idempotente com `refund_${txId}`
- [ ] Persistência falha após merge → estorno + limpa imagem
- [ ] `mandatoryArtworkText` no schema, snapshot, brief visual

### mandatoryArtworkText
- [ ] Campo opcional no formulário de campanha
- [ ] Presente no `GenerateImageRequestSchema`
- [ ] Propagado no `inputSnapshot`
- [ ] Enviado ao Image Director no brief
- [ ] **Excluído** do `CopyDirectorInput`

### Rate limit
- [ ] Migration `20260717000001_create_generation_rate_events.sql`
- [ ] Índice `(store_id, event_type, created_at DESC)`
- [ ] RLS com policy `owner_select`
- [ ] Consulta de janela deslizante (1h e 24h)
- [ ] Guard HTTP 429 antes do stream

### Onboarding grant
- [ ] `POST /api/store` concede 5 créditos após INSERT
- [ ] Idempotência com `onboarding_${storeId}`
- [ ] Se grant falhar → criação da loja falha

### Compatibilidade
- [ ] `title?` opcional em campanhas existentes
- [ ] UI de exibição trata `title` ausente

### Testes (34+)
- [ ] Fluxo completo saldo suficiente → ready (#1)
- [ ] 402 saldo insuficiente (#2)
- [ ] 429 rate limit hora (#3)
- [ ] 429 rate limit dia (#4)
- [ ] Copy result vira snapshot (#5)
- [ ] Paralelismo (#6)
- [ ] mandatoryArtworkText no snapshot visual, não no copy (#7, #28)
- [ ] mandatoryArtworkText ausente não quebra (#8)
- [ ] Image falha → estorno (#9)
- [ ] Copy falha → estorno (#10)
- [ ] Ambos falham → estorno único (#11)
- [ ] Persistência falha → estorno + limpa (#12)
- [ ] Reserva idempotente (#13)
- [ ] Refund idempotente (#14)
- [ ] Timeout → estorno (#15)
- [ ] Erro não retryable → falha imediata (#16)
- [ ] Retry copy: falha retryable → retry Gemini OK → ready (#17)
- [ ] Retry copy: falha retryable → retry Gemini falha → estorno (#18)
- [ ] Retry copy: Gemini não configurado → estorno (sem fallback) (#19)
- [ ] Image falha (retry interno esgotado) → estorno (#20)
- [ ] Image recupera via retry interno → ready (#21)
- [ ] Copy falha definitiva → estorno imediato (#22)
- [ ] Onboarding: loja + grant (#23)
- [ ] Onboarding: grant idempotente (#24)
- [ ] Onboarding: grant falha → loja não criada (#25)
- [ ] mandatoryArtworkText no inputSnapshot (#26)
- [ ] mandatoryArtworkText no Image Director (#27)
- [ ] mandatoryArtworkText AUSENTE no Copy Director (#28)
- [ ] Campanha antiga sem title → UI não quebra (#29)
- [ ] Campanha F25 com title → snapshot correto (#30)
- [ ] Edição manual aceita title? opcional (#31)
- [ ] Edição manual preserva title em campanha F25 (#32)
- [ ] Rate limit: INSERT imediatamente após guard (#33)
- [ ] Rate limit: evento permanece mesmo em falha (#34)

### Verificação final
- [ ] `npx vitest run src/app/api/campaign/generate-image/__tests__/route.test.ts` — 34+ testes passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — novos + 768 existentes passando
- [ ] `npm run build` — build bem-sucedido
- [ ] Nenhum teste existente quebrado (regressão v1.3 + v1.4)
- [ ] UAT local: geração com crédito, sem crédito, rate limit excedido

---

*Documento criado: 2026-07-17*
*Baseado no alinhamento da milestone v1.5 (D1–D12), exploração do estado atual do código (pós-F24), discussão entre dois agentes com decisões registradas.*
*Próximo passo: sua revisão e aprovação.*
