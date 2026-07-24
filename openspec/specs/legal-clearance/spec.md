> **Propósito**: Guard `requireLegalClearance(capability)` que verifica aceite contratual vigente antes de liberar funcionalidades protegidas.

## Requirements

### Requirement: requireLegalClearance() guard

The system SHALL provide `requireLegalClearance(params)` as the central guard for checking contractual acceptance before allowing protected capabilities:

```typescript
async function requireLegalClearance(params: {
  storeId: string;
  userId: string;
  capability: LegalCapability;
}): Promise<{ ok: true } | { ok: false; reason: string; requiredDocuments: string[] }>;

type LegalCapability = "content_generation";
```

The function SHALL:
- Look up required documents for the capability from a capability-to-documents map
- Check if the store has valid acceptance for each required document
- Return `{ ok: true }` if all required documents are accepted for the current version
- Return `{ ok: false }` with the list of pending documents if any are missing/outdated
- Return `{ ok: true }` for unknown capabilities (forward compatibility)

#### Scenario: All documents accepted returns ok true

- **WHEN** `requireLegalClearance()` is called with a store that has valid acceptance for all required documents
- **THEN** it SHALL return `{ ok: true }`

#### Scenario: Terms of service pending returns ok false

- **WHEN** `requireLegalClearance()` is called with terms_of_service acceptance missing
- **THEN** it SHALL return `{ ok: false, requiredDocuments: ["terms_of_service"] }`

#### Scenario: Multiple documents pending returns all

- **WHEN** `requireLegalClearance()` is called with both terms_of_service and acceptable_use pending
- **THEN** it SHALL return `{ ok: false, requiredDocuments: ["terms_of_service", "acceptable_use"] }`

#### Scenario: Unknown capability returns ok true

- **WHEN** `requireLegalClearance()` is called with a capability not in the map
- **THEN** it SHALL return `{ ok: true }`

#### Scenario: New store with no acceptance returns ok false

- **WHEN** `requireLegalClearance()` is called for a store with no acceptance records
- **THEN** it SHALL return `{ ok: false }`

#### Scenario: After re-acceptance of new version returns ok true

- **WHEN** `requireLegalClearance()` is called after the store re-accepted a newer document version
- **THEN** it SHALL return `{ ok: true }`

### Requirement: Capability-document mapping

The system SHALL define a capability-to-document mapping:

```typescript
const CAPABILITY_DOCUMENTS: Record<LegalCapability, DocumentType[]> = {
  content_generation: ["terms_of_service", "acceptable_use"],
};
```

`privacy_policy` SHALL NOT be in the capability-document map. Privacy acknowledgement is verified at signup, not in the pipeline guard.

#### Scenario: content_generation requires terms and acceptable use

- **WHEN** checking capability requirements for `content_generation`
- **THEN** the requirements SHALL include `terms_of_service` and `acceptable_use`

#### Scenario: privacy_policy is not in capability requirements

- **WHEN** checking any capability requirements
- **THEN** `privacy_policy` SHALL NOT be in the required documents list

### Requirement: Capability tree for sub-capabilities

The system SHALL define a capability tree:

```typescript
const CAPABILITY_TREE: Record<string, string[]> = {
  content_generation: [
    "campaigns.create",
    "visual_signatures.create",
    "exports.create",
  ],
};
```

#### Scenario: content_generation includes all sub-capabilities

- **WHEN** checking sub-capabilities of `content_generation`
- **THEN** it SHALL include `campaigns.create`, `visual_signatures.create`, and `exports.create`
