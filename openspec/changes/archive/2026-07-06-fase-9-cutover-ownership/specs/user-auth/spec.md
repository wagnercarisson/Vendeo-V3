## ADDED Requirements

### Requirement: StoreNotFoundError exported alongside UnauthorizedError

The system SHALL define a `StoreNotFoundError` class in `src/lib/auth/store-ownership.ts`.

- SHALL extend `Error`
- SHALL have a descriptive default message: "Store not found or access denied"
- SHALL be exportable and catchable by type-checked handlers
- SHALL be distinguishable from `UnauthorizedError` in catch blocks

#### Scenario: StoreNotFoundError is catchable

- **WHEN** code catches `StoreNotFoundError`
- **THEN** it SHALL be distinguishable from `UnauthorizedError`
- **AND** the message SHALL be "Store not found or access denied"
