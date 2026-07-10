# Publication Copy Validation

> Part of `fase-17-edicao-publication-copy` (ADDED).

## Purpose

Função `validatePublicationCopy(body)` e interface `PublicationCopyUpdate` em `src/lib/campaign/publication-copy.ts` para validar o body da requisição PATCH de edição do publication copy. Reutilizável para validação no backend (rota) e futuramente no frontend.

## ADDED Requirements

### Requirement: validatePublicationCopy function

O sistema SHALL prover uma função `validatePublicationCopy(body: unknown)` que valida o body da requisição PATCH de publicação.

A função SHALL:
- Aceitar `caption` (string, 1–2200 caracteres)
- Aceitar `hashtags` (array de strings, 0–30 itens, cada um: 2–100 chars, começa com `#`, sem espaços, apenas letras/números/underscore após o `#`)
- Aceitar `cta_post` (string, 0–200 caracteres — opcional, pode ser vazio)
- Aceitar `restore` (boolean — se true, ignora os outros campos)
- Se `restore === true`, retornar sem erros (não valida outros campos)
- Retornar objeto `{ valid: boolean; data?: PublicationCopyUpdate; issues?: ValidationIssue[] }`

#### Scenario: validatePublicationCopy aceita body válido

- **WHEN** `validatePublicationCopy` recebe `{ caption: "Texto", hashtags: ["#tag"], cta_post: "Compre" }`
- **THEN** retorna `{ valid: true, data: { caption, hashtags, cta_post } }`

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

#### Scenario: validatePublicationCopy rejeita hashtag com espaço

- **WHEN** `validatePublicationCopy` recebe hashtag contendo espaço (ex: "#minha tag")
- **THEN** retorna `{ valid: false, issues: [{ field: "hashtags", message: "...", code: "invalid_format" }] }`

#### Scenario: validatePublicationCopy rejeita cta_post > 200 chars

- **WHEN** `validatePublicationCopy` recebe cta_post com mais de 200 caracteres
- **THEN** retorna `{ valid: false, issues: [{ field: "cta_post", message: "...", code: "too_long" }] }`

#### Scenario: validatePublicationCopy rejeita body vazio

- **WHEN** `validatePublicationCopy` recebe body vazio `{}`
- **THEN** retorna `{ valid: false, issues: [{ field: "body", message: "...", code: "invalid_body" }] }`

### Requirement: PublicationCopyUpdate interface

O sistema SHALL definir a interface `PublicationCopyUpdate` para tipar o body da requisição.

A interface SHALL ser um union type:
- `{ caption: string; hashtags: string[]; cta_post: string }` (edição normal)
- `{ restore: true }` (restaurar original)

#### Scenario: PublicationCopyUpdate aceita edição normal

- **WHEN** `PublicationCopyUpdate` é usado com `{ caption, hashtags, cta_post }`
- **THEN** os tipos são `caption: string`, `hashtags: string[]`, `cta_post: string`

#### Scenario: PublicationCopyUpdate aceita restore

- **WHEN** `PublicationCopyUpdate` é usado com `{ restore: true }`
- **THEN** o tipo aceita apenas `{ restore: true }` como alternativa aos campos de edição

### Requirement: ValidationIssue type

O sistema SHALL definir o tipo `ValidationIssue` com pelo menos:
- `field: string` (nome do campo com erro)
- `message: string` (mensagem descritiva em português)
- `code: string` (código do erro, ex: `"too_long"`, `"invalid_format"`, `"too_many"`, `"invalid_body"`)

#### Scenario: ValidationIssue reporta campo e mensagem

- **WHEN** um erro de validação ocorre
- **THEN** o `ValidationIssue` retorna `field`, `message`, e `code`
