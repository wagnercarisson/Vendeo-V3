---
quick_id: 261107-pdp
slug: pagina-publica-praticidade-e-identidade
status: complete
mode: implementation
date: 2026-11-07
implemented_on: 2026-11-07
accepted_on: 2026-11-07
branch: perf/quick-pagina-demonstracao-praticidade
base_commit: c55a0171
implementation_authorized: true
visual_checkpoint: approved
openspec_change: pagina-publica-praticidade-e-identidade
openspec_archive: openspec/changes/archive/2026-11-07-pagina-publica-praticidade-e-identidade
artifacts:
  diagnostic: 261107-pdp-DIAGNOSTIC.md
  copy: 261107-pdp-COPY.md
  summary: 261107-pdp-SUMMARY.md
  openspec_verify: 261107-pdp-OPENSPEC-VERIFY.md
  post_deploy: 261107-pdp-POST-DEPLOY.md
---

# Quick 261107-pdp — Página pública de praticidade e identidade

## Objetivo

Planejar uma página pública que responda à pergunta “Por que vou pagar por isso?”
demonstrando, com dois casos reais gerados no aplicativo (ração 1:1 e cama 9:16),
que poucas informações sobre o produto e a divulgação bastam para receber uma
campanha com arte, texto e a identidade da loja.

O pet shop é o **exemplo visual**. O público é o pequeno lojista que acumula
tarefas. A página posiciona o Vendeo como **aplicativo**, não como pet shop,
agência, gestor de tráfego ou ferramenta de agendamento.

Esta rodada é **exclusivamente de investigação, planejamento, copy e proposta
OpenSpec**. Não há implementação, geração de imagem, provider, crédito, commit,
merge, push, deploy, tag, sync ou archive. A implementação só começa após revisão
explícita da URL, da copy, da composição e das decisões abaixo.

## 1. Estado conferido

| Item | Valor |
|---|---|
| Branch | `perf/quick-pagina-demonstracao-praticidade` |
| HEAD | `c55a0171` |
| `origin/main` | `c55a0171` (0 à frente, 0 atrás) |
| Árvore | limpa no início da rodada |
| Alterações preexistentes | nenhuma |
| OpenSpec ativo | nenhum antes desta rodada |
| F59 / 9:16 | funcional e disponível em produção (deploy READY, migration aplicada, flag ON, smoke vertical registrado) |
| Migration/banco | não se aplicam |

A confirmação do 9:16 está detalhada em `261107-pdp-DIAGNOSTIC.md` §2. A página
não lê flag, não gera campanha e não consome crédito; apenas apresenta campanhas
já geradas e autorizadas.

## 2. Entregáveis desta rodada

| Artefato | Conteúdo |
|---|---|
| `261107-pdp-DIAGNOSTIC.md` | estado, F59/9:16, assets e correspondência, intenção de busca com fontes e limites, SEO técnico, dados estruturados, riscos |
| `261107-pdp-COPY.md` | metadata, URL, H1/H2, copy completa, kit exato, composição desktop/mobile, contratos de imagem, frases proibidas e critérios de aceite |
| `261107-pdp-PLAN.md` | este plano: escopo, decisões, arquivos, implementação, testes, gates e aceite visual |
| `261107-pdp-POST-DEPLOY.md` | checklist pós-deploy separado, fora da rodada e sem bloquear archive |
| `openspec/changes/pagina-publica-praticidade-e-identidade/` | proposta, design, tasks e deltas de `campanhas-para-sua-loja-demonstration-page` e `seo-discovery-foundation` |

Nenhum arquivo de código, asset, teste ou spec principal é alterado nesta rodada.

## 3. Escopo funcional proposto

1. Nova rota pública `/campanhas-para-sua-loja`, Server Component, sem
   autenticação e sem layout próprio.
2. Abertura centrada em praticidade e valor para a rotina, com H1, texto, linha
   de apoio e primeiro grupo de acesso.
3. Botões iniciais em modo âncora para `#campanhas-oferta`; “Conheça o Vendeo”
   para `/`.
4. Caso 1 — foto da ração → campanha 1:1, em seção própria, rótulos “Foto
   enviada” e “Campanha criada com o Vendeo”.
5. Caso 2 — foto da cama → campanha 9:16, em seção própria, com largura
   controlada no desktop e sem recorte.
6. Frase-alinhada única: “Produtos diferentes. Formatos diferentes. A mesma
   identidade da sua loja.”
7. Um único kit de publicação, o da cama, em HTML, sem botões “Copiar”.
8. Aviso demonstrativo aprovado, uma única vez, após o kit.
9. Bloco de rotina com quatro itens escaneáveis: celular, poucas informações,
   arte/texto preparados pelo Vendeo, revisão/download/publicação pelo lojista.
10. Encerramento com “Sua próxima campanha pode ser mais simples com o Vendeo.”,
    texto de apoio e um único `OfferCard` compacto consumindo
    `public-offer-copy.ts`.
11. Metadata própria, canonical absoluto, OG/Twitter, indexação fail-closed,
    sitemap e link de rodapé na home.
12. Sem dados estruturados de loja, produto, oferta, avaliação ou aplicação.

Fora do escopo funcional: manual de preenchimento, página específica de pet shop,
explicação de campos obrigatórios, badges, configurações técnicas, onboarding,
agenda, calendário, publicação automática, integração com redes sociais, anúncios
pagos, carrossel, stories, vídeo, modal, galeria, depoimento, prova social, nova
fase, backend, autenticação, créditos, flags, migration e dependências.

## 4. Decisões para revisão

O detalhamento completo está em
`openspec/changes/pagina-publica-praticidade-e-identidade/design.md`.

### D1 — Componentes locais, sem refatoração compartilhada

**Recomendado:** criar `src/components/landing/campanhas/**` com cabeçalho, grupo
de acesso, contrato de imagens, caso de demonstração e kit. O grupo de acesso
reutiliza `AcquisitionCta` e `PUBLIC_ACCESS_COPY` e replica a composição local já
usada em `/padarias` e `/floriculturas`.

**Por quê:** extrair um `AccessCtaGroup` compartilhado exigiria tocar em duas
páginas aprovadas, com risco de regressão visual e de testes. A duplicação é
limitada à composição; textos e comportamento continuam nas fontes centrais.

**Alternativa:** extrair o grupo para `src/components/landing/access-cta-group.tsx`
e atualizar as duas páginas. Fica registrado como limpeza futura, não como parte
desta entrega.

### D2 — URL `/campanhas-para-sua-loja`

**Recomendado:** usar `/campanhas-para-sua-loja`, que descreve a intenção sem
nomear segmento e não colide com o prefixo privado `/campanhas`.

**Alternativas:** `/praticidade` (abstrata), `/demonstracao` (foca o formato) e
`/como-funciona` (sugere manual). Ver `261107-pdp-COPY.md` §1.

### D3 — Dois casos em seções próprias, sem grade única

**Recomendado:** cada caso é uma seção com seu próprio par foto/campanha. O caso
1 usa caixa quadrada; o caso 2 usa caixa vertical com largura controlada no
desktop e `object-contain`. No mobile, um caso por vez, empilhado.

**Por quê:** atende ao requisito de não comprimir as quatro imagens numa grade e
preserva a leitura da campanha 9:16 inteira.

### D4 — Duas variantes WebP por imagem, com proporção preservada

**Recomendado:** 480w e 1024w por imagem, calculadas pela exibição e pela
densidade de tela, sem crop e sem upscale. O 9:16 **não** usa o pipeline
quadrado; as dimensões alvo estão em `261107-pdp-COPY.md` §13.

**Por quê:** reduz transferência em 1x e mantém nitidez em 2x/3x, com limite no
original. Os `sizes` provisórios serão reconciliados por medição real.

### D5 — Um único kit, o da cama, em HTML

**Recomendado:** exibir somente o kit da cama, após o caso 2, com título, legenda,
hashtags e chamada exatos, em `<dl>`, sem botões “Copiar” e sem captura da
interface.

**Por quê:** o material aprovado define um único kit; repetir o da ração criaria
ruído e um segundo bloco operacional não solicitado.

### D6 — Um único card de oferta, da fonte central

**Recomendado:** `OfferCard` compacto no encerramento, com ID
`campanhas-oferta`, todos os textos de `public-offer-copy.ts` e os dois estados
da flag. A abertura não repete resumo, complemento ou expansível.

### D7 — Quarta superfície indexável explícita

**Recomendado:** incluir `/campanhas-para-sua-loja` em
`INDEXABLE_CANONICAL_PATHS`, em `getSurfacePolicy` e no sitemap, somente sob
produção confirmada + origem canônica validada. Fora disso, `noindex` explícito,
canonical omitido e sitemap vazio.

**Mudança compartilhada:** `src/lib/seo/indexation-policy.ts` e
`src/app/sitemap.ts`. Exige aprovação antes da execução e testes de regressão das
três superfícies existentes.

### D8 — Um único link novo na home

**Recomendado:** incluir “Campanhas sem complicação” no rodapé da home, ao lado de
“Floriculturas” e “Padarias”, apontando para a nova rota, com as mesmas classes,
altura de toque e foco.

**Mudança compartilhada:** `src/app/page.tsx`. Nenhum outro texto, bloco, imagem,
CTA, ordem ou metadata da home muda.

### D9 — Sem dados estruturados nesta entrega

**Recomendado:** não incluir JSON-LD. A loja é fictícia; a página não oferece os
produtos para compra; não há avaliações ou dados autoritativos de aplicação.
Registrar a avaliação e deixar uma camada global `Organization`/`WebSite` para
uma decisão futura, fora deste escopo.

### Restrições não numeradas

- **Comunicação de tempo:** “em poucos minutos” é permitido; a média de ~30
  segundos não é publicada sem conferência de evidência. Sem contador, prazo
  garantido ou contador regressivo.
- **Publicação:** a página mostra revisão, download e publicação pelo lojista;
  não sugere publicação automática.
- **Identidade:** dois produtos e formatos com a mesma marca demonstrativa; não
  afirmar reprodução visual exata.
- **Aviso único:** o texto aprovado aparece uma única vez, após o kit. Não criar
  bloco público de advertência adicional.
- **Preço demonstrativo:** a arte 1:1 contém R$ 114,90; não reproduzir o valor em
  HTML, metadata ou JSON-LD.
- **Carregamento:** caso 1 pode ser `eager` se estiver na primeira área de
  leitura; caso 2 é `lazy`; nenhuma imagem recebe `fetchpriority="high"` antes da
  medição de LCP.

## 5. Arquivos previstos

### Criar

| Arquivo | Papel |
|---|---|
| `src/app/(marketing)/campanhas-para-sua-loja/page.tsx` | composição, metadata e copy |
| `src/components/landing/campanhas/campanhas-header.tsx` | cabeçalho local |
| `src/components/landing/campanhas/access-cta-group.tsx` | grupo de acesso local, modos âncora/real |
| `src/components/landing/campanhas/image-sources.ts` | contratos responsivos das quatro imagens |
| `src/components/landing/campanhas/demonstration-case.tsx` | caso foto → campanha, variantes `square` e `vertical` |
| `src/components/landing/campanhas/publication-kit.tsx` | kit da cama em HTML |
| `public/demonstracao/foto-racao-confiance-{480w,1024w}.webp` | duas variantes |
| `public/demonstracao/campanha-racao-confiance-bicho-fofo-{480w,1024w}.webp` | duas variantes |
| `public/demonstracao/foto-cama-pet-comfort-{480w,1024w}.webp` | duas variantes |
| `public/demonstracao/campanha-cama-pet-comfort-bicho-fofo-{480w,1024w}.webp` | duas variantes |
| `src/__tests__/app/campanhas-para-sua-loja-page.test.tsx` | copy, metadata, CTAs, oferta, imagens, flags |
| `src/components/landing/campanhas/__tests__/image-sources.test.ts` | contrato offline dos assets |
| `src/components/landing/campanhas/__tests__/access-cta-group.test.tsx` | modos âncora/real e estados da flag |

### Alterar

| Arquivo | Mudança |
|---|---|
| `src/lib/seo/indexation-policy.ts` | `CAMPANHAS_PARA_SUA_LOJA_CANONICAL_PATH`, nova superfície e lista de paths |
| `src/app/sitemap.ts` | quarta URL |
| `src/app/page.tsx` | somente o link “Campanhas sem complicação” no rodapé |
| `src/lib/seo/__tests__/indexation-policy.test.ts` | quatro superfícies |
| `src/__tests__/app/route-indexation-policy.test.ts` | nova rota indexável; subcaminho fail-closed |
| `src/__tests__/app/sitemap.test.ts` | quatro entradas e exclusões preservadas |
| `src/__tests__/app/home-footer-links.test.tsx` | novo link ao lado dos existentes |

### Não alterar

- `/floriculturas` e `/padarias` (páginas, componentes, assets, testes, metadata).
- `src/components/landing/offer-card.tsx`, `public-offer-copy.ts`,
  `acquisition-cta.tsx`, `campaign-image.tsx`, `landing-image-srcset.ts`.
- `src/lib/seo/origin.ts`, `environment.ts`, `robots.ts`, `robots-headers.ts`.
- `middleware.ts`, `next.config.ts`, autenticação, onboarding, créditos,
  elegibilidade, APIs, banco, migrations, flags e configuração externa.
- Home, exceto o link de rodapé.

## 6. Plano de implementação (somente após aprovação)

1. Confirmar D1–D9, a URL, os títulos, a copy de `261107-pdp-COPY.md` e a
   composição desktop/mobile.
2. Copiar os quatro originais para `evidence/source/`, registrar dimensões,
   bytes e SHA-256; manter `Downloads` intacto.
3. Gerar as oito variantes WebP com `sharp`, preservando proporção, sem crop e
   sem upscale; registrar dimensões e pesos.
4. Criar `image-sources.ts`, `demonstration-case.tsx`, `publication-kit.tsx`,
   `access-cta-group.tsx` e `campanhas-header.tsx`.
5. Criar a página `/campanhas-para-sua-loja` com a ordem e a copy aprovadas;
   usar o único `OfferCard` compacto no encerramento.
6. Atualizar a política de indexação, o sitemap e o rodapé da home.
7. Criar e atualizar os testes da seção 8.
8. Rodar gates e capturas; registrar evidências em `evidence/`.
9. **Parar para aceite visual.** Sem commit automático.

## 7. Testes de conteúdo, imagens, oferta, âncora, flags e SEO

### 7.1 Conteúdo

- H1, abertura, linha de apoio, títulos, rótulos, explicação, frase-alinhada,
  kit, rotina, encerramento e apoio exatamente como em `261107-pdp-COPY.md`.
- Um único `h1`; hierarquia `h2`/`h3` coerente.
- Kit com título, legenda, cinco hashtags e chamada; cada campo uma vez.
- Nenhum botão “Copiar”, captura de tela ou controle operacional.
- Frase-alinhada uma única vez, no caso 2.
- Aviso demonstrativo uma única vez, após o kit.
- Nenhum texto sobre agendamento, calendário, publicação automática, anúncios,
  tráfego, alcance, conversão, posição ou aumento de vendas.
- Nenhum preço, avaliação, endereço, telefone ou dado de loja real em HTML ou
  metadata; `R$` ausente do texto HTML.
- Nenhum `PetStore`, `LocalBusiness`, `Product`, `Offer`, `Review` ou
  `AggregateRating` em JSON-LD.
- Nenhum manual de preenchimento, lista de campos obrigatórios, explicação de
  badges, onboarding ou configuração técnica.

### 7.2 Assets e desempenho

- Oito WebP: 480w e 1024w para cada uma das quatro imagens.
- Proporções preservadas: 480×440/1024×939, 480×480/1024×1024,
  480×720/1024×1536, 480×853/1024×1820.
- Peso de cada variante ≤ original correspondente.
- `src` é 1024w; 480w é o primeiro candidato do `srcset`.
- `width`/`height` explícitos; zero layout shift; `object-contain` sem recorte.
- Caso 1 `eager` (se na primeira área de leitura) e caso 2 `lazy`, ambos
  `decoding="async"`; nenhum `fetchpriority="high"` sem medição.
- Registrar largura real, `currentSrc`, overflow e LCP em 1440×900, 834×1112 e
  390×844, nas duas flags.
- Nenhuma fonte externa, nova dependência, carrossel ou modal.

### 7.3 CTAs, oferta e flags

- Dois grupos de acesso: abertura em modo âncora, encerramento em modo real.
- Flag fechada: abertura com `#campanhas-oferta`; card com `/#acesso`; “Conheça o
  Vendeo” em `/`.
- Flag aberta: abertura com Google/e-mail locais; card com Google/OAuth e
  `/signup`; “Conheça o Vendeo” em `/`.
- Um único card compacto, `id="campanhas-oferta"`, `tabindex="-1"`,
  `scroll-mt-24`.
- Resumo, complemento, expansível, CTA/apoio fechado e nota vêm de
  `public-offer-copy.ts`, sem duplicação.
- Nenhum ID duplicado e nenhuma chamada a `/api/`.
- Acessibilidade estrutural: `header`/`main`/`footer`, um único `h1`, todos os
  `alt` preenchidos, seta `aria-hidden`, kit em `dl`, oferta em
  `details`/`summary`, foco visível e toque mínimo de 44 px.

### 7.4 SEO e preservação

- Matriz de metadata: produção válida, preview, local, produção com `www` e
  produção com `http`.
- Canonical absoluto somente em produção válida; caso contrário omitido.
- `/campanhas-para-sua-loja` no sitemap somente em produção válida; exatamente
  quatro URLs.
- `getSurfacePolicy("/campanhas-para-sua-loja")` indexável; subcaminho
  fail-closed.
- `/campanhas` e `/campanhas/**` continuam privados e fora do sitemap.
- Rodapé da home com o novo link ao lado de “Floriculturas” e “Padarias”;
  restante preservado.
- `/floriculturas`, `/padarias`, rotas privadas, legais e transitórias permanecem
  `noindex` e fora do sitemap.
- `middleware.ts` e `next.config.ts` inalterados.

### 7.5 Matriz de testes prevista

| Arquivo | Cobertura |
|---|---|
| `src/__tests__/app/campanhas-para-sua-loja-page.test.tsx` | metadata/canonical, copy, kit, aviso único, frase-alinhada, imagens, CTAs, card, flags, ausência de promessas e de `R$` |
| `src/components/landing/campanhas/__tests__/image-sources.test.ts` | existência, formato, dimensões, proporção, peso e ordem dos candidatos |
| `src/components/landing/campanhas/__tests__/access-cta-group.test.tsx` | modo âncora na abertura, modo real no card, estados da flag e rótulos centrais |
| `src/lib/seo/__tests__/indexation-policy.test.ts` | quatro superfícies, nova rota, normalização e fail-closed |
| `src/__tests__/app/route-indexation-policy.test.ts` | nova rota indexável; subcaminho noindex; `/campanhas` privado |
| `src/__tests__/app/sitemap.test.ts` | quatro URLs em produção válida; vazio nos demais cenários; exclusões |
| `src/__tests__/app/home-footer-links.test.tsx` | novo link ao lado dos existentes e preservação do restante |

## 8. Gates

| Gate | Comando | Limitação declarada |
|---|---|---|
| Testes focados | `npx vitest run src/__tests__/app/campanhas-para-sua-loja-page.test.tsx src/components/landing/campanhas/__tests__ src/__tests__/app/home-footer-links.test.tsx src/__tests__/app/sitemap.test.ts src/__tests__/app/route-indexation-policy.test.ts src/lib/seo/__tests__/indexation-policy.test.ts` | jsdom não mede layout real |
| Suíte local | `npm test` | pode exigir ambiente já preparado; registrar duração e falhas preexistentes |
| Typecheck | `npm run typecheck` | — |
| Lint | `npm run lint` | ESLint atual não cobre TypeScript (limitação já registrada) |
| Build | `npm run build` | inclui `check:cnae`; sem banco/rede |
| HTML compilado | `npm run build` + `next start` local e inspeção da rota, `/sitemap.xml`, `/robots.txt` e headers | local permanece `noindex` e sem canonical de produção por design |
| OpenSpec | `npx openspec validate pagina-publica-praticidade-e-identidade --strict` | validar também o delta de `seo-discovery-foundation` |
| Diff | `git diff --check` | — |
| Visual | build local + CDP em 1440×900, 834×1112 e 390×844, nos dois estados da flag | rolar até o caso 2 para carregar o lazy; medir overflow, `currentSrc` e LCP; não clicar no Google |

Nota: `npx openspec validate --all --strict` já falha em dezenas de specs legadas
preexistentes. O gate desta quick valida apenas a change nova e suas specs; o
número global não deve ser atribuído a esta mudança.

## 9. Aceite visual

- Capturas em desktop (1440×900), tablet (834×1112) e mobile (390×844), com as
  quatro imagens carregadas e nos dois estados da flag.
- Texto do kit legível; marca, produto e detalhes das artes preservados; nenhum
  recorte.
- Desktop: caso 1 com foto à esquerda, seta e campanha 1:1 à direita; caso 2 em
  seção própria, com o 9:16 inteiro e largura controlada.
- Tablet: colunas sem colisão, texto e imagem equilibrados, sem overflow.
- Mobile: um caso por vez; empilhamento limpo; 9:16 inteiro, sem overflow
  horizontal.
- Estado aberto: botão Google real visível no card final, sem clique, sem OAuth e
  sem autenticação; abertura ainda em modo âncora.
- Aviso único, frase-alinhada única, card único, CTAs e âncoras intactos nos dois
  estados da flag.
- Aprovação explícita antes de commit ou fechamento.

## 10. Checklist de revisão desta rodada

Antes de qualquer implementação, confirmar:

1. URL `/campanhas-para-sua-loja` ou uma das alternativas.
2. Title, description, H1 e H2s de `261107-pdp-COPY.md`.
3. Fecho “Sua próxima campanha pode ser mais simples com o Vendeo.” e texto de
   apoio.
4. Rótulo “Campanhas sem complicação” no rodapé da home.
5. D1 (componentes locais, sem refatoração compartilhada) e D7/D8 (mudanças
   compartilhadas de SEO/home).
6. Kit exato da cama, sem botões “Copiar”.
7. Aviso único e ausência de bloco público adicional de advertência.
8. Limite editorial: sem média de 30 segundos, sem promessa de resultado, sem
   publicação automática.

## 11. Fora de escopo

- Implementar qualquer parte da página nesta rodada.
- Alterar `/floriculturas`, `/padarias`, home (exceto link de rodapé), oferta,
  acesso, CTAs, card, âncora, flags, créditos, elegibilidade, onboarding,
  autenticação, APIs, banco, migrations ou configuração externa.
- Gerar imagens, chamar provider ou consumir créditos.
- Criar agenda, calendário, publicação automática, anúncios, encarte, cardápio,
  carrossel, modal, galeria, depoimento ou prova social.
- Criar nova fase, dependência, framework genérico de páginas ou dados
  estruturados de loja/produto.
- Commit, sync, archive, merge, push, deploy ou tag.

## 12. Checklist pós-deploy (separado)

O checklist de publicação vive em `261107-pdp-POST-DEPLOY.md`. Ele fica fora da
rodada de implementação, não é marcado como concluído antes da publicação e não
bloqueia sync/archive da change.

## 13. Resultado da execução (2026-11-07)

As decisões de navegação, copy e fecho foram reconciliadas antes da implementação:
URL `/campanhas-para-sua-loja`, link “Campanhas sem complicação”, title
“Crie campanhas para sua loja sem complicação | Vendeo”, abertura revisada, dois
parágrafos de caso sem menção a celular, item de rotina “Arte e texto preparados
pelo Vendeo.” e fecho “Sua próxima campanha pode ser mais simples com o Vendeo.”.
“Começar do zero”, “tela em branco” e “Por que pagar por isso?” não aparecem como
argumento público.

Implementação concluída em `src/app/(marketing)/campanhas-para-sua-loja/page.tsx`,
componentes locais em `src/components/landing/campanhas/**`, oito WebP em
`public/demonstracao/`, política de indexação, sitemap e link de rodapé da home.
Nenhum arquivo de `/floriculturas` ou `/padarias` foi alterado.

Gates: **140/140 testes focados**, **8.171 testes na suíte local** (10 skipped),
typecheck **0**, lint **0** (sem cobertura TS), build **0** (98/98 páginas),
OpenSpec `--strict` **válido**. Medições CDP: 0 px de overflow em 1440, 834 e 390;
LCP local entre 24 ms e 576 ms, com H1/parágrafo/campanha como vencedores conforme
viewport e flag; CLS ≤ 0,0044; 480w em DPR 1 e 1024w em DPR 3; 9:16 inteiro em
todas as larguras. Evidências em `evidence/`.

**Aceite visual aprovado pelo responsável em 2026-11-07**, com revisão do Codex
concluída sem bloqueantes. Capturas de referência: `layout-desktop-1440-full.png`,
`layout-tablet-834-full.png` e `layout-mobile-390-full.png`.

**Fechamento local (2026-11-07).** OpenSpec verificado sem bloqueantes,
sincronizado e arquivado em
`openspec/changes/archive/2026-11-07-pagina-publica-praticidade-e-identidade/`.
Specs principais criadas/atualizadas e validadas com `--strict`:
`campanhas-para-sua-loja-demonstration-page` e `seo-discovery-foundation`.
Publicação e validação de produção **não executadas**. Sem merge, push, deploy ou
tag nesta rodada.
