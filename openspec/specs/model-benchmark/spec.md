# Model Benchmark

## Purpose

A CLI script to run the full image generation pipeline multiple times with configurable provider, model, and delay parameters. Outputs a structured summary table with success/failure counts, average latency, and average cost per run.

## Requirements

### Requirement: Benchmark CLI exists

The system SHALL provide a CLI script at `scripts/benchmark.ts` that can be invoked via `npx tsx scripts/benchmark.ts`.

The CLI SHALL support the following arguments:
- `--provider <name>` — override provider (default: reads from env/config)
- `--model <name>` — override model (default: reads from env/config)
- `--delay <ms>` — delay between runs in milliseconds (default: 2000)
- `--max-runs <number>` — maximum number of runs (default: 5)

When `--provider` or `--model` are provided, the benchmark SHALL use those values for all runs. When omitted, the benchmark SHALL respect the currently configured provider and model from environment/config.

#### Scenario: Benchmark runs with all arguments

- **WHEN** `npx tsx scripts/benchmark.ts --provider openai --model gpt-4o --delay 1000 --max-runs 3` is executed
- **THEN** the benchmark SHALL run 3 times
- **AND** SHALL use `openai` as provider
- **AND** SHALL use `gpt-4o` as model
- **AND** SHALL wait 1000ms between runs

#### Scenario: Benchmark uses defaults when arguments omitted

- **WHEN** `npx tsx scripts/benchmark.ts` is executed
- **THEN** the benchmark SHALL use the configured provider and model from environment
- **AND** SHALL default to max-runs 5
- **AND** SHALL default to delay 2000ms

### Requirement: Benchmark produces structured output per run

Each benchmark run SHALL execute the full image generation pipeline and log the following at completion:
- Run number (e.g., `Run 1/5`)
- Whether it succeeded or failed
- Duration in seconds (e.g., `12.34s`)
- Estimated cost in USD (e.g., `$0.05`)
- Error reason (if failed)

This output SHALL be written to the console in real-time (one line per completed run).

#### Scenario: Real-time per-run output displayed

- **WHEN** a benchmark run completes
- **THEN** a single line SHALL be printed: `Run X/Y  [SUCCESS|FAIL]  duration  cost  [error if failed]`

#### Scenario: Failed run shows error reason

- **WHEN** a benchmark run fails
- **THEN** the output SHALL include the error reason (sanitized)
- **AND** the summary SHALL count it as a failure

### Requirement: Benchmark produces final summary table

After all runs complete, the benchmark SHALL print a summary table with:
- Total runs
- Successful
- Failed
- Average duration
- Average cost (mean of successful runs only)
- Provider
- Model

The summary SHALL be clearly formatted and easy to read.

#### Scenario: Final summary printed after all runs

- **WHEN** all benchmark runs complete
- **THEN** a summary table SHALL be printed with total, success, failure counts, average duration, average cost, provider, and model

### Requirement: Benchmark has 10 fixed scenarios

The benchmark SHALL use 10 fixed scenarios defined in `scripts/benchmark-scenarios.ts`. Each scenario SHALL include:
- `productName` — string
- `storeName` — string
- `storeSegment` — string
- `price` — string
- `campaignObjective` — string
- `campaignFormat` — string
- `imageType` — string
- `productDescription` — string

The benchmark SHALL cycle through these scenarios for each run, wrapping around when scenarios are fewer than max-runs. The full pipeline SHALL be invoked for each scenario, not a unit-test mock.

#### Scenario: Benchmark cycles through 10 scenarios

- **WHEN** `--max-runs 12` is specified
- **THEN** scenarios 1-10 execute in order
- **AND** scenarios 1-2 execute again for runs 11-12

### Requirement: Benchmark uses live env credentials

The benchmark SHALL load `.env.local` using `loadEnvConfig()` from `@next/env` before creating the provider. This ensures credentials and configuration are available in the environment.

#### Scenario: Benchmark loads env before execution

- **WHEN** the benchmark starts
- **THEN** `loadEnvConfig(process.cwd())` SHALL be called
- **AND** provider credentials SHALL be available from environment

### Requirement: Benchmark sanitizes error messages

When a run fails with a technical error, the benchmark SHALL sanitize the error message before logging. Raw error messages SHALL be mapped to short codes:
- `missing_credentials` — credentials not found
- `rate_limited` — rate limit exceeded
- `timeout` — request timed out
- `provider_error` — provider returned an error
- `unknown` — any other error

The short code SHALL appear in the per-run output and the summary. The full error SHALL NOT be printed.

#### Scenario: Error sanitized to short code

- **WHEN** a run fails due to rate limiting
- **THEN** the per-run output SHALL show `rate_limited` instead of the raw error message
