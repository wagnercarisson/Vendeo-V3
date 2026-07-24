# Phase 31.1: Modelo Comercial — Formulário — Context

**Gathered:** 2026-07-24
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-31-1-modelo-comercial-formulario/`

<domain>
## Phase Boundary

Hoje o gerador de campanhas trata todo produto como oferta promocional — presume DE/POR, badge promocional obrigatório, copy sempre com framing de desconto. Isso força o lojista a preencher preço com desconto mesmo quando sua intenção não é promover, mas destacar um lançamento, produto premium ou algo exclusivo. A Fase 31 introduz roteamento por intenção comercial; a F31.1 é a primeira fatia: modelo conceitual + formulário + schemas, sem modificar prompts ainda.

**Estado atual:**
- `InputSnapshot`: `discountedPriceCents` é required (number)
- `CampaignFormFields`: `discountedPriceCents` é number (sempre 0+)
- `CampaignGenerationInputSchema`: `discountedPriceCents` required
- `GenerateImageRequestSchema`: `discountedPriceCents` required, sem `campaignIntent`
- `BADGE_OPTIONS`: lista única no `src/lib/constants.ts`
- `campaign-input-form.tsx`: badge select fixo, sem seletor de intent
- `generate-image/route.ts`: `inputSnapshot` sem campos de intent

**O que esta fase entrega:**
- `CampaignIntent` type (`"offer" | "spotlight" | "exclusive"`) em `src/lib/campaign/types.ts`
- `campaignIntent` opcional nos schemas com default `"offer"`
- `preserveImageContext: boolean` opcional no schema e formulário
- Inferência automática de intent a partir dos campos de preço (DE+POR → offer, só preço → spotlight, nenhum preço → exclusive)
- Seletor de intent (radio group) entre badge e botão "Criar" — spotlight/exclusive exibem "Em breve", submissão bloqueada
- `BADGE_OPTIONS_BY_INTENT` separado por intent; badge opcional para spotlight/exclusive
- `discountedPriceCents` opcional no `CampaignFormFields` mas required nos schemas de geração
- `campaignIntent` e `preserveImageContext` no `inputSnapshot`
- Normalização: `preserveImageContext = false` quando `campaignIntent === "offer"`
- Pipeline guard: rejeitar intents não-offer no pré-stream
- 12+ testes (inferência, validação, badge condicional, preserveImageContext)

**Dependências:** F25 (pipeline route generate-image), F27 (form/balance), F30 (legal clearance no pipeline)

**Non-Goals:**
- Modificar prompts de diretor de imagem, copy director ou revisor (F31.2)
- Ativar submissão de spotlight ou exclusive no pipeline (F31.2)
- Modificar `CampaignSpecSchema` — continua com `badge_text` e `discounted_price_display` obrigatórios (F31.2/31.3)
- Testes de comportamento dos diretores por intent (F31.3)

</domain>

<decisions>
## Implementation Decisions

### D1 — campaignIntent como enum literal

`DECIDIDO`

```typescript
// src/lib/campaign/types.ts
export type CampaignIntent = "offer" | "spotlight" | "exclusive";
```

Internamente o sistema sempre transporta `campaignIntent`. O termo PT-BR na UI:
- Oferta → `offer`
- Destaque → `spotlight`
- Exclusivo → `exclusive`

### D2 — Inferência automática + seletor restrito

`DECIDIDO`

| Campos preenchidos | Intent inferida | Opções disponíveis |
|---|---|---|
| DE + POR | `offer` | [offer] |
| Só preço (discounted) | `spotlight` | [offer \| spotlight] |
| Nenhum preço | `exclusive` | [spotlight \| exclusive] |

Funciona em `useCampaignForm` como `inferIntent(originalPriceCents: number, discountedPriceCents: number | undefined | null): CampaignIntent` — valores `undefined`/`null` são normalizados para `0` antes da comparação. O seletor vem pré-selecionado com a intent inferida e posicionado entre o badge select e o botão "Criar Campanha".

### D3 — discountedPriceCents opcional no form, required no pipeline

`DECIDIDO`

`CampaignFormFields.discountedPriceCents`: `number | undefined` (undefined = campo vazio).

Schemas de geração mantêm `discountedPriceCents` como `required`:
- `CampaignGenerationInputSchema`: `z.number().positive()` — sem mudança
- `GenerateImageRequestSchema`: `z.number().int().positive()` — sem mudança

Regra: `campaignIntent` padrão é `"offer"`. Enquanto for `offer`, o formulário valida `discountedPriceCents` como obrigatório. A serialização em `handleSubmit` só envia o body quando a intent for `offer` — spotlight/exclusive são bloqueados no submit.

Compatibilidade futura: quando a F31.2 ativar `spotlight`/`exclusive`, os schemas tornam `discountedPriceCents` opcional.

### D4 — Badge condicional por intent

`DECIDIDO`

| Intent | Badges disponíveis |
|---|---|
| `offer` | Promoção, Oferta, Queima de Estoque, Últimas Unidades, Imperdível |
| `spotlight` | Novidade, Lançamento, Mais Vendido, Top de Linha, Destaque da Semana |
| `exclusive` | Exclusivo, Premium, Sob Encomenda, Edição Limitada |

Badge passa a ser **opcional** para `spotlight` e `exclusive` na validação. O select inclui opção vazia ("Nenhum") para esses intents.

### D5 — preserveImageContext: boolean

`DECIDIDO`

- **Sempre invisível** para intent `offer` (promoção precisa de isolamento para hierarquia agressiva)
- **Visível e opcional** para `spotlight` e `exclusive`
- Quando `true`, transportado até `inputSnapshot` para uso futuro (F31.2 injeta a instrução no prompt do diretor de imagem)
- **Regra de normalização:** se `campaignIntent === "offer"`, `preserveImageContext` é normalizado para `false` no `inputSnapshot`

### D6 — Sem migration de banco

`DECIDIDO`

`campaignIntent` e `preserveImageContext` são transportados apenas no `inputSnapshot` (JSONB). Não há nova coluna ou tabela. A normalização descarta o valor para `offer`, mantendo os registros existentes compatíveis.

### D7 — Pipeline guard: rejeitar intents não-offer no pré-stream

`DECIDIDO`

O pipeline adiciona um guard no pré-stream (após schema parse, antes de criar campanha):

```typescript
if (body.campaignIntent && body.campaignIntent !== "offer") {
  return Response.json(
    { error: { message: "Intenção comercial indisponível. Apenas ofertas podem ser geradas no momento." } },
    { status: 400 }
  );
}
```

Este guard é uma **camada de segurança**, não o bloqueio principal (que ocorre no client-side `handleSubmit`). Garante que mesmo que um request malformado ou chamada externa chegue com `campaignIntent !== "offer"`, o pipeline rejeita antes de qualquer consumo de crédito ou chamada de IA.

### D8 — Nomenclatura preparada para expansão

`DECIDIDO`

- `campaignIntent` → reutilizável para qualquer canal/formato
- `preserveImageContext` → independente do intent
- `badgeKind` (futuro) → `promotional | product_signal | trust_signal | none`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec — Source of Truth
- `openspec/changes/fase-31-1-modelo-comercial-formulario/proposal.md` — Why, What Changes, Capabilities, Impact
- `openspec/changes/fase-31-1-modelo-comercial-formulario/design.md` — All design decisions (D1-D8), Risks/Trade-offs
- `openspec/changes/fase-31-1-modelo-comercial-formulario/tasks.md` — 19 task groups with 115 tasks
- `openspec/changes/fase-31-1-modelo-comercial-formulario/specs/` — 8 spec files with detailed requirements:
  - `campaign-intent-types/spec.md` — CampaignIntent type, InputSnapshot fields, preserveImageContext normalization
  - `campaign-types/spec.md` — Input snapshot shape v1, campaignIntent + preserveImageContext
  - `ai-campaign-intelligence/spec.md` — CampaignGenerationInputSchema with campaignIntent
  - `ai-image-generation/spec.md` — GenerateImageRequestSchema with campaignIntent + preserveImageContext
  - `badge-options-by-intent/spec.md` — BADGE_OPTIONS_BY_INTENT constant
  - `campaign-form-intent/spec.md` — Intent inference, selector, badge validation, preserveImageContext, discountedPriceCents
  - `campaign-input-ui/spec.md` — Form fields, intent selector position, badge options, validation, submit
  - `transactional-pipeline/spec.md` — Pipeline 3-zone, inputSnapshot, campaignIntent guard

### Dependencies — Existing Phase Contexts
- `.planning/phases/25-integracao-transacional-pipeline/25-CONTEXT.md` — generate-image route, pipeline 3-zone structure
- `.planning/phases/27-conta-saldo-extrato/27-CONTEXT.md` — /conta page structure, BalanceCard, form integration
- `.planning/phases/30-legal-foundation/30-CONTEXT.md` — Legal clearance in pipeline pre-stream

### Existing Source Files (modified by this phase)
- `src/lib/campaign/types.ts` — CampaignIntent type, InputSnapshot extended
- `src/lib/campaign-intelligence/schema.ts` — CampaignGenerationInputSchema + campaignIntent
- `src/lib/image-generation/schema.ts` — GenerateImageRequestSchema + campaignIntent + preserveImageContext
- `src/lib/constants.ts` — BADGE_OPTIONS_BY_INTENT added
- `src/components/campaign/types.ts` — CampaignInput (Omit<GenerateImageRequest>) inherits new fields
- `src/components/flow/campaign-input-form.tsx` — IntentSelector, conditional badge, preserveImageContext checkbox
- `src/components/flow/use-campaign-form.ts` — inferIntent, conditional validation, form state changes
- `src/app/api/campaign/generate-image/route.ts` — campaignIntent guard pre-stream + inputSnapshot extended

</canonical_refs>

<specifics>
## Specific Ideas

### Mapa de alterações por arquivo

```
src/lib/campaign/types.ts
  + CampaignIntent = "offer" | "spotlight" | "exclusive"
  + InputSnapshot.campaignIntent?: CampaignIntent
  + InputSnapshot.preserveImageContext?: boolean

src/lib/campaign-intelligence/schema.ts
  ~ CampaignGenerationInputSchema: + campaignIntent (optional, default "offer")
  - discountedPriceCents mantido required

src/lib/image-generation/schema.ts
  ~ GenerateImageRequestSchema: + campaignIntent (optional, default "offer")
  ~ GenerateImageRequestSchema: + preserveImageContext (optional)
  - discountedPriceCents mantido required

src/lib/constants.ts
  + BADGE_OPTIONS_BY_INTENT: Record<CampaignIntent, readonly string[]>
  ~ BADGE_OPTIONS mantido = BADGE_OPTIONS_BY_INTENT["offer"]

src/components/campaign/types.ts
  - CampaigInput (Omit<GenerateImageRequest, 'storeId'>) — herda novos campos automaticamente

src/components/flow/use-campaign-form.ts
  + inferIntent(originalPriceCents, discountedPriceCents): CampaignIntent
  ~ CampaignFormFields.discountedPriceCents → number | undefined
  + CampaignFormFields.campaignIntent: CampaignIntent
  + CampaignFormFields.preserveImageContext: boolean
  ~ validateDiscountedPrice: condicional por intent
  ~ validateBadge: BADGE_OPTIONS_BY_INTENT + opcional para spotlight/exclusive
  ~ handleSubmit: bloqueia intent !== "offer", inclui campos no body

src/components/flow/campaign-input-form.tsx
  + IntentSelector (radio group) entre badge e botão "Criar"
  ~ badge select usa BADGE_OPTIONS_BY_INTENT[campaignIntent]
  + Checkbox preserveImageContext (invisível para offer)
  ~ spotlight/exclusive com indicador "Em breve" + submit bloqueado

src/app/api/campaign/generate-image/route.ts
  + Guard pré-stream: campaignIntent !== "offer" → 400
  ~ inputSnapshot com campaignIntent e preserveImageContext
  ~ Normalização: se offer, preserveImageContext = false
```

### Arquitetura do fluxo de dados

```
Formulário → inferIntent() → IntentSelector (radio group)
  ↓ handleSubmit (só offer passa)
  ↓
POST /api/campaign/generate-image
  ↓ schema parse (campaignIntent default "offer")
  ↓ campaignIntent guard (rejeita != "offer")
  ↓ inputSnapshot { ...campaignIntent, preserveImageContext }
  ↓ normalização (se offer, preserveImageContext = false)
  ↓ pipeline 3 zonas (sem mudança no comportamento)
```

### Regra de recovery de badge

Quando o usuário troca de intent e o badge atual não pertence à lista da nova intent, o badge é resetado para vazio automaticamente. Isso evita inconsistência visual (ex: badge "Promoção" aparecendo em um produto "Exclusivo").

</specifics>

<deferred>
## Deferred Ideas

- Modificar prompts do diretor de imagem, copy director ou revisor — F31.2
- Ativar submissão de spotlight ou exclusive no pipeline — F31.2
- Modificar `CampaignSpecSchema` (schema de saída da IA) — F31.2/31.3
- Testes de comportamento dos diretores por intent — F31.3
- Stripe / Monetização Pública — v1.7 (futuro)
- `badgeKind` como enum separado (promotional, product_signal, trust_signal, none) — fase futura

</deferred>

---

*Phase: 31-1-modelo-comercial-formulario*
*Context gathered: 2026-07-24 via OpenSpec alignment*
