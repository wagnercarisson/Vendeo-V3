## Why

Lojistas de padaria precisam divulgar o que produzem todos os dias, mas nem sempre
têm tempo, repertório de design ou uma agência para transformar a foto do pão, do
bolo ou da vitrine em uma publicação pronta. A página `/floriculturas` já provou
que uma demonstração visual concreta — foto enviada, campanha criada e kit de
texto — responde à dúvida “meu produto vira uma campanha publicável?”. Falta a
mesma resposta para padarias, com conteúdo próprio do segmento e sem posicionar o
Vendeo como padaria, confeitaria, agência ou ferramenta de anúncios pagos.

O material aprovado permite uma demonstração específica: a foto do Bolo Naked
Fruit, a campanha da marca fictícia Panificadora Dona Maria e um exemplo
complementar de pão francês fresquinho. A entrega também precisa ser descobrível
organicamente, sem ampliar a indexação por acidente: hoje `seo-discovery-foundation`
declara exatamente duas superfícies indexáveis. Esta change atualiza essa política
de forma explícita e limitada para incluir `/padarias`.

## What Changes

- Criar a rota pública `/padarias` como Server Component em
  `src/app/(marketing)/padarias/page.tsx`, em `pt-BR`, sem autenticação e sem
  layout próprio.
- Compor a página em: abertura com H1, texto e primeiro CTA; demonstração da foto
  do bolo para a campanha; explicação com o kit de publicação em HTML; situações
  comerciais de padaria; exemplo complementar do pão francês; aviso demonstrativo
  único; encerramento com um único card de oferta.
- Posicionar os CTAs da abertura como âncoras locais para `#padarias-oferta` e
  manter as ações reais (Google, e-mail ou solicitação) somente no card final,
  preservando os dois estados da flag.
- Exibir o kit de publicação exatamente como aprovado — título, legenda, hashtags
  e chamada — em HTML, sem botões “Copiar”.
- Entregar a demonstração principal (foto e campanha do bolo) e o exemplo
  complementar (campanha do pão) em duas variantes WebP por imagem, com `srcset`,
  `sizes`, dimensões explícitas, sem recorte e sem upscale.
- Tratar o exemplo do pão com texto à esquerda e imagem à direita no desktop,
  empilhados no mobile, e carregamento lazy por estar abaixo da dobra.
- Reutilizar a fonte central `public-offer-copy.ts` e o `OfferCard` compacto, sem
  duplicar números, condições ou rótulos da oferta.
- Declarar metadata própria, canonical absoluto `/padarias`, Open Graph/Twitter
  com a imagem institucional existente e indexação somente sob produção confirmada
  + origem canônica validada.
- Incluir `/padarias` no sitemap e um link “Padarias” ao lado de “Floriculturas”
  no rodapé da home, sem qualquer outra mudança visível na home.
- Atualizar `seo-discovery-foundation` para três superfícies indexáveis
  explicitamente aprovadas e para o novo link de rodapé.
- Não incluir dados estruturados `Bakery`, `LocalBusiness`, `Product`, `Offer`,
  `Review` ou `AggregateRating` para a loja fictícia, produtos, preços ou
  avaliações.
- Não alterar `/floriculturas`, política de oferta, créditos, elegibilidade,
  onboarding, autenticação, APIs, banco, migrations, flags ou configuração externa.

## Capabilities

### New Capabilities

- `padarias-demonstration-page`: rota pública `/padarias`, composição e copy
  aprovadas, demonstração estática do bolo com kit de publicação em HTML,
  situações comerciais de padaria, exemplo complementar do pão, aviso único,
  entrega responsiva de duas variantes por imagem, oferta central e metadata
  própria com indexação fail-closed.

### Modified Capabilities

- `seo-discovery-foundation`: `/padarias` passa a ser a terceira superfície
  indexável explicitamente aprovada, ao lado da home e de `/floriculturas`; o
  sitemap pode conter três URLs sob a condição combinada; o rodapé da home ganha
  o link “Padarias” ao lado de “Floriculturas”; o default fail-closed e o
  `noindex` das demais rotas permanecem inalterados.

## Impact

- **Rotas:** nova `src/app/(marketing)/padarias/page.tsx`.
- **Componentes:** novos componentes locais em
  `src/components/landing/padarias/**`; reutilização de `OfferCard`,
  `AcquisitionCta` e `public-offer-copy.ts` sem alteração.
- **Home:** somente o link “Padarias” no rodapé; nenhum outro texto, bloco,
  imagem, CTA ou ordem é alterado.
- **SEO:** `src/lib/seo/indexation-policy.ts` e `src/app/sitemap.ts`; a home
  recebe apenas o link de rodapé. `robots.ts`, `robots-headers.ts`,
  `next.config.ts` e `middleware.ts` permanecem inalterados.
- **Assets:** seis arquivos WebP novos em `public/padarias/` (duas variantes para
  cada uma das três imagens). Os arquivos-fonte permanecem fora de `public/`.
- **Testes:** página, contrato de imagens, política de indexação, sitemap e rodapé
  da home.
- **Banco/API/dependências:** sem migration, sem rota de API, sem nova dependência,
  sem geração paga ou autenticação real.
- **Validação:** testes focados, suíte local, typecheck, lint com limitação
  declarada, build, `git diff --check`, OpenSpec e aceite visual desktop/mobile.
- **Publicação:** checklist pós-deploy separado; nenhum deploy, merge, push, tag,
  sync ou archive nesta rodada.
