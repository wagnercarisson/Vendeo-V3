# Generation Retry & Fallback

> Delta spec for `fase-41-midia-de-campanha-mobile` (D7).

## MODIFIED Requirements

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
