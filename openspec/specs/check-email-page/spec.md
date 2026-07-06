## Purpose

Página `/check-email` de transição pós-signup/recovery. Exibe instruções contextuais sem revelar o email do usuário. Faz parte da estratégia de anti-enumeration.

> Synced from `fase-8-ciclo-de-conta` (ADDED).

## Requirements

### Requirement: /check-email page exists

The system SHALL have a `/check-email` page at `src/app/(auth)/check-email/page.tsx` with contextual instruction copy.

- MUST be a server component
- MUST read `searchParams.type` to select contextual copy
- MUST NOT use `requirePageUser()` — authentication check is handled by middleware
- MUST NOT reveal the user's email address under any circumstance
- MUST inherit the `(auth)` layout

#### Scenario: Anonymous user accesses /check-email

- **WHEN** an unauthenticated user requests `/check-email`
- **THEN** the instruction page SHALL be rendered

#### Scenario: Authenticated user accesses /check-email

- **WHEN** an authenticated user requests `/check-email`
- **THEN** middleware SHALL redirect to `/`

### Requirement: /check-email shows contextual copy by type

The page SHALL render different instruction text based on `searchParams.type`:

- `?type=signup` → "Enviamos um link de confirmação para o email informado..." (signup context)
- `?type=recovery` → "Enviamos um link de redefinição de senha..." (recovery context)
- No type or unknown type → generic fallback text that works for both contexts
- MUST NOT reveal the email address in any variant
- MUST NOT distinguish between "email exists" vs "email doesn't exist"

#### Scenario: Check-email with type=signup

- **WHEN** `/check-email?type=signup` is requested
- **THEN** the page SHALL display signup-specific instruction text

#### Scenario: Check-email with type=recovery

- **WHEN** `/check-email?type=recovery` is requested
- **THEN** the page SHALL display recovery-specific instruction text

#### Scenario: Check-email without type parameter

- **WHEN** `/check-email` is requested without a type parameter
- **THEN** the page SHALL display generic fallback text

#### Scenario: Check-email never reveals email

- **WHEN** any variant of `/check-email` is requested
- **THEN** the page SHALL NOT display the user's email address in any context
