---
quick_id: 261104-pdr
slug: pagina-publica-para-padarias
status: complete
date: 2026-11-04
accepted_on: 2026-11-04
branch: feat/pagina-publica-padarias
base_commit: 53df58a7
openspec_change: pagina-publica-demonstrativa-padarias
openspec_archive: openspec/changes/archive/2026-11-04-pagina-publica-demonstrativa-padarias
visual_checkpoint: approved
commit: 438bca02
---

# Summary — 261104-pdr

Implementação concluída, verificada, sincronizada e arquivada na branch. Aceite
visual aprovado. **Não publicada**; sem merge, push, deploy ou tag.

## Entregue

- Rota pública `/padarias` em Server Component.
- Abertura específica de padaria, com o Vendeo como aplicativo.
- Foto do Bolo Naked Fruit → campanha da Panificadora Dona Maria.
- Kit de publicação em HTML, sem botões “Copiar”.
- Três situações comerciais: vitrine, fornadas e bolos/encomendas.
- Exemplo complementar do Pão Francês Fresquinho.
- Aviso demonstrativo único após o exemplo do pão.
- Um único card de oferta consumindo `public-offer-copy.ts`.
- Seis WebP (480w/1024w) em `public/padarias/`.
- `/padarias` como terceira superfície indexável, com sitemap e link “Padarias” no
  rodapé da home ao lado de “Floriculturas”.
- Nenhum dado estruturado de loja, produto, oferta ou avaliação.

## Arquivos principais

- `src/app/(marketing)/padarias/page.tsx`
- `src/components/landing/padarias/**`
- `public/padarias/**`
- `src/lib/seo/indexation-policy.ts`
- `src/app/sitemap.ts`
- `src/app/page.tsx` (somente link de rodapé)
- testes de página, imagens, política, sitemap e rodapé

## Gates

- 6 arquivos focados / 123 testes passed.
- Suíte local: 620 arquivos passed + 2 skipped; 7.768 testes passed + 10 skipped.
- Typecheck 0, lint 0 (sem cobertura TS), build 0.
- OpenSpec `--strict` válido.
- `git diff --check` limpo.

## Assets

| Arquivo | Dimensão | Peso |
|---|---:|---:|
| foto 480w | 480×480 | 47.092 B |
| foto 1024w | 1024×1024 | 148.506 B |
| bolo 480w | 480×480 | 53.818 B |
| bolo 1024w | 1024×1024 | 167.548 B |
| pão 480w | 480×480 | 49.412 B |
| pão 1024w | 1024×1024 | 143.952 B |

## Medições

- 1440×900, 834×1112 e 390×844, DPR1, flags fechada e aberta: overflow 0 px.
- LCP = H1 em todos os cenários.
- 480w em DPR1; 1024w em DPR3.
- Flag aberta: botão Google real no card, sem clique; abertura em âncora local.

## Evidências

`.planning/quick/261104-pdr-pagina-publica-para-padarias/evidence/`:
`final-verification.md`, `visual-acceptance.md`, `measurements.json`,
`measurements-open.json` e sete capturas.

## Pendência

Nenhuma funcional. Publicação e checklist pós-deploy permanecem separados em
`261104-pdr-POST-DEPLOY.md`; produção simulada não equivale a produção publicada.
Merge, push, deploy e tag ficam com o responsável.

## Aceite e fechamento

- Aceite visual aprovado pelo responsável em 2026-11-04, nos estados aberto e
  fechado.
- OpenSpec verificado em `261104-pdr-OPENSPEC-VERIFY.md`: 41/41 tasks, 16
  requirements, sem divergências bloqueantes.
- Sync: `padarias-demonstration-page` criada e `seo-discovery-foundation`
  atualizada.
- Archive: `openspec/changes/archive/2026-11-04-pagina-publica-demonstrativa-padarias/`.
- Implementação no commit `438bca02`; fechamento documental no commit seguinte.
- Status final: concluída, verificada, sincronizada e arquivada na branch — não
  publicada.
