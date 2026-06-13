## Why

Atualmente, quando o lojista opta por não ter logo (explicitamente via "Continuar sem logo" ou implicitamente via "Salvar" sem logo nem assinatura visual), o sistema apenas persiste `logo_status = explicit_none` sem gerar qualquer direção visual. Isso deixa a loja sem identidade de marca — sem paleta, estilo, tom ou personalidade — resultando em campanhas genéricas baseadas apenas em fallback de segmento.

Três cenários equivalentes (clicou "Continuar sem logo", escolheu cores e salvou sem logo, salvou sem logo nem cores) devem acionar o diretor de marketing para inferir uma direção visual completa a partir dos dados cadastrais da loja, persistindo-a em `store_brand_profiles` com `source = 'text_only'`.

## What Changes

- **Nova inferência de direção visual** — criação de prompt, serviço e rota `POST /api/store/[id]/brand-profile/infer` que aciona o diretor de marketing para gerar identidade visual completa (paleta, estilo, tom, personalidade, diretrizes) a partir dos dados da loja, sem necessidade de logo ou assinatura visual
- **Sincronização do estado `identity_state`** — ao entrar em text_only, popula ambos `identity_state` + `logo_status = 'explicit_none'` para compatibilidade; UI migra para ler `identity_state` como fonte primária de estado
- **Remoção do link "Continuar sem logo"** — substituído por chip "Direção visual definida pelo Vendeo" quando `identity_state = 'text_only'` e houver profile synced; se profile estiver failed ou ausente, link "Gerar direção visual" é exibido; botões "Enviar logotipo" e "Não tenho logo" permanecem visíveis em ambos os casos
- **Color pickers pré-preenchidos** — com `brand_colors_chosen` (se usuário escolheu) ou `safe_color_tokens` / `inferred_primary_color` (se IA inferiu); isso é apenas feedback visual na UI — a paleta efetiva para renderização de campanhas continua sendo `safe_color_tokens.primary`; abaixo dos pickers, chips com paleta completa de `safe_color_tokens`
- **Preview expandido** — exibe `visual_style`, `visual_tone`, `brand_personality`, paleta `safe_color_tokens` e chip de direção definida
- **Correção de prioridade de cor nas campanhas** — `safe_color_tokens.primary > inferred_primary_color > store.brand_color > segment fallback`; `brand_colors_chosen` passa a ser insumo da inferência e dado de UI, não fonte final de renderização
- **Migration** para alinhar migrations versionadas com o schema remoto (`identity_state`, `text_only_origin`, `manual_color_override`, `previous_identity_snapshot` em `stores`; `manual_color_override` e ajuste de CHECK do `source` em `store_brand_profiles`)

## Capabilities

### New Capabilities

- `text-only-brand-inference`: Inferência de identidade visual completa para lojas sem logo nem assinatura visual. Inclui prompt `store-brand-inference.md`, serviço de inferência, rota `POST /api/store/[id]/brand-profile/infer`, persistência em `store_brand_profiles` com `source = 'text_only'`, tratamento de erro não-bloqueante com fallback: `store.brand_color` > fallback de segmento.
- `store-identity-state`: Gerenciamento do estado de identidade visual (`identity_state`, `text_only_origin`, `manual_color_override`, `previous_identity_snapshot`). Nesta fase, define o estado `text_only` e mantém compatibilidade com `logo_status` via dual-population. Transições completas entre estados (text_only ↔ logo ↔ visual_signature) ficam para subfases futuras.

### Modified Capabilities

- `store-identity-ui`: Comportamento do Step 2 (Logo e Cores) quando `identity_state = 'text_only'` — preenchimento de color pickers, exibição de paleta, preview expandido, remoção do link "Continuar sem logo", estado de carregamento com spinner, tratamento de falha da IA.
- `store-brand-profile`: Adicionar `'text_only'` ao CHECK constraint de `source`. Nova semântica de `brand_colors_chosen` (exclusivamente cores do usuário). Adicionar coluna `manual_color_override`. No upload futuro de logo, o perfil `text_only` será marcado como `outdated` — a reativação em transição de volta será definida em subfase futura.
- `creative-direction-context`: Corrigir prioridade de resolução de cor nas campanhas para `safe_color_tokens.primary > inferred_primary_color > store.brand_color > segment fallback`. `brand_colors_chosen` deixa de ser fonte final de renderização.

## Impact

- **Código novo**: `prompts/store-brand-inference.md`, serviço `BrandTextOnlyInferenceService` (ou similar), rota `POST /api/store/[id]/brand-profile/infer`
- **Código modificado**: `store-identity-form.tsx` (handleContinueWithoutLogo, handleStep2Submit, load), `StorePreview` (novos campos), `resolveStoreIdentity` (novo bloco `source = 'text_only'`), `Store` interface (novos campos)
- **Migration**: nova migration `20260612000001_add_identity_state_fields.sql` para alinhar schema versionado com o remoto
- **Prompts**: novo `store-brand-inference.md`
- **Specs alteradas**: `store-identity-ui`, `store-brand-profile`, `creative-direction-context`
- **Fora de escopo (subfases futuras)**: correção de escrita de `brand_colors_chosen` nos fluxos `logo` (4.6.2) e `visual_signature` (4.6.3)
