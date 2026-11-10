---
quick_id: 261109-mrc
slug: ofertas-para-mercados
status: complete
date: 2026-11-09
branch: perf/pagina-oferta-mercearia
base_commit: 8f259b86
code_commit: e729c741
implementation_committed: true
visual_checkpoint: approved
openspec_change: ofertas-para-mercados
openspec_archive: openspec/changes/archive/2026-11-10-ofertas-para-mercados
---

# Quick 261109-mrc — Summary

## Resultado

A página pública `/ofertas-para-mercados` foi implementada localmente com a copy
consolidada aprovada, os assets da carne, o exemplo reutilizado do café, a
política de indexação, o sitemap e o novo destino do rodapé compartilhado.

A demonstração principal não tem mais parágrafo de apoio. A explicação
consolidada aparece uma única vez após o par, antes do kit:

> Uma oferta clara, com a identidade da sua loja.
>
> Você informa o produto, o preço anterior, o preço promocional e o período de
> validade da oferta. O Vendeo organiza essas informações em uma campanha com o
> produto em destaque e a identidade da sua loja.

No desktop/tablet, a foto de entrada foi reduzida para no máximo 360 px e a
campanha ganhou destaque com no máximo 480 px, sem crop ou distorção. O rótulo
“Foto do produto” acompanha a imagem centralizada; o rótulo da campanha permanece
no topo. Títulos usam `text-balance` e parágrafos usam `text-pretty` para evitar
palavras isoladas, sem alterar fontes, copy ou mobile.

O card do kit acompanha a coluna `max-w-3xl`; o alargamento foi revisado e aceito
explicitamente. A copy do kit permanece exata, mas a largura anterior não é
registrada como preservada.

## Arquivos

Criados:

- `src/app/(marketing)/ofertas-para-mercados/page.tsx`
- `src/components/landing/mercados/{mercados-header,access-cta-group,image-sources,demonstration-pair,publication-kit,coffee-example}.tsx`
- `src/components/landing/mercados/__tests__/image-sources.test.ts`
- `src/__tests__/app/ofertas-para-mercados-page.test.ts`
- `public/mercados/*.webp` (quatro variantes da carne)
- `openspec/changes/ofertas-para-mercados/**`
- `.planning/quick/261109-mrc-ofertas-para-mercados/**`

Alterados:

- `src/lib/seo/indexation-policy.ts`
- `src/app/sitemap.ts`
- `src/components/landing/public-footer-nav.ts`
- `src/components/landing/public-footer.tsx` (comentário)
- testes de indexação, sitemap, rodapé e links da home

## Gates

- Testes focados: **148/148**
- Suíte local: **8326 passed, 10 skipped, 5 failed** — falhas preexistentes ou
  intermitentes, não relacionadas (`landing-page` 1, `legacy-frontier` 3,
  `store-identity-form` 1)
- Typecheck: 0
- Lint: exit 0 (sem cobertura TS)
- Build: exit 0, 100/100 páginas, rota estática presente
- `git diff --check`: limpo
- OpenSpec `--strict`: válido

## Evidências

- `evidence/261109-mrc-EVIDENCE.md`
- `evidence/closed-*.png` e `open-*.png`
- `evidence/closed-measurements.json` e `open-measurements.json`
- `evidence/source/` com os três originais

## Fechamento local (2026-11-09)

- Aceite visual aprovado, incluindo o ajuste do rótulo da foto e a aceitação
  explícita do card do kit em `max-w-3xl`.
- Implementação commitada em `e729c741`.
- OpenSpec verificado, sincronizado e arquivado em
  `openspec/changes/archive/2026-11-10-ofertas-para-mercados/`.
- Specs principais: `ofertas-para-mercados-demonstration-page` (nova),
  `seo-discovery-foundation` e `public-footer-navigation` (atualizadas).
- Verificação: `261109-mrc-OPENSPEC-VERIFY.md`.

## Pendente

- Merge, push, deploy e tag: etapas do responsável, não executadas.
- Checklist pós-deploy permanece separado e não iniciado.
