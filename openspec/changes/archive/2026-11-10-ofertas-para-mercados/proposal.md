## Why

Mercados, mercearias e minimercados divulgam ofertas todos os dias, mas nem sempre
têm tempo, repertório de design ou uma agência para transformar a foto de um
produto e as condições da promoção em uma publicação pronta. As páginas públicas
`/floriculturas`, `/padarias` e `/campanhas-para-sua-loja` já demonstram que uma
prova visual concreta — foto enviada, campanha criada e kit de texto — responde à
dúvida “minha oferta vira uma campanha publicável?”. Falta a mesma resposta para o
segmento de mercados e mercearias, com conteúdo próprio e sem posicionar o Vendeo
como mercado, açougue, encarte multiproduto ou gestor de tráfego.

O material aprovado permite uma demonstração específica: a foto do coxão mole no
açougue, a campanha quadrada da Mercearia Tio João com preço anterior e
promocional, validade e marca preservada, e um exemplo complementar do café
Melitta da mesma marca fictícia. A entrega também precisa ser descobrível
organicamente, sem ampliar a indexação por acidente: hoje
`seo-discovery-foundation` declara exatamente quatro superfícies indexáveis. Esta
change atualiza essa política de forma explícita e limitada para incluir
`/ofertas-para-mercados`.

## What Changes

- Criar a rota pública `/ofertas-para-mercados` como Server Component em
  `src/app/(marketing)/ofertas-para-mercados/page.tsx`, em `pt-BR`, sem
  autenticação e sem layout próprio.
- Compor a página em: cabeçalho público; abertura com H1, apresentação breve e
  grupo de acesso; demonstração da foto horizontal do açougue para a campanha
  quadrada da carne; explicação consolidada em um único parágrafo sobre produto,
  preço anterior/promocional, período de validade da oferta e marca; kit de
  publicação em HTML; exemplo complementar do café;
  aviso demonstrativo único; encerramento com um único card de oferta; rodapé
  compartilhado.
- Posicionar as ações de aquisição da abertura como âncoras locais para
  `#ofertas-mercados-oferta` e manter as ações reais somente no card final,
  preservando os dois estados da flag.
- Exibir o kit de publicação exatamente como aprovado — título, legenda, hashtags
  e chamada — em HTML, sem botões “Copiar”.
- Entregar a foto horizontal e a campanha quadrada em duas variantes WebP por
  imagem, com `srcset`, `sizes`, dimensões explícitas, sem recorte e sem upscale.
- Reutilizar os derivados WebP existentes do café aprovado, sem criar assets
  redundantes.
- Reutilizar a fonte central `public-offer-copy.ts` e o `OfferCard` compacto, sem
  duplicar números, condições ou rótulos da oferta.
- Declarar metadata própria, canonical absoluto `/ofertas-para-mercados`,
  Open Graph/Twitter com a imagem institucional existente e indexação somente sob
  produção confirmada + origem canônica validada.
- Incluir `/ofertas-para-mercados` no sitemap e o destino “Mercados e mercearias”
  somente na lista central do rodapé compartilhado, sem editar manualmente os
  quatro consumidores.
- Atualizar `seo-discovery-foundation` para cinco superfícies indexáveis
  explicitamente aprovadas e `public-footer-navigation` para quatro destinos de
  conteúdo.
- Não incluir dados estruturados de mercado, açougue, produto, oferta, avaliação
  ou negócio fictício.
- Não alterar `/floriculturas`, `/padarias`, `/campanhas-para-sua-loja`, a home,
  política de oferta, créditos, elegibilidade, onboarding, autenticação, APIs,
  banco, migrations, flags ou configuração externa.

## Capabilities

### New Capabilities

- `ofertas-para-mercados-demonstration-page`: rota pública
  `/ofertas-para-mercados`, composição e copy aprovadas, demonstração estática da
  foto horizontal e da campanha quadrada da carne, explicação sobre preço e
  validade, kit de publicação em HTML, exemplo complementar do café, aviso único,
  entrega responsiva de duas variantes por imagem, oferta central e metadata
  própria com indexação fail-closed.

### Modified Capabilities

- `seo-discovery-foundation`: `/ofertas-para-mercados` passa a ser a quinta
  superfície indexável explicitamente aprovada; o sitemap pode conter cinco URLs
  sob a condição combinada; o rodapé público ganha o destino “Mercados e
  mercearias”; o default fail-closed e o `noindex` das demais rotas permanecem
  inalterados.
- `public-footer-navigation`: a lista central passa a conter quatro destinos de
  conteúdo e o rodapé compartilhado passa a ser renderizado também em
  `/ofertas-para-mercados`; a independência entre navegação e indexação permanece.

## Impact

- **Rotas:** nova `src/app/(marketing)/ofertas-para-mercados/page.tsx`.
- **Componentes:** novos componentes locais em
  `src/components/landing/mercados/**`; reutilização de `OfferCard`,
  `AcquisitionCta` e `public-offer-copy.ts` sem alteração.
- **Rodapé:** somente a lista central em `public-footer-nav.ts`; nenhum dos quatro
  consumidores atuais é editado manualmente.
- **SEO:** `src/lib/seo/indexation-policy.ts` e `src/app/sitemap.ts`.
  `robots.ts`, `robots-headers.ts`, `next.config.ts` e `middleware.ts`
  permanecem inalterados.
- **Assets:** quatro arquivos WebP novos em `public/mercados/`; o café reutiliza
  `/landing/hero-oferta-cafe.webp` e `/landing/variants/hero-oferta-cafe-480w.webp`.
  Os arquivos-fonte permanecem fora de `public/`.
- **Testes:** página, contrato de imagens, política de indexação, sitemap e
  rodapé compartilhado/home.
- **Banco/API/dependências:** sem migration, sem rota de API, sem nova dependência,
  sem geração paga ou autenticação real.
- **Validação:** testes focados, suíte local, typecheck, lint com limitação
  declarada, build, `git diff --check`, OpenSpec e aceite visual
  desktop/tablet/mobile.
- **Publicação:** checklist pós-deploy separado; nenhum deploy, merge, push, tag,
  sync ou archive nesta rodada.
