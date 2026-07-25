# Alinhamento Fase 31.2 — Diretores por Intenção (v1.5)

## Contexto

A Fase 31.1 preparou o terreno: o Vendeo agora sabe se uma campanha é `offer`, `spotlight` ou `exclusive`. Mas o diretor de imagem e o copy director ainda usam o mesmo prompt único — sempre com framing promocional, sempre assumindo `DE / POR`, sempre com badge "Promoção" e urgência.

Além disso, a F31.1 deixou **três bloqueios explícitos** para spotlight e exclusive:
1. **UI**: seletor de intent marca "Em breve" e botão "Criar Campanha" fica desabilitado
2. **Form**: `handleSubmit` retorna cedo com erro se intent ≠ offer
3. **Pipeline**: guard HTTP 400 rejeita qualquer intent ≠ offer no pré-stream

E dois **bloqueios contratuais**:
4. `discountedPriceCents` é obrigatório nos schemas do pipeline (impede exclusive)
5. `CampaignSpecSchema` exige `offer.discounted_price_display` e `offer.badge_text` como strings obrigatórias (impede qualquer saída sem preço ou badge)

Esta fatia **desbloqueia, roteia e adapta** as três intenções — desde o formulário até a entrega dos diretores de imagem e copy.

```
F31.1 entrega:
  campaignIntent: "offer" | "spotlight" | "exclusive"  ← tipo definido
  preserveImageContext: boolean                          ← campo no form
  inferência automática                                  ← DE → offer, só preço → spotlight, nada → exclusive
  bloqueios: UI, form, route guard                      ← intencional, desbloqueado agora

F31.2 adiciona:
  ┌─ DESBLOQUEIO ──────────────────────────────────────────────┐
  │ • UI: remove "Em breve", habilita submit para todas intents │
  │ • Form: remove guard early-return                           │
  │ • Route: remove guard HTTP 400                              │
  ├─ CONTRATOS ─────────────────────────────────────────────────┤
  │ • discountedPriceCents opcional nos schemas do pipeline     │
  │ • CampaignSpecSchema adaptado por intent                    │
  ├─ ROTEAMENTO ────────────────────────────────────────────────┤
  │ • Prompt de imagem selecionado por intent (sem fallback     │
  │   silencioso — falta de prompt é erro de preflight)         │
  │ • Prompt de copy selecionado por intent                     │
  │ • CopyDirectorInput agora carrega campaignIntent            │
  ├─ ADAPTAÇÃO DE CONTEÚDO ─────────────────────────────────────┤
  │ • buildCommercialRepertoire e buildCreativeContextGuidance   │
  │   adaptados por intent (tom, framing, urgência)             │
  │ • preserveImageContext vira instrução real no prompt        │
  │ • Fallback determinístico de copy respeita intent           │
  └─────────────────────────────────────────────────────────────┘

  (revisor de qualidade unificado — adiado para F31.3)
```

---

## Propósito

1. **Desbloquear** spotlight e exclusive no formulário, submit e pipeline
2. **Aceitar** `discountedPriceCents` como opcional nos schemas (exclusive não tem preço; spotlight tem preço único)
3. **Adaptar** `CampaignSpecSchema` para aceitar saída sem badge e sem preço quando a intent não for offer
4. **Separar** o prompt `campaign-image-director.md` em 3 templates por intent
5. **Criar** 3 prompts de copy director por intent
6. **Adaptar** `ImageGenerationService.buildPromptVariables` + `assemblePrompt()` + `validatePrompts()` para selecionar template por `campaignIntent`
7. **Adaptar** `CopyDirectorService` para receber `campaignIntent` e carregar prompt correspondente
8. **Adaptar** `mapBriefToCopyDirectorInput` para montar texto comercial condicional por intent
9. **Adaptar** `buildCommercialRepertoire` e `buildCreativeContextGuidance` para tom por intent
10. **Injetar** `preserveImageDirective` no prompt de imagem quando `preserveImageContext === true`
11. **Garantir** que o fallback determinístico de copy (quando copy director está desligado) respeite a intent

**Não faz parte desta fatia:**
- Criar revisores por intent (será na F31.3)
- Testes de qualidade visual das novas intenções (será na F31.3)
- Garantir que campanhas spotlight/exclusive sejam publicáveis com qualidade visual (critério de F31.3)

**O que F31.2 garante:** intents chegam aos diretores corretos, contratos não quebram, pipeline não rejeita. **O que F31.2 não garante:** que o resultado visual de spotlight/exclusive seja publicável — isso é critério de F31.3.

---

## Contratos e Desbloqueio

### 5.1 `discountedPriceCents` — Opcional nos Schemas

| Schema | Estado Atual | Estado F31.2 |
|--------|-------------|--------------|
| `GenerateImageRequestSchema` (image-generation/schema.ts:12) | `z.number().int().positive()` (required) | `z.number().int().positive().optional()` |
| `CampaignGenerationInputSchema` (campaign-intelligence/schema.ts:15-18) | `z.number().int().positive()` (required) | `z.number().int().positive().optional()` |
| `InputSnapshot` (campaign/types.ts:37) | `discountedPriceCents: number` (required) | `discountedPriceCents?: number` |

**Validação semântica por intent (regra de negócio, não de schema):**

| Intent | discountedPriceCents | Comportamento |
|--------|---------------------|---------------|
| `offer` | **obrigatório** | A inferência da F31.1 sempre gera offer quando DE+POR estão presentes. Sempre exibido como "de R$ X por R$ Y". |
| `spotlight` | **normalmente presente** | A inferência gera spotlight justamente por ter preço único (sem DE). É o caso normal esperado, mas o schema aceita opcional por tolerância. Se ausente, o diretor de imagem não exibe preço. |
| `exclusive` | **sempre omitido** | A inferência gera exclusive justamente por ausência de preço. O form não envia preço. Se o backend receber preço com exclusive, deve **normalizar para ausente** (com log de warning) — não apenas ignorar. |

### 5.2 `CampaignSpecSchema` — Adaptado por Intent

**Estado atual (impeditivo):**
```typescript
offer: z.object({
  product_name: z.string().min(1),
  original_price_display: z.string().nullable(),
  discounted_price_display: z.string().min(1),  // ← IMPEDITIVO para exclusive
  badge_text: z.string().min(1),                 // ← IMPEDITIVO para spotlight/exclusive sem badge
})
```

**Mudança — Abordagem A (aprovada):** `discounted_price_display` e `badge_text` tornam-se nullable:

```typescript
offer: z.object({
  product_name: z.string().min(1),
  original_price_display: z.string().nullable(),
  discounted_price_display: z.string().nullable(),  // ← nullable
  badge_text: z.string().nullable(),                 // ← nullable
})
```

Isso permite que a IA retorne `null` nesses campos quando não aplicável. A validação semântica (offer SEMPRE tem preço) fica no serviço, não no schema — já que o schema é compartilhado com a IA via structured outputs.

**Nota:** Schema diferenciado (separar `offer`/`spotlight`/`exclusive` com campos próprios) fica para F31.3 se necessário. Nesta fase, mexer só nos nullables reduz risco de regressão.

### 5.3 Normalização de `exclusive` com Preço Indevido

O schema aceita `discountedPriceCents` como opcional, mas exclusive não deve transportar preço. A normalização deve acontecer **antes** de qualquer processamento — brief, inputSnapshot, copy input, image prompt.

```
// route.ts — após auth/ownership/legal, antes de montar campaignInput:
// (entre o guard legal ~line 139 e a desestruturação ~line 150)

if (parsed.data.campaignIntent === "exclusive" && parsed.data.discountedPriceCents !== undefined) {
  console.warn(
    "[generate-image] exclusive com discountedPriceCents presente — normalizando para ausente."
  );
  parsed.data.discountedPriceCents = undefined;
}
```

Isso garante que a IA nunca receba preço quando a intenção é exclusive. Como a normalização executa depois de auth/ownership/legal, o log pode incluir `storeId` com segurança.

### 5.4 Locais de Bloqueio a Remover

```
┌─ CAMADA UI ───────────────────────────────────────┐
│ campaign-input-form.tsx:523                        │
│   disabled={... || fields.campaignIntent !== "offer"} │  → REMOVER condição
│                                                    │
│ campaign-input-form.tsx:239-243                    │
│   <span>"Em breve"</span> no radio spotlight/exclusive → REMOVER
│                                                    │
│ campaign-input-form.tsx:540-541                    │
│   Botão mostra "Disponível em breve"               │  → REMOVER, mostrar "Criar Campanha"
├─ CAMADA FORM ──────────────────────────────────────┤
│ use-campaign-form.ts:560-563                       │
│   if (campaignIntent !== "offer") → early return   │  → REMOVER
├─ CAMADA ROUTE ─────────────────────────────────────┤
│ route.ts:142-147                                   │
│   Guard HTTP 400 se != offer                       │  → REMOVER
│                                                    │
│ route.ts:294-297                                   │
│   inputSnapshot.preserveImageContext                │  → JÁ está correto (normaliza para offer)
└────────────────────────────────────────────────────┘
```

---

## Conteúdo dos Prompts

### Diretor de Imagem — `offer`

Baseado no `campaign-image-director.md` atual. Mantém:

- Preço `DE / POR` com riscado
- Badge promocional obrigatório
- Hook e CTA na composição
- Hierarquia: produto > preço > loja > CTA
- Produto como herói isolado (recorte)
- Tom de urgência e barganha
- `preserveImageContext` NÃO se aplica — promoção precisa de isolamento

### Diretor de Imagem — `spotlight`

Novo template. Remove elementos puramente promocionais:

- Preço único exibido (sem riscado, sem "DE")
- Se não houver preço, não exibir preço na arte
- Badge pode existir (Novidade, Lançamento, Mais Vendido)
- Foco em apresentação do produto: características, design, benefícios
- Hierarquia: produto > nome > descrição curta > preço (se houver) > loja
- Pode ter `preserveImageContext` = a composição se adapta ao fundo
- Tom de desejo, vitrine, novidade
- CTA menos agressivo ("Saiba mais", "Confira", "Disponível")

### Diretor de Imagem — `exclusive`

Novo template. Sem preço na arte:

- Sem exibição de preço (mesmo que o payload contenha — normalizado no backend)
- Badge opcional (Exclusivo, Premium, Sob Encomenda)
- Foco em valor percebido, sofisticação, artesanal, não replicável
- Hierarquia: produto > nome > badge/identidade
- `preserveImageContext` aplicável — foto contextual valoriza a exclusividade
- Tom de desejo, exclusividade, premium
- Sem CTA agressivo — "Disponível na loja", "Consulte-nos"

### Copy Director — `offer`

Baseado no `campaign-copy-director.md` atual. Preserva:

- "Aproveite", "Últimas unidades", "Promoção por tempo limitado"
- Frame de desconto: "de R$ X por R$ Y"
- Urgência e escassez
- CTA direto de compra

### Copy Director — `spotlight`

Novo template:

- Frame de novidade/destaque: "Acabou de chegar", "O mais vendido"
- Foco em benefício do produto, não no desconto
- Se houver preço: "A partir de R$ X" ou "R$ X"
- Se não houver preço: sem menção a valor
- "Confira na loja", "Disponível"
- Tom de descoberta, recomendação

### Copy Director — `exclusive`

Novo template:

- Frame de exclusividade: "Sob encomenda", "Peça única", "Feito pra você"
- Sem referência a preço ou desconto
- Foco em valor percebido, processo artesanal, diferenciação
- Tom de sofisticação, cuidado, curadoria

---

## Pipeline: Roteamento por Intent

```
POST /api/campaign/generate-image
  → request.body.campaignIntent (vindo do form)
  → inputSnapshot.campaignIntent

ImageGenerationService
  ├── buildPromptVariables(body, ..., brief)
  │     → Monta variáveis (inclusive preserveImageDirective)
  │     → discountedPrice formatado condicionalmente:
  │         offer:  discountedPrice = R$ X (sempre presente)
  │         spotlight: discountedPrice = R$ X (se houver) ou vazio
  │         exclusive: discountedPrice = "" (sempre vazio — normalizado)
  │     → Adiciona campaignIntent às variáveis
  │     → Adiciona commercialFrame (string sempre presente):
  │         offer:     "Promoção: de R$ X por R$ Y"
  │         spotlight: "Destaque — R$ X" ou "Destaque do produto"
  │         exclusive: "Produto exclusivo — sem divulgação de preço"
  │
  ├── assemblePrompt(state, variables, previousIssues)
  │     → promptLoader.load(`campaign-image-director-${campaignIntent}`, vars)
  │     → SEM FALLBACK: o schema garante que campaignIntent estará sempre
  │       presente (default "offer" após parse). Não há "intent ausente"
  │       em tempo de execução — apenas a intent "offer" carrega
  │       campaign-image-director-offer. Se uma intent válida não tiver
  │       prompt correspondente, falha no preflight como invalid_prompt
  │       — evitar gerar exclusive com framing promocional por engano.
  │     → O arquivo campaign-image-director.md original permanece como
  │       referência/compatibilidade, mas NÃO é ponto de fallback no fluxo.
  │
  └── validatePrompts(brief)
        → Valida director: `campaign-image-director-${campaignIntent}`
        → Se prompt não existe → { valid: false, errors: [...] }
        → Valida reviewer: `campaign-image-reviewer` (único — F31.3)
        → discountedPrice no reviewer = "" quando exclusive (para não quebrar)

Copy Director (paralelo)
  ├── CopyDirectorInput agora inclui campaignIntent
  │     CopyDirectorInputSchema → + campaignIntent: z.enum([...]).optional().default("offer")
  │     → Campo `offer` substituído por `commercialFrame: z.string()`
  │         (sempre presente, conteúdo varia por intent)
  │
  ├── CopyDirectorService.generateCopy(input)
  │     → promptLoader.load(`campaign-copy-director-${input.campaignIntent}`, vars)
  │     → SEM FALLBACK (mesma regra do image director): intent válida sem
  │       prompt correspondente → erro. O prompt campaign-copy-director.md
  │       original não é fallback, apenas referência.
  │
  └── mapBriefToCopyDirectorInput(brief, input)
        → offer:  commercialFrame = buildOfferText("de R$ X por R$ Y")
        → spotlight: commercialFrame = "Destaque — R$ X" ou "Destaque do produto"
        → exclusive: commercialFrame = "Produto exclusivo — sem divulgação de preço"
```

### Fallback Determinístico (quando copy director desligado)

Em `route.ts:380-394`, o fallback atual chama `buildOfferText` incondicionalmente:

```
// Estado atual (quebrado para exclusive):
const offerText = buildOfferText({
  badgeText, originalPriceCents, discountedPriceCents  // ← falha se sem preço
});

// Estado F31.2:
const fallbackCopy = buildDeterministicCopy(campaignIntent, {
  productName, storeName, badgeText, originalPriceCents, discountedPriceCents
});

Onde buildDeterministicCopy:
  offer:     "{{productName}} — {{badgeText}}: de R$ X por R$ Y"
  spotlight: "{{productName}} — Novo na {{storeName}}!"
             (se discountedPriceCents presente: "a partir de R$ X")
  exclusive: "{{productName}} — Exclusivo na {{storeName}}!"
             (sem preço, sem badge promocional)
```

### preserveImageContext — Diretiva Condicional

| Intent | preserveImageContext | Comportamento |
|--------|---------------------|---------------|
| offer | qualquer valor | Ignorado, normalizado para false. Diretor sempre isola/recorta o produto. |
| spotlight | true | Injetar `preserveImageDirective` no prompt: "NÃO recortar o produto. Preservar o contexto original da imagem. Adaptar a composição ao redor do produto sem isolá-lo. Legibilidade continua obrigatória." |
| spotlight | false/omitido | Diretor pode isolar ou recortar se fizer sentido |
| exclusive | true | Injetar mesma directive. O contexto valoriza a exclusividade. |
| exclusive | false/omitido | Diretor decide |

---

## `buildCommercialRepertoire` e `buildCreativeContextGuidance` por Intent

### `buildCommercialRepertoire` — Conteúdo por Intent

**Estado atual (image-generation-service.ts:629-684):** linguagem 100% oferta — escassez, validade, urgência.

**F31.2:**

| Funcionalidade | offer | spotlight | exclusive |
|---------------|-------|-----------|-----------|
| Escassez ("poucas unidades") | ✅ sim | ❌ não | ✅ sim (se aplicável) |
| Validade ("até dd/mm") | ✅ sim | ❌ não | ❌ não |
| Detalhes da campanha | ✅ sim | ✅ sim | ✅ sim |
| Detalhes adicionais | ✅ sim | ✅ sim | ✅ sim |
| Benefícios do produto | contextual | ✅ sim | ✅ sim |
| Caráter exclusivo | ❌ não | ❌ não | ✅ sim |

### `buildCreativeContextGuidance` — Tom por Intent

**Estado atual (image-generation-service.ts:705-748):** toda guidance menciona "Preço é X" — oportunidade, vantagem, investimento, mimo, convite.

**F31.2:** Cada categoria de guidance deve ser revisada para:

- **offer**: manter linguagem atual (preço = oportunidade/vantagem)
- **spotlight**: substituir "Preço é..." por "Benefício é..." ou "Diferencial é...". Ex: "Valorize descoberta e qualidade. Preço é informação, não motivo principal."
- **exclusive**: substituir framing de preço por framing de valor percebido. Ex: "Valorize curadoria e exclusividade. O valor está na raridade, não no preço."

---

## Nota sobre o Revisor (F31.2)

O revisor de imagem (`campaign-image-reviewer` + `ImageReviewService`) permanece **único** nesta fatia — a adaptação por intent será feita na F31.3.

**Limitação conhecida:** O revisor atual pode rejeitar imagens de exclusive/spotlight por ausência de preço ou badge, já que seus critérios de qualidade foram calibrados para oferta promocional.

**O que F31.2 deve fazer:**
- Passar `discountedPrice` vazio para o revisor quando exclusive, para não quebrar a chamada
- Não tentar resolver a semântica de qualidade por intent

**O que F31.3 deve fazer:**
- Adaptar os critérios do revisor por intent
- Validar qualidade visual ponta a ponta para as 3 intenções

Se o revisor bloquear tecnicamente a geração de exclusive/spotlight, a F31.2 deve no mínimo não quebrar — mas a validação plena fica para F31.3.

---

## Nota sobre CampaignIntelligenceService / OpenAI Provider

O `CampaignIntelligenceService` e seus provedores (`openai.ts`, `mock.ts`) ainda existem como legado da arquitetura anterior. Embora o fluxo principal de geração hoje passe pelo `ImageGenerationService` + `CopyDirectorService` (não pelo `CampaignIntelligenceService`), eles compartilham o `CampaignSpecSchema`.

**Escopo na F31.2:**
- Apenas o necessário para não quebrar: tornar `discounted_price_display` e `badge_text` nullable no schema
- Ajustar o `MockProvider` para aceitar null nesses campos
- Não ampliar a fase para reescrever o fluxo do campaign-intelligence

O `OpenAIProvider` está mapeado como arquivo afetado porque o schema compartilhado pode impactar structured outputs, mas a mudança é apenas reflexa — o prompt do provider deve ser ajustado para não hardcodar `discountedPriceCents` como obrigatório.

---

## Arquivos Afetados

### Prompts (criar)

| Arquivo | Base |
|---------|------|
| `prompts/campaign-image-director-offer.md` | Cópia do `campaign-image-director.md` atual (sem alterações) |
| `prompts/campaign-image-director-spotlight.md` | Novo — foco em vitrine, desejo, sem urgência promocional |
| `prompts/campaign-image-director-exclusive.md` | Novo — sem preço, foco em valor percebido, premium |
| `prompts/campaign-copy-director-offer.md` | Baseado no `campaign-copy-director.md` atual, preservando comportamento, mas trocando a variável `{{offer}}` por `{{commercialFrame}}` |
| `prompts/campaign-copy-director-spotlight.md` | Novo — copy de novidade/destaque |
| `prompts/campaign-copy-director-exclusive.md` | Novo — copy de exclusividade/sem preço |

### Código — Contratos e Desbloqueio

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/schema.ts:12` | `discountedPriceCents: z.number().int().positive().optional()` |
| `src/lib/campaign-intelligence/schema.ts:15-18` | `discountedPriceCents: z.number().int().positive().optional()` |
| `src/lib/campaign-intelligence/schema.ts:49-54` | `CampaignSpecSchema.offer.discounted_price_display` e `badge_text` → `z.string().nullable()` |
| `src/lib/campaign/types.ts:37` | `InputSnapshot.discountedPriceCents?: number` |
| `src/components/flow/campaign-input-form.tsx:239-243` | Remover badge "Em breve" do IntentSelector |
| `src/components/flow/campaign-input-form.tsx:523` | Remover `fields.campaignIntent !== "offer"` do disabled |
| `src/components/flow/campaign-input-form.tsx:540-541` | Remover condicional "Disponível em breve" no botão |
| `src/components/flow/use-campaign-form.ts:560-563` | Remover guard early-return do handleSubmit |
| `src/app/api/campaign/generate-image/route.ts:142-147` | Remover guard HTTP 400 |
| `src/app/api/campaign/generate-image/route.ts:149` | Inserir normalização: exclusive com `discountedPriceCents` → undefined (com log) |

### Código — Roteamento dos Diretores

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/services/image-generation-service.ts:833-848` | `assemblePrompt`: carregar `campaign-image-director-${campaignIntent}`. Se prompt não existir, preflight falha. Sem fallback — intent sempre presente (default "offer" após parse). |
| `src/lib/image-generation/services/image-generation-service.ts:765-830` | `buildPromptVariables`: adicionar `campaignIntent`, `preserveImageDirective`, `commercialFrame` (sempre presente), `discountedPrice` condicional |
| `src/lib/image-generation/services/image-generation-service.ts:546-576` | `validatePrompts`: validar director por `campaignIntent`; falhar se prompt não existe; `discountedPrice` do reviewer vazio quando exclusive |
| `src/lib/copy/schema.ts:3-15` | `CopyDirectorInputSchema`: adicionar `campaignIntent: z.enum(["offer","spotlight","exclusive"]).optional().default("offer")`. Substituir `offer` por `commercialFrame: z.string()` (sempre presente, conteúdo variável por intent). |
| `src/lib/copy/mapper.ts:4-46` | `buildOfferText` → `buildCommercialFrame` (intent-aware). `mapBriefToCopyDirectorInput` monta `commercialFrame` por intent. |
| `src/lib/copy/copy-director-service.ts:65-79` | Carregar `campaign-copy-director-${input.campaignIntent}`. Sem fallback silencioso. Variável `{{commercialFrame}}` no lugar de `{{offer}}`. |

### Código — Adaptação de Conteúdo

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/services/image-generation-service.ts:629-684` | `buildCommercialRepertoire`: filtrar escassez/validade por intent |
| `src/lib/image-generation/services/image-generation-service.ts:705-748` | `buildCreativeContextGuidance`: substituir "Preço é..." por framing adequado a cada intent |
| `src/app/api/campaign/generate-image/route.ts:380-394` | Fallback determinístico: `buildDeterministicCopy(campaignIntent, ...)` em vez de `buildOfferText` |


### Código — Ajustes nos Provedores

| Arquivo | Mudança |
|---------|---------|
| `src/lib/campaign-intelligence/providers/mock.ts` | `offer.discounted_price_display` e `badge_text` agora aceitam null |
| `src/lib/campaign-intelligence/providers/openai.ts` | Prompt trata `discountedPriceCents` como opcional |

---

## Checklist de Entrega

### Bloco 1 — Contratos e Desbloqueio

- [ ] `discountedPriceCents` opcional em `GenerateImageRequestSchema`
- [ ] `discountedPriceCents` opcional em `CampaignGenerationInputSchema`
- [ ] `InputSnapshot.discountedPriceCents` opcional
- [ ] `CampaignSpecSchema.offer.discounted_price_display` e `badge_text` nullable
- [ ] MockProvider adaptado para `null`
- [ ] Badge "Em breve" removido do IntentSelector
- [ ] Submit habilitado para todas as intents na UI
- [ ] Botão mostra "Criar Campanha" para todas as intents
- [ ] Guard early-return do handleSubmit removido
- [ ] Guard HTTP 400 da route removido
- [ ] exclusive com discountedPriceCents presente → normalizado para ausente (com log)
- [ ] `npm run typecheck` limpo
- [ ] `npm run test` — regressão zero (testes existentes continuam passando)

### Bloco 2 — Roteamento dos Diretores

- [ ] Prompt `campaign-image-director-offer.md` = cópia do atual, funcionando sem regressão
- [ ] Prompt `campaign-image-director-spotlight.md` criado
- [ ] Prompt `campaign-image-director-exclusive.md` criado
- [ ] Prompt `campaign-copy-director-offer.md` = baseado no atual, trocando `{{offer}}` por `{{commercialFrame}}`
- [ ] Prompt `campaign-copy-director-spotlight.md` criado
- [ ] Prompt `campaign-copy-director-exclusive.md` criado
- [ ] `assemblePrompt` carrega sempre `campaign-image-director-${campaignIntent}`; se não existir, preflight falha
- [ ] `validatePrompts` valida o director correto por intent
- [ ] `validatePrompts` falha se prompt do director não existe
- [ ] `CopyDirectorInputSchema` inclui `campaignIntent` e `commercialFrame`
- [ ] `CopyDirectorService` carrega `campaign-copy-director-${input.campaignIntent}`
- [ ] `mapBriefToCopyDirectorInput` monta `commercialFrame` por intent
- [ ] `buildCommercialFrame` (ex-buildOfferText): offer="de X por Y", spotlight="R$ X"/vazio, exclusive=sem preço

### Bloco 3 — Adaptação de Conteúdo

- [ ] `buildCommercialRepertoire` filtra escassez/validade por intent
- [ ] `buildCreativeContextGuidance` usa framing adequado (preço vs benefício vs exclusividade)
- [ ] `preserveImageDirective` injetada no prompt quando aplicável
- [ ] Fallback determinístico (`buildDeterministicCopy`) respeita intent
- [ ] OpenAI provider trata discountedPriceCents como opcional
- [ ] Revisor único: discountedPrice vazio não quebra para exclusive

### Bloco 4 — Testes de Regressão Técnica

- [ ] Teste: `GenerateImageRequestSchema` aceita spotlight sem `discountedPriceCents`
- [ ] Teste: `GenerateImageRequestSchema` aceita exclusive sem `discountedPriceCents`
- [ ] Teste: `CampaignSpecSchema` aceita `discounted_price_display: null` para exclusive
- [ ] Teste: Endpoint aceita `campaignIntent: "spotlight"` (sem HTTP 400)
- [ ] Teste: Endpoint aceita `campaignIntent: "exclusive"` (sem HTTP 400)
- [ ] Teste: exclusive com preço → normalizado para ausente (com log)
- [ ] Teste: Offer sem regressão — mesmo input → mesmo resultado
- [ ] Teste: `CopyDirectorService` carrega prompt correto por intent
- [ ] Teste: `assemblePrompt` falha no preflight se prompt de intent válida não existe
- [ ] Teste: Fallback determinístico gera texto diferente por intent
- [ ] `npx vitest run` — todos os testes passando
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx next lint` — zero erros
- [ ] `npx next build` — compila com sucesso
