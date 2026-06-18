## ADDED Requirements

### Requirement: identity_state validation on logo upload

The system SHALL validate `stores.identity_state` before processing any logo upload. If `identity_state = 'visual_signature'`, the endpoint SHALL reject the upload with HTTP 409:

```json
{
  "error": "Remova a assinatura visual ativa antes de enviar um logotipo.",
  "requires_identity_removal": true,
  "current_identity_state": "visual_signature"
}
```

The validation SHALL use `stores.identity_state` as the source of truth — NOT the status of `store_visual_signatures` or `store_brand_profiles`. This is consistent with the rule that all transitions between active identities must go through `text_only`.

#### Scenario: Upload rejected when identity_state is visual_signature

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo`
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_identity_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'visual_signature'`

#### Scenario: Upload permitted when identity_state is text_only or logo

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo`
- **AND** `stores.identity_state` is `'text_only'` or `'logo'`
- **THEN** the upload SHALL proceed normally
- **AND** no identity_state validation error SHALL be returned
