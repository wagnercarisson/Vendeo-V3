## MODIFIED Requirements

### Requirement: Approval modal (MODIFIED)

When the lojista clicks "Não tenho logo" on the Logo e Cores step, the system SHALL present an approval modal/tela showing the generated visual signature.

**O guard legal é aplicado em duas camadas:**

**Camada 1 — API Route (autoritativa, server-side):**
A API `POST .../generate-without-logo` SHALL call `requireLegalClearance({ storeId, userId, capability: "content_generation" })` at the start of the handler, BEFORE any generation operation. If clearance fails, the API SHALL return HTTP 403 with JSON `{ error: { message, reason, requiredDocuments, acceptUrl: "/legal/reaccept" } }`.

**Camada 2 — Client (UX):**
The modal (`visual-signature-approval-modal.tsx`, `"use client"`) SHALL consult `GET /api/legal/status` before starting the generation flow. If `acceptanceStatus !== "current"`, the modal SHALL display a blocking message with a link to `/legal/reaccept` and SHALL NOT proceed with generation. If clearance passes, the modal SHALL proceed with the normal VS generation flow.

All existing behavior ('standard' and 'substitution' modes, approval, re-generation, historical versions, credit handling) SHALL remain unchanged when clearance passes.

#### Scenario: VS generation blocked by legal clearance (API layer)

- **WHEN** a user submits a VS generation request to the API
- **AND** legal clearance fails
- **THEN** the API SHALL return HTTP 403
- **AND** no generation operation SHALL be performed
- **AND** the response SHALL include `acceptUrl: "/legal/reaccept"`

#### Scenario: VS generation blocked by legal clearance (client layer)

- **WHEN** a user tries to generate a visual signature via the modal
- **AND** `GET /api/legal/status` returns `acceptanceStatus !== "current"`
- **THEN** the modal SHALL display a blocking message
- **AND** SHALL NOT call the generation API
- **AND** SHALL link to `/legal/reaccept`

#### Scenario: VS generation proceeds when clearance passes

- **WHEN** both API and client clearance checks pass
- **THEN** the modal SHALL proceed with the normal VS generation flow
- **AND** the API SHALL execute the generation operation
