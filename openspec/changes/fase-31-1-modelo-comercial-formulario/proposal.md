## Why

Hoje o gerador de campanhas trata todo produto como oferta promocional — presume DE/POR, badge promocional obrigatório, copy sempre com framing de desconto. Isso força o lojista a preencher preço com desconto mesmo quando sua intenção não é promover, mas destacar um lançamento, produto premium ou algo exclusivo. A Fase 31 introduce roteamento por intenção comercial; a F31.1 é a primeira fatia: modelo conceitual + formulário + schemas, sem modificar prompts ainda.

## What Changes

1. **CampaignIntent type** (`"offer" | "spotlight" | "exclusive"`) em `src/lib/campaign/types.ts`
2. **`campaignIntent`** opcional nos schemas com default `"offer"` em `CampaignGenerationInputSchema` e `GenerateImageRequestSchema`
3. **`preserveImageContext: boolean`** opcional em `GenerateImageRequestSchema` e no formulário (visível apenas em spotlight/exclusive)
4. **Inferência automática de intent** a partir dos campos de preço: DE+POR → offer, só preço → spotlight, nenhum preço → exclusive
5. **Seletor de intent** (radio group) no formulário entre badge e botão "Criar Campanha" — spotlight/exclusive exibem "Em breve" e são bloqueados
6. **Submissão bloqueada** para spotlight/exclusive — apenas offer passa pelo `handleSubmit`
7. **Badge options separados por intent** em `src/lib/constants.ts` com `BADGE_OPTIONS_BY_INTENT: Record<CampaignIntent, readonly string[]>`
8. **Badge opcional** para spotlight/exclusive na validação do formulário
9. **`campaignIntent` e `preserveImageContext`** transportados no `inputSnapshot` pela rota `POST /api/campaign/generate-image`
10. **Normalização**: se `campaignIntent === "offer"`, `preserveImageContext` é normalizado para `false` no `inputSnapshot`
11. **`discountedPriceCents`** muda para `number | undefined` no `CampaignFormFields` (estado do form), mas mantém-se **required** nos schemas de geração (`GenerateImageRequestSchema`, `CampaignGenerationInputSchema`) para compatibilidade com o pipeline até F31.2

**Não faz parte desta fatia:**
- Modificar prompts do diretor de imagem, copy director ou revisor (F31.2)
- Ativar submissão de spotlight ou exclusive no pipeline (F31.2)
- Modificar `CampaignSpecSchema` (schema de saída da IA) — F31.2/31.3
- Testes de comportamento dos diretores por intent (F31.3)

## Capabilities

### New Capabilities

- `campaign-intent-types`: Definição do tipo `CampaignIntent` (`"offer" | "spotlight" | "exclusive"`) e integração nos schemas do pipeline
- `campaign-form-intent`: Seletor de intent no formulário com inferência automática, bloqueio de submissão, badge condicional e campo preserveImageContext
- `badge-options-by-intent`: Badge options separados por intent como `BADGE_OPTIONS_BY_INTENT`

### Modified Capabilities

- `campaign-types`: `InputSnapshot` ganha `campaignIntent` e `preserveImageContext`
- `campaign-input-ui`: Formulário ganha seletor de intent e checkbox preserveImageContext; badge select muda conforme intent
- `transactional-pipeline`: Rota `POST /api/campaign/generate-image` transporta `campaignIntent` e `preserveImageContext` no `inputSnapshot`
- `ai-campaign-intelligence`: `CampaignGenerationInputSchema` ganha `campaignIntent` opcional com default "offer"
- `ai-image-generation`: `GenerateImageRequestSchema` ganha `campaignIntent` e `preserveImageContext` opcionais

## Impact

- **Tipos novos:** 1 type enum em `src/lib/campaign/types.ts`
- **Schemas modificados:** `CampaignGenerationInputSchema` (+campaignIntent), `GenerateImageRequestSchema` (+campaignIntent, +preserveImageContext)
- **Formulário modificado:** `src/components/flow/use-campaign-form.ts` (CampaignFormFields com discountedPriceCents opcional, campaignIntent, preserveImageContext; inferência; validação condicional; normalização)
- **UI modificada:** `src/components/flow/campaign-input-form.tsx` (seletor de intent, badge condicional, checkbox preserveImageContext)
- **Constantes modificadas:** `src/lib/constants.ts` (BADGE_OPTIONS → BADGE_OPTIONS_BY_INTENT)
- **Pipeline modificado:** `src/app/api/campaign/generate-image/route.ts` (inputSnapshot com campaignIntent e preserveImageContext)
- **Component types modificados:** `src/components/campaign/types.ts` (CampaignInput herda novos campos via Omit<GenerateImageRequest>)
- **Testes novos:** Inferência, validação, badge condicional, preserveImageContext (12+ testes)
- **Regressão:** 1018+ testes existentes devem continuar passando
