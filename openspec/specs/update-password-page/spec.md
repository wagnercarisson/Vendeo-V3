## Purpose

Página `/update-password` com formulário de nova senha (pós-recovery). Requer sessão ativa (middleware bloqueia não autenticados). Usa `updateUser({ password })` e mantém sessão ativa após a troca.

> Synced from `fase-8-ciclo-de-conta` (ADDED).

## Requirements

### Requirement: /update-password page exists

The system SHALL have an `/update-password` page at `src/app/(auth)/update-password/page.tsx` with a new password form within the `(auth)` route group.

- MUST be a server component that renders `<UpdatePasswordForm />`
- MUST NOT use `requirePageUser()` — middleware already blocks unauthenticated access
- MUST inherit the `(auth)` layout
- MUST require an active session (blocked by middleware when not authenticated)

#### Scenario: Anonymous user accesses /update-password

- **WHEN** an unauthenticated user requests `/update-password`
- **THEN** middleware SHALL redirect to `/login`

#### Scenario: Authenticated user accesses /update-password

- **WHEN** an authenticated user requests `/update-password`
- **THEN** the update password form SHALL be rendered

### Requirement: Update password form validates new password

The update password form SHALL be a client component with password and confirm password fields.

- MUST validate password minimum length of 6 characters client-side
- MUST validate confirm password matches password client-side
- SHALL display inline error messages in Portuguese:
  - "A senha deve ter no mínimo 6 caracteres"
  - "As senhas não conferem"
- SHALL use `useState` for error messages
- MUST display a loading state during submission

#### Scenario: New password too short

- **WHEN** a user submits with a password shorter than 6 characters
- **THEN** the form SHALL display "A senha deve ter no mínimo 6 caracteres" and NOT submit

#### Scenario: Confirm password does not match

- **WHEN** a user submits with confirm password different from password
- **THEN** the form SHALL display "As senhas não conferem" and NOT submit

### Requirement: Update password calls updateUser and redirects

On successful validation, the form SHALL call `supabase.auth.updateUser({ password })` and redirect to `/`.

- MUST call `updateUser({ password })` with the new password
- On success: MUST redirect to `/` using `router.replace("/")`
- The session SHALL remain active after the password change
- On error: MUST display generic error message "Não foi possível atualizar a senha. Tente novamente."

#### Scenario: Password updated successfully

- **WHEN** a user submits a valid new password
- **THEN** `updateUser({ password })` is called
- **AND** on success, the user is redirected to `/`

#### Scenario: Password update fails

- **WHEN** `updateUser()` returns an error
- **THEN** the form SHALL display "Não foi possível atualizar a senha. Tente novamente." and remain on the page

#### Scenario: Session maintained after password change

- **WHEN** a user successfully updates their password
- **THEN** the session SHALL remain active (user is not logged out)
- **AND** the user is redirected to `/` (not `/login`)
