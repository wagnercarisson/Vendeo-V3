## MODIFIED Requirements

### Requirement: AdminUserSummary data contract (MODIFIED)

O sistema SHALL definir o tipo `AdminUserSummary` para representar dados consolidados de um lojista na view admin.

```typescript
export interface AdminUserSummary {
  userId: string;
  email: string;
  storeId: string | null;
  storeName: string | null;
  segment: string | null;
  balance: number;
  totalCampaigns: number;
  errorCampaigns: number;
  lastCampaignAt: string | null;
  createdAt: string;
  // New fields:
  privacyAcknowledged: boolean;
  legalAcceptanceStatus: "current" | "outdated" | "never";
  communicationsConsent: "granted" | "revoked" | "never_set";
}
```

#### Scenario: AdminUserSummary includes legal fields

- **WHEN** admin consulta lista de usuários
- **THEN** each entry SHALL contain `privacyAcknowledged`, `legalAcceptanceStatus`, `communicationsConsent`

### Requirement: User detail page — legal status badges (ADDED)

The user detail page at `/admin/users/[id]` SHALL display legal status badges in a "Situação Legal" card section:

- **Privacidade:** "✅ Ciente" / "❌ Não registrado"
- **Aceite contratual:** "✅ Vigente" / "⏳ Pendente" / "❌ Nunca aceitou"
- **Consentimento comercial:** "✅ Consentimento ativo" / "⏳ Consentimento revogado" / "❌ Nunca definido"

The detail section SHALL include per-document breakdown:
- Document type, version accepted, accepted_at, accepted_by_user_id, IP, UA
- Full acceptance history ordered by `accepted_at DESC`

#### Scenario: Admin sees privacy badge on user detail

- **WHEN** admin views user detail with valid privacy acknowledgement
- **THEN** "✅ Ciente" badge SHALL be displayed

#### Scenario: Admin sees acceptance history

- **WHEN** admin views user detail
- **THEN** acceptance history SHALL be shown ordered by `accepted_at DESC`

### Requirement: Admin SHALL NOT bulk-accept (ADDED)

Admin SHALL NOT have the ability to accept legal documents on behalf of a store. No "accept in bulk" feature.

#### Scenario: Admin cannot accept for user

- **WHEN** admin views user detail
- **THEN** no bulk-accept action SHALL be available
