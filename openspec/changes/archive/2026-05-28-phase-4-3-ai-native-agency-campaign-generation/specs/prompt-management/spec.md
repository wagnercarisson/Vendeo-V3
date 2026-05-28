> **Purpose**: This spec defines the versioned, locatable, editable prompt files stored in a root `prompts/` directory. These prompts are loaded at service initialization and used by image generation, quality review, and input validation services.

## ADDED Requirements

### Requirement: Prompt files in root prompts/ directory

The system SHALL maintain three prompt files in a `prompts/` directory at the project root:

- `prompts/campaign-image-director.md` — director of marketing / art director persona for image generation
- `prompts/campaign-image-reviewer.md` — quality review criteria applied **after** generation
- `prompts/campaign-input-visual-check.md` — pre-generation conflict detection between typed product name and product image

Prompt files SHALL be simple, readable Markdown — no complex template architecture, no YAML frontmatter, no programmatic logic.

#### Scenario: Prompt files exist at expected paths

- **WHEN** inspecting the `prompts/` directory
- **THEN** `campaign-image-director.md`, `campaign-image-reviewer.md`, and `campaign-input-visual-check.md` SHALL exist

#### Scenario: Prompt files are plain Markdown

- **WHEN** opening any prompt file
- **THEN** the content SHALL be valid Markdown without YAML frontmatter or embedded code

### Requirement: Prompt template variables

Prompt files SHALL support `{{variable}}` placeholders for interpolation at runtime. Supported variables include:
- `{{productName}}` — the product name
- `{{storeName}}` — the store name
- `{{storeSegment}}` — the store segment
- `{{storeTone}}` — the store's tone of voice
- `{{brandColor}}` — the resolved brand/accent color
- `{{originalPrice}}` — original price display string
- `{{discountedPrice}}` — discounted price display string
- `{{badgeText}}` — promotional badge text
- `{{hook}}` — campaign hook/benefit
- `{{cta}}` — call to action text
- `{{objective}}` — campaign objective/intention
- `{{campaignDetails}}` — additional campaign details from the form
- `{{additionalDetails}}` — free-form additional details provided by the lojista
- `{{targetChannel}}` — target social media channel (e.g., "Instagram")
- `{{format}}` — format specification (e.g., "quadrado 1:1")
- `{{validity}}` — promotion validity period if specified
- `{{availabilityNotes}}` — availability information (e.g., "poucas unidades", "cores variadas")
- `{{sensitiveConstraints}}` — sensitive constraints provided by the lojista (e.g., "não inventar condições comerciais", "não informar parcelamento sem aprovação")

Interpolation SHALL be a simple string replace with no template engine dependency.

#### Scenario: Variables are interpolated at runtime

- **WHEN** a service loads a prompt file containing `{{productName}}`
- **THEN** the placeholder SHALL be replaced with the actual product name from the campaign input

#### Scenario: Unknown variables are left as-is

- **WHEN** a placeholder does not match any known variable
- **THEN** the placeholder SHALL remain in the prompt text as-is (no error, no substitution)

### Requirement: Prompt loader

The system SHALL provide a `PromptLoader` utility at `src/lib/image-generation/prompt-loader.ts` that reads prompt files and interpolates variables.

`PromptLoader` SHALL:
- Read prompt files from the filesystem using `fs.readFileSync`
- Cache loaded prompts in memory for the lifetime of the server instance
- Accept a variables object for interpolation
- Return the interpolated prompt string

#### Scenario: PromptLoader reads and caches

- **WHEN** `PromptLoader.load('campaign-image-director')` is called twice
- **THEN** the first call SHALL read the file from disk
- **AND** the second call SHALL return the cached version without reading disk again

#### Scenario: PromptLoader interpolates variables

- **WHEN** `PromptLoader.load('campaign-image-director', { productName: 'Tênis' })` is called
- **THEN** the returned string SHALL have `{{productName}}` replaced with `'Tênis'`

### Requirement: campaign-image-director.md prompt content

The `campaign-image-director.md` prompt SHALL instruct the image model to act as a director of marketing / art director. It SHALL guide the model to:

- Create a flat 1:1 square campaign image for Instagram
- Position the product as the visual hero
- Display the store name, product name, and price clearly and legibly
- Use the store's brand color palette
- Follow a clean, professional, agency-grade visual style
- Keep all text in Brazilian Portuguese (PT-BR)
- NOT invent prices, discounts, or availability information
- Use the product image as a visual reference for the featured product

#### Scenario: Prompt guides professional campaign output

- **WHEN** `campaign-image-director.md` is loaded and sent to the image model
- **THEN** the generated image SHALL follow the direction specified in the prompt

### Requirement: campaign-image-reviewer.md prompt content

The `campaign-image-reviewer.md` prompt SHALL instruct the vision model to inspect the generated image and detect:

- Wrong price (compared to campaign input)
- Wrong product name (compared to campaign input)
- Wrong store name (compared to store identity)
- Illegible or corrupted text
- Invented commercial information
- Deformed or distorted product
- Amateur-level visual quality
- Sensitive/unverifiable claims presented as fact

The prompt SHALL require the model to respond **only** with valid JSON, no markdown, no explanations outside the JSON. Expected response format:

```json
{
  "passed": false,
  "issues": [
    {
      "type": "wrong_price",
      "severity": "critical",
      "description": "O preço exibido é R$ 49,90 mas o valor correto é R$ 39,90."
    }
  ]
}
```

#### Scenario: Review prompt detects issues

- **WHEN** `campaign-image-reviewer.md` is loaded and sent with a generated image
- **THEN** the model SHALL return a structured assessment of issues found
- **AND** the response SHALL be valid JSON matching the expected schema

### Requirement: campaign-input-visual-check.md prompt content

The `campaign-input-visual-check.md` prompt SHALL instruct the vision model to compare the typed product name against the uploaded product image and determine:

- `match` — the name and image clearly refer to the same product
- `auto-fix` — the typed name has a minor error and the correct name can be derived from the image
- `conflict` — the typed name and image refer to different products
- `low-confidence` — unable to determine match with confidence

The prompt SHALL require the model to respond **only** with valid JSON, no markdown, no explanations outside the JSON. Expected response format:

```json
{
  "classification": "auto-fix",
  "confidence": 0.92,
  "correctedProductName": "Nescau",
  "suggestedProductName": "Coca-Cola",
  "reason": "O texto 'neskau' na imagem corresponde a 'Nescau'."
}
```

#### Scenario: Input check prompt classifies match

- **WHEN** `campaign-input-visual-check.md` is loaded and sent with a product name and product image
- **THEN** the model SHALL return one of the four classification values
- **AND** the response SHALL be valid JSON matching the expected schema
