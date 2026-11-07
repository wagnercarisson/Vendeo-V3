## 0. Revisão e aprovação

- [x] 0.1 Confirmar D1–D9 do `design.md`, com atenção para componentes locais, URL, dois casos em seções próprias, variantes WebP, kit único, card único, indexação e link de rodapé.
- [x] 0.2 Aprovar a copy completa e a composição desktop/mobile de `.planning/quick/261107-pdp-pagina-publica-praticidade-e-identidade/261107-pdp-COPY.md`.
- [x] 0.3 Confirmar que a entrega permanece como quick, sem nova fase; commit, sync e archive ocorrem apenas no fechamento autorizado.
- [x] 0.4 Confirmar que o diagnóstico e as fontes de intenção de busca em `261107-pdp-DIAGNOSTIC.md` estão adequados.
- [x] 0.5 Confirmar que o formato 9:16 pode ser anunciado como disponível, sem contador, prazo garantido ou publicação da média de 30 segundos.

## 1. Assets

- [x] 1.1 Copiar os quatro arquivos-fonte para `evidence/source/` e registrar dimensões, bytes e SHA-256, mantendo os originais em `Downloads` intactos.
- [x] 1.2 Gerar as variantes WebP 480w e 1024w da foto da ração, da campanha 1:1, da foto da cama e da campanha 9:16 com `sharp`, sem crop e sem upscale.
- [x] 1.3 Preservar as proporções: 480×440/1024×939, 480×480/1024×1024, 480×720/1024×1536 e 480×853/1024×1820.
- [x] 1.4 Nomear os assets no contexto da demonstração e registrar dimensões e pesos finais.
- [x] 1.5 Conferir que nenhuma variante excede o peso do original correspondente e que o 9:16 não passou pelo pipeline quadrado.

## 2. SEO e política de indexação

- [x] 2.1 Acrescentar `CAMPANHAS_PARA_SUA_LOJA_CANONICAL_PATH` e a decisão explícita em `src/lib/seo/indexation-policy.ts`.
- [x] 2.2 Incluir a rota em `INDEXABLE_CANONICAL_PATHS` e em `getSurfacePolicy`.
- [x] 2.3 Incluir `${origin}/campanhas-para-sua-loja` em `src/app/sitemap.ts`.
- [x] 2.4 Manter `/campanhas` e `/campanhas/**` privados e fora do sitemap.
- [x] 2.5 Manter `robots.ts`, `robots-headers.ts`, `next.config.ts` e `middleware.ts` inalterados.
- [x] 2.6 Não adicionar JSON-LD `PetStore`, `LocalBusiness`, `Product`, `Offer`, `Review` ou `AggregateRating`.

## 3. Componentes e página

- [x] 3.1 Criar `src/components/landing/campanhas/campanhas-header.tsx` seguindo o padrão local aprovado.
- [x] 3.2 Criar `src/components/landing/campanhas/access-cta-group.tsx` reutilizando `AcquisitionCta` e `PUBLIC_ACCESS_COPY`, com abertura em modo âncora e encerramento em modo real.
- [x] 3.3 Criar `src/components/landing/campanhas/image-sources.ts` com os contratos responsivos das quatro imagens.
- [x] 3.4 Criar `src/components/landing/campanhas/demonstration-case.tsx` com as variantes `square` (1:1) e `vertical` (9:16), rótulos, marcador de formato, seta `aria-hidden` e sem recorte.
- [x] 3.5 Criar `src/components/landing/campanhas/publication-kit.tsx` com o kit da cama em `<dl>`, sem botões “Copiar”.
- [x] 3.6 Criar `src/app/(marketing)/campanhas-para-sua-loja/page.tsx` com a composição, a copy e o único card de oferta aprovados.
- [x] 3.7 Exibir o aviso demonstrativo uma única vez, após o kit, e a frase-alinhada uma única vez, no caso 2.
- [x] 3.8 Adicionar o link “Campanhas sem complicação” ao rodapé de `src/app/page.tsx`, ao lado de “Floriculturas” e “Padarias”, sem qualquer outra alteração na home.
- [x] 3.9 Não alterar `/floriculturas`, `/padarias`, `public-offer-copy.ts`, `offer-card.tsx`, `acquisition-cta.tsx`, `campaign-image.tsx` ou `getLaunchConfig`.

## 4. Testes

- [x] 4.1 Criar `src/__tests__/app/campanhas-para-sua-loja-page.test.tsx` com a matriz de metadata/canonical por ambiente e a copy aprovada.
- [x] 4.2 Cobrir o kit exato, a ausência de “Copiar”, o aviso único, a frase-alinhada única e a ausência de `R$` em HTML/metadata.
- [x] 4.3 Cobrir um único card, âncora `#campanhas-oferta`, textos centrais da oferta, `/#acesso`, `/signup` e “Conheça o Vendeo” nos dois estados da flag.
- [x] 4.4 Cobrir imagens com dois candidatos, `sizes`, dimensões explícitas, `eager` no caso 1 quando aplicável e `lazy` no caso 2.
- [x] 4.5 Cobrir ausência de promessas de agendamento, publicação automática, anúncios, tráfego, conversão ou vendas.
- [x] 4.6 Criar `src/components/landing/campanhas/__tests__/image-sources.test.ts` com existência, formato, dimensões, proporção, peso e ordem do `srcset`.
- [x] 4.7 Criar `src/components/landing/campanhas/__tests__/access-cta-group.test.tsx` para os modos âncora/real e os dois estados da flag.
- [x] 4.8 Atualizar `src/lib/seo/__tests__/indexation-policy.test.ts` para quatro superfícies e a nova rota.
- [x] 4.9 Atualizar `src/__tests__/app/route-indexation-policy.test.ts` para a nova rota indexável, subcaminho fail-closed e `/campanhas` privado.
- [x] 4.10 Atualizar `src/__tests__/app/sitemap.test.ts` para quatro entradas e manter as exclusões.
- [x] 4.11 Atualizar `src/__tests__/app/home-footer-links.test.tsx` com o novo link e a preservação dos demais.
- [x] 4.12 Cobrir acessibilidade estrutural: landmarks, um único `h1`, `alt` preenchido, seta `aria-hidden`, kit em `dl`, oferta em `details`/`summary`, foco visível, toque mínimo de 44 px e ausência de IDs duplicados.

## 5. Gates e aceite visual

- [x] 5.1 Executar testes focados, suíte local, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` e `npx openspec validate pagina-publica-praticidade-e-identidade --strict`.
- [x] 5.2 Registrar as limitações de lint e de layout em jsdom.
- [x] 5.3 Capturar a rota em 1440×900 (desktop), 834×1112 (tablet) e 390×844 (mobile), com as quatro imagens carregadas, nos dois estados da flag. Medir largura real, `currentSrc`, overflow, LCP e legibilidade.
- [x] 5.4 No estado aberto, conferir visualmente o botão Google real no card final sem clicar nele nem iniciar autenticação; a abertura deve continuar em modo âncora local.
- [x] 5.5 Reconciliar `sizes` e prioridade com a medição; não usar `fetchpriority="high"` sem evidência.
- [x] 5.6 Conferir visualmente o 9:16 inteiro no desktop e no mobile; kit legível; card único e CTAs intactos.
- [x] 5.7 Registrar evidências em `.planning/quick/261107-pdp-pagina-publica-praticidade-e-identidade/evidence/`.
- [x] 5.8 Solicitar aceite visual explícito; commit, sync e archive somente no fechamento autorizado. Aceite aprovado pelo responsável em 2026-11-07, com revisão do Codex concluída sem bloqueantes.

## 6. Publicação

O checklist pós-deploy vive em
`.planning/quick/261107-pdp-pagina-publica-praticidade-e-identidade/261107-pdp-POST-DEPLOY.md`.
Ele está fora desta rodada, não é marcado como concluído antes da publicação e não
bloqueia sync/archive da change. Publicação, merge, push, deploy e tag dependem de
autorização própria.
