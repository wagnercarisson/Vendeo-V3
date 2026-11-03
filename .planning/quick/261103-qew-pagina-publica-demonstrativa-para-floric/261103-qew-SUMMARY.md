---
quick_id: 261103-qew
slug: pagina-publica-demonstrativa-para-floric
status: awaiting_human_review
date: 2026-11-03
branch: perf/pagina-campanha-florista
base_commit: 03e13606
implementation_authorized: true
checkpoint_visual: pending
---

# Quick 261103-qew — Página pública demonstrativa para floriculturas

## Entrega

Página pública `/floriculturas` implementada localmente, com a copy aprovada e as duas
extensões aprovadas (card do texto gerado e link “Conheça o Vendeo”).

- Rota: `src/app/(marketing)/floriculturas/page.tsx` (Server Component, estática).
- Componentes locais: `src/components/landing/floriculturas/{demonstration-pair,floriculturas-header}.tsx` e `image-sources.ts`.
- `AcquisitionCta` recebeu `accessHref?: string` (default `#acesso` preservado); a página usa `/#acesso`.
- Home: um único link no rodapé, `Exemplo: campanha para floricultura` → `/floriculturas`.
- SEO: `FLORICULTURAS_CANONICAL_PATH` em `indexation-policy.ts`; sitemap com home + `/floriculturas` somente sob produção confirmada + origem validada; `robots.ts`, `robots-headers.ts`, `next.config.ts` e `middleware.ts` inalterados.
- OpenSpec: `openspec/changes/pagina-publica-demonstrativa-floriculturas/` (nova capability + delta de `seo-discovery-foundation`).

## Imagens (pesos e dimensões finais)

| Arquivo | Dimensão | Peso |
|---|---|---|
| `public/floriculturas/foto-orquidea-balcao-1024w.webp` | 1024×936 | 101.178 B (98,8 KB) |
| `public/floriculturas/foto-orquidea-balcao-480w.webp` | 480×439 | 37.076 B (36,2 KB) |
| `public/floriculturas/campanha-donna-flor-1024w.webp` | 1024×1024 | 135.060 B (131,9 KB) |
| `public/floriculturas/campanha-donna-flor-480w.webp` | 480×480 | 44.956 B (43,9 KB) |

- Duas variantes por imagem, WebP q=82 (Sharp `effort 6`, `smartSubsample`), sem upscale, proporção preservada; campanha permanece 1:1 e é exibida com `object-contain` (sem corte).
- `sizes`: `(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))`.
- Originais em `Downloads` não foram alterados; `identidade-floricultura.webp` (par anterior) não foi tocado.

## LCP — hipótese refutada por medição

- Hipótese inicial: campanha como LCP no desktop por área.
- **Medição no navegador (Chrome headless, CDP, cache limpo):** LCP = `h1` em **desktop 1440×900** (91.635 px², ~748 ms) e em **mobile 390×844** (38.982 px², ~72 ms). O `h1` vence nos dois tamanhos.
- **Ajuste aplicado:** removido `fetchPriority="high"` da campanha; ambas as imagens permanecem `loading="eager"`, nenhuma com `lazy`.
- **Caveat:** os tempos locais e os `transferSize` do Chrome local **não são PageSpeed de produção** e não devem ser usados como métrica pública. A medição serve apenas para decidir prioridade no HTML.
- Evidência: `evidence/lcp-measurement.json`.

## Gates

| Gate | Resultado |
|---|---|
| Suíte focada + regressão de landing/SEO | **161/161** em 12 arquivos; após os ajustes de composição, **105/105** nos 6 arquivos afetados |
| Typecheck (`tsc -p tsconfig.typecheck.json --noEmit`) | **0 erros** |
| Lint (`eslint .`) | exit **0** (sem cobertura de TypeScript — limitação preexistente) |
| Build (`npm run build`) | **0**; `/floriculturas` = 2,82 kB / 173 kB; shared 102 kB |
| OpenSpec change (`--strict`) | **valid** |
| `seo-discovery-foundation` / `landing-conversion-experience` | **valid** |
| `openspec validate --specs` global | 69 falhas **preexistentes** em outras specs (não relacionadas) |

## Composição entregue

Header → abertura (H1 + texto + **conjunto de acesso**: CTA verde + “Conheça o Vendeo” com borda, lado a lado no desktop e empilhados no mobile) → demonstração (rótulos na mesma linha, imagens alinhadas pelo topo, seta centralizada, aviso único) → explicação + card do texto gerado em coluna única (`max-w-2xl`) → segundo bloco → funcionamento em 4 passos → encerramento com o mesmo conjunto de acesso → rodapé.

Medições de layout confirmadas no navegador:

- Botões com 48 px de altura nos dois conjuntos (desktop) e 342 px de largura no mobile.
- Rótulos da comparação em `y=676` e imagens iniciando em `y=704/705` (diferença de 1 px por borda), sem recorte e sem overflow horizontal.
- Card do texto gerado com 443 px de largura no desktop, abaixo do parágrafo.

## Evidências

- `evidence/floriculturas-desktop-1440.png` (página completa)
- `evidence/floriculturas-mobile-390.png` (página completa)
- `evidence/lcp-measurement.json`
- `evidence/capture.log`

## Pendências / limites

- **Checkpoint visual humano pendente** (desktop/mobile). Este SUMMARY não declara a quick concluída.
- `STATE.md` e a tabela “Quick Tasks Completed” **não foram atualizados**: a conclusão depende da aprovação visual.
- Sem merge, push, deploy, sync ou archive.
- Imagem OG própria da página permanece follow-up (reutiliza a institucional).
- Header/rodapé duplicados localmente; extração compartilhada permanece follow-up para não tocar a home.
