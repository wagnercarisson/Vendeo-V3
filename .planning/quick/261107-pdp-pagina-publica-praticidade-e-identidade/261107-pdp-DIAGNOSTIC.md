# Diagnóstico — página pública de praticidade e identidade

Data da investigação: 2026-11-07.
Quick: `261107-pdp`.
Branch: `perf/quick-pagina-demonstracao-praticidade`.

Esta rodada é **somente de investigação, planejamento, copy e proposta OpenSpec**.
Nenhum código, asset, teste, spec principal ou página é alterado. Nenhum commit,
sync, archive, merge, push, deploy ou tag.

## 1. Estado do repositório

| Item | Valor |
|---|---|
| Branch | `perf/quick-pagina-demonstracao-praticidade` |
| HEAD | `c55a0171` |
| `origin/main` | `c55a0171` (0 à frente, 0 atrás) |
| Árvore | limpa (`git status --porcelain` sem saída) |
| Alterações preexistentes | nenhuma |
| OpenSpec ativo | nenhum antes desta rodada |
| Stack | Next.js 15 App Router, React 19, TypeScript, Tailwind, Vitest, `sharp` |
| Migration/banco | não se aplicam |

A branch foi alinhada pelo responsável para este escopo. Nenhuma alteração
preexistente precisa ser preservada além do estado limpo confirmado acima.

## 2. F59 / formato 9:16 — estado conferido

O formato 9:16 está **funcional e disponível em produção**. A afirmação se apoia
em evidências já registradas no repositório, não em promessa desta rodada:

| Evidência | Situação |
|---|---|
| Deploy de produção | `dpl_BBKyLDs5VFs5G9FgzusmpYHXN6Ld`, `READY`, alias `vendeo.tech`, commit `37bfb527` |
| Migration | `20261105162052_f59_product_9_16_flag.sql` presente no ledger remoto |
| Flag | `product_9_16_enabled=true` desde 2026-11-06 22:08 BRT, com registro em `admin_audit_log` |
| Smoke | campanha vertical `fa2ebf20-…`, JPEG 1080×1920, 1 crédito deduzido |
| Código | `src/lib/campaign/format-resolution.ts` e `src/lib/product-vertical-9-16/**` presentes; specs `product-vertical-*` sincronizadas |

Fonte principal: `.planning/STATE.md` (registro de produção F59 + quick
`261106-qxn`, 2026-11-07) e `docs/operations/f59-quick-261106-qxn-promotion-checklist.md`.

Limites que permanecem registrados e **não afetam esta página**:

- a flag controla apenas o início de novas gerações verticais; campanhas já
  criadas continuam consultáveis e baixáveis;
- download específico do smoke, fatura/custo do provider e auditoria do replay
  terminal não foram comprovados por evidência independente;
- a página é estática e não executa geração, provider, crédito ou leitura de flag
  de formato. Ela apenas apresenta uma campanha 9:16 já gerada e autorizada.

Conclusão: o formato pode ser anunciado como disponível, com a redação “formato
9:16”, sem prometer publicação automática, sem contador de tempo e sem publicar
média de geração.

## 3. Arquivos e contratos reutilizáveis

### Reutilizar sem alterar

- `src/components/landing/offer-card.tsx` — card `compact` com `id`, `tabIndex=-1`,
  `scroll-mt-24` e estados da flag.
- `src/components/landing/public-offer-copy.ts` — fonte única de resumo,
  complemento, condições, CTA fechado, apoio e rótulos de acesso.
- `src/components/landing/acquisition-cta.tsx` — ações Google/e-mail/solicitação e
  modo âncora local (`localHref`).
- `src/components/landing/floriculturas/access-cta-group.tsx` e
  `src/components/landing/padarias/access-cta-group.tsx` — padrão de composição
  por estado da flag (referência, não importação cruzada).
- `src/lib/seo/origin.ts`, `environment.ts`, `indexation-policy.ts`,
  `home-metadata.ts` — origem, condição combinada e política por superfície.
- `src/lib/launch-config/config.ts` — leitura única de `publicSignupEnabled`.
- `src/app/(marketing)/padarias/page.tsx` e componentes locais — melhor analogia
  estrutural (Server Component, metadata própria, card único, aviso único, duas
  variantes WebP por imagem).

### Compartilhado que precisa de decisão explícita antes da execução

| Arquivo | Mudança necessária | Risco |
|---|---|---|
| `src/lib/seo/indexation-policy.ts` | nova constante de rota, nova superfície indexável e inclusão em `getSurfacePolicy` | afeta todas as superfícies; exige testes de regressão |
| `src/app/sitemap.ts` | quarta URL sob a condição combinada | idem |
| `src/app/page.tsx` | um único link novo no rodapé | alteração visível na home; exige aprovação |
| testes de política, sitemap e rodapé | atualização de expectativas | precisam acompanhar as mudanças acima |

Nenhuma dessas mudanças é executada nesta rodada. Elas serão apresentadas como
decisões D6/D7 no plano e só entram após aprovação.

### Fora de escopo

`/floriculturas`, `/padarias`, `public-offer-copy.ts`, `offer-card.tsx`,
`acquisition-cta.tsx`, `campaign-image.tsx`, `getLaunchConfig`, `middleware.ts`,
`next.config.ts`, `robots.ts`, `robots-headers.ts`, autenticação, onboarding,
créditos, elegibilidade, APIs, banco, migrations, flags e configuração externa.

## 4. Assets conferidos

Nenhuma imagem foi gerada, alterada ou recortada. Os originais permanecem em
`Downloads`.

| Caso | Papel | Arquivo | Dimensão | Proporção | Formato | Peso | SHA-256 |
|---|---|---|---|---|---|---|---|
| 1 | Foto enviada (ração) | `ração pet.png` | 1310×1201 | ≈1,09:1 | PNG 24bpp | 1.899.777 B | `6F14E14EE1AB3AF682C3C21607C5B5B519E3CFA77CCC87C059C542E8336454A3` |
| 1 | Campanha 1:1 | `transformacao.png` | 1024×1024 | 1:1 | PNG 24bpp | 1.396.972 B | `CDC48E29EB7780EB2A2886E0856ED0755A733DD5EC6B3AC3EE76994EDFA5BBE6` |
| 2 | Foto enviada (cama) | `OpenAI Playground 2026-11-07 at 10.37.19.png` | 1024×1536 | 2:3 | PNG 24bpp | 2.722.361 B | `3A40E6640A0ECA82428FD7F5810F75B6431AFF8DAA6DB56A62C150905C6D82AB` |
| 2 | Campanha 9:16 | `cama_pet_comfort-2026-11-07.jpg` | 1080×1920 | 9:16 | JPEG 24bpp | 660.163 B | `2E8DBA7A36A467F1F8652DE58599F3EEB844867AAB4A6711530533BCC20BA711` |

### Correspondência visual conferida

- **Caso 1 — ração.** A foto de entrada mostra a embalagem Confiance Premium
  Adults 15 kg sobre uma mesa. A campanha 1:1 usa a mesma embalagem como
  produto em destaque, com a marca fictícia **Pet Shop Bicho Fofo**, o selo
  “Lançamento”, o nome “Ração Confiance 15 kg Premium” e o preço R$ 114,90
  dentro da arte. O par é coerente: produto, embalagem e marca demonstrativa
  correspondem.
- **Caso 2 — cama.** A foto de entrada mostra a cama pet em uma loja, sobre uma
  mesa, com prateleiras ao fundo. A campanha 9:16 usa a mesma cama como produto
  em destaque, com a marca **Pet Shop Bicho Fofo**, “Cama Pet Comfort”, o selo
  “Top de Linha”, “Macia e confortável”, “Seu pet merece esse mimo” e a nota
  “Imagem meramente ilustrativa”. O par é coerente.
- A marca fictícia é a mesma nos dois casos; a identidade visual (paleta quente,
  logo com cães/gato, tipografia arredondada) é reconhecível entre os dois
  formatos. **Não se afirma reprodução visual exata**: a campanha é uma criação
  a partir da foto e das informações, não um recorte da foto original.
- Os preços e selos existentes nas artes **não serão reproduzidos como texto,
  metadata ou dado estruturado**. O caráter demonstrativo vem do contexto e do
  aviso único aprovado.

### Formatos e dimensões para entrega responsiva

Duas variantes WebP por imagem, com proporção preservada e sem upscale:

| Asset | 480w | 1024w |
|---|---|---|
| `foto-racao-confiance` | 480×440 | 1024×939 |
| `campanha-racao-confiance-bicho-fofo` | 480×480 | 1024×1024 |
| `foto-cama-pet-comfort` | 480×720 | 1024×1536 |
| `campanha-cama-pet-comfort-bicho-fofo` | 480×853 | 1024×1820 |

O 9:16 **não** recebe o pipeline quadrado de `/padarias`. As larguras são
derivadas da exibição e da densidade de tela, e os valores finais de `sizes`
serão reconciliados por medição no navegador.

## 5. Intenção de busca — leitura qualitativa

Consulta realizada na web em 2026-11-07, em português, sem ferramenta de volume,
sem rastreamento de posição e sem dados de CPC. Os resultados variam por região,
histórico e personalização. As observações abaixo são **qualitativas** e não são
volumes de busca nem ranking.

### 5.1 Categorias observadas

| Categoria | Exemplos observados | O que enfatizam | Relação com o Vendeo |
|---|---|---|---|
| Editores e templates | Canva, Adobe Express, Zoviz, Posters | Milhares de modelos, arrastar e soltar, identidade da marca, upload de logo e cores | Concorrem pela dor “não sei design”; o Vendeo não é editor nem biblioteca de templates |
| Geração de posts com IA | GalilAI, Canva (legendas), Adobe (posts), 8Labs One, Kimi (lista) | Legenda, imagem, hashtags, agendamento e às vezes publicação automática | Concorrem pela dor “não tenho tempo”; o Vendeo entrega campanha para revisão/download, sem publicar |
| Criativos publicitários com IA | Creatify, AdCreative.ai, Fresko | Anúncios, vídeo, performance, escala, promessas de resultado | Categoria de mídia paga/performance; o Vendeo não é gestor de tráfego |
| Aplicativos genéricos de arte | Blog MIDAS (Canva, Adobe Spark, Posters), Hiper | “Sem conhecimentos técnicos”, templates e edição manual | Mostram que o lojista já tenta resolver sozinho; o Vendeo empacota arte + texto + identidade |
| Conteúdo DIY | Tutoriais de Canva/ChatGPT, prompts | Passo a passo e revisão manual | Alternativa gratuita, porém com mais trabalho e sem identidade consistente |

### 5.2 Intenções priorizadas

| Intenção | Formulações naturais | Como a página responde | Limite |
|---|---|---|---|
| Aplicativo para criar campanhas da loja | “aplicativo para criar campanhas”, “app para criar arte de produto” | H1, abertura e title identificam o Vendeo como aplicativo de campanha | Não prometer agendamento, calendário ou publicação automática |
| Criar arte e legenda para produtos | “criar arte e legenda para produtos”, “post pronto para loja” | Demonstração de dois produtos e kit de texto em HTML | Não prometer edição livre, templates ou banco de imagens |
| Divulgar a loja sem saber design | “divulgar loja sem saber design”, “criar arte sem designer” | Abertura e rotina enfatizam arte e texto prontos, sem editor complexo | Não afirmar que substitui designer em qualquer peça |
| Manter a identidade da loja | “identidade visual da loja”, “posts com a marca da loja” | Dois produtos e dois formatos com a mesma marca fictícia; frase-alinhada | Não afirmar reprodução visual exata nem consistência absoluta |
| Publicar com autonomia | “baixar arte para publicar”, “revisar antes de postar” | Etapa “revise, baixe e publique” | A publicação é do lojista; não há publicação automática |

### 5.3 Termos deliberadamente evitados

- “Falta de tempo” como termo comprovadamente buscado — a dor é usada na copy,
  mas não é tratada como palavra-chave validada.
- “Agência de marketing” / “gestão de redes sociais” — o Vendeo não é agência.
- “Agendamento” / “publicação automática” / “calendário editorial” — não oferecido.
- “Anúncios pagos” / “tráfego pago” / “impulsione” — fora do posicionamento.
- “Aumente suas vendas” / “mais clientes” / “mais alcance” / “conversão” — sem
  promessa de resultado comercial.
- “Os mais buscados” / “milhares de buscas” — sem evidência de volume.
- “Pet shop” como posicionamento da página — o pet shop é apenas o exemplo.
- “Média de 30 segundos” — a média não foi publicada; a comunicação autorizada é
  “em poucos minutos”.

### 5.4 Fontes consultadas

- Canva — criador de anúncios: https://www.canva.com/pt_br/criar/anuncios/
- Canva — gerador de legendas: https://www.canva.com/pt_br/gerador-legendas-ia/
- Adobe Express — Ad Maker: https://www.adobe.com/br/express/create/advertisement
- Adobe Express — posts de Instagram: https://www.adobe.com/br/express/create/ai/post/instagram
- Creatify — anúncios com IA: https://creatify.ai/pt
- Zoviz — modelos de anúncio: https://zoviz.com/pt/ad-templates
- AdCreative.ai: https://pt-br.adcreative.ai/
- Fresko — anúncios e posts com IA: https://fresko.ai/pt/
- GalilAI — posts para Instagram: https://galilai.com.br/
- 8Labs One — legendas: https://8labs.ai/pt/one/tools/social-media-caption-generator
- Kimi — geradores de posts: https://www.kimi.ai/pt-br/resources/best-ai-social-media-post-generators
- Blog MIDAS — 3 apps para criar arte: https://midascrm.com.br/blog/3-apps-gratuitos-para-criar-sua-arte/
- Hiper — ferramentas gratuitas de arte: https://hiper.com.br/blog/ferramentas-gratuitas-artes-redes-sociais/
- Adapta — IAs para post de Instagram: https://adapta.org/blog/ia-para-criar-post-de-instagram
- Prit — apps para Instagram: https://prit.app/blog/7-apps-para-instagram-para-potencializar-seu-negocio/
- Shopify App Store — categoria de anúncios: https://apps.shopify.com/categories/marketing-and-conversion-advertising-ads/all?locale=pt-BR

### 5.5 Limites declarados

- Não houve acesso a ferramenta de volume (Google Keyword Planner, Semrush,
  Ahrefs ou equivalente).
- Não há conclusão sobre dificuldade de ranking, CPC, sazonalidade ou intenção
  predominante por volume.
- As páginas consultadas são, em maioria, comerciais e podem ter viés de
  posicionamento.
- A página não promete indexação, tráfego, posição ou resultado comercial.

## 6. SEO técnico existente

- Canonical absoluto e `metadataBase` derivam de `resolveCanonicalOrigin()`.
- Indexação exige `VERCEL_ENV === "production"` **e** origem canônica válida.
- Hoje `INDEXABLE_CANONICAL_PATHS` contém `/`, `/floriculturas` e `/padarias`.
- O sitemap retorna exatamente três URLs em produção válida e `[]` fora disso.
- `robots.txt` não usa `Disallow` para páginas com `noindex`.
- `X-Robots-Tag` global `noindex, nofollow` é aplicado fora de produção.
- Não existe JSON-LD no repositório.
- `/campanhas` já é prefixo privado em `PRIVATE_APP_PREFIXES`; a nova rota pública
  não pode colidir com esse prefixo. Por isso a URL proposta **não** é
  `/campanhas`.

## 7. Dados estruturados — avaliação registrada

| Marcação | Decisão | Motivo |
|---|---|---|
| `PetStore` / `LocalBusiness` | não incluir | A loja Pet Shop Bicho Fofo é fictícia; não há endereço, telefone, horário ou estabelecimento real |
| `Product` / `Offer` | não incluir | A ração e a cama são conteúdo demonstrativo; preço e disponibilidade não são oferta comercial válida |
| `Review` / `AggregateRating` | não incluir | Não há avaliações reais nem dados verificáveis |
| `SoftwareApplication` | não incluir nesta entrega | Exigiria dados autoritativos de aplicação, preço e plataforma; o produto não os expõe aqui |
| `WebPage` isolado | não incluir nesta entrega | Benefício marginal sem uma camada global de `Organization`/`WebSite`; fica registrado para avaliação futura |

A ausência é intencional e testável: nenhum JSON-LD de loja, produto, oferta,
avaliação ou preço deve aparecer no HTML.

## 8. Riscos técnicos identificados

1. **Indexação acidental.** Qualquer rota nova herda `noindex` por padrão; a
   inclusão precisa ser explícita na política, no sitemap e nos testes.
2. **Canonical em preview.** Reutilizar o padrão fail-closed, nunca emitir
   `https://vendeo.tech/<rota>` fora da condição combinada.
3. **Colisão com `/campanhas`.** A rota privada usa esse prefixo; a URL pública
   precisa ser distinta e não pode cair em `PRIVATE_APP_PREFIXES`.
4. **9:16 comprimido ou recortado.** O formato vertical tem 1080×1920; em desktop
   precisa de largura controlada e `object-contain`, nunca `object-cover`.
5. **Quatro imagens em grade única.** O requisito proíbe; cada caso é uma seção
   própria, com um caso por vez no mobile.
6. **Peso e legibilidade.** A foto da ração tem 1,9 MB e a da cama 2,7 MB;
   as variantes WebP precisam ser medidas antes do aceite.
7. **Promessa indevida.** A copy não pode sugerir agendamento, automação,
   anúncios, alcance, conversão ou aumento de vendas.
8. **Preço demonstrativo.** A campanha 1:1 contém R$ 114,90 dentro da arte; não
   reproduzir em HTML, metadata ou JSON-LD. O aviso único cobre o caráter
   demonstrativo.
9. **Aviso duplicado.** O texto aprovado deve aparecer uma única vez; o rodapé
   desta página não repete o aviso da home.
10. **Duplicação do grupo de acesso.** O padrão atual é local por página; extrair
    um componente compartilhado exigiria tocar em páginas aprovadas. A extração
    fica registrada como limpeza futura, não como parte desta entrega.

## 9. Conclusão do diagnóstico

A entrega é viável como página estática, sem backend, sem geração e sem crédito.
O maior risco não é técnico, e sim editorial: manter a página como demonstração
do **aplicativo** para o pequeno lojista, sem transformá-la em manual de
preenchimento, página de pet shop ou promessa de resultado. As decisões D1–D8 do
plano e a copy de `261107-pdp-COPY.md` existem para tornar esse limite revisável
antes de qualquer implementação.
