# Campaign List UI

> Synced from `fase-16-minhas-campanhas` (ADDED), then `fase-18-app-shell-ui-base-rotas` (MODIFIED), then `fase-19-onboarding-estados-vazios` (MODIFIED + REMOVED), then `fase-21-historico-busca` — `campaign-list-search-ui` (MODIFIED). Refatoração completa da página `/campanhas` com busca textual, filtros, paginação, URL state compartilhável e empty states adaptativos. Route: `/campanhas`. Microcopy centralizada em `microcopy.ts`. Estados F18/F19 preservados.

## Purpose

A página `/campanhas` SHALL listar as campanhas da loja com busca, filtros, paginação, URL state compartilhável, empty states adaptativos e um único card por campanha, incluindo os indicadores e a miniatura derivada da entrega conjunta.

## Requirements

### Requirement: Server Component com searchParams

O Server Component em `src/app/(app)/campanhas/page.tsx` SHALL:

- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, renderizar `<EmptyState>` com `CAMPAIGNS_NO_STORE` (F19, inalterado)
- Ler `searchParams` como `Promise` (Next.js 15 — `const params = await searchParams`)
- Chamar `parseCampaignListSearchParams(params)` para normalizar, validar e resolver query params (incluindo datePreset → `dateFrom`/`dateTo` ISO)
- Chamar `listCampaigns(store.id, { page, pageSize, search, status, dateFrom, dateTo, sortBy, sortOrder })`
- Passar `ListCampaignsResult` + searchParams atuais para o Client Component

#### Scenario: SSR sem searchParams

- **WHEN** usuário acessa `/campanhas` sem parâmetros
- **THEN** chama `listCampaigns` com todos os defaults (page=1, pageSize=10, status=ready+error, sort=created_at desc)

#### Scenario: SSR com searchParams

- **WHEN** usuário acessa `/campanhas?q=tenis&status=ready&date=90d&page=2`
- **THEN** chama `listCampaigns` com search="tenis", status=["ready"], dateFrom/dateTo calculados, page=2

#### Scenario: SSR com redirect quando página vazia

- **WHEN** `listCampaigns` retorna items vazio e `page > 1`
- **THEN** redireciona para `/campanhas` com `page=1` mantendo demais filtros

#### Scenario: Usuário não autenticado

- **WHEN** um usuário não autenticado acessa `/campanhas`
- **THEN** o middleware redireciona para `/login`

### Requirement: Client Component com busca, filtros e paginação

O Client Component em `src/app/(app)/campanhas/client.tsx` SHALL:

- Receber `items: CampaignListItem[]`, `total: number`, `page: number`, `totalPages: number`, e os searchParams atuais
- Renderizar `<PageHeader title="Campanhas" />` (F18)
- Renderizar campo de busca textual com `useDebounce` (300ms)
- Renderizar chips de status: Todas | Prontas | Erro
- Renderizar dropdown de date preset: Todas | 7 dias | 30 dias | 90 dias | Este ano
- Renderizar dropdown de ordenação: Mais recentes | Mais antigas | Nome A-Z | Nome Z-A
- Renderizar lista de campanhas com cards (mantido de F16/F18)
- Renderizar `<Pagination>` abaixo da lista quando `totalPages > 1`
- Ao mudar qualquer filtro, chamar `router.replace()` com novos searchParams
- Parâmetros com valor default NÃO aparecem na URL

#### Scenario: URL update ao buscar

- **WHEN** usuário digita "tenis" no campo de busca
- **THEN** após 300ms de debounce, `router.replace("/campanhas?q=tenis")` é chamado
- **AND** parâmetros default NÃO aparecem na URL

#### Scenario: Chip de status altera URL

- **WHEN** usuário clica em "Prontas"
- **THEN** `router.replace("/campanhas?status=ready")` é chamado

#### Scenario: Date preset altera URL

- **WHEN** usuário seleciona "90 dias"
- **THEN** `router.replace("/campanhas?date=90d")` é chamado

#### Scenario: Ordenação altera URL

- **WHEN** usuário seleciona "Nome A-Z"
- **THEN** `router.replace("/campanhas?sort=product_name&order=asc")` é chamado

#### Scenario: Múltiplos filtros combinados

- **WHEN** usuário busca "tenis" com status "ready" e data "90d" na página 2
- **THEN** URL é `/campanhas?q=tenis&status=ready&date=90d&page=2`

### Requirement: Cards de campanha

Quando `items` tem 1+ itens, cada card SHALL conter:
- Thumbnail da campanha (signed URL server-side ou placeholder visual)
- Nome do produto (`productName`)
- Data formatada como "dd/mm/aaaa"
- Status visual (`ready` ou `error`) com indicador de cor (verde/vermelho)
- Link "Abrir" → `/campanhas/[id]` (presente em todos os estados)
- Link "Baixar" → `/api/campaign/[id]/download` (**apenas** para `status === "ready"`)

#### Scenario: Lista com N campanhas

- **WHEN** `listCampaigns` retorna N campanhas
- **THEN** renderiza N cards com thumbnail, nome, data, status, "Abrir". "Baixar" aparece apenas nos cards `ready`

#### Scenario: Card de campanha error sem Baixar

- **WHEN** um card tem `status === "error"`
- **THEN** exibe thumbnail placeholder, nome, data, status "error" com indicação visual vermelha, link "Abrir". Link "Baixar" está ausente

### Requirement: Empty states adaptativos

O Client Component SHALL exibir empty states condicionais:

| Condição | Empty State | Fonte |
|----------|-------------|-------|
| `items.length === 0` E sem filtros ativos | `CAMPAIGNS_NO_CAMPAIGNS` (F19) | `microcopy.ts` |
| `items.length === 0` E com filtros ativos | `CAMPAIGNS_SEARCH_EMPTY` (novo F21) | `microcopy.ts` |

#### Scenario: Empty state sem filtros

- **WHEN** `listCampaigns` retorna items vazio e não há filtros ativos
- **THEN** exibe "Nenhuma campanha ainda" + CTA "Criar primeira campanha" → `/campanhas/nova` (F19)
- **AND** os textos SHALL vir da constante `CAMPAIGNS_NO_CAMPAIGNS` em `microcopy.ts`

#### Scenario: Empty state com busca sem resultado

- **WHEN** `listCampaigns` retorna items vazio e há `q` ou filtros ativos
- **THEN** exibe "Nenhuma campanha encontrada" + descrição "Tente ajustar sua busca ou limpar os filtros"
- **AND** os textos SHALL vir da constante `CAMPAIGNS_SEARCH_EMPTY` em `microcopy.ts`

### Requirement: URL compartilhável

O sistema SHALL manter a URL como fonte da verdade:

- `router.replace()` (não `router.push()`) — substitui o histórico, não acumula entries
- Parâmetros default omitidos da URL
- URL completa: `/campanhas?q=tenis&status=ready&date=90d&page=2&sort=created_at&order=desc`

#### Scenario: URL reproduzível

- **WHEN** usuário copia a URL `/campanhas?q=tenis&status=ready&date=90d&page=2`
- **THEN** ao colar em nova aba, o Server Component lê os searchParams e reproduz exatamente a mesma busca

### Requirement: Preservação de estados F18/F19

O sistema SHALL preservar todos os estados existentes:

- Usuário não autenticado → middleware redireciona para `/login` (inalterado)
- Usuário sem loja → empty state "Configure sua loja" + CTA `/loja` (F19, inalterado)
- Loja sem campanhas e sem filtros → empty state "Nenhuma campanha ainda" + CTA `/campanhas/nova` (F19, inalterado)

#### Scenario: Estados F18/F19 permanecem preservados

- **WHEN** o usuário não está autenticado
- **THEN** o middleware SHALL redirecionar para `/login`
- **AND** quando não há loja, o empty state "Configure sua loja" SHALL permanecer
- **AND** quando não há campanhas nem filtros, o empty state "Nenhuma campanha ainda" SHALL permanecer

### Requirement: Design tokens applied

All inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes SHALL be replaced with design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`).

#### Scenario: Tokens replace raw Tailwind colors

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens instead of raw Tailwind color classes

### Requirement: Mobile básico

O layout SHALL ser responsivo:
- Busca + filtros empilhados em coluna no mobile (<768px)
- Chips de status quebram para linha seguinte quando necessário
- Pagination com botões compactos no mobile

#### Scenario: Layout mobile permanece responsivo

- **WHEN** a listagem é exibida em viewport menor que 768px
- **THEN** busca e filtros SHALL ficar empilhados em coluna
- **AND** os chips de status SHALL quebrar para a linha seguinte quando necessário
- **AND** a paginação SHALL usar botões compactos

### Requirement: Localização da listagem (pt-BR e es-419)

A listagem de campanhas SHALL exibir os textos fixos no idioma da interface resolvido no servidor pela fundação existente (`getUiRenderContext` + `SupportedUiLocale`), sem criar seletor, detector, preferência ou resolvedor paralelo. A página SHALL passar ao Client Component apenas o namespace de textos da listagem, e esse namespace NÃO SHALL ser incorporado ao catálogo global do shell nem ao payload de outras rotas.

O namespace SHALL cobrir título, busca (placeholder e nome acessível), filtros de status e período (rótulos e nomes acessíveis), ordenação (rótulos e nome acessível), estados sem loja, sem campanhas e sem resultados de busca, rótulos de status do card, ações Abrir/Baixar, rótulos e explicações dos formatos `1:1` e `9:16`, rótulos da paginação e formatação de datas.

Identificadores de status, valores de parâmetros de URL, critérios de filtragem, ordenação, contagens, debounce, redirect de página vazia e regras de elegibilidade NÃO SHALL ser traduzidos ou alterados. Apenas os rótulos apresentados são localizados.

Nomes de produto, dados persistidos de campanha, textos comerciais e artes NÃO SHALL ser traduzidos. A região traduzida SHALL declarar `lang="es-419"` quando o idioma da interface for `es-419`; o nome do produto e o texto alternativo da miniatura SHALL usar `lang=""` para não herdar espanhol.

#### Scenario: Listagem em es-419 mantém as mesmas campanhas e ações

- **WHEN** um usuário com `uiLocale = "es-419"` acessa `/campanhas`
- **THEN** título, busca, filtros, ordenação, estados vazios, status, formatos, ações e paginação SHALL ser exibidos em `es-419`
- **AND** a mesma loja SHALL ver as mesmas campanhas, na mesma ordem e com as mesmas contagens do que em `pt-BR`
- **AND** os valores de URL, os filtros e o redirect de página vazia SHALL permanecer idênticos

#### Scenario: Listagem em pt-BR preserva textos e comportamento

- **WHEN** um usuário com `uiLocale = "pt-BR"` acessa `/campanhas`
- **THEN** os textos fixos existentes SHALL permanecer exatamente como antes
- **AND** os novos nomes e estados dos chips de formato SHALL seguir o catálogo aprovado desta change
- **AND** nenhuma região SHALL declarar `lang="es-419"`

#### Scenario: Status continuam distintos e com os mesmos critérios

- **WHEN** a listagem é exibida em qualquer um dos idiomas
- **THEN** `ready` SHALL exibir o rótulo de campanha pronta, campanha `error` do novo fluxo encerrada SHALL exibir o rótulo neutro de não concluída, e demais `error` SHALL exibir o rótulo de erro
- **AND** as cores e a regra de exibição SHALL permanecer inalteradas

#### Scenario: Chips de formato são localizados

- **WHEN** a listagem é exibida em `es-419`
- **THEN** os nomes dos formatos, rótulos de estado e explicações SHALL vir do catálogo compartilhado em espanhol neutro LATAM
- **AND** os mesmos estados e regras SHALL permanecer idênticos aos de `pt-BR`

#### Scenario: Nome do produto não herda o idioma da interface

- **WHEN** a listagem é exibida em `es-419`
- **THEN** o nome do produto e o texto alternativo da miniatura SHALL permanecer exatamente como persistidos
- **AND** ambos SHALL declarar `lang=""`

#### Scenario: Datas seguem o idioma sem nova política de fuso

- **WHEN** a listagem é exibida em `pt-BR` ou `es-419`
- **THEN** a data SHALL ser formatada no idioma da interface
- **AND** a política de fuso existente NÃO SHALL ser alterada por esta localização

### Requirement: Rótulos acessíveis localizados

A busca e os selects de período e ordenação SHALL expor nomes acessíveis traduzidos no namespace da listagem, sem depender apenas do placeholder. Chips de status já possuem texto visível e NÃO SHALL receber rótulo de grupo nesta entrega.

#### Scenario: Controles têm nome acessível em es-419

- **WHEN** a listagem é exibida em `es-419`
- **THEN** a busca, o select de período e o select de ordenação SHALL ter nomes acessíveis em espanhol
- **AND** os mesmos controles SHALL manter seus valores e comportamentos

### Requirement: Card único com indicadores de formato para campanha conjunta

A listagem `/campanhas` SHALL exibir no máximo um card por campanha, inclusive quando a campanha for conjunta. O card SHALL exibir sempre os dois chips informativos `1:1` e `9:16`, com estados independentes (`delivered`, `processing`, `absent`, `unknown` ou `unavailable`), usando o componente compartilhado e a mesma linguagem do dashboard e do detalhe. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível. Formato entregue SHALL ter destaque discreto; ausente SHALL permanecer em cinza legível; processamento e indeterminação PODEM usar indicador pequeno, sem frase longa. Estorno conhecido SHALL permanecer distinguível. A ajuda SHALL ser flutuante, fora do fluxo, sem aumentar a altura do card, quebrar a linha dos chips, deslocar a miniatura ou criar overflow horizontal. Os chips NÃO SHALL ser links nem navegar individualmente por formato; cada chip SHALL ser um `<button type="button">` cujo toque abre/fecha apenas a explicação local. NÃO SHALL existir controle “?” separado. A campanha conjunta com os dois formatos solicitados e apenas um entregue SHALL ser apresentada como parcial, sem duplicar o card. Campanha individual NÃO SHALL ser apresentada como parcial: o outro formato é não incluído. `status = error` NÃO SHALL ser convertido em ausência sem evidência explícita; nesse caso o formato SHALL ser `unknown`. As ações existentes de abrir campanha e baixar SHALL ser preservadas.

#### Scenario: Campanha aparece uma única vez

- **WHEN** a listagem contém uma campanha conjunta, individual ou legada
- **THEN** exatamente um card SHALL ser renderizado
- **AND** o card SHALL exibir chips para `1:1` e `9:16`
- **AND** SHALL NOT renderizar um card separado por formato

#### Scenario: Chips são botões de explicação e não navegam

- **WHEN** o usuário toca ou aciona um chip de formato no card
- **THEN** o chip `<button type="button">` SHALL abrir/fechar apenas a ajuda local
- **AND** SHALL NOT haver navegação para `/campanhas/[id]?format=...`
- **AND** SHALL NOT iniciar geração, reserva, modal ou chamada ao provider
- **AND** NÃO SHALL existir controle “?” separado

#### Scenario: Formato entregue tem destaque discreto e nome compacto

- **WHEN** um formato da campanha está `delivered`
- **THEN** o chip SHALL exibir apenas o nome do formato como texto visível
- **AND** SHALL aplicar destaque visual discreto de disponibilidade
- **AND** o estado “Disponível” SHALL permanecer no nome/descrição acessível
- **AND** SHALL NOT exibir o rótulo visível “Disponível” nem ícone redundante

#### Scenario: Ajuda flutuante não desloca o card

- **WHEN** a ajuda de um chip é aberta por hover, foco ou toque
- **THEN** a altura do card, a linha dos chips e a posição da miniatura SHALL permanecer inalteradas
- **AND** a ajuda SHALL aparecer em camada flutuante, sem overflow horizontal
- **AND** SHALL fechar no segundo acionamento do chip-botão, clique/toque fora ou `Escape`
- **AND** NÃO SHALL existir controle “?” separado

#### Scenario: Formato em processamento não inicia geração

- **WHEN** um formato está em processamento
- **THEN** o chip SHALL exibir o estado com indicador próprio
- **AND** SHALL NOT iniciar nova geração, reserva ou chamada ao provider

#### Scenario: Formato ausente é compacto e sem ação

- **WHEN** um formato está ausente
- **THEN** o card SHALL exibir o chip compacto em cinza legível, sem `+`
- **AND** SHALL NOT exibir “Não incluído”/“Não entregue” como texto visível no chip
- **AND** a ausência e o motivo SHALL permanecer no nome/descrição acessível
- **AND** SHALL NOT oferecer modal, confirmação, custo ou ação de geração nesta fatia

#### Scenario: Estorno conhecido permanece distinguível

- **WHEN** um formato ausente tem estorno conhecido
- **THEN** o chip SHALL permanecer visualmente distinto de uma ausência simples
- **AND** o crédito devolvido SHALL permanecer no nome/descrição acessível e na ajuda
- **AND** SHALL NOT esconder o estorno como ausência simples

#### Scenario: Indeterminação não vira “Não gerado”

- **WHEN** o estado do formato é `unknown` ou `unavailable`
- **THEN** o chip SHALL indicar informação indisponível
- **AND** SHALL NOT exibir “Não gerado”

#### Scenario: Entrega parcial é identificada sem esconder o entregue

- **WHEN** uma campanha conjunta teve os dois formatos solicitados e exatamente um está entregue
- **THEN** o card SHALL indicar a entrega parcial
- **AND** o formato entregue SHALL permanecer acessível pelas ações existentes
- **AND** as ações “Abrir” e “Baixar” SHALL permanecer disponíveis conforme o estado atual

#### Scenario: Campanha individual não é parcial

- **WHEN** uma campanha individual está pronta com seu formato persistido entregue
- **THEN** o card SHALL exibir o formato entregue e o outro como não incluído
- **AND** SHALL NOT indicar entrega parcial

#### Scenario: Erro da campanha não vira ausência

- **WHEN** uma campanha individual ou legada está com `status = error` e não há evidência explícita de estorno
- **THEN** o chip do formato persistido SHALL exibir `unknown`
- **AND** SHALL NOT exibir `absent/not_delivered` nem “Não gerado”

#### Scenario: Mesmos nomes e vocabulário do dashboard e detalhe

- **WHEN** a mesma campanha é exibida na listagem, no dashboard e no detalhe
- **THEN** os nomes dos formatos e o vocabulário dos estados SHALL ser os mesmos nas três superfícies
- **AND** um estado `unknown` causado por menor evidência SHALL usar o mesmo rótulo, mesmo que o detalhe tenha mais informação

### Requirement: Miniatura preferida e sempre derivada na listagem conjunta

O card da campanha conjunta SHALL usar miniatura derivada. A miniatura do quadrado SHALL ser preferida quando o quadrado estiver entregue; se apenas o vertical estiver entregue, SHALL ser usada a miniatura do vertical. A ausência da miniatura SHALL renderizar placeholder e SHALL NOT usar o artefato original como fallback.

#### Scenario: Quadrado entregue define a miniatura

- **WHEN** o quadrado está entregue e possui miniatura derivada
- **THEN** o card SHALL exibir a miniatura do quadrado

#### Scenario: Somente vertical entregue usa miniatura vertical

- **WHEN** apenas o vertical está entregue e possui miniatura derivada
- **THEN** o card SHALL exibir a miniatura do vertical

#### Scenario: Sem miniatura não usa original

- **WHEN** a miniatura derivada está ausente ou a assinatura falha
- **THEN** o card SHALL exibir placeholder
- **AND** SHALL NOT assinar ou exibir a arte original
