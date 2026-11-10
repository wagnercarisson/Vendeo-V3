## ADDED Requirements

### Requirement: Rota pública `/ofertas-para-mercados` com composição aprovada

O sistema SHALL disponibilizar a página pública `/ofertas-para-mercados` em
`pt-BR`, como Server Component em
`src/app/(marketing)/ofertas-para-mercados/page.tsx`, sem exigir autenticação e
sem layout próprio.

A página SHALL apresentar, nesta ordem: cabeçalho público; abertura com H1, texto
de apresentação e primeiro grupo de acesso; demonstração com título, foto do
produto e campanha criada; explicação consolidada em um único parágrafo sobre
produto, preço anterior e promocional, período de validade da oferta e marca; kit
de publicação em HTML; exemplo complementar do café; aviso demonstrativo único;
encerramento com chamada, texto de apoio e único
card de oferta; rodapé público compartilhado.

A página SHALL ter um único `h1` e hierarquia de títulos coerente, com `h2` por
bloco.

#### Scenario: Página renderiza a composição aprovada

- **WHEN** `/ofertas-para-mercados` é acessada sem sessão
- **THEN** a página SHALL ser servida sem redirect para `/login`
- **AND** os blocos SHALL aparecer na ordem aprovada
- **AND** SHALL existir exatamente um `h1`

#### Scenario: Mobile não empurra a mensagem principal

- **WHEN** a página é exibida em viewport mobile
- **THEN** H1, texto de abertura e primeiro grupo de acesso SHALL aparecer antes
  das imagens da demonstração
- **AND** não SHALL haver overflow horizontal

### Requirement: Copy aprovada sem acréscimos

A página SHALL usar exatamente a copy aprovada para H1, texto de abertura, título
e rótulos da demonstração, explicação, título e conteúdo do kit, título e texto do
exemplo complementar, aviso, chamada final e texto de apoio.

A copy aprovada é:

- H1: “Sua oferta merece chamar atenção. Sem complicar sua rotina.”;
- abertura: “O Vendeo é o aplicativo que cria artes e textos para divulgar as
  ofertas do seu mercado, mercearia ou minimercado nas redes sociais. Envie a foto
  do produto, informe o preço e o que quer destacar, e receba uma campanha com a
  identidade do seu estabelecimento — sem precisar saber design.”;
- título da demonstração: “Da foto do produto à campanha pronta para divulgar.”;
- rótulos: “Foto do produto” e “Campanha criada com o Vendeo”;
- título da explicação consolidada: “Uma oferta clara, com a identidade da sua
  loja.”;
- explicação consolidada: “Você informa o produto, o preço anterior, o preço
  promocional e o período de validade da oferta. O Vendeo organiza essas
  informações em uma campanha com o produto em destaque e a identidade da sua
  loja.”;
- título do kit: “Além da arte, o texto para acompanhar a publicação.”;
- título do exemplo complementar: “Outra categoria, a mesma identidade.”;
- texto do exemplo complementar: “A Mercearia Tio João também divulga o café da
  loja com o mesmo padrão de campanha: produto em destaque, preço legível e a marca
  do estabelecimento preservada.”;
- encerramento: título “Como ficaria uma campanha com a oferta da sua loja?” e
  apoio “Sua oferta, sua marca, uma campanha pronta para revisar e publicar.”.

A página SHALL NOT acrescentar blocos ou frases de advertência comercial além do
aviso demonstrativo aprovado, incluindo “não promete vendas”, “não mede tempo de
geração”, “foto criada com IA” ou “foto tirada com celular”.

A página SHALL NOT usar “loja pequena”, “começar do zero”, “tela em branco” ou
“ofertas agressivas” como expressão central.

A página SHALL NOT prometer agendamento, calendário editorial, publicação
automática, integração com redes sociais, anúncios pagos, alcance, tráfego,
posição no Google, conversão ou aumento de vendas.

Os limites de largura dos títulos e parágrafos SHALL evitar palavras isoladas e
quebras prematuras quando houver espaço, sem reduzir o tamanho das fontes,
inserir quebras manuais ou forçar `nowrap`.

#### Scenario: Copy aprovada sem desvios

- **WHEN** a página renderizada é comparada à copy aprovada
- **THEN** os textos SHALL corresponder ao conteúdo aprovado
- **AND** nenhum bloco de advertência comercial adicional SHALL existir

#### Scenario: Nenhuma funcionalidade inexistente é prometida

- **WHEN** a copy pública é revisada
- **THEN** ela SHALL falar apenas em criar arte e texto a partir de foto e
  informações fornecidas
- **AND** SHALL NOT mencionar agenda, publicação automática, anúncios, tráfego,
  conversão ou resultado comercial

#### Scenario: Títulos e parágrafos sem palavras isoladas

- **WHEN** a página é exibida em desktop ou tablet com espaço disponível
- **THEN** os limites de largura e o balanceamento SHALL evitar palavras isoladas
  e quebras prematuras
- **AND** o tamanho das fontes SHALL permanecer inalterado
- **AND** SHALL NOT haver quebras manuais ou `nowrap`

### Requirement: Demonstração principal com foto horizontal e campanha quadrada

A demonstração SHALL exibir a foto do coxão mole no açougue e a campanha quadrada
da Mercearia Tio João, integralmente e sem recorte.

No desktop e no tablet, a foto SHALL ficar à esquerda e a campanha à direita, em
uma grade centrada que preserve a proporção 3:2 da foto e 1:1 da campanha. No
tablet, as colunas SHALL usar a proporção `3fr/4fr`; no desktop, os limites
`360px/480px`. A foto SHALL ter largura máxima de 360 px e ficar verticalmente
centralizada; a campanha SHALL ter largura máxima de 480 px e maior destaque. Nenhuma das duas SHALL ser
recortada ou distorcida. O rótulo da foto SHALL ficar imediatamente acima da
imagem e acompanhar sua centralização vertical; o rótulo da campanha SHALL
permanecer no topo da coluna. A seta decorativa SHALL ser centralizada somente
entre as imagens, sem incluir os rótulos no cálculo.

No mobile, os elementos SHALL empilhar na ordem foto → seta → campanha.

A seta SHALL ser decorativa e `aria-hidden`.

A demonstração SHALL NOT exibir parágrafo de apoio entre o par e o bloco seguinte.
A explicação consolidada SHALL vir imediatamente depois do par, uma única vez, e a
página SHALL seguir diretamente para o kit.

#### Scenario: Proporções preservadas em desktop

- **WHEN** a demonstração é exibida em desktop ou tablet
- **THEN** a foto SHALL manter 3:2 e a campanha SHALL manter 1:1
- **AND** a foto SHALL respeitar o máximo de 360 px e a campanha o máximo de 480 px
- **AND** a foto SHALL ficar verticalmente centralizada contra a campanha
- **AND** nenhuma das duas SHALL ser recortada, distorcida ou ampliada além do
  original
- **AND** a seta SHALL ficar verticalmente centralizada entre as áreas visuais,
  sem considerar os rótulos

#### Scenario: Empilhamento no mobile

- **WHEN** a demonstração é exibida em viewport mobile
- **THEN** a foto SHALL vir antes da seta e a seta antes da campanha
- **AND** o rótulo da foto SHALL permanecer imediatamente acima dela
- **AND** não SHALL haver overflow horizontal

#### Scenario: Rótulo da foto próximo da imagem no desktop

- **WHEN** a demonstração é exibida em desktop ou tablet
- **THEN** o rótulo “Foto do produto” SHALL ficar imediatamente acima da foto
- **AND** SHALL NOT haver vazio entre o rótulo e a imagem
- **AND** o rótulo da campanha SHALL permanecer no topo da coluna

### Requirement: Explicação consolidada sobre preço, validade e marca

A explicação SHALL ser um único parágrafo, imediatamente após o par, com o título
“Uma oferta clara, com a identidade da sua loja.” e o texto “Você informa o
produto, o preço anterior, o preço promocional e o período de validade da oferta.
O Vendeo organiza essas informações em uma campanha com o produto em destaque e a
identidade da sua loja.”.

A explicação SHALL usar “validade da oferta”, não “validade da campanha”, para
deixar claro que se trata da condição comercial anunciada.

A página SHALL NOT repetir os mesmos atributos em um segundo parágrafo, antes ou
depois desse bloco. A página SHALL seguir diretamente para o kit.

A página SHALL NOT transformar a explicação em manual extenso, lista de passos de
onboarding, tabela de geração ou descrição de mecânica interna do aplicativo.

#### Scenario: Explicação única e consolidada

- **WHEN** o bloco de explicação é revisado
- **THEN** ele SHALL existir uma única vez, após o par e antes do kit
- **AND** SHALL mencionar produto, preço anterior, preço promocional, período de
  validade da oferta e identidade da loja
- **AND** SHALL NOT haver segundo parágrafo enumerando os mesmos atributos
- **AND** SHALL NOT conter tutorial de formulário ou onboarding

### Requirement: Kit de publicação em HTML

A página SHALL exibir um card com o título “Além da arte, o texto para acompanhar
a publicação.” e, dentro dele, exatamente:

- Título: “Coxão Mole Bovino por R$ 39,90/kg”;
- Legenda: “Vai preparar uma refeição caprichada? Aproveite o Coxão Mole Bovino
  por R$ 39,90 o kg, antes R$ 45,90! Um preço especial pra deixar o almoço ainda
  mais gostoso. Venha conferir na Mercearia Tio João!”;
- Hashtags: “#CoxaoMole #Mercearia #OfertaDoDia #MerceariaTioJoao”;
- Chamada: “Confira essa oferta na loja!”.

O kit SHALL ser renderizado como texto HTML, não como captura de tela, e SHALL NOT
reproduzir botões “Copiar” ou qualquer controle operacional do aplicativo.

O card do kit MAY ocupar a coluna de leitura `max-w-3xl`. A largura do card não
faz parte da copy aprovada: a copy e os campos permanecem exatos, e o alargamento
é uma decisão visual explícita, não uma alegação de que o card foi preservado na
largura anterior.

Cada campo SHALL aparecer uma única vez.

#### Scenario: Conteúdo do kit exibido integralmente

- **WHEN** a página é renderizada
- **THEN** o card SHALL conter o título, a legenda, as quatro hashtags e a chamada
  exatas fornecidas
- **AND** cada campo SHALL aparecer uma única vez

#### Scenario: Texto em HTML, não captura de interface

- **WHEN** o HTML da página é inspecionado
- **THEN** o kit SHALL ser composto por elementos de texto
- **AND** SHALL NOT conter imagem do texto gerado nem botão “Copiar”

### Requirement: Exemplo complementar do café

A página SHALL exibir um exemplo complementar com a campanha do Café Melitta 500 g
Tradicional, da mesma Mercearia Tio João, mostrando outra categoria atendida pela
mesma identidade de campanha.

O exemplo SHALL conter somente a campanha final do café, sem novo par
antes/depois e sem segundo kit de publicação. No desktop, o texto SHALL ficar à
esquerda e a imagem à direita, verticalmente centralizados; no mobile, texto e
imagem SHALL empilhar na ordem texto → imagem.

A imagem SHALL usar `loading="lazy"` e `decoding="async"` por estar abaixo da
dobra.

#### Scenario: Outra categoria da mesma marca fictícia

- **WHEN** o exemplo complementar é revisado
- **THEN** ele SHALL apresentar o café como outra categoria da Mercearia Tio João
- **AND** SHALL NOT apresentar uma segunda loja ou uma segunda identidade

#### Scenario: Apenas a campanha final

- **WHEN** o exemplo complementar é revisado
- **THEN** ele SHALL conter somente a campanha final do café
- **AND** SHALL NOT conter um novo par antes/depois ou um segundo kit de texto

### Requirement: Aviso demonstrativo único

A página SHALL exibir uma única vez o texto aprovado: “As lojas e campanhas
apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas
comerciais válidas. As marcas de produtos pertencem aos respectivos titulares. O
Vendeo não possui vínculo, parceria, patrocínio ou endosso das marcas ou dos
fabricantes utilizados para ilustrar as campanhas.”

O aviso SHALL ficar imediatamente após o exemplo complementar do café, cobrindo a
demonstração da carne e o exemplo do café, incluindo a Melitta.

A página SHALL NOT repetir o aviso no rodapé, no card de oferta, na abertura ou em
qualquer outro bloco. A página SHALL NOT apresentar os exemplos como depoimento,
caso real, cliente ou resultado comercial.

#### Scenario: Aviso aparece uma única vez

- **WHEN** a página é renderizada
- **THEN** o texto do aviso demonstrativo SHALL aparecer exatamente uma vez
- **AND** SHALL estar visualmente associado ao conjunto de exemplos

#### Scenario: Melitta coberta pelo aviso único

- **WHEN** o aviso é revisado
- **THEN** ele SHALL cobrir as marcas de produtos utilizadas nos exemplos,
  incluindo a Melitta
- **AND** SHALL NOT haver aviso duplicado específico para a Melitta

### Requirement: Oferta central, CTAs e âncora

O encerramento SHALL conter um único card compacto de oferta, com ID estável
`ofertas-mercados-oferta`, `tabindex="-1"` e margem de rolagem, reutilizando
`OfferCard` e a fonte central `public-offer-copy.ts`.

O card SHALL exibir o resumo, o complemento e o expansível da fonte central, sem
duplicar números, condições ou rótulos. A abertura SHALL NOT repetir esses textos.

Na abertura, todas as ações de aquisição SHALL ser âncoras locais para
`#ofertas-mercados-oferta` e SHALL NOT iniciar OAuth, abrir cadastro ou navegar
para fora da página. No card final, as ações reais SHALL seguir a flag:
Google/OAuth e e-mail (`/signup`) com o cadastro aberto; solicitação (`/#acesso`)
com o cadastro fechado.

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
  `#ofertas-mercados-oferta`
- **WHEN** o cadastro está aberto
- **THEN** os controles “Continuar com Google” e “Continuar com email” da abertura
  SHALL ser âncoras locais para `#ofertas-mercados-oferta`
- **AND** nenhum deles SHALL iniciar OAuth ou abrir `/signup`

#### Scenario: Encerramento com ações reais conforme a flag

- **WHEN** o cadastro está fechado
- **THEN** o CTA do card SHALL apontar para `/#acesso`
- **WHEN** o cadastro está aberto
- **THEN** o card SHALL manter Google/OAuth e e-mail para `/signup`
- **AND** “Conheça o Vendeo” SHALL apontar para `/` nos dois estados

### Requirement: Assets, responsividade e desempenho

A foto do açougue e a campanha da carne SHALL ser entregues em duas variantes WebP
por imagem — 480w e 1024w — com `srcset`, `sizes`, dimensões explícitas, proporções
preservadas e sem upscale.

A foto SHALL manter 3:2; a campanha SHALL manter 1:1. O café SHALL reutilizar a
variante de 480w e o WebP base de 1024×1024 já existentes, sem novo derivado
redundante.

As duas imagens da demonstração principal SHALL usar `eager` enquanto o LCP medido
for o H1. O exemplo do café SHALL usar `loading="lazy"` e `decoding="async"`.
Nenhuma imagem SHALL receber `fetchpriority="high"` sem medição que justifique.

A implementação SHALL registrar dimensões, pesos finais, `currentSrc` selecionado,
overflow horizontal, proporções e elemento de LCP observado em desktop, tablet e
mobile.

A página SHALL NOT introduzir fontes externas, carrossel, modal, nova dependência
ou framework genérico de páginas.

#### Scenario: Duas variantes por imagem nova

- **WHEN** os assets da carne são inspecionados
- **THEN** SHALL existir exatamente uma variante de 480w e uma de 1024w para a foto
  e para a campanha
- **AND** todas SHALL ser WebP, com a proporção original e peso menor ou igual ao
  original correspondente

#### Scenario: Café reutilizado sem redundância

- **WHEN** os assets do café são inspecionados
- **THEN** a página SHALL referenciar o derivado de 480w e o WebP base de 1024×1024
  já existentes
- **AND** SHALL NOT criar uma nova variante redundante

#### Scenario: Exemplo complementar abaixo da dobra

- **WHEN** o café é renderizado
- **THEN** ele SHALL usar `loading="lazy"` e `decoding="async"`
- **AND** SHALL declarar `width` e `height` explícitos

#### Scenario: Sem overflow e sem upscale

- **WHEN** a página é exibida em 1440×900, 834×1112 e 390×844
- **THEN** `document.documentElement.scrollWidth` SHALL ser igual a `clientWidth`
- **AND** nenhuma variante SHALL ser ampliada além de sua largura original

### Requirement: Metadata, canonical, indexação e descoberta

A página SHALL declarar metadata própria com:

- title: “Crie artes de ofertas para mercados e mercearias | Vendeo”;
- description: “Crie artes e textos para divulgar as ofertas do seu mercado,
  mercearia ou minimercado nas redes sociais. Com a identidade do seu
  estabelecimento.”;
- Open Graph e Twitter com locale `pt_BR`, `siteName` `Vendeo`, a mesma imagem
  institucional 1200×630 já usada pela home e URL `/ofertas-para-mercados`.

O canonical SHALL ser absoluto (`https://vendeo.tech/ofertas-para-mercados`) e
SHALL ser emitido somente sob produção confirmada (`VERCEL_ENV === "production"`)
com origem canônica validada. Fora dessa condição, o canonical SHALL ser omitido e
a página SHALL declarar `noindex, nofollow`.

A indexação SHALL ser `index, follow` somente sob a condição combinada. A página
SHALL ser incluída explicitamente no sitemap sob a mesma condição.

A página SHALL NOT emitir dados estruturados de mercado, açougue, produto, oferta,
avaliação ou negócio fictício, incluindo `GroceryStore`, `Butcher`,
`LocalBusiness`, `Product`, `Offer`, `Review` ou `AggregateRating`.

A metadata SHALL NOT incorporar preço, nome de produto, nome da Mercearia Tio João,
“Melitta” ou qualquer dado comercial fictício.

#### Scenario: Produção válida é indexável

- **WHEN** a página é gerada em produção confirmada com origem canônica validada
- **THEN** `robots` SHALL ser `index, follow`
- **AND** o canonical SHALL ser `https://vendeo.tech/ofertas-para-mercados`
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

#### Scenario: Sem marcação comercial fictícia

- **WHEN** o HTML é inspecionado
- **THEN** SHALL NOT existir JSON-LD de mercado, açougue, produto, oferta,
  avaliação ou negócio fictício
- **AND** nenhum preço ou avaliação inventado SHALL aparecer como dado estruturado

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

### Requirement: Conteúdo demonstrativo estático e preservação

A página SHALL usar somente o conjunto demonstrativo aprovado: a foto do coxão
mole no açougue, a campanha quadrada da Mercearia Tio João e a campanha do Café
Melitta da mesma marca fictícia.

A página SHALL NOT chamar API de geração, produzir arte ao vivo, executar geração
paga ou depender de dados de campanha do usuário. Os arquivos-fonte originais SHALL
permanecer fora de `public/`; o site SHALL entregar apenas as variantes WebP
aprovadas.

A inclusão de `/ofertas-para-mercados` SHALL NOT alterar `/floriculturas`,
`/padarias`, `/campanhas-para-sua-loja`, a home, a política de oferta, créditos,
elegibilidade, onboarding, autenticação, APIs, banco, migrations, flags ou
configuração externa. O rodapé SHALL ser alterado somente na lista central
compartilhada.

#### Scenario: Página não invoca geração

- **WHEN** a página é carregada e utilizada
- **THEN** nenhuma chamada a provider ou API de geração SHALL ocorrer
- **AND** nenhum crédito SHALL ser consumido

#### Scenario: Apenas o conjunto aprovado é exibido

- **WHEN** os assets da página são revisados
- **THEN** a foto e as duas campanhas SHALL corresponder ao conjunto aprovado
- **AND** nenhum outro produto, loja ou campanha SHALL ser referenciado
- **AND** a campanha 9:16 e a foto gastronômica anterior SHALL NOT ser usadas

#### Scenario: Páginas existentes preservadas

- **WHEN** a implementação é revisada
- **THEN** `/floriculturas`, `/padarias`, `/campanhas-para-sua-loja`, a home, a
  oferta central, o acesso e os CTAs SHALL permanecer inalterados
- **AND** o rodapé SHALL receber somente o novo destino na lista central
