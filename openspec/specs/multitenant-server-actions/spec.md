# Multi-Tenant Server Actions

> Synced from `fase-10-perimetro-multitenant` (ADDED).

## Purpose

Multi-tenant guards applied to Server Actions: store identity service extraction and visual-signature Server Actions with `requireUser()` + `requireOwnership()`.

## Requirements

### Requirement: Store identity service extracted

The system SHALL create `src/lib/store-identity-service.ts` with three internal functions extracted from `src/lib/actions/store.ts`.

- `resolveStoreIdentity(store)`: SHALL operate on a store object that is already authorized (received from caller). SHALL NOT have `"use server"` directive. SHALL NOT accept raw `storeId` from client input. SHALL perform the same DB operations as before but on the already-authorized store.
- `validateIdentityReference(snapshot)`: SHALL be a pure function with no database access. SHALL NOT have `"use server"` directive.
- `buildCampaignBrief(snapshot, input)`: SHALL be a pure function with no database access. SHALL NOT have `"use server"` directive.

#### Scenario: resolveStoreIdentity receives authorized store

- **WHEN** `resolveStoreIdentity(store)` is called
- **AND** store is already authorized (from AuthorizedStoreContext)
- **THEN** it performs DB operations using the store data
- **AND** it SHALL NOT validate storeId again

#### Scenario: validateIdentityReference is pure

- **WHEN** `validateIdentityReference(snapshot)` is called
- **THEN** it returns a result based solely on the snapshot parameter
- **AND** it does not access the database

### Requirement: Visual-signature Server Actions with guards

The system SHALL add `requireUser()` + `requireOwnership(storeId)` guards to four Server Actions in `src/lib/visual-signature/server-actions.ts`.

- `generateVariations(storeId)`: MUST call `requireUser()` then `requireOwnership(storeId)` before using `supabaseAdmin`
- `generateAutomatic(storeId)`: MUST call `requireUser()` then `requireOwnership(storeId)` before using `supabaseAdmin`
- `activateSignature(storeId, signatureId)`: MUST call `requireUser()` then `requireOwnership(storeId)` before using `supabaseAdmin`
- `listSignatures(storeId)`: MUST call `requireUser()` then `requireOwnership(storeId)` then use `supabaseAdmin.from("store_visual_signatures").eq("store_id", storeId)` (service role, no RLS)

#### Scenario: generateVariations with invalid session returns 401

- **WHEN** `generateVariations(storeId)` is called
- **AND** there is no valid session
- **THEN** it throws `UnauthorizedError`

#### Scenario: generateVariations with alien storeId returns 404

- **WHEN** `generateVariations(storeId)` is called
- **AND** store belongs to another user
- **THEN** it throws `StoreNotFoundError`

#### Scenario: activateSignature with alien storeId returns 404

- **WHEN** `activateSignature(storeId, signatureId)` is called
- **AND** store belongs to another user
- **THEN** it throws `StoreNotFoundError`

#### Scenario: listSignatures with own store returns filtered list

- **WHEN** `listSignatures(storeId)` is called
- **AND** user owns the store
- **THEN** it returns signatures filtered by `store_id`
