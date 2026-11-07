# OpenSpec verify — pagina-publica-praticidade-e-identidade

Data: 2026-11-07. Branch: `perf/quick-pagina-demonstracao-praticidade`.
Escopo: change `pagina-publica-praticidade-e-identidade` e implementação de
`/campanhas-para-sua-loja`.

## Summary

| Dimension | Status |
|---|---|
| Completeness | 45/45 tasks; 8 requirements em `campanhas-para-sua-loja-demonstration-page`; 4 requirements modificados em `seo-discovery-foundation` |
| Correctness | 12/12 requirements com implementação e cobertura de teste/medição; 28 cenários mapeados |
| Coherence | D1–D9 seguidos; componentes locais; fontes centrais preservadas; sem nova fase |

## Evidências por requirement

### `campanhas-para-sua-loja-demonstration-page`

| Requirement | Evidência |
|---|---|
| Rota pública e composição | `src/app/(marketing)/campanhas-para-sua-loja/page.tsx`; teste de composição, ordem e `h1` único |
| Copy aprovada sem acréscimos | `campanhas-para-sua-loja-page.test.tsx`; H1, abertura, casos, frase, kit, aviso, rotina e fecho |
| Dois casos com formatos e identidade | `demonstration-case.tsx`, `image-sources.ts`; 1:1 e 9:16, `object-contain`, sem grade única |
| Oferta única e CTAs por flag | `access-cta-group.tsx`, `OfferCard`; testes das duas flags, âncora, `/#acesso` e `/signup` |
| Imagens responsivas e desempenho | `image-sources.ts`, `public/demonstracao/**`, teste offline; medições CDP e capturas |
| Metadata, canonical e indexação | `page.tsx`, `indexation-policy.ts`, `sitemap.ts`; matriz por ambiente e sitemap |
| Link único na home | `src/app/page.tsx`; `home-footer-links.test.tsx` |
| Acessibilidade estrutural | landmarks, um `h1`, `alt`, `aria-hidden`, `dl`, `details/summary`, foco e toque; testes dedicados |

### `seo-discovery-foundation`

| Requirement | Evidência |
|---|---|
| Metadata da home + link de rodapé | `src/app/page.tsx` recebeu somente “Campanhas sem complicação”; teste de rodapé |
| Política de indexação | quarta superfície em `indexation-policy.ts`; testes de política e rota |
| Padrão fail-closed | subcaminho da rota permanece `noindex`; `/campanhas/**` privado; default da raiz inalterado |
| Sitemap | quatro URLs em produção válida; vazio nos demais cenários; teste atualizado |

## Verificação executada sobre o código final

- `npx openspec validate pagina-publica-praticidade-e-identidade --strict` — válido.
- Testes focados — 7 arquivos / 140 testes passed.
- Suíte local — 653 arquivos passed + 2 skipped; 8.171 testes passed + 10 skipped.
- Typecheck — exit 0.
- Lint — exit 0, sem cobertura TypeScript (limitação preexistente).
- Build — exit 0; 98/98 páginas; `/campanhas-para-sua-loja` estática em 2,3 kB / 174 kB.
- `git diff --check` — limpo.
- HTML local — `noindex, nofollow`, sem canonical, sitemap vazio.
- Capturas e medições CDP nos dois estados da flag, em 1440×900, 834×1112 e
  390×844 (DPR 1 e 3): 0 px de overflow, 9:16 inteiro, 480w em DPR 1 e 1024w em
  DPR 3.
- Aceite visual — aprovado pelo responsável em 2026-11-07, com as capturas
  `layout-desktop-1440-full.png`, `layout-tablet-834-full.png` e
  `layout-mobile-390-full.png`.

## Issues

Nenhum CRITICAL. Nenhum WARNING. Nenhuma SUGGESTION bloqueante.

Observações não bloqueantes, já registradas:

- jsdom não mede layout real; as medições de largura, overflow e LCP vêm do
  navegador.
- O lint do projeto continua sem cobertura de TypeScript.
- O checklist pós-deploy permanece pendente e separado; produção simulada não
  equivale a publicação.
- Indexação pelo Google, sitemap publicado e PageSpeed de produção não foram
  comprovados nesta rodada.

## Final assessment

**All checks passed. Ready for archive.**

## Sync e archive

- Sincronizado e arquivado em 2026-11-07 com
  `npx openspec archive pagina-publica-praticidade-e-identidade --yes`.
- `openspec/specs/campanhas-para-sua-loja-demonstration-page/spec.md` criada com
  8 requirements.
- `openspec/specs/seo-discovery-foundation/spec.md` atualizada com 4 requirements
  modificados.
- Change arquivada em
  `openspec/changes/archive/2026-11-07-pagina-publica-praticidade-e-identidade/`.
- Validação final das duas specs afetadas com `--strict`: ambas válidas.
- Avisos não bloqueantes do arquivador: `Why` acima de 1000 caracteres e mais de
  10 deltas. Nenhum bloqueou o archive.
