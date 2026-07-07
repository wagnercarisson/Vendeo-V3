## ADDED Requirements

### Requirement: Unit tests for auth guards

The system SHALL include unit tests for `requireAuthorizedStore()`, `requireSameOrigin()`, and `JsonErrorResponse` helpers.

- `requireAuthorizedStore`: context returned, 404 for alien store, 404 for non-existent store, 401 without session
- `requireSameOrigin`: passes with matching origin, throws ForbiddenError for different origin, throws ForbiddenError without origin header
- `JsonErrorResponse`: unauthorized() returns 401, notFound() returns 404, forbidden() returns 403, custom messages are respected

#### Scenario: requireAuthorizedStore tests cover all outcomes

- **WHEN** running tests for `requireAuthorizedStore`
- **THEN** there are test cases for: success context, alien store (404), non-existent store (404), no session (401)

### Requirement: Handler tests for at least 2 store-scoped routes

The system SHALL include handler tests for at least 2 store-scoped routes as proof of pattern (e.g., logo GET, brand-profile PATCH).

- Tests SHALL mock `requireAuthorizedStore` to control outcomes
- Tests SHALL verify status codes and response shapes

#### Scenario: Logo handler tests verify pattern

- **WHEN** running handler tests for logo routes
- **THEN** GET returns 200 for owner, 404 for alien, 401 without session
- **AND** POST returns 403 cross-origin, 401 without session

### Requirement: Server Action tests with mock guards

The system SHALL include tests for each visual-signature Server Action with mocked `requireUser()` and ownership validation.

- Each entrypoint SHALL be tested with valid session + own store, invalid session, and alien store
- `listSignatures` SHALL be tested with valid filters

#### Scenario: Server Action tests cover auth outcomes

- **WHEN** running tests for visual-signature Server Actions
- **THEN** each action has test cases for: valid session + own store (success), invalid session (401/throws), alien store (404/throws)

### Requirement: Base matrix — storeId-scoped endpoints

The system SHALL provide a parametric test matrix for all endpoints authorized by an explicit storeId, whether from route param (`:id`) or request body (storeId body + requireOwnership).

Covered methods (~20):
- `GET /api/store/[id]`, `PATCH /api/store/[id]`
- `GET /api/store/[id]/logo`, `POST /api/store/[id]/logo`, `DELETE /api/store/[id]/logo`
- `POST /api/store/[id]/logo/retry-brand-director`
- `GET /api/store/[id]/brand-profile`, `POST`, `PATCH`
- `POST /api/store/[id]/brand-profile/infer`, `/realign`, `/metadata`, `/generate-without-logo`
- `GET /api/store/[id]/visual-signature`, `DELETE`
- `POST /api/store/[id]/visual-signature/approve`, `/reject`, `/restore`, `/dismiss-critical-drift`, `/generate-without-logo`
- `DELETE /api/store/[id]/visual-signature/dismiss-critical-drift`
- `POST /api/campaign/generate-image` (storeId do body, requireOwnership)

Each method SHALL be tested with 4 scenarios:
| Scenario | Expected Status | Condition |
|----------|----------------|-----------|
| Without session (valid origin) | 401 | Auth fails before ownership |
| Alien store (own session) | 404 | StoreNotFoundError |
| Non-existent store (own session) | 404 | StoreNotFoundError |
| Own store exists | 200 / action executed | Success |

#### Scenario: storeId-scoped: own store returns 200

- **WHEN** any storeId-scoped method is called
- **AND** the user owns the store
- **THEN** status is 200 or the action is executed

#### Scenario: storeId-scoped: alien store returns 404

- **WHEN** any storeId-scoped method is called
- **AND** the store belongs to another user
- **THEN** status is 404 JSON

#### Scenario: storeId-scoped: non-existent store returns 404

- **WHEN** any storeId-scoped method is called
- **AND** the store does not exist
- **THEN** status is 404 JSON

#### Scenario: storeId-scoped: no session returns 401

- **WHEN** any storeId-scoped method is called
- **AND** there is no valid session
- **AND** the origin is valid
- **THEN** status is 401 JSON

### Requirement: Base matrix — current-store endpoints

The system SHALL provide a parametric test matrix for `POST /api/campaign/generate`, which resolves the store via `getCurrentStore()` instead of accepting `storeId` from the client.

Scenarios:
| Scenario | Expected Status | Condition |
|----------|----------------|-----------|
| Without session (valid origin) | 401 | Auth fails |
| User has no store | 404 | getCurrentStore returns null |
| User has store, malicious storeId in body | 200 | storeId in body is ignored, own store used |
| User has store, valid request | 200 | Campaign generated for own store |

#### Scenario: current-store: no session returns 401

- **WHEN** `POST /api/campaign/generate` is called
- **AND** there is no valid session
- **THEN** status is 401 JSON

#### Scenario: current-store: user without store returns 404

- **WHEN** `POST /api/campaign/generate` is called
- **AND** user is authenticated
- **AND** user has no store
- **THEN** status is 404 JSON (notFound)

#### Scenario: current-store: malicious storeId in body is ignored

- **WHEN** `POST /api/campaign/generate` is called
- **AND** user is authenticated
- **AND** user has a store
- **AND** body contains a storeId belonging to another user
- **THEN** the storeId in body is ignored
- **AND** the user's own store is used
- **AND** status is 200

### Requirement: Base matrix — POST /api/store (creation)

The system SHALL provide a parametric test matrix for `POST /api/store`, which creates a new store and uses `claims.sub` as `user_id`.

Scenarios:
| Scenario | Expected Status | Condition |
|----------|----------------|-----------|
| Cross-origin with valid session | 403 | CSRF has precedence |
| Same-origin without session | 401 | Auth fails |
| Same-origin with session, valid body | 200/201 | Store created |
| Duplicate store (UNIQUE violation) | 409 | Conflict (erro 23505) |
| user_id in body is ignored | 200/201 | claims.sub used, body.user_id ignored |

#### Scenario: POST /api/store cross-origin returns 403

- **WHEN** `POST /api/store` is called cross-origin
- **AND** there is a valid session
- **THEN** status is 403 JSON (CSRF)

#### Scenario: POST /api store without session returns 401

- **WHEN** `POST /api/store` is called same-origin
- **AND** no valid session
- **THEN** status is 401 JSON

#### Scenario: POST /api store duplicate returns 409

- **WHEN** `POST /api/store` is called same-origin
- **AND** user already has a store
- **THEN** status is 409 JSON (UNIQUE constraint violation)

#### Scenario: POST /api store ignores user_id in body

- **WHEN** `POST /api/store` is called same-origin
- **AND** user is authenticated
- **AND** body contains a user_id different from claims.sub
- **THEN** the user_id in body is ignored
- **AND** claims.sub is used as user_id

### Requirement: CSRF parametric matrix

The system SHALL provide a CSRF parametric test matrix covering all mutation methods (POST, PATCH, DELETE) across all route handlers, including POST /auth/signout.

Covered methods: all POST/PATCH/DELETE listed in the storeId-scoped matrix, plus POST /api/campaign/generate, POST /api/campaign/generate-image, POST /api/store, and POST /auth/signout.

Each mutation SHALL be tested with 3 scenarios:
| Scenario | Expected Status | Condition |
|----------|----------------|-----------|
| Cross-origin with valid session | 403 | CSRF guard rejects |
| Cross-origin without session | 403 | CSRF has precedence over auth |
| Same origin without session | 401 | Auth fails, valid origin does not block |

#### Scenario: CSRF matrix covers cross-origin with session

- **WHEN** running the CSRF matrix for any mutation
- **AND** the request is cross-origin
- **AND** there is a valid session
- **THEN** the status is 403 JSON

#### Scenario: CSRF matrix covers cross-origin without session

- **WHEN** running the CSRF matrix for any mutation
- **AND** the request is cross-origin
- **AND** there is no session
- **THEN** the status is 403 JSON (CSRF has precedence over auth)

#### Scenario: CSRF matrix covers same origin without session

- **WHEN** running the CSRF matrix for any mutation
- **AND** the request is same origin
- **AND** there is no session
- **THEN** the status is 401 JSON (auth fails, valid origin does not block)
