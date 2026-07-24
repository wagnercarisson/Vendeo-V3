# Alinhamento Fase 31.3 — Revisão e Validação Ponta a Ponta (v1.5)

## Contexto

As Fases 31.1 e 31.2 entregaram o modelo comercial e os diretores especializados por intenção. O que falta é garantir que:

1. O **revisor de qualidade** (`ImageReviewService`) entende o contexto — não vai rejeitar uma campanha `exclusive` por "falta de preço" ou uma `spotlight` por "badge não promocional"
2. Os **cenários reais** funcionam de ponta a ponta — formulário → pipeline → campanha publicável
3. A **regressão** de campanhas `offer` existentes é zero
4. Casos de borda estão cobertos: lojista muda intent depois de preencher preços, preço parcial, imagem preservada com fundo complexo

```
F31.3 entrega:
  ┌─ Revisor adaptado por intent
  ├─ 5 cenários E2E testados
  ├─ Validação visual/manual
  └─ UAT rápido (2-3 lojistas simulados)
```

---

## Propósito

1. Adaptar `ImageReviewService` para validar por contexto de intent (`offer` espera preço e badge; `spotlight` aceita badge opcional; `exclusive` não exige preço nem badge)
2. Adaptar `InputValidationService` se necessário (ex: produto sem preço não deve acionar validação de conflito de preço na imagem)
3. Executar 5 cenários E2E de ponta a ponta com campanhas reais:
   - **Cenário A — Promoção clássica**: `DE + POR`, badge "Promoção", intent `offer` → campanha com preço riscado, badge, urgência
   - **Cenário B — Lançamento**: só preço, badge "Novidade", intent `spotlight` → campanha sem "DE", foco no produto, copy de desejo
   - **Cenário C — Mais vendido**: só preço, sem badge, intent `spotlight` → campanha com preço único, destaque de produto, sem badge
   - **Cenário D — Produto artesanal**: sem preço, sem badge, intent `exclusive`, `preserveImageContext` → campanha sem preço, sem badge, com fundo preservado, copy de exclusividade
   - **Cenário E — Premium**: sem preço, badge "Exclusivo", intent `exclusive` → campanha sem preço, com badge sutil, tom premium
4. Validar visualmente cada cenário: hierarquia, legibilidade, coerência comercial
5. Testes unitários e de integração para novos comportamentos

**Não faz parte desta fatia:**
- Criação de novos prompts ou schemas (já estão nas fatias 31.1 e 31.2)
- Infraestrutura de A/B testing entre intenções
- Métricas de conversão por tipo de campanha

---

## Decisões de Implementação

### D1 — Revisor adaptado por contexto

O `ImageReviewService` hoje valida contra um conjunto fixo de regras. Precisa receber `campaignIntent` no `reviewInput` para ajustar as expectativas:

| Regra | `offer` | `spotlight` | `exclusive` |
|-------|---------|-------------|-------------|
| Preço deve estar presente na imagem | Obrigatório | Opcional | Não deve ter |
| "DE" + preço riscado | Obrigatório se `originalPriceCents` | Não deve ter | Não deve ter |
| Badge deve estar presente | Obrigatório | Opcional | Opcional |
| Produto deve ser herói isolado | Preferencial | Pode preservar fundo | Pode preservar fundo |
| CTA de urgência | Esperado | Não esperado | Não esperado |

```typescript
interface ImageReviewInput {
  // ... campos existentes ...
  campaignIntent: "offer" | "spotlight" | "exclusive";
}
```

### D2 — `buildReviewInput` no pipeline

No `ImageGenerationService`, o método que monta o `reviewInput` (linha 357-366) precisa incluir `campaignIntent` vindo do `body`:

```typescript
const reviewInput: ImageReviewInput = {
  // ... existentes ...
  campaignIntent: body.campaignIntent ?? "offer",
};
```

### D3 — Validação de input também adaptada

O `InputValidationService` valida produto × imagem. Para `exclusive`, talvez o produto não tenha preço — não deve disparar falso positivo de "imagem sem preço na foto". Verificar se há alguma validação que presume preço na imagem.

---

## Cenários de Teste

### Cenário A — Promoção (regressão)

```
Loja: "Padaria Pão & Cia"
Produto: "Bolo de Cenoura"
Preço: DE R$ 39,90 / POR R$ 29,90
Badge: "Promoção"
Intent: offer → fixo (DE+POR)
Preservar imagem: não
```

Esperado: badge "Promoção", preço riscado, preço com desconto destacado, CTA de urgência. Mesmo resultado visual de hoje.

### Cenário B — Lançamento

```
Loja: "Moda & Estilo"
Produto: "Vestido Floral Verão 2026"
Preço: R$ 149,90 (só preço atual)
Badge: "Novidade"
Intent: spotlight (selecionado)
Preservar imagem: não
```

Esperado: sem "DE", sem preço riscado, badge "Novidade", copy de lançamento, destaque visual do produto.

### Cenário C — Mais vendido (sem badge)

```
Loja: "Pet Shop AuAu"
Produto: "Ração Premium Cães Adultos 15kg"
Preço: R$ 89,90 (só preço atual)
Badge: nenhum
Intent: spotlight (selecionado)
Preservar imagem: não
```

Esperado: preço único, sem badge, copy de qualidade/confiança, CTA "Disponível na loja".

### Cenário D — Produto artesanal (sem preço, preserve)

```
Loja: "Flores & Encanto"
Produto: "Buquê de Rosas Vermelhas"
Preço: nenhum
Badge: nenhum
Intent: exclusive (inferido)
Preservar imagem: sim
```

Esperado: sem preço na arte, sem badge, foto do buquê com fundo preservado (não recortado), composição sobre o fundo original, copy de exclusividade, sem CTA agressivo.

### Cenário E — Premium (exclusive com badge)

```
Loja: "Confeitaria Doce Sonho"
Produto: "Bolo de Chocolate Belga"
Preço: nenhum
Badge: "Exclusivo"
Intent: exclusive (inferido)
Preservar imagem: sim
```

Esperado: sem preço, badge "Exclusivo" sutil, foto com fundo preservado, copy de sofisticação.

---

## Validação Visual (critérios)

Para cada campanha gerada, verificar:

1. **Hierarquia visual**: o elemento principal está claro? (produto > preço > loja > CTA, ajustado por intent)
2. **Badge**: está presente quando deveria? Ausente quando não deveria?
3. **Preço**: formato correto (riscado só em offer com DE/POR)? Posicionamento adequado?
4. **Imagem do produto**: recortada ou preservada conforme `preserveImageContext`?
5. **Copy coerente**: o tom corresponde à intent? Sem linguagem promocional em exclusive?
6. **Cores e identidade**: paleta da loja respeitada?
7. **Legibilidade**: textos legíveis em mobile?

---

## Arquivos Afetados

### Revisor

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/services/image-review-service.ts` | Aceitar `campaignIntent` no `reviewInput`, adaptar regras de validação por intent |
| `src/lib/image-generation/schema.ts` | Adicionar `campaignIntent` ao `ImageReviewResult`/`ReviewIssue` se necessário |
| `src/lib/image-generation/services/image-generation-service.ts` | Passar `campaignIntent` ao `reviewInput` (linha 357) |

### Testes

| Arquivo | Mudança |
|---------|---------|
| `src/__tests__/lib/campaign/processor.test.ts` | Adicionar cenários B, C, D, E |
| `src/__tests__/api/campaign-generate.test.ts` | Adicionar testes de envio com as 3 intents |
| `src/components/flow/__tests__/use-campaign-form-submit-error.test.ts` | Adicionar teste de intent inference |
| `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` | Adicionar teste de navegação com intent |
| `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` | Adicionar testes de prompt selection por intent |
| `src/__tests__/api/campaign-matrix.test.ts` | Expandir matriz de teste para incluir as 3 intents |

---

## Checklist de Entrega

- [ ] `ImageReviewService` aceita `campaignIntent` e adapta validação
- [ ] `InputValidationService` não quebra com `exclusive` (sem preço)
- [ ] Pipeline passa `campaignIntent` para o revisor
- [ ] Cenário A — Promoção: geração idêntica ao comportamento atual (regressão zero)
- [ ] Cenário B — Lançamento: sem "DE", badge Novidade, copy de desejo
- [ ] Cenário C — Mais vendido sem badge: preço único, copy de qualidade
- [ ] Cenário D — Artesanal sem preço: arte sem preço, fundo preservado
- [ ] Cenário E — Premium com badge: badge Exclusivo, tom premium
- [ ] Validação visual dos 5 cenários (prints anexados ou link)
- [ ] `npm run typecheck` limpo
- [ ] `npm run build` limpo
- [ ] `npx vitest run` — todos os testes passando (existentes + novos)
