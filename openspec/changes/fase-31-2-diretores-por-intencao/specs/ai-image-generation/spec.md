# AI Image Generation

> Modified by `fase-31-2-diretores-por-intencao`.

## MODIFIED Requirements

### Requirement: GenerateImageRequestSchema com discountedPriceCents opcional

O schema `GenerateImageRequestSchema` em `src/lib/image-generation/schema.ts` SHALL ter `discountedPriceCents` alterado para opcional:

```typescript
discountedPriceCents: z.number().int().positive().optional()
```

Os campos `campaignIntent` e `preserveImageContext` (adicionados na F31.1) permanecem inalterados.

#### Scenario: discountedPriceCents opcional aceito pelo schema

- **WHEN** o body omite `discountedPriceCents` com `campaignIntent: "exclusive"`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true }`

### Requirement: assemblePrompt seleciona template por campaignIntent

O sistema SHALL modificar `assemblePrompt()` para carregar `campaign-image-director-${campaignIntent}` no lugar do template fixo.

Sem fallback silencioso: se o prompt não existir para intent válida, o sistema SHALL falhar no preflight como `invalid_prompt`. O arquivo `campaign-image-director.md` original não é fallback.

#### Scenario: assemblePrompt carrega template por intent

- **WHEN** `assemblePrompt()` é chamado com `campaignIntent: "exclusive"`
- **THEN** carrega `campaign-image-director-exclusive.md`

### Requirement: buildPromptVariables inclui campaignIntent e preserveImageDirective

O sistema SHALL estender `buildPromptVariables()` para incluir:

- `campaignIntent` — string, valor da intent
- `preserveImageDirective` — string, instrução condicional (vazia para offer, `"NÃO recortar..."` para spotlight/exclusive com preserveImageContext=true)
- `commercialFrame` — string, texto comercial por intent (oferta/destaque/exclusivo)
- `discountedPrice` e `originalPrice` condicionais por intent (vazio quando não aplicável)

Todas as variáveis existentes permanecem.

#### Scenario: buildPromptVariables inclui commercialFrame

- **WHEN** `buildPromptVariables()` é chamado com brief de `campaignIntent: "spotlight"`
- **THEN** as variáveis incluem `commercialFrame` com texto de destaque

### Requirement: buildCommercialRepertoire adaptado por intent

O sistema SHALL modificar `buildCommercialRepertoire()` para filtrar conteúdo por intent:

| Funcionalidade | offer | spotlight | exclusive |
|---------------|-------|-----------|-----------|
| Escassez ("poucas unidades") | sim | não | sim (se aplicável) |
| Validade ("até dd/mm") | sim | não | não |
| Detalhes da campanha | sim | sim | sim |
| Detalhes adicionais | sim | sim | sim |
| Benefícios do produto | contextual | sim | sim |
| Caráter exclusivo | não | não | sim |

#### Scenario: buildCommercialRepertoire para spotlight omite escassez

- **WHEN** `buildCommercialRepertoire()` é chamado com `campaignIntent: "spotlight"` e `availabilityNotes: "poucas unidades"`
- **THEN** o retorno NÃO contém a nota de escassez

### Requirement: buildCreativeContextGuidance adaptado por intent

O sistema SHALL modificar `buildCreativeContextGuidance()` para usar framing adequado:

- **offer**: manter "Preço é oportunidade/vantagem" (comportamento atual)
- **spotlight**: substituir "Preço é..." por "Benefício é..." ou "Diferencial é..."
- **exclusive**: substituir framing de preço por framing de valor percebido

#### Scenario: buildCreativeContextGuidance para spotlight evita framing de preço

- **WHEN** `buildCreativeContextGuidance()` é chamado com segmento e categoria para spotlight
- **THEN** o texto NÃO contém "Preço é"
- **AND** contém framing de benefício ou descoberta

## ADDED Requirements

### Requirement: Validação backend de offer sem preço

O sistema SHALL validar no endpoint, após parse e auth/ownership/legal e antes de montar `campaignInput`, que `campaignIntent === "offer"` requer `discountedPriceCents` presente e positivo. Se ausente ou zero, retornar HTTP 400 com mensagem "Preço com desconto é obrigatório para ofertas".

#### Scenario: offer sem discountedPriceCents retorna 400

- **WHEN** POST para `/api/campaign/generate-image` com `campaignIntent: "offer"` e sem `discountedPriceCents`
- **THEN** retorna HTTP 400 com mensagem "Preço com desconto é obrigatório para ofertas"
- **AND** sem stream

### Requirement: validatePrompts valida director por intent

O sistema SHALL validar o template `campaign-image-director-${campaignIntent}` em `validatePrompts()`. Se o prompt não existir, retorna `{ valid: false, errors: [...] }`.

O `discountedPrice` passado ao revisor (`campaign-image-reviewer`) SHALL ser vazio quando `campaignIntent === "exclusive"`.

#### Scenario: validatePrompts valida exclusive director

- **WHEN** `validatePrompts()` é chamado para intent `"exclusive"`
- **THEN** valida `campaign-image-director-exclusive.md`
- **AND** valida `campaign-image-reviewer.md` com `discountedPrice` vazio

### Requirement: POST /api/campaign/generate-image sem guard de intent

O endpoint SHALL NÃO bloquear requisições com `campaignIntent !== "offer"`. O guard HTTP 400 adicionado na F31.1 SHALL ser removido.

#### Scenario: Spotlight passa pelo endpoint

- **WHEN** POST para `/api/campaign/generate-image` com `campaignIntent: "spotlight"`
- **THEN** o endpoint NÃO retorna HTTP 400
- **AND** o fluxo prossegue normalmente

### Requirement: Fallback determinístico buildDeterministicCopy

O sistema SHALL implementar `buildDeterministicCopy(campaignIntent, params)` para o fallback do Copy Director quando desligado:

- offer: `"{{productName}} — {{badgeText}}: de R$ X por R$ Y"`
- spotlight: `"{{productName}} — Novo na {{storeName}}!"` (com preço se disponível)
- exclusive: `"{{productName}} — Exclusivo na {{storeName}}!"` (sem preço, sem badge promocional)

#### Scenario: Fallback para exclusive não menciona preço

- **WHEN** `buildDeterministicCopy("exclusive", { productName: "Produto X", storeName: "Loja Y" })` é chamado
- **THEN** retorna texto sem preço ou badge promocional
