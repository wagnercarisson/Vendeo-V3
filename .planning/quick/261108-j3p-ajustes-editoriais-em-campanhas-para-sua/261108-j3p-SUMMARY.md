---
quick_id: 261108-j3p
slug: ajustes-editoriais-em-campanhas-para-sua
status: complete
date: 2026-11-08
branch: quick/ajuste-rodape-textos-paginas
base_commit: 2bda3e51
implementation: complete-local
visual_checkpoint: approved
accepted_on: 2026-11-08
commit: 153ce9f2 (implementação) + e232e603 (documentação) + commit complementar OpenSpec
openspec_sync: complete
openspec_archive: openspec/changes/archive/2026-11-08-ajustes-editoriais-e-rodape-publico-compartilhado
---

# Quick 261108-j3p — Summary

## Entregue nesta rodada

### 1. Ajustes editoriais em `/campanhas-para-sua-loja`

- H2: “Feita para a rotina de quem atende, repõe e ainda divulga.” →
  “Feito para a rotina de quem atende, repõe e ainda divulga.”
- Início do parágrafo: “Quem toca uma loja pequena acumula funções.” →
  “Quem administra uma loja precisa conciliar atendimento, estoque, fornecedores
  e divulgação.”
- Continuação preservada: “O Vendeo encurta o caminho entre o produto que está na
  vitrine e a publicação que precisa sair.”
- Nenhum outro texto da página foi alterado.

### 2. Rodapé público compartilhado

- `src/components/landing/public-footer-nav.ts`: lista central tipada com
  Floriculturas, Padarias e Campanhas sem complicação.
- `src/components/landing/public-footer.tsx`: Server Component com:
  - grupo **“Explore o Vendeo”**;
  - grupo **“Institucional”**;
  - `aria-current="page"` no destino atual;
  - home com Contato, Novidades e aviso legal;
  - páginas internas com “Voltar ao Vendeo”;
  - links HTML com `href` real, 44 px de toque e foco visível.
- As quatro páginas passaram a consumir o componente:
  `/`, `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja`.
- Nenhum acoplamento com sitemap, robots, canonical, metadata ou
  `middleware.ts`.

## Arquivos alterados

**Novos**
- `src/components/landing/public-footer-nav.ts`
- `src/components/landing/public-footer.tsx`
- `src/components/landing/__tests__/public-footer.test.tsx`

**Alterados**
- `src/app/page.tsx`
- `src/app/(marketing)/floriculturas/page.tsx`
- `src/app/(marketing)/padarias/page.tsx`
- `src/app/(marketing)/campanhas-para-sua-loja/page.tsx`
- `src/__tests__/app/home-footer-links.test.tsx`
- `src/__tests__/app/floriculturas-page.test.ts`
- `src/__tests__/app/padarias-page.test.ts`
- `src/__tests__/app/campanhas-para-sua-loja-page.test.tsx`

**Artefatos**
- `.planning/quick/261108-j3p-.../261108-j3p-DIAGNOSTIC.md`
- `.planning/quick/261108-j3p-.../261108-j3p-PLAN.md`
- `openspec/changes/ajustes-editoriais-e-rodape-publico-compartilhado/**`
- `evidence/` com 8 capturas e `footer-measurements.json`

## Validação local

| Gate | Resultado |
|---|---|
| Testes focados (5 arquivos) | **96/96 passed** |
| Regressão SEO (sitemap, robots, indexação) | **52/52 passed** |
| Lint | exit 0 (sem cobertura TypeScript — limitação preexistente) |
| Build | exit 0 |
| `git diff --check` | limpo |
| OpenSpec `validate --strict` | valid |
| Overflow horizontal | **0 px** em 1440×900 e 390×844 nas quatro páginas |
| `aria-current` | exatamente 1 nas três páginas internas; 0 na home |
| Contato/Novidades/aviso legal | presentes somente na home |
| Voltar ao Vendeo | presente somente nas páginas internas |

### Typecheck

`npm run typecheck` apresentou um erro em
`src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`
(`Response` incompleto no mock). O arquivo não foi tocado por esta quick e nenhum
erro de tipo foi reportado nos arquivos alterados. A **origem não foi determinada**
nesta verificação e **não é atribuída a esta quick nem à fase como fato
confirmado**. Fica registrado como **pendência externa, a ser tratada no contexto
da F59**.

### Reconciliação (2026-11-08 — quick `261108-kli`)

O erro TS2345 foi **reproduzido** e **corrigido** fora desta quick, sem apagar o
registro acima:

- causa: `jsonResponse` devolvia um objeto parcial, mas `resolveFirst` exigia
  `Response`; trecho introduzido no commit `f79f4559`;
- correção: o helper passou a devolver `new Response(...)` real, sem casts,
  `@ts-ignore` ou relaxamento do TypeScript;
- estado atual: `npm run typecheck` exit 0, teste focado **75/75**, lint exit 0 e
  `git diff --check` limpo;
- a atribuição anterior (“origem não determinada”) permanece registrada como o
  estado então observado; a origem agora é conhecida (`f79f4559`).

## Capturas

Em `evidence/`:

- `home-footer-desktop-1440.png` / `home-footer-mobile-390.png`
- `floriculturas-footer-desktop-1440.png` / `floriculturas-footer-mobile-390.png`
- `padarias-footer-desktop-1440.png` / `padarias-footer-mobile-390.png`
- `campanhas-footer-desktop-1440.png` / `campanhas-footer-mobile-390.png`
- `footer-measurements.json`

Medições: 0 px de overflow nos 8 cenários; rodapé com 177 px (internas desktop),
257 px (home desktop), 425 px (internas mobile) e 553 px (home mobile).

## Limitações

- **Validação local apenas.** Nada foi publicado ou verificado em produção.
- O lint não cobre TypeScript neste projeto (limitação preexistente).
- O typecheck global apresenta erro em teste de bancada não tocado por esta
  quick; origem não determinada e pendência externa reservada ao contexto da F59.
  **Resolvido em 2026-11-08 pela quick `261108-kli`** (causa `f79f4559`, helper
  `jsonResponse` agora devolve `Response` real); o registro original é preservado.
- Capturas foram feitas com Chrome headless + CDP em `next start` local;
  leitor de tela real não executado.
- `aria-current` é semântico e não recebe estilo visual diferenciado nesta
  rodada (não solicitado).

## Estado do trabalho

- Implementação local concluída.
- **Aceite visual aprovado pelo responsável em 2026-11-08.**
- Commits locais: `153ce9f2` (implementação) e `e232e603` (documentação), mais o
  commit complementar OpenSpec.
- OpenSpec verificado, sincronizado e arquivado em
  `openspec/changes/archive/2026-11-08-ajustes-editoriais-e-rodape-publico-compartilhado/`;
  specs afetadas validadas em modo strict.
- Sem merge, push, deploy, tag ou acesso à produção; essas etapas permanecem com
  o responsável.
