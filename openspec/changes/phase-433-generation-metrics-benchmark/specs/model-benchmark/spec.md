## ADDED Requirements

### Requirement: Benchmark script executes fixed scenarios

The system SHALL provide a `scripts/benchmark.ts` script (executable via `npx tsx` — the project MUST verify `tsx` is available; if not, add it as a devDependency) that executes a pre-defined set of generation scenarios with the same inputs across different provider/model configurations.

The script SHALL:
1. Read the benchmark scenarios from `scripts/benchmark-scenarios.ts`
2. Accept `--provider` and `--model` CLI arguments to override the default provider/model
3. Execute each scenario sequentially with a configurable delay between scenarios
4. Record metrics for each execution in `metrics/benchmark-{timestamp}.jsonl`
5. Print a comparative summary to console after all scenarios complete
6. Respect the same timeout and retry configuration as normal generation
7. Enforce a maximum number of total executions to prevent runaway costs

#### Scenario: Benchmark runs all scenarios sequentially

- **WHEN** `npx tsx scripts/benchmark.ts --provider openai --model gpt-5.5` is executed
- **THEN** all benchmark scenarios SHALL be executed one by one
- **AND** each execution SHALL produce a JSONL metrics record
- **AND** a summary SHALL be printed to console

#### Scenario: Benchmark respects cost limit

- **WHEN** the benchmark script exceeds the configured maximum execution count
- **THEN** the script SHALL stop and print a warning
- **AND** SHALL not execute further scenarios

### Requirement: Benchmark scenarios defined as fixed inputs

The system SHALL define the following fixed benchmark scenarios:

1. **JBL Boombox / eletrônico** — store segment: `eletronicos-tecnologia`, product name: `JBL Boombox 3`, offer with "de/por" pricing, badge: "OFERTA"
2. **Heineken / bebida branded** — store segment: `alimentacao-bebidas`, product name: `Heineken Long Neck`, brand color: green
3. **51 Ice / divergência de nome** — store segment: `alimentacao-bebidas`, product name: `51 Ice`, potential volume/name ambiguity
4. **Pantufa / produto popular** — store segment: `variedades`, product name: `Pantufa Conforto`, simple price-only offer
5. **Produto de moda** — store segment: `moda-vestuario`, product name: `Tênis Runner 3000`, no badge
6. **Loja sem logo** — same as scenario 1 but without store logo URL
7. **Loja com cor forte** — store with extreme brand color (e.g., bright pink or yellow)
8. **Preço de/por** — explicit original and discounted price
9. **Preço só final** — discounted price only, no original price
10. **Detalhes adicionais variados** — includes "poucas unidades", "cores variadas", "vários sabores" as additional details

Each scenario SHALL include complete store identity, campaign data, and product image (or placeholder). The scenarios SHALL be reproducible — same inputs SHALL produce the same setup every time.

**Test images:** Scenarios using real brands or products (Heineken, JBL, etc.) MUST use local fixture images in `scripts/benchmark-fixtures/`. Third-party images MUST NOT be committed without rights verification. The script SHALL accept image paths via local configuration. Evaluate whether `scripts/benchmark-fixtures/` should be added to `.gitignore` if it contains real test images.

#### Scenario: Each scenario is self-contained

- **WHEN** a benchmark scenario is executed
- **THEN** it SHALL provide complete `GenerateImageRequest` input
- **AND** the input SHALL be identical across benchmark runs for comparison

### Requirement: Comparative metrics across models

The benchmark output SHALL include comparative columns for each model tested:

| Metric | Description |
|--------|-------------|
| total time | Wall-clock duration per scenario |
| cost | Estimated cost per execution |
| error rate | Percentage of scenarios that failed |
| retry rate | Percentage of scenarios requiring retries |
| validation result | Classification distribution |
| review pass rate | Percentage passing quality review |

Manual evaluation metrics (visual quality, legibility, product fidelity, commercial strength, publicável) are collected optionally and NOT required for the initial benchmark comparison.

#### Scenario: Summary table printed after benchmark

- **WHEN** all scenarios complete for a given model
- **THEN** the script SHALL print a formatted table with comparative metrics
- **AND** the raw JSONL data SHALL be available for further analysis

### Requirement: Gemini readiness in benchmark

The benchmark scenarios and metrics format SHALL be designed so that running the same battery with a Gemini provider requires only:
1. Implementing `GeminiImageProvider` implementing `ImageProvider`
2. Adding `case "gemini"` to the factory
3. Running `npx tsx scripts/benchmark.ts --provider gemini`
4. Comparing JSONL outputs

#### Scenario: Cross-provider comparison possible

- **WHEN** two benchmark runs are executed with different providers
- **THEN** their JSONL metric files SHALL have the same schema
- **AND** the summary script SHALL be able to compare them structurally
