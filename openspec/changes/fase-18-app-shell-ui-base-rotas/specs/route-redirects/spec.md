## ADDED Requirements

### Requirement: 301 redirects in next.config.ts

The system SHALL add the following permanent redirects (HTTP 301) via `async redirects()` in `next.config.ts`:

| Source | Destination |
|--------|-------------|
| `/` | `/dashboard` |
| `/minhas-campanhas` | `/campanhas` |
| `/campanha/:id` | `/campanhas/:id` |
| `/store` | `/loja` |
| `/campaign/preview` | `/campanhas/nova` |

All redirects SHALL be purely path-based with no authentication logic — they execute before middleware.

#### Scenario: Root redirects to /dashboard

- **WHEN** a user requests `/`
- **THEN** the system SHALL respond with HTTP 301 to `/dashboard`

#### Scenario: /minhas-campanhas redirects to /campanhas

- **WHEN** a user requests `/minhas-campanhas`
- **THEN** the system SHALL respond with HTTP 301 to `/campanhas`

#### Scenario: /campanha/:id redirects to /campanhas/:id

- **WHEN** a user requests `/campanha/abc-123`
- **THEN** the system SHALL respond with HTTP 301 to `/campanhas/abc-123`

#### Scenario: /store redirects to /loja

- **WHEN** a user requests `/store`
- **THEN** the system SHALL respond with HTTP 301 to `/loja`

#### Scenario: /campaign/preview redirects to /campanhas/nova

- **WHEN** a user requests `/campaign/preview`
- **THEN** the system SHALL respond with HTTP 301 to `/campanhas/nova`
