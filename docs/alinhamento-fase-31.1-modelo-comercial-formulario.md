# Alinhamento Fase 31.1 — Modelo Comercial e Formulário (v1.5)

## Contexto

O gerador de campanhas do Vendeo hoje trata todo produto como uma **oferta promocional** — presume `DE / POR`, badge promocional obrigatório, copy sempre com framing de desconto. Isso força o lojista a preencher preço com desconto mesmo quando sua intenção não é promover, mas sim destacar um lançamento, um produto premium ou algo exclusivo.

A fase 31 introduz o **roteamento por intenção comercial**: o Vendeo passa a entender *que tipo de venda* o lojista está fazendo e adapta direção visual, copy e apresentação de preço de acordo.

A Fase 31.1 é a **primeira fatia**: modelo conceitual + formulário + schemas. Sem prompts novos ainda — apenas preparar o sistema para aceitar e transportar a intenção comercial.

```
v1.5 — Lançamento Externo Controlado
  └── F31 — Roteamento de Intenção Comercial
        ├── F31.1 — Modelo Comercial e Formulário       ← esta fatia
        ├── F31.2 — Diretores por Intenção
        └── F31.3 — Revisão e Validação Ponta a Ponta
```

---

## Propósito

1. Introduzir o conceito de `campaignIntent` como tipo comercial (`offer | spotlight | exclusive`)
2. Adicionar `discountedPriceCents` como opcional no estado/tipo do formulário, mantendo **obrigatório nos schemas de geração** até a F31.2 ativar os outros intents (ver Compatibilidade)
3. Implementar inferência automática de intent a partir dos campos de preço preenchidos
4. Adicionar seletor de intent no formulário com constraints e bloqueio: apenas `offer` é submetível — `spotlight` e `exclusive` aparecem mas exibem "Em breve"
5. Adaptar badge para lista condicional por intent
6. Adicionar campo `preserveImageContext: boolean` (visível apenas em spotlight/exclusive)
7. Transportar `campaignIntent` e `preserveImageContext` pelo pipeline até o `inputSnapshot`

**Não faz parte desta fatia:**
- Modificar prompts do diretor de imagem, copy director ou revisor (é a F31.2)
- Ativar submissão de `spotlight` ou `exclusive` no pipeline (bloqueado até F31.2)
- Modificar `CampaignSpecSchema` (schema de saída da IA) — `badge_text` e `discounted_price_display` continuam obrigatórios até F31.2/31.3
- Testes de comportamento dos diretores por intent (é a F31.3)

---

## Decisões de Implementação

### D1 — `campaignIntent` como enum

```
src/lib/campaign/types.ts
  campaignIntent: "offer" | "spotlight" | "exclusive"
```

Internamente o sistema sempre transporta `campaignIntent`. O termo em PT-BR na UI é:
- Oferta → `offer`
- Destaque → `spotlight`
- Exclusivo → `exclusive`

### D2 — Inferência automática + seletor restrito

```
Campos preenchidos       Intent inferida      Opções disponíveis
────────────────────     ───────────────      ──────────────────
DE + POR                 offer                [offer]
Só preço (discounted)    spotlight            [offer | spotlight]
Nenhum preço             exclusive            [spotlight | exclusive]
```

O seletor aparece **após o preenchimento dos campos de preço**, posicionado entre o badge e o botão "Criar Campanha". Vem pré-selecionado com a intent inferida.

### D3 — `discountedPriceCents` e regra de compatibilidade com o pipeline

O estado interno `CampaignFormFields.discountedPriceCents` passa a aceitar `number | undefined` (undefined = campo vazio no formulário). Mas **todos os schemas de geração mantêm `discountedPriceCents` como required** até a F31.2 — `GenerateImageRequestSchema` continua `z.number().positive()`, `CampaignGenerationInputSchema` idem.

Regra: `campaignIntent` padrão é `"offer"`. Enquanto for `offer`, o formulário valida `discountedPriceCents` como obrigatório e o pipeline nunca recebe uma requisição sem preço. A serialização em `useCampaignForm.handleSubmit` só envia o body quando a intent for `offer`.

Schemas alterados nesta fatia (apenas adição de campos opcionais, sem tornar nada `optional` no pipeline):

1. `CampaignFormFields` — `discountedPriceCents` passa a ser `number | undefined` (undefined = campo vazio no form)
2. `CampaignGenerationInputSchema` — adicionar `campaignIntent` opcional com default `"offer"`
3. `GenerateImageRequestSchema` — adicionar `campaignIntent` opcional, `preserveImageContext` opcional

Compatibilidade futura: quando a F31.2 ativar `spotlight`/`exclusive`, o `GenerateImageRequestSchema` torna `discountedPriceCents` opcional e os consumidores (formatPriceBRL, buildOfferText, etc.) recebem fallback por intent.

### D4 — Badge condicional por intent

A lista de opções do `<select>` muda conforme a intent:

| Intent | Badges disponíveis |
|--------|-------------------|
| `offer` | Promoção, Oferta, Queima de Estoque, Últimas Unidades, Imperdível |
| `spotlight` | Novidade, Lançamento, Mais Vendido, Top de Linha, Destaque da Semana |
| `exclusive` | Exclusivo, Premium, Sob Encomenda, Edição Limitada (ou vazio — badge opcional) |

Internamente, badge passa a ser **opcional** para `spotlight` e `exclusive`.

### D5 — `preserveImageContext: boolean`

Campo "Preservar imagem" exibido como checkbox:

- **Sempre invisível** para intent `offer` (promoção precisa de isolamento do produto para hierarquia agressiva)
- **Visível e opcional** para `spotlight` e `exclusive`

Quando `true`, o valor é transportado até `inputSnapshot`/request para uso posterior pela F31.2. A F31.2 será responsável por injetar a instrução de não recorte no prompt do diretor de imagem (`preserveImageDirective`). Nesta fatia, o campo existe no schema e no form mas não altera comportamento do pipeline (intent `offer` é a única ativa, e `preserveImageContext` é invisível para `offer`).

**Regra de normalização:** se `campaignIntent === "offer"`, `preserveImageContext` deve ser normalizado para `false` (ou omitido) no `inputSnapshot`, independente do que o formulário enviar. Isso previne que chamadas externas ou estado residual enviem `offer + preserveImageContext=true` e criem ambiguidade quando a F31.2 ativar o campo.

### D6 — Nomenclatura preparada para expansão

```
campaignIntent     → reutilizável para qualquer canal/formato
preserveImageContext → independente do intent
badgeKind (futuro) → promotional | product_signal | trust_signal | none
```

---

## Arquivos Afetados

### Tipos e Schemas

| Arquivo | Mudança |
|---------|---------|
| `src/lib/campaign/types.ts` | Adicionar `CampaignIntent`, `campaignIntent` em `InputSnapshot` |
| `src/lib/campaign-intelligence/schema.ts` | `CampaignGenerationInputSchema`: adicionar `campaignIntent` opcional com default `"offer"`. `discountedPriceCents` mantido required (compatibilidade) |
| `src/lib/image-generation/schema.ts` | `GenerateImageRequestSchema`: adicionar `campaignIntent` opcional, `preserveImageContext` opcional. `discountedPriceCents` mantido required |
| `src/components/campaign/types.ts` | `CampaignInput` herda novos campos via `Omit<GenerateImageRequest, 'storeId'>` |

### Consumidores do pipeline (identificados, não modificados nesta fatia)

| Arquivo | Dependência | Previsto para |
|---------|-------------|---------------|
| `src/lib/image-generation/services/image-generation-service.ts` | `formatPriceBRL(body.discountedPriceCents)` — exige número | F31.2 |
| `src/lib/copy/mapper.ts` | `buildOfferText({ discountedPriceCents })` — exige número | F31.2 |
| `src/lib/campaign-intelligence/schema.ts` | `CampaignSpecSchema.offer.discounted_price_display` — obrigatório | F31.2/31.3 |
| `src/lib/campaign-intelligence/schema.ts` | `CampaignSpecSchema.offer.badge_text` — obrigatório | F31.2/31.3 |

### Formulário

| Arquivo | Mudança |
|---------|---------|
| `src/components/flow/use-campaign-form.ts` | `CampaignFormFields`: `discountedPriceCents` opcional, adicionar `campaignIntent`, `preserveImageContext`. Validação condicional (preço, badge). Inferência de intent. |
| `src/components/flow/campaign-input-form.tsx` | Adicionar seletor de intent (radio group), checkbox preserve image, badge condicional |

### Badge Options

| Arquivo | Mudança |
|---------|---------|
| `src/lib/constants.ts` | Separar `BADGE_OPTIONS` por intent, ou criar `BADGE_OPTIONS_BY_INTENT: Record<CampaignIntent, readonly string[]>` |

### Pipeline (transporte)

| Arquivo | Mudança |
|---------|---------|
| `src/app/api/campaign/generate-image/route.ts` | Incluir `campaignIntent` e `preserveImageContext` no `inputSnapshot` |

---

## Checklist de Entrega

- [ ] `CampaignIntent` type definido (`"offer" | "spotlight" | "exclusive"`)
- [ ] `campaignIntent` opcional nos schemas com default `"offer"`
- [ ] `preserveImageContext` no schema e no formulário
- [ ] Inferência de intent implementada a partir dos campos de preço
- [ ] Seletor de intent visível no formulário, `spotlight`/`exclusive` exibem "Em breve"
- [ ] Submissão bloqueada para `spotlight`/`exclusive` — apenas `offer` passa
- [ ] Badge options separados por intent
- [ ] Badge opcional em `spotlight`/`exclusive` na validação do form
- [ ] `campaignIntent` e `preserveImageContext` no `inputSnapshot`
- [ ] `GenerateImageRequestSchema` mantém `discountedPriceCents` required (sem quebra de pipeline)
- [ ] Testes de inferência: DE+POR → offer, só preço → spotlight, sem preço → exclusive
- [ ] Testes de validação: DE+POR com intent spotlight → bloqueado; preço original sem preço atual → erro
- [ ] Testes de badge condicional: trocar intent limpa badge inválido
- [ ] Testes de `preserveImageContext`: visível só em spotlight/exclusive; reset ao voltar para offer
- [ ] `npm run typecheck` limpo
- [ ] `npm run build` limpo
- [ ] Testes de regressão existentes passando (1018+)
