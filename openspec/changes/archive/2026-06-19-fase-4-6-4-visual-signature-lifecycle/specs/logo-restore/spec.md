## ADDED Requirements

### Requirement: identity_state validation on logo restore

The system SHALL validate `stores.identity_state` before processing any logo restore request. Logo restore SHALL only be permitted when `identity_state = 'text_only'` — toda mudança de identidade ativa passa por text_only.

If `identity_state = 'visual_signature'`, the endpoint SHALL reject with HTTP 409:
```json
{
  "error": "Remova a assinatura visual ativa antes de restaurar um logotipo.",
  "requires_identity_removal": true,
  "current_identity_state": "visual_signature"
}
```

If `identity_state = 'logo'`, the endpoint SHALL also reject with HTTP 409 — o logo ativo deve ser removido primeiro:
```json
{
  "error": "Remova o logotipo ativo antes de restaurar outro logotipo.",
  "requires_logo_removal": true,
  "current_identity_state": "logo"
}
```

The validation SHALL use `stores.identity_state` as the source of truth — NOT the status of assets or profiles.

#### Scenario: Restore rejected when identity_state is visual_signature

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_identity_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'visual_signature'`

#### Scenario: Restore rejected when identity_state is logo

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** `stores.identity_state` is `'logo'`
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_logo_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'logo'`

#### Scenario: Restore permitted only in text_only state

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** `stores.identity_state` is `'text_only'`
- **THEN** the restore SHALL proceed normally
