# Alinhamento Fase 31.2 — Diretores por Intenção (v1.5)

## Contexto

A Fase 31.1 preparou o terreno: o Vendeo agora sabe se uma campanha é `offer`, `spotlight` ou `exclusive`. Mas o diretor de imagem e o copy director ainda usam o mesmo prompt único — sempre com framing promocional, sempre assumindo `DE / POR`, sempre com badge "Promoção" e urgência.

Esta fatia separa os prompts por intenção. Cada intent ganha seu próprio template de diretor de imagem, copy director e revisor de qualidade. O prompt atual de oferta vira `campaign-image-director-offer.md`, preservando o que já está funcionando.

```
F31.1 entrega:
  campaignIntent: "offer" | "spotlight" | "exclusive"
  preserveImageContext: boolean

F31.2 adiciona:
  prompts/                               (3 diretores de imagem)
    campaign-image-director-offer.md      ← baseado no prompt atual
    campaign-image-director-spotlight.md  ← novo
    campaign-image-director-exclusive.md  ← novo

  prompts/                               (3 diretores de copy)
    campaign-copy-director-offer.md       ← baseado no prompt atual
    campaign-copy-director-spotlight.md   ← novo
    campaign-copy-director-exclusive.md   ← novo

  (revisor — F31.3)
```

---

## Propósito

1. Separar o prompt `campaign-image-director.md` em 3 templates por intent, mantendo o existente como base de `offer`
2. Criar 3 novos prompts de copy director por intent
3. Adaptar `ImageGenerationService.buildPromptVariables` para carregar o template correto conforme `campaignIntent`
4. Adaptar `CopyDirectorService` (via mapper) para gerar copy alinhada à intent
5. Adaptar `buildCommercialRepertoire` e `buildCreativeContextGuidance` para considerar a intent
6. Garantir que `preserveImageContext` seja passado como instrução ao diretor de imagem quando ativo

**Não faz parte desta fatia:**
- Criar revisores por intent (será na F31.3)
- Testes de qualidade visual das novas intenções (será na F31.3)

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
- Badge pode existir (Novidade, Lançamento, Mais Vendido)
- Foco em apresentação do produto: características, design, benefícios
- Hierarquia: produto > nome > descrição curta > preço > loja
- Pode ter `preserveImageContext` = a composição se adapta ao fundo
- Tom de desejo, vitrine, novidade
- CTA menos agressivo ("Saiba mais", "Confira", "Disponível")

### Diretor de Imagem — `exclusive`

Novo template. Sem preço na arte:

- Sem exibição de preço
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
- "Confira na loja", "Disponível"
- Tom de descoberta, recomendação

### Copy Director — `exclusive`

Novo template:

- Frame de exclusividade: "Sob encomenda", "Peça única", "Feito pra você"
- Sem referência a preço ou desconto
- Foco em valor percebido, processo artesanal, diferenciação
- Tom de sofisticação, cuidado, curadoria

---

## Pipeline: como o intent roteia o prompt

```
POST /api/campaign/generate-image
  → request.body.campaignIntent (vindo do form)
  → inputSnapshot.campaignIntent

ImageGenerationService.generateImage()
  → buildPromptVariables()
    → carrega template com base em campaignIntent:
        promptLoader.load(`campaign-image-director-${campaignIntent}`, vars)
    → se preserveImageContext === true:
        adiciona variável preserveImageDirective = instrução de não recortar
    → retorna variables enriquecidas

Copy Director (paralelo)
  → mapBriefToCopyDirectorInput()
    → mapeia intent → carrega prompt de copy correspondente
    → se offer: buildOfferText normal (de X por Y)
    → se spotlight: buildOfferText sem "de", só "R$ X" ou "Apenas R$ X"
    → se exclusive: sem preço no texto
```

---

## Arquivos Afetados

### Prompts (criar)

| Arquivo | Base |
|---------|------|
| `prompts/campaign-image-director-offer.md` | `campaign-image-director.md` atual (renomear/conteúdo atual) |
| `prompts/campaign-image-director-spotlight.md` | Novo — foco em vitrine, desejo, sem urgência promocional |
| `prompts/campaign-image-director-exclusive.md` | Novo — sem preço, foco em valor percebido, premium |
| `prompts/campaign-copy-director-offer.md` | `campaign-copy-director.md` atual (renomear/conteúdo atual) |
| `prompts/campaign-copy-director-spotlight.md` | Novo — copy de novidade/destaque |
| `prompts/campaign-copy-director-exclusive.md` | Novo — copy de exclusividade/sem preço |

### Código

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/services/image-generation-service.ts` | `buildPromptVariables()`: selecionar template por `campaignIntent`. Adicionar `preserveImageDirective`. Adaptar `buildCommercialRepertoire` e `buildCreativeContextGuidance` por intent. |
| `src/lib/image-generation/prompt-loader.ts` | Nada — já suporta carregar por nome |
| `src/lib/copy/mapper.ts` | `buildOfferText()` adaptado por intent: `offer` = "de X por Y", `spotlight` = "R$ X", `exclusive` = sem preço |
| `src/lib/copy/copy-director-service.ts` | Selecionar prompt de copy por intent |
| `src/components/campaign/types.ts` | Nada — já recebe `campaignInput` como `GenerateImageRequest` |

---

## Checklist de Entrega

- [ ] Prompt `campaign-image-director-offer.md` = cópia do atual, funcionando sem regressão
- [ ] Prompt `campaign-image-director-spotlight.md` criado (foco em vitrine, sem urgência)
- [ ] Prompt `campaign-image-director-exclusive.md` criado (sem preço, premium)
- [ ] Prompt `campaign-copy-director-offer.md` = cópia do atual
- [ ] Prompt `campaign-copy-director-spotlight.md` criado (novidade)
- [ ] Prompt `campaign-copy-director-exclusive.md` criado (exclusividade)
- [ ] `buildPromptVariables` seleciona template por `campaignIntent`
- [ ] `preserveImageDirective` injetada quando `preserveImageContext === true`
- [ ] `buildOfferText` adaptado por intent
- [ ] `npm run typecheck` limpo
- [ ] Geração de campanha `offer` existente continua funcionando (regressão zero)
- [ ] Geração de campanha `spotlight` com produto + preço funciona
- [ ] Geração de campanha `exclusive` sem preço funciona
