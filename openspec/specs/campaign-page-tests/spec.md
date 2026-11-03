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

### Requirement: Testes da localização da campanha pronta

O sistema SHALL testar o namespace `campaign-detail` e a localização da entrega pronta em `pt-BR` e `es-419`, sem enfraquecer as asserções existentes.

#### Scenario: paridade e isolamento do catálogo

- **WHEN** os catálogos `pt-BR` e `es-419` do namespace são comparados
- **THEN** têm exatamente as mesmas chaves e placeholders
- **AND** são congelados
- **AND** o namespace não é reexportado pelo barrel global nem importado por layout, shell ou admin

#### Scenario: render es-419 e marcação de idioma

- **WHEN** o cliente renderiza a entrega pronta com `locale="es-419"`
- **THEN** os textos fixos aparecem em espanhol
- **AND** o contêiner declara `lang="es-419"` alcançando header/breadcrumb
- **AND** o conteúdo persistido declara `lang=""`
- **AND** copiar usa o texto exato e exibe `¡Copiado!`

#### Scenario: pt-BR inalterado

- **WHEN** o cliente renderiza a entrega pronta com `locale="pt-BR"`
- **THEN** os textos fixos permanecem exatamente iguais aos atuais
- **AND** nenhum `lang="es-419"` é declarado

#### Scenario: gate da localização acompanha a view renderizada

- **WHEN** a campanha legada `ready` tem aprovação `pending` sem candidata
- **THEN** `ReadyView` é renderizada e localizada
- **WHEN** a aprovação `pending` tem candidata (`candidateImageUrl` + `candidateVersionId`)
- **THEN** `CampaignApprovalView` é renderizada sem localização

#### Scenario: interface não traduzida usa pt-BR

- **WHEN** a interface está em `es-419` e exibe edição, recuperação ou falha/cancelamento da copy
- **THEN** o texto permanece em português e é marcado com `lang="pt-BR"`

#### Scenario: estados fora do recorte não regridem

- **WHEN** os testes renderizam `generating`, `stale`, `error`, `pending` com candidata, `regenerating`, `running`, `refunded` e `unknown`
- **THEN** as telas e os textos continuam iguais
- **AND** não recebem wrapper `lang="es-419"` novo

#### Scenario: PageHeader opcional

- **WHEN** `titleLang`/breadcrumb `lang` não são passados
- **THEN** o DOM do `PageHeader` permanece sem atributo `lang`
- **WHEN** são passados
- **THEN** o atributo é aplicado apenas ao título/breadcrumb correspondente
