# floriculturas-demonstration-page Specification

## Purpose

Página pública demonstrativa `/floriculturas`: composição e copy aprovadas, aviso demonstrativo único, conteúdo estático com o par aprovado (foto sintética de orquídea e campanha da floricultura fictícia Donna Flor), texto gerado exibido em HTML, entrega responsiva com duas variantes WebP por imagem, metadata/canonical por ambiente e preservação das demais superfícies de indexação.
## Requirements
### Requirement: Rota pública `/floriculturas` com composição aprovada

O sistema SHALL disponibilizar a página pública `/floriculturas` em `pt-BR`, como Server Component em `src/app/(marketing)/floriculturas/page.tsx`, sem exigir autenticação e sem layout próprio.

A página SHALL apresentar, nesta ordem: abertura com H1, texto de abertura e primeiro CTA; demonstração com título, foto enviada, campanha criada, rótulos e aviso demonstrativo; explicação da transformação com o texto gerado; segundo bloco sobre criação de posts, contendo a copy aprovada e um único exemplo complementar de oferta (texto e campanha da Flor Kalandiva); funcionamento em quatro passos; encerramento com chamada final, texto de apoio e segundo CTA; rodapé com links legais.

A página SHALL ter um único `h1` e hierarquia de títulos coerente (`h2` por bloco, `h3` nos passos e no exemplo complementar).

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

#### Scenario: Exemplo complementar em duas colunas no desktop e em sequência no mobile
- **WHEN** a página é exibida em desktop
- **THEN** o exemplo complementar SHALL compor o texto à esquerda e a campanha à direita
- **AND** o bloco textual SHALL ficar centralizado verticalmente em relação à campanha, com as linhas alinhadas à esquerda
- **WHEN** a página é exibida em mobile
- **THEN** a ordem SHALL ser título da seção, lista, subtítulo, parágrafo, imagem e aviso demonstrativo único
- **AND** nenhuma altura SHALL ser forçada para igualar texto e imagem

### Requirement: Copy aprovada sem acréscimos

A página SHALL usar exatamente a copy aprovada pelo responsável para H1, texto de abertura, título da demonstração, rótulos das imagens, explicação, título e lista do segundo bloco, título do exemplo complementar, texto de acompanhamento do exemplo, título e itens do funcionamento, chamada final e texto de apoio.

No segundo bloco, a copy aprovada é:

- título: “Crie posts para sua floricultura sem começar do zero.”;
- lista, com marcadores simples: “Apresente novos buquês e arranjos.”, “Destaque as flores disponíveis na semana.” e “Divulgue opções para presentear em ocasiões especiais.”;
- título do exemplo: “Uma oferta da sua floricultura, pronta para divulgar.”;
- texto do exemplo, como um único parágrafo: “Quando tiver uma oferta sazonal, transforme a foto do produto, o preço e as condições em uma campanha para suas redes sociais. Destaque o produto, informe o preço e apresente as condições da oferta com a identidade da sua loja.”.

No encerramento, o título permanece “Como ficaria uma campanha com os produtos da sua floricultura?” e o apoio é “Suas flores, sua marca, uma campanha pronta para divulgar.”, sem acumular a frase anterior.

A página SHALL NOT acrescentar blocos ou frases de advertência comercial, incluindo “não promete vendas”, “não mede tempo de geração” e “foto criada com IA”. Restrições internas de planejamento SHALL permanecer fora da copy pública.

A página SHALL NOT exibir tabela de entrada ou qualquer dado de geração não fornecido.

A proibição de preço, oferta ou selo refere-se a **acrescentar à página informações não aprovadas**. Ela SHALL NOT ser interpretada como remoção, recorte ou ocultação de elementos que já fazem parte das imagens aprovadas — por exemplo, o selo “Destaque da Semana” na campanha da orquídea e o preço “R$ 4,99” e a condição “Enquanto durarem os estoques” na campanha da Flor Kalandiva. As imagens aprovadas SHALL ser exibidas integralmente, sem corte.

O preço e a condição de estoque integram a arte demonstrativa aprovada. Seu caráter demonstrativo decorre do contexto do exemplo e do aviso único, não do formato de entrega. Para que não sejam lidos como oferta do Vendeo, a página SHALL NOT reproduzi-los como copy, metadata, Open Graph, Twitter, JSON-LD, sitemap ou qualquer promessa comercial do Vendeo.

#### Scenario: Copy aprovada sem desvios
- **WHEN** a página renderizada é comparada à copy aprovada
- **THEN** os textos SHALL corresponder ao conteúdo aprovado
- **AND** não SHALL existir bloco de advertência comercial adicional

#### Scenario: Nenhuma informação não aprovada acrescentada à página
- **WHEN** a página é revisada
- **THEN** não SHALL existir tabela de entrada, preço, oferta ou selo **como texto novo da página**
- **AND** nenhum texto SHALL afirmar dados de geração não fornecidos

#### Scenario: Imagens aprovadas exibidas integralmente
- **WHEN** as campanhas aprovadas são exibidas
- **THEN** elementos internos das artes, como o selo “Destaque da Semana”, o preço “R$ 4,99”, a condição “Enquanto durarem os estoques” e “Imagem meramente ilustrativa”, SHALL permanecer visíveis
- **AND** as imagens SHALL NOT ser recortadas, cobertas ou tratadas para remover conteúdo

#### Scenario: Preço demonstrativo fora da copy e da metadata
- **WHEN** o HTML e a metadata da página são inspecionados
- **THEN** o valor “R$ 4,99” SHALL NOT aparecer como texto, atributo, metadata ou dado estruturado
- **AND** a arte SHALL permanecer no contexto do exemplo demonstrativo, coberto pelo aviso único

### Requirement: Texto gerado exibido em HTML ao lado da explicação

A página SHALL exibir, na mesma seção da explicação, um card com o título aprovado “Além da arte, o texto para acompanhar sua publicação.” e, dentro dele, o conteúdo exato gerado para a campanha demonstrativa: título, legenda, hashtags e chamada final.

O card SHALL ser renderizado como texto HTML, não como captura de tela da interface, e SHALL NOT reproduzir botões “Copiar” nem qualquer controle operacional do aplicativo.

No desktop e no mobile, o card SHALL ficar em sequência vertical, abaixo do parágrafo de explicação, no mesmo bloco de leitura de largura limitada. O card SHALL ser visualmente secundário em relação ao par de imagens.

#### Scenario: Conteúdo gerado exibido integralmente
- **WHEN** a página é renderizada
- **THEN** o card SHALL conter o título “Além da arte, o texto para acompanhar sua publicação.”
- **AND** SHALL conter o título “Orquídea Phalaenopsis: beleza em cada cor”
- **AND** SHALL conter a legenda, as quatro hashtags e a chamada final exatas fornecidas

#### Scenario: Texto em HTML, não captura de interface
- **WHEN** o HTML da página é inspecionado
- **THEN** o card SHALL ser composto por elementos de texto
- **AND** SHALL NOT conter imagem do texto gerado nem botão “Copiar”

#### Scenario: Card secundário em coluna única
- **WHEN** a seção de explicação é exibida
- **THEN** o card SHALL aparecer abaixo do parágrafo, em desktop e mobile
- **AND** SHALL NOT competir visualmente com o par foto/campanha

### Requirement: Comparação alinhada pelo topo e leitura em coluna única

Na demonstração, os rótulos SHALL ocupar a mesma linha e as imagens SHALL começar na mesma altura no desktop. A comparação SHALL alinhar pelo topo (`items-start`), preservar as proporções originais e não recortar; a diferença de altura entre a foto e a campanha SHALL aparecer na base.

Na seção de explicação, o parágrafo e o card do texto gerado SHALL ficar em sequência vertical — parágrafo acima, card abaixo — dentro de um mesmo bloco de leitura com largura limitada. O card SHALL NOT se esticar por toda a largura da página.

#### Scenario: Rótulos e imagens alinhados no desktop
- **WHEN** a demonstração é exibida em desktop
- **THEN** os dois rótulos SHALL estar na mesma linha
- **AND** as duas imagens SHALL começar na mesma altura
- **AND** nenhuma imagem SHALL ser recortada

#### Scenario: Explicação e card em coluna única
- **WHEN** a seção de explicação é exibida
- **THEN** o parágrafo SHALL vir antes do card
- **AND** ambos SHALL estar no mesmo bloco de leitura de largura limitada
- **AND** o card SHALL NOT ocupar a largura total da página

### Requirement: Caminho secundário para conhecer o Vendeo

A abertura SHALL oferecer somente o grupo visual de botões, sem card, resumo,
complemento ou expansível. O encerramento SHALL oferecer o conjunto de acesso
dentro do único card de oferta da página.

Os dois conjuntos SHALL preservar os mesmos rótulos e a mesma composição por
estado da flag. No desktop, com o cadastro fechado, o CTA “Solicitar acesso
gratuito” e o link “Conheça o Vendeo” ficam lado a lado, com a mesma altura; com
o cadastro aberto, Google e e-mail ficam lado a lado em colunas iguais e o link
institucional fica centralizado abaixo do par. No mobile, todos empilham com a
mesma largura e o mesmo alinhamento.

Na abertura, todas as ações de aquisição SHALL ser links locais para o card do
encerramento (`#floriculturas-oferta`) e SHALL NOT iniciar OAuth, abrir cadastro
ou navegar para fora da página. No estado aberto, a abertura SHALL NOT renderizar
o `GoogleButton` funcional; usa links locais com aparência equivalente. O link
“Conheça o Vendeo” continua apontando para `/`, na mesma aba, sem âncora.

No encerramento, o card mantém as ações reais conforme a flag: Google/OAuth e
e-mail (`/signup`) com o cadastro aberto, ou solicitação (`/#acesso`) com o
cadastro fechado. O link “Conheça o Vendeo” permanece em `/`.

O link secundário SHALL NOT apontar para `/#acesso` e SHALL NOT alterar a home nem
os CTAs dos demais consumidores.

#### Scenario: Abertura com prévia local, sem card

- **WHEN** a página é renderizada
- **THEN** a abertura exibe apenas o grupo visual de botões
- **AND** não exibe card, resumo, complemento nem expansível
- **AND** “Conheça o Vendeo” aponta para `/`

#### Scenario: Ações da abertura apenas navegam por âncora

- **WHEN** o cadastro está fechado
- **THEN** “Solicitar acesso gratuito” da abertura aponta para `#floriculturas-oferta`
- **WHEN** o cadastro está aberto
- **THEN** os controles “Continuar com Google” e “Continuar com email” da abertura
  são links locais para `#floriculturas-oferta`
- **AND** nenhum deles inicia OAuth ou abre `/signup`

#### Scenario: Encerramento com o único card e ações reais

- **WHEN** a página é renderizada
- **THEN** existe exatamente um card de oferta, no encerramento
- **AND** com a flag desligada, o CTA do card aponta para `/#acesso`
- **AND** com a flag ligada, o card mantém Google/OAuth e e-mail para `/signup`

#### Scenario: Lado a lado no desktop e empilhado no mobile

- **WHEN** a página é exibida em desktop
- **THEN** o CTA principal e o link secundário SHALL ficar lado a lado com a mesma
  altura no cadastro fechado
- **AND** com o cadastro aberto, Google e e-mail SHALL ficar lado a lado e o link
  institucional centralizado abaixo
- **AND** em mobile SHALL empilhar com a mesma largura e alinhamento

#### Scenario: Link secundário não usa a âncora de acesso

- **WHEN** o link “Conheça o Vendeo” é inspecionado
- **THEN** o destino SHALL ser `/`
- **AND** SHALL NOT ser `/#acesso`

### Requirement: Único card compacto de oferta no encerramento

O encerramento SHALL conter um único card compacto de oferta, reutilizando cores,
bordas, fontes e hierarquia do card da home. O card SHALL exibir o resumo “28 dias
gratuitos e até 20 créditos.”, o complemento “Sem cartão de crédito. Oferta para
novas contas elegíveis.” e o expansível “Como funciona o teste gratuito?”.

Com o cadastro fechado, o card SHALL exibir ainda o CTA “Solicitar acesso
gratuito”, o apoio “Solicite seu convite para experimentar o Vendeo.” e, nos
detalhes, a informação de que solicitar acesso não inicia o período do teste. Com
o cadastro aberto, o card SHALL preservar “Continuar com Google” e “Continuar com
email” e SHALL NOT exibir o CTA fechado, o apoio de convite nem a nota de período.

Os textos SHALL vir da fonte local única `src/components/landing/public-offer-copy.ts`,
sem duplicação entre a versão completa e a compacta. A abertura SHALL NOT repetir
esses textos.

O card SHALL ter um ID único e estável (`floriculturas-oferta`) como destino das
âncoras da abertura, com `tabindex="-1"` e margem de rolagem suficiente para que
o início do card fique visível e focável pelo teclado. O expansível SHALL ser
nativo, acionável pelo teclado e independente.

#### Scenario: Card único com a comunicação aprovada

- **WHEN** `/floriculturas` é renderizada em qualquer estado da flag
- **THEN** existe exatamente um card de oferta
- **AND** ele exibe o resumo, o complemento e o expansível aprovados
- **AND** a abertura não repete nenhum desses textos

#### Scenario: Estados da flag no card único

- **WHEN** o cadastro está fechado
- **THEN** o card exibe “Solicitar acesso gratuito”, o apoio de convite e a nota
  de que solicitar acesso não inicia o período
- **WHEN** o cadastro está aberto
- **THEN** o card exibe Google e e-mail e não exibe CTA fechado, apoio de convite
  nem nota de período

#### Scenario: Destino de âncora visível e acessível

- **WHEN** um link da abertura é acionado pelo mouse ou pelo teclado
- **THEN** a navegação leva ao início do card (`#floriculturas-oferta`)
- **AND** o card é focável (`tabindex="-1"`) e não fica oculto sob o topo
- **AND** o expansível do card permanece acionável pelo teclado

#### Scenario: Sem overflow em mobile

- **WHEN** a página é exibida em viewport de 390 px
- **THEN** o card e o rótulo “Solicitar acesso gratuito” SHALL permanecer dentro
  da largura disponível
- **AND** não SHALL haver overflow horizontal

### Requirement: Aviso demonstrativo único e discreto

A página SHALL exibir uma única vez o texto aprovado “As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas”, junto ao conjunto de exemplos, em tipografia secundária e sem competir com o conteúdo principal.

O aviso SHALL ficar ao final do bloco enriquecido, imediatamente após o exemplo complementar, cobrindo tanto o par da orquídea quanto a campanha da Flor Kalandiva.

A página SHALL NOT repetir o aviso no rodapé nem apresentar os exemplos como depoimento, caso real, cliente ou resultado comercial.

#### Scenario: Aviso aparece uma única vez
- **WHEN** a página é renderizada
- **THEN** o texto do aviso demonstrativo SHALL aparecer exatamente uma vez
- **AND** SHALL estar visualmente associado ao conjunto de exemplos

#### Scenario: Exemplo não é apresentado como prova real
- **WHEN** o conteúdo é revisado
- **THEN** nenhum texto SHALL descrever a floricultura Donna Flor como cliente real ou os exemplos como depoimento
- **AND** nenhum resultado comercial SHALL ser atribuído aos exemplos

### Requirement: Conteúdo demonstrativo estático e par aprovado

A página SHALL usar somente o conjunto demonstrativo aprovado: a foto sintética da orquídea roxa no balcão, a campanha da floricultura fictícia Donna Flor gerada no Vendeo e a campanha aprovada da Flor Kalandiva (Pote 6) da mesma loja fictícia.

A campanha da Flor Kalandiva SHALL ser exibida como exemplo complementar de oferta com produto, preço e condição de estoque, sem se tornar oferta comercial do Vendeo.

A página SHALL NOT chamar API de geração, produzir arte ao vivo, executar geração paga ou depender de dados de campanha do usuário.

A página SHALL NOT reutilizar o par anterior `identidade-floricultura.webp` (“Dona Flor”, buquê de rosas).

#### Scenario: Página não invoca geração
- **WHEN** a página é carregada e utilizada
- **THEN** nenhuma chamada a provider ou API de geração SHALL ocorrer
- **AND** nenhum crédito SHALL ser consumido

#### Scenario: Apenas o conjunto aprovado é exibido
- **WHEN** os assets da página são revisados
- **THEN** a foto e as duas campanhas SHALL corresponder ao conjunto aprovado
- **AND** o asset `identidade-floricultura.webp` SHALL NOT ser referenciado pela página

### Requirement: Entrega responsiva com duas variantes por imagem

Cada uma das três imagens SHALL ser entregue em duas variantes WebP — uma menor e uma maior — com `srcset` e `sizes`, proporção original preservada e sem upscale. A foto SHALL manter a proporção da origem (1312×1199); as duas campanhas SHALL permanecer 1:1 sem corte.

A imagem identificada como LCP SHALL NOT receber `loading="lazy"`. A prioridade de carregamento SHALL ser definida pela medição no navegador, não pela área aparente: a hipótese inicial de que a campanha seria o LCP foi **refutada** — o elemento medido foi o `h1` em desktop (1440×900) e mobile (390×844). Portanto, as duas imagens da demonstração permanecem `eager`. O exemplo complementar, por ficar abaixo da abertura, SHALL usar `loading="lazy"`, com dimensões explícitas para evitar layout shift.

A implementação SHALL registrar as dimensões, os pesos finais dos arquivos entregues e a medição de LCP observada.

#### Scenario: Duas variantes por imagem
- **WHEN** os assets entregues são inspecionados
- **THEN** SHALL existir exatamente uma variante menor e uma maior para a foto
- **AND** SHALL existir exatamente uma variante menor e uma maior para cada campanha
- **AND** todas SHALL ser WebP com as dimensões contratadas e peso menor ou igual ao original correspondente

#### Scenario: LCP sem lazy-loading
- **WHEN** o HTML renderizado é inspecionado
- **THEN** nenhuma das duas imagens da demonstração SHALL ter `loading="lazy"`
- **AND** nenhuma imagem SHALL competir com o `h1` por prioridade alta quando a medição indicar o texto como LCP

#### Scenario: Exemplo complementar abaixo da abertura
- **WHEN** o exemplo da Flor Kalandiva é renderizado
- **THEN** ele SHALL usar `loading="lazy"` e `decoding="async"`
- **AND** SHALL declarar `width` e `height` explícitos
- **AND** SHALL usar `srcset` com dois candidatos e `sizes` compatível com a largura real de exibição

#### Scenario: Prioridade confirmada por medição
- **WHEN** o LCP é medido no navegador em desktop e mobile
- **THEN** o elemento vencedor SHALL ser registrado
- **AND** a prioridade de carregamento SHALL ser ajustada se o vencedor não for a campanha

#### Scenario: Proporção preservada
- **WHEN** a página é exibida em desktop ou mobile
- **THEN** a foto SHALL manter a proporção da origem
- **AND** as duas campanhas SHALL ser exibidas em caixa 1:1, sem corte
- **AND** preço, marca e condição de estoque da campanha da Flor Kalandiva SHALL permanecer legíveis

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
