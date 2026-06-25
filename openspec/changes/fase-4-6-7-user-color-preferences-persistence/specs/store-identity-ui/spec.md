## MODIFIED Requirements

### Requirement: Brand color untouched rule

The color picker SHALL NOT auto-assign a color value. If the user never interacts with the color picker, `brand_color` SHALL be sent as `null` in the API request. The preview SHALL use the segment-based fallback color or, if a brand profile exists with `brand_colors_chosen`, use the first chosen color.

If the user explicitly selects or types a color, the chosen value SHALL be persisted through `brand_colors_chosen` via PATCH when a synced profile exists, or kept locally and sent as `userChosenColors` during text-only inference when no synced profile exists. It SHALL NOT be sent as `store.brand_color`.

Color picker hydration SHALL follow these rules:
- When `brand_colors_chosen` has at least one valid HEX: exibir o valor nas posições correspondentes, manter `null` nas posições não escolhidas
- When `brand_colors_chosen` is `[]`: exibir `safe_color_tokens` como fallback sugerido, se existir
- `#RRGGBB` placeholder SHALL NOT be treated as a valid color — SHALL be treated as `null`
- The canonical value (not the native input visual render) SHALL be the source of truth for persistence

#### Scenario: Untouched color uses segment or profile fallback

- **WHEN** the user saves the form with no color interaction
- **AND** a brand profile exists with brand_colors_chosen
- **THEN** the preview SHALL use the first color from brand_colors_chosen
- **AND** the brand_color field in the store SHALL be null

#### Scenario: Untouched color sends null

- **WHEN** the user saves the form
- **AND** the user never clicked or typed in the color picker
- **AND** no brand profile exists
- **THEN** `brand_color` SHALL be `null` in the API request

#### Scenario: Chosen color persists via brand profile, not stores.brand_color

- **WHEN** the user selects a color via the picker or types a hex value
- **AND** a synced profile exists
- **THEN** `brand_color` SHALL NOT be updated from the picker — the choice SHALL go to `brand_colors_chosen` via PATCH
- **AND** `stores.brand_color` SHALL remain unchanged

#### Scenario: Text only profile with partial choice pre-fills picker

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists with `brand_colors_chosen = ["#FF6600", null]`
- **THEN** the primary color picker SHALL display `#FF6600`
- **AND** the accent color picker SHALL display empty/placeholder (null position)

#### Scenario: Text only profile without user colors infers

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists with `brand_colors_chosen = []`
- **THEN** the primary color picker SHALL display `safe_color_tokens.primary`
- **AND** the accent color picker SHALL display `safe_color_tokens.accent`

#### Scenario: Placeholder #RRGGBB not persisted

- **WHEN** the text input contains `#RRGGBB`
- **THEN** the canonical value SHALL be treated as `null`
- **AND** SHALL NOT be persisted as a color choice

### Requirement: Save button triggers inference for text_only

When the user clicks "Salvar" in Step 2 and no logo is active and no visual signature is active, the system SHALL:
1. Set `identity_state = 'text_only'` and `text_only_origin = 'implicit'`
2. If `brand_colors_chosen` has at least one valid HEX value (hasUserChosenColors), pass as `userChosenColors` to the inference endpoint
3. Trigger the brand inference pipeline via `POST /api/store/[id]/brand-profile/infer` with `userChosenColors` in the body
4. Display the inference spinner

`manualColorOverride` SHALL NOT be sent or used.

The inference trigger condition SHALL be `logoStatus === null || inferenceError` — this ensures inference runs for new stores (logoStatus null) and re-runs on error.

#### Scenario: Save triggers implicit inference with colors

- **WHEN** the user clicks "Salvar" in Step 2
- **AND** no logo is active and no visual signature is active
- **AND** the user has chosen at least one color via picker
- **THEN** the system SHALL set `identity_state = 'text_only'` and `text_only_origin = 'implicit'`
- **AND** pass `userChosenColors = [primaryOuNull, accentOuNull]` to the inference endpoint
- **AND** `manualColorOverride` SHALL NOT be sent
- **AND** trigger the brand inference pipeline
- **AND** display the inference spinner

#### Scenario: Save triggers inference without colors

- **WHEN** the user clicks "Salvar" in Step 2
- **AND** no logo is active and no visual signature is active
- **AND** the user has NOT chosen any color via picker
- **THEN** the system SHALL set `identity_state = 'text_only'` and `text_only_origin = 'implicit'`
- **AND** pass `userChosenColors = []` to the inference endpoint
- **AND** trigger the brand inference pipeline

### Requirement: Color picker — Voltar para cores sugeridas

O sistema SHALL exibir uma ação "Voltar para cores sugeridas" no bloco de cores do Step 2, visível apenas quando houver escolha manual ativa (`brandColorsChosen.some(c => c !== null)`).

Ação:
- Link/button discreto (texto sem destaque, sem borda)
- Rótulo: "Voltar para cores sugeridas"
- Comportamento depende de existência de synced profile:
  - Se houver synced profile: envia `PATCH /api/store/[id]/brand-profile` com `{ colors: [] }`
  - Se não houver synced profile: apenas limpa estado local, sem requisição
- Após: `brandColorsChosen` local vira `[]`, pickers exibem cores sugeridas

#### Scenario: Botão visível com escolha manual ativa

- **WHEN** `brandColorsChosen` contém ao menos um HEX válido
- **THEN** o botão "Voltar para cores sugeridas" SHALL estar visível

#### Scenario: Botão oculto sem escolha manual

- **WHEN** `brandColorsChosen` é `[]`
- **THEN** o botão "Voltar para cores sugeridas" SHALL estar oculto

#### Scenario: Reset com synced profile chama PATCH

- **WHEN** o usuário clica em "Voltar para cores sugeridas"
- **AND** existe synced profile
- **THEN** PATCH /api/store/[id]/brand-profile SHALL ser chamado com `{ colors: [] }`
- **AND** `brandColorsChosen` SHALL ser `[]`
- **AND** os pickers SHALL exibir `safe_color_tokens` ou fallback equivalente, se existir

#### Scenario: Reset sem synced profile limpa estado local

- **WHEN** o usuário clica em "Voltar para cores sugeridas"
- **AND** não existe synced profile
- **THEN** `brandColorsChosen` local SHALL ser `[]`
- **AND** PATCH SHALL NÃO ser chamado
- **AND** os pickers SHALL exibir `safe_color_tokens` ou fallback equivalente, se existir

### Requirement: Color picker onChange/onBlur persistence

O sistema SHALL persistir a escolha de cor de acordo com a disponibilidade de profile:

- **Se houver synced profile**: disparar `PATCH /api/store/[id]/brand-profile` em tempo real com o par canônico `[primaryOuNull, accentOuNull]`
  - onChange do color picker nativo: dispara PATCH
  - onBlur do input de texto: se HEX válido, dispara PATCH; se inválido, mostra erro e não persiste
  - Valores inválidos ou vazios: posição correspondente vira `null`

- **Se não houver synced profile**: manter escolha em estado local (`brandColorsChosen`). O par é enviado como `userChosenColors` no text-only inference

#### Scenario: PATCH disparado em tempo real com profile existente

- **WHEN** o usuário altera a cor primária no color picker nativo
- **AND** existe um synced profile
- **THEN** `PATCH /api/store/[id]/brand-profile` SHALL ser chamado com `{ "colors": [novaPrimary, accentAtualOuNull] }`

#### Scenario: Escolha mantida em estado local sem profile

- **WHEN** o usuário altera a cor primária no color picker nativo
- **AND** não existe synced profile
- **THEN** `brandColorsChosen` local SHALL ser atualizado
- **AND** PATCH SHALL NÃO ser chamado
- **AND** o par será enviado como `userChosenColors` no text-only inference

#### Scenario: onBlur com HEX válido persiste

- **WHEN** o usuário digita `#FF6600` no campo de texto da primária
- **AND** existe synced profile
- **THEN** PATCH SHALL ser chamado com o par canônico

#### Scenario: onBlur com valor inválido não persiste

- **WHEN** o usuário digita texto inválido no campo de texto
- **THEN** erro de validação SHALL ser exibido
- **AND** PATCH SHALL NÃO ser chamado

### Requirement: Color hydration after realinhar (updated)

After successful re-inference via "Realinhar", the response from `POST /api/store/[id]/brand-profile/infer` SHALL hydrate:

- `brandColorsChosen` (via `setBrandColorsChosen`): from `profile.brand_colors_chosen` (pode conter `null`)

When `brandColorsChosen` has at least one valid HEX (hasUserChosenColors):
- `brand_color` (via `setField`): from `brandColorsChosen[0]` se não for `null`, senão vazio
- `accentColor` (via `setAccentColor`): from `brandColorsChosen[1]` se não for `null`, senão vazio

When `brandColorsChosen` is `[]` (no user choice):
- `brand_color` (via `setField`): from `profile.safe_color_tokens.primary`
- `accentColor` (via `setAccentColor`): from `profile.safe_color_tokens?.accent` senão `profile.inferred_accent_color`

#### Scenario: Realinhar hydrates partial choice

- **WHEN** `profile.brand_colors_chosen` is `["#FF6600", null]` after realinhar
- **THEN** `setBrandColorsChosen` SHALL be called with `["#FF6600", null]`
- **AND** `setField` SHALL be called with `"brand_color"`, `"#FF6600"`
- **AND** `setAccentColor` SHALL be called with empty string (null position)
- **AND** the accent color picker SHALL display empty/placeholder

#### Scenario: Realinhar hydrates full pair

- **WHEN** `profile.brand_colors_chosen` is `["#FF6600", "#E8A040"]` after realinhar
- **THEN** `setBrandColorsChosen` SHALL be called with `["#FF6600", "#E8A040"]`
- **AND** `setField` SHALL be called with `"brand_color"`, `"#FF6600"`
- **AND** `setAccentColor` SHALL be called with `"#E8A040"`

#### Scenario: Realinhar hydrates from safe_color_tokens when no user choice

- **WHEN** `profile.brand_colors_chosen` is `[]` after realinhar
- **AND** `profile.safe_color_tokens.primary` is `"#4A6FA5"`
- **AND** `profile.safe_color_tokens.accent` is `"#22C55E"`
- **THEN** `setBrandColorsChosen` SHALL be called with `[]`
- **AND** `setField` SHALL be called with `"brand_color"`, `"#4A6FA5"`
- **AND** `setAccentColor` SHALL be called with `"#22C55E"`
