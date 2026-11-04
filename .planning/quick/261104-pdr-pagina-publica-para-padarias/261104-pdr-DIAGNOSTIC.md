# Diagnóstico — `/padarias`

Data da investigação: 2026-11-04. Branch: `feat/pagina-publica-padarias`.
HEAD/base: `53df58a7`. Árvore limpa no início da rodada.

## 1. Estado técnico conferido

| Item | Situação |
|---|---|
| Branch | `feat/pagina-publica-padarias` |
| HEAD e `origin/main` | `53df58a7` (0 à frente, 0 atrás) |
| Árvore | limpa (`git status --porcelain` sem saída) |
| OpenSpec ativo | nenhum antes desta rodada; somente `openspec/changes/archive/` |
| Página de referência | `/floriculturas` concluída, verificada e arquivada |
| Stack | Next.js 15 App Router, React 19, TypeScript, Tailwind, Vitest, `sharp` |
| Migration/banco | não se aplicam |

A entrega é independente das quicks de oferta/enriquecimento de `/floriculturas`.
Não há alteração preexistente a preservar além do estado limpo da branch.

## 2. Arquivos e contratos relevantes

### Reutilizáveis sem alteração

- `src/components/landing/offer-card.tsx` — card compacto com ID, `tabindex="-1"`,
  `scroll-mt-24` e estados da flag.
- `src/components/landing/public-offer-copy.ts` — fonte central de resumo,
  complemento, condições, CTA fechado, apoio e rótulos de acesso.
- `src/components/landing/acquisition-cta.tsx` — ações Google/e-mail/solicitação e
  modo âncora local.
- `src/components/landing/campaign-image.tsx` — referência de caixa 1:1 com
  `contain`; a página de padarias usa uma caixa local equivalente para declarar
  `width`/`height` explícitos sem alterar o componente compartilhado.
- `src/lib/seo/origin.ts`, `environment.ts`, `indexation-policy.ts` — origem,
  fail-closed e política por superfície.
- `src/lib/seo/home-metadata.ts` — imagem institucional 1200×630.
- `src/lib/launch-config/config.ts` — leitura única de `publicSignupEnabled`.

### A alterar

- `src/lib/seo/indexation-policy.ts` — nova constante, nova superfície e lista de
  paths indexáveis.
- `src/app/sitemap.ts` — terceira URL.
- `src/app/page.tsx` — somente o link “Padarias” no rodapé.
- Testes de política, sitemap, rodapé e página.

### A criar

- `src/app/(marketing)/padarias/page.tsx`.
- `src/components/landing/padarias/**` (cabeçalho, grupo de acesso, contrato de
  imagens, par de demonstração, kit e exemplo do pão).
- `public/padarias/**` com seis WebP.
- Testes focados.

### Fora de escopo

`/floriculturas`, `middleware.ts`, `next.config.ts`, `robots.ts`,
`robots-headers.ts`, autenticação, onboarding, créditos, elegibilidade, APIs,
banco, migrations, flags e configuração externa.

## 3. Assets conferidos

| Material | Arquivo | Dimensão | Formato | Peso |
|---|---|---|---|---|
| Foto de entrada do bolo | `OpenAI Playground 2026-11-04 at 16.41.18.png` | 1024×1024 | PNG | 1.877.770 B |
| Campanha do bolo | `bolo_naked_fruit-2026-11-04.jpg` | 1024×1024 | JPEG | 291.804 B |
| Campanha do pão | `p_o_franc_s__fresquinho_-2026-11-04.jpg` | 1024×1024 | JPEG | 266.104 B |

SHA-256 dos originais conferidos nesta rodada:

- foto do bolo: `5A5C9E9FA84A5CADE10976D1955F0B5B95DC94B2B1995D2D1E3E80D6497E07DD`;
- campanha do bolo: `A93C71549B02CA4D7320D87D17283F2FC3490ACB67CE3E4E9A4896BFFDAA1986`;
- campanha do pão: `F2678AC814EAE46E9B27589AB3F9964A5610EDB3D58FF6EA33B9D47A57E6DF05`.

As três imagens são 1:1. A campanha do bolo contém, na arte, a marca
“Panificadora Dona Maria”, o selo “Novidade”, “Massa de pão de ló”, “Recheado e
decorado com frutas” e “Imagem meramente ilustrativa”. A campanha do pão contém a
mesma marca, “Pão Francês Fresquinho”, “Saiu uma nova fornada, corre!” e “Passe na
Dona Maria e leve seus pães para o café.”. Nenhum desses elementos será recortado.

Os originais permanecem intactos em `Downloads`; nenhuma imagem será gerada ou
alterada nesta rodada.

## 4. Intenção de busca — leitura qualitativa

Consulta realizada na web em 2026-11-04, em português, sem ferramenta de volume e
sem rastreamento de posição. Os resultados variam por região, histórico e
personalização; portanto, as observações abaixo são qualitativas e **não** são
volumes de busca nem ranking.

### 4.1 Categorias observadas

| Categoria | Exemplos observados | O que enfatizam | Relação com o Vendeo |
|---|---|---|---|
| Ferramentas de posts com IA | BigDuckAI, PubliNinja, GERA, INPERA Post, Ahazou | Calendário, geração de legenda/arte, aprovação, agendamento e publicação automática | Concorrem pela dor “não tenho tempo de postar”; o Vendeo não agenda nem publica |
| Ferramentas internacionais de automação | Suze, BakeOnyx | Conteúdo diário a partir do site/foto, calendário, automação | Mesma categoria de automação; fora do escopo do Vendeo |
| Templates e editores | Canva, Zoviz, Envato, Creative Market, packs de posts | Modelos editáveis, identidade visual, editor manual | Concorrem pela dor “não sei design”; o Vendeo entrega campanha pronta, não biblioteca de templates |
| Encartes e materiais de oferta | Encarte Fácil | Lista de produtos, preços, validade, impressão/WhatsApp | Intenção de encarte/folheto; não é o posicionamento desta página |
| Conteúdo DIY | Blog IA Prática | Prompts em ChatGPT/Gemini, revisão manual | Mostra que o lojista já tenta resolver sozinho; o Vendeo empacota arte + texto |
| Agências e serviços | GERA (comparação com agência), páginas de marketing terceirizado | Serviço recorrente, às vezes com mídia paga inclusa | O Vendeo não é agência e não substitui gestão de mídia paga |
| Anúncios pagos | Canva Ads, comparações com agência | Mídia paga, campanhas de anúncio | Fora do escopo; não usar “anúncios” como promessa |

### 4.2 Termos e intenções priorizados

| Intenção | Formulações naturais | Como a página responde | Limite |
|---|---|---|---|
| Aplicativo para criar posts para padarias | “aplicativo para criar posts para padarias”, “app para postar produtos da padaria” | H1, abertura e título falam em campanhas prontas; página se identifica como aplicativo | Não prometer agendamento, calendário ou publicação automática |
| Criar artes e campanhas para divulgar uma padaria | “criar artes para padaria”, “campanha para divulgar padaria” | Demonstração foto → campanha e kit de publicação | Não prometer alcance, tráfego ou vendas |
| Propaganda de produtos de padaria | “propaganda de padaria”, “divulgar pão, bolo e fornada” | Situações comerciais: vitrine, fornada, bolos/encomendas; exemplo do pão | Não criar encarte, cardápio, preço ou oferta do Vendeo |
| Divulgação sem precisar saber design | “como divulgar padaria sem designer”, “post pronto sem Canva” | Abertura e demonstração enfatizam arte e texto com a identidade da loja | Não afirmar que substitui designer em qualquer peça |
| Apoio de cauda longa | “post para fornada do dia”, “arte para bolo de padaria”, “campanha de pão francês” | Conteúdo real da página, alt e legendas | Sem volumes inventados e sem keyword stuffing |

### 4.3 Termos deliberadamente evitados

- “agência de marketing para padaria” — o Vendeo não é agência.
- “gestão de redes sociais” — não há gestão, calendário ou publicação.
- “agendamento de posts” / “publicação automática” — funcionalidade não oferecida.
- “anúncios para padaria” / “tráfego pago” — não é gestor de mídia paga.
- “encarte” / “cardápio” — outra intenção e outro formato.
- “os mais buscados” / “milhares de buscas” — sem evidência de volume.

### 4.4 Fontes consultadas

- BigDuckAI — posts de Instagram para padarias e cafés:
  https://bigduckai.com/para/padarias-cafes
- PubliNinja — posts para Instagram de padaria com IA:
  https://publininja.com/for/padaria
- GERA — marketing para doceria, com automação e comparação com agência:
  https://altive-ai.com/marketing-para/doceria
- INPERA Post — foto, texto, chamada, hashtags e programação:
  https://gestao.inpera.com.br/inpera-post
- Ahazou — biblioteca de conteúdos prontos por segmento:
  https://ahazou.com/
- Suze — social media para bakery em autopilot:
  https://suze.social/for/bakery
- BakeOnyx Content Studio — conteúdo para bakers:
  https://www.bakeonyx.ai/content-studio
- Canva — criação de anúncios e modelos:
  https://www.canva.com/pt_br/criar/anuncios/
- Canva para restaurantes — modelos, cardápios e flyers:
  https://blog-parceiros.ifood.com.br/canva-para-restaurantes/
- Zoviz — modelos de stories para padaria:
  https://zoviz.com/pt/instagram-story-maker/bakery-story-maker
- Envato — kit de mídia social de padaria:
  https://elements.envato.com/pt-br/bakery-social-media-kit-psd-ai-template-BZWX4CG
- Creative Market — template de Instagram para bakery:
  https://creativemarket.com/anny_sketches/291962246-Bakery-Instagram-Template-Canva
- Divulga Aê — pack de posts para padarias:
  https://www.divulgaae.com.br/produto/pack-de-posts-prontos-com-legendas-para-padarias-no-canva/
- Encarte Fácil — encarte promocional para padaria:
  https://encartefacil.com/encarte-padaria
- IA Prática — como usar IA para divulgar padaria:
  https://blogiapratica.com.br/blog/como-usar-ia-para-divulgar-padaria/

### 4.5 Limites declarados

- Não houve acesso a ferramenta de volume (Google Keyword Planner, Semrush,
  Ahrefs ou equivalente).
- Não há conclusão sobre dificuldade de ranking, CPC, sazonalidade ou intenção
  predominante por volume.
- As páginas consultadas são, em maioria, comerciais e podem ter viés de
  posicionamento.
- A página não promete indexação, tráfego, posição ou resultado comercial.

## 5. SEO técnico existente

- Canonical absoluto e `metadataBase` derivam de `resolveCanonicalOrigin()`.
- Indexação exige `VERCEL_ENV === "production"` **e** origem canônica válida.
- Hoje `INDEXABLE_CANONICAL_PATHS` contém apenas `/` e `/floriculturas`.
- O sitemap retorna exatamente duas URLs em produção válida e `[]` fora disso.
- `robots.txt` não usa `Disallow` para páginas com `noindex`.
- `X-Robots-Tag` global `noindex, nofollow` é aplicado fora de produção.
- Não existe JSON-LD no repositório.

## 6. Dados estruturados — avaliação registrada

| Marcação | Decisão | Motivo |
|---|---|---|
| `Bakery` / `LocalBusiness` | não incluir | A Panificadora Dona Maria é fictícia; não há endereço, telefone, horário ou loja real |
| `Product` / `Offer` | não incluir | O bolo e o pão são conteúdo demonstrativo; preço e disponibilidade não são oferta comercial válida |
| `Review` / `AggregateRating` | não incluir | Não há avaliações reais nem dados verificáveis |
| `SoftwareApplication` | não incluir nesta entrega | Exigiria dados autoritativos de aplicação, preço e plataforma; o produto não os expõe aqui e o risco de inconsistência supera o benefício |
| `WebPage` isolado | não incluir nesta entrega | Benefício marginal sem uma camada global de `Organization`/`WebSite`; fica registrado para avaliação futura |

A ausência é intencional e testável: nenhum JSON-LD de loja, produto, oferta,
avaliação ou preço deve aparecer no HTML.

## 7. Riscos técnicos identificados

1. **Indexação acidental**: qualquer nova rota herda `noindex` por padrão; a
   inclusão precisa ser explícita na política, no sitemap e nos testes.
2. **Canonical em preview**: reutilizar o padrão fail-closed, nunca emitir
   `https://vendeo.tech/padarias` fora da condição combinada.
3. **Regressão em `/floriculturas`**: não alterar a página nem seus componentes;
   o grupo de acesso de padarias será local.
4. **Peso e legibilidade**: três imagens 1:1; medir pesos, `currentSrc` e LCP antes
   de fechar.
5. **Promessa indevida**: a copy não pode sugerir agendamento, automação, anúncios,
   alcance ou vendas.
6. **Preço demonstrativo**: não reproduzir preço em HTML/metadata; a arte é
   coberta pelo aviso único.
