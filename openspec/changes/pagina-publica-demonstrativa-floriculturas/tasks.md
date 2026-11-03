## 1. Preparação de assets

- [ ] 1.1 Gerar `public/floriculturas/foto-orquidea-balcao-1024w.webp` (1024×936) a partir do PNG 1312×1199 aprovado, com Sharp `quality: 82`, `effort: 6`, `smartSubsample: true`, sem upscale.
- [ ] 1.2 Gerar `public/floriculturas/foto-orquidea-balcao-480w.webp` (480×439) a partir da mesma origem e com os mesmos parâmetros.
- [ ] 1.3 Gerar `public/floriculturas/campanha-donna-flor-1024w.webp` (1024×1024) a partir do JPEG aprovado, sem recorte e sem upscale.
- [ ] 1.4 Gerar `public/floriculturas/campanha-donna-flor-480w.webp` (480×480) a partir da mesma origem.
- [ ] 1.5 Registrar dimensões e pesos dos quatro arquivos e confirmar que cada variante é menor ou igual ao original correspondente.
- [ ] 1.6 Não alterar os arquivos-fonte em `Downloads` nem o asset `public/landing/identidade-floricultura.webp`.

## 2. Contrato de imagens e composição

- [ ] 2.1 Criar `src/components/landing/floriculturas/image-sources.ts` com caminhos, `srcset` de dois candidatos por imagem e `sizes` `(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))`.
- [ ] 2.2 Criar teste do contrato de imagens: existência, formato WebP, dimensões, peso e strings de `srcset`/`sizes` exatas.
- [ ] 2.3 Criar `demonstration-pair.tsx` com rótulos `Foto enviada ao Vendeo` / `Campanha criada com o Vendeo`, foto proporcional, seta decorativa `aria-hidden`, campanha 1:1 com `object-contain` e aviso demonstrativo único.
- [ ] 2.4 Aplicar `loading="eager"` e `fetchPriority="high"` na campanha; `loading="eager"` sem prioridade alta na foto; nenhum `lazy` na demonstração.
- [ ] 2.5 Criar `floriculturas-header.tsx` reutilizando as classes do header da home (logo + `Entrar`), sem extrair componente compartilhado.

## 3. `AcquisitionCta` com `accessHref`

- [ ] 3.1 Adicionar prop opcional `accessHref?: string` com default `"#acesso"`; nenhuma outra mudança de comportamento.
- [ ] 3.2 Atualizar/criar teste que comprove default preservado e destino `/floriculturas` → `/#acesso` quando a flag está desligada.
- [ ] 3.3 Confirmar que nenhum consumidor existente (hero, transformação, identidade, oferta) muda de saída.

## 4. Página `/floriculturas`

- [ ] 4.1 Criar `src/app/(marketing)/floriculturas/page.tsx` como Server Component, lendo `getLaunchConfig()` uma vez.
- [ ] 4.2 Implementar a copy aprovada na ordem: abertura + CTA → demonstração + aviso → explicação → segundo bloco → funcionamento → encerramento + CTA → rodapé.
- [ ] 4.3 Garantir um único `h1`, `h2` por bloco e `h3` nos passos; setas decorativas com `aria-hidden`.
- [ ] 4.4 Implementar responsividade conforme o design (coluna única no mobile, duas colunas com seta no desktop, sem overflow).
- [ ] 4.5 Não incluir tabela de entrada, legenda gerada, dado de geração ou advertência comercial adicional.

## 5. SEO e indexação

- [ ] 5.1 Adicionar `FLORICULTURAS_CANONICAL_PATH = "/floriculturas"` e branch explícita em `getSurfacePolicy`; manter default `noindex`.
- [ ] 5.2 Implementar metadata própria com title, description, OG/Twitter e `robots` condicionado a `isIndexableEnvironment()`.
- [ ] 5.3 Emitir canonical absoluto somente sob produção confirmada com origem validada; omitir nos demais ambientes.
- [ ] 5.4 Incluir `/floriculturas` em `src/app/sitemap.ts` somente sob a condição combinada, mantendo a home e a lista vazia fora dela.
- [ ] 5.5 Adicionar o link `Exemplo: campanha para floricultura` no rodapé da home, sem outras alterações visuais.
- [ ] 5.6 Confirmar que `robots.ts`, `robots-headers.ts`, `next.config.ts` e `middleware.ts` permanecem inalterados.

## 6. Testes e gates

- [ ] 6.1 Atualizar `src/lib/seo/__tests__/indexation-policy.test.ts` (`/floriculturas` indexável; `/rota-nova` continua noindex).
- [ ] 6.2 Atualizar `src/__tests__/app/sitemap.test.ts` (2 entradas sob produção válida; vazio nas demais combinações; proibições mantidas).
- [ ] 6.3 Criar `src/__tests__/app/floriculturas-page.test.ts` (copy, dois CTAs, aviso único, metadata/canonical por ambiente, ausência de geração, ausência de tabela/legenda).
- [ ] 6.4 Executar suíte focada, `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check`.
- [ ] 6.5 Registrar limitações conhecidas (lint sem cobertura TS; exceção `ssl`/`pg` da F56, se persistir).

## 7. Checkpoint humano visual

- [ ] 7.1 Build local e captura desktop 1440 e mobile 390 em `evidence/`.
- [ ] 7.2 Conferir ordem dos blocos, dois CTAs, aviso único, proporção/corte das imagens, ausência de tabela/legenda, overflow, foco e contraste.
- [ ] 7.3 Obter aprovação explícita do responsável antes de qualquer fechamento.
