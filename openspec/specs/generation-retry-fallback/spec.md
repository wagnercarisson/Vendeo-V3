# Generation Retry & Fallback

> Modified by `fase-41-midia-de-campanha-mobile` (D7): fallback `images.edit` **gated por primary única** (1 imagem) — com auxiliares (2+), retries permanecem no Responses path; se indisponível → erro explícito. O fallback envia **apenas o `productFile`** (identidade/logo fora do fallback).

## Purpose

Defines the automatic retry policy for recoverable generation errors, budget-aware retry gating, and the fallback path between provider strategies.

## Requirements

### Requirement: Retry follows defined policy per error type

The system SHALL implement automatic retry for recoverable errors using the following policy:

| Error Code | Max Retries | Backoff | Strategy |
|------------|-------------|---------|----------|
| `provider_error` (429, 503, network) | 2 | 1s, 3s | Retry same provider path |
| `provider_timeout` | 1 | Immediate | Try fallback provider path |
| `no_image_in_response` | 1 | Immediate | Try fallback model/config |
| `empty_review` | 1 | Immediate | Regenerate and re-review |
| `insufficient_image` | 2 | Immediate | Regenerate with specific correction instruction |
| `review_low_confidence` | 1 | Immediate | Regenerate with quality improvement instruction |

Non-retryable errors (`provider_auth_error`, `generated_product_mismatch`, `product_image_conflict`, `input_low_confidence`, `invalid_data`, `global_timeout`) SHALL be emitted directly without retry attempt.

#### Scenario: Rate limit triggers retry

- **WHEN** the provider returns a 429 rate limit error
- **AND** retries remain for `provider_error` (max 2)
- **THEN** the service SHALL wait 1s before the first retry, 3s before the second
- **AND** SHALL call the provider again with the same prompt and configuration

#### Scenario: All retries exhausted emits terminal error

- **WHEN** all retry attempts for a recoverable error have been exhausted
- **AND** the error persists
- **THEN** the service SHALL return a `GenerationError` with `retryable: false`
- **AND** the API route SHALL convert it to an NDJSON `type: "error"` event

#### Scenario: Non-retryable error skips retry

- **WHEN** a non-retryable error occurs (e.g., `generated_product_mismatch`, `provider_auth_error`)
- **THEN** the service SHALL NOT attempt any retry
- **AND** SHALL return the error as terminal immediately

### Requirement: Retry is budget-aware — only retries if time remains

Before each retry attempt, the system SHALL check whether the estimated retry time fits within the remaining global timeout budget:

```
remainingTime = globalTimeout - elapsedTime
if (estimatedRetryDuration > remainingTime) → skip retry, emit terminal error
```

If the budget is exhausted, the error SHALL be emitted as `global_timeout` regardless of the original error code.

#### Scenario: Retry skipped when budget insufficient

- **WHEN** a `provider_error` occurs
- **AND** `remainingTime` is less than the estimated retry duration (e.g., 30s)
- **THEN** the service SHALL NOT attempt retry
- **AND** SHALL emit the error as terminal

#### Scenario: Retry proceeds when budget is sufficient

- **WHEN** a `provider_error` occurs
- **AND** `remainingTime` is greater than the estimated retry duration
- **THEN** the service SHALL proceed with retry
- **AND** the client SHALL receive a phase event with message "Tentando novamente..."

### Requirement: Fallback between provider paths

When the primary provider path fails with a recoverable error, the system SHALL attempt a fallback path if available. The fallback is configured in the provider implementation and SHALL use a different model or API method (e.g., Image API edit when Responses API fails).

The fallback path SHALL count as one of the retry attempts for `provider_error` and `provider_timeout` errors.

**F41 D7 — política fechada (gating):** o fallback `images.edit` (Image API) aceita **apenas 1 base image** (limitação documentada em `openai.ts:282-287`). Portanto:

- **SÓ com a primary única** (1 imagem — `productImageDataUrl` legado ou `productImagesDataUrls` de 1 elemento): o fallback `images.edit` é permitido, enviando **apenas o `productFile`** (a imagem primary) como base image.
- **Com auxiliares** (2+ imagens): o fallback `images.edit` **NÃO** é usado — os retries permanecem no **Responses path**; se o Responses estiver indisponível → **erro explícito** (sem degradar a fidelidade descartando imagens).

O fallback `images.edit` SHALL enviar apenas o `productFile` (imagem primary) como base image — **a identidade/logo NÃO faz parte do fallback multi-imagem** (limitação pré-existente: `images.edit` aceita uma única imagem de base — `openai.ts:282-287`; antes da fase 5 o fallback também perdia a identidade). A identidade permanece apenas no caminho mainline (Responses path, `detail: "low"`).

Erros permanecem **controlados** — sem degradação silenciosa do produto: se a primary única estiver indisponível/malformada, o fallback SHALL emitir erro terminal com mensagem PT-BR clara, sem gerar arte sem o produto.

#### Scenario: Primary path failure triggers fallback

- **WHEN** the primary provider path (Responses API) fails with a recoverable error
- **AND** há **apenas a primary única** (1 imagem)
- **THEN** the service SHALL attempt the fallback path
- **AND** o fallback SHALL enviar **apenas o `productFile`** (a primary) como base image em `images.edit`
- **AND** if the fallback succeeds, the result SHALL be returned normally

#### Scenario: Identidade não entra no fallback (D7)

- **WHEN** o fallback `images.edit` é invocado com primary única e `identityImageUrl` presente
- **THEN** apenas o `productFile` é enviado como base image
- **AND** a identidade/logo NÃO é enviada no `images.edit` (limitação `openai.ts:282-287`; identidade permanece só no Responses path)

#### Scenario: Fallback NÃO usado com auxiliares (D7)

- **WHEN** o input tem 2+ imagens (`productImagesDataUrls` com auxiliares) e o Responses falha com erro retryable
- **THEN** os retries permanecem no **Responses path**
- **AND** o fallback `images.edit` NÃO é invocado (não degrada a fidelidade descartando imagens)

#### Scenario: Erro explícito com auxiliares e Responses indisponível (D7)

- **WHEN** há auxiliares e o Responses path esgota os retries
- **THEN** o sistema emite **erro explícito** (terminal)
- **AND** nenhuma imagem é descartada silenciosamente

#### Scenario: Fallback failure emits terminal error

- **WHEN** both primary and fallback paths fail
- **THEN** the service SHALL emit a terminal error
- **AND** the error code SHALL reflect the original failure type (e.g., `provider_error`)

### Requirement: Identity asset preserved across retry and fallback paths

O sistema SHALL preservar a identidade/logo no **mainline** e NÃO enviá-la no caminho de fallback:

- `attempt = 0` (Responses API, primary path): SHALL ser enviado como `input_image` com `detail: "low"` — **inalterado**.
- `attempt >= 1` (fallback `images.edit`, SÓ com primary única — D7): **NÃO SHALL ser enviado** — o fallback envia apenas o `productFile` (limitação `openai.ts:282-287`; identidade permanece só no Responses path).

> **F41 D7 (gating):** com o fallback `images.edit` agora **gated por primary única** e enviando **apenas o `productFile`**, a identidade/logo NÃO entra no caminho de fallback (limitação pré-existente `openai.ts:282-287`). A identidade permanece **apenas no mainline** (Responses path, `detail: "low"`). Esta seção preserva o requisito original de disponibilidade da identidade no mainline e documenta a nova política do fallback.

#### Scenario: identityImageUrl sent on primary path

- **WHEN** `generateImage()` is called with `attempt = 0`
- **THEN** `identityImageUrl` SHALL be sent as `input_image` in the Responses API call

#### Scenario: identityImageUrl não entra no fallback (D7)

- **WHEN** `generateImage()` é chamado com `attempt >= 1` (fallback `images.edit` com primary única)
- **THEN** apenas o `productFile` é enviado como base image
- **AND** a identidade/logo NÃO é enviada no `images.edit` (limitação `openai.ts:282-287`)
