> **Propósito**: Esta spec define o backend de inteligência de campanha — o serviço que transforma dados de produto + oferta + loja em um `CampaignSpec` estruturado e validado via inferência de IA, com interface abstrata de provider e validação Zod.

## Requirements

### Requirement: CampaignGenerationInput schema

The system SHALL define a `CampaignGenerationInputSchema` Zod schema at `src/lib/campaign-intelligence/schema.ts` that validates incoming campaign generation requests.

The schema SHALL include fields for:
- `productName` — string, required
- `originalPriceCents` — number (integer), required
- `discountedPriceCents` — number (integer), required
- `description` — string, optional
- `badge` — string, optional
- `storeName` — string, required
- `storeSegment` — string, required
- `brandColor` — string, required hex color, representing the resolved store identity color after fallback rules
- `city` — string, optional
- `state` — string, optional, 2-letter code when provided

The system SHALL export `type CampaignGenerationInput = z.infer<typeof CampaignGenerationInputSchema>`.

#### Scenario: Valid input passes schema validation

- **WHEN** a request body contains all required fields with correct types
- **THEN** `CampaignGenerationInputSchema.safeParse()` SHALL return `{ success: true, data }`

#### Scenario: Missing required field fails validation

- **WHEN** a request body omits `productName`
- **THEN** `CampaignGenerationInputSchema.safeParse()` SHALL return `{ success: false, error }`
- **AND** the error SHALL indicate which field is missing

#### Scenario: Invalid price type fails validation

- **WHEN** `originalPriceCents` is a string instead of a number
- **THEN** `CampaignGenerationInputSchema.safeParse()` SHALL return `{ success: false, error }`

#### Scenario: Optional fields accept undefined

- **WHEN** `description`, `badge`, `city`, and `state` are omitted
- **THEN** `CampaignGenerationInputSchema.safeParse()` SHALL return `{ success: true, data }`
- **AND** `data.city` SHALL be `undefined`
- **AND** `data.state` SHALL be `undefined`

#### Scenario: State validation when provided

- **WHEN** `state` is provided with a value longer than 2 characters
- **THEN** `CampaignGenerationInputSchema.safeParse()` SHALL return `{ success: false, error }`

### Requirement: CampaignSpec output schema

The system SHALL define a `CampaignSpecSchema` Zod schema at `src/lib/campaign-intelligence/schema.ts` that defines the structure of the generated campaign spec.

The schema SHALL contain four sections:

1. **commercial_copy** — object with:
   - `title` — string, required
   - `subtitle` — string, required
   - `hook` — string, required
   - `cta` — string, required

2. **offer** — object with:
   - `product_name` — string, required
   - `original_price_display` — string, optional
   - `discounted_price_display` — string, required
   - `badge_text` — string, required

3. **visual_parameters** — object with:
   - `layout_preset` — string, required
   - `composition_type` — string, required
   - `hierarchy_focus` — string, required
   - `palette_accent` — string, required
   - `badge_style` — string, required
   - `background_style` — string, required

4. **generation_metadata** — object with:
   - `provider` — string, required
   - `model` — string, required
   - `generated_at` — string, required (ISO 8601 datetime)

The system SHALL export `type CampaignSpec = z.infer<typeof CampaignSpecSchema>`.

#### Scenario: Complete CampaignSpec passes validation

- **WHEN** a JSON object contains all four sections with all required fields
- **THEN** `CampaignSpecSchema.safeParse()` SHALL return `{ success: true, data }`

#### Scenario: Missing commercial_copy field fails validation

- **WHEN** `commercial_copy` is missing
- **THEN** `CampaignSpecSchema.safeParse()` SHALL return `{ success: false, error }`

#### Scenario: Generation metadata provider is a string

- **WHEN** `generation_metadata.provider` is "mock"
- **THEN** the schema SHALL accept it as valid

### Requirement: AIProvider abstract interface

The system SHALL define an `AIProvider` interface at `src/lib/campaign-intelligence/providers/types.ts`.

The interface SHALL define:
- `name` — `string` (readonly), provider identifier
- `generate(input: CampaignGenerationInput): Promise<ProviderRawResponse>` — method that takes validated input and returns a raw response

`ProviderRawResponse` SHALL be a type with at minimum:
- `raw` — the unvalidated output from the AI provider (string or parsed object)

Providers SHALL NOT have access to HTTP request/response objects.

#### Scenario: Provider implements the interface

- **WHEN** a provider class implements `AIProvider`
- **THEN** it SHALL have a `name` string property
- **AND** it SHALL implement `generate(input: CampaignGenerationInput): Promise<ProviderRawResponse>`

#### Scenario: Provider name identifies the implementation

- **WHEN** inspecting `provider.name`
- **THEN** it SHALL return a non-empty string identifying the provider type (e.g., `"mock"`, `"openai"`)

### Requirement: MockProvider deterministic implementation

The system SHALL implement a `MockProvider` class at `src/lib/campaign-intelligence/providers/mock.ts` that implements `AIProvider`.

`MockProvider` SHALL:
- Have `name: "mock"`
- Return a deterministic `ProviderRawResponse` based on input data without external API calls
- Generate store-specific data in the response (e.g., actual store name in copy, actual prices in offer display)
- Always succeed (no simulated failures)

#### Scenario: MockProvider returns deterministic output

- **WHEN** `MockProvider.generate()` is called with the same input twice
- **THEN** both calls SHALL return the same structured output (same title, same prices, same layout)

#### Scenario: MockProvider includes store data in copy

- **WHEN** input contains `storeName: "Padaria do João"`
- **THEN** the generated `title` SHALL include or reference the store name

### Requirement: OpenAIProvider (optional)

The system MAY implement an `OpenAIProvider` class at `src/lib/campaign-intelligence/providers/openai.ts` that implements `AIProvider`.

If implemented, `OpenAIProvider` SHALL:
- Have `name: "openai"`
- Use `gpt-4o-mini` as the default model
- Accept `OPENAI_API_KEY` from environment
- Include a basic prompt that produces a JSON response matching `CampaignSpecSchema` structure

#### Scenario: OpenAIProvider requires API key

- **WHEN** `OPENAI_API_KEY` is not set in environment
- **THEN** the application SHALL NOT instantiate `OpenAIProvider`

#### Scenario: OpenAIProvider returns structured response

- **WHEN** `OpenAIProvider.generate()` succeeds
- **THEN** the returned `ProviderRawResponse.raw` SHALL be parseable as JSON matching `CampaignSpecSchema`

### Requirement: CampaignIntelligenceService orchestration

The system SHALL implement `CampaignIntelligenceService` at `src/lib/campaign-intelligence/service.ts`.

The service SHALL:
1. Accept an `AIProvider` instance via constructor
2. Expose `generate(input: CampaignGenerationInput): Promise<ServiceResult>` method
3. Validate `input` against `CampaignGenerationInputSchema` before calling the provider
4. Call `provider.generate(validatedInput)` to get raw response
5. Validate the provider's response against `CampaignSpecSchema`
6. Return a typed result with either `success: true + data: CampaignSpec` or `success: false + error info`

`ServiceResult` SHALL contain:
- On success: `{ success: true, data: CampaignSpec }`
- On failure: `{ success: false, code: string, error: { message: string } }`

#### Scenario: Service validates input before provider call

- **WHEN** `service.generate()` receives invalid input
- **THEN** the service SHALL return `{ success: false, code: "validation_error" }`
- **AND** the provider SHALL NOT be called

#### Scenario: Service validates provider output after call

- **WHEN** the provider returns malformed output that fails `CampaignSpecSchema`
- **THEN** the service SHALL return `{ success: false, code: "invalid_output" }`
- **AND** the raw provider output SHALL NOT appear in the error response

#### Scenario: Service handles provider exception

- **WHEN** the provider throws an error
- **THEN** the service SHALL return `{ success: false, code: "provider_failure" }`
- **AND** the raw error message SHALL NOT appear in the response

#### Scenario: Service returns successful CampaignSpec

- **WHEN** input is valid and provider returns valid output
- **THEN** the service SHALL return `{ success: true, data: CampaignSpec }`
- **AND** `data.generation_metadata.provider` SHALL match `provider.name`
- **AND** `data.generation_metadata.generated_at` SHALL be a valid ISO 8601 string

### Requirement: Provider selection with explicit fallback

The system SHALL select the provider at service instantiation time.

Selection logic:
- If `process.env.OPENAI_API_KEY` is set AND `OpenAIProvider` is implemented → use `OpenAIProvider`
- Otherwise → use `MockProvider`

`generation_metadata.provider` SHALL reflect the active provider: `"mock"` for MockProvider, `"openai"` for OpenAIProvider.

#### Scenario: Mock provider used when no API key

- **WHEN** `OPENAI_API_KEY` is not set
- **THEN** the provider SHALL be `MockProvider`
- **AND** `generation_metadata.provider` SHALL be `"mock"`

#### Scenario: OpenAI provider used when API key is set

- **WHEN** `OPENAI_API_KEY` is set
- **AND** `OpenAIProvider` is implemented
- **THEN** the provider SHALL be `OpenAIProvider`
- **AND** `generation_metadata.provider` SHALL be `"openai"`

### Requirement: POST /api/campaign/generate endpoint

The system SHALL expose a POST endpoint at `/api/campaign/generate`.

The endpoint SHALL:
1. Accept POST requests with `Content-Type: application/json`
2. Parse the request body as `CampaignGenerationInput`
3. Return 400 with structured error on invalid input
4. Call `CampaignIntelligenceService.generate()`
5. Return 200 with `CampaignSpec` JSON on success
6. Return 502 with controlled error on provider failure
7. Return 500 with controlled error on invalid output from provider

#### Scenario: Valid request returns CampaignSpec

- **WHEN** POST to `/api/campaign/generate` with valid JSON body
- **THEN** the response SHALL have status 200
- **AND** the body SHALL be a valid JSON matching `CampaignSpecSchema`

#### Scenario: Missing fields return 400

- **WHEN** POST to `/api/campaign/generate` with body missing `productName`
- **THEN** the response SHALL have status 400
- **AND** the body SHALL contain an `error` field with details

#### Scenario: Provider failure returns 502

- **WHEN** the provider throws an error during generation
- **THEN** the response SHALL have status 502
- **AND** the body SHALL contain a controlled error message
- **AND** the body SHALL NOT contain the raw error or provider output

#### Scenario: Invalid provider output returns 500

- **WHEN** the provider returns data that fails `CampaignSpecSchema` validation
- **THEN** the response SHALL have status 500
- **AND** the body SHALL contain a controlled error message
- **AND** the body SHALL NOT contain the raw provider output

### Requirement: No raw provider output leaks to client

The system SHALL ensure that under no circumstances does raw provider output (error messages, malformed JSON, partial responses) appear in any API response.

All provider outputs and errors SHALL be logged server-side for debugging, but SHALL NOT be included in response bodies.

#### Scenario: Malformed JSON from provider

- **WHEN** the provider returns unparseable JSON
- **THEN** the response SHALL be a 500 with `{ error: { message: "Failed to parse campaign output" } }`
- **AND** the raw unparseable content SHALL NOT appear in the response

#### Scenario: Provider exception with sensitive data

- **WHEN** the provider throws an exception containing API keys or internal paths
- **THEN** the response SHALL be a 502 with `{ error: { message: "AI provider failed" } }`
- **AND** the exception details SHALL NOT appear in the response
