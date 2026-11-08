# campanhas-para-sua-loja-demonstration-page Specification

## Purpose

Define a página pública `/campanhas-para-sua-loja` como demonstração cross-segmento
do Vendeo: abertura centrada na rotina do pequeno lojista, dois casos de produto
(ração 1:1 e cama 9:16) com a mesma identidade demonstrativa, frase de consistência,
um único kit de publicação em HTML, bloco de rotina, aviso demonstrativo único e um
único card de oferta. A página identifica o Vendeo como aplicativo, não como pet
shop, agência, gestor de tráfego ou ferramenta de agendamento; não promete
resultado comercial, não publica média de tempo e não executa geração, provider ou
crédito.
## Requirements
### Requirement: Rota pública `/campanhas-para-sua-loja` com composição aprovada

O sistema SHALL disponibilizar a página pública `/campanhas-para-sua-loja` em
`pt-BR`, como Server Component em
`src/app/(marketing)/campanhas-para-sua-loja/page.tsx`, sem exigir autenticação e
sem layout próprio.

A página SHALL apresentar, nesta ordem: cabeçalho público; abertura com H1, texto
de abertura, linha de apoio e primeiro grupo de acesso; caso 1 com foto da ração
e campanha 1:1; caso 2 com foto da cama e campanha 9:16; frase-alinhada; kit de
publicação da cama; aviso demonstrativo único; bloco de rotina; encerramento com
chamada, texto de apoio e único card de oferta; rodapé com links legais.

A página SHALL ter um único `h1` e hierarquia de títulos coerente, com `h2` por
bloco e `h3` nos itens do bloco de rotina.

#### Scenario: Página renderiza a composição aprovada

- **WHEN** `/campanhas-para-sua-loja` é acessada sem sessão
- **THEN** a página SHALL ser servida sem redirect para `/login`
- **AND** os blocos SHALL aparecer na ordem aprovada
- **AND** SHALL existir exatamente um `h1`

#### Scenario: Mobile não comprime os casos

- **WHEN** a página é exibida em viewport mobile
- **THEN** H1, texto de abertura e primeiro grupo de acesso SHALL aparecer antes
  das imagens
- **AND** cada caso SHALL ser apresentado por vez, empilhado
- **AND** não SHALL haver overflow horizontal

### Requirement: Copy aprovada sem acréscimos

A página SHALL usar exatamente a copy aprovada pelo responsável para H1, texto de
abertura, linha de apoio, títulos e rótulos dos casos, marcadores de formato,
frase-alinhada, explicação, kit, aviso, bloco de rotina, chamada final e texto de
apoio.

A copy aprovada é a registrada em
`.planning/quick/261107-pdp-pagina-publica-praticidade-e-identidade/261107-pdp-COPY.md`,
com os dois ajustes editoriais aprovados em 2026-11-08 para o bloco de rotina,
incluindo o kit exato da cama:

- Título: `Cama Pet Comfort: aconchego para seu pet`
- Legenda: `Um destaque cheio de carinho na vitrine do Pet Shop Bicho Fofo: a Cama Pet Comfort é macia e confortável, perfeita para dar ao seu companheiro um cantinho especial de descanso. Seu pet merece esse mimo! 🐾`
- Hashtags: `#CamaPetComfort #ConfortoPet #Petshop #DestaquePet #BichoFofo`
- Chamada: `Venha conhecer na loja!`

O bloco de rotina SHALL usar exatamente:

- H2: `Feito para a rotina de quem atende, repõe e ainda divulga.`
- Parágrafo: `Quem administra uma loja precisa conciliar atendimento, estoque, fornecedores e divulgação. O Vendeo encurta o caminho entre o produto que está na vitrine e a publicação que precisa sair.`

A página SHALL NOT prometer conversão, aumento de vendas, alcance, tráfego, posição
no Google ou resultado comercial. SHALL NOT publicar a média de ~30 segundos,
contador ou prazo garantido. SHALL NOT sugerir publicação automática. SHALL NOT
explicar campos obrigatórios, badges, onboarding ou configuração técnica. SHALL
NOT reproduzir preço em texto, metadata ou dado estruturado.

#### Scenario: Kit exato e sem controles

- **WHEN** o kit da cama é renderizado
- **THEN** os quatro campos SHALL aparecer uma única vez cada, em HTML
- **AND** SHALL NOT existir botão “Copiar”, captura de tela ou controle operacional

#### Scenario: Aviso e frase-alinhada únicos

- **WHEN** a página é renderizada
- **THEN** o aviso demonstrativo aprovado SHALL aparecer uma única vez, após o kit
- **AND** a frase `Produtos diferentes. Formatos diferentes. A mesma identidade da sua loja.` SHALL aparecer uma única vez, no caso 2
- **AND** SHALL NOT existir bloco público adicional de advertência

#### Scenario: Bloco de rotina com os dois ajustes e a continuação preservada

- **WHEN** o bloco de rotina é renderizado
- **THEN** o H2 SHALL ser exatamente `Feito para a rotina de quem atende, repõe e ainda divulga.`
- **AND** o parágrafo SHALL começar com `Quem administra uma loja precisa conciliar atendimento, estoque, fornecedores e divulgação.`
- **AND** o parágrafo SHALL terminar com `O Vendeo encurta o caminho entre o produto que está na vitrine e a publicação que precisa sair.`
- **AND** os textos `Feita para a rotina de quem atende, repõe e ainda divulga.` e `Quem toca uma loja pequena acumula funções.` SHALL NOT aparecer
- **AND** nenhum outro texto da página SHALL mudar

#### Scenario: Nenhuma promessa comercial

- **WHEN** o HTML e a metadata são inspecionados
- **THEN** SHALL NOT haver promessa de vendas, conversão, alcance, tráfego, posição ou publicação automática
- **AND** SHALL NOT haver `R$` no texto HTML ou na metadata

### Requirement: Dois casos com formatos e identidade demonstrativa

A página SHALL demonstrar dois casos distintos, em seções próprias, sem
comprimir as quatro imagens em uma grade única:

- caso 1: foto da ração → campanha no formato 1:1;
- caso 2: foto da cama → campanha no formato 9:16.

Cada caso SHALL usar os rótulos `Foto enviada` e `Campanha criada com o Vendeo`,
um marcador textual de formato (`1:1` ou `9:16`) e um parágrafo próprio. A marca
fictícia Pet Shop Bicho Fofo SHALL ser comum aos dois casos, preservando a
identidade reconhecível. A página SHALL NOT afirmar reprodução visual exata da
foto nem consistência absoluta de identidade.

O caso 2 SHALL ser exibido em seção própria, com largura controlada no desktop,
proporção 9:16 preservada e `object-contain`; no mobile, SHALL ocupar a largura
útil sem recorte.

#### Scenario: Dois formatos preservados

- **WHEN** os dois casos são renderizados
- **THEN** o caso 1 SHALL manter a proporção 1:1
- **AND** o caso 2 SHALL manter a proporção 9:16
- **AND** nenhuma campanha SHALL ser recortada

#### Scenario: Sem grade única

- **WHEN** a composição é revisada
- **THEN** cada caso SHALL ocupar sua própria seção
- **AND** as quatro imagens SHALL NOT ser apresentadas em uma única grade

### Requirement: Oferta única e CTAs por estado da flag

A página SHALL exibir dois grupos de acesso: na abertura, em modo âncora local
para `#campanhas-oferta`; no encerramento, em modo real. O grupo SHALL preservar
os dois estados de `publicSignupEnabled`.

A página SHALL exibir exatamente um `OfferCard` compacto, com `id`
`campanhas-oferta`, `tabindex="-1"`, `scroll-mt-24` e todos os textos de
`public-offer-copy.ts`. A página SHALL NOT reescrever números, condições ou
rótulos da oferta.

#### Scenario: Cadastro fechado

- **WHEN** `publicSignupEnabled` é `false`
- **THEN** a abertura SHALL apontar para `#campanhas-oferta`
- **AND** o card SHALL usar `/#acesso`
- **AND** “Conheça o Vendeo” SHALL apontar para `/`

#### Scenario: Cadastro aberto

- **WHEN** `publicSignupEnabled` é `true`
- **THEN** a abertura SHALL usar Google e e-mail como âncoras locais
- **AND** o card SHALL usar Google/OAuth e `/signup`
- **AND** “Conheça o Vendeo” SHALL apontar para `/`

#### Scenario: Card único

- **WHEN** a página é renderizada
- **THEN** SHALL existir exatamente um card de oferta
- **AND** os textos centrais SHALL vir de `public-offer-copy.ts`

### Requirement: Imagens responsivas e desempenho

A página SHALL entregar duas variantes WebP por imagem, 480w e 1024w, com
proporção preservada, `srcset`, `sizes`, `width` e `height` explícitos, sem crop e
sem upscale. As variantes SHALL ser:

- foto da ração: 480×440 e 1024×939;
- campanha 1:1: 480×480 e 1024×1024;
- foto da cama: 480×720 e 1024×1536;
- campanha 9:16: 480×853 e 1024×1820.

O caso 1 SHALL usar carregamento `eager` quando estiver na primeira área de
leitura; o caso 2 SHALL usar `lazy` e `decoding="async"`. Nenhuma imagem SHALL
receber `fetchpriority="high"` antes de medição de LCP que a justifique. A página
SHALL NOT criar dependência, carrossel, modal ou fonte externa.

#### Scenario: Variantes corretas

- **WHEN** os assets são inspecionados
- **THEN** cada imagem SHALL ter dois candidatos, 480w e 1024w
- **AND** as proporções SHALL corresponder ao original
- **AND** nenhuma variante SHALL exceder o peso do original correspondente

#### Scenario: Sem recorte no 9:16

- **WHEN** a campanha 9:16 é renderizada em desktop ou mobile
- **THEN** ela SHALL usar `object-contain`
- **AND** a proporção 9:16 SHALL ser preservada
- **AND** nenhum conteúdo da arte SHALL ser cortado

### Requirement: Metadata própria, canonical e indexação fail-closed

A página SHALL declarar metadata própria: title
`Campanhas prontas para divulgar sua loja | Vendeo`, a descrição aprovada,
Open Graph e Twitter com a imagem institucional existente.

A página SHALL emitir canonical absoluto e `index, follow` somente sob produção
confirmada (`VERCEL_ENV === "production"`) e origem canônica validada. Fora dessa
condição, SHALL emitir `noindex, nofollow` e SHALL omitir o canonical de produção.

A rota SHALL ser incluída explicitamente em `INDEXABLE_CANONICAL_PATHS`, em
`getSurfacePolicy` e no sitemap. O sitemap SHALL conter exatamente quatro URLs sob
a condição combinada: `/`, `/floriculturas`, `/padarias` e
`/campanhas-para-sua-loja`. `/campanhas` e `/campanhas/**` SHALL permanecer
privados e fora do sitemap. Nenhum JSON-LD de loja, produto, oferta, avaliação ou
aplicação SHALL ser incluído.

#### Scenario: Produção válida

- **WHEN** a página é gerada em produção confirmada com origem canônica validada
- **THEN** SHALL emitir canonical `https://vendeo.tech/campanhas-para-sua-loja`
- **AND** SHALL emitir `index, follow`
- **AND** o sitemap SHALL conter quatro URLs

#### Scenario: Preview ou local

- **WHEN** a página é gerada em preview, local ou produção com origem inválida
- **THEN** SHALL emitir `noindex, nofollow`
- **AND** SHALL omitir canonical de produção
- **AND** o sitemap SHALL permanecer vazio

#### Scenario: Rota privada preservada

- **WHEN** `/campanhas` ou `/campanhas/**` é avaliada
- **THEN** SHALL permanecer `noindex` e fora do sitemap

### Requirement: Link único na home

A home SHALL exibir o link `Campanhas sem complicação`, apontando para
`/campanhas-para-sua-loja`, em um rodapé compartilhado que agrupa os destinos de
conteúdo sob “Explore o Vendeo”, ao lado de `Floriculturas` e `Padarias`.

O rodapé compartilhado SHALL preservar o conteúdo visível atual da home e os
demais links existentes. A nova composição SHALL NOT criar bloco de conteúdo,
alterar a ordem dos blocos, substituir imagens, alterar CTAs ou reescrever textos
existentes.

#### Scenario: Link presente e demais preservados

- **WHEN** o rodapé da home é renderizado
- **THEN** o link `Campanhas sem complicação` SHALL apontar para `/campanhas-para-sua-loja`
- **AND** `Floriculturas` e `Padarias` SHALL permanecer com seus destinos e rótulos
- **AND** o grupo “Explore o Vendeo” SHALL conter os três destinos
- **AND** nenhum outro conteúdo visível da home SHALL mudar

### Requirement: Acessibilidade estrutural

A página SHALL usar `header`, `main` e `footer`, um único `h1`, textos
alternativos preenchidos em todas as imagens, seta decorativa com `aria-hidden`,
kit em `dl`, oferta em `details`/`summary`, foco visível e alvos de toque de no
mínimo 44 px. A página SHALL NOT duplicar IDs.

#### Scenario: Estrutura acessível

- **WHEN** o HTML da página é inspecionado
- **THEN** SHALL existir um único `h1`
- **AND** todas as imagens SHALL ter `alt` não vazio
- **AND** a seta SHALL ser `aria-hidden`
- **AND** não SHALL haver IDs duplicados
