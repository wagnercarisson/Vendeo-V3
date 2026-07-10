# Publication Copy Tests

> Synced from `fase-17-edicao-publication-copy` (ADDED).

## Purpose

Testes de validação (8 cenários), rota PATCH (8 cenários), fallback display (4 cenários), e UI de edição (9 cenários).

## Requirements

### Requirement: Testes de validatePublicationCopy

O sistema SHALL testar `validatePublicationCopy` com os seguintes cenários:

#### Scenario: Aceita body válido

- **WHEN** `validatePublicationCopy` recebe `{ caption: "Texto", hashtags: ["#tag"], cta_post: "Compre" }`
- **THEN** retorna `{ valid: true, data: { caption: "Texto", hashtags: ["#tag"], cta_post: "Compre" } }`

#### Scenario: Aceita restore: true

- **WHEN** `validatePublicationCopy` recebe `{ restore: true }`
- **THEN** retorna `{ valid: true, data: { restore: true } }`

#### Scenario: Rejeita caption > 2200 chars

- **WHEN** `validatePublicationCopy` recebe caption com 2201 caracteres
- **THEN** retorna `{ valid: false }` com issue no campo `caption`

#### Scenario: Rejeita hashtag sem #

- **WHEN** `validatePublicationCopy` recebe `{ caption: "x", hashtags: ["tag"], cta_post: "x" }`
- **THEN** retorna `{ valid: false }` com issue no campo `hashtags`

#### Scenario: Rejeita > 30 hashtags

- **WHEN** `validatePublicationCopy` recebe 31 hashtags
- **THEN** retorna `{ valid: false }` com issue no campo `hashtags`

#### Scenario: Rejeita hashtag com espaço

- **WHEN** `validatePublicationCopy` recebe `{ caption: "x", hashtags: ["#tag com espaço"], cta_post: "x" }`
- **THEN** retorna `{ valid: false }` com issue no campo `hashtags`

#### Scenario: Rejeita cta_post > 200 chars

- **WHEN** `validatePublicationCopy` recebe cta_post com 201 caracteres
- **THEN** retorna `{ valid: false }` com issue no campo `cta_post`

#### Scenario: Rejeita body vazio

- **WHEN** `validatePublicationCopy` recebe `{}`
- **THEN** retorna `{ valid: false }`

### Requirement: Testes de getEffectivePublicationCopy

O sistema SHALL testar a função de fallback em `display.ts`:

#### Scenario: Retorna current quando existe

- **WHEN** `getEffectivePublicationCopy` recebe campaign com `publication_copy_current` e `publication_copy_snapshot` válidos
- **THEN** retorna os dados de `current` (prioridade)

#### Scenario: Retorna snapshot quando current é null

- **WHEN** `getEffectivePublicationCopy` recebe campaign com `publication_copy_current = null` e `publication_copy_snapshot` válido
- **THEN** retorna os dados do snapshot (fallback)

#### Scenario: Retorna snapshot quando current tem campos faltando

- **WHEN** `getEffectivePublicationCopy` recebe campaign com `publication_copy_current` mal formatado (ex: sem `caption`)
- **THEN** retorna os dados do snapshot (fallback seguro)

#### Scenario: Retorna vazio quando ambos são null

- **WHEN** `getEffectivePublicationCopy` recebe campaign com ambos `null`
- **THEN** retorna `{ caption: "", hashtags: [], cta_post: "" }`

### Requirement: Testes do PATCH route

O sistema SHALL testar a rota PATCH com os cenários da especificação `publication-copy-route`:

#### Scenario: PATCH sucesso

- **WHEN** owner faz PATCH com body válido
- **THEN** status 200 com `{ publication_copy_current: {...} }`

#### Scenario: PATCH body inválido

- **WHEN** owner faz PATCH com body inválido
- **THEN** status 400

#### Scenario: PATCH 404 UUID inválido

- **WHEN** PATCH com string que não é UUID v4
- **THEN** status 404 sem consultar o banco

#### Scenario: PATCH 404 inexistente

- **WHEN** PATCH com ID de campanha que não existe
- **THEN** status 404

#### Scenario: PATCH 404 outro tenant

- **WHEN** PATCH com ID de campanha de outro tenant
- **THEN** status 404

#### Scenario: PATCH restore

- **WHEN** owner faz PATCH com `{ restore: true }`
- **THEN** status 200 com `{ restored: true, publication_copy_snapshot: {...} }`

#### Scenario: PATCH CSRF inválido

- **WHEN** requisição de origem externa
- **THEN** erro de CSRF

#### Scenario: PATCH sem auth

- **WHEN** usuário não autenticado
- **THEN** erro de autenticação

### Requirement: Testes da UI de edição

O sistema SHALL testar o modo edição inline no Client Component:

#### Scenario: Modo visualização exibe publication copy

- **WHEN** o Client Component renderiza em modo visualização
- **THEN** caption, hashtags, cta_post estão visíveis

#### Scenario: Badge "Editado" quando isPublicationCopyEdited é true

- **WHEN** `isPublicationCopyEdited` é `true`
- **THEN** badge "Editado" é exibido ao lado do título

#### Scenario: PATCH URL usa campaignId

- **WHEN** o Client Component está em modo edição
- **THEN** a URL do PATCH é montada como `/api/campaign/${campaignId}/publication-copy`

#### Scenario: Botão Editar entra em modo edição

- **WHEN** usuário clica "Editar"
- **THEN** inputs aparecem com valores preenchidos

#### Scenario: Botão Salvar chama PATCH

- **WHEN** usuário clica "Salvar"
- **THEN** requisição PATCH é feita com dados atuais

#### Scenario: Botão Restaurar chama PATCH restore

- **WHEN** usuário confirma "Restaurar original"
- **THEN** requisição PATCH com `{ restore: true }` é feita

#### Scenario: Botão Cancelar descarta alterações

- **WHEN** usuário clica "Cancelar"
- **THEN** volta ao modo visualização sem alterações

#### Scenario: Loading durante salvamento

- **WHEN** requisição PATCH está em andamento
- **THEN** botões "Salvar" e "Restaurar" estão desabilitados

#### Scenario: Erro após falha do PATCH

- **WHEN** requisição PATCH falha
- **THEN** mensagem de erro é exibida e modo edição é mantido
