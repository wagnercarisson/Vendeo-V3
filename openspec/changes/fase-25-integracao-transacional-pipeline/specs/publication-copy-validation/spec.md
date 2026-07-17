## MODIFIED Requirements

### Requirement: validatePublicationCopy function

O sistema SHALL prover uma função `validatePublicationCopy(body: unknown)` que valida o body da requisição PATCH de publicação.

A função SHALL:
- Aceitar `title?` (string, 0–200 caracteres — opcional, aceito mas não exigido)
- Aceitar `caption` (string, 1–2200 caracteres)
- Aceitar `hashtags` (array de strings, 0–30 itens, cada um: 2–100 chars, começa com `#`, sem espaços, apenas letras/números/underscore após o `#`)
- Aceitar `cta_post` (string, 0–200 caracteres — opcional, pode ser vazio)
- Aceitar `restore` (boolean — se true, ignora os outros campos)
- Se `restore === true`, retornar sem erros (não valida outros campos)
- Retornar objeto `{ valid: boolean; data?: PublicationCopyUpdate; issues?: ValidationIssue[] }`

#### Scenario: validatePublicationCopy aceita body válido com title

- **WHEN** `validatePublicationCopy` recebe `{ title: "Título", caption: "Texto", hashtags: ["#tag"], cta_post: "Compre" }`
- **THEN** retorna `{ valid: true, data: { title, caption, hashtags, cta_post } }`

#### Scenario: validatePublicationCopy aceita body sem title (v1.3/v1.4)

- **WHEN** `validatePublicationCopy` recebe `{ caption: "Texto", hashtags: ["#tag"], cta_post: "Compre" }` (sem `title`)
- **THEN** retorna `{ valid: true }` — `title` não é exigido

#### Scenario: validatePublicationCopy aceita restore: true

- **WHEN** `validatePublicationCopy` recebe `{ restore: true }`
- **THEN** retorna `{ valid: true, data: { restore: true } }` (ignora outros campos)

#### Scenario: validatePublicationCopy rejeita caption > 2200 chars

- **WHEN** `validatePublicationCopy` recebe caption com mais de 2200 caracteres
- **THEN** retorna `{ valid: false, issues: [{ field: "caption", message: "...", code: "too_long" }] }`

#### Scenario: validatePublicationCopy rejeita hashtag sem #

- **WHEN** `validatePublicationCopy` recebe hashtag sem prefixo `#` (ex: "tag")
- **THEN** retorna `{ valid: false, issues: [{ field: "hashtags", message: "...", code: "invalid_format" }] }`

#### Scenario: validatePublicationCopy rejeita > 30 hashtags

- **WHEN** `validatePublicationCopy` recebe array com mais de 30 hashtags
- **THEN** retorna `{ valid: false, issues: [{ field: "hashtags", message: "...", code: "too_many" }] }`

### Requirement: PublicationCopyUpdate interface

O sistema SHALL definir a interface `PublicationCopyUpdate` para tipar o body da requisição.

A interface SHALL ser um union type:
- `{ title?: string; caption: string; hashtags: string[]; cta_post: string }` (edição normal com `title` opcional)
- `{ restore: true }` (restaurar original)

#### Scenario: PublicationCopyUpdate aceita edição normal com title opcional

- **WHEN** `PublicationCopyUpdate` é usado com `{ title, caption, hashtags, cta_post }`
- **THEN** os tipos são `title?: string`, `caption: string`, `hashtags: string[]`, `cta_post: string`

#### Scenario: PublicationCopyUpdate aceita restore

- **WHEN** `PublicationCopyUpdate` é usado com `{ restore: true }`
- **THEN** o tipo aceita apenas `{ restore: true }` como alternativa aos campos de edição
