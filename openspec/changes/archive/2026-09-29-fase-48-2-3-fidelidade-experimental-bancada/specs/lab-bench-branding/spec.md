# Lab Bench Branding — delta (F48.2.3)

## ADDED Requirements

### Requirement: Resolução cromática preservada

O contrato local de branding SHALL expor o `brandColor` resolvido pela **precedência produtiva efetiva** a partir dos campos cromáticos persistidos importados (`stores.brand_color`, `brand_colors_chosen`, `safe_color_tokens`, `inferred_primary_color`, `source`). Para o **único perfil `status='synced'`** (qualquer `source`, incluindo `text_only`): (1) `brand_colors_chosen[0]` válido → (2) `safe_color_tokens.primary` válido → (3) `inferred_primary_color` válido **apenas quando `source === 'text_only'`** → (4) `stores.brand_color` → (5) fallback de segmento. **Ausência de perfil synced SHALL ser tratada como ausência de perfil** (sem fallback `without_logo`). A bancada SHALL NOT introduzir nova precedência nem alterar o contrato produtivo de cores.

#### Scenario: brandColor é exposto

- **WHEN** o branding da loja é carregado
- **THEN** o contrato expõe o `brandColor` resolvido
- **AND** o valor é idêntico ao resolvido pelo fluxo produtivo

#### Scenario: Campos cromáticos persistidos são usados

- **WHEN** o `brandColor` é resolvido
- **THEN** apenas os campos cromáticos persistidos são considerados
- **AND** nenhuma nova precedência é inventada

#### Scenario: Ausência de perfil synced preserva os fallbacks reais

- **WHEN** não existe perfil `status='synced'`
- **THEN** o `brandColor` usa `stores.brand_color` e, na ausência, o fallback de segmento
- **AND** nenhum perfil não sincronizado é usado como baseline

### Requirement: Tipografia no briefing experimental

O contrato local de branding SHALL fornecer `typography_direction` ao briefing experimental da bancada, mantendo o carregamento do branding somente leitura e sem alterar `BrandProfileSnapshot`, `resolveStoreIdentity` ou a montagem de prompt produtiva.

#### Scenario: Tipografia alimenta o briefing

- **WHEN** o briefing experimental é montado
- **THEN** a direção tipográfica do contrato local é incluída
- **AND** o pipeline produtivo permanece intocado

### Requirement: Assets importados disponíveis localmente

O contrato local de branding SHALL ler os assets de identidade dos buckets locais (`store-logos`, `store-brand-assets`, `visual-signatures`) materializados pelo comando de importação, permanecendo o runtime da bancada **somente leitura** nesses buckets.

#### Scenario: Assets importados são exibidos

- **WHEN** a loja importada possui assets locais
- **THEN** a bancada os exibe por URL assinada de curta duração
- **AND** o runtime não grava nos buckets de branding
