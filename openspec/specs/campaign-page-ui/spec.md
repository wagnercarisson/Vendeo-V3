# Campaign Page UI

> Synced from `fase-17-edicao-publication-copy` (MODIFIED), then `fase-18-app-shell-ui-base-rotas` (MODIFIED), then `fase-19-onboarding-estados-vazios` (MODIFIED + REMOVED), then `fase-37-1-approval-gate-candidata-unica` (ADDED — estado de revisão da arte, D2/decisões 3/12), then `fase-37-2-correcao-unica-por-nao-conformidade` (MODIFIED + ADDED — dois botões [Aprovar arte]/[Informar problema], estado `regenerating` com progresso da v2 e v2 candidata). Route migrated from `/campanha/[id]` to `/campanhas/[id]`. No-store redirect replaced by `notFound()`. Emoji icons replaced by Lucide. Kit de Publicação uses Card + Badge components. Navigation links updated.

## Purpose

Server Component (`/campanha/[id]`) com autenticação, ownership via RLS, e Client Component com 4 estados visuais: ready, generating, error, stale generating.

## Requirements

### Requirement: Server Component com auth e ownership

O Server Component em `src/app/(app)/campanhas/[id]/page.tsx` SHALL:
- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, chamar `notFound()` em vez de `redirect("/loja")`
- Chamar `getCampaignForDisplay(id)` para carregar a campanha via RLS
- Se `getCampaignForDisplay` retornar `null`, chamar `notFound()`
- Calcular `displayStatus` server-side: `"ready"` | `"generating"` | `"stale"` | `"error"` usando `campaign.status` e `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000` para detectar stale
- Pré-computar `downloadUrl = "/api/campaign/${id}/download"` para o Client Component não precisar montar URLs
- Passar os dados da campanha para o Client Component como props serializáveis, incluindo `displayStatus`, `downloadUrl` e `updatedAt`

#### Scenario: Usuário autenticado acessa campanha própria

- **WHEN** um usuário autenticado acessa `/campanhas/{id}` onde `id` é uma campanha da sua loja
- **THEN** o Server Component carrega a campanha e renderiza o Client Component com os dados

#### Scenario: Usuário autenticado sem loja recebe 404

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas/{id}`
- **THEN** `notFound()` é chamado → página 404
- **AND** o sistema NÃO redireciona para `/loja`

#### Scenario: Campanha não encontrada ou de outro tenant

- **WHEN** um usuário autenticado acessa `/campanhas/{id}` onde `id` não existe ou pertence a outra loja
- **THEN** `notFound()` é chamado → página 404

#### Scenario: Usuário não autenticado

- **WHEN** um usuário não autenticado acessa `/campanhas/{id}`
- **THEN** o middleware redireciona para `/login` (ou o `requirePageUser` retorna 401)

### Requirement: Estado ready com edição de publication copy

Quando `displayStatus === "ready"`, o Client Component SHALL exibir:
- A imagem final da campanha (src da signed URL gerada server-side — `imageUrl` passada como prop)
- O nome do produto
- A data de criação formatada
- Botão "Baixar Original" que linka para `downloadUrl` (pré-computado server-side)

O Client Component SHALL receber `campaignId: string` como prop para montar a URL do PATCH.

**Kit de Publicação (seção separada):**
- Seção usa `<Card>` como container, título local `<h2>`, e `<Badge variant="ready" icon={CheckCheck}>` se `isPublicationCopyEdited` é `true`
- Caption, hashtags, cta_post em modo visualização (padrão) com botão "Editar" (Lucide `Pencil`)

**Modo edição (após clicar "Editar"):**
- Caption: textarea preenchido com valor atual
- Hashtags: textarea "uma por linha" (normalizado como array no save)
- CTA: input preenchido com valor atual
- Botão "Salvar" (Lucide `Save`) — chama PATCH para `/api/campaign/[campaignId]/publication-copy` usando a prop `campaignId`
- Botão "Restaurar original" (Lucide `RotateCcw`) — confirmação → PATCH `{ restore: true }` para mesma URL
- Botão "Cancelar" (Lucide `X`) — descarta alterações locais, volta ao modo visualização

#### Scenario: Client recebe campaignId para montar PATCH URL

- **WHEN** o Client Component é renderizado com `displayStatus === "ready"`
- **THEN** a prop `campaignId` está disponível para montar a URL `/api/campaign/[campaignId]/publication-copy`

#### Scenario: Ready com publication copy e badge Editado

- **WHEN** `displayStatus` é `"ready"` e `isPublicationCopyEdited` é `true`
- **THEN** exibe imagem, caption + hashtags + cta_post, badge "Editado" ao lado do título, e botão "Editar"

#### Scenario: Ready sem badge Editado

- **WHEN** `displayStatus` é `"ready"` e `isPublicationCopyEdited` é `false`
- **THEN** exibe imagem, caption + hashtags + cta_post do snapshot, sem badge "Editado", e botão "Editar"

#### Scenario: Botão Editar entra em modo edição

- **WHEN** usuário clica "Editar"
- **THEN** caption vira textarea, hashtags vira textarea (uma por linha), cta vira input, todos preenchidos com valores atuais

#### Scenario: Botão Salvar chama PATCH e atualiza UI

- **WHEN** usuário clica "Salvar" com dados válidos
- **THEN** PATCH é chamado → se 200, estado local atualiza → volta ao modo visualização com novos dados

#### Scenario: Botão Restaurar original com confirmação

- **WHEN** usuário clica "Restaurar original"
- **THEN** confirmação "Restaurar texto original da IA?" → se sim, PATCH com `{ restore: true }` → resposta retorna snapshot → UI atualiza com snapshot → volta ao modo visualização

#### Scenario: Botão Cancelar descarta alterações

- **WHEN** usuário clica "Cancelar"
- **THEN** descarta alterações locais, volta ao modo visualização sem chamar API

### Requirement: Estados de loading e erro no salvamento

O sistema SHALL adicionar estados de loading e erro durante a operação de salvamento.

#### Scenario: Loading durante requisição

- **WHEN** requisição PATCH está em andamento
- **THEN** botões "Salvar" e "Restaurar" estão desabilitados com texto "Salvando..."

#### Scenario: Erro após falha do PATCH

- **WHEN** requisição PATCH retorna erro
- **THEN** exibe toast/aviso "Não foi possível salvar. Tente novamente."
- **AND** modo edição é mantido com dados não salvos

### Requirement: Estado generating

Quando `displayStatus === "generating"`, o Client Component SHALL exibir:
- Spinner/loader animado
- Mensagem "Sua campanha está sendo gerada..."
- Polling automático: `router.refresh()` a cada 5 segundos
- O polling SHALL parar quando o componente for desmontado (cleanup no `useEffect`)

#### Scenario: Generating com polling

- **WHEN** `displayStatus` é `"generating"`
- **THEN** exibe spinner + mensagem + inicia polling a cada 5s via `router.refresh()`

### Requirement: Estado stale generating

Quando `displayStatus === "stale"`, o Client Component SHALL exibir:
- Mensagem "Geração interrompida. Tente novamente."
- CTA "Criar Nova Campanha" que navega para `/`

O cálculo de stale é feito server-side em `page.tsx` usando `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000` — o Client Component apenas consome o valor pré-computado `displayStatus`.

#### Scenario: Stale generating exibido como erro

- **WHEN** `displayStatus` é `"stale"`
- **THEN** exibe mensagem de geração interrompida + link para nova campanha

### Requirement: Estado error

Quando `displayStatus === "error"`, o Client Component SHALL exibir:
- Mensagem amigável explicando que a geração falhou
- CTA "Criar Nova Campanha" que navega para `/`
- Não exibir imagem, caption ou botão de download

#### Scenario: Erro com mensagem

- **WHEN** `displayStatus` é `"error"`
- **THEN** exibe mensagem de falha + CTA para criar nova campanha

### Requirement: Design tokens applied

All inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes in the migrated campaign page SHALL be replaced with design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`).

#### Scenario: Tokens replace raw Tailwind colors

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens instead of raw Tailwind color classes

### Requirement: Navigation links updated

The navigation links in the campaign page SHALL be updated:
- Link "← Campanhas" SHALL point to `/campanhas` (instead of `/minhas-campanhas`)

#### Scenario: Link "← Campanhas" presente na página individual

- **WHEN** um usuário acessa `/campanhas/[id]`
- **THEN** o topo da página exibe um link "← Campanhas" apontando para `/campanhas`

### Requirement: Middleware matcher

O sistema SHALL incluir `/campanhas/:path*` no `config.matcher` em `src/middleware.ts` para garantir que a sessão seja renovada via `updateSession` ao acessar páginas de campanha. O antigo `/campanha/:path*` SHALL ser removido do matcher (redirecionado via next.config.ts).

#### Scenario: Matcher inclui /campanhas/:path*

- **WHEN** o middleware é carregado
- **THEN** o `config.matcher` inclui `/campanhas/:path*`

### Requirement: Estado de revisão da arte (campanha pendente)

O sistema SHALL, quando a campanha está `ready` e o estado de aprovação é **`pending`** (flag `campaign_approval_enabled` ligada, candidata nova sem aprovação), renderizar a **tela de revisão** em vez da entrega:

- O Server Component (`/campanhas/[id]/page.tsx`) SHALL, para campanhas `ready`: ler `isCampaignApprovalEnabled()` + `listArtVersions(id)`, derivar `computeApprovalState(campaign, versions, flagEnabled)` e passar `candidateImageUrl`/`candidateVersionId` (da **candidata ativa** — `asset_status='active'`) via props (base F37.1).
- A revisão SHALL exibir a arte da candidata ativa **sem** botão de download e **sem** Kit de Publicação/copy.
- **Dois botões (F37.2, R1):** botão primário **[Aprovar arte]** (dispara `POST /api/campaign/[id]/approve` com o `versionId` da candidata) e botão secundário **[Informar problema]** (abre o modal de relato — capability `campaign-problem-report`) quando a candidata é a **v1** e ainda há oportunidade; ao aprovar, `router.refresh()` → a página passa a exibir a entrega.
- **V2 candidata (F37.2, R5):** quando a v2 é a candidata (`pending`, v1 `superseded`), a revisão exibe **[Aprovar arte]** aprovando a **v2**, **sem** [Informar problema] e **sem** retorno à v1.
- **Sem histórico recuperável (decisão 12):** apenas a candidata ativa é exibida; nenhuma versão anterior é selecionável/recuperável.
- Microcopy PT-BR, estados de loading/erro, touch ≥ 44px, a11y, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`), imagem sem recorte (`object-contain`).

#### Scenario: Campanha pendente exibe revisão sem download/copy

- **WHEN** uma campanha `ready` com estado de aprovação `pending` é aberta
- **THEN** a página exibe a tela de revisão com a imagem da candidata ativa
- **AND** não há botão "Baixar Original" nem Kit de Publicação/copy
- **AND** há os botões [Aprovar arte] e [Informar problema]

#### Scenario: Aprovar e liberar libera a entrega

- **WHEN** o lojista clica em "Aprovar arte"
- **THEN** o `POST /api/campaign/[id]/approve` é chamado com o `versionId` da candidata
- **AND** após o sucesso a página passa a exibir a entrega (arte + copys + download)

#### Scenario: Informar problema abre o modal

- **WHEN** o lojista clica em [Informar problema] na revisão `pending` (v1)
- **THEN** o modal de relato abre (preview, orientação, campo obrigatório, Enviar/Cancelar)

#### Scenario: V2 candidata exibe apenas Aprovar arte

- **WHEN** a v2 é a candidata (`pending`, v1 `superseded`)
- **THEN** a revisão exibe [Aprovar arte] (aprova a v2)
- **AND** não oferece [Informar problema] nem retorno à v1

#### Scenario: Somente a candidata ativa é exibida

- **WHEN** a revisão mostra a arte
- **THEN** exibe apenas a candidata ativa (`asset_status='active'`)
- **AND** nenhuma versão anterior é selecionável/recuperável

#### Scenario: Aprovada / legacy / flag off mantêm a entrega atual

- **WHEN** uma campanha está `approved`, `legacy` (sem versões, flag on) ou com a flag desligada (`not_enabled`)
- **THEN** a página renderiza a entrega como hoje (arte + Kit de Publicação + download)

#### Scenario: Mobile e a11y da revisão

- **WHEN** a tela de revisão é exibida em tela estreita (320px/375px)
- **THEN** a imagem é exibida sem recorte (`object-contain`) e os controles têm touch target ≥ 44px, sem scroll horizontal

### Requirement: Estado regenerating com progresso da v2

O sistema SHALL renderizar um estado dedicado quando `computeApprovalState` deriva **`regenerating`** (candidata ativa com `correction_in_progress=true` — RPC de consumo marcou; F37.2 R3/R7):

- A página (`/campanhas/[id]`) SHALL exibir **progresso da v2** (sem botão de download, sem Kit de Publicação/copy e **sem** [Aprovar arte]/[Informar problema] ativos) enquanto a correção está em andamento.
- O Client Component NÃO cai no `ReadyView` durante `regenerating` (gap F37.1 — o estado era inalcançável; agora é exercitado).
- Ao concluir (v2 persistida e candidata), `router.refresh()` faz a página derivar `pending` (v2) → [Aprovar arte].
- Microcopy PT-BR de processamento (ex.: "Corrigindo a arte..."), a11y e tema dark.

#### Scenario: Regenerating exibe progresso sem actions de entrega/approve

- **WHEN** a candidata ativa tem `correction_in_progress=true`
- **THEN** a página exibe o estado de regeneração (progresso da v2)
- **AND** não há download/copy, [Aprovar arte] ou [Informar problema] disponíveis

#### Scenario: V2 concluída volta a derivar pending e permite aprovar

- **WHEN** a v2 é persistida (v1 `superseded`, v2 `active`/`pending`, `correction_in_progress=false`)
- **THEN** após refresh a página deriva `pending` (v2) e exibe [Aprovar arte]

### Requirement: Localização da interface da campanha pronta (pt-BR/es-419)

O sistema SHALL localizar os textos fixos da **entrega pronta** da campanha em `/campanhas/[id]` para `pt-BR` e `es-419`, reutilizando `getUiRenderContext` e `SupportedUiLocale` sem criar resolvedor concorrente nem alterar o timeout central. Os textos SHALL vir de um namespace próprio e isolado da rota, não reexportado pelo catálogo global do shell. Os chips de formato SHALL ser localizados em todos os estados da página pelo catálogo compartilhado, sem exigir a localização do restante da interface fora da entrega pronta.

- A localização SHALL derivar das **mesmas condições** que decidem qual view é renderizada. `ReadyView` (legado `ready`, inclusive `pending` sem `candidateImageUrl`/`candidateVersionId`) e `NewFlowDeliveredView` (`newFlow.state === "delivered"`) SHALL ser localizados; `CampaignApprovalView` (`pending` com candidata) e `RegeneratingView` NÃO SHALL ser localizados, exceto pelos chips de formato.
- O contêiner que inclui header/breadcrumb e a view pronta SHALL declarar `lang="es-419"` quando o locale da interface for `es-419`, de modo que header e breadcrumb traduzidos também estejam cobertos.
- Os chips de formato e suas explicações SHALL declarar `lang="es-419"` na própria região quando o locale for `es-419`, inclusive em `generating`, `stale`, `error`, `running`, `refunded`, `unknown`, `regenerating` e aprovação com candidata. Esses estados NÃO SHALL receber um wrapper `lang="es-419"` novo no restante da página.
- Nome do produto, caption, hashtags, CTA, título da copy, data, imagem e arquivo SHALL NOT ser traduzidos, regenerados ou recalculados. Conteúdo persistido SHALL receber `lang=""` para não herdar o idioma da interface.
- Textos de interface que permanecem em português (modo de edição do Kit, recuperação de copy e feedback de falha/cancelamento da copy) SHALL NOT ser traduzidos nesta entrega e SHALL receber `lang="pt-BR"` quando exibidos sob interface `es-419`. O `confirm()` nativo do navegador não é marcável.
- O rótulo de criação SHALL ser traduzido, mas a data SHALL manter o formato atual `dd/mm/aaaa`.
- A ação de copiar SHALL continuar escrevendo exatamente o conteúdo original no clipboard, com feedback `Copiado!` em pt-BR e `¡Copiado!` em es-419; a ação de baixar SHALL continuar usando `downloadUrl` e entregando o mesmo arquivo.
- Estados fora do recorte (`generating`, `stale`, `error`, `running`, `refunded`, `unknown`, `regenerating`, aprovação com candidata) NÃO SHALL ter os demais textos traduzidos nesta entrega; somente os chips de formato e suas explicações usam o catálogo localizado.

#### Scenario: es-419 na entrega pronta

- **WHEN** um usuário com `uiLocale=es-419` abre uma campanha que renderiza `ReadyView` ou `NewFlowDeliveredView`
- **THEN** breadcrumb, título de fallback, rótulo de criação, Kit de Publicación, badge, aviso fixo, ação de copiar, chips de formato e `Descargar original` aparecem em espanhol neutro LATAM
- **AND** o contêiner da página declara `lang="es-419"`

#### Scenario: pt-BR preservado

- **WHEN** um usuário com `uiLocale=pt-BR` abre a mesma entrega pronta
- **THEN** os textos fixos existentes são exatamente os anteriores
- **AND** os novos nomes e estados dos chips de formato seguem o catálogo aprovado desta change
- **AND** nenhum `lang="es-419"` é declarado

#### Scenario: pending sem candidata continua em ReadyView e é localizado

- **WHEN** uma campanha legada `ready` tem aprovação `pending` sem `candidateImageUrl`/`candidateVersionId`
- **THEN** a página continua renderizando `ReadyView`
- **AND** a interface da entrega é localizada conforme o locale

#### Scenario: chips são localizados em estados fora da entrega pronta

- **WHEN** a interface está em `es-419` e a página exibe `generating`, `running`, `refunded`, `unknown`, `regenerating` ou aprovação com candidata
- **THEN** nomes, estados e explicações dos chips de formato SHALL aparecer em espanhol neutro LATAM
- **AND** o restante desses estados SHALL permanecer em português como antes
- **AND** nenhum wrapper `lang="es-419"` novo SHALL ser aplicado fora da região dos chips

#### Scenario: conteúdo persistido não é traduzido nem herda espanhol

- **WHEN** a interface está em `es-419`
- **THEN** nome do produto, caption, hashtags, CTA e título da copy permanecem idênticos
- **AND** esses valores são marcados com `lang=""`
- **AND** copiar entrega o texto exato e baixar entrega o mesmo arquivo

#### Scenario: interface não traduzida sob es-419

- **WHEN** a interface está em `es-419` e a entrega pronta exibe modo de edição, recuperação de copy ou feedback de falha/cancelamento
- **THEN** esses textos permanecem em português
- **AND** são marcados com `lang="pt-BR"`

#### Scenario: estados fora do recorte mantêm o restante como antes

- **WHEN** a página exibe `generating`, `stale`, `error`, `running`, `refunded`, `unknown`, `regenerating` ou aprovação com candidata
- **THEN** os textos e o comportamento desses estados permanecem como antes, exceto pelos chips de formato
- **AND** nenhum wrapper `lang="es-419"` novo é aplicado ao restante da página

### Requirement: Detalhe da campanha conjunta com acesso individual por formato

O detalhe `/campanhas/[id]` SHALL reconhecer a campanha conjunta e exibir os formatos `1:1` e `9:16` por meio dos chips compartilhados, sempre presentes, com estados independentes e seleção por `?format=1:1|9:16`. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível e na ajuda. O formato ativo SHALL ter borda/fundo distintos de um formato apenas disponível, sem badge adicional. Cada formato entregue SHALL oferecer preview e download próprios e ser um link `<a>` cujo toque seleciona em um único toque; formato não entregue/excepcional SHALL ser um `<button type="button">` cujo toque abre/fecha apenas a explicação, sem navegar. A copy SHALL ser exibida uma única vez e compartilhada pelos dois formatos. O formato em processamento SHALL usar indicador pequeno e manter o acompanhamento do servidor sem iniciar geração. O formato ausente SHALL permanecer em cinza legível; quando o crédito estiver comprovadamente devolvido, o estorno SHALL permanecer distinguível na descrição acessível/ajuda. O formato desconhecido SHALL usar indicador pequeno de dúvida e exibir verificação/suporte, sem recuperação de imagem e sem “Não gerado”. A ajuda SHALL ser flutuante, fora do fluxo, sem deslocar a arte ou criar overflow; o espaçamento entre chips e arte SHALL ser consistente. NÃO SHALL existir controle “?” separado. Formato não entregue NÃO SHALL receber link de preview/download nem ação de geração. O tratamento estrito de `?format=` SHALL ser preservado: inválido, vazio, duplicado ou não entregue NÃO SHALL cair silenciosamente no preferido.

#### Scenario: Detalhe conjunto mostra os dois chips

- **WHEN** o lojista abre o detalhe de uma campanha conjunta
- **THEN** o detalhe SHALL exibir chips para `1:1` e `9:16`
- **AND** a copy compartilhada SHALL aparecer uma única vez
- **AND** cada formato entregue SHALL ter preview e download individuais

#### Scenario: Formato escolhido na URL é pré-selecionado e destacado

- **WHEN** o detalhe é aberto com `?format=1:1` ou `?format=9:16`
- **THEN** o formato correspondente SHALL estar selecionado e ativo
- **AND** o chip ativo SHALL ter borda/fundo distintos de um chip apenas disponível
- **AND** SHALL NOT exibir badge visível “Selecionado”
- **AND** a seleção SHALL permanecer acessível
- **AND** o outro formato entregue SHALL continuar disponível para seleção

#### Scenario: Chips compactos e ajuda flutuante no detalhe

- **WHEN** o detalhe exibe os chips e a ajuda é aberta
- **THEN** o texto visível SHALL ser apenas o nome do formato
- **AND** a altura/posição da arte e dos chips SHALL permanecer inalterada
- **AND** a ajuda SHALL aparecer fora do fluxo, sem overflow e respeitando a viewport
- **AND** SHALL fechar no segundo acionamento, clique/toque fora ou `Escape`
- **AND** o espaçamento entre chips e arte SHALL ser consistente

#### Scenario: Parâmetro inválido falha fechado

- **WHEN** o detalhe é aberto com `?format=` inválido, vazio, duplicado ou de formato não entregue
- **THEN** SHALL NOT selecionar o formato preferido silenciosamente
- **AND** SHALL NOT assinar arte nem liberar preview/download do formato não entregue

#### Scenario: Entrega parcial não esconde o formato entregue

- **WHEN** o quadrado está entregue e o vertical está ausente com crédito devolvido
- **THEN** o detalhe SHALL exibir o quadrado com preview e download
- **AND** SHALL manter o vertical ausente e o crédito devolvido na descrição acessível e na ajuda
- **AND** SHALL NOT ocultar ou invalidar o quadrado

#### Scenario: Formato em processamento mantém acompanhamento

- **WHEN** um formato está em processamento
- **THEN** o chip SHALL usar indicador pequeno próprio de processamento
- **AND** o detalhe SHALL continuar acompanhando o estado persistido
- **AND** SHALL NOT iniciar nova geração

#### Scenario: Formato desconhecido não oferece recuperação de imagem

- **WHEN** um formato tem resultado desconhecido ou indisponível
- **THEN** o chip SHALL usar indicador pequeno de dúvida
- **AND** o detalhe SHALL exibir verificação/suporte
- **AND** SHALL NOT oferecer recuperação de imagem, nova geração ou o texto “Não gerado”

#### Scenario: Formato ausente não oferece geração nesta fatia

- **WHEN** um formato está ausente
- **THEN** o detalhe SHALL exibir chip compacto cinza legível, sem `+`
- **AND** SHALL NOT exibir “Não entregue”/“Não incluído” como texto visível no chip
- **AND** SHALL NOT oferecer modal, confirmação, custo ou ação de geração nesta fatia
- **AND** SHALL NOT receber link de preview ou download

### Requirement: Detalhe de campanha individual e legada com os dois formatos

O detalhe de campanha individual ou legada SHALL exibir os dois chips compartilhados sem inventar um segundo formato entregue. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível e na ajuda flutuante. O formato persistido SHALL respeitar o estado e os gates atuais da campanha. O outro formato SHALL permanecer em cinza legível como não incluído, sem `+`, sem promessa de geração e sem link de preview/download. Campanhas individuais e legadas SHALL manter seu acesso atual à arte e ao download do formato existente. O detalhe SHALL refletir `processing`, `refunded`, `unknown` e `unavailable` de forma honesta, sem “Não gerado” para indeterminação. `error` e `stale` NÃO SHALL comprovar ausência: sem evidência explícita de estorno, o formato SHALL ser `unknown`. Aprovação `pending` com candidata SHALL manter o formato como `delivered`, sem ativo e com o gate existente; `regenerating` SHALL exibir `processing`, sem ativo. No detalhe, o formato entregue **com `href`** SHALL ser um link `<a>` cujo toque seleciona em um único toque; o formato entregue sem href e o formato não entregue/excepcional SHALL ser um `<button type="button">` cujo toque abre/fecha apenas a explicação, sem navegar, gerar, continuar, reservar ou cobrar. NÃO SHALL existir controle “?” separado. Nenhuma leitura adicional SHALL ser feita para os chips.

#### Scenario: Legado quadrado pronto

- **WHEN** uma campanha legada tem snapshot objeto sem chaves de formato e está pronta
- **THEN** o chip `1:1` SHALL exibir nome compacto e destaque discreto de disponibilidade
- **AND** o chip `9:16` SHALL permanecer em cinza legível, sem rótulo visível de estado
- **AND** o estado “não incluído” SHALL permanecer acessível na descrição/ajuda
- **AND** o acesso atual à arte e ao download do quadrado SHALL permanecer inalterado

#### Scenario: Vertical individual pronto

- **WHEN** uma campanha individual `9:16` está pronta
- **THEN** o chip `9:16` SHALL exibir nome compacto, destaque discreto e borda/fundo de ativo
- **AND** SHALL NOT exibir badge “Selecionado”
- **AND** o chip `1:1` SHALL permanecer em cinza legível como não incluído
- **AND** SHALL NOT ser oferecida seleção de `1:1`

#### Scenario: Vertical por expansão não promete o quadrado

- **WHEN** uma campanha vertical foi produzida por expansão a partir de uma base quadrada
- **THEN** o chip `9:16` SHALL refletir a entrega vertical
- **AND** o chip `1:1` SHALL permanecer em cinza legível como não incluído
- **AND** a base quadrada NÃO SHALL ser apresentada como formato `1:1` entregue

#### Scenario: Geração em andamento

- **WHEN** a campanha individual está em geração
- **THEN** o chip do formato persistido SHALL usar indicador pequeno de processamento
- **AND** SHALL NOT parecer entregue nem iniciar nova geração

#### Scenario: Estorno conhecido no novo fluxo

- **WHEN** a operação individual persistida está estornada
- **THEN** o chip do formato persistido SHALL permanecer distinguível de ausência simples
- **AND** o crédito devolvido SHALL permanecer na descrição acessível e na ajuda
- **AND** o outro formato SHALL continuar como não incluído

#### Scenario: Erro ou staleness não comprovam ausência

- **WHEN** a campanha individual ou legada está `error` ou `stale` e não há evidência explícita de estorno
- **THEN** o chip do formato persistido SHALL usar indicador pequeno de `unknown`
- **AND** SHALL NOT exibir `absent/not_delivered` nem “Não gerado”
- **AND** SHALL NOT realizar consulta adicional para descobrir o motivo

#### Scenario: Aprovação pendente mantém o gate existente

- **WHEN** a campanha está pronta, mas a aprovação está `pending` com candidata
- **THEN** o chip do formato persistido SHALL permanecer com destaque discreto de disponibilidade
- **AND** NÃO SHALL receber estado ativo nem ação nova
- **AND** preview e download SHALL continuar governados pelo gate de aprovação existente

#### Scenario: Regeneração indica processamento

- **WHEN** a campanha está em `regenerating`
- **THEN** o chip do formato persistido SHALL usar indicador pequeno de processamento
- **AND** NÃO SHALL receber estado ativo nem ação nova
- **AND** SHALL NOT iniciar nova geração

#### Scenario: Resultado indeterminado

- **WHEN** o resultado da operação individual é desconhecido ou a leitura é indeterminada
- **THEN** o chip do formato persistido SHALL usar indicador pequeno de dúvida
- **AND** SHALL NOT exibir “Não gerado” nem oferecer recuperação de imagem

#### Scenario: Ajuda e seleção usam a semântica correta

- **WHEN** o usuário aciona um chip no detalhe
- **THEN** chip entregue (`<a>`) SHALL selecionar o formato em um único toque, sem abrir ajuda no primeiro toque
- **AND** chip não entregue/excepcional (`<button type="button">`) SHALL abrir/fechar apenas a explicação, sem navegar/gerar
- **AND** a ajuda flutuante SHALL abrir/fechar sem deslocar a arte
- **AND** NÃO SHALL existir controle “?” separado

#### Scenario: Snapshot inválido não vira 1:1

- **WHEN** o snapshot é nulo, malformado, contém contrato desconhecido ou par incoerente
- **THEN** os dois chips SHALL indicar indisponibilidade ou indeterminação
- **AND** SHALL NOT aplicar fallback para `1:1`
