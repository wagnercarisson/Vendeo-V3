# Campaign List Tests

> Synced from `fase-16-minhas-campanhas` (ADDED).

## Purpose

Testes do helper `listCampaigns` (owner, vazio, cross-tenant, filtro status), `generateBatchThumbnailUrls` (sucesso, falha parcial, error filter), página (lista, empty state, server guards), `AuthHeader` (link presente/ausente), middleware matcher, redirect `/campaign/preview`, e build verification.

## Requirements

### Requirement: Testes do list helper

O sistema SHALL testar `listCampaigns`, `generateBatchThumbnailUrls`, e `CampaignListItem` em `src/__tests__/lib/campaign/list.test.ts` com os seguintes cenários:

#### Scenario: listCampaigns retorna campanhas da loja

- **WHEN** `listCampaigns` é chamado com o `storeId` do usuário autenticado que possui campanhas
- **THEN** retorna array de `CampaignListItem` com as campanhas `ready` e `error` daquela loja

#### Scenario: listCampaigns retorna apenas ready + error

- **WHEN** a loja possui campanhas `ready`, `error` e `generating`
- **THEN** retorna apenas as campanhas `ready` e `error`, excluindo `generating`

#### Scenario: listCampaigns retorna array vazio para loja sem campanhas

- **WHEN** `listCampaigns` é chamado para uma loja sem campanhas
- **THEN** retorna `[]`

#### Scenario: listCampaigns retorna array vazio para cross-tenant (RLS)

- **WHEN** `listCampaigns` é chamado com `storeId` de outro tenant
- **THEN** retorna `[]` (mock do `createServerClient` retorna `{ data: [] }` — RLS filtra)

#### Scenario: generateBatchThumbnailUrls gera URLs para campanhas ready

- **WHEN** `generateBatchThumbnailUrls` recebe itens com campanhas `ready` e `storagePath` válido
- **THEN** retorna um record com URLs começando com `https://` para cada item `ready`

#### Scenario: generateBatchThumbnailUrls não gera URL para error

- **WHEN** `generateBatchThumbnailUrls` recebe itens com `status === "error"`
- **THEN** os itens `error` recebem `thumbnailUrl = null` (sem chamada a `createSignedUrl`)

#### Scenario: generateBatchThumbnailUrls com falha parcial

- **WHEN** uma ou mais chamadas `createSignedUrl` falham
- **THEN** os itens com falha recebem `thumbnailUrl = null`; os demais mantêm URLs válidas

### Requirement: Testes de exibição da página

O sistema SHALL testar o Client Component da listagem:

#### Scenario: Lista exibe N campanhas com thumbnail + nome + data + status + Abrir

- **WHEN** o Client Component recebe N campanhas
- **THEN** renderiza N cards com thumbnail, nome do produto, data, status e link "Abrir"

#### Scenario: Baixar visível apenas em campanhas ready

- **WHEN** um card tem `status === "ready"`
- **THEN** exibe link "Baixar"
- **WHEN** um card tem `status === "error"`
- **THEN** link "Baixar" não está presente

#### Scenario: Estado vazio exibe mensagem + CTA

- **WHEN** o Client Component recebe array vazio
- **THEN** exibe mensagem "Nenhuma campanha encontrada" + CTA "Criar Primeira Campanha" com link para `/`

#### Scenario: Lista exibe placeholder para thumbnail com falha

- **WHEN** `thumbnailUrl` é `null`
- **THEN** renderiza placeholder visual no lugar da thumbnail

### Requirement: Testes do AuthHeader

O sistema SHALL testar o `AuthHeader`:

#### Scenario: Header mostra Minhas Campanhas quando autenticado

- **WHEN** o usuário está autenticado
- **THEN** o `AuthHeader` contém link "Minhas Campanhas"

#### Scenario: Header não mostra link quando não autenticado

- **WHEN** o usuário não está autenticado
- **THEN** o `AuthHeader` não contém link "Minhas Campanhas"

### Requirement: Testes do Server Component de /minhas-campanhas

O sistema SHALL testar o Server Component em `src/app/minhas-campanhas/page.tsx`:

#### Scenario: Server Component chama requirePageUser

- **WHEN** o Server Component renderiza `/minhas-campanhas`
- **THEN** `requirePageUser()` é chamado para garantir autenticação

#### Scenario: Server Component chama getCurrentStore com userId

- **WHEN** `requirePageUser` retorna usuário
- **THEN** `getCurrentStore(user.userId)` é chamado para resolver a loja

#### Scenario: Server Component redireciona para /store se sem loja

- **WHEN** `getCurrentStore` retorna `null`
- **THEN** o Server Component redireciona para `/store`

#### Scenario: Server Component chama listCampaigns com storeId

- **WHEN** `getCurrentStore` retorna uma loja
- **THEN** `listCampaigns(store.id)` é chamado para carregar as campanhas

#### Scenario: Server Component passa campanhas ao Client

- **WHEN** todas as guards passam e dados são carregados
- **THEN** os dados serializáveis de `listCampaigns` são passados ao Client Component

### Requirement: Testes de redirect de /campaign/preview

O sistema SHALL testar o comportamento de redirect de `/campaign/preview`:

#### Scenario: Autenticado com loja é redirecionado para /minhas-campanhas

- **WHEN** um usuário autenticado com loja acessa `/campaign/preview`
- **THEN** `redirect("/minhas-campanhas")` é chamado

#### Scenario: Autenticado sem loja é redirecionado para /store

- **WHEN** um usuário autenticado sem loja acessa `/campaign/preview`
- **THEN** `redirect("/store")` é chamado (comportamento existente preservado)

#### Scenario: Não autenticado é redirecionado para /login

- **WHEN** um usuário não autenticado acessa `/campaign/preview`
- **THEN** `requirePageUser` redireciona para `/login` (comportamento existente preservado)

### Requirement: Testes do middleware matcher

O sistema SHALL verificar o `config.matcher` do middleware:

#### Scenario: Matcher contém /minhas-campanhas

- **WHEN** o arquivo `src/middleware.ts` é inspecionado
- **THEN** o `config.matcher` contém `/minhas-campanhas`

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

### Requirement: Testes de localização da listagem

O sistema SHALL testar o namespace de textos da listagem e a renderização localizada de `/campanhas`:

#### Scenario: Catálogos pt-BR e es-419 têm paridade

- **WHEN** os catálogos do namespace da listagem são inspecionados
- **THEN** ambos SHALL ter exatamente as mesmas chaves e namespaces
- **AND** SHALL ter o mesmo conjunto de placeholders por chave e nenhum valor vazio

#### Scenario: Renderização em es-419

- **WHEN** a listagem é renderizada com `locale = "es-419"`
- **THEN** título, busca, filtros, ordenação, estados vazios, status, ações e paginação SHALL aparecer em espanhol
- **AND** os nomes acessíveis da busca, período e ordenação SHALL estar em espanhol

#### Scenario: Busca, filtros, ordenação e paginação preservados

- **WHEN** a listagem é renderizada nos dois idiomas
- **THEN** os valores de URL, os argumentos de `listCampaigns`, o debounce, os `values` dos selects e o callback de paginação SHALL ser idênticos
- **AND** o redirect de página vazia SHALL permanecer inalterado

#### Scenario: Ações e fallback de miniatura preservados na localização

- **WHEN** a listagem é renderizada em `es-419` com campanhas `ready` e `error`
- **THEN** `Abrir` SHALL continuar navegando para o detalhe e `Descargar` SHALL continuar apontando para `/api/campaign/{id}/download`
- **AND** placeholder, `loading` eager/lazy e recuperação da miniatura SHALL permanecer inalterados

#### Scenario: Paginação mantém português como padrão

- **WHEN** `<Pagination>` é renderizado sem rótulos localizados
- **THEN** os botões SHALL continuar exibindo `"<< Anterior"` e `"Próximo >>"`
- **AND** o consumidor do extrato de créditos NÃO SHALL regredir
