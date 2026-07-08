# Multi-Tenant Campaign Guards

> Synced from `fase-10-perimetro-multitenant` (ADDED).

## Purpose

Multi-tenant guards for campaign generation endpoints: `/api/campaign/generate` uses `getCurrentStore()` (no client-provided storeId), `/api/campaign/generate-image` uses `requireOwnership()` with body storeId.

## Requirements

### Requirement: /api/campaign/generate uses getCurrentStore()

The system SHALL update `POST /api/campaign/generate` to resolve the store via `getCurrentStore(user.userId)` instead of accepting `storeId` from the request body.

- MUST call `requireSameOrigin(request)` first
- MUST call `requireApiUser()` to validate session
- MUST call `getCurrentStore(user.userId)` to resolve the store
- If no store is found (user has no store): MUST return 404 JSON via `notFound("Store not found")`
- MUST ignore any `storeId` field sent in the request body — it is NOT a valid authority
- The `store.id` resolved from `getCurrentStore()` SHALL be used as the storeId for all downstream operations

#### Scenario: Campaign generate for own store returns 200

- **WHEN** `POST /api/campaign/generate` is called
- **AND** same origin
- **AND** user is authenticated
- **AND** user has a store
- **THEN** status is 200 with campaign data

#### Scenario: Campaign generate with alien storeId in body is ignored

- **WHEN** `POST /api/campaign/generate` is called
- **AND** same origin
- **AND** user is authenticated
- **AND** user has a store
- **AND** body contains a different `storeId`
- **THEN** the storeId in body is ignored
- **AND** the user's own store is used

#### Scenario: Campaign generate without session returns 401

- **WHEN** `POST /api/campaign/generate` is called
- **AND** same origin
- **AND** no valid session
- **THEN** status is 401 JSON

### Requirement: /api/campaign/generate-image uses requireOwnership

The system SHALL update `POST /api/campaign/generate-image` to validate store ownership via `requireOwnership(storeId, userId)`.

- MUST call `requireSameOrigin(request)` first
- MUST call `requireApiUser()` to validate session
- MUST read `storeId` from the request body
- MUST call `requireOwnership(body.storeId, user.userId)` to validate ownership
- If ownership fails: MUST return 404 JSON (same signal as non-existent store)
- If validation succeeds: SHALL use the store returned by `requireOwnership()` as the authorized store

#### Scenario: Generate-image for own store returns 200

- **WHEN** `POST /api/campaign/generate-image` is called
- **AND** same origin
- **AND** user is authenticated
- **AND** storeId in body belongs to user
- **THEN** status is 200 with generated image

#### Scenario: Generate-image for alien store returns 404

- **WHEN** `POST /api/campaign/generate-image` is called
- **AND** same origin
- **AND** user is authenticated
- **AND** storeId in body belongs to another user
- **THEN** status is 404 JSON
