## MODIFIED Requirements

### Requirement: Updated segment values (10 → 13)

The existing `Segment values` requirement SHALL be updated. The system SHALL accept the following 13 predefined segment values instead of the previous 10:

- `moda-calcados-acessorios`
- `bebidas-adegas-conveniencia`
- `padaria-confeitaria-doces`
- `beleza-estetica`
- `petshop`
- `variedades-utilidades`
- `mercados-mercearias`
- `restaurantes-lanchonetes`
- `farmacia-saude`
- `casa-decoracao`
- `eletronicos-tecnologia`
- `servicos-locais`
- `outros`

#### Scenario: New valid segment is stored

- **WHEN** a store is created with segment `moda-calcados-acessorios`
- **THEN** the value SHALL be stored exactly as `moda-calcados-acessorios`

#### Scenario: Old segment value is rejected

- **WHEN** a store is created with segment `moda-vestuario` (old value)
- **THEN** the system SHALL return a validation error
- **AND** the store SHALL NOT be created

### Requirement: Updated fallback color map

The existing `Simple fallback for missing brand color` requirement SHALL be updated with 13 new entries replacing the previous 10.

#### Scenario: Segment-based color fallback for new segment

- **WHEN** the brand color is resolved for a store with `brand_color = null` and `segment = moda-calcados-acessorios`
- **THEN** the resolver SHALL return `#EC4899`

## ADDED Requirements

### Requirement: Migration updates CHECK constraint

The system SHALL provide a migration `20260611000001_update_stores_segment_check.sql` that drops the existing CHECK constraint on `stores.segment` and creates a new one with the 13 updated values.

#### Scenario: Old CHECK constraint is dropped

- **WHEN** the migration is applied
- **THEN** the old `stores_segment_check` constraint SHALL be removed

#### Scenario: New CHECK constraint is created

- **WHEN** the migration is applied
- **THEN** a new CHECK constraint SHALL enforce the 13 updated segment values

## REMOVED Requirements

### Requirement: Old segment values

**Reason**: Replaced by 13 new segment values reflecting a broader coverage of Brazilian retail.

**Migration**: All stores with old segment values must be truncated before applying the new migration. Old segment values (`moda-vestuario`, `alimentacao-bebidas`, `saude-farmacia`, `servicos`, `variedades`) are deprecated and will be rejected by the new CHECK constraint.
