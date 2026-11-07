---
quick_id: 261107-pdp
slug: pagina-publica-praticidade-e-identidade
status: complete
date: 2026-11-07
branch: perf/quick-pagina-demonstracao-praticidade
base_commit: c55a0171
implementation_commit: 2770364e
visual_checkpoint: approved
accepted_on: 2026-11-07
openspec_change: pagina-publica-praticidade-e-identidade
openspec_archive: openspec/changes/archive/2026-11-07-pagina-publica-praticidade-e-identidade
---

# Quick 261107-pdp — Página pública de praticidade e identidade

## Resultado

**CONCLUÍDA LOCALMENTE, VERIFICADA, SINCRONIZADA E ARQUIVADA; ACEITE VISUAL
APROVADO; NÃO PUBLICADA.**

A rota pública `/campanhas-para-sua-loja` foi implementada como Server Component,
com dois casos demonstrativos em formatos diferentes, frase de identidade, kit
único de publicação em HTML, bloco de rotina e um único card de oferta. A página
posiciona o Vendeo como aplicativo e usa o pet shop apenas como exemplo visual.

Publicação, merge, push, deploy, tag e validação de produção **não foram
executados**. O checklist pós-publicação permanece separado e pendente.

## Entregue

- `src/app/(marketing)/campanhas-para-sua-loja/page.tsx`
- `src/components/landing/campanhas/**` (cabeçalho, grupo de acesso, contratos de
  imagem, caso de demonstração e kit)
- `public/demonstracao/**` com oito WebP (480w e 1024w por imagem)
- `src/__tests__/app/campanhas-para-sua-loja-page.test.tsx`
- testes focados de imagens e grupo de acesso
- `src/lib/seo/indexation-policy.ts` e `src/app/sitemap.ts` com a quarta superfície
- link “Campanhas sem complicação” no rodapé da home
- testes atualizados de política, sitemap e rodapé

## Gates finais

| Gate | Resultado |
|---|---|
| Testes focados | **140/140** em 7 arquivos |
| Suíte local | **8.171 passed**, 10 skipped, 653 arquivos |
| Typecheck | exit 0 |
| Lint | exit 0 — sem cobertura TS, limitação preexistente |
| Build | exit 0 — 98/98 páginas; rota `2,3 kB / 174 kB` |
| OpenSpec change | `--strict` válido antes do archive |
| OpenSpec specs afetadas | `campanhas-para-sua-loja-demonstration-page` e `seo-discovery-foundation` válidas com `--strict` |
| `git diff --check` | limpo |

## Aceite visual

Aprovado pelo responsável em 2026-11-07, nos estados aberto e fechado, desktop,
tablet e mobile. Revisão do Codex concluída sem bloqueantes.

Capturas de referência:

- `evidence/layout-desktop-1440-full.png`
- `evidence/layout-tablet-834-full.png`
- `evidence/layout-mobile-390-full.png`

Medições CDP: 0 px de overflow em 1440×900, 834×1112 e 390×844; 480w em DPR 1 e
1024w em DPR 3; 9:16 inteiro em todas as larguras; LCP local entre 24 ms e 576 ms,
com H1/parágrafo/campanha como vencedores conforme viewport e flag; CLS ≤ 0,0044.

## OpenSpec

- Verificação em `261107-pdp-OPENSPEC-VERIFY.md`: 45/45 tasks, 12 requirements e
  28 cenários cobertos, sem bloqueantes.
- Archive com `npx openspec archive pagina-publica-praticidade-e-identidade --yes`.
- Spec nova: `openspec/specs/campanhas-para-sua-loja-demonstration-page/spec.md`.
- Spec atualizada: `openspec/specs/seo-discovery-foundation/spec.md`.
- Change arquivada em
  `openspec/changes/archive/2026-11-07-pagina-publica-praticidade-e-identidade/`.
- Avisos não bloqueantes do arquivador: `Why` acima de 1000 caracteres e mais de
  10 deltas.

## Preservações

- `/floriculturas` e `/padarias` não foram alteradas.
- Oferta, autenticação, onboarding, créditos, elegibilidade, APIs, banco,
  migrations e flags não foram alterados.
- A home recebeu somente o link aprovado no rodapé.
- Sem JSON-LD de loja, produto, oferta, avaliação ou aplicação.
- Sem média pública de 30 segundos, contador, prazo garantido ou promessa de
  resultado comercial.

## Limitações

- LCP/CLS medidos localmente, não em PageSpeed ou produção.
- jsdom não mede layout real; as capturas e medições CDP cobrem esse ponto.
- O lint do projeto continua sem cobertura de TypeScript.
- Indexação pelo Google, sitemap publicado e PageSpeed de produção **não
  comprovados**.
- Publicação e smoke de produção permanecem pendentes.

## Pós-publicação

Checklist separado:
`.planning/quick/261107-pdp-pagina-publica-praticidade-e-identidade/261107-pdp-POST-DEPLOY.md`.

## Commits locais

- `2770364e` — implementação (código, testes e assets).
- Commit seguinte — fechamento documental, OpenSpec, SUMMARY e STATE.
