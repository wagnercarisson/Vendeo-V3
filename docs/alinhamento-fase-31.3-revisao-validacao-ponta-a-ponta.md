# Alinhamento Fase 31.3 — Quality Gate por Intenção Comercial (v1.5)

## Contexto

As Fases 31.1 e 31.2 entregaram:

- **31.1** — Modelo comercial: `CampaignIntent` como tipo, formulário com seletor de intent, inferência automática, badge condicional, `preserveImageContext`
- **31.2** — Diretores por intenção: schemas tolerantes, bloqueios removidos, 6 prompts de diretor (3 imagem + 3 copy), roteamento por intent, conteúdo adaptado

O que **não** foi feito e é o centro da 31.3:

```
┌─ F31.1 entrega ──────┐   ┌─ F31.2 entrega ────────┐   ┌─ F31.3 entrega ────────────┐
│                       │   │                         │   │                            │
│  campaignIntent type  │   │  Schemas tolerantes     │   │  Revisor intent-aware      │
│  inferência automática│   │  Desbloqueio UI/route   │   │  Prompt c/ variáveis       │
│  badge condicional    │   │  6 prompts de diretor   │   │  contextuais               │
│  preserveImageContext │   │  Roteamento por intent  │   │  validatePrompts adaptado  │
│  bloqueios (intenc.)  │   │  Conteúdo adaptado      │   │  UAT real 5 cenários       │
│                       │   │                         │   │  Evidência visual/publicab.│
└───────────────────────┘   └─────────────────────────┘   └────────────────────────────┘
```

**Problema que persiste:** o `ImageReviewService` e seu prompt `campaign-image-reviewer.md` continuam calibrados para campanha promocional (`offer`). Esperam preço com desconto, badge promocional, CTA de urgência. Para `spotlight` e `exclusive`, isso gera:

- Falso negativo: rejeitar `exclusive` porque "faltou preço na imagem"
- Falso rigor promocional: criticar `spotlight` por não ter "DE/POR" ou badge
- Barreira de publicabilidade: campanhas que passam nos diretores mas são barradas na revisão

---

## Propósito

1. **Adaptar** o `ImageReviewService` para ser **intent-aware**: receber `campaignIntent` e usar variáveis contextuais no prompt que eliminam placeholders vazios e orientam a IA por intent
2. **Ajustar** `validatePrompts` para pré-validar o prompt do revisor com variáveis de intent, evitando falso seguro em preflight
3. **Verificar** que `InputValidationService` não presume preço/badge (apenas verificação, não adaptação)
4. **Executar** 5 cenários E2E **com geração real via IA** — formulário → pipeline → campanha → revisão → evidência visual
5. **Validar** publicabilidade: hierarquia, legibilidade, coerência comercial, adequação à intent

**Não faz parte desta fatia:**

- Criação de prompts ou schemas de diretores (já estão em 31.1/31.2)
- Infraestrutura de A/B testing entre intenções
- Métricas de conversão por tipo de campanha
- Mocks como único meio de validação de UAT (entram só para contrato/drift)
- Criação de prompts de revisor separados por intent (prompt único, decisão D5)

---

## Decisões de Implementação

### D1 — Quality Gate, não "mais testes E2E"

A 31.3 é posicionada como **Quality Gate por intenção comercial**. O entregável central é: `spotlight` e `exclusive` passam pelo revisor sem sabotagem de critérios herdados, e a prova disso é uma campanha real gerada e avaliada como publicável.

Três blocos entregam isso:

```
F31.3
  ├─ Bloco 1: Reviewer Intent-Aware
  │   (ImageReviewInput + prompt + validatePrompts)
  ├─ Bloco 2: Automação de Contrato/Drift
  │   (testes de schema, pipeline, regressão offer)
  └─ Bloco 3: UAT Real Conclusivo
      (5 cenários com IA real + evidência visual + aceite)
```

### D2 — `campaignIntent` em `ImageReviewInput` (opcional, default "offer")

```typescript
interface ImageReviewInput {
  productName: string;
  storeName: string;
  badgeText?: string;           // antes: string (obrigatório)
  originalPrice?: string;
  discountedPrice?: string;     // antes: string (obrigatório)
  validationContext?: ValidationContext;
  campaignIntent?: CampaignIntent;  // novo, default "offer"
  preserveImageContext?: boolean;   // novo
}
```

Mantido como `opcional` com default `"offer"` para compatibilidade com chamadas existentes em testes e fluxos que ainda não passam intent. O pipeline sempre passa `campaignIntent` a partir de 31.3.

### D3 — Regras por Intent (com nuance)

| Regra | `offer` | `spotlight` | `exclusive` |
|-------|---------|-------------|-------------|
| Preço na imagem | **Obrigatório**: DE/POR com riscado | **Se houver `discountedPriceCents`**: preço único correto. **Se não houver**: não inventar preço | **Não deve ter**: qualquer preço inventado é crítico |
| "DE" + preço riscado | Obrigatório se `originalPriceCents` presente | **Não deve ter**: nem DE, nem riscado, nem sugestão de desconto | **Não deve ter** |
| Badge na imagem | **Obrigatório**: texto deve bater com `badgeText` | **Opcional**: se existir, texto deve bater. Não pode ser promocional indevido ("Queima de Estoque") | **Opcional/sutil**: se existir, deve ser coerente com exclusividade/premium. Sem urgência promocional |
| Produto | Herói isolado (recorte) | Pode preservar fundo; revisor não rejeita fundo contextual | Pode preservar fundo; revisor não rejeita fundo contextual |
| CTA | Urgência esperada ("Corra", "Últimas unidades") | CTA de descoberta ("Confira", "Disponível", "Saiba mais") | CTA suave ("Disponível na loja", "Consulte-nos", "Peça o seu"). CTA agressivo ("Corra", "Promoção relâmpago") = **minor** se peça ainda for publicável; **critical** se contradisser frontalmente a intenção |
| Tom comercial | Barganha, oportunidade, vantagem | Desejo, vitrine, novidade | Exclusividade, curadoria, sofisticação |

**CTA em exclusive — diretriz:** incoerências leves ou escolhas criativas discutíveis são `minor` quando a campanha ainda for publicável. Só devem ser `critical` quando contradizem a intenção comercial (ex: "Promoção relâmpago" em peça sem preço), inventam condição comercial relevante, ou reduzem confiança do lojista para publicar.

### D4 — `buildReviewInput` no pipeline

No `ImageGenerationService` (linha 357-366), o `reviewInput` atual não inclui `campaignIntent`. Deve passar:

```typescript
const reviewInput: ImageReviewInput = {
  productName: effectiveProductName,
  storeName: brief.store.name,
  badgeText: body.badgeText ?? "",
  discountedPrice: body.discountedPriceCents
    ? this.formatPriceBRL(body.discountedPriceCents)
    : "",
  originalPrice: (body.originalPriceCents ?? 0) > 0
    ? this.formatPriceBRL(body.originalPriceCents ?? 0)
    : undefined,
  validationContext,
  campaignIntent: body.campaignIntent ?? "offer",
  preserveImageContext: body.preserveImageContext,
};
```

### D5 — Prompt único intent-aware (NÃO 3 prompts)

**Decisão: manter `campaign-image-reviewer.md` único, com variáveis contextuais.**

Motivos:
- Fundamentos universais não mudam: produto, loja, legibilidade, qualidade, informação inventada
- Só as **expectativas comerciais** mudam por intent
- Três prompts aumentariam superfície de divergência sem ganho proporcional
- Alinhado com o padrão já usado para `validationContextSection` (seção condicional)

**Mudança estrutural no prompt — o ajuste mais importante da fatia:**

Em vez de:

```markdown
| Preço com desconto | {{discountedPrice}} |
```

O prompt recebe variáveis contextuais já resolvidas que eliminam placeholders vazios:

```markdown
| Campo | Valor |
|-------|-------|
| **Loja** | {{storeName}} |
| **Produto** | {{productName}} |
| **Intenção comercial** | {{campaignIntentLabel}} |
```

Seguidas de seções condicionais montadas **pelo serviço** no momento da chamada:

```
## Comportamento Esperado

### Preço
{{expectedPriceBehavior}}

### Badge
{{expectedBadgeBehavior}}

### Tratamento da Imagem
{{expectedImageTreatment}}

### Tom Comercial
{{expectedCommercialTone}}
```

O serviço monta essas variáveis em duas etapas:

**Etapa 1 — resolver placeholders comerciais:** o serviço interpola `discountedPrice`, `badgeText`, `originalPrice` com os valores reais do formulário ANTES de montar as variáveis contextuais.

**Etapa 2 — montar strings finais sem `{{...}}`:** as variáveis `expected*Behavior` são strings **completamente resolvidas**, sem nenhum placeholder `{{...}` interno. O `PromptLoader` nunca recebe `{{discountedPrice}}` ou `{{badgeText}}` dentro dessas variáveis.

Exemplo para cada intent (considerando badgeText = "Promoção" e discountedPrice = 2990 → "R$ 29,90"):

| Variável | `offer` | `spotlight` | `exclusive` |
|----------|---------|-------------|-------------|
| `campaignIntentLabel` | "Oferta — Promoção" | "Destaque — Vitrine" | "Exclusivo — Premium" |
| `expectedPriceBehavior` | "A imagem DEVE exibir preço promocional. Se houver preço original, deve aparecer como DE/POR com riscado. O preço com desconto é R$ 29,90." | "O preço informado é R$ 129,90. Deve aparecer como preço ÚNICO — sem DE, sem riscado, sem desconto. Se NÃO houver preço informado, a imagem NÃO deve exibir preço." | "A imagem NÃO deve exibir preço. Qualquer preço inventado é problema CRÍTICO — mesmo que sutil ou decorativo." |
| `expectedBadgeBehavior` | "A imagem DEVE exibir badge promocional. O texto deve ser 'Promoção'." | Varia com presença de badge — ver nota abaixo. | Varia com presença de badge — ver nota abaixo. |
| `expectedImageTreatment` | "O produto deve ser o herói isolado — recortado do fundo. Não preservar contexto original." | "O produto pode ter fundo preservado ou recortado, a critério do diretor. O revisor não deve rejeitar automaticamente fundo contextual." | "O produto pode ter fundo preservado — o contexto valoriza a exclusividade. Só marcar problema se o fundo prejudicar legibilidade, distorcer o produto ou parecer amador." |
| `expectedCommercialTone` | "Tom de urgência e barganha. CTA de ação direta é esperado." | "Tom de desejo e descoberta. CTA suave ('Confira', 'Disponível', 'Saiba mais')." | "Tom de exclusividade e curadoria. CTA suave ('Disponível na loja', 'Consulte-nos', 'Peça o seu'). Sem linguagem promocional." |

**Nota — `expectedBadgeBehavior` para spotlight/exclusive com badge vazio:** o serviço deve montar **duas versões** condicionais:

- **Com badge presente** (ex: `badgeText = "Novidade"`): "Badge é opcional, mas foi informado 'Novidade'; se aparecer na imagem, deve bater com o texto exato."
- **Sem badge** (ex: `badgeText` vazio): "Nenhum badge foi informado; a imagem pode não ter badge. Se a imagem inventar um badge, ele não deve criar promessa promocional indevida."

**Isso elimina o problema de placeholders vazios:** quando não há `discountedPrice` para `exclusive`, o `expectedPriceBehavior` já diz "não deve exibir preço" — sem mencionar `R$ 0,00` ou `{{discountedPrice}}` no texto.

**Responsabilidade:** o serviço (`ImageReviewService.review`) monta as variáveis contextuais com valores já interpolados antes de chamar o `PromptLoader`. O prompt carrega essas variáveis — nunca carrega `{{discountedPrice}}` ou `{{badgeText}}` diretamente no corpo dos critérios.

### D6 — Novo tipo de issue: `commercial_tone_mismatch`

Os critérios atuais do revisor (`wrong_price`, `wrong_product_name`, `wrong_store_name`, `illegible_text`, `invented_information`, `deformed_product`, `weak_visual_quality`) cobrem problemas técnicos e de precisão. Mas com intents comerciais, surge uma nova categoria: a peça está **tecnicamente correta mas comercialmente inadequada** para a intenção.

Adicionar ao prompt e ao `ImageReviewResult`:

```typescript
type ReviewIssueType =
  | "wrong_price"
  | "wrong_product_name"
  | "wrong_store_name"
  | "illegible_text"
  | "invented_information"
  | "deformed_product"
  | "weak_visual_quality"
  | "commercial_tone_mismatch";  // novo
```

Regra de severidade:

| Condição | Severidade |
|----------|-----------|
| CTA ou badge levemente desalinhados com a intent, mas peça ainda publicável | `minor` |
| CTA contradiz frontalmente a intenção (ex: "Promoção relâmpago" em exclusive), inventa condição comercial relevante, ou reduz confiança do lojista para publicar | `critical` |

Isso dá ao revisor um vocabulário explícito para sinalizar "a peça está bonita, mas não é adequada" sem precisar forçar outro tipo de issue existente.

### D7 — `InputValidationService` (verificação, não adaptação)

O alinhamento original listava adaptação do `InputValidationService` como item relevante. **Revisão**: o `InputValidationService` só valida nome do produto contra imagem — não valida preço, badge ou qualquer campo variável por intent.

Ação na 31.3: **verificar** que nenhuma chamada do `InputValidationService` presume preço ou badge. Se estiver limpo (e está), nenhuma alteração necessária. Remover do escopo como item de implementação; manter como verificação no checklist.

### D8 — `validatePrompts` deve ser intent-aware

O método `validatePrompts` (image-generation-service.ts:560-588) valida o prompt do revisor em preflight. Atualmente monta `reviewerVars` SEM `campaignIntent`. Isso significa:

1. O prompt validado usa os mesmos placeholders para todas as intents
2. Para `exclusive`, variáveis como `{{discountedPrice}}` seriam substituídas por string vazia
3. O `prompt-validator` só checa placeholders não resolvidos (sintaxe), não semântica — então passa mesmo com prompt semanticamente quebrado

Ação:

```typescript
// validatePrompts precisa testar o prompt do revisor com cada intent
// ou pelo menos garantir que as variáveis contextuais (expected*Behavior)
// estão presentes e resolvem corretamente
```

Na prática: como as variáveis `expected*Behavior` já vêm pré-resolvidas (strings completas montadas pelo serviço), o número de placeholders no prompt cai drasticamente. O `validatePrompts` precisa verificar que:

- `campaignIntentLabel` está presente
- `expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone` estão presentes
- Placeholders antigos (`discountedPrice`, `badgeText`) **não** estão mais no corpo dos critérios

### D9 — UAT real, não mock

**Decisão:** os 5 cenários E2E (A-E) devem ser executados com **geração real via IA** (API OpenAI/Anthropic). Mocks entram apenas para:

- Testes de unidade/integração (contrato, schema, pipeline)
- Validar que o prompt do revisor não tem placeholders não resolvidos
- Garantir regressão de comportamento da intent `offer`

**Evidência de aceite:** para cada cenário, anexar print da campanha gerada (ou link interno) com parecer: `aprovado`, `aprovado com ressalva` ou `reprovado`, usando os critérios de validação visual da seção abaixo.

### D10 — Regressão offer = comportamento equivalente, não imagem idêntica

O prompt `campaign-image-director-offer.md` é cópia do original (desde 31.2). O revisor com prompt único e `campaignIntent = "offer"` deve manter:

- Preço DE/POR com riscado
- Badge promocional presente e texto correto
- Hierarquia promocional (produto > preço > loja > CTA)
- Urgência quando cabível
- Sem perda de qualidade visual

Não é realista prometer "imagem idêntica" com IA não-determinística. O que se verifica é **comportamento equivalente**: mesma estrutura, mesmas regras, mesma publicabilidade.

---

## Estrutura do Prompt (Resumo da Mudança)

### Antes (atual)

```markdown
| Preço com desconto | {{discountedPrice}} |
| Preço original | {{originalPrice}} |

### 1. wrong_price (critical)
O preço exibido na imagem corresponde a {{discountedPrice}}...
```

**Problema:** quando `discountedPrice` = `""`, a frase resultante é semanticamente quebrada.

### Depois (31.3)

```markdown
| Intenção comercial | {{campaignIntentLabel}} |

{{expectedPriceBehavior}}
{{expectedBadgeBehavior}}
{{expectedImageTreatment}}
{{expectedCommercialTone}}
```

O prompt **não** usa `{{discountedPrice}}` diretamente nos critérios. Os valores vazios nunca chegam ao prompt — o que chega é a EXPECTATIVA já traduzida em linguagem natural.

---

## Cenários de Teste (UAT Real)

### Cenário A — Promoção / Regressão offer

```
Loja: "Padaria Pão & Cia"
Produto: "Bolo de Cenoura"
Preço: DE R$ 39,90 / POR R$ 29,90
Badge: "Promoção"
Intent: offer → fixo (DE+POR)
Preservar imagem: não
```

Esperado: badge "Promoção", preço riscado, preço com desconto destacado, CTA de urgência. Comportamento equivalente ao atual. Regressão zero de regras.

### Cenário B — Lançamento (spotlight com badge)

```
Loja: "Moda & Estilo"
Produto: "Vestido Floral Verão 2026"
Preço: R$ 149,90 (só preço atual)
Badge: "Novidade"
Intent: spotlight
Preservar imagem: não
```

Esperado: sem "DE", sem preço riscado, badge "Novidade", copy de lançamento, preço único correto, CTA de descoberta.

### Cenário C — Mais vendido (spotlight sem badge)

```
Loja: "Pet Shop AuAu"
Produto: "Ração Premium Cães Adultos 15kg"
Preço: R$ 89,90 (só preço atual)
Badge: nenhum
Intent: spotlight
Preservar imagem: não
```

Esperado: preço único sem riscado, sem badge, copy de qualidade/confiança, CTA "Disponível na loja".

### Cenário D — Produto artesanal (exclusive sem badge, preserve)

```
Loja: "Flores & Encanto"
Produto: "Buquê de Rosas Vermelhas"
Preço: nenhum
Badge: nenhum
Intent: exclusive (inferido)
Preservar imagem: sim
```

Esperado: sem preço na arte, sem badge, foto com fundo preservado, composição sobre o original, copy de exclusividade, CTA suave.

### Cenário E — Premium (exclusive com badge, preserve)

```
Loja: "Confeitaria Doce Sonho"
Produto: "Bolo de Chocolate Belga"
Preço: nenhum
Badge: "Exclusivo"
Intent: exclusive (inferido)
Preservar imagem: sim
```

Esperado: sem preço, badge "Exclusivo" sutil, foto com fundo preservado, copy de sofisticação, CTA suave.

### Micro-runbook de UAT

Cada cenário A-E deve registrar no mínimo:

| Campo | Exemplo |
|-------|---------|
| **Input usado** | JSON do body enviado ao `/api/campaign/generate-image` |
| **Campanha gerada** | Link interno `/campanha/{id}` ou print anexado |
| **Resultado do revisor automático** | `passed: true`, issues listadas |
| **Parecer manual** | `aprovado` / `aprovado com ressalva` / `reprovado` |
| **Motivo do parecer** | Frase curta (ex: "Badge ligeiramente fora do centro, mas publicável") |
| **Houve retry/regeneração?** | Sim (quantas) / Não. Se sim, o que mudou entre tentativas |

Isso transforma cada cenário em **evidência auditável**, não apenas "print solto".

---

## Validação Visual (critérios de aceite)

Para cada campanha gerada (UAT real), verificar:

1. **Hierarquia visual**: o elemento principal está claro, ajustado por intent?
2. **Badge**: presente quando deveria? Ausente quando não deveria? Texto correto? Tom adequado?
3. **Preço**: formato correto por intent (DE/POR em offer, único em spotlight, ausente em exclusive)?
4. **Imagem do produto**: recortada ou preservada conforme `preserveImageContext`?
5. **Copy coerente**: tom corresponde à intent? Sem linguagem promocional em exclusive?
6. **Cores e identidade**: paleta da loja respeitada?
7. **Legibilidade**: textos legíveis em mobile?
8. **CTA**: tom adequado à intent? (urgência em offer, descoberta em spotlight, suave em exclusive)

---

## Arquivos Afetados

### Revisor

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/services/image-review-service.ts` | `ImageReviewInput`: adicionar `campaignIntent?: CampaignIntent`, `preserveImageContext?: boolean`. `badgeText`, `discountedPrice`, `originalPrice` passam a ser opcionais. `review()` monta variáveis contextuais (`expectedPriceBehavior`, etc.) ANTES de chamar `PromptLoader` — elimina placeholders vazios no prompt. |
| `prompts/campaign-image-reviewer.md` | Reestruturar para usar variáveis contextuais (`campaignIntentLabel`, `expectedPriceBehavior`, etc.) em vez de `{{discountedPrice}}` direto nos critérios. Adicionar seções de comportamento esperado por intent. |
| `src/lib/image-generation/schema.ts` | `ImageReviewResult` e `ReviewIssue` podem receber `campaignIntent` se necessário para diagnóstico. |

### Pipeline

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/services/image-generation-service.ts` | `buildReviewInput` (linha 357): adicionar `campaignIntent` e `preserveImageContext`. `validatePrompts` (linha 569): incluir `campaignIntent` nas variáveis do reviewer, testar que variáveis contextuais resolvem. |

### InputValidationService (verificação apenas)

| Arquivo | Verificação |
|---------|-------------|
| `src/lib/image-generation/services/input-validation-service.ts` | Confirmar que nenhuma chamada presume preço ou badge (não presume — está limpo). Nenhuma alteração de código. |

### Testes

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/services/__tests__/image-review-service.test.ts` | Adicionar testes: reviewInput com `campaignIntent` para cada intent, verificar que variáveis contextuais são montadas corretamente, prompt não contém placeholders vazios. |
| `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` | Adicionar teste: `validatePrompts` valida prompt do revisor com `campaignIntent`. |
| `src/__tests__/f31-3-review-quality-gate.test.ts` | Novo arquivo. Testes: `ImageReviewInput` com `campaignIntent` default "offer" não quebra schema existente; variáveis contextuais montadas corretamente; `commercial_tone_mismatch` aparece quando esperado. |

---

## Checklist de Entrega

### Bloco 1 — Reviewer Intent-Aware

- [ ] `ImageReviewInput` com `campaignIntent?: CampaignIntent` (default "offer")
- [ ] `badgeText`, `discountedPrice`, `originalPrice` opcionais no input
- [ ] `review()` monta variáveis contextuais em duas etapas: resolve placeholders comerciais → monta strings finais sem `{{...}}`
- [ ] Variáveis `expected*Behavior` são strings 100% resolvidas — sem `{{discountedPrice}}` ou `{{badgeText}}` dentro delas
- [ ] `expectedBadgeBehavior` tem duas variantes (com badge presente / sem badge) — serviço escolhe a correta
- [ ] Prompt `campaign-image-reviewer.md` reestruturado: recebe variáveis contextuais, não usa `{{discountedPrice}}`/`{{badgeText}}` diretamente nos critérios
- [ ] Novo tipo de issue `commercial_tone_mismatch` adicionado ao prompt e ao `ImageReviewResult`
- [ ] `buildReviewInput` passa `campaignIntent` e `preserveImageContext`
- [ ] `validatePrompts` testa prompt do revisor com variáveis de intent
- [ ] Prompt sem placeholders não resolvidos para qualquer intent (verificado em preflight)

### Bloco 2 — Automação de Contrato/Drift

- [ ] Teste: `ImageReviewInput` com `campaignIntent: "offer"` mantém compatibilidade (regressão)
- [ ] Teste: `ImageReviewInput` com `campaignIntent: "exclusive"` não exige `discountedPrice`
- [ ] Teste: `validatePrompts` passa para todas as 3 intents
- [ ] Teste: `validatePrompts` falha se variável contextual esperada está ausente
- [ ] Teste: variantes de `expectedBadgeBehavior` (com e sem badge) montadas corretamente
- [ ] Teste: `commercial_tone_mismatch` gerado quando CTA/badge contradiz intent
- [ ] Verificado: `InputValidationService` não presume preço/badge
- [ ] `npm run typecheck` limpo
- [ ] `npm run build` limpo
- [ ] `npx vitest run` — todos os testes passando (existentes + novos)

### Bloco 3 — UAT Real Conclusivo

- [ ] **Cenário A** — gerado com IA real → evidência conforme micro-runbook → aprovado visualmente
- [ ] **Cenário B** — gerado → evidência → aprovado
- [ ] **Cenário C** — gerado → evidência → aprovado
- [ ] **Cenário D** — gerado → evidência → aprovado
- [ ] **Cenário E** — gerado → evidência → aprovado
- [ ] Regressão offer: comportamento equivalente ao anterior (estrutura, regras, publicabilidade)
- [ ] Micro-runbook preenchido para cada cenário (input, link, parecer automático, parecer manual, motivo, retry)
