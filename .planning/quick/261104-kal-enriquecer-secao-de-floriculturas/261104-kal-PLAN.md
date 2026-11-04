---
quick_id: 261104-kal
slug: enriquecer-secao-de-floriculturas
status: complete
mode: implementation
date: 2026-11-04
implemented_on: 2026-11-04
accepted_on: 2026-11-04
branch: perf/comunicacao-de-oferta-nas-paginas
base_commit: 2175cc8a
implementation_authorized: true
visual_checkpoint: approved
openspec_change: enriquecer-exemplos-floriculturas
openspec_archive: openspec/changes/archive/2026-11-04-enriquecer-exemplos-floriculturas
---

# Quick 261104-kal — Enriquecimento pontual de `/floriculturas`

## Escopo

Enriquecer **somente** a seção “Crie posts para sua floricultura sem começar do
zero.” e o apoio do encerramento de `/floriculturas`, acrescentando **um único**
exemplo complementar com a campanha aprovada da Flor Kalandiva. Nada mais na
página, na home ou no restante do produto muda.

Esta rodada é **exclusivamente de investigação e planejamento**. Não há
implementação, geração de imagem, provider, crédito, commit, merge, push, deploy,
sync ou archive. A implementação só começa após revisão explícita deste plano e
da composição.

Separada da quick `261104-oac` (comunicação da oferta e do acesso), que está
concluída e arquivada. Aqui não se toca em oferta, acesso, CTAs, âncora, card,
metadata ou indexação.

## 1. Estado do repositório (conferido)

| Item | Valor |
|---|---|
| Branch | `perf/comunicacao-de-oferta-nas-paginas` |
| HEAD | `2175cc8a` (docs da quick `261104-oac`) |
| Base | `3b5ed5d8` (`origin/main`) |
| Distância | 2 commits à frente de `origin/main` |
| Árvore | limpa (`git status --porcelain` sem saída) |
| Alterações preexistentes | nenhuma |
| OpenSpec ativo | nenhum; apenas `openspec/changes/archive/` |
| Quick anterior | `261104-oac` concluída, verificada e arquivada; não reabrir |

Nenhuma alteração preexistente será sobrescrita. Não há migration, banco, env ou
dependência envolvidos.

## 2. Diagnóstico dos arquivos e specs pertinentes

### Arquivos que serão alterados

| Arquivo | Papel hoje | Mudança necessária |
|---|---|---|
| `src/app/(marketing)/floriculturas/page.tsx` | parágrafo do segundo bloco e apoio do encerramento literais | substituir os dois textos e compor o exemplo complementar |
| `src/components/landing/floriculturas/image-sources.ts` | contrato das duas variantes do par da orquídea | acrescentar o contrato da campanha Kalandiva (duas variantes) |
| `src/components/landing/floriculturas/offer-example.tsx` (novo) | — | bloco texto + campanha, sem galeria/carrossel/modal |
| `src/components/landing/floriculturas/demonstration-pair.tsx` | par da orquídea + aviso demonstrativo | remover **apenas** o aviso, conforme D2-A; par, rótulos e ordem intactos |
| `src/__tests__/app/floriculturas-page.test.ts` | congela copy, composição, aviso e CTAs | atualizar textos e cobrir o novo exemplo |
| `src/components/landing/floriculturas/__tests__/image-sources.test.ts` | valida variantes WebP do par | acrescentar o terceiro caso (Kalandiva) |
| `public/floriculturas/campanha-kalandiva-donna-flor-480w.webp` (novo) | — | variante menor |
| `public/floriculturas/campanha-kalandiva-donna-flor-1024w.webp` (novo) | — | variante maior, também `src` |

### Arquivos que NÃO serão alterados

- `src/app/page.tsx`, `src/components/landing/**` da home, header/footer de
  `/floriculturas` e demais páginas.
- `src/components/landing/public-offer-copy.ts`, `offer-card.tsx`,
  `acquisition-cta.tsx`, `access-cta-group.tsx`, `google-button.tsx`.
- `src/lib/seo/**`, `src/app/sitemap.ts`, `src/middleware.ts`, metadata da página.
- `src/components/landing/floriculturas/floriculturas-header.tsx` e o par da
  orquídea (exceto a saída do aviso em D2-A).
- Fontes, dependências, migrations, APIs, autenticação, créditos e flags.

### Spec principal afetada

`openspec/specs/floriculturas-demonstration-page/spec.md` congela hoje:

- o par aprovado como **único** conteúdo demonstrativo;
- a copy exata da página (sem os novos textos);
- a entrega responsiva com **duas** variantes por imagem do par;
- o aviso demonstrativo único associado ao par;
- a proibição de preço/oferta **como texto novo da página**.

Acrescentar uma terceira imagem com preço impresso e três textos novos exige
atualização mínima dessa spec. Sem isso, a implementação entraria em conflito
direto com “Conteúdo demonstrativo estático e par aprovado”, “Copy aprovada sem
acréscimos” e “Entrega responsiva com duas variantes por imagem”.

Nenhuma outra spec é afetada: não há mudança em oferta, acesso,
`landing-conversion-experience`, `access-request-history` ou SEO. Não será criada
nova fase.

## 3. Imagem aprovada — dados conferidos

| Item | Valor |
|---|---|
| Arquivo-fonte | `C:\Users\wagne\Downloads\flor_kalandiva___pote_6-2026-10-31.jpg` |
| Dimensões | **1024 × 1024** (1:1) |
| Formato/peso | JPEG, **242.089 B** |
| Marca na arte | FLORICULTURA DONNA FLOR |
| Produto | Flor Kalandiva — Pote 6 |
| Conteúdo interno que deve permanecer visível | preço “R$ 4,99”, condição “Enquanto durarem os estoques”, “Imagem meramente ilustrativa” e a assinatura da loja |

A campanha é da mesma loja fictícia já usada na página (Donna Flor), o que
preserva a coerência do exemplo. O preço é **conteúdo da arte demonstrativa**,
não oferta do Vendeo.

## 4. Decisões para revisão

### D1 — Onde preservar o arquivo-fonte

- **A (recomendada):** manter o JPEG original intacto em `Downloads` e copiá-lo
  para `.planning/quick/261104-kal-.../evidence/source/`, registrando dimensões,
  bytes e SHA-256. A conversão e os testes ficam reproduzíveis sem depender de
  `Downloads`; o arquivo não é servido publicamente.
- **B:** manter apenas em `Downloads`, registrando dimensões e bytes no plano.
  Menos arquivo no repositório, porém não reproduzível.

Nenhuma das opções coloca o JPEG em `public/`. O site entrega apenas as duas
variantes WebP.

### D2 — Posição do aviso demonstrativo único

O aviso aprovado aparece hoje uma única vez, ao fim do par da orquídea. O novo
exemplo, com preço, fica em uma seção posterior.

- **A (recomendada):** mover o aviso único para o fim do bloco enriquecido,
  imediatamente após a campanha Kalandiva, mantendo-o discreto e cobrindo os dois
  exemplos. A frase não muda; continua exatamente uma ocorrência. A spec passa a
  dizer “junto ao conjunto de exemplos”.
- **B:** manter o aviso sob o par da orquídea e exibir o novo exemplo sem aviso
  adjacente. Preserva a composição atual, mas o exemplo com preço fica sem
  sinalização próxima.

A opção A é a recomendada porque o preço impresso é o elemento que mais exige o
enquadramento demonstrativo. Em ambas, **não** há segunda advertência nem novo
texto de aviso.

### D3 — Variantes e largura de exibição

- **A (recomendada):** duas variantes WebP em **480w** e **1024w**, sem upscale.
  A coluna da imagem mede ~468 px CSS em 1440 e ~342 px em 390; 480w atende 1x e
  1024w atende 2x. Em DPR 3, a resolução fica limitada pelo original de 1024 px:
  não há upscale, e a legibilidade real do preço e da condição será conferida na
  captura mobile.
- **B:** variantes 640w + 1024w. Aumenta o peso da menor sem ganho real em 1x.

A largura final do `sizes` será medida no navegador antes do fechamento; o valor
provisório está na seção 6 e será substituído pela medição real.

### D4 — Alt text sem repetir o preço em HTML

- **A (recomendada):** alt descritivo sem o valor — “Campanha da floricultura
  Donna Flor com a Flor Kalandiva em pote, com preço e condição de estoque”.
  Mantém a imagem acessível sem transformar “R$ 4,99” em texto da página e
  preserva o teste que proíbe `R$` no HTML.
- **B:** alt com o valor. Torna o preço texto da página e quebra o contrato atual.

## 5. Copy aprovada (exata)

### 5.1 Segundo bloco — manter título e substituir o parágrafo por lista

Título (inalterado):

> Crie posts para sua floricultura sem começar do zero.

Lista nova (substitui integralmente o parágrafo atual), com marcadores simples:

> - Apresente novos buquês e arranjos.
> - Destaque as flores disponíveis na semana.
> - Divulgue opções para presentear em ocasiões especiais.

### 5.2 Exemplo complementar (único)

Título do exemplo (`h3`):

> Uma oferta da sua floricultura, pronta para divulgar.

Texto de acompanhamento — **um único parágrafo**:

> Quando tiver uma oferta sazonal, transforme a foto do produto, o preço e as
> condições em uma campanha para suas redes sociais. Destaque o produto, informe
> o preço e apresente as condições da oferta com a identidade da sua loja.

Imagem: campanha Kalandiva, integral, sem recorte, no mesmo tamanho e proporção.

### 5.3 Encerramento — manter título e trocar apenas o apoio

Título (inalterado):

> Como ficaria uma campanha com os produtos da sua floricultura?

Apoio novo (substitui, não acumula):

> Suas flores, sua marca, uma campanha pronta para divulgar.

Frase removida: “Comece com uma foto e as informações do que você quer
divulgar.”

## 6. Proposta de composição

### Desktop (≥ 768 px)

Lista abaixo do título. Na sequência, texto à esquerda e campanha à direita, com
o bloco textual centralizado verticalmente em relação à imagem e linhas alinhadas
à esquerda. Nenhuma altura é forçada: o texto não estica e não recebe espaçamento
para preencher vazio. A imagem mantém 1:1 e a coluna nunca ultrapassa a largura
útil de 976 px do `max-w-5xl`.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Crie posts para sua floricultura sem começar do zero.                │
│                                                                      │
│ • Apresente novos buquês e arranjos.                                 │
│ • Destaque as flores disponíveis na semana.                          │
│ • Divulgue opções para presentear em ocasiões especiais.             │
│                                                                      │
│ ┌───────────────────────────────┐   ┌──────────────────────────────┐ │
│ │                               │   │                              │ │
│ │ Uma oferta da sua             │   │   campanha Kalandiva 1:1     │ │
│ │ floricultura, pronta para     │   │   (468 × 468 CSS)            │ │
│ │ divulgar.                     │   │   sem recorte                │ │
│ │                               │   │   lazy                       │ │
│ │ Quando tiver uma oferta       │   │                              │ │
│ │ sazonal, transforme a foto do │   └──────────────────────────────┘ │
│ │ produto, o preço e as         │                                    │
│ │ condições em uma campanha     │                                    │
│ │ para suas redes sociais.      │                                    │
│ │ Destaque o produto, informe   │                                    │
│ │ o preço e apresente as        │                                    │
│ │ condições da oferta com a     │                                    │
│ │ identidade da sua loja.       │                                    │
│ │                               │                                    │
│ └───────────────────────────────┘                                    │
│                                                                      │
│ As lojas e campanhas apresentadas são exemplos demonstrativos e não  │
│ representam lojas reais nem ofertas comerciais válidas               │
└──────────────────────────────────────────────────────────────────────┘
```

Grade: `grid items-center gap-6 md:grid-cols-2 md:gap-10`. Sem `h-full`,
`min-h`, `justify-between` ou preenchimento artificial no bloco textual.
Classes de leitura do texto seguem o padrão da página (`text-base text-text-secondary`).
O aviso usa `text-xs text-text-secondary`, como hoje.

### Mobile (390 px)

Ordem: título → lista → subtítulo → parágrafo → imagem → aviso. A imagem usa a
largura útil (342 px), sem overflow e sem redução artificial.

```
┌────────────────────────────────────┐
│ Crie posts para sua floricultura   │
│ sem começar do zero.               │
│                                    │
│ • Apresente novos buquês e         │
│   arranjos.                        │
│ • Destaque as flores disponíveis   │
│   na semana.                       │
│ • Divulgue opções para presentear  │
│   em ocasiões especiais.           │
│                                    │
│ Uma oferta da sua floricultura,    │
│ pronta para divulgar.              │
│                                    │
│ Quando tiver uma oferta sazonal,   │
│ transforme a foto do produto, o    │
│ preço e as condições em uma        │
│ campanha para suas redes sociais.  │
│ Destaque o produto, informe o      │
│ preço e apresente as condições da  │
│ oferta com a identidade da sua     │
│ loja.                              │
│                                    │
│ ┌────────────────────────────────┐ │
│ │      campanha Kalandiva 1:1    │ │
│ │          342 × 342            │ │
│ └────────────────────────────────┘ │
│                                    │
│ As lojas e campanhas apresentadas  │
│ são exemplos demonstrativos e não  │
│ representam lojas reais nem        │
│ ofertas comerciais válidas         │
└────────────────────────────────────┘
```

### Encerramento (sem mudança estrutural)

```
Como ficaria uma campanha com os produtos da sua floricultura?

Suas flores, sua marca, uma campanha pronta para divulgar.

[ único card de oferta — id="floriculturas-oferta" ]
```

O card, os botões, a âncora `#floriculturas-oferta`, “Conheça o Vendeo” → `/` e
os estados da flag permanecem idênticos.

## 7. Contrato da imagem

```ts
export const KALANDIVA_IMAGE: FloriculturasImage = {
  src: "/floriculturas/campanha-kalandiva-donna-flor-1024w.webp",
  srcSet:
    "/floriculturas/campanha-kalandiva-donna-flor-480w.webp 480w, /floriculturas/campanha-kalandiva-donna-flor-1024w.webp 1024w",
  sizes: KALANDIVA_IMAGE_SIZES,
  width: 1024,
  height: 1024,
};
```

- `sizes` provisório:
  `(min-width: 1024px) 468px, (min-width: 768px) calc(50vw - 48px), min(448px, calc(100vw - 48px))`.
  Substituir pelo valor medido no navegador.
- `<img>` simples com `src`, `srcSet`, `sizes`, `width={1024}`, `height={1024}`,
  `loading="lazy"`, `decoding="async"`, `className="h-auto w-full rounded-lg border border-border-light bg-bg-deep"`.
- **Sem** `fetchpriority="high"`, sem `fill`, sem `object-cover`, sem recorte.
- O arquivo 1024w é o `src` fallback; o 480w vem primeiro no `srcset`.
- Nenhuma das duas variantes pode pesar mais que o JPEG original (242.089 B).

## 8. Atualização OpenSpec mínima

Change descritiva `openspec/changes/enriquecer-exemplos-floriculturas/`
(`.openspec.yaml`, `proposal.md`, `design.md`, `tasks.md` +
`specs/floriculturas-demonstration-page/spec.md`), sem nova fase.

Requirements **MODIFIED** (apenas os necessários):

1. **Rota pública `/floriculturas` com composição aprovada** — incluir o exemplo
   complementar dentro do segundo bloco, mantendo a ordem geral e o único `h1`.
2. **Copy aprovada sem acréscimos** — acrescentar os três textos aprovados e
   explicitar que “R$ 4,99” e a condição de estoque existem **somente dentro da
   arte**, nunca como texto HTML, metadata ou oferta comercial.
3. **Conteúdo demonstrativo estático e par aprovado** → passa a “conjunto
   aprovado” com as campanhas da orquídea e da Flor Kalandiva; preserva a
   proibição de reutilizar `identidade-floricultura.webp`.
4. **Entrega responsiva com duas variantes por imagem** — terceira imagem, duas
   variantes WebP, `lazy`, proporção 1:1, sem upscale e registro de dimensões e
   pesos.
5. **Aviso demonstrativo único e discreto** — uma única ocorrência, associada ao
   conjunto de exemplos e posicionada conforme D2.

Requirements não tocados: comparação alinhada da orquídea, caminho secundário,
card compacto, metadata/canonical, preservação das rotas.

## 9. Plano de implementação (somente após aprovação)

1. Confirmar D1–D4 e a composição desktop/mobile.
2. Copiar o JPEG-fonte para `evidence/source/` (D1-A) e registrar dimensões,
   bytes e SHA-256.
3. Gerar as duas variantes WebP 480w/1024w com `sharp`, sem crop e sem upscale;
   registrar dimensões e pesos finais.
4. Acrescentar `KALANDIVA_IMAGE` e `KALANDIVA_IMAGE_SIZES` em `image-sources.ts`.
5. Criar `offer-example.tsx` com `h3`, parágrafo e `<img>` responsivo/lazy, sem
   novos controles, galeria, carrossel ou modal.
6. Na `page.tsx`: substituir o parágrafo do segundo bloco, incluir o exemplo e
   trocar somente o apoio do encerramento; mover o aviso conforme D2 (removendo-o
   de `demonstration-pair.tsx` sem tocar no par).
7. Atualizar os testes e adicionar os novos casos (seção 10).
8. Rodar gates e capturas; registrar evidências em `evidence/`.
9. **Parar para aceite visual.** Sem commit automático.

## 10. Testes e critérios de aceite

### 10.1 Conteúdo

- O título do segundo bloco permanece exato.
- A lista nova aparece com três itens e marcadores simples; o parágrafo antigo
  (“Um arranjo para presentear…”) e a versão corrida com vírgulas não aparecem.
- O subtítulo e o parágrafo único do exemplo aparecem exatamente uma vez.
- O apoio novo do encerramento aparece; “Comece com uma foto…” não aparece.
- O título do encerramento permanece exato.
- O aviso demonstrativo continua aparecendo **uma única vez**.
- Nenhum texto comercial novo, tabela, legenda de geração ou frase de advertência
  adicional.
- Nenhum literal `R$` em HTML, metadata, JSON-LD ou copy da página. O caráter
  demonstrativo do preço vem do contexto do exemplo e do aviso único, não do
  formato de entrega; a página não o reproduz como oferta do Vendeo.

### 10.2 Imagem, proporção e legibilidade

- Existe exatamente um arquivo 480w e um 1024w, ambos WebP.
- O 1024w é o `src`; o 480w é o primeiro candidato do `srcset`.
- Dimensões contratadas (480×480 e 1024×1024) e proporção 1:1.
- Peso de cada variante ≤ 242.089 B.
- `width`/`height` explícitos no HTML, sem layout shift.
- `loading="lazy"` no novo exemplo; o par da orquídea continua `eager`.
- A arte é exibida integralmente: preço, “Enquanto durarem os estoques”, marca e
  “Imagem meramente ilustrativa” visíveis em desktop e mobile.

### 10.3 Responsividade e overflow

- `getBoundingClientRect().width` da imagem registrado em 1440×900 e 390×844;
  `sizes` reconciliado com a medição.
- `document.documentElement.scrollWidth === clientWidth` (0 px de overflow) nas
  duas viewports.
- No desktop, texto e imagem na mesma linha, com o bloco textual centralizado
  verticalmente e linhas à esquerda; no mobile, a ordem é título → lista →
  subtítulo → parágrafo → imagem → aviso.
- Nenhuma altura é forçada e o texto não estica para preencher vazio.
- Imagem nunca menor que a largura útil disponível no mobile (sem redução que
  prejudique a leitura do preço).

### 10.4 Preservação de CTAs, card e rotas

- Continua existindo **um único** card de oferta, no encerramento, com
  `id="floriculturas-oferta"`, `tabindex="-1"` e `scroll-mt-24`.
- Os botões da abertura continuam apontando para `#floriculturas-oferta`; o card
  final continua com `/#acesso` (flag off) ou `/signup` (flag on).
- “Conheça o Vendeo” continua em `/`.
- Home, metadata, canonical, robots, sitemap, fontes, header e footer intocados.
- Nenhum ID duplicado e nenhuma chamada a `/api/`.

### 10.5 Testes automatizados afetados

| Arquivo | Cobertura |
|---|---|
| `src/__tests__/app/floriculturas-page.test.ts` | lista nova, ausência do parágrafo antigo, exemplo único, aviso único, imagem lazy, `R$` ausente, card/CTA/âncora preservados, metadata inalterada |
| `src/components/landing/floriculturas/__tests__/image-sources.test.ts` | terceiro caso WebP: existência, formato, dimensões, proporção, peso e ordem do `srcset` |
| `src/components/landing/floriculturas/__tests__/offer-example.test.tsx` (novo, opcional) | `h3`, textos exatos, `loading="lazy"`, `width`/`height`, ausência de controles |

### 10.6 Gates

| Gate | Comando | Limitação declarada |
|---|---|---|
| Testes focados | `npx vitest run src/__tests__/app/floriculturas-page.test.ts src/components/landing/floriculturas/__tests__` | jsdom não mede layout real |
| Suíte local | `npm test` | pode exigir ambiente já preparado |
| Typecheck | `npm run typecheck` | — |
| Lint | `npm run lint` | ESLint atual não cobre TypeScript (limitação já registrada) |
| Build | `npm run build` | inclui `check:cnae`; sem banco/rede |
| OpenSpec | `npx openspec validate enriquecer-exemplos-floriculturas --strict` | — |
| Diff | `git diff --check` | — |
| Visual | build local + CDP em 1440×900 e 390×844 | rolar até o bloco para carregar o lazy; medir overflow |

Nota: `npx openspec validate --all --strict` já falha em 69 specs legadas
preexistentes deste repositório. O gate desta quick valida apenas a change nova e
a spec `floriculturas-demonstration-page`, ambas verdes na presente rodada; o
número global não deve ser atribuído a esta mudança.

### 10.7 Aceite visual

- Capturas desktop e mobile com a imagem carregada.
- Preço, marca e condição legíveis; imagem sem corte.
- Texto e imagem equilibrados no desktop; empilhamento limpo no mobile.
- Nenhum overflow horizontal.
- Card único e CTAs intactos.
- Aprovação explícita antes de commit/fechamento.

## 11. Fora de escopo

- Home e qualquer outra página.
- Alterar oferta, acesso, CTAs, card, âncora, flags, metadata, canonical, sitemap,
  fontes, header ou footer.
- Galeria, carrossel, modal, novo antes/depois, kit de textos, depoimento ou prova
  social.
- Nova fase, backend, autenticação, créditos, dependências, migration ou
  localização.
- Gerar imagens por IA, acionar providers ou consumir créditos.
- Commit, merge, push, deploy, sync ou archive nesta rodada.

## 12. Ponto de parada

Plano e proposta de composição prontos para revisão. **Nenhum arquivo de código,
asset, teste ou spec principal foi alterado.** A única escrita desta rodada são
os artefatos de planejamento em `.planning/quick/261104-kal-.../` e a change
OpenSpec `openspec/changes/enriquecer-exemplos-floriculturas/`.

Aguardando decisão sobre D1–D4 e aprovação da composição antes de implementar.

## 13. Resultado da execução (2026-11-04)

D1–D4 aprovadas com os dois ajustes de justificativa (1024w é o limite do
original, sem upscale; o caráter demonstrativo do preço vem do contexto, não do
formato de entrega). Implementação concluída e **aceite visual aprovado em
2026-11-04**.

Aceite registrado para a versão final: lista de três itens, parágrafo único
centralizado verticalmente ao lado da Kalandiva no desktop e empilhamento aprovado
no mobile. OpenSpec verificado, sincronizado e arquivado em
`openspec/changes/archive/2026-11-04-enriquecer-exemplos-floriculturas/`.
Quick concluída, verificada, sincronizada e arquivada na branch; **não
publicada**. Implementação no commit `0a4541a8`; fechamento documental no commit
seguinte.

### Arquivos alterados/criados

- `src/app/(marketing)/floriculturas/page.tsx` — lista nova, exemplo, aviso único
  ao fim do bloco e apoio do encerramento.
- `src/components/landing/floriculturas/offer-example.tsx` (novo) — subtítulo +
  parágrafo único, `items-center` no desktop (linhas à esquerda), empilhado no
  mobile.
- `src/components/landing/floriculturas/image-sources.ts` — contrato Kalandiva.
- `src/components/landing/floriculturas/demonstration-pair.tsx` — apenas a saída
  do aviso; par intacto.
- `src/__tests__/app/floriculturas-page.test.ts` — copy, exemplo, aviso, lazy,
  metadata sem preço.
- `src/components/landing/floriculturas/__tests__/image-sources.test.ts` —
  terceiro caso WebP.
- `public/floriculturas/campanha-kalandiva-donna-flor-{480w,1024w}.webp`.

### Pesos finais

| Arquivo | Dimensões | Peso |
|---|---|---|
| `campanha-kalandiva-donna-flor-480w.webp` | 480 × 480 | 43.372 B |
| `campanha-kalandiva-donna-flor-1024w.webp` | 1024 × 1024 | 121.074 B |

Fonte preservado em `evidence/source/` (1024 × 1024, 242.089 B, SHA-256
`CF0FD93E…AA5F91`).

### Medições e gates

- Desktop 1440: imagem 468 × 468, `currentSrc` 480w, 0 px de overflow.
- Mobile 390: imagem 342 × 342, `currentSrc` 480w, 0 px de overflow.
- Mobile DPR 3: `currentSrc` 1024w, sem upscale, 0 px de overflow.
- 38 testes focados, 7.717 na suíte completa, typecheck 0, lint 0 (sem TS),
  build 0, OpenSpec valid, diff check limpo.

Evidências: `evidence/final-verification.md`, `evidence/measurements.json`,
`evidence/visual-acceptance.md` e as cinco capturas. Sem commit, merge, push,
deploy ou sync/archive.
