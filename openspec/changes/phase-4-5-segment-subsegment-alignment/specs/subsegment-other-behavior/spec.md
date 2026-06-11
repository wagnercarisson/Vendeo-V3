## ADDED Requirements

### Requirement: Outro field is mandatory

The system SHALL require the user to fill the free-text subsegment field in two scenarios:

1. **Segmento rico + subsegmento `outro`**: when the user selects `{ value: "outro" }` from the subsegment dropdown of a rich segment
2. **Segmento `outros`**: when the segment is `outros`, a free-text field SHALL be shown without a dropdown

The literal value `outro` SHALL NEVER be persisted as the final `stores.subsegment` value. A valid, non-generic text SHALL be required.

#### Scenario: Outro field appears when outro selected

- **WHEN** the user selects `outro` in a rich segment's subsegment dropdown
- **THEN** a free-text input SHALL appear below the dropdown
- **AND** the input SHALL be marked as required

#### Scenario: Free-text field for outros segment

- **WHEN** the segment is `outros`
- **THEN** a free-text input SHALL be shown without any dropdown
- **AND** the input SHALL be marked as required

#### Scenario: Outro value is rejected

- **WHEN** the user submits the form with subsegment set to `outro`
- **THEN** the system SHALL reject the submission
- **AND** display an error message

### Requirement: Client-side validation

The system SHALL validate the free-text subsegment field on blur and on submit with the following rules:

- Minimum 3 characters (trimmed)
- Maximum 30 characters (trimmed)
- Only letters (including accented Portuguese: A-Z, a-z, À-ü) and spaces: `/^[A-Za-zÀ-ü\s]+$/`
- Must NOT be a generic value: `outro`, `loja`, `comercio`, `comércio`, `varejo`

#### Scenario: Too short shows error

- **WHEN** the user types "ab" in the free-text field and blurs
- **THEN** an inline error SHALL appear: "Digite ao menos 3 caracteres"

#### Scenario: Too long shows error

- **WHEN** the user types a 31-character string and blurs
- **THEN** an inline error SHALL appear: "Máximo de 30 caracteres"

#### Scenario: Special characters rejected

- **WHEN** the user types "Loja 123" and blurs
- **THEN** an inline error SHALL appear: "Use apenas letras e espaços"

#### Scenario: Generic value rejected

- **WHEN** the user types "comercio" and blurs
- **THEN** an inline error SHALL appear rejecting the generic value

#### Scenario: Valid text passes

- **WHEN** the user types "Artigos Esportivos" and blurs
- **THEN** no error SHALL appear

### Requirement: Server-side validation and sanitization

The system SHALL validate the free-text subsegment value on the server (API route) before persisting, as a second layer of defense. Server-side validation SHALL enforce all the same rules as client-side:

1. Must NOT be `null` or empty when the segment is `outros` or subsegment is `outro` (mandatory check)
2. Must NOT be the literal value `outro`
3. Minimum 3 characters (trimmed)
4. Maximum 30 characters (trimmed)
5. Must match `/^[A-Za-zÀ-ü\s]+$/` (letters and spaces only)
6. Must NOT be a generic value: `outro`, `loja`, `comercio`, `comércio`, `varejo`

After validation passes, the system SHALL sanitize the value:

1. Trim whitespace
2. Reduce multiple spaces to single space
3. Capitalize each word (first letter uppercase, rest lowercase)

A failed server-side validation SHALL return HTTP 400 with an error message describing the issue.

#### Scenario: Empty subsegment for outros returns 400

- **WHEN** a PATCH request is sent with `segment = "outros"` and `subsegment = ""`
- **THEN** the response status SHALL be 400
- **AND** the error body SHALL indicate subsegment is required

#### Scenario: Outro literal rejected server-side

- **WHEN** a PATCH request is sent with `subsegment = "outro"`
- **THEN** the response status SHALL be 400
- **AND** the error body SHALL reject the value `outro`

#### Scenario: Generic value rejected server-side

- **WHEN** a PATCH request is sent with `subsegment = "loja"`
- **THEN** the response status SHALL be 400
- **AND** the error body SHALL reject the generic value

#### Scenario: Valid value sanitized and persisted

- **WHEN** a PATCH request is sent with `subsegment = "  artigos  ESPORTIVOS  "`
- **THEN** the server SHALL accept the request
- **AND** the stored value SHALL be "Artigos Esportivos"

### Requirement: Placeholder text

The free-text subsegment input SHALL display placeholder `"Digite o seu subsegmento"`. No example values SHALL be used as placeholders to avoid the lojista copying them as literal text.

#### Scenario: Placeholder is instructional

- **WHEN** the free-text field is empty
- **THEN** the placeholder SHALL display "Digite o seu subsegmento"
