## Why

As fases 4.6.1 a 4.6.6 estabeleceram detecção de drift, lifecycle de logo e assinatura visual, alinhamento de cores de perfil e transição de identidade. Durante esse processo, `brand_colors_chosen` passou a ser preenchido por fluxos automáticos (logo analysis, VS approve, realinhamento), misturando escolhas manuais do usuário com cores inferidas pelo sistema. Não há hoje um contrato claro que distinga "cor que o usuário escolheu" de "cor que o sistema sugeriu", causando inconsistência na hidratação dos color pickers e impedindo que o usuário retorne às cores sugeridas sem perder o estado visual da loja. Esta fase estabelece `brand_colors_chosen` como fonte da verdade exclusiva para escolhas manuais, com suporte a escolha parcial (null para posição não escolhida), e deprecia `manual_color_override` em todas as camadas.

## What Changes

- `store_brand_profiles.brand_colors_chosen` passa a aceitar `null` em qualquer posição do array, representando "usuário não escolheu esta cor"
- Escolha manual ativa é derivada exclusivamente de `brand_colors_chosen` conter ao menos uma string HEX válida
- `manual_color_override` (em `store_brand_profiles` e `stores`) é tratado como **deprecated** — nenhum fluxo novo ou ajustado deve depender dele
- Persistência ao alterar color picker: lê valor canônico de cada campo (vazio/placeholder → `null`, HEX → valor), salva `[primaryOuNull, accentOuNull]`; se ambos forem `null`, salva `[]`
- Adiciona ação "Voltar para cores sugeridas" no bloco de cores, visível apenas quando há escolha manual ativa
- Ação de reset limpa `brand_colors_chosen = []` sem regenerar direção visual, logo, VS ou campanhas
- Fluxos automáticos (logo, VS, text_only) não podem gerar valores para `brand_colors_chosen`; devem preservar escolhas existentes ou escolhas manuais recebidas do color picker na requisição atual
- `stores.brand_color` não é atualizado pelo color picker
- **BREAKING**: Logo upload (`logo-upload`) não deve mais setar `brand_colors_chosen = []` incondicionalmente — deve preservar escolha manual existente
- **BREAKING**: `manual_color_override` deixa de ser condição para preservação de escolhas manuais em VS approval e demais fluxos

## Capabilities

### New Capabilities

- `user-color-persistence`: Gerencia o ciclo de vida de `brand_colors_chosen` com suporte a null parcial, derivação de escolha manual ativa, persistência via PATCH de brand profile, reset para cores sugeridas, e hidratação coerente dos color pickers.

### Modified Capabilities

- `store-brand-profile`: Requisitos mudam — `manual_color_override` é deprecado; `brand_colors_chosen` aceita null; PATCH salva `[primaryOuNull, accentOuNull]`; GET retorna dados para UI distinguir escolha manual de cores sugeridas.
- `store-identity-ui`: Requisitos mudam — hidratação dos pickers deve respeitar null; condição de save via PATCH deixa de depender de `manual_color_override`; adiciona ação "Voltar para cores sugeridas".
- `logo-upload`: Requisito de isolação muda — `brand_colors_chosen` não é mais zerado incondicionalmente; deve preservar escolha manual existente.
- `visual-signature-approval`: Requisito de preservação muda — condição de `manual_color_override.enabled` substituída por verificação direta de `brand_colors_chosen`.

## Impact

- **API**: `PATCH /api/store/[id]/brand-profile` — lógica de validação e persistência de `brand_colors_chosen` com null; `GET /api/store/[id]/brand-profile` — resposta suficiente para UI detectar escolha manual
- **UI**: `src/components/flow/store-identity-form.tsx` — hidratação dos color pickers com null, ação "Voltar para cores sugeridas", save sem depender de `manual_color_override`
- **Text-only inference**: `src/app/api/store/[id]/brand-profile/infer/route.ts` — preservar `brand_colors_chosen` existente ou persistir as escolhas manuais recebidas na requisição atual
- **Logo upload**: `src/app/api/store/[id]/logo/route.ts` — não zerar `brand_colors_chosen` ao processar upload; preservar escolha manual existente
- **VS**: `src/app/api/store/[id]/visual-signature/approve/route.ts` — condição de preservação via `brand_colors_chosen` em vez de `manual_color_override`
- **Realinhamento**: `src/app/api/store/[id]/brand-profile/realign/route.ts` — preservar `brand_colors_chosen` existente
- **Store actions**: `src/lib/actions/store.ts` — save genérico não deve persistir cores manuais
- **Types/schemas**: `BrandProfileRecord`, `BrandProfileSnapshot` e validadores passam de `string[]` para `Array<string | null>`
- **Nenhuma migration nesta fase**: campos deprecated permanecem nos schemas do Supabase por compatibilidade; remoção fica para fase futura
