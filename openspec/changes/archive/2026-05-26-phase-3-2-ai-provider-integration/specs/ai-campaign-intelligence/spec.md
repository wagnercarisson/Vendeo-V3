## MODIFIED Requirements

### Requirement: Provider selection with environment-aware fallback

The system SHALL select the provider at service instantiation time via `createDefaultProvider()`.

Selection logic:
- If `process.env.OPENAI_API_KEY` is set → use `OpenAIProvider`
- If `process.env.OPENAI_API_KEY` is not set AND `NODE_ENV === "production"` → throw explicit configuration error
- Otherwise → use `MockProvider`

`generation_metadata.provider` SHALL reflect the active provider: `"mock"` for MockProvider, `"openai"` for OpenAIProvider.

#### Scenario: OpenAI provider used when API key is set

- **WHEN** `OPENAI_API_KEY` is set
- **THEN** the provider SHALL be `OpenAIProvider`
- **AND** `generation_metadata.provider` SHALL be `"openai"`

#### Scenario: Mock provider used in development without API key

- **WHEN** `OPENAI_API_KEY` is not set
- **AND** `NODE_ENV` is not `"production"`
- **THEN** the provider SHALL be `MockProvider`
- **AND** `generation_metadata.provider` SHALL be `"mock"`

#### Scenario: Production fails fast when API key is missing

- **WHEN** `OPENAI_API_KEY` is not set
- **AND** `NODE_ENV` is `"production"`
- **THEN** the application SHALL throw an explicit configuration error
- **AND** the error SHALL indicate the missing `OPENAI_API_KEY`

### Requirement: CampaignIntelligenceService integration unchanged

The `CampaignIntelligenceService` SHALL continue to work with any `AIProvider` implementation. No changes to the service constructor, `generate()` method, or its validation pipeline are required by this phase.

The service SHALL receive the provider instance selected by `createDefaultProvider()`. The `generation_metadata.provider` field in the output `CampaignSpec` SHALL reflect the active provider name.

#### Scenario: Service works with OpenAIProvider

- **WHEN** `createDefaultProvider()` returns an `OpenAIProvider`
- **THEN** `CampaignIntelligenceService.generate()` SHALL use it without modification
- **AND** `generation_metadata.provider` SHALL be `"openai"`

#### Scenario: Service works with MockProvider

- **WHEN** `createDefaultProvider()` returns a `MockProvider`
- **THEN** `CampaignIntelligenceService.generate()` SHALL use it without modification
- **AND** `generation_metadata.provider` SHALL be `"mock"`
