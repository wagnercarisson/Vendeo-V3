# Quick 261109-mrc — Verificação OpenSpec

**Change:** `ofertas-para-mercados`
**Data:** 2026-11-09
**Branch:** `perf/pagina-oferta-mercearia`
**Base:** `8f259b86`
**Veredito local:** **PASS** — implementação coerente com a change; publicação fora do escopo.

## 1. Cobertura de requisitos

| Requisito | Evidência | Status |
|---|---|---|
| Rota pública `/ofertas-para-mercados` | `src/app/(marketing)/ofertas-para-mercados/page.tsx`; build estático | PASS |
| Copy aprovada, com explicação consolidada | testes de página; capturas | PASS |
| Foto menor, campanha em destaque | 360 px / 480 px no desktop; 306 px / 408 px no tablet | PASS |
| Rótulo da foto junto da imagem | rótulo absoluto acima da foto no desktop/tablet; fluxo normal no mobile | PASS |
| Rótulo da campanha no topo | preservado na coluna da campanha | PASS |
| Seta centralizada somente nas imagens | grade com rótulos fora do cálculo; capturas | PASS |
| Sem crop ou distorção | `object-contain`; proporções 3:2 e 1:1 medidas | PASS |
| Explicação única sobre produto, preços e validade | texto consolidado uma única vez antes do kit | PASS |
| Kit em HTML, sem “Copiar” | `publication-kit.tsx`; testes | PASS |
| Kit com card mais largo, aceito explicitamente | coluna `max-w-3xl`; copy exata preservada | PASS |
| Exemplo complementar do café | `coffee-example.tsx`; WebP existentes reutilizados | PASS |
| Aviso demonstrativo único | uma ocorrência após o café; teste e captura | PASS |
| Card único de oferta | `OfferCard` compacto; teste de card único | PASS |
| Ações reais somente no card final | testes de flag aberta/fechada | PASS |
| Metadata própria e canonical fail-closed | testes de metadata; `indexation-policy.ts` | PASS |
| Quinta superfície indexável e sitemap | política e sitemap com 5 URLs sob condição combinada | PASS |
| Rodapé central com quatro destinos | `public-footer-nav.ts`; testes de rodapé/home | PASS |
| Navegação independente de indexação | lista não importada por sitemap/robots/metadata | PASS |
| Sem dados estruturados comerciais | teste de ausência de JSON-LD | PASS |
| Sem geração/provider/crédito/banco | nenhuma chamada; assets estáticos | PASS |
| Preservação das páginas existentes | somente SEO, sitemap, lista do rodapé e testes afetados | PASS |

## 2. Testes e gates

- Focados: **148/148** em 7 arquivos.
- Suíte local: **8326 passed, 10 skipped, 5 failed** — falhas preexistentes ou
  intermitentes (`landing-page` 1, `legacy-frontier` 3, `store-identity-form` 1).
- Typecheck: exit 0.
- Lint: exit 0; sem cobertura TS (limitação preexistente).
- Build: exit 0; 100/100 páginas; `/ofertas-para-mercados` estática.
- `git diff --check`: limpo.
- `npx openspec validate ofertas-para-mercados --strict`: válido.

A suíte global **não está integralmente verde**; as falhas estão registradas e não
foram introduzidas pelos caminhos alterados.

## 3. Tarefas

- 0.1–0.5: concluídas.
- 1.1–1.5: concluídas.
- 2.1–2.7: concluídas.
- 3.1–3.8: concluídas.
- 4.1–4.12: concluídas.
- 5.1–5.8: concluídas, incluindo aceite visual e rodada de ajuste da composição.
- 6: publicação não executada; checklist pós-deploy separado e não iniciado.

## 4. Specs a sincronizar

- `ofertas-para-mercados-demonstration-page` — nova capability.
- `seo-discovery-foundation` — quinta superfície indexável e sitemap com cinco URLs.
- `public-footer-navigation` — quatro destinos e cinco páginas consumidoras.

## 5. Observações

- O LCP local passou a ser a campanha no desktop/tablet; nenhuma prioridade alta
  foi adicionada sem nova decisão.
- A captura de página inteira no mobile foi refeita sem artifact; o par e o
  viewport também estão registrados.
- O card do kit acompanha `max-w-3xl`; essa largura foi revisada e aceita. A copy
  do kit é preservada, mas a largura anterior não é declarada como preservada.
- Publicação, merge, push, deploy e tag não fazem parte desta verificação.

## 6. Conclusão

A implementação está coerente com a change e pronta para sincronização e arquivo
OpenSpec. O fechamento local pode prosseguir; publicação permanece pendente.

Arquivo executado em `openspec/changes/archive/2026-11-10-ofertas-para-mercados/`.
As specs `ofertas-para-mercados-demonstration-page`, `seo-discovery-foundation`
e `public-footer-navigation` foram validadas em `--strict`.
