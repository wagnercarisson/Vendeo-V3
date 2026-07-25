# Phase 31.3: Quality Gate por Intenção Comercial — Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/`

<domain>
## Phase Boundary

A F31.2 entregou schemas tolerantes, desbloqueio de intents, 6 prompts por intent no diretor de imagem e copy, e conteúdo adaptado. O `ImageReviewService`, porém, continua calibrado exclusivamente para `offer` — espera preço com desconto, badge promocional e CTA de urgência.

**Problema:** Para `spotlight` e `exclusive`, o revisor gera falsos negativos (rejeitar exclusive por "falta de preço") e falso rigor promocional (criticar spotlight por não ter DE/POR). Placeholders `{{discountedPrice}}` e `{{badgeText}}` interpolam string vazia para exclusive, gerando frases semanticamente quebradas.

**O que esta fase entrega:**
- `ImageReviewInput` com `campaignIntent` (default `"offer"`), `preserveImageContext`; `badgeText`, `discountedPrice`, `originalPrice` opcionais
- Prompt `campaign-image-reviewer.md` reestruturado com variáveis contextuais pré-resolvidas (`expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone`, `campaignIntentLabel`)
- `ImageReviewService.review()` monta variáveis contextuais em duas etapas (resolver placeholders comerciais → montar strings finais sem `{{...}}`)
- `expectedBadgeBehavior` com três variantes por intent (offer obrigatório / spotlight+exclusive com badge / spotlight+exclusive sem badge)
- Novo tipo de issue `commercial_tone_mismatch` no prompt e `ImageReviewResult` — `minor` se peça ainda publicável, `critical` se contradiz intent ou inventa condição comercial
- `ReviewIssueType` como union nomeada em `schema.ts` (substitui `string`)
- `failureType` migrado de opcional (`?:`) para `string | null` explícito
- `callVisionModel()` tratando `empty_review` como resultado estruturado (não exceção)
- `validatePrompts` intent-aware: testa reviewer com as 3 intents, verifica variáveis contextuais, verifica que placeholders antigos não estão no prompt
- `applyValidationContextToReviewResult` reconhece `commercial_tone_mismatch` como non-removable
- `InputValidationService` verificado (sem alteração de código)
- 5 cenários E2E com IA real, registrados conforme micro-runbook

**Non-Goals:**
- Criar prompts de revisor separados por intent (mantido único)
- Modificar `InputValidationService` (apenas verificado)
- Modificar prompts de diretor de imagem ou copy (já estão em 31.2)
- Infraestrutura de A/B testing ou métricas de conversão

</domain>

<decisions>
## Implementation Decisions

### D1 — Prompt único intent-aware com variáveis contextuais

`DECIDIDO`

Manter `campaign-image-reviewer.md` único. O prompt recebe variáveis contextuais montadas pelo serviço, não placeholders diretos de dados comerciais. Fundamentos universais (produto, loja, legibilidade, qualidade) não mudam por intent — só as expectativas comerciais mudam.

### D2 — Duas etapas de montagem de variáveis

`DECIDIDO`

1. Resolver placeholders comerciais: interpolar `discountedPrice`, `badgeText`, `originalPrice` com valores reais
2. Montar strings finais: produzir `expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone`, `campaignIntentLabel` como strings 100% resolvidas

### D3 — `expectedBadgeBehavior` com três variantes por intent

`DECIDIDO`

| Condição | expectedBadgeBehavior |
|----------|----------------------|
| Offer (qualquer badge) | "A imagem DEVE exibir badge promocional. O texto deve ser '{badgeText}'." |
| Spotlight/exclusive com badge presente | "Badge é opcional, mas foi informado '{badgeText}'; se aparecer, deve bater." |
| Spotlight/exclusive sem badge | "Nenhum badge foi informado; a imagem pode não ter badge." |

### D4 — `commercial_tone_mismatch` no lifecycle

`DECIDIDO`

- `commercial_tone_mismatch` critical → retryable (mesmo comportamento de `wrong_price`)
- `commercial_tone_mismatch` minor → não bloqueia, apenas registra
- `applyValidationContextToReviewResult` NUNCA remove `commercial_tone_mismatch` (qualquer severidade)

### D5 — `validatePrompts` intent-aware

`DECIDIDO`

Monta `reviewerVars` com `campaignIntent` e testa o prompt do revisor com as 3 intents. Verifica:
1. `campaignIntentLabel`, `expectedPriceBehavior`, `expectedBadgeBehavior` etc. estão presentes
2. `{{discountedPrice}}` e `{{badgeText}}` NÃO aparecem no corpo do prompt
3. Nenhum placeholder não resolvido para qualquer intent

### D6 — UAT real com micro-runbook

`DECIDIDO`

5 cenários E2E usam geração real via IA (OpenAI). Mocks entram apenas para testes de contrato/drift. Cada cenário registra: input JSON, link da campanha, parecer do revisor, parecer manual, motivo, se houve retry.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec — Source of Truth
- `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/proposal.md` — Why, What Changes (8 itens), Capabilities, Impact
- `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/design.md` — All design decisions (D1-D6), Risks/Trade-offs (R1-R4)
- `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/tasks.md` — 5 task groups with 44 tasks

### Specs por Domínio
- `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/specs/image-quality-review/spec.md` — ImageReviewInput estendido, failureType migrado, ReviewIssueType, cenários de revisão por intent
- `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/specs/intent-aware-review/spec.md` — review() em 2 etapas, expectedPriceBehavior/BadgeBehavior por intent, commercial_tone_mismatch, ReviewIssueType union
- `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/specs/prompt-templates-by-intent/spec.md` — validatePrompts com campaignIntent, verificação de variáveis contextuais e placeholders antigos
- `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/specs/validation-review-alignment/spec.md` — commercial_tone_mismatch non-removable, tabela de blocking

### Documento de Alinhamento
- `docs/alinhamento-fase-31.3-revisao-validacao-ponta-a-ponta.md` — Alinhamento completo com D1-D10, 5 cenários UAT, micro-runbook

### Dependências — Fase Anterior
- `.planning/phases/31-2-diretores-por-intencao/31-2-CONTEXT.md` — Schemas tolerantes, desbloqueio de intents, 6 prompts, roteamento
- `.planning/phases/31-2-diretores-por-intencao/06-SUMMARY.md` — UAT 9/9, 1051 testes, regressão zero para offer

### Arquivos Modificados por esta Fase
- `src/lib/image-generation/schema.ts` — ReviewIssueType union, ImageReviewResult.failureType `string | null`, ReviewIssue.type tipado
- `src/lib/image-generation/services/image-review-service.ts` — ImageReviewInput estendido, review() em 2 etapas, callVisionModel trata empty_review, parseResult/determineFailureType adaptados
- `src/lib/image-generation/services/image-generation-service.ts` — buildReviewInput com campaignIntent, validatePrompts intent-aware
- `prompts/campaign-image-reviewer.md` — Reestruturação completa com variáveis contextuais

### Arquivos de Teste
- `src/__tests__/f31-3-review-quality-gate.test.ts` — Novo: testes de contrato/drift
- `src/lib/image-generation/services/__tests__/image-review-service.test.ts` — Novos testes de intent-aware review
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` — validatePrompts com intent

</canonical_refs>

<specifics>
## Specific Ideas

### Fluxo de dados pós-F31.3

```
Geração de imagem
  ↓
ImageGenerationService.generateImage()
  ↓ body.discountedPriceCents, body.badgeText, body.campaignIntent
  ↓
  ┌─ ImageDirector (intent-aware, F31.2)
  └─ CopyDirector (intent-aware, F31.2)
  ↓ IA retorna imagem
  ↓
  ┌─ ImageReviewService.review()
  │   1. Monta variáveis base (storeName, productName)
  │   2. Monta variáveis contextuais por intent:
  │      expectedPriceBehavior, expectedBadgeBehavior,
  │      expectedImageTreatment, expectedCommercialTone,
  │      campaignIntentLabel
  │   3. NUNCA passa {{discountedPrice}} ou {{badgeText}}
  │      no prompt — apenas variáveis contextuais resolvidas
  │   4. promptLoader.load("campaign-image-reviewer", vars)
  │   5. callVisionModel → parseResult
  │   6. applyValidationContextToReviewResult
  │
  ├─ passed: true → pronto para o usuário
  ├─ minor issues → passa, registra diagnóstico
  ├─ critical retryable → correction/regeneration
  └─ generated_product_mismatch → terminal error
```

### Estrutura do Prompt (antes vs depois)

**Antes:**
```
| Preço com desconto | {{discountedPrice}} |
| Texto do badge     | {{badgeText}}        |

### 1. wrong_price (critical)
O preço exibido corresponde a {{discountedPrice}}?
```

**Depois:**
```
## Comportamento Esperado

- **Intenção comercial:** {{campaignIntentLabel}}
- **Preço:** {{expectedPriceBehavior}}
- **Badge:** {{expectedBadgeBehavior}}
- **Tratamento da imagem:** {{expectedImageTreatment}}
- **Tom comercial:** {{expectedCommercialTone}}

### 1. wrong_price (critical)
O preço exibido na imagem segue o comportamento esperado acima?
```

### 5 Cenários UAT

| ID | Intent | Produto | Preço | Badge | preserve |
|----|--------|---------|-------|-------|----------|
| A | offer | Bolo de Cenoura (Padaria) | DE 39,90/POR 29,90 | "Promoção" | false |
| B | spotlight | Vestido Floral (Moda) | 149,90 único | "Novidade" | false |
| C | spotlight | Ração Premium (Pet Shop) | 89,90 único | (sem) | false |
| D | exclusive | Buquê de Rosas (Flores) | (sem) | (sem) | true |
| E | exclusive | Bolo de Chocolate Belga (Confeitaria) | (sem) | "Exclusivo" | true |

</specifics>

<deferred>
## Deferred Ideas

- Criar prompts de revisor separados por intent (reconsiderar se houver >3 intents)
- Infraestrutura de A/B testing ou métricas de conversão

</deferred>

---

*Phase: 31-3-quality-gate-por-intencao-comercial*
*Context gathered: 2026-07-25 via OpenSpec alignment*
