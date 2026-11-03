## ADDED Requirements

### Requirement: Rota pública `/floriculturas` com composição aprovada

O sistema SHALL disponibilizar a página pública `/floriculturas` em `pt-BR`, como Server Component em `src/app/(marketing)/floriculturas/page.tsx`, sem exigir autenticação e sem layout próprio.

A página SHALL apresentar, nesta ordem: abertura com H1, texto de abertura e primeiro CTA; demonstração com título, foto enviada, campanha criada, rótulos e aviso demonstrativo; explicação da transformação; segundo bloco sobre criação de posts; funcionamento em quatro passos; encerramento com chamada final, texto de apoio e segundo CTA; rodapé com links legais.

A página SHALL ter um único `h1` e hierarquia de títulos coerente (`h2` por bloco, `h3` nos passos).

#### Scenario: Página renderiza a composição aprovada
- **WHEN** `/floriculturas` é acessada sem sessão
- **THEN** a página SHALL ser servida sem redirect para `/login`
- **AND** os blocos SHALL aparecer na ordem aprovada
- **AND** SHALL existir exatamente um `h1`

#### Scenario: Dois CTAs com o mesmo fluxo
- **WHEN** a página é renderizada
- **THEN** SHALL existir um CTA imediatamente após a abertura
- **AND** SHALL existir um segundo CTA no encerramento
- **AND** ambos SHALL usar o mesmo componente e o mesmo fluxo de acesso

#### Scenario: Mobile não empurra a mensagem principal
- **WHEN** a página é exibida em viewport mobile
- **THEN** H1, texto de abertura e primeiro CTA SHALL aparecer antes das imagens da demonstração
- **AND** não SHALL haver overflow horizontal

### Requirement: Copy aprovada sem acréscimos

A página SHALL usar exatamente a copy aprovada pelo responsável para H1, texto de abertura, título da demonstração, rótulos das imagens, explicação, título e texto do segundo bloco, título e itens do funcionamento, chamada final e texto de apoio.

A página SHALL NOT acrescentar blocos ou frases de advertência comercial, incluindo “não promete vendas”, “não mede tempo de geração” e “foto criada com IA”. Restrições internas de planejamento SHALL permanecer fora da copy pública.

A página SHALL NOT exibir tabela de entrada ou qualquer dado de geração não fornecido.

A proibição de preço, oferta ou selo refere-se a **acrescentar à página informações não aprovadas**. Ela SHALL NOT ser interpretada como remoção, recorte ou ocultação de elementos que já fazem parte da imagem aprovada da campanha — por exemplo, o selo “Destaque da Semana” impresso na arte. A imagem aprovada SHALL ser exibida integralmente, sem corte.

#### Scenario: Copy aprovada sem desvios
- **WHEN** a página renderizada é comparada à copy aprovada
- **THEN** os textos SHALL corresponder ao conteúdo aprovado
- **AND** não SHALL existir bloco de advertência comercial adicional

#### Scenario: Nenhuma informação não aprovada acrescentada à página
- **WHEN** a página é revisada
- **THEN** não SHALL existir tabela de entrada, preço, oferta ou selo **como texto novo da página**
- **AND** nenhum texto SHALL afirmar dados de geração não fornecidos

#### Scenario: Imagem aprovada exibida integralmente
- **WHEN** a campanha aprovada é exibida
- **THEN** elementos internos da arte, como o selo “Destaque da Semana”, SHALL permanecer visíveis
- **AND** a imagem SHALL NOT ser recortada, coberta ou tratada para remover conteúdo

### Requirement: Texto gerado exibido em HTML ao lado da explicação

A página SHALL exibir, na mesma seção da explicação, um card com o título aprovado “Além da arte, o texto para acompanhar sua publicação.” e, dentro dele, o conteúdo exato gerado para a campanha demonstrativa: título, legenda, hashtags e chamada final.

O card SHALL ser renderizado como texto HTML, não como captura de tela da interface, e SHALL NOT reproduzir botões “Copiar” nem qualquer controle operacional do aplicativo.

No desktop, o card SHALL ficar ao lado do parágrafo de explicação; no mobile, logo abaixo dele. O card SHALL ser visualmente secundário em relação ao par de imagens.

#### Scenario: Conteúdo gerado exibido integralmente
- **WHEN** a página é renderizada
- **THEN** o card SHALL conter o título “Além da arte, o texto para acompanhar sua publicação.”
- **AND** SHALL conter o título “Orquídea Phalaenopsis: beleza em cada cor”
- **AND** SHALL conter a legenda, as quatro hashtags e a chamada final exatas fornecidas

#### Scenario: Texto em HTML, não captura de interface
- **WHEN** o HTML da página é inspecionado
- **THEN** o card SHALL ser composto por elementos de texto
- **AND** SHALL NOT conter imagem do texto gerado nem botão “Copiar”

#### Scenario: Card secundário e responsivo
- **WHEN** a página é exibida em desktop e mobile
- **THEN** o card SHALL aparecer ao lado do parágrafo no desktop e abaixo dele no mobile
- **AND** SHALL NOT competir visualmente com o par foto/campanha

### Requirement: Caminho secundário para conhecer o Vendeo

A abertura SHALL oferecer um link secundário “Conheça o Vendeo” apontando para `/`, na mesma aba, sem âncora, de modo a abrir o topo da home.

O link SHALL ficar abaixo do CTA principal de acesso, mantendo o CTA como ação de maior destaque. O encerramento SHALL manter apenas o CTA de acesso, sem repetir o link secundário. A página SHALL NOT alterar a home nem os CTAs dos demais consumidores.

#### Scenario: Link secundário na abertura
- **WHEN** a página é renderizada
- **THEN** SHALL existir um link “Conheça o Vendeo” com `href="/"`
- **AND** SHALL estar posicionado abaixo do CTA principal
- **AND** SHALL NOT apontar para `/#acesso`

#### Scenario: Encerramento sem link secundário
- **WHEN** o bloco de encerramento é revisado
- **THEN** SHALL conter apenas o CTA de acesso
- **AND** SHALL NOT repetir o link “Conheça o Vendeo”

### Requirement: Aviso demonstrativo único e discreto

A página SHALL exibir uma única vez o texto aprovado “As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas”, junto ao exemplo, em tipografia secundária e sem competir com o conteúdo principal.

A página SHALL NOT repetir o aviso no rodapé nem apresentar o exemplo como depoimento, caso real, cliente ou resultado comercial.

#### Scenario: Aviso aparece uma única vez
- **WHEN** a página é renderizada
- **THEN** o texto do aviso demonstrativo SHALL aparecer exatamente uma vez
- **AND** SHALL estar visualmente associado ao par de imagens do exemplo

#### Scenario: Exemplo não é apresentado como prova real
- **WHEN** o conteúdo é revisado
- **THEN** nenhum texto SHALL descrever a floricultura Donna Flor como cliente real ou o exemplo como depoimento
- **AND** nenhum resultado comercial SHALL ser atribuído ao exemplo

### Requirement: Conteúdo demonstrativo estático e par aprovado

A página SHALL usar somente o par aprovado: a foto sintética da orquídea roxa no balcão e a campanha da floricultura fictícia Donna Flor gerada no Vendeo.

A página SHALL NOT chamar API de geração, produzir arte ao vivo, executar geração paga ou depender de dados de campanha do usuário.

A página SHALL NOT reutilizar o par anterior `identidade-floricultura.webp` (“Dona Flor”, buquê de rosas).

#### Scenario: Página não invoca geração
- **WHEN** a página é carregada e utilizada
- **THEN** nenhuma chamada a provider ou API de geração SHALL ocorrer
- **AND** nenhum crédito SHALL ser consumido

#### Scenario: Apenas o par aprovado é exibido
- **WHEN** os assets da página são revisados
- **THEN** a foto e a campanha SHALL corresponder ao último par aprovado
- **AND** o asset `identidade-floricultura.webp` SHALL NOT ser referenciado pela página

### Requirement: Entrega responsiva com duas variantes por imagem

Cada uma das duas imagens SHALL ser entregue em duas variantes WebP — uma menor e uma maior — com `srcset` e `sizes`, proporção original preservada e sem upscale. A foto SHALL manter a proporção da origem (1312×1199) e a campanha SHALL permanecer 1:1 sem corte.

A imagem identificada como LCP SHALL NOT receber `loading="lazy"`. A prioridade de carregamento SHALL ser definida pela medição no navegador, não pela área aparente: a hipótese inicial de que a campanha seria o LCP foi **refutada** — o elemento medido foi o `h1` em desktop (1440×900) e mobile (390×844). Portanto, nenhuma imagem da demonstração recebe prioridade alta; ambas permanecem `eager`.

A implementação SHALL registrar as dimensões, os pesos finais dos arquivos entregues e a medição de LCP observada.

#### Scenario: Duas variantes por imagem
- **WHEN** os assets entregues são inspecionados
- **THEN** SHALL existir exatamente uma variante menor e uma maior para a foto
- **AND** SHALL existir exatamente uma variante menor e uma maior para a campanha
- **AND** todas SHALL ser WebP com as dimensões contratadas e peso menor ou igual ao original correspondente

#### Scenario: LCP sem lazy-loading
- **WHEN** o HTML renderizado é inspecionado
- **THEN** nenhuma das duas imagens da demonstração SHALL ter `loading="lazy"`
- **AND** nenhuma imagem SHALL competir com o `h1` por prioridade alta quando a medição indicar o texto como LCP

#### Scenario: Prioridade confirmada por medição
- **WHEN** o LCP é medido no navegador em desktop e mobile
- **THEN** o elemento vencedor SHALL ser registrado
- **AND** a prioridade de carregamento SHALL ser ajustada se o vencedor não for a campanha

#### Scenario: Proporção preservada
- **WHEN** a página é exibida em desktop ou mobile
- **THEN** a foto SHALL manter a proporção da origem
- **AND** a campanha SHALL ser exibida em caixa 1:1 com `object-contain`, sem corte

### Requirement: Metadata própria, canonical e indexação por ambiente

A página SHALL declarar metadata própria com title, description, Open Graph, Twitter e H1 aprovados.

O canonical SHALL ser absoluto (`https://vendeo.tech/floriculturas`) e SHALL ser emitido somente sob produção confirmada (`VERCEL_ENV === "production"`) com origem canônica validada. Fora dessa condição, o canonical SHALL ser omitido e a página SHALL declarar `noindex, nofollow`.

A indexação SHALL ser `index, follow` somente sob a condição combinada; preview, desenvolvimento e build local SHALL permanecer `noindex`.

#### Scenario: Produção válida é indexável
- **WHEN** a página é gerada em produção confirmada com origem canônica validada
- **THEN** `robots` SHALL ser `index, follow`
- **AND** o canonical SHALL ser `https://vendeo.tech/floriculturas`

#### Scenario: Preview e local permanecem noindex
- **WHEN** a página é gerada em preview, desenvolvimento ou build local
- **THEN** `robots` SHALL ser `noindex, nofollow`
- **AND** nenhum canonical de produção SHALL ser emitido

#### Scenario: Produção com origem inválida permanece fail-closed
- **WHEN** o ambiente é produção confirmada, mas a origem está ausente, inválida ou não canônica
- **THEN** `robots` SHALL ser `noindex, nofollow`
- **AND** o canonical SHALL ser omitido
- **AND** a página SHALL NOT aparecer no sitemap

### Requirement: Preservação das rotas não aprovadas

A inclusão de `/floriculturas` SHALL NOT alterar a política das demais superfícies. Autenticação, recuperação de senha, callbacks, app, admin, documentos legais, versões Markdown e APIs SHALL permanecer `noindex` e fora do sitemap. `middleware.ts` SHALL NOT ser alterado para esta rota.

#### Scenario: Rotas privadas permanecem noindex
- **WHEN** a política de indexação é revisada após a mudança
- **THEN** `/login`, `/signup`, `/dashboard`, `/campanhas`, `/conta`, `/admin`, `/termos`, `/privacidade`, `/uso-aceitavel`, `/auth/**`, `/api/**` e `/docs/**` SHALL continuar `noindex`
- **AND** nenhuma delas SHALL entrar no sitemap

#### Scenario: Middleware preservado
- **WHEN** `src/middleware.ts` é inspecionado
- **THEN** nenhuma entrada nova SHALL ter sido adicionada ao matcher
- **AND** `/floriculturas` SHALL continuar acessível sem sessão
