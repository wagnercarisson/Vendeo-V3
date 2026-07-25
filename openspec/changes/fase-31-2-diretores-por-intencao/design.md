## Context

A F31.1 entregou `CampaignIntent` type, `BADGE_OPTIONS_BY_INTENT`, inferência automática, e a UI de seleção com bloqueio explícito para spotlight/exclusive. O pipeline atual usa um prompt único (`campaign-image-director.md` e `campaign-copy-director.md`) com framing 100% promocional, e os schemas do pipeline exigem `discountedPriceCents` obrigatório.

O código-fonte atual tem estes pontos de bloqueio:

| Camada | Arquivo | Linha | Bloqueio |
|--------|---------|-------|----------|
| UI | `campaign-input-form.tsx` | 239-243 | Badge "Em breve" no radio |
| UI | `campaign-input-form.tsx` | 523 | `disabled` quando intent !== offer |
| UI | `campaign-input-form.tsx` | 540-541 | Botão mostra "Disponível em breve" |
| Form | `use-campaign-form.ts` | 560-563 | `handleSubmit` early return |
| Route | `route.ts` | 142-147 | Guard HTTP 400 |
| Schema | `image-generation/schema.ts` | 12 | `discountedPriceCents` required |
| Schema | `campaign-intelligence/schema.ts` | 15-18 | `discountedPriceCents` required |
| Schema | `campaign-intelligence/schema.ts` | 49-54 | `offer.*` strings obrigatórias |
| Service | `image-generation-service.ts` | 833-848 | `assemblePrompt` carrega template fixo |
| Service | `copy-director-service.ts` | 79 | Carrega prompt fixo |
| Mapper | `mapper.ts` | 4-46 | `buildOfferText` exige `discountedPriceCents` |

## Goals / Non-Goals

**Goals:**
- Remover todos os bloqueios de UI, form e pipeline para spotlight/exclusive
- Tornar `discountedPriceCents` opcional nos schemas com validação semântica por intent (não de schema)
- Adaptar `CampaignSpecSchema` para aceitar `null` em `discounted_price_display` e `badge_text`
- Criar 6 prompts (3 image + 3 copy) com conteúdo calibrado por intent
- Selecionar prompt por `campaignIntent` em `assemblePrompt`, `validatePrompts` e `CopyDirectorService`
- Substituir `offer` por `commercialFrame` no Copy Director (string sempre presente)
- Adaptar `buildCommercialRepertoire` e `buildCreativeContextGuidance` por intent
- Injetar `preserveImageDirective` quando `preserveImageContext === true`
- Adaptar fallback determinístico para respeitar intent
- Normalizar exclusive com preço indevido para ausente
- Regressão zero para offer

**Non-Goals:**
- Criar revisores de qualidade por intent (F31.3)
- Validar qualidade visual de spotlight/exclusive (F31.3)
- Reescrever o fluxo do `CampaignIntelligenceService` (legado — tocar só o schema)
- Migrações de banco de dados
- Mudanças no `ImageReviewService` ou revisor de imagem

## Decisions

### D1: Abordagem A para CampaignSpecSchema — campos nullable

**Decisão:** `discounted_price_display` e `badge_text` passam de `z.string().min(1)` para `z.string().nullable()`.

**Alternativa considerada:** Separar `offer` em 3 schemas distintos (`offer`/`spotlight`/`exclusive` cada um com campos próprios). Rejeitada porque mexe no contrato de structured outputs da OpenAI simultaneamente, aumenta risco de regressão, e o schema atual é compartilhado com `CampaignIntelligenceService` legado.

**Por que esta abordagem:** A validação semântica (offer SEMPRE tem preço) fica no serviço, não no schema Zod. Como o schema é usado via `zodResponseFormat` no OpenAI provider, mudar para nullable é a alteração mais segura — a IA pode retornar `null` quando o campo não se aplica.

### D2: Prompt routing sem fallback silencioso

**Decisão:** `assemblePrompt` carrega `campaign-image-director-${campaignIntent}`. Se o prompt não existir para uma intent válida, falha no preflight como `invalid_prompt`. Não há fallback para o prompt antigo.

**Alternativa considerada:** Fallback para `campaign-image-director.md` se o prompt específico não existir. Rejeitada porque poderia gerar uma campanha `exclusive` com framing promocional por engano.

**Regra:** Como o schema faz `.default("offer")`, `campaignIntent` sempre está presente após o parse. A intent `offer` carrega `campaign-image-director-offer`. O arquivo `campaign-image-director.md` original permanece apenas como referência, não como fallback.

### D3: `commercialFrame` no lugar de `offer` no Copy Director

**Decisão:** Substituir `offer: z.string().min(1)` por `commercialFrame: z.string().min(1)` no `CopyDirectorInputSchema`. O campo é sempre uma string presente e não vazia, mas o conteúdo varia por intent, construído pelo mapper.

**Por que:** O prompt de copy usa `{{commercialFrame}}` no lugar de `{{offer}}`. O campo é `z.string().min(1)` — sempre presente e semanticamente útil. Isso permite que o template receba conteúdo semanticamente correto sem mudar a estrutura do prompt:

| Intent | commercialFrame |
|--------|----------------|
| offer | "Promoção: de R$ X por R$ Y" |
| spotlight | "Destaque — R$ X" ou "Destaque do produto" |
| exclusive | "Produto exclusivo — sem divulgação de preço" |

### D4: Normalização de exclusive no início do pipeline

**Decisão:** Normalizar `discountedPriceCents` para `undefined` quando `campaignIntent === "exclusive"` logo após `parsed.data`, depois do guard de legal/auth/ownership e antes de montar `campaignInput`. Com log sem dados sensíveis se antes de ownership, ou com storeId se depois.

**Por que:** Se a normalização acontecesse só na zona pós-paralelo, a IA já teria recebido preço indevidamente. A normalização precoce (depois de auth/ownership/legal) garante que todas as camadas (brief, inputSnapshot, copy input, image prompt) vejam exclusive sem preço, com log seguro incluindo storeId.

### D5: Campanha de offer preserva comportamento sem regressão

**Decisão:** Offer mantém exatamente o mesmo fluxo de antes:
- `assemblePrompt` carrega `campaign-image-director-offer` (conteúdo idêntico ao antigo `campaign-image-director.md`)
- `CopyDirectorService` carrega `campaign-copy-director-offer` (conteúdo idêntico ao antigo `campaign-copy-director.md`, só muda a variável `{{commercialFrame}}` no lugar de `{{offer}}`)
- `buildCommercialRepertoire` e `buildCreativeContextGuidance` mantêm linguagem atual
- `discountedPriceCents` continua obrigatório semanticamente (embora opcional no schema)
- `preserveImageContext` continua normalizado para false

### D6: Revisor único não recebe adaptação semântica

**Decisão:** O `campaign-image-reviewer` permanece único. Para exclusive, passar `discountedPrice` vazio para não quebrar a chamada. Não adaptar critérios de qualidade — isso é F31.3.

**Risco assumido:** O revisor pode rejeitar imagens de exclusive/spotlight por critérios calibrados para oferta. Isso é aceitável porque F31.2 não promete qualidade visual dessas intents.

## Risks / Trade-offs

- **[Prompt não encontrado]** → Falha no preflight. Mitigação: os 6 prompts são criados como parte da fase, validados por `validatePrompts`. Se faltar algum, o erro é capturado antes de qualquer chamada de IA.

- **[Revisor rejeitar exclusive/spotlight]** → Geração falha com `review_low_confidence` ou similar. Mitigação: documentado como limitação conhecida. F31.2 resolve apenas a quebra técnica; F31.3 calibra o revisor.

- **[CampaignSpecSchema nullable pode gerar saída incoerente]** → IA retorna `discounted_price_display: null` mesmo para offer. Mitigação: validação semântica no serviço (`CampaignIntelligenceService`) deve verificar se offer tem preço. Como o fluxo principal hoje não usa esse serviço, o risco é baixo.

- **[commercialFrame quebra prompts existentes]** → Se algum teste ou serviço ainda referenciar `{{offer}}`, vai falhar. Mitigação: os 3 prompts de copy oficiais usam `{{commercialFrame}}`. O arquivo `campaign-copy-director.md` original mantém `{{offer}}` mas não é mais carregado.

- **[discountedPriceCents opcional mascara erro de formulário]** → Usuário pode esquecer de preencher preço em offer. Mitigação: validação semântica no frontend (`validateDiscountedPrice` da F31.1) continua exigindo preço quando intent é offer; e validação backend no endpoint (após auth/ownership/legal, antes de `campaignInput`), retornando HTTP 400 se offer sem preço.
