---
quick_id: 261109-mrc
slug: ofertas-para-mercados
status: complete
mode: implementation
date: 2026-11-09
branch: perf/pagina-oferta-mercearia
base_commit: 8f259b86
code_commit: e729c741
implementation_authorized: true
visual_checkpoint: approved
openspec_archive: openspec/changes/archive/2026-11-10-ofertas-para-mercados
openspec_change: ofertas-para-mercados
artifacts:
  diagnostic: 261109-mrc-DIAGNOSTIC.md
  copy: 261109-mrc-COPY.md
  post_deploy: 261109-mrc-POST-DEPLOY.md
---

# Quick 261109-mrc — Página pública `/ofertas-para-mercados`

## 1. Objetivo

Planejar a página pública `/ofertas-para-mercados` como demonstração do Vendeo — aplicativo que transforma informações de uma oferta em arte e texto para divulgar produtos nas redes sociais — usando a foto do coxão mole no açougue, a campanha quadrada da Mercearia Tio João e o exemplo complementar do café Melitta da mesma marca fictícia.

Esta rodada é **exclusivamente de diagnóstico, copy, composição, plano e proposta OpenSpec**. Não há implementação, geração de imagem, provider, crédito, alteração de banco/env/flag, commit, sync, archive, merge, push, deploy, tag ou acesso à produção. A implementação só começa após revisão explícita.

## 2. Estado do repositório (conferido)

| Item | Valor |
|---|---|
| Branch | `perf/pagina-oferta-mercearia` |
| HEAD | `8f259b86` |
| `origin/main` | `8f259b86` |
| Divergência | 0 à frente, 0 atrás |
| Árvore | limpa no início da rodada |
| Alterações preexistentes | nenhuma |
| OpenSpec ativo | nenhum antes desta rodada |
| Quicks anteriores relacionadas | `261103-qew`, `261104-pdr`, `261108-j3p` — concluídas; não reabrir |
| Migration/banco | não se aplicam |

Nenhuma alteração preexistente será sobrescrita. Não há migration, banco, env, flag ou dependência envolvidos.

## 3. Entregáveis desta rodada

| Artefato | Conteúdo |
|---|---|
| `261109-mrc-DIAGNOSTIC.md` | estado técnico, padrões existentes, assets, indexação, riscos e decisões pendentes |
| `261109-mrc-COPY.md` | metadata, copy completa, composição desktop/tablet/mobile, contrato de imagens e critérios de aceite |
| `261109-mrc-PLAN.md` | este plano: escopo, decisões, arquivos, implementação, testes, gates e out-of-scope |
| `261109-mrc-POST-DEPLOY.md` | checklist de publicação, separado do fechamento local |
| `openspec/changes/ofertas-para-mercados/` | proposta, design, tasks e deltas mínimos de `ofertas-para-mercados-demonstration-page`, `seo-discovery-foundation` e `public-footer-navigation` |

Nenhum arquivo de código, asset, teste ou spec principal é alterado nesta rodada.

## 4. Escopo funcional proposto

1. Nova rota pública `/ofertas-para-mercados`, Server Component, sem autenticação e sem layout próprio.
2. Abertura com H1 aprovado, apresentação breve do aplicativo e grupo de acesso.
3. Demonstração principal: foto horizontal do açougue → campanha quadrada da carne, com os rótulos “Foto do produto” e “Campanha criada com o Vendeo”.
4. Explicação breve sobre produto, preço anterior/promocional, validade, condições e marca.
5. Kit de publicação da carne em HTML, com o texto exato aprovado e sem botões “Copiar”.
6. Exemplo complementar do café, com texto curto mostrando outra categoria da mesma Mercearia Tio João.
7. Aviso demonstrativo único, após o exemplo do café, cobrindo os dois exemplos e a Melitta.
8. Encerramento com um único `OfferCard` compacto, alimentado por `public-offer-copy.ts`.
9. Rodapé público compartilhado, com o novo destino “Mercados e mercearias” na lista central.
10. Metadata própria, canonical absoluto somente em produção válida, OG/Twitter com imagem institucional, indexação fail-closed, sitemap e política de superfícies.
11. Nenhum dado estruturado de mercado, açougue, produto, oferta, avaliação ou negócio fictício.

Fora do escopo funcional: encarte multiproduto, catálogo, carrossel, stories, vídeo, agenda, calendário, publicação automática, integração com redes sociais, anúncios pagos, gestor de tráfego, modal, galeria, depoimento, prova social, nova fase, backend, autenticação, créditos, flags, migration e dependências.

## 5. Decisões

### Aprovadas — não reabrir

- URL `/ofertas-para-mercados`.
- Title “Crie artes de ofertas para mercados e mercearias | Vendeo”.
- H1 “Sua oferta merece chamar atenção. Sem complicar sua rotina.”.
- Rótulo do rodapé “Mercados e mercearias”.
- Materiais: foto do açougue + campanha quadrada da carne; café Melitta como exemplo complementar.
- Não gerar outra campanha; não usar a campanha 9:16; não usar a foto gastronômica anterior.
- Rótulos “Foto do produto” e “Campanha criada com o Vendeo”.
- Kit de publicação exato.
- Aviso demonstrativo único exato.
- Um único card de oferta no encerramento.
- Imagem OG institucional existente.
- Ausência de dados estruturados comerciais.
- Não afirmar que a foto foi capturada por celular.

### Aprovadas na revisão de 2026-11-09

| # | Decisão | Valor aprovado |
|---|---|---|
| P1 | Description da metadata | “Crie artes e textos para divulgar as ofertas do seu mercado, mercearia ou minimercado nas redes sociais. Com a identidade do seu estabelecimento.” |
| P2 | Copy do corpo | Abertura, títulos, café e encerramento conforme `261109-mrc-COPY.md`, com a explicação consolidada em um único parágrafo após o par |
| P3 | Ordem do link no rodapé | Floriculturas → Padarias → Mercados e mercearias → Campanhas sem complicação |
| P4 | Diretório dos novos assets | `public/mercados/` |
| P5 | Reuso do café | `hero-oferta-cafe-480w.webp` + `hero-oferta-cafe.webp` (1024), sem novo derivado |
| P6 | Grade principal | Tablet `3fr/4fr`; desktop `minmax(0,360px) auto minmax(0,480px)`; foto menor e centralizada, campanha em destaque; mobile empilhado |
| P7 | Ordem da superfície em SEO | Inserir `/ofertas-para-mercados` após `/padarias` e antes de `/campanhas-para-sua-loja` |
| P8 | Branch | Continuar em `perf/pagina-oferta-mercearia` |

### Consolidação editorial aprovada

O texto de apoio que ficava sob a demonstração e a seção “Uma oferta clara…” foram
consolidados em um único bloco após o par:

> Uma oferta clara, com a identidade da sua loja.
>
> Você informa o produto, o preço anterior, o preço promocional e o período de
> validade da oferta. O Vendeo organiza essas informações em uma campanha com o
> produto em destaque e a identidade da sua loja.

Depois desse bloco, a página segue diretamente para o kit. A expressão usada é
“validade da oferta”, não “validade da campanha”. A copy do kit permanece
integralmente preservada; o card foi alargado de `max-w-2xl` para `max-w-3xl`
junto com a coluna de leitura, mudança revisada e aceita explicitamente.

## 6. Arquivos previstos

### Criar

| Arquivo | Papel |
|---|---|
| `src/app/(marketing)/ofertas-para-mercados/page.tsx` | composição, metadata e copy |
| `src/components/landing/mercados/mercados-header.tsx` | cabeçalho local |
| `src/components/landing/mercados/access-cta-group.tsx` | grupo de acesso local, modos âncora/real |
| `src/components/landing/mercados/image-sources.ts` | contratos responsivos das três imagens |
| `src/components/landing/mercados/demonstration-pair.tsx` | foto horizontal + campanha quadrada |
| `src/components/landing/mercados/publication-kit.tsx` | kit em HTML |
| `src/components/landing/mercados/coffee-example.tsx` | texto + campanha do café |
| `public/mercados/foto-coxao-mole-acougue-{480w,1024w}.webp` | duas variantes |
| `public/mercados/campanha-coxao-mole-tio-joao-{480w,1024w}.webp` | duas variantes |
| `src/__tests__/app/ofertas-para-mercados-page.test.ts` | copy, metadata, CTAs, oferta, imagens |
| `src/components/landing/mercados/__tests__/image-sources.test.ts` | contrato offline dos assets |

### Alterar

| Arquivo | Mudança |
|---|---|
| `src/lib/seo/indexation-policy.ts` | `OFERTAS_PARA_MERCADOS_CANONICAL_PATH`, `INDEXABLE_CANONICAL_PATHS`, `getSurfacePolicy` |
| `src/app/sitemap.ts` | quinta URL |
| `src/components/landing/public-footer-nav.ts` | novo destino “Mercados e mercearias” |
| `src/lib/seo/__tests__/indexation-policy.test.ts` | cinco superfícies |
| `src/__tests__/app/route-indexation-policy.test.ts` | nova rota indexável; subcaminho fail-closed |
| `src/__tests__/app/sitemap.test.ts` | cinco entradas e exclusões preservadas |
| `src/components/landing/__tests__/public-footer.test.tsx` | quatro destinos e `aria-current` |
| `src/__tests__/app/home-footer-links.test.tsx` | novo destino na home e ordem |

### Não alterar

- `/floriculturas`, `/padarias`, `/campanhas-para-sua-loja` e a home;
- `public-offer-copy.ts`, `offer-card.tsx`, `acquisition-cta.tsx` e `getLaunchConfig`;
- `src/lib/seo/origin.ts`, `environment.ts`, `robots.ts`, `robots-headers.ts`, `middleware.ts` e `next.config.ts`;
- autenticação, onboarding, créditos, elegibilidade, APIs, banco, migrations, flags e configuração externa;
- os quatro consumidores do rodapé.

## 7. Plano de implementação (somente após aprovação)

1. Confirmar P1–P7 e a copy de `261109-mrc-COPY.md`.
2. Copiar os três originais para `evidence/source/`, registrar dimensões, bytes e SHA-256; manter `Downloads` intacto.
3. Gerar as quatro variantes WebP da carne com `sharp`, sem crop e sem upscale; registrar dimensões e pesos.
4. Confirmar que os derivados existentes do café correspondem ao `hero.png` aprovado; reutilizar 480w + base 1024.
5. Criar `image-sources.ts`, `demonstration-pair.tsx`, `publication-kit.tsx`, `coffee-example.tsx`, `access-cta-group.tsx` e `mercados-header.tsx`.
6. Criar a página com a ordem e a copy aprovadas; usar o único `OfferCard` compacto no encerramento.
7. Atualizar a política de indexação, o sitemap e a lista central do rodapé.
8. Criar e atualizar os testes da seção 8.
9. Rodar gates e capturas; registrar evidências em `evidence/`.
10. **Parar para aceite visual.** Sem commit automático.

## 8. Testes e critérios de aceite

### 8.1 Conteúdo

- H1, abertura, títulos, rótulos, explicação, kit, exemplo do café e encerramento exatamente como em `261109-mrc-COPY.md`.
- Um único `h1`; hierarquia `h2`/`h3` coerente.
- Kit com título, legenda, quatro hashtags e chamada; cada campo uma vez.
- Nenhum botão “Copiar”, captura de tela ou controle operacional.
- Aviso demonstrativo uma única vez, após o exemplo do café.
- Nenhum texto sobre agendamento, calendário, publicação automática, anúncios, tráfego, alcance, posição ou aumento de vendas.
- Nenhum preço, avaliação, endereço, telefone ou dado de loja real em HTML fora do kit/artes aprovadas ou em metadata.
- Nenhum `GroceryStore`, `Butcher`, `LocalBusiness`, `Product`, `Offer`, `Review` ou `AggregateRating` em JSON-LD.
- Nenhuma menção a “loja pequena”, “começar do zero”, “tela em branco” ou captura por celular.
- Nenhuma alegação de rastreabilidade técnica, dados de geração, custo ou provider.

### 8.2 Assets e desempenho

- Quatro WebP novos: 480w e 1024w para a foto e para a campanha da carne.
- Foto: 480×320 e 1024×683; campanha: 480×480 e 1024×1024.
- Proporções preservadas; sem upscale; sem crop.
- Café reutiliza 480×480 e 1024×1024 existentes.
- Peso de cada variante ≤ original correspondente.
- `src` é a maior variante; `srcset` lista 480w e 1024w em ordem crescente.
- `width`/`height` explícitos; zero layout shift.
- Demonstração principal `eager`; café `lazy` e `decoding="async"`.
- Nenhuma imagem com `fetchpriority="high"` antes da medição.
- Registrar largura real, `currentSrc`, overflow, proporções e LCP em 1440×900, 834×1112 e 390×844.
- Nenhuma fonte externa, nova dependência, carrossel ou modal.

### 8.3 CTAs, oferta e flags

- Dois grupos de acesso: abertura em modo âncora, encerramento em modo real.
- Flag fechada: abertura com `#ofertas-mercados-oferta`; card com `/#acesso`; “Conheça o Vendeo” em `/`.
- Flag aberta: abertura com Google/e-mail locais; card com Google/OAuth e `/signup`; “Conheça o Vendeo” em `/`.
- Um único card compacto, `id="ofertas-mercados-oferta"`, `tabindex="-1"`, `scroll-mt-24`.
- Resumo, complemento, expansível, CTA/apoio fechado e nota vêm de `public-offer-copy.ts`, sem duplicação.
- Nenhum ID duplicado e nenhuma chamada a `/api/`.
- Acessibilidade estrutural: `header`/`main`/`footer`, um único `h1`, todos os `alt` preenchidos, seta `aria-hidden`, kit em `dl`, oferta em `details`/`summary`, foco visível e toque mínimo de 44 px.
- Rótulos não participam do cálculo de centralização da seta.

### 8.4 SEO e preservação

- Metadata matrix: produção válida, preview, local, produção com `www` e produção com `http`.
- Canonical absoluto somente em produção válida; caso contrário omitido.
- `/ofertas-para-mercados` no sitemap somente em produção válida; exatamente cinco URLs.
- `getSurfacePolicy("/ofertas-para-mercados")` indexável; subcaminho fail-closed.
- Rodapé compartilhado com quatro destinos e `aria-current` correto.
- Nenhuma página consome a lista de navegação para indexação.
- `/floriculturas`, `/padarias`, `/campanhas-para-sua-loja`, rotas privadas, legais e transitórias permanecem como estão.
- `middleware.ts` e `next.config.ts` inalterados.
- Nenhuma imagem OG nova; reutilizar `/seo/vendeo-og-1200x630.png`.

### 8.5 Testes automatizados previstos

| Arquivo | Cobertura |
|---|---|
| `src/__tests__/app/ofertas-para-mercados-page.test.ts` | metadata/canonical, copy, kit, aviso, imagens, CTAs, card, flags, ausência de promessas, de preço em metadata e de JSON-LD |
| `src/components/landing/mercados/__tests__/image-sources.test.ts` | existência, formato, dimensões, proporção, peso e ordem dos candidatos |
| `src/lib/seo/__tests__/indexation-policy.test.ts` | cinco superfícies, nova rota, normalização e fail-closed |
| `src/__tests__/app/route-indexation-policy.test.ts` | nova rota indexável; subcaminho noindex |
| `src/__tests__/app/sitemap.test.ts` | cinco URLs em produção válida; vazio nos demais cenários; exclusões |
| `src/components/landing/__tests__/public-footer.test.tsx` | quatro destinos, ordem, `aria-current` e preservação |
| `src/__tests__/app/home-footer-links.test.tsx` | novo destino na home e preservação do restante |

## 9. Gates

| Gate | Comando | Limitação declarada |
|---|---|---|
| Testes focados | `npx vitest run src/__tests__/app/ofertas-para-mercados-page.test.ts src/__tests__/app/home-footer-links.test.tsx src/__tests__/app/sitemap.test.ts src/__tests__/app/route-indexation-policy.test.ts src/lib/seo/__tests__/indexation-policy.test.ts src/components/landing/__tests__/public-footer.test.tsx src/components/landing/mercados/__tests__` | jsdom não mede layout real |
| Suíte local | `npm test` | pode exigir ambiente preparado; registrar duração e falhas preexistentes |
| Typecheck | `npm run typecheck` | — |
| Lint | `npm run lint` | ESLint atual não cobre TypeScript (limitação já registrada) |
| Build | `npm run build` | inclui `check:cnae`; sem banco/rede |
| HTML compilado | `npm run build` + `next start` local e inspeção de `/ofertas-para-mercados`, `/sitemap.xml`, `/robots.txt` e headers | local permanece `noindex` e sem canonical de produção por design |
| OpenSpec | `npx openspec validate ofertas-para-mercados --strict` | validar também os deltas de `seo-discovery-foundation` e `public-footer-navigation` |
| Diff | `git diff --check` | — |
| Visual | build local + CDP em 1440×900, 834×1112 e 390×844, nos dois estados da flag | rolar até o café para carregar o lazy; medir overflow e LCP; não clicar no Google |

Nota: `npx openspec validate --all --strict` já falha em specs legadas preexistentes. O gate desta quick valida apenas a change nova e suas specs; o número global não deve ser atribuído a esta mudança.

## 10. Aceite visual

- Capturas em desktop (1440×900), tablet (834×1112) e mobile (390×844), com as três imagens carregadas e nos dois estados da flag.
- Texto do kit legível; marca, selo, preços e validade das artes preservados; nenhum recorte.
- Desktop: foto com no máximo 360 px, verticalmente centralizada; campanha com no máximo 480 px e maior destaque; seta centralizada entre as áreas visuais, sem considerar os rótulos; café com texto à esquerda e imagem à direita.
- Tablet: colunas sem colisão, texto e imagem equilibrados, sem overflow.
- Mobile: empilhamento limpo, sem overflow horizontal.
- Estado aberto: botão Google real visível no card final, sem clique, sem OAuth e sem autenticação; abertura ainda em modo âncora.
- Aviso único, card único, CTAs e âncoras intactos nos dois estados da flag.
- Aprovação explícita antes de commit ou fechamento.

## 11. Checklist pós-deploy (separado)

O checklist de publicação vive em `261109-mrc-POST-DEPLOY.md`. Ele fica fora da rodada de implementação, não é marcado como concluído antes da publicação e não bloqueia sync/archive da change.

## 12. Fora de escopo desta rodada

- Implementar qualquer parte da página.
- Alterar páginas, componentes, assets, testes ou specs principais.
- Gerar imagens, chamar provider ou consumir créditos.
- Alterar banco, env, flag, dependência ou configuração externa.
- Criar encarte, catálogo, carrossel, stories, vídeo, agenda, publicação automática, anúncio ou dados estruturados de loja/produto.
- Commit, sync, archive, merge, push, deploy ou tag.
- Acessar produção.

## 13. Resultado da implementação (2026-11-09)

Implementação concluída localmente na branch `perf/pagina-oferta-mercearia`, com a
consolidação editorial aprovada. A demonstração não tem parágrafo de apoio; a
explicação consolidada aparece uma única vez após o par e antes do kit.

Gates: **148/148** testes focados; suíte local **8326 passed, 10 skipped, 5
failed** (falhas preexistentes ou intermitentes: `landing-page` 1,
`legacy-frontier` 3, `store-identity-form` 1); typecheck 0; lint 0 (sem cobertura
TS); build 0 com 100/100 páginas; `git diff --check` limpo; OpenSpec `--strict`
válido.

Medições: overflow 0 px em 1440, 834 e 390; foto com no máximo 360 px e campanha
com no máximo 480 px no desktop; foto centralizada contra a campanha;
`sizes` reconciliados (360/480 desktop, 306/408 tablet, 342 mobile); DPR3 usa
1024w; café lazy e 480w em DPR1; nenhuma imagem com `fetchpriority="high"`; LCP
variou entre H1, P e foto. Títulos com `text-balance` e parágrafos com
`text-pretty`.

Evidências em `evidence/261109-mrc-EVIDENCE.md` e capturas nas duas flags.

## 14. Fechamento local (2026-11-09)

- Aceite visual aprovado, incluindo o ajuste do rótulo da foto e a aceitação
  explícita do card do kit em `max-w-3xl`.
- Implementação commitada em `e729c741`.
- OpenSpec verificado, sincronizado e arquivado em
  `openspec/changes/archive/2026-11-10-ofertas-para-mercados/`.
- Specs principais: `ofertas-para-mercados-demonstration-page` (nova),
  `seo-discovery-foundation` e `public-footer-navigation` (atualizadas).
- Verificação: `261109-mrc-OPENSPEC-VERIFY.md`.
- Merge, push, deploy e tag permanecem como etapas do responsável, não executadas.
