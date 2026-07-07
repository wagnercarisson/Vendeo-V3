# Store Ownership Core

> Synced from `fase-9-cutover-ownership` (ADDED).

## Purpose

Core auth helpers for store ownership: `getCurrentStore()` resolves the current user's store via JWT claims; `requireOwnership()` validates a store belongs to the user. Both support an optional `userId` parameter to avoid duplicate auth calls.

## Requirements

### Requirement: getCurrentStore resolves store by claims.sub

The system SHALL provide a `getCurrentStore()` function in `src/lib/auth/store-ownership.ts` that resolves the current user's store via JWT claims.

- MUST accept an optional `userId` parameter to avoid duplicate auth calls (D11)
- If `userId` is provided: MUST use it directly as the lookup value
- If `userId` is omitted: MUST call `requireUser()` internally to obtain `claims.sub`
- MUST query `SELECT * FROM stores WHERE user_id = $1` via `createServerClient()`
- MUST return the full store row if found, or `null` if not found
- SHALL NOT throw on "store not found" — null is a valid return value (user without store)

#### Scenario: Store found for authenticated user

- **WHEN** `getCurrentStore()` is called
- **AND** the user has a store
- **THEN** it returns the store row with all columns

#### Scenario: Store not found returns null

- **WHEN** `getCurrentStore()` is called
- **AND** the user has no store
- **THEN** it returns `null`

#### Scenario: getCurrentStore with userId skips requireUser

- **WHEN** `getCurrentStore(userId)` is called with a valid userId
- **THEN** it queries directly without calling `requireUser()`

#### Scenario: getCurrentStore without userId calls requireUser

- **WHEN** `getCurrentStore()` is called without arguments
- **THEN** it calls `requireUser()` to get claims.sub internally

### Requirement: requireOwnership validates store belongs to user

The system SHALL provide a `requireOwnership(storeId, userId?)` function in `src/lib/auth/store-ownership.ts` that validates the store belongs to the current user.

- MUST accept `storeId` (string, required) and `userId` (string, optional)
- If `userId` is provided: MUST use directly as the lookup value
- If `userId` is omitted: MUST call `requireUser()` internally to obtain `claims.sub`
- MUST query `SELECT * FROM stores WHERE id = $1 AND user_id = $2` via `createServerClient()`
- If store is found: MUST return the store row
- If store is not found: MUST throw `StoreNotFoundError`
- SHALL return the store for the owner, throw for non-owners (same 404 signal)

#### Scenario: Store found and belongs to user

- **WHEN** `requireOwnership(storeId)` is called
- **AND** the store exists and belongs to the user
- **THEN** it returns the store row

#### Scenario: Store not found throws StoreNotFoundError

- **WHEN** `requireOwnership(storeId)` is called
- **AND** the store does not exist
- **THEN** it throws `StoreNotFoundError`

#### Scenario: Store belongs to another user throws StoreNotFoundError

- **WHEN** `requireOwnership(storeId)` is called
- **AND** the store exists but belongs to a different user
- **THEN** it throws `StoreNotFoundError` (not UnauthorizedError — same signal as non-existent)

#### Scenario: requireOwnership with userId skips requireUser

- **WHEN** `requireOwnership(storeId, userId)` is called with a valid userId
- **THEN** it queries directly without calling `requireUser()`

### Requirement: StoreNotFoundError class

The system SHALL define a `StoreNotFoundError` class extending `Error`.

- SHALL be exported from `src/lib/auth/store-ownership.ts`
- SHALL be catchable by type-checked handlers
- SHALL have a descriptive default message: "Store not found or access denied"

#### Scenario: Error is catchable

- **WHEN** code catches `StoreNotFoundError`
- **THEN** it SHALL be distinguishable from generic `Error` and from `UnauthorizedError`
