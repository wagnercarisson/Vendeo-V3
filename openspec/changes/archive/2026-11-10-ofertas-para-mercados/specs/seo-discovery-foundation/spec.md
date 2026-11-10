## MODIFIED Requirements

### Requirement: Metadata da home aprovada sem alterar o conteúdo visível

A home SHALL usar o título `Vendeo | Crie campanhas para redes sociais com IA` e a descrição `Crie campanhas para redes sociais sem precisar saber design ou marketing. Arte e texto com a identidade da sua loja, prontos para revisar, baixar e publicar.`. A aplicação SHALL NOT alterar o H1 aprovado (`O que seu negócio quer divulgar vira uma campanha pronta para publicar.`) nem o conteúdo visível da landing para atender à metadata.

O rodapé da home SHALL poder ser renderizado pelo componente público compartilhado, agrupando `Floriculturas` (`/floriculturas`), `Padarias` (`/padarias`), `Mercados e mercearias` (`/ofertas-para-mercados`) e `Campanhas sem complicação` (`/campanhas-para-sua-loja`) sob “Explore o Vendeo”. A composição SHALL preservar os demais links e o aviso legal existentes. A alteração SHALL NOT criar bloco de conteúdo, alterar a ordem dos blocos, substituir imagens, alterar CTAs ou reescrever textos existentes. Nenhum destino do rodapé SHALL controlar sitemap, robots, canonical ou a política fail-closed.

#### Scenario: Título e descrição exatos

- **WHEN** a metadata da home é gerada
- **THEN** o título é `Vendeo | Crie campanhas para redes sociais com IA`
- **AND** a descrição é `Crie campanhas para redes sociais sem precisar saber design ou marketing. Arte e texto com a identidade da sua loja, prontos para revisar, baixar e publicar.`

#### Scenario: Conteúdo visível preservado

- **WHEN** a implementação é revisada
- **THEN** o H1 permanece "O que seu negócio quer divulgar vira uma campanha pronta para publicar."
- **AND** nenhum texto visível, layout, campanha, logo ou CTA da landing é alterado fora do rodapé
- **AND** os links `Floriculturas`, `Padarias`, `Mercados e mercearias` e `Campanhas sem complicação` permanecem no rodapé, agrupados sob “Explore o Vendeo”
- **AND** Termos, Privacidade, Uso Aceitável, Novidades, Contato, Entrar e o aviso legal permanecem disponíveis

#### Scenario: Indexação não é afetada pela navegação

- **WHEN** sitemap, robots e canonical são inspecionados
- **THEN** a lista de navegação do rodapé não é usada como fonte
- **AND** somente `/`, `/floriculturas`, `/padarias`, `/ofertas-para-mercados` e `/campanhas-para-sua-loja` permanecem como exceções indexáveis sob a condição combinada já existente
- **AND** os contratos fail-closed permanecem inalterados

### Requirement: Política de indexação por rota e superfície

A aplicação SHALL definir explicitamente a indexação por superfície. As superfícies abaixo SHALL permanecer `noindex` e fora do sitemap; nenhuma página nova SHALL ser incluída no índice ou no sitemap automaticamente.

As superfícies indexáveis SHALL ser exatamente cinco, e somente sob **produção confirmada (`VERCEL_ENV === "production"`) e origem canônica validada**: a home `/`, a página demonstrativa `/floriculturas`, a página demonstrativa `/padarias`, a página demonstrativa `/ofertas-para-mercados` e a página demonstrativa `/campanhas-para-sua-loja`. Qualquer outra combinação — inclusive produção com origem ausente, inválida ou não canônica — SHALL resultar em `noindex`, sitemap sem URLs e diagnóstico identificável.

| Superfície | Indexação | Sitemap |
|---|---|---|
| `/` | `index, follow` (somente em produção confirmada **e** com origem canônica validada) | incluída somente nessa condição |
| `/floriculturas` | `index, follow` (somente em produção confirmada **e** com origem canônica validada) | incluída somente nessa condição |
| `/padarias` | `index, follow` (somente em produção confirmada **e** com origem canônica validada) | incluída somente nessa condição |
| `/ofertas-para-mercados` | `index, follow` (somente em produção confirmada **e** com origem canônica validada) | incluída somente nessa condição |
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
- **AND** somente a home, `/floriculturas`, `/padarias`, `/ofertas-para-mercados` e `/campanhas-para-sua-loja` são indexáveis

#### Scenario: Rota privada de campanhas preservada

- **WHEN** `/campanhas` ou qualquer subcaminho de `/campanhas` é avaliado
- **THEN** a política retorna `noindex` e `inSitemap: false`
- **AND** a rota pública `/campanhas-para-sua-loja` não é confundida com o prefixo privado
- **AND** a nova rota `/ofertas-para-mercados` não é confundida com o prefixo privado

#### Scenario: Novidades tratada como painel

- **WHEN** a rota `/novidades` é avaliada
- **THEN** ela é tratada como painel autenticado (`(app)/**`), `noindex` e fora do sitemap

#### Scenario: Nenhuma inclusão automática

- **WHEN** uma rota ou superfície nova é adicionada
- **THEN** ela não é incluída no índice nem no sitemap sem decisão explícita
- **AND** `/ofertas-para-mercados` é a superfície nova aprovada por esta change

#### Scenario: Política da página nova é explícita

- **WHEN** `getSurfacePolicy("/ofertas-para-mercados")` é chamado
- **THEN** o contrato retorna política indexável com `inSitemap: true`
- **AND** qualquer path não aprovado continua retornando `noindex` e `inSitemap: false`

### Requirement: Padrão de não indexação para rotas não aprovadas

A não indexação SHALL ser o comportamento padrão verificável de toda página sem aprovação explícita, com a home, `/floriculturas`, `/padarias`, `/ofertas-para-mercados` e `/campanhas-para-sua-loja` como **únicas exceções** nesta fatia. O default SHALL ser aplicado na raiz (`src/app/layout.tsx`) com `robots: noindex, nofollow`, e somente as cinco superfícies aprovadas SHALL sobrescrever para `index, follow` sob a condição combinada (produção confirmada e origem canônica validada). A herança de metadata SHALL ser verificada por teste: páginas futuras herdam o `noindex` por padrão, e as exceções são explícitas. Um sitemap vazio, isoladamente, SHALL NOT ser tratado como proteção contra indexação.

#### Scenario: Rota sem aprovação herda noindex

- **WHEN** uma rota nova é criada sem aprovação explícita de indexação
- **THEN** ela herda `noindex, nofollow` da raiz
- **AND** não é incluída no sitemap

#### Scenario: Apenas as superfícies aprovadas são exceção

- **WHEN** a política de indexação é revisada
- **THEN** somente `/`, `/floriculturas`, `/padarias`, `/ofertas-para-mercados` e `/campanhas-para-sua-loja` sobrescrevem para `index, follow` sob a condição combinada
- **AND** cada sobrescrita é explícita e testada

#### Scenario: Herança de metadata verificada por teste

- **WHEN** os testes de metadata são executados
- **THEN** existe um teste que confirma que o default da raiz é `noindex`
- **AND** existe um teste que confirma que a home é indexável apenas sob a condição combinada (produção confirmada e origem canônica validada)
- **AND** existe um teste que confirma o mesmo comportamento para `/floriculturas`, `/padarias`, `/ofertas-para-mercados` e `/campanhas-para-sua-loja`

#### Scenario: Sitemap vazio não é proteção suficiente

- **WHEN** a estratégia de não indexação de uma rota é revisada
- **THEN** a rota depende de `noindex` (metadata ou `X-Robots-Tag`), e não apenas da ausência no sitemap

### Requirement: sitemap restrito a URLs canônicas indexáveis

A aplicação SHALL fornecer `sitemap.xml` com URLs absolutas, públicas, canônicas e realmente indexáveis. O sitemap SHALL conter somente a home `${origin}/`, a página demonstrativa `${origin}/floriculturas`, a página demonstrativa `${origin}/padarias`, a página demonstrativa `${origin}/ofertas-para-mercados` e a página demonstrativa `${origin}/campanhas-para-sua-loja`, sob **produção confirmada com origem canônica validada**, e SHALL permanecer vazio fora de produção **ou** quando a origem estiver ausente, inválida ou não canônica. O sitemap SHALL NOT incluir `/api/**`, `/auth/**`, rotas autenticadas, admin, documentos legais, versões Markdown nem URLs com parâmetros.

#### Scenario: Sitemap contém as cinco URLs aprovadas em produção com origem validada

- **WHEN** o sitemap é gerado em produção confirmada com origem canônica validada
- **THEN** ele contém exatamente `/`, `/floriculturas`, `/padarias`, `/ofertas-para-mercados` e `/campanhas-para-sua-loja`
- **AND** todas as URLs são absolutas e canônicas

#### Scenario: Sitemap vazio fora de produção ou com origem inválida

- **WHEN** o sitemap é gerado em preview, localmente, ou em produção com origem ausente, inválida ou não canônica
- **THEN** ele não lista URLs indexáveis

#### Scenario: Superfícies excluídas do sitemap

- **WHEN** o sitemap é revisado
- **THEN** APIs, callbacks de autenticação, rotas autenticadas, admin, documentos legais, versões Markdown e URLs com parâmetros estão ausentes

### Requirement: Fronteira da fatia e proibição de prometer indexação

A change SHALL ser implementada preferencialmente em `src/app/(marketing)/ofertas-para-mercados/**`, `src/components/landing/mercados/**`, `src/lib/seo/*`, `src/app/sitemap.ts`, `src/components/landing/public-footer-nav.ts`, metadata das páginas, `public/mercados/**` e testes correspondentes. A change SHALL NOT redesenhar a landing, alterar H1, layout, campanhas, logos ou CTAs da home, nem alterar código da F56, ledger, migrations, crédito, onboarding, autenticação, `middleware.ts`, `/floriculturas`, `/padarias` ou `/campanhas-para-sua-loja`. A única alteração visível na home SHALL ser o novo destino `Mercados e mercearias` no rodapé compartilhado.

A change SHALL NOT prometer indexação, tráfego ou posição no Google, aumento de vendas, conversão, tempo de geração ou preservação exata do produto.

#### Scenario: Landing aprovada preservada

- **WHEN** a implementação é revisada
- **THEN** H1, copy visível, layout, campanhas, logos e CTAs da landing permanecem inalterados
- **AND** nenhum código da F56, migration, crédito, onboarding, autenticação, `/floriculturas`, `/padarias`, `/campanhas-para-sua-loja` ou `middleware.ts` é alterado

#### Scenario: Sem promessa de indexação, tráfego ou posição

- **WHEN** o conteúdo técnico e a comunicação da fatia são revisados
- **THEN** nenhuma garantia de indexação, tráfego, posição no Google, conversão ou vendas é afirmada

#### Scenario: Sem promessa comercial na página pública

- **WHEN** a copy pública de `/ofertas-para-mercados` é revisada
- **THEN** nenhuma frase promete aumento de vendas, alcance, tráfego, posição no Google, conversão, tempo de geração ou preservação exata do produto
- **AND** nenhuma advertência comercial adicional é publicada além do aviso demonstrativo aprovado
