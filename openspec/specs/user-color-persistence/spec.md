> **Purpose**: Defines the user color persistence system: how `brand_colors_chosen` stores the user's manual color choices (primary and accent), null support for partial choice, derivation of `hasUserChosenColors` exclusively from `brand_colors_chosen`, automatic flow isolation (no flow populates `brand_colors_chosen` with inferred/detected colors), the "Voltar para cores sugeridas" mechanism, and deprecation of `manual_color_override` across all layers.

## Requirements

### Requirement: brand_colors_chosen schema — null support

`brand_colors_chosen` SHALL be an `Array<string | null>` with exactly 2 positions when the user has made at least one choice. Posições `null` representam "usuário não escolheu esta cor". O array vazio (`[]`) representa "nenhuma escolha manual ativa".

Estados válidos:
- `[]` — nenhuma escolha manual ativa
- `[primaryHex, null]` — usuário escolheu apenas a cor primária
- `[null, accentHex]` — usuário escolheu apenas a cor de destaque
- `[primaryHex, accentHex]` — usuário escolheu ambas as cores

`primaryHex` e `accentHex` SHALL ser strings HEX válidas no formato `#RRGGBB`.

#### Scenario: Array vazio significa sem escolha manual

- **WHEN** `brand_colors_chosen` é `[]`
- **THEN** `hasUserChosenColors` SHALL ser `false`

#### Scenario: Null em uma posição significa escolha parcial

- **WHEN** `brand_colors_chosen` é `["#FF0000", null]`
- **THEN** `hasUserChosenColors` SHALL ser `true`
- **AND** a posição 1 (destaque) SHALL ser tratada como não escolhida

#### Scenario: Duas cores significa escolha completa

- **WHEN** `brand_colors_chosen` é `["#FF0000", "#00FF00"]`
- **THEN** `hasUserChosenColors` SHALL ser `true`

### Requirement: Escolha manual derivada de brand_colors_chosen

A existência de escolha manual ativa SHALL ser derivada exclusivamente de `brand_colors_chosen`:

```
hasUserChosenColors = brand_colors_chosen.some(c => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c))
```

Nenhum campo auxiliar (como `manual_color_override`) SHALL ser usado como fonte de verdade para determinar se há escolha manual ativa.

#### Scenario: Escolha manual derivada do array

- **WHEN** `brand_colors_chosen` contém ao menos um HEX válido
- **THEN** `hasUserChosenColors` SHALL ser `true`

#### Scenario: Array vazio significa sem escolha manual

- **WHEN** `brand_colors_chosen` é `[]`
- **THEN** `hasUserChosenColors` SHALL ser `false`

#### Scenario: Array com null em ambas posições

- **WHEN** `brand_colors_chosen` é `[null, null]`
- **THEN** `hasUserChosenColors` SHALL ser `false`
- **AND** `brand_colors_chosen` SHALL ser normalizado para `[]`

### Requirement: Persistência do par canônico no PATCH

Ao persistir escolhas manuais via `PATCH /api/store/[id]/brand-profile`, o sistema SHALL:

1. Ler o valor canônico de cada campo do color picker
2. Campo vazio ou com placeholder `#RRGGBB` → `null`
3. Campo com HEX válido (`#RRGGBB`) → valor HEX
4. Montar array `[primaryOuNull, accentOuNull]`
5. Se ambas as posições forem `null`, salvar `[]`
6. Se ao menos uma posição for HEX válido, salvar o array com 2 posições

#### Scenario: Persiste escolha parcial de primária

- **WHEN** primária é `#FF0000` e destaque está vazio
- **THEN** `brand_colors_chosen` salvo é `["#FF0000", null]`

#### Scenario: Persiste escolha parcial de destaque

- **WHEN** primária está vazio e destaque é `#00FF00`
- **THEN** `brand_colors_chosen` salvo é `[null, "#00FF00"]`

#### Scenario: Persiste escolha completa

- **WHEN** primária é `#FF0000` e destaque é `#00FF00`
- **THEN** `brand_colors_chosen` salvo é `["#FF0000", "#00FF00"]`

#### Scenario: Nenhuma escolha salva como array vazio

- **WHEN** primária e destaque estão vazios ou são `#RRGGBB`
- **THEN** `brand_colors_chosen` salvo é `[]`

#### Scenario: Placeholder #RRGGBB tratado como null

- **WHEN** o campo contém exatamente `#RRGGBB`
- **THEN** o valor SHALL ser tratado como `null`
- **AND** não deve ser persistido como escolha

### Requirement: Fluxos automáticos não geram brand_colors_chosen

Nenhum fluxo automático SHALL popular `brand_colors_chosen` com cores detectadas, inferidas, sugeridas ou fallback:

- Cores detectadas de logo (`logo_colors_detected`)
- Cores inferidas por IA (`inferred_primary_color`, `inferred_accent_color`)
- `safe_color_tokens`
- Paleta de assinatura visual
- Fallback por segmento
- Valor default visual do input nativo (`#000000`)

Fluxos automáticos SHALL preservar `brand_colors_chosen` existente quando houver escolha manual ativa. Quando não houver, o campo SHALL permanecer `[]`.

Text-only inference é exceção: pode persistir `userChosenColors` recebidos na requisição atual (ver spec de `store-brand-profile`).

#### Scenario: Logo analysis não popula brand_colors_chosen

- **WHEN** logo upload cria um brand profile synced
- **THEN** `brand_colors_chosen` SHALL preservar escolha manual existente ou ser `[]`
- **AND** `logo_colors_detected` SHALL conter as cores extraídas

#### Scenario: VS approval não popula brand_colors_chosen

- **WHEN** um brand profile é gerado de visual signature approval
- **THEN** `brand_colors_chosen` SHALL preservar escolha manual existente ou ser `[]`

#### Scenario: Realinhamento não substitui brand_colors_chosen

- **WHEN** re-inference é acionada via "Realinhar direção visual"
- **THEN** `brand_colors_chosen` SHALL preservar escolha manual existente ou ser `[]`

### Requirement: manual_color_override deprecated

Os campos `store_brand_profiles.manual_color_override` e `stores.manual_color_override` são **deprecated** para o contrato desta fase. Nenhum fluxo novo ou ajustado SHALL:

- Escrever `manual_color_override` (em qualquer tabela)
- Usar `manual_color_override` como condição para preservação de escolhas manuais
- Usar `stores.manual_color_override` como fonte de verdade

Código legado que ainda lê `manual_color_override` SHALL ser substituído por verificação direta de `brand_colors_chosen`.

#### Scenario: PATCH não escreve manual_color_override

- **WHEN** PATCH /api/store/[id]/brand-profile é chamado com colors
- **THEN** `store_brand_profiles.manual_color_override` SHALL NÃO ser atualizado
- **AND** `stores.manual_color_override` SHALL NÃO ser atualizado

#### Scenario: Leitura de manual_color_override substituída

- **WHEN** código precisa decidir se há escolha manual ativa
- **THEN** SHALL consultar `brand_colors_chosen` diretamente
- **AND** SHALL NÃO consultar `manual_color_override`
