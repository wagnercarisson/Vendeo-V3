## 0. Revisão e aprovação

- [x] 0.1 Confirmar D1–D7 do `design.md`, com atenção para componentes locais, ausência de bloco de passos, aviso único, variantes 480w/1024w, reuso do café, ausência de dados estruturados e novo destino no rodapé.
- [x] 0.2 Aprovar a copy completa e a composição desktop/tablet/mobile de `261109-mrc-COPY.md`, com a explicação consolidada em um único parágrafo após o par.
- [x] 0.3 Confirmar a description aprovada da metadata, a ordem do link “Mercados e mercearias” e a ordem da superfície em SEO.
- [x] 0.4 Confirmar que a entrega permanece como quick, sem nova fase; commit, sync e archive ocorrem apenas no fechamento autorizado.
- [x] 0.5 Confirmar a permanência na branch `perf/pagina-oferta-mercearia` e o uso de `public/mercados/`.

## 1. Assets

- [x] 1.1 Copiar os três arquivos-fonte para `evidence/source/` e registrar dimensões, bytes e SHA-256, mantendo os originais em `Downloads` intactos.
- [x] 1.2 Gerar as variantes WebP 480w e 1024w da foto do açougue e da campanha da carne com `sharp`, sem crop e sem upscale.
- [x] 1.3 Nomear os assets com descrição no contexto da demonstração e registrar dimensões e pesos finais.
- [x] 1.4 Conferir que a foto permanece 3:2, a campanha permanece 1:1 e nenhuma variante excede o peso do original correspondente.
- [x] 1.5 Confirmar que os derivados existentes do café correspondem ao `hero.png` aprovado e reutilizar `hero-oferta-cafe-480w.webp` + `hero-oferta-cafe.webp`, sem novo derivado.

## 2. SEO e rodapé

- [x] 2.1 Acrescentar `OFERTAS_PARA_MERCADOS_CANONICAL_PATH` e a decisão explícita de `/ofertas-para-mercados` em `src/lib/seo/indexation-policy.ts`.
- [x] 2.2 Incluir `/ofertas-para-mercados` em `INDEXABLE_CANONICAL_PATHS` e em `getSurfacePolicy`.
- [x] 2.3 Incluir `${origin}/ofertas-para-mercados` em `src/app/sitemap.ts`.
- [x] 2.4 Acrescentar `Mercados e mercearias` → `/ofertas-para-mercados` somente em `src/components/landing/public-footer-nav.ts`.
- [x] 2.5 Manter `robots.ts`, `robots-headers.ts`, `next.config.ts` e `middleware.ts` inalterados.
- [x] 2.6 Não adicionar JSON-LD de mercado, açougue, produto, oferta, avaliação ou negócio fictício.
- [x] 2.7 Não importar a lista de navegação em sitemap, política de indexação, metadata ou robots.

## 3. Componentes e página

- [x] 3.1 Criar `src/components/landing/mercados/mercados-header.tsx` seguindo o padrão público local.
- [x] 3.2 Criar `src/components/landing/mercados/access-cta-group.tsx` reutilizando `AcquisitionCta` e `PUBLIC_ACCESS_COPY`, com abertura em modo âncora e encerramento em modo real.
- [x] 3.3 Criar `src/components/landing/mercados/image-sources.ts` com os contratos responsivos das três imagens.
- [x] 3.4 Criar `src/components/landing/mercados/demonstration-pair.tsx` com foto horizontal, campanha quadrada, rótulos em linha própria, proporções preservadas e seta centralizada apenas entre as áreas visuais.
- [x] 3.5 Criar `src/components/landing/mercados/publication-kit.tsx` com o kit em `<dl>`, sem botões “Copiar”.
- [x] 3.6 Criar `src/components/landing/mercados/coffee-example.tsx` com texto à esquerda e imagem à direita no desktop, empilhados no mobile e `loading="lazy"`.
- [x] 3.7 Criar `src/app/(marketing)/ofertas-para-mercados/page.tsx` com a composição, a copy e o único card de oferta aprovados.
- [x] 3.8 Não alterar `/floriculturas`, `/padarias`, `/campanhas-para-sua-loja`, a home, `public-offer-copy.ts`, `offer-card.tsx`, `acquisition-cta.tsx` ou `getLaunchConfig`.

## 4. Testes

- [x] 4.1 Criar `src/__tests__/app/ofertas-para-mercados-page.test.ts` com a matriz de metadata/canonical por ambiente e a copy aprovada.
- [x] 4.2 Cobrir o kit exato, a ausência de “Copiar”, o aviso único e a ausência de preço em metadata.
- [x] 4.3 Cobrir um único card, âncora `#ofertas-mercados-oferta`, textos centrais da oferta, `/#acesso`, `/signup` e “Conheça o Vendeo” nos dois estados da flag.
- [x] 4.4 Cobrir imagens com dois candidatos, `sizes`, dimensões explícitas, `eager` na demonstração e `lazy` no café.
- [x] 4.5 Cobrir ausência de promessas de agendamento, publicação automática, anúncios, tráfego, conversão ou vendas.
- [x] 4.6 Cobrir ausência de menções a “loja pequena”, “começar do zero”, “tela em branco” e captura por celular.
- [x] 4.7 Criar `src/components/landing/mercados/__tests__/image-sources.test.ts` com existência, formato, dimensões, proporção, peso e ordem do `srcset`.
- [x] 4.8 Atualizar `src/lib/seo/__tests__/indexation-policy.test.ts` para cinco superfícies e `/ofertas-para-mercados`.
- [x] 4.9 Atualizar `src/__tests__/app/route-indexation-policy.test.ts` para a nova rota indexável e subcaminhos fail-closed.
- [x] 4.10 Atualizar `src/__tests__/app/sitemap.test.ts` para cinco entradas e manter as exclusões.
- [x] 4.11 Atualizar `src/components/landing/__tests__/public-footer.test.tsx` e `src/__tests__/app/home-footer-links.test.tsx` para o quarto destino.
- [x] 4.12 Cobrir acessibilidade estrutural: landmarks, um único `h1`, `alt` preenchido, seta `aria-hidden`, kit em `dl`, oferta em `details`/`summary`, foco visível, toque mínimo de 44 px e ausência de IDs duplicados.

## 5. Gates e aceite visual

- [x] 5.1 Executar testes focados, suíte local, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` e `npx openspec validate ofertas-para-mercados --strict`.
- [x] 5.2 Registrar as limitações de lint e de layout em jsdom.
- [x] 5.3 Capturar `/ofertas-para-mercados` em 1440×900 (desktop), 834×1112 (tablet) e 390×844 (mobile), com as imagens carregadas, nos dois estados da flag. Medir largura real, `currentSrc`, overflow, proporções, LCP e legibilidade.
- [x] 5.4 No estado aberto, conferir visualmente o botão Google real no card final sem clicar nele nem iniciar autenticação; a abertura deve continuar em modo âncora local.
- [x] 5.5 Reconciliar `sizes` e prioridade com a medição; não usar `fetchpriority="high"` sem evidência.
- [x] 5.6 Conferir visualmente a seta centralizada entre as áreas visuais, sem influência dos rótulos; foto 3:2 e campanha 1:1 sem recorte; kit legível; card único e CTAs intactos.
- [x] 5.7 Registrar evidências em `.planning/quick/261109-mrc-ofertas-para-mercados/evidence/`.
- [x] 5.8 Solicitar aceite visual explícito antes de commit, sync ou archive. Aceite aprovado em 2026-11-09, incluindo a rodada de ajuste da composição.

## 6. Publicação

O checklist pós-deploy vive em
`.planning/quick/261109-mrc-ofertas-para-mercados/261109-mrc-POST-DEPLOY.md`.
Ele está fora desta rodada, não é marcado como concluído antes da publicação e não
bloqueia sync/archive da change. Publicação, merge, push, deploy e tag dependem de
autorização própria.
