## Context

O gerador de campanhas trata todo produto como oferta promocional `DE / POR`, com badge promocional obrigatório. A Fase 31 introduz roteamento por intenção comercial (`campaignIntent`). A F31.1 é a primeira fatia: modelo conceitual, schemas e formulário — sem modificar prompts de IA.

**Estado atual:**
- `InputSnapshot`: `discountedPriceCents` é required (number)
- `CampaignFormFields`: `discountedPriceCents` é number (sempre 0+)
- `CampaignGenerationInputSchema`: `discountedPriceCents` required
- `GenerateImageRequestSchema`: `discountedPriceCents` required, sem `campaignIntent`
- `BADGE_OPTIONS`: lista única no `constants.ts`
- `campaign-input-form.tsx`: badge select fixo, sem seletor de intent
- `generate-image/route.ts`: `inputSnapshot` sem campos de intent

**Dependências:** F25 (pipeline route), F27 (form/balance), F30 (legal clearance no pipeline)

## Goals / Non-Goals

**Goals:**
- `CampaignIntent` type (`"offer" | "spotlight" | "exclusive"`) em `src/lib/campaign/types.ts`
- `campaignIntent` opcional nos schemas com default `"offer"`
- `preserveImageContext: boolean` opcional no schema e formulário
- Inferência automática de intent: DE+POR → offer, só preço → spotlight, sem preço → exclusive
- Seletor de intent (radio group) entre badge e botão "Criar" — spotlight/exclusive exibem "Em breve", submissão bloqueada
- `BADGE_OPTIONS_BY_INTENT` separado por intent; badge opcional para spotlight/exclusive
- `discountedPriceCents` opcional no `CampaignFormFields` mas required nos schemas de geração
- `campaignIntent` e `preserveImageContext` no `inputSnapshot`
- Normalização: `preserveImageContext = false` quando `campaignIntent === "offer"`
- 12+ testes (inferência, validação, badge condicional, preserveImageContext)

**Non-Goals:**
- Modificar prompts de diretor de imagem, copy director ou revisor (F31.2)
- Ativar submissão de spotlight ou exclusive no pipeline (F31.2)
- Modificar `CampaignSpecSchema` — continua com `badge_text` e `discounted_price_display` obrigatórios (F31.2/31.3)
- Testes de comportamento dos diretores por intent (F31.3)

## Decisions

### D1 — campaignIntent como enum literal

`DECIDIDO`

```typescript
// src/lib/campaign/types.ts
export type CampaignIntent = "offer" | "spotlight" | "exclusive";
```

Internamente o sistema sempre transporta `campaignIntent`. O termo PT-BR na UI:
- Oferta → `offer`
- Destaque → `spotlight`
- Exclusivo → `exclusive`

### D2 — Inferência automática + seletor restrito

`DECIDIDO`

| Campos preenchidos | Intent inferida | Opções disponíveis |
|---|---|---|
| DE + POR | `offer` | [offer] |
| Só preço (discounted) | `spotlight` | [offer \| spotlight] |
| Nenhum preço | `exclusive` | [spotlight \| exclusive] |

Funciona em `useCampaignForm` como `inferIntent(originalPriceCents: number, discountedPriceCents: number | undefined | null): CampaignIntent` — valores `undefined`/`null` são normalizados para `0` antes da comparação. O seletor vem pré-selecionado com a intent inferida e posicionado entre o badge select e o botão "Criar Campanha".

### D3 — discountedPriceCents opcional no form, required no pipeline

`DECIDIDO`

`CampaignFormFields.discountedPriceCents`: `number | undefined` (undefined = campo vazio).

Schemas de geração mantêm `discountedPriceCents` como `required`:

- `CampaignGenerationInputSchema`: `z.number().positive()` — sem mudança
- `GenerateImageRequestSchema`: `z.number().int().positive()` — sem mudança

Regra: `campaignIntent` padrão é `"offer"`. Enquanto for `offer`, o formulário valida `discountedPriceCents` como obrigatório (via `validateDiscountedPrice`). A serialização em `handleSubmit` só envia o body quando a intent for `offer` — spotlight/exclusive são bloqueados no submit.

Compatibilidade futura: quando a F31.2 ativar `spotlight`/`exclusive`, os schemas tornam `discountedPriceCents` opcional e os consumidores (`formatPriceBRL`, `buildOfferText`, etc.) recebem fallback por intent.

### D4 — Badge condicional por intent

`DECIDIDO`

| Intent | Badges disponíveis |
|---|---|
| `offer` | Promoção, Oferta, Queima de Estoque, Últimas Unidades, Imperdível |
| `spotlight` | Novidade, Lançamento, Mais Vendido, Top de Linha, Destaque da Semana |
| `exclusive` | Exclusivo, Premium, Sob Encomenda, Edição Limitada |

Badge passa a ser **opcional** para `spotlight` e `exclusive` na validação. O select inclui opção vazia ("Nenhum") para esses intents.

### D5 — preserveImageContext: boolean

`DECIDIDO`

- **Sempre invisível** para intent `offer` (promoção precisa de isolamento para hierarquia agressiva)
- **Visível e opcional** para `spotlight` e `exclusive`
- Quando `true`, transportado até `inputSnapshot` para uso futuro (F31.2 injeta a instrução no prompt do diretor de imagem)
- **Regra de normalização:** se `campaignIntent === "offer"`, `preserveImageContext` é normalizado para `false` no `inputSnapshot`

### D6 — Sem migration de banco

`DECIDIDO`

`campaignIntent` e `preserveImageContext` são transportados apenas no `inputSnapshot` (JSONB). Não há nova coluna ou tabela. A normalização descarta o valor para `offer`, mantendo os registros existentes compatíveis.

### D7 — Pipeline guard: rejeitar intents não-offer no pré-stream

`DECIDIDO`

O pipeline adiciona um guard no pré-stream (após schema parse, antes de criar campanha):

```typescript
if (body.campaignIntent && body.campaignIntent !== "offer") {
  return Response.json(
    { error: { message: "Intenção comercial indisponível. Apenas ofertas podem ser geradas no momento." } },
    { status: 400 }
  );
}
```

Este guard é uma **camada de segurança**, não o bloqueio principal (que ocorre no client-side `handleSubmit`). Garante que mesmo que um request malformado ou chamada externa chegue com `campaignIntent !== "offer"`, o pipeline rejeita antes de qualquer consumo de crédito ou chamada de IA.

### D8 — Nomenclatura preparada para expansão

`DECIDIDO`

- `campaignIntent` → reutilizável para qualquer canal/formato
- `preserveImageContext` → independente do intent
- `badgeKind` (futuro) → `promotional | product_signal | trust_signal | none`

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| **discountedPriceCents undefined no form quebra consumidores do pipeline** | Schemas de geração mantêm `required`. `handleSubmit` só envia quando intent=offer (que valida preço). Pipeline nunca recebe requisição sem `discountedPriceCents` |
| **preserveImageContext=true oferece comportamento indefinido até F31.2** | Normalização para `offer`. Para spotlight/exclusive, o campo existe no schema mas a F31.2 é responsável por interpretá-lo. Até lá, é transportado sem efeito colateral |
| **Troca de intent limpa badge inválido** | `useCampaignForm` detecta mudança de intent e reseta badge para vazio se a opção atual não existir na lista da nova intent |
| **Campo preserveImageContext invisível em offer mas presente no schema** | O campo existe no schema para que a F31.2 não precise alterar schemas. O formulário simplesmente não renderiza o checkbox quando intent=offer |
