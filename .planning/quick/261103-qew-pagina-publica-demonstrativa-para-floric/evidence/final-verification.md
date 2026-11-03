# Verificação final — quick 261103-qew

**Data:** 2026-11-03
**Branch:** `perf/pagina-campanha-florista`
**HEAD de referência:** `4a6b8579` (código em `9a627b65`)
**Escopo:** `/floriculturas` — página pública demonstrativa.
**Estado:** implementada e validada localmente, aceite visual aprovado, aguardando fechamento OpenSpec. **Não publicada.**

## 1. Gates automáticos

| Gate | Resultado |
|---|---|
| Suíte focada + regressão (15 arquivos) | **197/197** |
| Typecheck (`tsc -p tsconfig.typecheck.json --noEmit`) | **0** |
| Lint (`eslint .`) | exit **0** (sem cobertura de TypeScript — limitação preexistente) |
| Build (`npm run build`) | **exit 0**; `/floriculturas` = 2,82 kB / 173 kB; shared 102 kB |
| `git diff --check` | limpo |
| OpenSpec change (`--strict`) | **valid** |
| `seo-discovery-foundation`, `landing-conversion-experience`, `landing-app-integration` | **valid** |
| `openspec validate --specs` (global) | 69 falhas **preexistentes**, não relacionadas a esta entrega |

## 2. Contrato verificado por teste automatizado

Cenários que **não** foram executados em runtime de produção e, portanto, valem apenas como contrato testado:

| Cenário | Verificação automática |
|---|---|
| Produção confirmada + origem válida | `/floriculturas` → `index, follow`; canonical absoluto `https://vendeo.tech/floriculturas`; sitemap com home + `/floriculturas` |
| Produção + origem `www`/`http`/ausente | `noindex, nofollow`; canonical omitido; sitemap vazio |
| Preview | `noindex, nofollow`; canonical omitido; sitemap vazio |
| Local (`VERCEL_ENV` ausente) | `noindex, nofollow`; canonical omitido; sitemap vazio |
| Política por path | `/floriculturas` indexável + no sitemap; `/floriculturas/exemplo` fail-closed; rotas privadas/legais/transitórias inalteradas |
| `robots.txt` | referencia sitemap só na condição combinada; nunca emite `Disallow` |
| Headers | `X-Robots-Tag` global fora de produção confirmada inalterado |

## 3. Observado em runtime local (build sem `VERCEL_ENV`)

Executado no build local servido em `127.0.0.1:3100`:

| Verificação | Resultado |
|---|---|
| `/floriculturas` | HTTP 200 |
| Metadata `robots` | `noindex, nofollow` (esperado no local) |
| Canonical | ausente (esperado no local) |
| `sitemap.xml` | `<urlset>` vazio (esperado no local) |
| `robots.txt` | sem referência a `Sitemap` (esperado no local) |
| Aviso demonstrativo | exatamente 1 ocorrência no markup |
| Conjuntos de acesso | 2 (`data-access-cta-group`), um na abertura e um no encerramento |
| `Solicitar acesso free` → `/#acesso` | 2 ocorrências |
| `Conheça o Vendeo` → `/` | 2 ocorrências, nenhuma para `/#acesso` |
| Texto gerado | título, legenda, 4 hashtags e chamada final presentes |
| Botão “Copiar” / tabela de entrada | ausentes |
| Home | HTTP 200, H1 aprovado, link de rodapé `Exemplo: campanha para floricultura` → `/floriculturas` |
| `/dashboard` sem sessão | 302 (proteção preservada) |
| `/termos`, `/login` | 200 |

**O que esses resultados NÃO comprovam:** o cenário de produção (indexabilidade, canonical e sitemap de produção) foi exercitado apenas por teste automatizado, não em runtime publicado; indexação pelo Google, tráfego e PageSpeed de produção não foram medidos.

## 4. Preservação da home e de contratos intocados

- `git diff 1c3fd952..HEAD -- src/app/page.tsx`: **apenas** o link de rodapé novo.
- `src/middleware.ts`, `src/app/robots.ts`, `src/lib/seo/robots-headers.ts`, `next.config.ts`: **sem diff**.
- Nenhum arquivo de campanha, crédito, onboarding, autenticação, migration ou API alterado.
- `public/landing/identidade-floricultura.webp` não foi tocado.

## 5. Performance (informativo, não PageSpeed)

LCP medido localmente com Chrome headless/CDP: **`h1`** em desktop (1440×900, 91.635 px²) e mobile (390×844, 38.982 px²). Por isso nenhuma imagem usa `fetchPriority="high"`; ambas permanecem `eager`.

Os tempos locais e os `transferSize` registrados **não são resultado de PageSpeed em produção** e não sustentam afirmação pública de performance.

## 6. Conclusão

Entrega validada localmente e aceita visualmente. Nenhuma alteração de copy, composição ou código após o aceite. **Sem merge, push ou deploy.** Sync/archive do OpenSpec não executados — aguardam revisão conjunta, conforme o fluxo do projeto.
