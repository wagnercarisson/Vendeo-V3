# Phase 31.2: Diretores por Intenção — Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-31-2-diretores-por-intencao/`

<domain>
## Phase Boundary

A F31.1 entregou `CampaignIntent` type, `BADGE_OPTIONS_BY_INTENT`, inferência automática, e a UI de seleção com bloqueio explícito para spotlight/exclusive. O pipeline atual usa um prompt único (`campaign-image-director.md` e `campaign-copy-director.md`) com framing 100% promocional, e os schemas do pipeline exigem `discountedPriceCents` obrigatório.

**Estado atual dos bloqueios:**

| Camada | Arquivo | Linha | Bloqueio |
|--------|---------|-------|----------|
| UI | `campaign-input-form.tsx` | 239-243 | Badge "Em breve" no radio |
| UI | `campaign-input-form.tsx` | 523 | `disabled` quando intent !== offer |
| UI | `campaign-input-form.tsx` | 540-541 | Botão mostra "Disponível em breve" |
| Form | `use-campaign-form.ts` | 560-563 | `handleSubmit` early return |
| Route | `route.ts` | 142-147 | Guard HTTP 400 |
| Schema | `image-generation/schema.ts` | 12 | `discountedPriceCents` required |
| Schema | `campaign-intelligence/schema.ts` | 15-18 | `discountedPriceCents` required |
| Schema | `campaign-intelligence/schema.ts` | 52-53 | `discounted_price_display` e `badge_text` min(1) obrigatórios |
| Service | `image-generation-service.ts` | 833-848 | `assemblePrompt` carrega template fixo |
| Service | `copy-director-service.ts` | 79 | Carrega prompt fixo |
| Mapper | `mapper.ts` | 4-46 | `buildOfferText` exige `discountedPriceCents` |

**O que esta fase entrega:**
- Schemas tolerantes: `discountedPriceCents` opcional, `CampaignSpecSchema` com campos nullable
- Desbloqueio total de spotlight/exclusive na UI, form e pipeline
- Normalização de exclusive com preço indevido no início do pipeline
- 6 prompts separados por intent (3 image + 3 copy), sem fallback silencioso
- Roteamento de prompt por `campaignIntent` em `assemblePrompt`, `validatePrompts` e `CopyDirectorService`
- `commercialFrame` substituindo `offer` no Copy Director (string sempre presente, conteúdo varia por intent)
- Conteúdo adaptado por intent: `buildCommercialRepertoire`, `buildCreativeContextGuidance`, `buildDeterministicCopy`
- `preserveImageDirective` injetada quando `preserveImageContext === true`
- Regressão zero para offer

**Non-Goals:**
- Criar revisores de qualidade por intent (F31.3)
- Validar qualidade visual de spotlight/exclusive (F31.3)
- Reescrever o fluxo do `CampaignIntelligenceService`
- Migrações de banco de dados
- Mudanças no `ImageReviewService`

</domain>

<decisions>
## Implementation Decisions

### D1 — Abordagem A para CampaignSpecSchema: campos nullable

`DECIDIDO`

`discounted_price_display` e `badge_text` passam de `z.string().min(1)` para `z.string().nullable()`.

Alternativa rejeitada: Separar `offer` em 3 schemas distintos (`offer`/`spotlight`/`exclusive`). Rejeitada porque mexe no contrato de structured outputs da OpenAI simultaneamente, aumenta risco de regressão, e o schema atual é compartilhado com `CampaignIntelligenceService` legado.

### D2 — Prompt routing sem fallback silencioso

`DECIDIDO`

`assemblePrompt` carrega `campaign-image-director-${campaignIntent}`. Se o prompt não existir para uma intent válida, falha no preflight como `invalid_prompt`. Não há fallback para o prompt antigo.

Regra: Como o schema faz `.default("offer")`, `campaignIntent` sempre está presente após o parse. O arquivo `campaign-image-director.md` original permanece apenas como referência, não como fallback.

### D3 — `commercialFrame` no lugar de `offer` no Copy Director

`DECIDIDO`

Substituir `offer: z.string().min(1)` por `commercialFrame: z.string().min(1)` no `CopyDirectorInputSchema`. O campo é sempre presente e não vazio, mas o conteúdo varia por intent:

| Intent | commercialFrame |
|--------|----------------|
| offer | "Promoção: de R$ X por R$ Y" |
| spotlight | "Destaque — R$ X" ou "Destaque do produto" |
| exclusive | "Produto exclusivo — sem divulgação de preço" |

### D4 — Normalização de exclusive no início do pipeline

`DECIDIDO`

Normalizar `discountedPriceCents` para `undefined` quando `campaignIntent === "exclusive"` logo após `parsed.data`, depois do guard de legal/auth/ownership e antes de montar `campaignInput`. Com log.

### D5 — Offer preserva comportamento sem regressão

`DECIDIDO`

Offer mantém exatamente o mesmo fluxo de antes:
- `assemblePrompt` carrega `campaign-image-director-offer` (conteúdo idêntico ao antigo)
- `CopyDirectorService` carrega `campaign-copy-director-offer` (idêntico, só `{{commercialFrame}}` no lugar de `{{offer}}`)
- `buildCommercialRepertoire` e `buildCreativeContextGuidance` mantêm linguagem atual
- `discountedPriceCents` continua obrigatório semanticamente (embora opcional no schema)
- `preserveImageContext` continua normalizado para false

### D6 — Revisor único não recebe adaptação semântica

`DECIDIDO`

O `campaign-image-reviewer` permanece único. Para exclusive, passar `discountedPrice` vazio. Não adaptar critérios de qualidade — isso é F31.3.

**Risco assumido:** O revisor pode rejeitar imagens de exclusive/spotlight por critérios calibrados para oferta.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec — Source of Truth
- `openspec/changes/fase-31-2-diretores-por-intencao/proposal.md` — Why, What Changes, Capabilities, Impact
- `openspec/changes/fase-31-2-diretores-por-intencao/design.md` — All design decisions (D1-D6), Risks/Trade-offs
- `openspec/changes/fase-31-2-diretores-por-intencao/tasks.md` — 8 task groups with 74 tasks

### Specs por Domínio
- `openspec/changes/fase-31-2-diretores-por-intencao/specs/schema-intent-contracts/spec.md` — discountedPriceCents opcional, CampaignSpecSchema nullable, normalização exclusive
- `openspec/changes/fase-31-2-diretores-por-intencao/specs/ai-image-generation/spec.md` — GenerateImageRequestSchema, assemblePrompt, buildPromptVariables, buildCommercialRepertoire, validatePrompts
- `openspec/changes/fase-31-2-diretores-por-intencao/specs/prompt-templates-by-intent/spec.md` — 6 templates, seleção por intent, preserveImageDirective
- `openspec/changes/fase-31-2-diretores-por-intencao/specs/copy-director/spec.md` — CopyDirectorInput, commercialFrame, generateCopy routing, mapper
- `openspec/changes/fase-31-2-diretores-por-intencao/specs/campaign-form-intent/spec.md` — Submit permitido para todas as intents, discountedPriceCents fluido
- `openspec/changes/fase-31-2-diretores-por-intencao/specs/campaign-input-ui/spec.md` — IntentSelector sem "Em breve", botão habilitado
- `openspec/changes/fase-31-2-diretores-por-intencao/specs/campaign-intent-types/spec.md` — Desbloqueio de spotlight/exclusive, normalização exclusive, comportamento semântico

### Dependências — Fase Anterior
- `.planning/phases/31-1-modelo-comercial-formulario/31-1-CONTEXT.md` — Tipos CampaignIntent, schemas F31.1, decisões D1-D8
- `.planning/phases/31-1-modelo-comercial-formulario/01-SUMMARY.md` — Foundation entregue (types, schemas, constants)

### Arquivos Modificados por esta Fase
- `src/lib/image-generation/schema.ts` — GenerateImageRequestSchema: discountedPriceCents opcional
- `src/lib/campaign-intelligence/schema.ts` — CampaignGenerationInputSchema opcional, CampaignSpecSchema nullable
- `src/lib/campaign/types.ts` — InputSnapshot: discountedPriceCents opcional
- `src/lib/campaign-intelligence/providers/mock.ts` — Aceitar null em discounted_price_display/badge_text
- `src/lib/copy/schema.ts` — CopyDirectorInputSchema: commercialFrame + campaignIntent
- `src/lib/copy/mapper.ts` — buildCommercialFrame no lugar de buildOfferText, mapBriefToCopyDirectorInput adaptado
- `src/lib/copy/copy-director-service.ts` — generateCopy carrega prompt por campaignIntent
- `src/lib/image-generation/services/image-generation-service.ts` — assemblePrompt, buildPromptVariables, buildCommercialRepertoire, buildCreativeContextGuidance, validatePrompts adaptados
- `src/components/flow/campaign-input-form.tsx` — IntentSelector sem "Em breve", botão sempre habilitado
- `src/components/flow/use-campaign-form.ts` — handleSubmit sem guard, isValid adaptado
- `src/app/api/campaign/generate-image/route.ts` — Guard removido, normalização exclusive, validação offer, fallback determinístico
- `prompts/campaign-image-director-offer.md` — Novo (cópia do atual)
- `prompts/campaign-image-director-spotlight.md` — Novo
- `prompts/campaign-image-director-exclusive.md` — Novo
- `prompts/campaign-copy-director-offer.md` — Novo (cópia adaptada)
- `prompts/campaign-copy-director-spotlight.md` — Novo
- `prompts/campaign-copy-director-exclusive.md` — Novo

</canonical_refs>

<specifics>
## Specific Ideas

### Mapa de alterações por arquivo

```
Schemas (Plan 01):
  src/lib/image-generation/schema.ts:12
    ~ discountedPriceCents: z.number().int().positive().optional()
  src/lib/campaign-intelligence/schema.ts:15-18
    ~ discountedPriceCents: z.number().int().positive().optional()
  src/lib/campaign-intelligence/schema.ts:52-53
    ~ discounted_price_display: z.string().nullable()
    ~ badge_text: z.string().nullable()
  src/lib/campaign/types.ts:37
    ~ discountedPriceCents?: number
  src/lib/campaign-intelligence/providers/mock.ts:89-94
    ~ discounted_price_display/badge_text aceitam null

Unblock (Plan 02):
  src/components/flow/campaign-input-form.tsx:239-243
    - Badge "Em breve"
  src/components/flow/campaign-input-form.tsx:523
    - disabled condition campaignIntent !== "offer"
  src/components/flow/campaign-input-form.tsx:540-541
    ~ Botão sempre "Criar Campanha"
  src/components/flow/use-campaign-form.ts:560-563
    - Early return handleSubmit
  src/app/api/campaign/generate-image/route.ts:142-147
    - Guard HTTP 400
  src/app/api/campaign/generate-image/route.ts:+validação offer
    + Se offer sem discountedPriceCents → HTTP 400
  src/app/api/campaign/generate-image/route.ts:+normalização exclusive
    + Se exclusive com preço → undefined + log

Prompts (Plan 03):
  prompts/campaign-image-director-offer.md — cópia do atual
  prompts/campaign-image-director-spotlight.md — vitrine, sem urgência
  prompts/campaign-image-director-exclusive.md — sem preço, valor percebido
  prompts/campaign-copy-director-offer.md — baseado no atual, {{commercialFrame}}
  prompts/campaign-copy-director-spotlight.md — novidade/destaque
  prompts/campaign-copy-director-exclusive.md — exclusividade

Image Director Routing (Plan 04):
  image-generation-service.ts:assemblePrompt()
    ~ Load campaign-image-director-${campaignIntent}
  image-generation-service.ts:buildPromptVariables()
    + campaignIntent, preserveImageDirective, commercialFrame
  image-generation-service.ts:validatePrompts()
    ~ Validar director por intent
  image-generation-service.ts:buildCommercialRepertoire()
    ~ Filtrar escassez/validade por intent
  image-generation-service.ts:buildCreativeContextGuidance()
    ~ Framing por intent

Copy Director + Content (Plan 05):
  src/lib/copy/schema.ts
    + campaignIntent: z.enum([...]).optional().default("offer")
    ~ offer → commercialFrame: z.string().min(1)
  src/lib/copy/copy-director-service.ts
    ~ generateCopy carrega prompt por intent
  src/lib/copy/mapper.ts
    ~ buildOfferText → buildCommercialFrame(campaignIntent, ...)
    ~ mapBriefToCopyDirectorInput monta commercialFrame
  image-generation-service.ts:buildDeterministicCopy()
    ~ Implementar fallback determinístico por intent
  route.ts:380-394 fallback adaptado
```

### Fluxo de dados pós-F31.2

```
Formulário → inferIntent() → IntentSelector (todas opções ativas)
  ↓ handleSubmit (qualquer intent)
  ↓
POST /api/campaign/generate-image
  ↓ schema parse (discountedPriceCents opcional)
  ↓ normalização exclusive (preço → undefined + log)
  ↓ validação offer (sem preço → 400)
  ↓ inputSnapshot
  ↓
  ┌─→ Image Director: campaign-image-director-${intent}
  └─→ Copy Director: campaign-copy-director-${intent}
  ↓ montagem variáveis (commercialFrame, preserveImageDirective)
  ↓ Geração paralela → IA retorna CampaignSpecSchema nullable
  ↓ Reviewer único (discountedPrice vazio para exclusive)
```

</specifics>

<deferred>
## Deferred Ideas

- Criar revisores de qualidade por intent (F31.3)
- Validar qualidade visual de spotlight/exclusive (F31.3)
- Reescrever o fluxo do `CampaignIntelligenceService`
- Migrações de banco de dados
- Mudanças no `ImageReviewService`
- Calibração do revisor para exclusive/spotlight (F31.3)

</deferred>

---

*Phase: 31-2-diretores-por-intencao*
*Context gathered: 2026-07-25 via OpenSpec alignment*
