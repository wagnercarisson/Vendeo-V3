## ADDED Requirements

### Requirement: STORE_SEGMENTS constant

The system SHALL define `STORE_SEGMENTS` as a `const` array in `src/lib/constants.ts` with 13 entries, each having `value` (kebab-case slug) and `label` (human-readable Portuguese). This replaces the previous `VALID_SEGMENTS` and `SEGMENT_LABELS`.

Values:

| value | label |
|-------|-------|
| `moda-calcados-acessorios` | Moda, Calçados e Acessórios |
| `bebidas-adegas-conveniencia` | Bebidas, Adegas e Conveniência |
| `padaria-confeitaria-doces` | Padaria, Confeitaria e Doces |
| `beleza-estetica` | Beleza e Estética |
| `petshop` | Pet Shop |
| `variedades-utilidades` | Variedades e Utilidades |
| `mercados-mercearias` | Mercados e Mercearias |
| `restaurantes-lanchonetes` | Restaurantes e Lanchonetes |
| `farmacia-saude` | Farmácia e Saúde |
| `casa-decoracao` | Casa e Decoração |
| `eletronicos-tecnologia` | Eletrônicos e Tecnologia |
| `servicos-locais` | Serviços Locais |
| `outros` | Outros |

#### Scenario: STORE_SEGMENTS has 13 entries

- **WHEN** `STORE_SEGMENTS` is inspected
- **THEN** it SHALL have exactly 13 entries

#### Scenario: Each entry has value and label

- **WHEN** iterating over `STORE_SEGMENTS`
- **THEN** each entry SHALL have a `value` (string) and `label` (string)

#### Scenario: Values are unique

- **WHEN** checking all `value` fields
- **THEN** no two entries SHALL share the same value

### Requirement: StoreSegment type

The system SHALL define `StoreSegment` as a derived type from `STORE_SEGMENTS`: `(typeof STORE_SEGMENTS)[number]["value"]`.

#### Scenario: StoreSegment type matches values

- **WHEN** a variable is typed as `StoreSegment`
- **THEN** it SHALL only accept values present in `STORE_SEGMENTS`

### Requirement: STORE_SUBSEGMENTS record

The system SHALL define `STORE_SUBSEGMENTS` as a `Record<StoreSegment, readonly { value: string; label: string }[]>` in `src/lib/constants.ts`, mapping each segment to its list of subsegment options.

Subsegment lists SHALL be exactly as follows (each entry is `{ value, label }`):

**Rich segments** (6) — each includes `{ value: "outro", label: "Outro" }` as the last entry:

| Segmento | Subsegmentos (value → label) |
|----------|------------------------------|
| `moda-calcados-acessorios` | `moda-feminina` → Moda Feminina, `moda-masculina` → Moda Masculina, `moda-infantil` → Moda Infantil, `moda-intima` → Moda Íntima, `moda-fitness` → Moda Fitness, `moda-praia` → Moda Praia, `calcados` → Calçados, `bolsas-acessorios` → Bolsas e Acessórios, `bijuterias-semijoias` → Bijuterias e Semijoias, `brecho` → Brechó, `boutique` → Boutique |
| `bebidas-adegas-conveniencia` | `adega` → Adega, `loja-de-bebidas` → Loja de Bebidas, `distribuidora-de-bebidas` → Distribuidora de Bebidas, `emporio-de-bebidas` → Empório de Bebidas, `conveniencia` → Conveniência, `cervejas-artesanais` → Cervejas Artesanais, `vinhos` → Vinhos, `destilados` → Destilados, `bebidas-geladas` → Bebidas Geladas |
| `padaria-confeitaria-doces` | `padaria` → Padaria, `panificadora` → Panificadora, `confeitaria` → Confeitaria, `doceria` → Doceria, `bolos-caseiros` → Bolos Caseiros, `salgados` → Salgados, `cafeteria` → Cafeteria, `sorveteria-acaiteria` → Sorveteria / Açaíteria, `chocolateria` → Chocolateria |
| `beleza-estetica` | `salao-de-beleza` → Salão de Beleza, `barbearia` → Barbearia, `esmalteria` → Esmalteria, `manicure-pedicure` → Manicure e Pedicure, `sobrancelhas-cilios` → Sobrancelhas e Cílios, `estetica-facial` → Estética Facial, `estetica-corporal` → Estética Corporal, `depilacao` → Depilação, `maquiagem` → Maquiagem, `cosmeticos-perfumaria` → Cosméticos e Perfumaria, `spa-massagem` → Spa e Massagem |
| `petshop` | `pet-shop` → Pet Shop, `banho-e-tosa` → Banho e Tosa, `racoes` → Rações, `acessorios-pet` → Acessórios Pet, `produtos-veterinarios` → Produtos Veterinários, `aquarismo` → Aquarismo, `aves-peixes` → Aves e Peixes, `pet-premium` → Pet Premium, `servicos-pet` → Serviços Pet |
| `variedades-utilidades` | `loja-de-variedades` → Loja de Variedades, `bazar` → Bazar, `loja-popular` → Loja Popular, `utilidades-domesticas` → Utilidades Domésticas, `papelaria` → Papelaria, `brinquedos` → Brinquedos, `presentes` → Presentes, `armarinhos` → Armarinhos, `embalagens` → Embalagens, `artigos-de-festa` → Artigos de Festa |

**Travado segments** (6) — SHALL contain exactly one subsegment entry (no `outro` option):

| Segmento | Subsegmento único (value → label) |
|----------|----------------------------------|
| `mercados-mercearias` | `mercados-mercearias` → Mercados e Mercearias |
| `restaurantes-lanchonetes` | `restaurantes-lanchonetes` → Restaurantes e Lanchonetes |
| `farmacia-saude` | `farmacia-saude` → Farmácia e Saúde |
| `casa-decoracao` | `casa-decoracao` → Casa e Decoração |
| `eletronicos-tecnologia` | `eletronicos-tecnologia` → Eletrônicos e Tecnologia |
| `servicos-locais` | `servicos-locais` → Serviços Locais |

The `outros` segment SHALL contain one subsegment entry: `{ value: "outros", label: "Outros" }`.

#### Scenario: Travado segment has single subsegment

- **WHEN** inspecting subsegments for `mercados-mercearias`
- **THEN** the list SHALL contain exactly one entry
- **AND** the entry value SHALL be `mercados-mercearias`
- **AND** no `outro` option SHALL be present

#### Scenario: Rich segment includes all subsegments

- **WHEN** inspecting subsegments for `moda-calcados-acessorios`
- **THEN** the list SHALL contain 12 entries (11 subsegments + `outro`)

#### Scenario: Outros segment has one subsegment

- **WHEN** inspecting `STORE_SUBSEGMENTS["outros"]`
- **THEN** it SHALL contain one entry with value `outros` and label `Outros`

### Requirement: Human-readable labels in dropdown

The system SHALL display human-readable labels (not kebab-case values) in the segment and subsegment dropdowns, but submit the kebab-case value.

#### Scenario: Dropdown shows labels

- **WHEN** the segment dropdown is rendered
- **THEN** each option SHALL display the `label` field from `STORE_SEGMENTS`

#### Scenario: Submitted value is kebab-case

- **WHEN** the user selects a segment
- **THEN** the submitted value SHALL be the kebab-case `value`
