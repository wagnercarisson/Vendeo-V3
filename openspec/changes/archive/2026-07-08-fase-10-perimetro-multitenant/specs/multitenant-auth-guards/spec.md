## ADDED Requirements

### Requirement: AuthorizedStoreContext type

The system SHALL define a `AuthorizedStoreContext` type in `src/lib/auth/store-ownership.ts`.

- MUST be `{ userId: string; storeId: string; store: Store }`
- `userId` MUST be `claims.sub` — única fonte de identidade
- `storeId` MUST be `stores.id` — resolvido por `requireOwnership`
- `store` MUST be the full store row from the database, já autorizada
- SHALL NOT include `claims` avulsos — consumidores que precisam de claims JWT chamam `requireUser()` separadamente

#### Scenario: AuthorizedStoreContext has correct shape

- **WHEN** `AuthorizedStoreContext` is used
- **THEN** it SHALL contain `userId`, `storeId`, and `store` properties
- **AND** `storeId` SHALL match `store.id`

### Requirement: requireAuthorizedStore returns context

The system SHALL provide a `requireAuthorizedStore(storeId: string)` function in `src/lib/auth/store-ownership.ts`.

- MUST call `requireApiUser()` internally to get the authenticated user
- MUST call `requireOwnership(storeId, user.userId)` to validate ownership
- MUST return `AuthorizedStoreContext` with `{ userId, storeId, store }`
- If `requireApiUser()` fails: MUST throw `UnauthorizedError`
- If `requireOwnership()` fails: MUST throw `StoreNotFoundError`

#### Scenario: Store owner gets context

- **WHEN** `requireAuthorizedStore(storeId)` is called
- **AND** the user owns the store
- **THEN** it returns `{ userId, storeId, store }`

#### Scenario: Store not found throws 404

- **WHEN** `requireAuthorizedStore(storeId)` is called
- **AND** the store does not exist or belongs to another user
- **THEN** it throws `StoreNotFoundError`

#### Scenario: Unauthenticated throws 401

- **WHEN** `requireAuthorizedStore(storeId)` is called
- **AND** there is no valid session
- **THEN** it throws `UnauthorizedError`

### Requirement: requireSameOrigin validates CSRF

The system SHALL provide a `requireSameOrigin(request: Request)` function in `src/lib/auth/csrf.ts`.

- MUST read `origin` header from the request
- MUST read `host` header from the request
- MUST read `x-forwarded-host` header from the request (para cenários de proxy)
- If `origin` is missing: MUST throw `ForbiddenError` with message "Origin header required"
- If `origin` does not match `host` or `x-forwarded-host`: MUST throw `ForbiddenError` with message "Cross-origin request denied"
- If URL parsing of origin fails: MUST throw `ForbiddenError` with message "Invalid origin"

#### Scenario: Same origin passes

- **WHEN** `requireSameOrigin(request)` is called
- **AND** `Origin` header matches `Host`
- **THEN** it passes without throwing

#### Scenario: Different origin throws ForbiddenError

- **WHEN** `requireSameOrigin(request)` is called
- **AND** `Origin` header differs from `Host`
- **THEN** it throws `ForbiddenError`

#### Scenario: Missing origin header throws ForbiddenError

- **WHEN** `requireSameOrigin(request)` is called
- **AND** no `Origin` header is present
- **THEN** it throws `ForbiddenError`

### Requirement: JsonErrorResponse helpers

The system SHALL provide three helper functions in `src/lib/api-error-response.ts`.

- `unauthorized(message?: string)`: MUST return `NextResponse.json({ error })` with status 401
- `notFound(message?: string)`: MUST return `NextResponse.json({ error })` with status 404
- `forbidden(message?: string)`: MUST return `NextResponse.json({ error })` with status 403
- If message is omitted: MUST use default messages ("Unauthorized", "Not found", "Forbidden")

#### Scenario: unauthorized returns 401 JSON

- **WHEN** `unauthorized()` is called
- **THEN** it returns a Response with status 401 and JSON body `{ error: "Unauthorized" }`

#### Scenario: notFound returns 404 JSON

- **WHEN** `notFound()` is called
- **THEN** it returns a Response with status 404 and JSON body `{ error: "Not found" }`

#### Scenario: forbidden returns 403 JSON

- **WHEN** `forbidden()` is called
- **THEN** it returns a Response with status 403 and JSON body `{ error: "Forbidden" }`

### Requirement: Error classes centralized in errors.ts

The system SHALL define three error classes in `src/lib/auth/errors.ts`.

- `UnauthorizedError`: extends `Error`, default message "Unauthorized". MUST be reexported from `src/lib/auth/require-user.ts` (class removed from that file)
- `StoreNotFoundError`: extends `Error`, default message "Store not found or access denied". MUST be reexported from `src/lib/auth/store-ownership.ts` (class removed from that file)
- `ForbiddenError`: extends `Error`, default message "Forbidden"
- All classes SHALL set `this.name` to the class name
- SHALL be catchable by `instanceof` checks across module boundaries (single source of truth)

#### Scenario: UnauthorizedError catchable from errors.ts

- **WHEN** code imports `UnauthorizedError` from `src/lib/auth/errors.ts`
- **AND** catches the error
- **THEN** `instanceof UnauthorizedError` SHALL be true

#### Scenario: StoreNotFoundError catchable from errors.ts

- **WHEN** code imports `StoreNotFoundError` from `src/lib/auth/errors.ts`
- **AND** catches the error
- **THEN** `instanceof StoreNotFoundError` SHALL be true

#### Scenario: ForbiddenError is distinct

- **WHEN** code catches `ForbiddenError`
- **THEN** it SHALL be distinguishable from `UnauthorizedError` and `StoreNotFoundError`
