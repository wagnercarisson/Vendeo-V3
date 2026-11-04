## 0. Revisão e aprovação

- [x] 0.1 Confirmar D1–D7 do `design.md`, com atenção para componentes locais, ausência de bloco de passos, aviso único, variantes 480w/1024w, ausência de dados estruturados e link de rodapé.
- [x] 0.2 Aprovar a copy completa e a composição desktop/mobile de `261104-pdr-COPY.md`.
- [x] 0.3 Confirmar que a entrega permaneceu como quick, sem nova fase; commit, sync e archive ocorrem apenas no fechamento autorizado.
- [x] 0.4 Confirmar que o diagnóstico de intenção de busca e as fontes registradas em `261104-pdr-DIAGNOSTIC.md` estão adequados.

## 1. Assets

- [x] 1.1 Copiar os três arquivos-fonte para `evidence/source/` e registrar dimensões, bytes e SHA-256, mantendo os originais em `Downloads` intactos.
- [x] 1.2 Gerar as variantes WebP 480w e 1024w da foto do bolo, da campanha do bolo e da campanha do pão com `sharp`, sem crop e sem upscale.
- [x] 1.3 Nomear os assets com descrição no contexto da demonstração e registrar dimensões e pesos finais.
- [x] 1.4 Conferir que nenhuma variante excede o peso do original correspondente e que as três permanecem 1:1.

## 2. SEO e política de indexação

- [x] 2.1 Acrescentar `PADARIAS_CANONICAL_PATH` e a decisão explícita de `/padarias` em `src/lib/seo/indexation-policy.ts`.
- [x] 2.2 Incluir `/padarias` em `INDEXABLE_CANONICAL_PATHS` e em `getSurfacePolicy`.
- [x] 2.3 Incluir `${origin}/padarias` em `src/app/sitemap.ts`.
- [x] 2.4 Manter `robots.ts`, `robots-headers.ts`, `next.config.ts` e `middleware.ts` inalterados.
- [x] 2.5 Não adicionar JSON-LD `Bakery`, `LocalBusiness`, `Product`, `Offer`, `Review` ou `AggregateRating`.

## 3. Componentes e página

- [x] 3.1 Criar `src/components/landing/padarias/padarias-header.tsx` seguindo o padrão local aprovado.
- [x] 3.2 Criar `src/components/landing/padarias/access-cta-group.tsx` reutilizando `AcquisitionCta` e `PUBLIC_ACCESS_COPY`, com abertura em modo âncora e encerramento em modo real.
- [x] 3.3 Criar `src/components/landing/padarias/image-sources.ts` com os contratos responsivos das três imagens.
- [x] 3.4 Criar `src/components/landing/padarias/demonstration-pair.tsx` com foto e campanha do bolo, rótulos, proporção 1:1 e sem recorte.
- [x] 3.5 Criar `src/components/landing/padarias/publication-kit.tsx` com o kit em `<dl>`, sem botões “Copiar”.
- [x] 3.6 Criar `src/components/landing/padarias/bread-example.tsx` com texto à esquerda e imagem à direita no desktop, empilhados no mobile e `loading="lazy"`.
- [x] 3.7 Criar `src/app/(marketing)/padarias/page.tsx` com a composição, a copy e o único card de oferta aprovados.
- [x] 3.8 Adicionar o link “Padarias” ao lado de “Floriculturas” no rodapé de `src/app/page.tsx`, sem qualquer outra alteração na home.
- [x] 3.9 Não alterar `/floriculturas`, `public-offer-copy.ts`, `offer-card.tsx`, `acquisition-cta.tsx`, `campaign-image.tsx` ou `getLaunchConfig`.

## 4. Testes

- [x] 4.1 Criar `src/__tests__/app/padarias-page.test.ts` com a matriz de metadata/canonical por ambiente e a copy aprovada.
- [x] 4.2 Cobrir o kit exato, a ausência de “Copiar”, o aviso único e a ausência de `R$` em HTML/metadata.
- [x] 4.3 Cobrir um único card, âncora `#padarias-oferta`, textos centrais da oferta, `/#acesso`, `/signup` e “Conheça o Vendeo” nos dois estados da flag.
- [x] 4.4 Cobrir imagens com dois candidatos, `sizes`, dimensões explícitas, `eager` na demonstração e `lazy` no exemplo do pão.
- [x] 4.5 Cobrir ausência de promessas de agendamento, publicação automática, anúncios, tráfego ou vendas.
- [x] 4.6 Criar `src/components/landing/padarias/__tests__/image-sources.test.ts` com existência, formato, dimensões, proporção, peso e ordem do `srcset`.
- [x] 4.7 Atualizar `src/lib/seo/__tests__/indexation-policy.test.ts` para três superfícies e `/padarias`.
- [x] 4.8 Atualizar `src/__tests__/app/route-indexation-policy.test.ts` para `/padarias` indexável e subcaminhos fail-closed.
- [x] 4.9 Atualizar `src/__tests__/app/sitemap.test.ts` para três entradas e manter as exclusões.
- [x] 4.10 Criar teste focado do rodapé da home confirmando “Padarias” ao lado de “Floriculturas” e a preservação do restante.
- [x] 4.11 Cobrir acessibilidade estrutural: landmarks, um único `h1`, `alt` preenchido, seta `aria-hidden`, kit em `dl`, oferta em `details`/`summary`, foco visível, toque mínimo de 44 px e ausência de IDs duplicados.

## 5. Gates e aceite visual

- [x] 5.1 Executar testes focados, suíte local, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` e `npx openspec validate pagina-publica-demonstrativa-padarias --strict`.
- [x] 5.2 Registrar as limitações de lint e de layout em jsdom.
- [x] 5.3 Capturar `/padarias` em 1440×900 (desktop), 834×1112 (tablet) e 390×844 (mobile), com as imagens carregadas, nos dois estados da flag. Medir largura real, `currentSrc`, overflow, LCP e legibilidade.
- [x] 5.4 No estado aberto, conferir visualmente o botão Google real no card final sem clicar nele nem iniciar autenticação; a abertura deve continuar em modo âncora local.
- [x] 5.5 Reconciliar `sizes` e prioridade com a medição; não usar `fetchpriority="high"` sem evidência.
- [x] 5.6 Conferir visualmente texto à esquerda e imagem à direita no desktop; empilhamento texto → imagem no mobile; kit legível; card único e CTAs intactos.
- [x] 5.7 Registrar evidências em `.planning/quick/261104-pdr-pagina-publica-para-padarias/evidence/`.
- [x] 5.8 Solicitar aceite visual explícito; aceite aprovado em 2026-11-04; commit, sync e archive no fechamento autorizado.

## 6. Publicação

O checklist pós-deploy vive em
`.planning/quick/261104-pdr-pagina-publica-para-padarias/261104-pdr-POST-DEPLOY.md`.
Ele está fora desta rodada, não é marcado como concluído antes da publicação e não
bloqueia sync/archive da change. Publicação, merge, push, deploy e tag dependem de
autorização própria.
