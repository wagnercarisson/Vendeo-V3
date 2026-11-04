---
quick_id: 261104-pdr
slug: pagina-publica-para-padarias
status: complete
mode: implementation
date: 2026-11-04
implemented_on: 2026-11-04
accepted_on: 2026-11-04
branch: feat/pagina-publica-padarias
base_commit: 53df58a7
head_commit: 438bca02
implementation_authorized: true
visual_checkpoint: approved
openspec_change: pagina-publica-demonstrativa-padarias
openspec_archive: openspec/changes/archive/2026-11-04-pagina-publica-demonstrativa-padarias
visual_checkpoint: pending
openspec_change: pagina-publica-demonstrativa-padarias
artifacts:
  diagnostic: 261104-pdr-DIAGNOSTIC.md
  copy: 261104-pdr-COPY.md
---

# Quick 261104-pdr — Página pública `/padarias`

## Objetivo

Planejar a página pública `/padarias` como demonstração do Vendeo — aplicativo
que cria campanhas, artes e textos para divulgação de padarias — usando a foto do
Bolo Naked Fruit, a campanha da Panificadora Dona Maria e um exemplo complementar
de pão francês fresquinho.

Esta rodada é **exclusivamente de investigação e planejamento**. Não há
implementação, geração de imagem, provider, crédito, commit, merge, push, deploy,
tag, sync ou archive. A implementação só começa após revisão explícita da copy, da
composição e das decisões.

A entrega é independente das quicks de oferta e de enriquecimento de
`/floriculturas`, já concluídas e arquivadas. `/floriculturas` não será alterada.

## 1. Estado do repositório (conferido)

| Item | Valor |
|---|---|
| Branch | `feat/pagina-publica-padarias` |
| HEAD | `53df58a7` |
| `origin/main` | `53df58a7` (0 à frente, 0 atrás) |
| Árvore | limpa no início da rodada |
| Alterações preexistentes | nenhuma |
| OpenSpec ativo | nenhum antes desta rodada |
| Quick anterior | `261104-kal` e `261104-oac` concluídas e arquivadas; não reabrir |
| Migration/banco | não se aplicam |

Nenhuma alteração preexistente será sobrescrita. Não há migration, banco, env,
flag ou dependência envolvidos.

## 2. Entregáveis desta rodada

| Artefato | Conteúdo |
|---|---|
| `261104-pdr-DIAGNOSTIC.md` | estado técnico, assets, intenção de busca com fontes e limites, avaliação de dados estruturados, riscos |
| `261104-pdr-COPY.md` | metadata, copy completa, composição desktop/mobile, contratos de imagem, frases proibidas e critérios de aceite |
| `261104-pdr-PLAN.md` | este plano: escopo, decisões, arquivos, implementação, testes, gates e checklist pós-deploy |
| `openspec/changes/archive/2026-11-04-pagina-publica-demonstrativa-padarias/` | proposta, design, tasks e deltas de `padarias-demonstration-page` e `seo-discovery-foundation` |

Nenhum arquivo de código, asset, teste ou spec principal é alterado nesta rodada.

## 3. Escopo funcional proposto

1. Nova rota pública `/padarias`, Server Component, sem autenticação e sem layout
   próprio.
2. Abertura específica para o lojista, identificando o Vendeo como aplicativo.
3. Botões iniciais por âncora para `#padarias-oferta`; “Conheça o Vendeo” para `/`.
4. Foto do bolo → campanha, com proporção 1:1 preservada e sem recorte.
5. Explicação e kit de publicação em HTML, sem botões “Copiar”.
6. Situações comerciais de padaria: novidades da vitrine, fornadas do dia e
   bolos/encomendas.
7. Exemplo complementar do pão: texto à esquerda e imagem à direita no desktop;
   empilhados no mobile; somente a campanha final.
8. Aviso demonstrativo único, após o exemplo do pão.
9. Encerramento com um único card compacto de oferta, alimentado pela fonte
   central.
10. Metadata própria, canonical absoluto, OG/Twitter, indexação fail-closed,
    sitemap e link “Padarias” no rodapé da home.

Fora do escopo funcional: agenda, calendário, publicação automática, integração
com redes sociais, anúncios pagos, encarte, cardápio, carrossel, stories, vídeo,
modal, galeria, depoimento, prova social, nova fase, backend, autenticação,
créditos, flags, migration e dependências.

## 4. Decisões para revisão

Detalhamento completo em `openspec/changes/archive/2026-11-04-pagina-publica-demonstrativa-padarias/design.md`.

### D1 — Componentes locais de padaria

**Recomendado:** criar componentes em `src/components/landing/padarias/**`,
incluindo um grupo de acesso local que reutiliza `AcquisitionCta` e
`PUBLIC_ACCESS_COPY`. Não importar o grupo de `/floriculturas` nem extrair um
componente compartilhado, porque isso exigiria tocar na página aprovada.

**Alternativa:** importar diretamente `floriculturas/access-cta-group`. Menos
código, porém acopla segmentos e dificulta evolução independente.

### D2 — Sem bloco próprio de “como funciona”

**Recomendado:** manter a página objetiva com os sete blocos pedidos. A abertura,
a demonstração e a explicação já deixam claro o funcionamento.

**Alternativa:** acrescentar um bloco compacto de três ou quatro passos, como em
`/floriculturas`. Aumenta a página e foge da composição solicitada.

### D3 — Aviso único após o exemplo do pão

**Recomendado:** uma única ocorrência, imediatamente após o exemplo complementar,
cobrindo as três imagens. Texto exato aprovado, sem repetição no rodapé.

### D4 — Duas variantes 480w/1024w

**Recomendado:** 480w e 1024w por imagem, sem upscale. A prioridade de
carregamento é tratada separadamente, por medição.

**Alternativa:** 640w + 1024w. A menor fica mais pesada sem ganho relevante em 1x.

### D5 — Um único card de oferta, consumido da fonte central

**Recomendado:** usar `OfferCard` compacto no encerramento com ID
`padarias-oferta` e todos os textos de `public-offer-copy.ts`, sem reescrever
números, condições ou rótulos.

### D6 — Sem dados estruturados nesta entrega

**Recomendado:** não incluir JSON-LD. A loja é fictícia; a página não está
oferecendo os alimentos para compra; não há avaliações ou dados autoritativos de
aplicação. Registrar a decisão e avaliar uma camada global
`Organization`/`WebSite` no futuro.

### D7 — Link “Padarias” ao lado de “Floriculturas”

**Recomendado:** adicionar somente esse link no rodapé da home, com as mesmas
classes e comportamento do link vizinho. Nenhuma outra alteração na home.

### Restrições não numeradas

- **Carregamento:** demonstração principal `eager`; exemplo do pão `lazy` e
  `decoding="async"`. Nenhuma imagem recebe `fetchpriority="high"` antes da
  medição de LCP; se o vencedor for o H1, as imagens não competem por prioridade.
- **Preço demonstrativo:** a página não reproduz preço em texto, metadata ou
  JSON-LD. O caráter demonstrativo vem do contexto e do aviso único. Nenhuma
  imagem é recortada para remover conteúdo.

## 5. Arquivos previstos

### Criar

| Arquivo | Papel |
|---|---|
| `src/app/(marketing)/padarias/page.tsx` | composição, metadata e copy |
| `src/components/landing/padarias/padarias-header.tsx` | cabeçalho local |
| `src/components/landing/padarias/access-cta-group.tsx` | grupo de acesso local, modos âncora/real |
| `src/components/landing/padarias/image-sources.ts` | contratos responsivos das três imagens |
| `src/components/landing/padarias/demonstration-pair.tsx` | foto + campanha do bolo |
| `src/components/landing/padarias/publication-kit.tsx` | kit em HTML |
| `src/components/landing/padarias/bread-example.tsx` | texto + campanha do pão |
| `public/padarias/foto-bolo-naked-fruit-{480w,1024w}.webp` | duas variantes |
| `public/padarias/campanha-bolo-naked-fruit-dona-maria-{480w,1024w}.webp` | duas variantes |
| `public/padarias/campanha-pao-frances-fresquinho-dona-maria-{480w,1024w}.webp` | duas variantes |
| `src/__tests__/app/padarias-page.test.ts` | copy, metadata, CTAs, oferta, imagens |
| `src/components/landing/padarias/__tests__/image-sources.test.ts` | contrato offline dos assets |
| `src/__tests__/app/home-footer-links.test.tsx` | link “Padarias” ao lado de “Floriculturas” |

### Alterar

| Arquivo | Mudança |
|---|---|
| `src/lib/seo/indexation-policy.ts` | `PADARIAS_CANONICAL_PATH`, `getSurfacePolicy`, lista de paths |
| `src/app/sitemap.ts` | terceira URL |
| `src/app/page.tsx` | somente o link “Padarias” no rodapé |
| `src/lib/seo/__tests__/indexation-policy.test.ts` | três superfícies |
| `src/__tests__/app/route-indexation-policy.test.ts` | `/padarias` indexável e subcaminho fail-closed |
| `src/__tests__/app/sitemap.test.ts` | três entradas e exclusões preservadas |

### Não alterar

- `/floriculturas` (página, componentes, assets, testes, metadata).
- `public-offer-copy.ts`, `offer-card.tsx`, `acquisition-cta.tsx`,
  `campaign-image.tsx` ou `getLaunchConfig`.
- `src/lib/seo/origin.ts`, `environment.ts`, `robots.ts`, `robots-headers.ts`.
- `middleware.ts`, `next.config.ts`, autenticação, onboarding, créditos,
  elegibilidade, APIs, banco, migrations, flags e configuração externa.
- Home, exceto o link de rodapé.

## 6. Plano de implementação (somente após aprovação)

1. Confirmar D1–D7, a copy de `261104-pdr-COPY.md` e a composição desktop/mobile.
2. Copiar os três originais para `evidence/source/`, registrar dimensões, bytes e
   SHA-256; manter `Downloads` intacto.
3. Gerar as seis variantes WebP 480w/1024w com `sharp`, sem crop e sem upscale;
   registrar dimensões e pesos.
4. Criar `image-sources.ts`, `demonstration-pair.tsx`, `publication-kit.tsx`,
   `bread-example.tsx`, `access-cta-group.tsx` e `padarias-header.tsx`.
5. Criar a página `/padarias` com a ordem e a copy aprovadas; usar o único
   `OfferCard` compacto no encerramento.
6. Atualizar a política de indexação, o sitemap e o rodapé da home.
7. Criar e atualizar os testes da seção 7.
8. Rodar gates e capturas; registrar evidências em `evidence/`.
9. **Parar para aceite visual.** Sem commit automático.

## 7. Testes e critérios de aceite

### 7.1 Conteúdo

- H1, abertura, títulos, rótulos, explicação, kit, situações, exemplo do pão e
  encerramento exatamente como em `261104-pdr-COPY.md`.
- Um único `h1`; hierarquia `h2`/`h3` coerente.
- Kit com título, legenda, quatro hashtags e chamada; cada campo uma vez.
- Nenhum botão “Copiar”, captura de tela ou controle operacional.
- Aviso demonstrativo uma única vez, após o exemplo do pão.
- Nenhum texto sobre agendamento, calendário, publicação automática, anúncios,
  tráfego, alcance, posição ou aumento de vendas.
- Nenhum preço, avaliação, endereço, telefone ou dado de loja real em HTML ou
  metadata.
- Nenhum `Bakery`, `LocalBusiness`, `Product`, `Offer`, `Review` ou
  `AggregateRating` em JSON-LD.

### 7.2 Assets e desempenho

- Seis WebP: 480w e 1024w para cada imagem.
- Dimensões 480×480 e 1024×1024; proporção 1:1; sem upscale.
- Peso de cada variante ≤ original correspondente.
- `src` é 1024w; 480w é o primeiro candidato do `srcset`.
- `width`/`height` explícitos; zero layout shift.
- Demonstração principal `eager`; exemplo do pão `lazy` e `decoding="async"`.
- Registrar largura real, `currentSrc`, overflow e LCP em 1440×900 e 390×844.
- Nenhuma fonte externa, nova dependência, carrossel ou modal.

### 7.3 CTAs, oferta e flags

- Dois grupos de acesso: abertura em modo âncora, encerramento em modo real.
- Flag fechada: abertura com `#padarias-oferta`; card com `/#acesso`; “Conheça o
  Vendeo” em `/`.
- Flag aberta: abertura com Google/e-mail locais; card com Google/OAuth e
  `/signup`; “Conheça o Vendeo” em `/`.
- Um único card compacto, `id="padarias-oferta"`, `tabindex="-1"`,
  `scroll-mt-24`.
- Resumo, complemento, expansível, CTA/apoio fechado e nota vêm de
  `public-offer-copy.ts`, sem duplicação.
- Nenhum ID duplicado e nenhuma chamada a `/api/`.
- Acessibilidade estrutural: `header`/`main`/`footer`, um único `h1`, todos os
  `alt` preenchidos, seta `aria-hidden`, kit em `dl`, oferta em
  `details`/`summary`, foco visível e toque mínimo de 44 px.

### 7.4 SEO e preservação

- Metadata matrix: produção válida, preview, local, produção com `www` e
  produção com `http`.
- Canonical absoluto somente em produção válida; caso contrário omitido.
- `/padarias` no sitemap somente em produção válida; exatamente três URLs.
- `getSurfacePolicy("/padarias")` indexável; `/padarias/exemplo` fail-closed.
- Rodapé da home com “Padarias” ao lado de “Floriculturas”; restante preservado.
- `/floriculturas`, rotas privadas, legais e transitórias permanecem `noindex` e
  fora do sitemap.
- `middleware.ts` e `next.config.ts` inalterados.

### 7.5 Testes automatizados previstos

| Arquivo | Cobertura |
|---|---|
| `src/__tests__/app/padarias-page.test.ts` | metadata/canonical, copy, kit, aviso, imagens, CTAs, card, flags, ausência de promessas e de `R$` |
| `src/components/landing/padarias/__tests__/image-sources.test.ts` | existência, formato, dimensões, proporção, peso e ordem dos candidatos |
| `src/lib/seo/__tests__/indexation-policy.test.ts` | três superfícies, `/padarias`, normalização e fail-closed |
| `src/__tests__/app/route-indexation-policy.test.ts` | `/padarias` indexável; subcaminho noindex |
| `src/__tests__/app/sitemap.test.ts` | três URLs em produção válida; vazio nos demais cenários; exclusões |
| `src/__tests__/app/home-footer-links.test.tsx` | “Padarias” ao lado de “Floriculturas” e preservação do restante |

## 8. Gates

| Gate | Comando | Limitação declarada |
|---|---|---|
| Testes focados | `npx vitest run src/__tests__/app/padarias-page.test.ts src/__tests__/app/home-footer-links.test.tsx src/__tests__/app/sitemap.test.ts src/__tests__/app/route-indexation-policy.test.ts src/lib/seo/__tests__/indexation-policy.test.ts src/components/landing/padarias/__tests__` | jsdom não mede layout real |
| Suíte local | `npm test` | pode exigir ambiente já preparado; registrar duração e falhas preexistentes |
| Typecheck | `npm run typecheck` | — |
| Lint | `npm run lint` | ESLint atual não cobre TypeScript (limitação já registrada) |
| Build | `npm run build` | inclui `check:cnae`; sem banco/rede |
| HTML compilado | `npm run build` + `next start` local e inspeção de `/padarias`, `/sitemap.xml`, `/robots.txt` e headers | local permanece `noindex` e sem canonical de produção por design |
| OpenSpec | `npx openspec validate pagina-publica-demonstrativa-padarias --strict` | validar também os deltas de `padarias-demonstration-page` e `seo-discovery-foundation` |
| Diff | `git diff --check` | — |
| Visual | build local + CDP em 1440×900, 834×1112 e 390×844, nos dois estados da flag | rolar até o exemplo do pão para carregar o lazy; medir overflow e LCP; não clicar no Google |

Nota: `npx openspec validate --all --strict` já falha em dezenas de specs legadas
preexistentes. O gate desta quick valida apenas a change nova e suas specs; o
número global não deve ser atribuído a esta mudança.

## 9. Aceite visual

- Capturas em desktop (1440×900), tablet (834×1112) e mobile (390×844), com as
  três imagens carregadas e nos dois estados da flag.
- Texto do kit legível; marca, selo e detalhes das artes preservados; nenhum
  recorte.
- Desktop: foto/campanha alinhadas; exemplo do pão com texto à esquerda e imagem à
  direita, centralizados verticalmente.
- Tablet: colunas sem colisão, texto e imagem equilibrados, sem overflow.
- Mobile: empilhamento limpo, sem overflow horizontal.
- Estado aberto: botão Google real visível no card final, sem clique, sem OAuth e
  sem autenticação; abertura ainda em modo âncora.
- Aviso único, card único, CTAs e âncoras intactos nos dois estados da flag.
- Aprovação explícita antes de commit ou fechamento.

## 10. Checklist pós-deploy (separado)

O checklist de publicação vive em `261104-pdr-POST-DEPLOY.md`. Ele fica fora da
rodada de implementação, não é marcado como concluído antes da publicação e não
bloqueia sync/archive da change.

## 11. Fora de escopo

- Implementar qualquer parte da página nesta rodada.
- Alterar `/floriculturas`, home (exceto link de rodapé), oferta, acesso, CTAs,
  card, âncora, flags, créditos, elegibilidade, onboarding, autenticação, APIs,
  banco, migrations ou configuração externa.
- Gerar imagens, chamar provider ou consumir créditos.
- Criar agenda, calendário, publicação automática, anúncios, encarte, cardápio,
  carrossel, modal, galeria, depoimento ou prova social.
- Criar nova fase, dependência, framework genérico de páginas ou dados
  estruturados de loja/produto.
- Commit, sync, archive, merge, push, deploy ou tag.

## 12. Resultado da execução (2026-11-04)

Aprovação recebida com os três ajustes de planejamento incorporados:

1. checklist pós-deploy separado em `261104-pdr-POST-DEPLOY.md`, sem checkboxes
   em `tasks.md` e sem bloquear archive;
2. capturas nas duas flags, com tablet intermediário e botão Google real no card
   aberto, sem clique nem autenticação;
3. decisões renumeradas para D1–D7, com carregamento e preço demonstrativo como
   restrições não numeradas.

Implementação concluída. `/padarias`, componentes locais, seis WebP, política de
indexação, sitemap e link de rodapé foram entregues. Nenhum arquivo de
`/floriculturas` foi alterado.

Gates: 6 arquivos focados / 123 testes; suíte local 7.768 passed + 10 skipped;
typecheck 0; lint 0 (sem cobertura TS); build 0; OpenSpec `--strict` válido;
`git diff --check` limpo.

Medições: overflow 0 px em 1440, 834 e 390; LCP = H1; 480w em DPR1 e 1024w em
DPR3. Flag aberta: botão Google real no card, sem clique; abertura em âncora
local. Evidências em `evidence/`.

**Parado para aceite visual.** Sem commit, sync/archive, merge, push, deploy ou
tag.

## 13. Fechamento (2026-11-04)

Aceite visual aprovado pelo responsável nos estados aberto e fechado. OpenSpec
verificado sem divergências bloqueantes, sincronizado e arquivado em
`openspec/changes/archive/2026-11-04-pagina-publica-demonstrativa-padarias/`.
Specs principais atualizadas: `padarias-demonstration-page` (nova) e
`seo-discovery-foundation`.

Commits locais:

- `438bca02` — implementação (código, testes e assets);
- commit de fechamento — documentação, evidências, STATE e archive OpenSpec.

Status final: **concluída, verificada, sincronizada e arquivada na branch — não
publicada**. Checklist pós-deploy permanece separado e pendente em
`261104-pdr-POST-DEPLOY.md`. Sem merge, push, deploy ou tag.
