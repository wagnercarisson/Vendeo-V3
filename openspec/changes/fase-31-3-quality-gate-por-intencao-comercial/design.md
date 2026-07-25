## Context

O `ImageReviewService` usa um prompt único (`campaign-image-reviewer.md`) que presume preço com desconto, badge promocional e CTA de urgência. As Fases 31.1 e 31.2 introduziram `campaignIntent` no formulário e nos diretores de imagem/copy, mas o revisor de qualidade continuou calibrado exclusivamente para `offer`.

O prompt atual interpola `{{discountedPrice}}`, `{{badgeText}}` e `{{originalPrice}}` diretamente nos critérios. Para `exclusive`, esses placeholders são substituídos por string vazia, gerando frases semanticamente quebradas como "O preço exibido corresponde a (preço com desconto)".

O `validatePrompts` valida o prompt do revisor sem considerar `campaignIntent`, dando falso seguro em preflight.

## Goals / Non-Goals

**Goals:**
1. `ImageReviewInput` recebe `campaignIntent` e `preserveImageContext`; `badgeText`, `discountedPrice`, `originalPrice` tornam-se opcionais
2. Prompt do revisor usa variáveis contextuais pré-resolvidas (`expectedPriceBehavior`, `expectedBadgeBehavior`, etc.) em vez de placeholders diretos
3. `ImageReviewService.review()` monta as variáveis contextuais com valores já interpolados antes de chamar `PromptLoader`
4. `expectedBadgeBehavior` tem três variantes (offer obrigatório, spotlight/exclusive com badge, spotlight/exclusive sem badge) — serviço escolhe a correta
5. Novo issue type `commercial_tone_mismatch` no prompt e no `ImageReviewResult`
6. `validatePrompts` testa o prompt do revisor com variáveis de intent e verifica placeholders antigos
7. 5 cenários E2E com IA real, registrados conforme micro-runbook

**Non-Goals:**
- Criar prompts de revisor separados por intent (mantido único)
- Modificar `InputValidationService` (apenas verificado)
- Modificar prompts de diretor de imagem ou copy (já estão em 31.2)
- Infraestrutura de A/B testing ou métricas de conversão

## Decisions

### D1 — Prompt único intent-aware com variáveis contextuais

**Decisão:** Manter `campaign-image-reviewer.md` único. O prompt recebe variáveis contextuais montadas pelo serviço, não placeholders diretos de dados comerciais.

**Por que:** Fundamentos universais (produto, loja, legibilidade, qualidade) não mudam por intent. Só as expectativas comerciais mudam. Três prompts aumentariam superfície de divergência sem ganho proporcional. Padrão análogo ao já usado para `validationContextSection`.

**Alternativa considerada:** Três prompts (`campaign-image-reviewer-{intent}.md`). Rejeitada por aumentar carga de manutenção sem benefício claro — os mesmos 7 critérios de inspeção se aplicam a todas as intents.

### D2 — Duas etapas de montagem de variáveis

**Decisão:** O serviço monta as variáveis contextuais em duas etapas:
1. Resolver placeholders comerciais: interpolar `discountedPrice` (R$ 29,90), `badgeText` ("Promoção"), `originalPrice` (R$ 39,90) com valores reais
2. Montar strings finais: produzir `expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone`, `campaignIntentLabel` como strings 100% resolvidas, sem `{{...}}`

**Por que:** Elimina o problema de placeholders vazios (string vazia no meio de uma frase). O `PromptLoader` nunca recebe `{{discountedPrice}}` dentro das variáveis contextuais — só os placeholders `{{expectedPriceBehavior}}`, etc.

**Fluxo:**
```
ImageReviewService.review()
  → Monta variáveis base: storeName, productName
  → Monta variáveis contextuais por intent (já interpoladas)
  → promptLoader.load("campaign-image-reviewer", contextVars)
  → Prompt final sem {{discountedPrice}} nos critérios
```

### D3 — `expectedBadgeBehavior` com três variantes por intent

**Decisão:** O serviço escolhe entre três strings para `expectedBadgeBehavior`, dependendo da intent e da presença de badgeText:

- **Offer (qualquer badgeText):** "A imagem DEVE exibir badge promocional. O texto deve ser '{badgeText}'. Badge promocional é obrigatório." — offer sempre espera badge, mesmo que badgeText esteja vazio.
- **Spotlight/exclusive com badge presente:** "Badge é opcional, mas foi informado '{badgeText}'; se aparecer na imagem, deve bater com o texto exato."
- **Spotlight/exclusive sem badge:** "Nenhum badge foi informado; a imagem pode não ter badge. Se a imagem inventar um badge, ele não deve criar promessa promocional indevida."

**Por que:** Offer tem badge obrigatório — não pode usar a mesma frase "opcional" de spotlight/exclusive. Três variantes eliminam a ambiguidade e evitam gerar "Se houver badge ('')..." quando `badgeText` é vazio. Especialmente relevante para cenários C e D.

### D4 — `commercial_tone_mismatch` no lifecycle

**Decisão:** `commercial_tone_mismatch` critical → retryable (mesmo comportamento de `wrong_price`). `commercial_tone_mismatch` minor → não bloqueia, apenas registra.

A tabela de correção no `ImageGenerationService` é estendida:

| failureType / condition | Retryable | User Action Needed |
|-------------------------|-----------|-------------------|
| `null` (critical issues incl. `commercial_tone_mismatch` critical) | Yes | No |

O `applyValidationContextToReviewResult` NUNCA remove `commercial_tone_mismatch` critical. Minor passa livre.

### D5 — `validatePrompts` intent-aware

**Decisão:** `validatePrompts` monta `reviewerVars` com `campaignIntent` e testa o prompt do revisor com as 3 intents. Verifica:

1. `campaignIntentLabel`, `expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone` estão presentes nas variáveis
2. `{{discountedPrice}}` e `{{badgeText}}` NÃO aparecem no corpo do prompt (placeholders antigos removidos)
3. Nenhum placeholder não resolvido para qualquer intent

**Por que:** O validador atual só checa placeholders não resolvidos (sintaxe). Com as variáveis contextuais, o número de placeholders cai drasticamente, mas precisamos garantir que os placeholders antigos foram de fato substituídos por variáveis contextuais no prompt.

### D6 — UAT real com micro-runbook

**Decisão:** Os 5 cenários E2E usam geração real via IA (OpenAI). Mocks entram apenas para testes de contrato/drift. Cada cenário registra: input JSON, link da campanha, parecer do revisor, parecer manual, motivo, se houve retry.

**Por que:** A pergunta central da 31.3 é "a campanha é publicável para a intenção comercial?". Isso só aparece com execução real. Mocks validam contrato, mas não publicabilidade.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| [R1] Prompt do revisor com variáveis contextuais pode deixar a IA mais permissiva | As regras de severidade (`commercial_tone_mismatch` critical vs minor) criam uma gradação que o diretor também segue. O revisor ainda bloqueia erros comerciais graves (preço, produto, loja) |
| [R2] Manter prompt único pode ficar complexo com muitas intents no futuro | Se houver mais de 3 intents, reconsiderar prompts separados. Por enquanto, 3 intents cabem em um prompt com seções condicionais |
| [R3] UAT real depende de API key e créditos OpenAI | Cenários são apenas 5. Custo estimado: ~5 gerações de imagem (~$0.04 cada) + 5 revisões de visão (~$0.01 cada) = ~$0.25 total. Desprezível |
| [R4] `commercial_tone_mismatch` pode gerar falsos positivos se a IA do revisor for muito rigorosa | A regra de severidade minor protege: tom levemente inadequado não bloqueia. Só critical bloqueia, e só quando contradiz frontalmente a intent |

## Open Questions

Nenhuma. Todas as decisões foram fechadas durante o alinhamento da fase e consolidadas no documento `docs/alinhamento-fase-31.3-revisao-validacao-ponta-a-ponta.md`.
