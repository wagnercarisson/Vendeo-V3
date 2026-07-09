# Campaign Page Tests

## Purpose

Testes do helper `display.ts` (getCampaignForDisplay, generateSignedPreviewUrl), da página (4 estados + 404), e verificação do middleware.

## Requirements

### Requirement: Testes do display helper

O sistema SHALL testar `getCampaignForDisplay` e `generateSignedPreviewUrl` em `src/__tests__/lib/campaign/display.test.ts` com os seguintes cenários:

#### Scenario: getCampaignForDisplay retorna campanha para owner

- **WHEN** `getCampaignForDisplay` é chamado com um UUID existente e o usuário é owner
- **THEN** retorna `CampaignRecord` completo

#### Scenario: getCampaignForDisplay retorna null para não owner

- **WHEN** `getCampaignForDisplay` é chamado com um UUID existente e o usuário NÃO é owner
- **THEN** retorna `null` (mock do `createServerClient` retorna `{ data: null }` — simulando RLS filtrando)

#### Scenario: getCampaignForDisplay retorna null para ID inexistente

- **WHEN** `getCampaignForDisplay` é chamado com UUID válido que não existe no banco
- **THEN** retorna `null` (`maybeSingle` sem resultado)

#### Scenario: getCampaignForDisplay rejeita UUID inválido

- **WHEN** `getCampaignForDisplay` é chamado com string que não é UUID v4
- **THEN** retorna `null` sem consultar o banco

#### Scenario: generateSignedPreviewUrl retorna URL para path válido

- **WHEN** `generateSignedPreviewUrl` é chamado com `"storeId/campaignId.jpg"`
- **THEN** retorna string começando com `https://`

#### Scenario: generateSignedPreviewUrl retorna null para path vazio

- **WHEN** `generateSignedPreviewUrl` é chamado com `""`
- **THEN** retorna `null`

#### Scenario: computeDisplayStatus ready

- **WHEN** `campaign.status` é `"ready"`
- **THEN** retorna `"ready"`

#### Scenario: computeDisplayStatus generating

- **WHEN** `campaign.status` é `"generating"` e `updated_at` está dentro do timeout + margem
- **THEN** retorna `"generating"`

#### Scenario: computeDisplayStatus stale

- **WHEN** `campaign.status` é `"generating"` e `updated_at` ultrapassou o timeout + margem
- **THEN** retorna `"stale"`

#### Scenario: computeDisplayStatus error

- **WHEN** `campaign.status` é `"error"`
- **THEN** retorna `"error"`

### Requirement: Testes de exibição dos estados da página

O sistema SHALL testar os 4 estados da página em `src/__tests__/api/campaign-page.test.tsx` ou similar:

#### Scenario: Ready exibe imagem e copy

- **WHEN** `displayStatus` é `"ready"`
- **THEN** a página renderiza imagem, caption, hashtags, cta_post e botão de download com `downloadUrl`

#### Scenario: Generating exibe spinner

- **WHEN** `displayStatus` é `"generating"`
- **THEN** a página renderiza spinner + mensagem de geração

#### Scenario: Stale exibe erro técnico

- **WHEN** `displayStatus` é `"stale"`
- **THEN** a página renderiza mensagem de geração interrompida + CTA

#### Scenario: Error exibe mensagem e CTA

- **WHEN** `displayStatus` é `"error"`
- **THEN** a página renderiza mensagem de falha + CTA para nova campanha

#### Scenario: Campanha inexistente chama notFound

- **WHEN** `getCampaignForDisplay` retorna `null`
- **THEN** `notFound()` é chamado

### Requirement: Verificação de middleware

O sistema SHALL verificar que `/campanha/:path*` está presente no `config.matcher` do middleware:

#### Scenario: Middleware matcher contém campanha

- **WHEN** o arquivo `src/middleware.ts` é inspecionado
- **THEN** o `config.matcher` contém `/campanha/:path*`

### Requirement: Build verification

O sistema SHALL verificar que o build está limpo:

#### Scenario: TypeScript sem erros

- **WHEN** `npm run typecheck` é executado
- **THEN** zero erros de tipo

#### Scenario: Lint sem erros

- **WHEN** `npm run lint` é executado
- **THEN** zero erros de lint

#### Scenario: Testes passando

- **WHEN** `npx vitest run` é executado
- **THEN** todos os testes passam

#### Scenario: Build bem-sucedido

- **WHEN** `npm run build` é executado
- **THEN** o build é bem-sucedido
