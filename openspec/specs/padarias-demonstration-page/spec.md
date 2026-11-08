# padarias-demonstration-page Specification

## Purpose

Página pública demonstrativa /padarias: composição e copy aprovadas, demonstração estática do Bolo Naked Fruit com kit de publicação em HTML, situações comerciais de padaria, exemplo complementar do pão, aviso único, entrega responsiva de duas variantes WebP por imagem, oferta central e metadata própria com indexação fail-closed.
## Requirements
### Requirement: Rota pública `/padarias` com composição aprovada

O sistema SHALL disponibilizar a página pública `/padarias` em `pt-BR`, como
Server Component em `src/app/(marketing)/padarias/page.tsx`, sem exigir
autenticação e sem layout próprio.

A página SHALL apresentar, nesta ordem: cabeçalho público; abertura com H1, texto
de abertura e primeiro grupo de acesso; demonstração com título, foto enviada e
campanha criada; explicação com o kit de publicação em HTML; bloco sobre situações
comerciais de padaria; exemplo complementar do pão francês com texto e imagem;
aviso demonstrativo único; encerramento com chamada, texto de apoio e único card
de oferta; rodapé com links legais.

A página SHALL ter um único `h1` e hierarquia de títulos coerente, com `h2` por
bloco e `h3` nos itens de situação comercial e no exemplo complementar.

#### Scenario: Página renderiza a composição aprovada

- **WHEN** `/padarias` é acessada sem sessão
- **THEN** a página SHALL ser servida sem redirect para `/login`
- **AND** os blocos SHALL aparecer na ordem aprovada
- **AND** SHALL existir exatamente um `h1`

#### Scenario: Mobile não empurra a mensagem principal

- **WHEN** a página é exibida em viewport mobile
- **THEN** H1, texto de abertura e primeiro grupo de acesso SHALL aparecer antes
  das imagens da demonstração
- **AND** não SHALL haver overflow horizontal

### Requirement: Copy aprovada sem acréscimos

A página SHALL usar exatamente a copy aprovada pelo responsável para H1, texto de
abertura, título e rótulos da demonstração, explicação, título e conteúdo do kit,
título e itens das situações comerciais, título e texto do exemplo complementar,
chamada final e texto de apoio.

A copy aprovada é:

- H1: “Transforme os produtos da sua padaria em campanhas prontas para divulgar.”;
- abertura: “O Vendeo é o aplicativo que cria artes e textos para divulgar os
  produtos da sua padaria nas redes sociais. Envie uma foto, conte o que quer
  destacar e receba uma campanha com a identidade da sua loja — sem precisar saber
  design.”;
- título da demonstração: “Da foto do bolo à campanha pronta para publicar.”;
- rótulos: “Foto enviada ao Vendeo” e “Campanha criada com o Vendeo”;
- explicação: “Uma foto do bolo, o nome da Panificadora Dona Maria e as
  informações que você quer destacar. O Vendeo reúne esses elementos em uma
  campanha com a marca da loja, o produto em destaque e uma mensagem pronta para
  acompanhar a publicação.”;
- título do kit: “Além da arte, o texto para acompanhar sua publicação.”;
- título do bloco de situações: “Crie posts para sua padaria sem começar do zero.”;
- introdução do bloco: “A rotina da padaria rende assunto todos os dias. O Vendeo
  ajuda a transformar o que já acontece na loja em uma campanha pronta para
  divulgar.”;
- situações: “Novidades da vitrine.”, “Fornadas do dia.” e “Bolos e encomendas.”,
  com os textos “Apresente um bolo, um doce ou um produto novo que chegou para
  vender no balcão.”, “Mostre os pães que acabaram de sair e convide o cliente a
  passar na padaria.” e “Divulgue as opções de bolo e as informações que o cliente
  precisa para fazer a encomenda.”;
- exemplo complementar: título “Saiu uma fornada? Prepare a divulgação.” e texto
  “Mostre os pães que acabaram de sair, destaque os produtos disponíveis no dia e
  convide seus clientes para passar na padaria.”;
- encerramento: título “Como ficaria uma campanha com os produtos da sua padaria?”
  e apoio “Sua padaria, sua marca, uma campanha pronta para divulgar.”.

A página SHALL NOT acrescentar blocos ou frases de advertência comercial além do
aviso demonstrativo aprovado, incluindo “não promete vendas”, “não mede tempo de
geração” ou “foto criada com IA”.

A página SHALL NOT exibir tabela de entrada, preço, oferta, selo, avaliação ou
qualquer dado de geração não fornecido.

A página SHALL NOT prometer agendamento, calendário editorial, publicação
automática, integração com redes sociais, anúncios pagos, alcance, tráfego,
posição no Google ou aumento de vendas.

#### Scenario: Copy aprovada sem desvios

- **WHEN** a página renderizada é comparada à copy aprovada
- **THEN** os textos SHALL corresponder ao conteúdo aprovado
- **AND** nenhum bloco de advertência comercial adicional SHALL existir

#### Scenario: Nenhuma funcionalidade inexistente é prometida

- **WHEN** a copy pública é revisada
- **THEN** ela SHALL falar apenas em criar arte e texto a partir de foto e
  informações fornecidas
- **AND** SHALL NOT mencionar agenda, publicação automática, anúncios ou resultado
  comercial

### Requirement: Demonstração principal com kit de publicação em HTML

A demonstração SHALL exibir, lado a lado no desktop e em sequência no mobile, a
foto do Bolo Naked Fruit enviada ao Vendeo e a campanha criada para a Panificadora
Dona Maria, ambas em proporção 1:1, integralmente e sem recorte.

A explicação SHALL incluir um card com o título “Além da arte, o texto para
acompanhar sua publicação.” e, dentro dele, exatamente:

- Título: “Bolo Naked Fruit: um destaque à mesa”;
- Legenda: “Conheça o Bolo Naked Fruit, destaque da vitrine da Panificadora Dona
  Maria. Com uma apresentação que valoriza cada detalhe, é uma escolha especial
  para compartilhar bons momentos em família. Qualidade da nossa família para a
  sua!”;
- Hashtags: “#BoloNakedFruit #Confeitaria #DestaqueDaVitrine #PanificadoraDonaMaria”;
- Chamada: “Venha conhecer na loja!”.

O kit SHALL ser renderizado como texto HTML, não como captura de tela, e SHALL NOT
reproduzir botões “Copiar” ou qualquer controle operacional do aplicativo.

#### Scenario: Conteúdo do kit exibido integralmente

- **WHEN** a página é renderizada
- **THEN** o card SHALL conter o título, a legenda, as quatro hashtags e a chamada
  exatas fornecidas
- **AND** cada campo SHALL aparecer uma única vez

#### Scenario: Texto em HTML, não captura de interface

- **WHEN** o HTML da página é inspecionado
- **THEN** o kit SHALL ser composto por elementos de texto
- **AND** SHALL NOT conter imagem do texto gerado nem botão “Copiar”

#### Scenario: Imagens da demonstração sem recorte

- **WHEN** a demonstração é exibida em desktop ou mobile
- **THEN** a foto e a campanha SHALL manter a proporção 1:1
- **AND** SHALL NOT ser recortadas, cobertas ou tratadas para remover conteúdo

### Requirement: Situações comerciais e exemplo complementar do pão

O bloco de situações comerciais SHALL apresentar, com leitura escaneável, as três
situações aprovadas: novidades da vitrine, fornadas do dia e bolos e encomendas.

O exemplo complementar SHALL exibir somente a campanha final do Pão Francês
Fresquinho, sem novo antes/depois, sem segundo kit de publicação e sem outros
controles. No desktop, o texto SHALL ficar à esquerda e a imagem à direita,
verticalmente centralizados; no mobile, texto e imagem SHALL empilhar na ordem
texto → imagem.

#### Scenario: Três situações comerciais legíveis

- **WHEN** o bloco é exibido em desktop
- **THEN** as três situações SHALL aparecer em leitura escaneável
- **WHEN** o bloco é exibido em mobile
- **THEN** as três situações SHALL empilhar sem overflow

#### Scenario: Exemplo complementar em duas colunas no desktop

- **WHEN** a página é exibida em desktop
- **THEN** o texto do exemplo SHALL ficar à esquerda e a campanha do pão à direita
- **AND** o bloco textual SHALL ficar centralizado verticalmente em relação à
  imagem
- **WHEN** a página é exibida em mobile
- **THEN** o texto SHALL vir antes da imagem

#### Scenario: Apenas a campanha final do pão

- **WHEN** o exemplo complementar é revisado
- **THEN** ele SHALL conter somente a campanha final do pão
- **AND** SHALL NOT conter um novo par antes/depois ou um segundo kit de texto

### Requirement: Acessibilidade e semântica

A página SHALL usar `header`, `main` e `footer` como landmarks, um único `h1` e
hierarquia de títulos coerente.

Todas as imagens SHALL ter texto alternativo descritivo no contexto da
demonstração do aplicativo. A seta entre foto e campanha SHALL ser decorativa e
`aria-hidden`. O kit SHALL usar lista de definição (`dl`/`dt`/`dd`). O expansível
da oferta SHALL usar `details`/`summary` nativos.

Links e controles SHALL ter foco visível, área de toque mínima de 44 px e rótulos
compreensíveis. A página SHALL NOT produzir IDs duplicados.

#### Scenario: Estrutura navegável por leitor de tela

- **WHEN** o HTML é inspecionado
- **THEN** SHALL existir um `header`, um `main` e um `footer`
- **AND** SHALL existir exatamente um `h1`
- **AND** a seta decorativa SHALL estar oculta de tecnologias assistivas

#### Scenario: Imagens e kit com semântica adequada

- **WHEN** as imagens e o kit são renderizados
- **THEN** todas as imagens SHALL ter `alt` não vazio e descritivo
- **AND** o kit SHALL usar `dl`, `dt` e `dd`
- **AND** o expansível SHALL usar `details` e `summary` nativos

#### Scenario: Foco e toque

- **WHEN** a página é navegada por teclado ou em viewport mobile
- **THEN** os controles SHALL exibir foco visível
- **AND** as áreas de toque SHALL ter no mínimo 44 px
- **AND** não SHALL haver IDs duplicados

### Requirement: Aviso demonstrativo único e discreto

A página SHALL exibir uma única vez o texto aprovado “As lojas e campanhas
apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas
comerciais válidas”, junto ao conjunto de exemplos, em tipografia secundária e sem
competir com o conteúdo principal.

O aviso SHALL ficar imediatamente após o exemplo complementar do pão, cobrindo a
demonstração do bolo e o exemplo do pão.

A página SHALL NOT repetir o aviso no rodapé nem apresentar os exemplos como
depoimento, caso real, cliente ou resultado comercial.

#### Scenario: Aviso aparece uma única vez

- **WHEN** a página é renderizada
- **THEN** o texto do aviso demonstrativo SHALL aparecer exatamente uma vez
- **AND** SHALL estar visualmente associado ao conjunto de exemplos

#### Scenario: Marca fictícia não é apresentada como cliente real

- **WHEN** o conteúdo é revisado
- **THEN** nenhum texto SHALL descrever a Panificadora Dona Maria como cliente real
  ou os exemplos como depoimento
- **AND** nenhum resultado comercial SHALL ser atribuído aos exemplos

### Requirement: Conteúdo demonstrativo estático e assets aprovados

A página SHALL usar somente o conjunto demonstrativo aprovado: a foto do Bolo
Naked Fruit, a campanha do Bolo Naked Fruit da marca fictícia Panificadora Dona
Maria e a campanha do Pão Francês Fresquinho da mesma marca.

A página SHALL NOT chamar API de geração, produzir arte ao vivo, executar geração
paga ou depender de dados de campanha do usuário.

Os arquivos-fonte originais SHALL permanecer fora de `public/`; o site SHALL
entregar apenas as variantes WebP aprovadas.

#### Scenario: Página não invoca geração

- **WHEN** a página é carregada e utilizada
- **THEN** nenhuma chamada a provider ou API de geração SHALL ocorrer
- **AND** nenhum crédito SHALL ser consumido

#### Scenario: Apenas o conjunto aprovado é exibido

- **WHEN** os assets da página são revisados
- **THEN** a foto e as duas campanhas SHALL corresponder ao conjunto aprovado
- **AND** nenhum outro produto, loja ou campanha SHALL ser referenciado

### Requirement: Entrega responsiva e desempenho

Cada uma das três imagens SHALL ser entregue em duas variantes WebP — 480w e
1024w — com `srcset`, `sizes`, proporção 1:1 preservada, dimensões explícitas e sem
upscale.

A prioridade de carregamento SHALL ser definida por medição no navegador. As duas
imagens da demonstração principal SHALL usar `eager` enquanto o LCP medido for o
H1; o exemplo complementar, abaixo da dobra, SHALL usar `loading="lazy"` e
`decoding="async"`. Nenhuma imagem SHALL receber `fetchpriority="high"` sem
medição que justifique.

A implementação SHALL registrar dimensões, pesos finais, `currentSrc` selecionado,
overflow horizontal e elemento de LCP observado em desktop e mobile.

A página SHALL NOT introduzir fontes externas, carrossel, modal, nova dependência
ou framework genérico de páginas.

#### Scenario: Duas variantes por imagem

- **WHEN** os assets entregues são inspecionados
- **THEN** SHALL existir exatamente uma variante de 480w e uma de 1024w para cada
  uma das três imagens
- **AND** todas SHALL ser WebP, com proporção 1:1 e peso menor ou igual ao original
  correspondente

#### Scenario: Exemplo complementar abaixo da dobra

- **WHEN** o exemplo do pão é renderizado
- **THEN** ele SHALL usar `loading="lazy"` e `decoding="async"`
- **AND** SHALL declarar `width` e `height` explícitos
- **AND** SHALL usar `srcset` com dois candidatos e `sizes` compatível com a
  largura real de exibição

#### Scenario: Prioridade confirmada por medição

- **WHEN** o LCP é medido em desktop e mobile
- **THEN** o elemento vencedor SHALL ser registrado
- **AND** a prioridade de carregamento SHALL ser ajustada se o vencedor não for o
  H1

#### Scenario: Sem overflow e sem upscale

- **WHEN** a página é exibida em 1440×900 e 390×844
- **THEN** `document.documentElement.scrollWidth` SHALL ser igual a `clientWidth`
- **AND** nenhuma variante SHALL ser ampliada além de sua largura original

### Requirement: Metadata, canonical, indexação e descoberta

A página SHALL declarar metadata própria com:

- title: “Crie posts e campanhas para padarias com IA | Vendeo”;
- description: “Transforme fotos e informações dos produtos da sua padaria em
  artes e textos prontos para divulgar nas redes sociais. Sem precisar saber
  design.”;
- Open Graph e Twitter com locale `pt_BR`, `siteName` `Vendeo`, a mesma imagem
  institucional 1200×630 já usada pela home e URL `/padarias`.

O canonical SHALL ser absoluto (`https://vendeo.tech/padarias`) e SHALL ser emitido
somente sob produção confirmada (`VERCEL_ENV === "production"`) com origem canônica
validada. Fora dessa condição, o canonical SHALL ser omitido e a página SHALL
declarar `noindex, nofollow`.

A indexação SHALL ser `index, follow` somente sob a condição combinada. A página
SHALL ser incluída explicitamente no sitemap sob a mesma condição.

O rodapé da home SHALL receber um link “Padarias” para `/padarias`, ao lado do link
existente “Floriculturas”, sem qualquer outra alteração visível na home.

A página SHALL NOT emitir dados estruturados `Bakery`, `LocalBusiness`, `Product`,
`Offer`, `Review` ou `AggregateRating` para a marca fictícia, seus produtos,
preços ou avaliações. A ausência de dados estruturados nesta entrega é uma decisão
registrada, não uma omissão acidental.

#### Scenario: Produção válida é indexável

- **WHEN** a página é gerada em produção confirmada com origem canônica validada
- **THEN** `robots` SHALL ser `index, follow`
- **AND** o canonical SHALL ser `https://vendeo.tech/padarias`
- **AND** a URL SHALL constar do sitemap

#### Scenario: Preview e local permanecem noindex

- **WHEN** a página é gerada em preview, desenvolvimento ou build local
- **THEN** `robots` SHALL ser `noindex, nofollow`
- **AND** nenhum canonical de produção SHALL ser emitido
- **AND** a URL SHALL NOT constar do sitemap

#### Scenario: Produção com origem inválida permanece fail-closed

- **WHEN** o ambiente é produção confirmada, mas a origem está ausente, inválida ou
  não canônica
- **THEN** `robots` SHALL ser `noindex, nofollow`
- **AND** o canonical SHALL ser omitido
- **AND** a página SHALL NOT aparecer no sitemap

#### Scenario: Sem marcação de loja ou produto fictício

- **WHEN** o HTML é inspecionado
- **THEN** SHALL NOT existir JSON-LD de `Bakery`, `LocalBusiness`, `Product`,
  `Offer`, `Review` ou `AggregateRating`
- **AND** nenhum preço, avaliação ou endereço inventado SHALL aparecer como dado
  estruturado

### Requirement: Oferta central e CTAs preservados

O encerramento SHALL conter um único card compacto de oferta, com ID estável
`padarias-oferta`, `tabindex="-1"` e margem de rolagem, reutilizando `OfferCard` e
a fonte central `public-offer-copy.ts`.

O card SHALL exibir o resumo, o complemento e o expansível da fonte central, sem
duplicar números, condições ou rótulos. A abertura SHALL NOT repetir esses textos.

Na abertura, todas as ações de aquisição SHALL ser âncoras locais para
`#padarias-oferta` e SHALL NOT iniciar OAuth, abrir cadastro ou navegar para fora
da página. No card final, as ações reais SHALL seguir a flag: Google/OAuth e
e-mail (`/signup`) com o cadastro aberto; solicitação (`/#acesso`) com o cadastro
fechado.

O link “Conheça o Vendeo” SHALL apontar para `/` na abertura e no encerramento,
sem âncora.

#### Scenario: Um único card e um único conjunto de textos da oferta

- **WHEN** a página é renderizada em qualquer estado da flag
- **THEN** SHALL existir exatamente um card de oferta, no encerramento
- **AND** o resumo, o complemento e o expansível SHALL vir da fonte central
- **AND** a abertura SHALL NOT repetir esses textos

#### Scenario: Ações da abertura apenas navegam por âncora

- **WHEN** o cadastro está fechado
- **THEN** “Solicitar acesso gratuito” da abertura SHALL apontar para
  `#padarias-oferta`
- **WHEN** o cadastro está aberto
- **THEN** os controles “Continuar com Google” e “Continuar com email” da abertura
  SHALL ser âncoras locais para `#padarias-oferta`
- **AND** nenhum deles SHALL iniciar OAuth ou abrir `/signup`

#### Scenario: Encerramento com ações reais conforme a flag

- **WHEN** o cadastro está fechado
- **THEN** o CTA do card SHALL apontar para `/#acesso`
- **WHEN** o cadastro está aberto
- **THEN** o card SHALL manter Google/OAuth e e-mail para `/signup`
- **AND** “Conheça o Vendeo” SHALL apontar para `/` nos dois estados

### Requirement: Preservação das páginas e superfícies existentes

A inclusão de `/padarias` SHALL NOT alterar `/floriculturas`, a política de
oferta, créditos, elegibilidade, onboarding, autenticação, APIs, banco, migrations,
flags ou configuração externa.

A home SHALL preservar H1, copy, blocos, imagens, CTAs, ordem e metadata. O
rodapé da home SHALL poder ser renderizado pelo componente público compartilhado,
com os links “Floriculturas”, “Padarias” e “Campanhas sem complicação” agrupados
sob “Explore o Vendeo”. Essa composição SHALL NOT alterar o conteúdo visível da
home além do rodapé nem os contratos de indexação. O `middleware.ts` SHALL NOT ser
alterado para esta rota.

#### Scenario: `/floriculturas` preservada

- **WHEN** a implementação é revisada
- **THEN** a página, os componentes, os assets, os CTAs, o card e a metadata de
  `/floriculturas` SHALL permanecer inalterados, exceto pelo rodapé compartilhado
  previsto nesta change

#### Scenario: Home preservada exceto pelo rodapé compartilhado

- **WHEN** a home é comparada ao estado anterior
- **THEN** H1, copy, blocos, imagens, CTAs, ordem e metadata SHALL permanecer
  inalterados
- **AND** o link “Padarias” SHALL permanecer apontando para `/padarias`
- **AND** a única área visível alterada SHALL ser o rodapé, com os destinos de
  conteúdo agrupados sob “Explore o Vendeo”
- **AND** Termos, Privacidade, Uso Aceitável, Novidades, Contato, Entrar e o aviso
  legal demonstrativo SHALL permanecer disponíveis

#### Scenario: Rotas privadas permanecem noindex

- **WHEN** a política de indexação é revisada após a mudança
- **THEN** `/login`, `/signup`, `/dashboard`, `/campanhas`, `/conta`, `/admin`,
  `/termos`, `/privacidade`, `/uso-aceitavel`, `/auth/**`, `/api/**` e `/docs/**`
  SHALL continuar `noindex`
- **AND** nenhuma delas SHALL entrar no sitemap
