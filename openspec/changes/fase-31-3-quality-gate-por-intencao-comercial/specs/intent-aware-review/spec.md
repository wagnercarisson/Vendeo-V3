## ADDED Requirements

### Requirement: ImageReviewInput com campaignIntent e preserveImageContext

O sistema SHALL estender `ImageReviewInput` com:

- `campaignIntent?: CampaignIntent` — opcional, default `"offer"`. Determina as expectativas de revisão.
- `preserveImageContext?: boolean` — opcional. Indica se o revisor deve permitir fundo contextual.
- `badgeText?: string` — opcional (era obrigatório). Para exclusive sem badge, pode ser omitido.
- `discountedPrice?: string` — opcional (era obrigatório). Para exclusive, pode ser omitido.
- `originalPrice?: string` — permanece opcional.

#### Scenario: ImageReviewInput com campaignIntent default "offer"

- **WHEN** `ImageReviewInput` é construído sem `campaignIntent`
- **THEN** `campaignIntent` é `"offer"`
- **AND** o revisor aplica regras de offer (preço obrigatório, badge obrigatório, urgência esperada)

#### Scenario: ImageReviewInput exclusive sem badgeText

- **WHEN** `ImageReviewInput` é construído com `campaignIntent: "exclusive"` sem `badgeText`
- **THEN** o revisor NÃO exige badge na imagem
- **AND** a ausência de badge NÃO gera issue

#### Scenario: ImageReviewInput spotlight sem discountedPrice

- **WHEN** `ImageReviewInput` é construído com `campaignIntent: "spotlight"` sem `discountedPrice`
- **THEN** o revisor NÃO exige preço na imagem
- **AND** NÃO gera `wrong_price` por ausência de preço

### Requirement: review() monta variáveis contextuais sem placeholders vazios

O sistema SHALL, no método `ImageReviewService.review()`, montar as variáveis contextuais em duas etapas antes de chamar `PromptLoader.load()`:

1. **Resolver placeholders comerciais**: interpolar `discountedPrice`, `badgeText`, `originalPrice` com valores reais do formulário
2. **Montar strings finais**: produzir `expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone`, `campaignIntentLabel` como strings **completamente resolvidas** — sem nenhum placeholder `{{...}}` interno

As variáveis contextuais SHALL substituir o uso direto de `{{discountedPrice}}`, `{{badgeText}}`, `{{originalPrice}}` no corpo dos critérios do prompt. O prompt SHALL conter apenas `{{campaignIntentLabel}}`, `{{expectedPriceBehavior}}`, `{{expectedBadgeBehavior}}`, `{{expectedImageTreatment}}`, `{{expectedCommercialTone}}` como placeholders.

#### Scenario: expectedPriceBehavior para offer contém valor real

- **WHEN** `campaignIntent === "offer"` e `discountedPrice === "R$ 29,90"` (já formatado pelo pipeline)
- **THEN** `expectedPriceBehavior` contém "A imagem DEVE exibir preço promocional. ... O preço com desconto é R$ 29,90."
- **AND** NÃO contém `{{discountedPrice}}`

#### Scenario: expectedPriceBehavior para exclusive não menciona valor

- **WHEN** `campaignIntent === "exclusive"` (sem preço)
- **THEN** `expectedPriceBehavior` contém "A imagem NÃO deve exibir preço."
- **AND** NÃO contém `{{discountedPrice}}` nem valor numérico

#### Scenario: expectedBadgeBehavior para offer com badge

- **WHEN** `campaignIntent === "offer"` e `badgeText !== undefined` e `badgeText !== ""` (ex: "Promoção")
- **THEN** `expectedBadgeBehavior` é: "A imagem DEVE exibir badge promocional. O texto deve ser 'Promoção'. Badge promocional é obrigatório."

#### Scenario: expectedBadgeBehavior para spotlight/exclusive com badge presente

- **WHEN** `campaignIntent` é `"spotlight"` ou `"exclusive"`, e `badgeText !== undefined` e `badgeText !== ""` (ex: "Novidade")
- **THEN** `expectedBadgeBehavior` é: "Badge é opcional, mas foi informado 'Novidade'; se aparecer na imagem, deve bater com o texto exato."

#### Scenario: expectedBadgeBehavior para spotlight/exclusive sem badge

- **WHEN** `campaignIntent` é `"spotlight"` ou `"exclusive"`, e `badgeText` é `undefined`, vazio, ou não informado
- **THEN** `expectedBadgeBehavior` é: "Nenhum badge foi informado; a imagem pode não ter badge. Se a imagem inventar um badge, ele não deve criar promessa promocional indevida."
- **AND** NÃO gera frase com `('')` vazio

#### Scenario: expectedBadgeBehavior respeita intent, não só presença de badgeText

- **WHEN** `campaignIntent === "offer"` e `badgeText === ""` (raro, mas possível)
- **THEN** `expectedBadgeBehavior` ainda SHALL ser "A imagem DEVE exibir badge promocional" — offer sempre espera badge, mesmo que o texto não tenha sido informado
- **AND** o serviço NUNCA aplica a variante "opcional" para offer, independente de `badgeText`

### Requirement: commercial_tone_mismatch como novo tipo de issue

O sistema SHALL adicionar `commercial_tone_mismatch` ao conjunto de tipos de issue reconhecidos pelo `ImageReviewResult`.

A severidade SHALL seguir:

| Condição | Severidade |
|----------|-----------|
| CTA ou badge levemente desalinhados com a intent, mas peça ainda publicável | `minor` |
| CTA contradiz frontalmente a intenção (ex: "Promoção relâmpago" em exclusive), inventa condição comercial relevante, ou reduz confiança do lojista para publicar | `critical` |

#### Scenario: CTA agressivo em exclusive gera commercial_tone_mismatch minor

- **WHEN** o revisor analisa uma imagem exclusive com CTA "Últimas unidades"
- **AND** a peça ainda é publicável (demais dados corretos)
- **THEN** o revisor retorna issue `commercial_tone_mismatch` com severidade `minor`

#### Scenario: CTA promocional em exclusive que contradiz intent gera critical

- **WHEN** o revisor analisa uma imagem exclusive com CTA "Promoção relâmpago — 50% OFF"
- **AND** não há preço na imagem (exclusive)
- **THEN** o revisor retorna issue `commercial_tone_mismatch` com severidade `critical`
- **AND** `passed` é `false`

### Requirement: ReviewIssueType como union nomeada

O sistema SHALL criar um tipo union `ReviewIssueType` em `src/lib/image-generation/schema.ts` para substituir o uso de `string` genérico em `ReviewIssue.type`:

```typescript
export type ReviewIssueType =
  | "wrong_price"
  | "wrong_product_name"
  | "wrong_store_name"
  | "illegible_text"
  | "invented_information"
  | "deformed_product"
  | "weak_visual_quality"
  | "empty_review"
  | "insufficient_image"
  | "review_low_confidence"
  | "generated_product_mismatch"
  | "product_image_conflict"
  | "product_image_low_confidence"
  | "wrong_cta"
  | "bad_composition"
  | "invented_badge"
  | "distorted_product"
  | "commercial_tone_mismatch";
```

A interface `ReviewIssue` SHALL usar `type: ReviewIssueType` em vez de `type: string`:

```typescript
export interface ReviewIssue {
  type: ReviewIssueType;
  severity: "critical" | "minor";
  description: string;
}
```

#### Scenario: ReviewIssue aceita commercial_tone_mismatch como type

- **WHEN** `ReviewIssue` é construído com `{ type: "commercial_tone_mismatch", severity: "minor", description: "..." }`
- **THEN** TypeScript NÃO reporta erro de tipo
- **AND** o tipo é reconhecido pelo union

#### Scenario: ReviewIssue rejeita type inválido

- **WHEN** `ReviewIssue` é construído com `{ type: "invalid_category" }`
- **THEN** TypeScript reporta erro de tipo

### Requirement: Revisor permissivo para escolhas criativas

O revisor SHALL preservar escolhas criativas do diretor quando os dados essenciais (produto, loja, preço quando aplicável, legibilidade) estão corretos. `commercial_tone_mismatch` de severidade `minor` NÃO deve bloquear a geração.

O revisor SHALL bloquear apenas quando:
- Dados comerciais estão errados (preço, produto, loja)
- Texto está ilegível
- A peça contradiz frontalmente a intenção comercial
- Informação comercial não autorizada foi inventada

#### Scenario: Badge levemente deslocado em spotlight não bloqueia

- **WHEN** o revisor analisa uma imagem spotlight com badge "Novidade" posicionado ligeiramente fora do centro
- **AND** preço, produto e loja estão corretos
- **THEN** o revisor NÃO bloqueia a geração
- **AND** pode reportar `commercial_tone_mismatch` como `minor` se o tom for ligeiramente inadequado
