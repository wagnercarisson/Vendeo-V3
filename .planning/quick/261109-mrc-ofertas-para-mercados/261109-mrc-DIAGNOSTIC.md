# Quick 261109-mrc — Diagnóstico da base

**Data:** 2026-11-09
**Rodada:** diagnóstico, copy, composição, plano e proposta OpenSpec. Sem implementação, sem assets, sem commit.

## 1. Estado do repositório

| Item | Valor |
|---|---|
| Branch atual | `perf/pagina-oferta-mercearia` |
| HEAD | `8f259b86` |
| `origin/main` | `8f259b86` |
| Divergência | 0 à frente, 0 atrás |
| Árvore | limpa (`git status` sem alterações) |
| Worktree principal | `C:/Projetos/Vendeo V3` |
| Worktrees adicionais | `backup/antes-reversao-f47-20261025-114407`, `feat/fase-59-1-entrega-de-um-formato-por-solicitacao`, `feature/fase-44-temas-de-campanha-v2` |
| Changes OpenSpec ativas | nenhuma; apenas `openspec/changes/archive/` |
| Quicks anteriores relacionadas | `261103-qew`, `261104-pdr`, `261108-j3p` — concluídas; não reabrir |
| Migration/banco/env/flag | não se aplicam a esta entrega |

Nenhuma alteração preexistente foi sobrescrita e nenhuma troca de branch foi feita.

## 2. Padrões públicos já existentes

O repositório já consolidou o padrão de página pública demonstrativa:

- `src/app/(marketing)/floriculturas/page.tsx`;
- `src/app/(marketing)/padarias/page.tsx`;
- `src/app/(marketing)/campanhas-para-sua-loja/page.tsx`.

Características comuns:

1. Server Component estático, `pt-BR`, sem autenticação e sem layout próprio.
2. Cabeçalho local por segmento, com logo e “Entrar”.
3. Abertura com H1, texto e grupo de acesso.
4. Grupo de acesso da abertura em modo âncora local; ações reais somente no card final.
5. `OfferCard` compacto no encerramento, alimentado por `public-offer-copy.ts`.
6. Aviso demonstrativo único por página.
7. Metadata própria com Open Graph/Twitter e imagem institucional 1200×630.
8. Indexação fail-closed: `index, follow` e canonical absoluto somente em produção confirmada com origem canônica validada.
9. Imagens em WebP com `srcset`, `sizes`, largura/altura explícitas e sem upscale.
10. Rodapé compartilhado por `PublicFooter`, com `currentPath` e `context="marketing"`.

## 3. Rodapé compartilhado

Arquivos:

- `src/components/landing/public-footer.tsx`;
- `src/components/landing/public-footer-nav.ts`.

Hoje a lista central contém:

| Rótulo | Destino |
|---|---|
| Floriculturas | `/floriculturas` |
| Padarias | `/padarias` |
| Campanhas sem complicação | `/campanhas-para-sua-loja` |

O rodapé é consumido por `/`, `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja`. A lista é deliberadamente independente de sitemap, robots, canonical e metadata. A inclusão de “Mercados e mercearias” deve ocorrer somente nessa lista; nenhum dos quatro consumidores deve ser editado manualmente.

## 4. Oferta e acesso centralizados

Arquivos:

- `src/components/landing/public-offer-copy.ts` — textos de oferta e acesso;
- `src/components/landing/offer-card.tsx` — variantes `full` e `compact`;
- `src/components/landing/acquisition-cta.tsx` — ações reais ou âncora local;
- `src/components/landing/public-footer.tsx` — rodapé.

Contratos observados:

- `PUBLIC_OFFER_COPY`: título, resumo, complemento, rótulo do expansível, condições e nota de estado fechado.
- `PUBLIC_ACCESS_COPY`: Google, email, CTA fechado, apoio fechado e “Conheça o Vendeo”.
- `OfferCard` recebe `publicSignupEnabled` do servidor e não lê flag, env ou rede.
- `compact` tem `id` opcional, `tabindex="-1"` e `scroll-mt-24`; é o padrão das páginas de segmento.
- A abertura usa `AcquisitionCta.localHref`; o card final não usa `localHref`, preservando as ações reais.

A página nova deve reutilizar esses contratos sem duplicar números, condições ou rótulos.

## 5. Indexação e descoberta

Arquivos:

- `src/lib/seo/indexation-policy.ts`;
- `src/app/sitemap.ts`;
- `src/lib/seo/environment.ts`;
- `src/lib/seo/origin.ts`;
- `src/app/robots.ts` e `robots-headers.ts` (não alterar nesta entrega).

Estado atual:

- `INDEXABLE_CANONICAL_PATHS` contém exatamente 4 superfícies: `/`, `/floriculturas`, `/padarias`, `/campanhas-para-sua-loja`.
- `getSurfacePolicy` reconhece explicitamente cada uma e aplica o default `noindex, nofollow` a qualquer outra rota.
- O sitemap contém exatamente 4 URLs e retorna lista vazia fora da condição combinada.
- O canonical absoluto só é emitido com `VERCEL_ENV === "production"` e `NEXT_PUBLIC_SITE_URL === "https://vendeo.tech"`.

A nova rota exige alteração explícita em:

1. `indexation-policy.ts`: nova constante de caminho, inclusão em `INDEXABLE_CANONICAL_PATHS` e branch em `getSurfacePolicy`.
2. `sitemap.ts`: quinta URL.
3. Testes de política, sitemap e rodapé.

A lista de navegação do rodapé não deve ser importada por nenhum desses contratos.

## 6. Materiais aprovados — inspeção visual e técnica

| Material | Formato | Dimensões | Bytes | SHA-256 (início) |
|---|---|---:|---:|---|
| Campanha da carne | JPEG | 1024×1024 | 289.145 | `0DD85B7DC4D2C8C9…` |
| Foto no açougue | PNG | 1536×1024 | 3.048.371 | `52F96C4A560BED43…` |
| Exemplo do café (`hero.png`) | PNG | 1024×1024 | 1.570.960 | `B02B60A42C03D090…` |

Conteúdo visual confirmado:

- **Campanha da carne:** Mercearia Tio João, “Coxão Mole Bovino (kg)”, R$ 45,90 riscado, R$ 39,90 em destaque, selo “Oferta”, validade de 10/11/2026 a 13/11/2026 e “Imagem meramente ilustrativa”.
- **Foto no açougue:** peça inteira e fatia de coxão mole sobre bancada, com balcão refrigerado, prateleiras e utensílios ao fundo. Proporção horizontal 3:2.
- **Exemplo do café:** Mercearia Tio João, Café Melitta 500 g Tradicional, R$ 19,90, “De: R$ 24,50”, “Enquanto durarem os estoques” e “Imagem meramente ilustrativa”. É o mesmo material de `hero.png`.

Correspondência com os anexos aprovados: confirmada. Não foi usada a campanha 9:16, nem a foto gastronômica anterior, nem outra geração.

## 7. Derivados existentes do café

| Arquivo | Dimensões | Bytes |
|---|---:|---:|
| `public/landing/hero-oferta-cafe.webp` | 1024×1024 | 188.502 |
| `public/landing/variants/hero-oferta-cafe-480w.webp` | 480×480 | 52.062 |
| `public/landing/variants/hero-oferta-cafe-768w.webp` | 768×768 | 95.908 |

O material corresponde ao `hero.png` aprovado. A entrega pode reutilizar o arquivo base de 1024×1024 e a variante de 480w, sem criar novo derivado redundante. O derivado de 768w não é necessário para o contrato de duas variantes.

## 8. Assets novos necessários

Nenhum derivado próprio existe hoje para a carne ou para a foto do açougue. A implementação futura precisará criar, no máximo, quatro arquivos WebP:

- foto horizontal: 480w (480×320) e 1024w (1024×683);
- campanha quadrada: 480w (480×480) e 1024w (1024×1024).

Regras:

- preservar proporções originais;
- não fazer upscale — a foto original é 1536×1024, portanto 1024w é redução;
- não recortar;
- manter os originais fora de `public/`, com dimensões, bytes e SHA-256 registrados em `evidence/source/`;
- `sharp` já é dependência do projeto (`^0.34.5`); não há nova dependência.

## 9. Diagnóstico de composição

O par principal tem proporções diferentes:

- foto: 3:2 (1536×1024);
- campanha: 1:1 (1024×1024).

Forçar as duas ao mesmo box quadrado recortaria a foto ou a campanha. A composição proposta usa duas colunas com proporções preservadas e alturas visuais iguais:

- desktop: `minmax(0,3fr) auto minmax(0,2fr)`, com a foto em 3 partes e a campanha em 2 partes; a foto 3:2 e a campanha 1:1 chegam à mesma altura;
- tablet: mesma grade, reduzida;
- mobile: empilhamento foto → seta → campanha, com largura limitada e sem overflow.

Os rótulos “Foto do produto” e “Campanha criada com o Vendeo” ficam em uma linha própria, acima das áreas visuais, para que a seta seja centralizada apenas entre as imagens.

O exemplo do café pode seguir o padrão de `/padarias`: texto à esquerda e imagem à direita no desktop, empilhados no mobile, com a imagem abaixo da dobra em `loading="lazy"`.

## 10. SEO e dados estruturados

- Metadata própria com intenção de ferramenta para lojistas.
- Título aprovado: “Crie artes de ofertas para mercados e mercearias | Vendeo”.
- Description proposta sem preço, marca fictícia, promessa de venda ou dado de loja.
- OG/Twitter com a imagem institucional existente `public/seo/vendeo-og-1200x630.png`; não há necessidade concreta identificada para nova imagem.
- Canonical absoluto apenas sob produção confirmada + origem canônica validada.
- Nenhum JSON-LD de `Store`, `GroceryStore`, `Butcher`, `Product`, `Offer`, `Review`, `AggregateRating` ou `LocalBusiness`.
- A página não deve incorporar preços ao title, description, metadata ou dados estruturados.

## 11. Riscos identificados

| Risco | Mitigação |
|---|---|
| Página percebida como mercado, açougue ou encarte multiproduto | Copy apresenta o Vendeo como aplicativo de campanhas; um produto por campanha; nenhuma seção de encarte ou lista de produtos |
| Preço demonstrativo lido como oferta comercial do Vendeo | Preço aparece apenas dentro das artes aprovadas; não é reproduzido em metadata nem em JSON-LD; aviso único cobre os dois exemplos |
| Recorte da foto horizontal ou da campanha quadrada | Grid com proporções preservadas e `object-contain`; sem `object-cover` |
| Seta desalinhada por causa dos rótulos | Rótulos em linha separada; seta centralizada somente entre as áreas visuais |
| Rodapé editado em quatro lugares | Alterar somente `public-footer-nav.ts` |
| Indexação acidental de preview | Manter o contrato fail-closed existente e cobrir a matriz por teste |
| Reuso indevido da campanha 9:16 ou da foto gastronômica | Escopo fixa apenas a foto do açougue e a campanha quadrada da carne; café reutiliza o material aprovado |
| Derivados redundantes do café | Reutilizar 480w + base 1024×1024 existentes |
| LCP presumido | Nenhuma imagem recebe `fetchpriority="high"`; prioridade definida após medição local |

## 12. Fora de escopo e superfícies preservadas

Não serão alterados:

- `/floriculturas`, `/padarias`, `/campanhas-para-sua-loja` e a home;
- `public-offer-copy.ts`, `offer-card.tsx`, `acquisition-cta.tsx` e `getLaunchConfig`;
- `src/lib/seo/origin.ts`, `environment.ts`, `robots.ts`, `robots-headers.ts`, `middleware.ts` e `next.config.ts`;
- autenticação, onboarding, créditos, elegibilidade, APIs, banco, migrations, flags e configuração externa;
- a campanha 9:16 e a foto gastronômica anterior.

## 13. Decisões aprovadas em 2026-11-09

1. **Description da metadata** - aprovada.
2. **Copy do corpo** - aprovada, com a consolidação da explicação em um único parágrafo após o par.
3. **Ordem do novo link no rodapé** - aprovada: após “Padarias” e antes de “Campanhas sem complicação”.
4. **Diretório dos novos assets** - aprovado: `public/mercados/`.
5. **Reuso do café** - aprovado: `hero-oferta-cafe-480w.webp` + `hero-oferta-cafe.webp` (1024), sem novo derivado.
6. **Proporção da grade principal** - aprovada: 3fr (foto) / 2fr (campanha), com alturas visuais iguais.
7. **Ordem da nova superfície nas listas de SEO** - aprovada: após `/padarias` e antes de `/campanhas-para-sua-loja`.
8. **Branch** - aprovada a permanência em `perf/pagina-oferta-mercearia`.

A consolidação editorial posterior substituiu o texto de apoio da demonstração e
a explicação anterior por um único parágrafo. O kit permanece integralmente
preservado. As decisões já aprovadas - URL, H1, rótulo do rodapé, materiais, kit,
aviso único, card único, imagem OG e ausência de dados estruturados - não foram
reabertas.
