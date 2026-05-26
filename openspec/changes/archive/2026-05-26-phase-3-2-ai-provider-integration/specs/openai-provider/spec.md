## ADDED Requirements

### Requirement: OpenAIProvider class implements AIProvider

The system SHALL implement an `OpenAIProvider` class at `src/lib/campaign-intelligence/providers/openai.ts` that implements the `AIProvider` interface.

`OpenAIProvider` SHALL:
- Have `readonly name = "openai"`
- Accept an optional model parameter in the constructor (defaults to `OPENAI_MODEL` env var or `"gpt-4o-mini"`)
- Use dynamic `import("openai")` to load the OpenAI SDK (not a static module-level import)
- Return a `ProviderRawResponse` where `raw` is the JSON string of the generated campaign spec

#### Scenario: OpenAIProvider implements AIProvider interface

- **WHEN** `OpenAIProvider` is instantiated
- **THEN** it SHALL satisfy the `AIProvider` interface contract
- **AND** `provider.name` SHALL equal `"openai"`

#### Scenario: OpenAIProvider uses dynamic import

- **WHEN** `OpenAIProvider` is instantiated
- **THEN** the `openai` SDK SHALL NOT be loaded at module evaluation time
- **AND** the SDK SHALL be loaded only when the provider needs to make an API call

### Requirement: OpenAIProvider uses Structured Outputs

`OpenAIProvider` SHALL use OpenAI Structured Outputs (`response_format: { type: "json_schema" }`) to enforce output structure, integrating Zod schemas via the `zodResponseFormat` helper from `openai/helpers/zod` when available.

The provider SHALL derive the JSON Schema from `CampaignSpecSchema` to define the expected response structure. After receiving the structured response, the system SHALL validate it against `CampaignSpecSchema` via Zod as a second layer of defense.

#### Scenario: Structured Outputs enforces schema

- **WHEN** `OpenAIProvider.generate()` is called
- **THEN** the request SHALL use `response_format` with `type: "json_schema"`
- **AND** the JSON Schema SHALL be derived from `CampaignSpecSchema`

#### Scenario: Zod validation runs after response

- **WHEN** the OpenAI API returns a structured response
- **THEN** the raw response SHALL be validated against `CampaignSpecSchema` before being returned as `ProviderRawResponse`

#### Scenario: Fallback when model does not support json_schema

- **WHEN** the configured model does not support `json_schema` response_format
- **THEN** the provider SHALL fall back to `json_object` mode, but only for explicit `response_format`/model capability errors
- **AND** the provider SHALL NOT fall back on auth, rate limit, network, quota, or validation errors
- **AND** Zod validation SHALL still be applied to the response

### Requirement: Configurable model via OPENAI_MODEL

The system SHALL read the model name from `process.env.OPENAI_MODEL`. If unset, it SHALL default to `"gpt-4o-mini"`.

The model SHALL be passed to the OpenAI chat completion API as the `model` parameter.

#### Scenario: Default model used when env var is unset

- **WHEN** `OPENAI_MODEL` is not set
- **THEN** `OpenAIProvider` SHALL use `"gpt-4o-mini"` as the model

#### Scenario: Custom model from environment

- **WHEN** `OPENAI_MODEL` is set to `"gpt-4o"`
- **THEN** `OpenAIProvider` SHALL use `"gpt-4o"` as the model

### Requirement: Product + Offer golden path prompt

The system prompt in `OpenAIProvider` SHALL be written in Brazilian Portuguese and SHALL target the Product + Offer campaign format exclusively.

The prompt SHALL instruct the model to output JSON matching `CampaignSpecSchema` structure, including:
- Store-specific commercial copy (title, subtitle, hook, cta) referencing the actual store name
- Product offer data with Brazilian price formatting (BRL)
- Visual parameters aligned with the CAMPAIGN_VISUAL_SYSTEM.md constraints
- Generation metadata identifying the provider, model, and timestamp

#### Scenario: Prompt includes store context

- **WHEN** input contains `storeName: "Padaria do João"`
- **THEN** the generated campaign SHALL reference the store name in `commercial_copy` or generation context, not necessarily in `title`

#### Scenario: Prompt targets Product + Offer only

- **WHEN** inspecting the system prompt
- **THEN** it SHALL contain instructions for the Produto + Oferta format
- **AND** it SHALL NOT contain instructions for other campaign formats
