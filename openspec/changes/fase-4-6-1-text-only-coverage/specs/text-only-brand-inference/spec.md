> **Purpose**: Defines the text-only brand inference pipeline: the `POST /api/store/[id]/brand-profile/infer` endpoint, the `BrandTextOnlyInferenceService`, and the `store-brand-inference.md` prompt. This capability generates a complete brand identity (palette, style, tone, personality, guidelines) from store data alone, without a logo or visual signature.

## ADDED Requirements

### Requirement: Brand inference endpoint

The system SHALL expose a `POST /api/store/[id]/brand-profile/infer` endpoint that triggers the text-only brand inference pipeline. The endpoint SHALL:

1. Accept request body with `{ textOnlyOrigin: 'explicit' | 'implicit', userChosenColors?: string[], manualColorOverride?: boolean }`
2. Execute synchronously (block until inference completes)
3. Have a timeout of 30 seconds, configurable via environment variable
4. Use an in-memory lock per store_id to prevent concurrent inferences
5. On success: persist brand profile, update store state, return profile data
6. On failure: persist profile as `failed`, still set store identity_state, return error message

#### Scenario: Successful inference returns brand profile

- **WHEN** a POST request is sent to `/api/store/{store_id}/brand-profile/infer`
- **AND** the AI inference completes successfully
- **THEN** the response SHALL contain the complete `BrandProfileRecord` with source `'text_only'` and status `'synced'`
- **AND** `stores.identity_state` SHALL be updated to `'text_only'`
- **AND** `stores.logo_status` SHALL be updated to `'explicit_none'`

#### Scenario: Duplicate request returns 429

- **WHEN** a second POST request is sent for the same store_id while the first is still processing
- **THEN** the response SHALL be HTTP 429 with error message "Inferência já em andamento para esta loja. Aguarde."

#### Scenario: Inference failure returns non-blocking error

- **WHEN** the AI call fails or times out
- **THEN** the endpoint SHALL still return HTTP 200 (non-blocking)
- **AND** the response body SHALL include `{ success: false, message: "..." }`
- **AND** a brand profile SHALL be persisted with `status: 'failed'`
- **AND** `stores.identity_state` SHALL still be set to `'text_only'`
- **AND** `stores.logo_status` SHALL still be set to `'explicit_none'`

### Requirement: User colors as signal, not constraint

When the user has chosen colors manually (`userChosenColors` is non-empty), the inference service SHALL pass these colors to the AI prompt as a signal of user preference — the AI MAY adopt, adjust, or discard them. The final palette SHALL be recorded in `safe_color_tokens` regardless of whether it matches the user's choices.

The `brand_colors_chosen` field in the profile SHALL contain the user's chosen colors when provided (preserving the user's input for UI feedback). When the user has not chosen colors, `brand_colors_chosen` SHALL be `[]`.

#### Scenario: User colors passed as signal

- **WHEN** `userChosenColors` contains `["#FF6600", "#E8A040"]`
- **AND** the AI prompt is assembled
- **THEN** the prompt SHALL include those colors as user preference (signal, not rule)
- **AND** `brand_colors_chosen` in the profile SHALL be `["#FF6600", "#E8A040"]`
- **AND** `safe_color_tokens` MAY contain different colors if the AI decided to adjust them

#### Scenario: No user colors leaves brand_colors_chosen empty

- **WHEN** `userChosenColors` is empty
- **THEN** `brand_colors_chosen` in the profile SHALL be `[]`
- **AND** the AI SHALL infer the full palette from store data alone

### Requirement: Brand inference service

The system SHALL provide a `BrandTextOnlyInferenceService` that:

1. Loads the `store-brand-inference.md` prompt via `PromptLoader`
2. Fills the prompt template with store data (name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state) and optional user colors
3. Calls OpenAI with `response_format: { type: 'json_object' }` and `max_tokens: 2000`
4. Validates the output (hex color format, required fields present)
5. Returns the validated `TextOnlyInferenceResult`

The service SHALL NOT persist data or update store state — those responsibilities belong to the route handler. The service SHALL follow the same pattern as `BrandDirectorService` and `BrandProfilerWithoutLogoService`.

#### Scenario: Service returns complete result with all intelligence fields

- **WHEN** the inference service completes successfully
- **THEN** the returned result SHALL contain `safe_color_tokens` with `{ primary, secondary, accent, background }`
- **AND** `visual_style`, `visual_tone`, `typography_direction`, `brand_personality`, `campaign_guidelines`, `campaign_brief` SHALL be present
- **AND** `inferred_primary_color` and `inferred_accent_color` SHALL be present
- **AND** `confidence_score` SHALL be a number between 0 and 1

#### Scenario: Service handles API key missing

- **WHEN** `OPENAI_API_KEY` is not configured
- **AND** `NODE_ENV` is `production`
- **THEN** the service SHALL throw a descriptive error
- **AND** the endpoint SHALL catch the error and persist a profile with `status = 'failed'`
- **AND** `stores.identity_state` and `stores.logo_status` SHALL still be updated as normal

#### Scenario: Service handles API key missing in development

- **WHEN** `OPENAI_API_KEY` is not configured
- **AND** `NODE_ENV` is not `production`
- **THEN** the service SHALL create a mock profile with generic values
- **AND** `confidence_score` SHALL be `0.1` to indicate mock data

### Requirement: Brand inference prompt

The system SHALL have a prompt file at `prompts/store-brand-inference.md` designed for AI inference without any image input. The prompt SHALL:

- Instruct the AI to act as a brand identity specialist for Brazilian physical stores without a logo
- Receive input variables: `storeName`, `segment`, `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`, `city`, `state`
- Optionally receive `userPrimaryColor` and `userAccentColor` as preference signals
- Instruct the AI to infer: visual style, visual tone, typography direction, brand personality, campaign guidelines, campaign brief, and a complete color palette
- Return output in the same JSON format as `BrandProfilerWithoutLogoResult`
- Always respond in Brazilian Portuguese

#### Scenario: Prompt exists and is loadable

- **WHEN** the project is inspected
- **THEN** a file `prompts/store-brand-inference.md` SHALL exist
- **AND** it SHALL be loadable via `PromptLoader`

### Requirement: Dual-state population on inference

When the inference endpoint is called, regardless of success or failure of the AI call, the system SHALL update `stores` with BOTH:
- `identity_state = 'text_only'`
- `logo_status = 'explicit_none'`

This dual-population ensures compatibility with existing code that reads `logo_status` while new code migrates to `identity_state`.

#### Scenario: Both fields set on successful inference

- **WHEN** inference completes successfully
- **THEN** `stores.identity_state` SHALL be `'text_only'`
- **AND** `stores.logo_status` SHALL be `'explicit_none'`

#### Scenario: Both fields set on failed inference

- **WHEN** inference fails
- **THEN** `stores.identity_state` SHALL still be `'text_only'`
- **AND** `stores.logo_status` SHALL still be `'explicit_none'`

### Requirement: Campaign color fallback on inference failure

When the brand profile has `status = 'failed'` (inference failed), the campaign generation pipeline SHALL NOT block or error. It SHALL resolve colors using `store.brand_color` if set, falling back to `SEGMENT_COLOR_FALLBACK[segment]`.

#### Scenario: Failed inference uses store.brand_color

- **WHEN** a campaign is generated for a store with profile status `'failed'`
- **AND** `store.brand_color` is set to a valid hex
- **THEN** the campaign SHALL use `store.brand_color` as the brand color
- **AND** no error SHALL be raised

#### Scenario: Failed inference with no brand_color uses segment fallback

- **WHEN** a campaign is generated for a store with profile status `'failed'`
- **AND** `store.brand_color` is null
- **THEN** the campaign SHALL use `SEGMENT_COLOR_FALLBACK[segment]` as the brand color
- **AND** no error SHALL be raised
