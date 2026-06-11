## ADDED Requirements

### Requirement: STORE_SEGMENTS constant

The system SHALL define `STORE_SEGMENTS` as a `const` array in `src/lib/constants.ts` with 13 entries, each having `value` (kebab-case slug) and `label` (human-readable Portuguese). This replaces the previous `VALID_SEGMENTS` and `SEGMENT_LABELS`.

Values:

| value | label |
|-------|-------|
| `moda-calcados-acessorios` | Moda, Calçados e Acessórios |
| `bebidas-adegas-conveniencia` | Bebidas, Adega e Conveniência |
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
| `moda-calcados-acessorios` | `moda-feminina` → Moda Feminina, `moda-masculina` → Moda Masculina, `moda-infantil` → Moda Infantil, `calcados-femininos` → Calçados Femininos, `calcados-masculinos` → Calçados Masculinos, `calcados-infantis` → Calçados Infantis, `acessorios` → Acessórios, `bolsas-mochilas` → Bolsas e Mochilas, `joias-bijuterias` → Joias e Bijuterias, `roupas-intimas` → Roupas Íntimas, `moda-praia` → Moda Praia |
| `bebidas-adegas-conveniencia` | `cervejas-especiais` → Cervejas Especiais, `vinhos` → Vinhos, `destilados` → Destilados, `refrigerantes` → Refrigerantes, `sucos` → Sucos, `aguas` → Águas, `energeticos` → Energéticos, `conveniencia-alimentacao` → Conveniência e Alimentação, `gelo-e-gelados` → Gelo e Gelados |
| `padaria-confeitaria-doces` | `paes-artesanais` → Pães Artesanais, `bolos-tortas` → Bolos e Tortas, `doces-caseiros` → Doces Caseiros, `salgados-assados` → Salgados Assados, `confeitaria-fina` → Confeitaria Fina, `salgados-fritos` → Salgados Fritos, `cafeteria` → Cafeteria, `sucos-naturais` → Sucos Naturais, `sorvetes-acai` → Sorvetes e Açaí |
| `beleza-estetica` | `cabeleireiro` → Cabeleireiro, `barbearia` → Barbearia, `manicure-pedicure` → Manicure e Pedicure, `estetica-facial` → Estética Facial, `estetica-corporal` → Estética Corporal, `maquiagem` → Maquiagem, `cosmeticos-naturais` → Cosméticos Naturais, `perfumaria` → Perfumaria, `depilacao` → Depilação, `massoterapia` → Massoterapia, `designer-sobrancelhas` → Designer de Sobrancelhas |
| `petshop` | `alimentacao-caes` → Alimentação para Cães, `alimentacao-gatos` → Alimentação para Gatos, `acessorios-caes` → Acessórios para Cães, `acessorios-gatos` → Acessórios para Gatos, `higiene-beleza` → Higiene e Beleza, `brinquedos` → Brinquedos, `medicamentos-veterinarios` → Medicamentos Veterinários, `servicos-veterinarios` → Serviços Veterinários, `pet-exotico` → Pet Exótico |
| `variedades-utilidades` | `presentes-souvenirs` → Presentes e Souvenirs, `artigos-decoracao` → Artigos de Decoração, `utilidades-domesticas` → Utilidades Domésticas, `artigos-festa` → Artigos para Festa, `papelaria` → Papelaria, `brinquedos-gerais` → Brinquedos Gerais, `artigos-religiosos` → Artigos Religiosos, `artesanato-local` → Artesanato Local, `cama-mesa-banho` → Cama, Mesa e Banho |

**Travado segments** (6) — SHALL contain exactly one subsegment entry (no `outro` option):

| Segmento | Subsegmento único (value → label) |
|----------|----------------------------------|
| `mercados-mercearias` | `mercado-mercearia` → Mercado / Mercearia |
| `restaurantes-lanchonetes` | `restaurante-lanchonete` → Restaurante / Lanchonete |
| `farmacia-saude` | `farmacia` → Farmácia / Drogaria |
| `casa-decoracao` | `casa-decoracao` → Casa e Decoração |
| `eletronicos-tecnologia` | `eletronico-tecnologia` → Eletrônicos / Tecnologia |
| `servicos-locais` | `servico-local` → Serviço Local |

The `outros` segment SHALL have an empty subsegment list.

#### Scenario: Travado segment has single subsegment

- **WHEN** inspecting subsegments for `mercados-mercearias`
- **THEN** the list SHALL contain exactly one entry
- **AND** the entry value SHALL be `mercado-mercearia`
- **AND** no `outro` option SHALL be present

#### Scenario: Rich segment includes all subsegments

- **WHEN** inspecting subsegments for `moda-calcados-acessorios`
- **THEN** the list SHALL contain 12 entries (11 subsegments + `outro`)

#### Scenario: Outros segment has empty subsegments

- **WHEN** inspecting `STORE_SUBSEGMENTS["outros"]`
- **THEN** it SHALL be an empty array `[]`

### Requirement: Human-readable labels in dropdown

The system SHALL display human-readable labels (not kebab-case values) in the segment and subsegment dropdowns, but submit the kebab-case value.

#### Scenario: Dropdown shows labels

- **WHEN** the segment dropdown is rendered
- **THEN** each option SHALL display the `label` field from `STORE_SEGMENTS`

#### Scenario: Submitted value is kebab-case

- **WHEN** the user selects a segment
- **THEN** the submitted value SHALL be the kebab-case `value`
