## MODIFIED Requirements

### Requirement: Metadata da home aprovada sem alterar o conteúdo visível

A home SHALL usar o título `Vendeo | Crie campanhas para redes sociais com IA` e a descrição `Crie campanhas para redes sociais sem precisar saber design ou marketing. Arte e texto com a identidade da sua loja, prontos para revisar, baixar e publicar.`. A aplicação SHALL NOT alterar o H1 aprovado (`O que seu negócio quer divulgar vira uma campanha pronta para publicar.`) nem o conteúdo visível da landing para atender à metadata.

A única alteração visível permitida na landing por esta change é a inclusão do link `Campanhas sem complicação`, apontando para `/campanhas-para-sua-loja`, imediatamente ao lado dos links existentes `Floriculturas` (para `/floriculturas`) e `Padarias` (para `/padarias`). Os links `Floriculturas` e `Padarias` SHALL permanecer inalterados. A inclusão SHALL NOT criar bloco novo, alterar a ordem dos blocos, substituir imagens, alterar CTAs ou reescrever textos existentes.

#### Scenario: Título e descrição exatos

- **WHEN** a metadata da home é gerada
- **THEN** o título é `Vendeo | Crie campanhas para redes sociais com IA`
- **AND** a descrição é `Crie campanhas para redes sociais sem precisar saber design ou marketing. Arte e texto com a identidade da sua loja, prontos para revisar, baixar e publicar.`

#### Scenario: Conteúdo visível preservado

- **WHEN** a implementação é revisada
- **THEN** o H1 permanece "O que seu negócio quer divulgar vira uma campanha pronta para publicar."
- **AND** nenhum texto visível, layout, campanha, logo ou CTA da landing é alterado
- **AND** a única adição visível é o link `Campanhas sem complicação` no rodapé, ao lado dos links existentes `Floriculturas` e `Padarias`

### Requirement: Política de indexação por rota e superfície

A aplicação SHALL definir explicitamente a indexação por superfície. As superfícies abaixo SHALL permanecer `noindex` e fora do sitemap; nenhuma página nova SHALL ser incluída no índice ou no sitemap automaticamente.

As superfícies indexáveis SHALL ser exatamente quatro, e somente sob **produção confirmada (`VERCEL_ENV === "production"`) e origem canônica validada**: a home `/`, a página demonstrativa `/floriculturas`, a página demonstrativa `/padarias` e a página demonstrativa `/campanhas-para-sua-loja`. Qualquer outra combinação — inclusive produção com origem ausente, inválida ou não canônica — SHALL resultar em `noindex`, sitemap sem URLs e diagnóstico identificável.

| Superfície | Indexação | Sitemap |
|---|---|---|
| `/` | `index, follow` (somente em produção confirmada **e** com origem canônica validada) | incluída somente nessa condição |
| `/floriculturas` | `index, follow` (somente em produção confirmada **e** com origem canônica validada) | incluída somente nessa condição |
| `/padarias` | `index, follow` (somente em produção confirmada **e** com origem canônica validada) | incluída somente nessa condição |
| `/campanhas-para-sua-loja` | `index, follow` (somente em produção confirmada **e** com origem canônica validada) | incluída somente nessa condição |
| `/campanhas`, `/campanhas/**` | `noindex, nofollow` (painel autenticado) | fora |
| `/login`, `/signup`, `/check-email`, `/forgot-password`, `/update-password` | `noindex, nofollow` | fora |
| `/auth/confirm`, `/auth/callback`, `/auth/signout` | `X-Robots-Tag: noindex` | fora |
| `(app)/**`, incluindo `/dashboard`, `/loja`, `/conta`, `/novidades` e `/legal/reaccept` | `noindex, nofollow` | fora |
| `/admin/**` | `noindex, nofollow` | fora |
| `/termos`, `/privacidade`, `/uso-aceitavel` | `noindex, nofollow` | fora |
| `/docs/legal/*.md` | `X-Robots-Tag: noindex` | fora |
| `/api/**` | `X-Robots-Tag: noindex` | fora |

`noindex`/`robots` SHALL NOT substituir autenticação nem controle de acesso. `Novidades` SHALL ser tratada como painel autenticado, não como página pública.

#### Scenario: Superfícies privadas e transitórias fora do índice

- **WHEN** a política de indexação é aplicada em produção confirmada com origem validada
- **THEN** autenticação, recuperação, callbacks, app, admin, documentos legais e APIs são `noindex`
- **AND** somente a home, `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja` são indexáveis

#### Scenario: Rota privada de campanhas preservada

- **WHEN** `/campanhas` ou qualquer subcaminho de `/campanhas` é avaliado
- **THEN** a política retorna `noindex` e `inSitemap: false`
- **AND** a nova rota pública `/campanhas-para-sua-loja` não é confundida com o prefixo privado

#### Scenario: Nenhuma inclusão automática

- **WHEN** uma rota ou superfície nova é adicionada
- **THEN** ela não é incluída no índice nem no sitemap sem decisão explícita
- **AND** `/campanhas-para-sua-loja` é a superfície nova aprovada por esta change

#### Scenario: Política da página nova é explícita

- **WHEN** `getSurfacePolicy("/campanhas-para-sua-loja")` é chamado
- **THEN** o contrato retorna política indexável com `inSitemap: true`
- **AND** qualquer path não aprovado continua retornando `noindex` e `inSitemap: false`

### Requirement: Padrão de não indexação para rotas não aprovadas

A não indexação SHALL ser o comportamento padrão verificável de toda página sem aprovação explícita, com a home, `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja` como **únicas exceções** nesta fatia. O default SHALL ser aplicado na raiz (`src/app/layout.tsx`) com `robots: noindex, nofollow`, e somente as quatro superfícies aprovadas SHALL sobrescrever para `index, follow` sob a condição combinada (produção confirmada e origem canônica validada). A herança de metadata SHALL ser verificada por teste: páginas futuras herdam o `noindex` por padrão, e as exceções são explícitas. Um sitemap vazio, isoladamente, SHALL NOT ser tratado como proteção contra indexação.

#### Scenario: Rota sem aprovação herda noindex

- **WHEN** uma rota nova é criada sem aprovação explícita de indexação
- **THEN** ela herda `noindex, nofollow` da raiz
- **AND** não é incluída no sitemap

#### Scenario: Apenas as superfícies aprovadas são exceção

- **WHEN** a política de indexação é revisada
- **THEN** somente `/`, `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja` sobrescrevem para `index, follow` sob a condição combinada
- **AND** cada sobrescrita é explícita e testada

#### Scenario: Herança de metadata verificada por teste

- **WHEN** os testes de metadata são executados
- **THEN** existe um teste que confirma que o default da raiz é `noindex`
- **AND** existe um teste que confirma que a home é indexável apenas sob a condição combinada (produção confirmada e origem canônica validada)
- **AND** existe um teste que confirma o mesmo comportamento para `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja`

### Requirement: sitemap restrito a URLs canônicas indexáveis

A aplicação SHALL fornecer `sitemap.xml` com URLs absolutas, públicas, canônicas e realmente indexáveis. O sitemap SHALL conter somente a home `${origin}/`, a página demonstrativa `${origin}/floriculturas`, a página demonstrativa `${origin}/padarias` e a página demonstrativa `${origin}/campanhas-para-sua-loja`, sob **produção confirmada com origem canônica validada**, e SHALL permanecer vazio fora de produção **ou** quando a origem estiver ausente, inválida ou não canônica. O sitemap SHALL NOT incluir `/api/**`, `/auth/**`, rotas autenticadas, admin, documentos legais, versões Markdown nem URLs com parâmetros.

#### Scenario: Sitemap contém as quatro URLs aprovadas em produção com origem validada

- **WHEN** o sitemap é gerado em produção confirmada com origem canônica validada
- **THEN** ele contém exatamente `/`, `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja`
- **AND** todas as URLs são absolutas e canônicas

#### Scenario: Sitemap vazio fora de produção ou com origem inválida

- **WHEN** o sitemap é gerado em preview, localmente, ou em produção com origem ausente, inválida ou não canônica
- **THEN** ele não lista URLs indexáveis
