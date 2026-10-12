## Purpose

Esta spec define os redirects 301 permanentes configurados em `next.config.ts` para migração de rotas antigas para o novo padrão PT-BR, e registra que a canonicalização de host/protocolo é externa ao aplicativo.

> Synced from `fase-18-app-shell-ui-base-rotas` (ADDED).
> Synced from `fase-51-2-fundacao-seo-descoberta-organica` (MODIFIED `/` redirect + ADDED canonical host).

## Requirements

### Requirement: 301 redirects in next.config.ts

The system SHALL keep the following permanent redirects (HTTP 301) via `async redirects()` in `next.config.ts`:

| Source | Destination |
|--------|-------------|
| `/minhas-campanhas` | `/campanhas` |
| `/campanha/:id` | `/campanhas/:id` |
| `/store` | `/loja` |
| `/campaign/preview` | `/campanhas/nova` |

All redirects SHALL be purely path-based with no authentication logic — they execute before middleware via `next.config.ts`.

The route `/` SHALL NOT be redirected: as of the F51.1 landing (Fase 51.1), `/` is the public landing page. The route `/store` SHALL remain outside the middleware's `config.matcher` since it is handled by its redirect.

#### Scenario: Root serves the landing without redirect

- **WHEN** a user requests `/`
- **THEN** the system SHALL serve the public landing page
- **AND** the system SHALL NOT respond with a redirect to `/dashboard`

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

### Requirement: Canonical host/protocol handling is external to the application code

The application SHALL treat `https://vendeo.tech` (without `www`) as the canonical origin. Host/protocol canonicalization (`www` → apex, HTTPS, and transition aliases such as `beta.vendeo.tech`) SHALL be treated as external operational configuration (Vercel/DNS) and SHALL NOT be implemented in the repository. This change SHALL NOT presume that existing host/protocol redirects are correct, SHALL NOT alter external configuration, and SHALL NOT alter the path redirects declared in `next.config.ts`.

#### Scenario: No host-level redirects in the repository

- **WHEN** `next.config.ts` redirects are reviewed
- **THEN** no host-level (`www`, HTTPS or transition-alias) redirect is declared
- **AND** the existing path redirects remain unchanged

#### Scenario: Canonical host configuration audited, not presumed

- **WHEN** the canonical origin is documented
- **THEN** the host/protocol configuration is recorded as an audited external operational pending item
- **AND** it is not assumed to already be correct
