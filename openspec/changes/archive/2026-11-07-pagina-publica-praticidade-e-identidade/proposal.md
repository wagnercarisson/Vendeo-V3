## Why

O lojista de uma loja pequena já entende que precisa divulgar, mas hesita em
pagar por uma ferramenta quando a alternativa gratuita — montar a peça sozinho em
um editor, escrever a legenda e repetir o processo a cada produto — parece
suficiente. A home apresenta o produto; as páginas de segmento provam o resultado
para padarias e floriculturas. Falta uma página que responda diretamente à
pergunta “Por que vou pagar por isso?” com a rotina real da loja e com dois casos
concretos, em formatos diferentes, mantendo a mesma identidade.

O material aprovado permite essa demonstração sem nova geração: a foto da ração
gera uma campanha 1:1; a foto da cama gera uma campanha 9:16; ambas usam a marca
fictícia Pet Shop Bicho Fofo. O formato 9:16 está funcional e disponível em
produção. A página é cross-segmento: o pet shop é o exemplo visual, não o
posicionamento.

A entrega também precisa ser descobrível organicamente para intenções como
“aplicativo para criar campanhas”, “criar arte e legenda para produtos” e
“divulgar uma loja sem saber design”, sem ampliar a indexação por acidente. Hoje
`seo-discovery-foundation` declara exatamente três superfícies indexáveis; esta
change atualiza a política de forma explícita e limitada para incluir a nova rota.

## What Changes

- Criar a rota pública `/campanhas-para-sua-loja` como Server Component em
  `src/app/(marketing)/campanhas-para-sua-loja/page.tsx`, em `pt-BR`, sem
  autenticação e sem layout próprio.
- Compor a página em: abertura com H1, texto, linha de apoio e primeiro grupo de
  acesso; caso 1 (foto da ração → campanha 1:1); caso 2 (foto da cama → campanha
  9:16); frase-alinhada; kit de publicação da cama em HTML; aviso demonstrativo
  único; bloco de rotina; encerramento com um único card de oferta.
- Posicionar os CTAs da abertura como âncoras locais para `#campanhas-oferta` e
  manter as ações reais (Google, e-mail ou solicitação) somente no card final,
  preservando os dois estados da flag.
- Exibir o kit da cama exatamente como aprovado — título, legenda, hashtags e
  chamada — em HTML, sem botões “Copiar”.
- Entregar as quatro imagens em duas variantes WebP por imagem, com `srcset`,
  `sizes`, dimensões explícitas, proporção preservada, sem recorte e sem upscale.
- Tratar cada caso em seção própria; no desktop, controlar a largura da campanha
  9:16 para exibi-la inteira; no mobile, um caso por vez.
- Reutilizar a fonte central `public-offer-copy.ts` e o `OfferCard` compacto, sem
  duplicar números, condições ou rótulos da oferta.
- Declarar metadata própria, canonical absoluto, Open Graph/Twitter com a imagem
  institucional existente e indexação somente sob produção confirmada + origem
  canônica validada.
- Incluir a nova rota no sitemap e um link “Campanhas sem complicação” no rodapé
  da home, ao lado de “Floriculturas” e “Padarias”, sem qualquer outra mudança
  visível na home.
- Atualizar `seo-discovery-foundation` para quatro superfícies indexáveis
  explicitamente aprovadas e para o novo link de rodapé.
- Não incluir dados estruturados `PetStore`, `LocalBusiness`, `Product`, `Offer`,
  `Review` ou `AggregateRating` para a loja fictícia, produtos, preços ou
  avaliações.
- Não alterar `/floriculturas`, `/padarias`, política de oferta, créditos,
  elegibilidade, onboarding, autenticação, APIs, banco, migrations, flags ou
  configuração externa.

## Capabilities

### New Capabilities

- `campanhas-para-sua-loja-demonstration-page`: rota pública
  `/campanhas-para-sua-loja`, composição e copy aprovadas, demonstração estática
  de dois produtos em formatos 1:1 e 9:16, frase-alinhada de identidade, kit de
  publicação da cama em HTML, bloco de rotina, aviso único, entrega responsiva de
  duas variantes por imagem, oferta central e metadata própria com indexação
  fail-closed.

### Modified Capabilities

- `seo-discovery-foundation`: `/campanhas-para-sua-loja` passa a ser a quarta
  superfície indexável explicitamente aprovada, ao lado da home, `/floriculturas`
  e `/padarias`; o sitemap pode conter quatro URLs sob a condição combinada; o
  rodapé da home ganha o link “Campanhas sem complicação”; o default fail-closed e
  o `noindex` das demais rotas permanecem inalterados.

## Impact

- **Rotas:** nova `src/app/(marketing)/campanhas-para-sua-loja/page.tsx`.
- **Componentes:** novos componentes locais em
  `src/components/landing/campanhas/**`; reutilização de `OfferCard`,
  `AcquisitionCta` e `public-offer-copy.ts` sem alteração.
- **Home:** somente o link “Campanhas sem complicação” no rodapé; nenhum outro
  texto, bloco, imagem, CTA ou ordem é alterado.
- **SEO:** `src/lib/seo/indexation-policy.ts` e `src/app/sitemap.ts`; a home
  recebe apenas o link de rodapé. `robots.ts`, `robots-headers.ts`,
  `next.config.ts` e `middleware.ts` permanecem inalterados.
- **Assets:** oito arquivos WebP novos em `public/demonstracao/` (duas variantes
  para cada uma das quatro imagens). Os arquivos-fonte permanecem fora de
  `public/`.
- **Testes:** página, contrato de imagens, grupo de acesso, política de indexação,
  sitemap e rodapé da home.
- **Banco/API/dependências:** sem migration, sem rota de API, sem nova
  dependência, sem geração paga ou autenticação real.
- **Validação:** testes focados, suíte local, typecheck, lint com limitação
  declarada, build, `git diff --check`, OpenSpec e aceite visual desktop/tablet/
  mobile nas duas flags.
- **Publicação:** checklist pós-deploy separado; nenhum deploy, merge, push, tag,
  sync ou archive nesta rodada.
