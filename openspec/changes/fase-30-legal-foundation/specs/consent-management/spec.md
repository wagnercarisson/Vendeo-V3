## ADDED Requirements

### Requirement: User consent events table

The system SHALL have a `user_consent_events` table (append-only, auditável):

```sql
CREATE TABLE public.user_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('commercial_communications')),
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('signup', 'account_settings'))
);

CREATE INDEX idx_user_consent_events_user ON user_consent_events(user_id, consent_type, occurred_at DESC);
```

RLS SHALL be enabled. INSERT via service role (server-only). SELECT for own `user_id` via RLS.

#### Scenario: User consent events table exists

- **WHEN** running migrations
- **THEN** `user_consent_events` SHALL exist with all required columns and constraints

### Requirement: recordConsentEvent()

The system SHALL provide `recordConsentEvent(params)` that appends a consent event:

```typescript
export async function recordConsentEvent(params: {
  userId: string;
  consentType: "commercial_communications";
  action: "granted" | "revoked";
  policyVersion: string;
  ipAddress: string;
  userAgent: string;
  source: "signup" | "account_settings";
}): Promise<void>
```

This SHALL always INSERT (append), never UPDATE or DELETE.

#### Scenario: Grant consent inserts event

- **WHEN** user grants commercial communications consent
- **THEN** a `granted` event SHALL be inserted into `user_consent_events`

#### Scenario: Revoke consent inserts event

- **WHEN** user revokes commercial communications consent
- **THEN** a `revoked` event SHALL be inserted into `user_consent_events`

### Requirement: getEffectiveConsent()

The system SHALL provide `getEffectiveConsent(userId, consentType)` that returns the current consent state:

```typescript
export async function getEffectiveConsent(
  userId: string,
  consentType: "commercial_communications"
): Promise<"granted" | "revoked" | "never_set">
```

The effective state is the last event by `occurred_at DESC` for the given user and consent type.

#### Scenario: After grant, effective consent is granted

- **WHEN** user has granted and never revoked
- **THEN** `getEffectiveConsent()` returns `"granted"`

#### Scenario: After revoke, effective consent is revoked

- **WHEN** user has revoked after granting
- **THEN** `getEffectiveConsent()` returns `"revoked"`

#### Scenario: No events returns never_set

- **WHEN** user has no consent events
- **THEN** `getEffectiveConsent()` returns `"never_set"`

### Requirement: Communications consent checkbox is optional and non-blocking

The communications consent checkbox in the signup form SHALL:
- Be separate and visually distinct from the privacy acknowledgement checkbox
- Not block signup if left unchecked
- Be labeled "Aceito receber comunicações comerciais do Vendeo"
- Be backed by LGPD consent (art. 7º, I)
- Be revocable at any time via `/conta`

#### Scenario: Consent not given does not block signup

- **WHEN** user does NOT check the communications consent checkbox
- **THEN** signup SHALL proceed normally

#### Scenario: Consent opt-in is recorded during signup

- **WHEN** user checks the communications consent checkbox during signup
- **THEN** a `granted` event SHALL be recorded via `recordConsentEvent()`

#### Scenario: Consent can be revoked from account page

- **WHEN** user revokes consent from `/conta`
- **THEN** a `revoked` event SHALL be inserted
- **AND** `getEffectiveConsent()` SHALL return `"revoked"`
