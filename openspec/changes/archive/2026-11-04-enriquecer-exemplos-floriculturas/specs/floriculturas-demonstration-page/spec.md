## MODIFIED Requirements

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
