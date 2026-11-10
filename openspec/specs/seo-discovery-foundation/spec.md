# seo-discovery-foundation Specification

## Purpose

Esta spec define a fundação técnica de descoberta orgânica do Vendeo: origem canônica `https://vendeo.tech` (sem `www`) e `metadataBase` com URLs absolutas por ambiente; metadata aprovada da home (sem alterar o conteúdo visível) e metadata de compartilhamento (Open Graph/Twitter com a imagem institucional); política explícita de indexação (`index`/`noindex`) por rota e por ambiente, com `noindex` como padrão fail-closed — a home, `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja` são as **exceções explícitas**, indexáveis somente sob produção confirmada (`VERCEL_ENV === "production"`) e origem canônica validada; `robots.txt` e `sitemap.xml` restritos a URLs canônicas realmente indexáveis, sem `Disallow` que impeça a leitura do `noindex`; tratamento de documentos legais, versões Markdown e APIs; e a fronteira da fatia, que não promete indexação, tráfego ou posição no Google.
## Requirements
### Requirement: Origem canônica e auditoria de host/protocolo

A aplicação SHALL tratar `https://vendeo.tech` (sem `www`) como origem canônica. A auditoria de host/protocolo/redirects SHALL ser registrada como achados, e a canonicalização efetiva (`www` → apex, HTTPS, aliases de transição) SHALL ser considerada configuração operacional externa (Vercel/DNS). Esta fatia SHALL NOT presumir que os redirects existentes já estejam corretos, SHALL NOT alterar configuração externa e SHALL NOT alterar os redirects de caminho existentes em `next.config.ts`.

#### Scenario: Origem canônica declarada e não presumida

- **WHEN** a fundação de descoberta é revisada
- **THEN** `https://vendeo.tech`, sem `www`, é a origem canônica declarada
- **AND** a configuração de host/protocolo é registrada como pendência operacional externa auditada, sem presunção de que já esteja correta

#### Scenario: Nenhuma alteração externa ou de redirects de caminho

- **WHEN** a implementação é revisada
- **THEN** nenhuma configuração de DNS, Vercel ou Supabase é alterada
- **AND** os redirects de caminho existentes em `next.config.ts` permanecem inalterados

### Requirement: metadataBase, validação da origem e URLs absolutas por ambiente

A aplicação SHALL definir `metadataBase` e SHALL emitir URLs absolutas para canonical e compartilhamento. Em produção, a origem canônica SHALL ser `https://vendeo.tech` (sem `www`) e SHALL derivar de `NEXT_PUBLIC_SITE_URL` **após validação explícita** — não basta verificar existência: o helper SHALL interpretar a URL e exigir protocolo `https`, host exatamente `vendeo.tech` e ausência de `www`, caminho, query ou fragmento. A validação SHALL residir em `src/lib/seo/*` e SHALL NOT alterar o helper compartilhado de autenticação (`src/lib/supabase/site-url.ts`). Fora de produção, `metadataBase` SHALL derivar do host da execução (por exemplo `VERCEL_URL`) ou de `http://localhost:3000`, de modo que previews nunca emitam canonical de produção.

O helper SHALL responder **sem lançar exceção** e **sem emitir URLs divergentes**: em caso de valor ausente, inválido ou não canônico, ele SHALL retornar um resultado explícito (por exemplo `{ origin: null, status: "missing" | "invalid" | "non_canonical", indexable: false }`), o `metadataBase`/canonical SHALL recair sobre a origem de execução ou ser omitido, a indexabilidade SHALL ser `false` e SHALL haver diagnóstico identificável. A aplicação SHALL NOT falhar de forma inesperada por causa da origem.

A indexabilidade SHALL depender de **produção confirmada (`VERCEL_ENV === "production"`) e origem canônica validada**. Como a exposição das variáveis de sistema é uma configuração da Vercel, a ausência de `VERCEL_ENV` SHALL continuar **fail-closed** (não indexável) e SHALL ser conferida operacionalmente antes da publicação.

#### Scenario: Produção usa a origem canônica validada

- **WHEN** a metadata é gerada em produção
- **AND** `NEXT_PUBLIC_SITE_URL` é exatamente `https://vendeo.tech`
- **THEN** `metadataBase` corresponde a `https://vendeo.tech`
- **AND** canonical e URLs de compartilhamento são absolutas

#### Scenario: Valor ausente, inválido ou não canônico falha fechado

- **WHEN** `NEXT_PUBLIC_SITE_URL` está ausente, é inválida ou difere de `https://vendeo.tech` (por exemplo `http://`, `www`, caminho, query ou fragmento)
- **THEN** a aplicação não se declara indexável, não emite `index, follow` e não publica URLs canônicas divergentes
- **AND** a condição é identificável antes da publicação
- **AND** o helper de autenticação `src/lib/supabase/site-url.ts` permanece inalterado

#### Scenario: Origem inválida não lança exceção nem emite URL divergente

- **WHEN** o helper de origem recebe `NEXT_PUBLIC_SITE_URL` ausente, inválida ou não canônica
- **THEN** ele não lança exceção
- **AND** ele não emite URL absoluta apontando para uma origem divergente
- **AND** ele retorna um resultado explícito com indexabilidade `false` e diagnóstico identificável

#### Scenario: Ausência de VERCEL_ENV é fail-closed e identificável

- **WHEN** `VERCEL_ENV` não está exposto na execução
- **THEN** o ambiente é tratado como não indexável
- **AND** a ausência é registrada como conferência operacional antes da publicação

#### Scenario: Preview não emite canonical de produção

- **WHEN** a metadata é gerada em uma preview ou localmente
- **THEN** `metadataBase` não aponta para a origem canônica de produção

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

### Requirement: Metadata de compartilhamento coerente

A home SHALL fornecer metadata de compartilhamento coerente (Open Graph e Twitter) com URL absoluta, locale `pt_BR`, `siteName` `Vendeo` e a imagem institucional aprovada.

#### Scenario: Compartilhamento com URL absoluta

- **WHEN** a metadata de compartilhamento é gerada
- **THEN** `openGraph` e `twitter` referenciam URLs absolutas derivadas de `metadataBase`
- **AND** a imagem de compartilhamento é a composição institucional aprovada

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

### Requirement: Distinção de ambiente fail-closed

A indexabilidade SHALL ser habilitada **somente** quando houver produção confirmada (`VERCEL_ENV === "production"`) **e** origem canônica validada. Previews, desenvolvimento, builds locais e produção com origem ausente, inválida ou não canônica SHALL ser tratados como não indexáveis, com `noindex` aplicado de forma que a home só seja `index` sob a condição combinada.

#### Scenario: Produção com origem validada é indexável

- **WHEN** o ambiente é produção confirmada **e** a origem canônica é válida
- **THEN** a home é `index, follow`
- **AND** `robots.txt` permite crawling das superfícies públicas e referencia o sitemap
- **AND** o sitemap contém a home

#### Scenario: Produção com origem inválida não é indexável

- **WHEN** o ambiente é produção, mas a origem canônica está ausente, é inválida ou é não canônica
- **THEN** a home não recebe `index, follow` (`noindex`)
- **AND** o sitemap não lista URLs
- **AND** `robots.txt` não referencia um sitemap divergente
- **AND** a condição é identificável por diagnóstico antes da publicação

#### Scenario: Preview e local noindex

- **WHEN** o ambiente é preview, desenvolvimento ou build local
- **THEN** todas as rotas recebem `X-Robots-Tag: noindex`
- **AND** `robots.txt` não bloqueia o rastreamento a ponto de impedir a leitura do `noindex`
- **AND** o sitemap não lista URLs indexáveis
- **AND** a home não recebe `index`

#### Scenario: Home de produção com origem validada não herda noindex

- **WHEN** a configuração é revisada
- **THEN** a lógica de `noindex` depende de produção confirmada **e** origem canônica validada, não de `NODE_ENV`, `build` ou execução local
- **AND** não há caminho em que a home, sob produção confirmada com origem validada, receba `noindex`
- **AND** fora dessa condição combinada a home é `noindex`

### Requirement: robots.txt sem impedir a leitura do noindex

A aplicação SHALL fornecer `robots.txt` que orienta o crawling e referencia o sitemap em produção sob origem validada, e SHALL NOT impedir a leitura do `noindex`: nenhuma superfície que dependa de `noindex` — em produção **ou** fora dela — SHALL receber bloqueio de rastreamento que impeça o robô de acessar a página e ler a instrução. Fora de produção — ou em produção com origem ausente, inválida ou não canônica —, a não indexação SHALL ser garantida por `X-Robots-Tag: noindex`, pela ausência de `index` e pelo sitemap sem URLs, e não por `Disallow`; nesses casos o `robots.txt` SHALL NOT referenciar um sitemap divergente.

#### Scenario: robots.txt referencia o sitemap em produção com origem validada

- **WHEN** `robots.txt` é solicitado em produção confirmada com origem canônica validada
- **THEN** ele referencia o sitemap absoluto
- **AND** permite o crawling das superfícies públicas

#### Scenario: Disallow não bloqueia páginas com noindex

- **WHEN** `robots.txt` é revisado
- **THEN** nenhuma rota que dependa de `noindex` (por exemplo `/login`, `/termos`, `/docs/**`) aparece em `Disallow`

#### Scenario: Não-produção não bloqueia a leitura do noindex

- **WHEN** `robots.txt` é solicitado fora de produção
- **THEN** ele não bloqueia o rastreamento de forma que impeça o robô de ler o `noindex`
- **AND** a não indexação é garantida por `X-Robots-Tag: noindex` e pela ausência de URLs no sitemap

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

### Requirement: Documentos legais e versões Markdown acessíveis mas não indexáveis

As páginas `/termos`, `/privacidade` e `/uso-aceitavel` SHALL ser `noindex` e SHALL permanecer acessíveis pelos links existentes. As versões Markdown públicas em `/docs/legal/*.md` SHALL receber `X-Robots-Tag: noindex` sem remover o acesso legítimo e sem `Disallow`.

#### Scenario: Documentos legais acessíveis e noindex

- **WHEN** os documentos legais são solicitados
- **THEN** eles permanecem acessíveis pelos links existentes
- **AND** são servidos com `noindex`

#### Scenario: Versões Markdown sem competir no índice

- **WHEN** um arquivo `/docs/legal/*.md` é solicitado
- **THEN** ele é servido com `X-Robots-Tag: noindex`
- **AND** o acesso ao arquivo não é removido

### Requirement: Tratamento de APIs fora do sitemap

`/api/**` SHALL ficar fora do sitemap e SHALL receber `X-Robots-Tag: noindex`, sem alterar a lógica das rotas, seus códigos de resposta nem headers preexistentes.

#### Scenario: API não indexável e comportamento preservado

- **WHEN** uma rota `/api/**` responde
- **THEN** a resposta inclui `X-Robots-Tag: noindex`
- **AND** a lógica da rota, o status e os headers preexistentes permanecem inalterados

### Requirement: Imagem de compartilhamento institucional

A imagem de compartilhamento SHALL ser uma composição institucional com ativos oficiais do Vendeo, produzida por composição determinística local, preservando proporção, marca e slogan, sem deformação nem recorte. A composição SHALL NOT usar geração por IA nem chamadas pagas. Os caminhos locais dos ativos SHALL ser fontes de trabalho e SHALL NOT aparecer como URLs no código público. A composição exata SHALL ser aprovada visualmente por humano antes da incorporação final, e os logos já usados na landing SHALL NOT ser alterados.

#### Scenario: Composição determinística e sem IA

- **WHEN** a imagem de compartilhamento é produzida
- **THEN** ela usa os ativos oficiais por composição determinística
- **AND** nenhuma geração por IA ou chamada paga é executada

#### Scenario: Marca preservada e aprovada

- **WHEN** a composição é revisada
- **THEN** proporção, marca e slogan são preservados, sem deformação ou recorte
- **AND** a composição foi aprovada visualmente antes da incorporação final

#### Scenario: Caminhos locais fora do código

- **WHEN** o código público é revisado
- **THEN** nenhuma referência a caminhos locais de arquivos de logo aparece como URL
- **AND** apenas o caminho público do asset final é referenciado

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
