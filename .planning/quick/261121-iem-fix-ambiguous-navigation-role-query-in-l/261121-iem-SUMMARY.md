---
phase: quick/261121-iem
plan: 01
subsystem: landing-page-tests
tags: [testing, vitest, testing-library, accessibility, footer]
status: complete
requires: []
provides:
  - "consulta unívoca da navegação 'Institucional' do rodapé no teste da landing"
  - "asserções de destino dos links legais e Contato preservadas"
affects:
  - src/components/landing/__tests__/landing-page.test.tsx
tech-stack:
  added: []
  patterns:
    - "getByRole('navigation', { name }) para desambiguar landmarks quando o nome acessível existe"
key-files:
  created: []
  modified:
    - src/components/landing/__tests__/landing-page.test.tsx
decisions:
  - "Nenhuma alteração em produção: o rodapé já tinha duas navegações legítimas e nomeadas"
  - "Nome acessível 'Institucional' escolhido por ser o dono real dos links legais e do Contato"
metrics:
  duration: "~10min"
  completed: 2026-11-21
---

# Quick 261121-iem: consulta ambígua de `navigation` no teste da landing — Summary

Falha isolada no cenário "preserva os links legais e Contato no rodapé" corrigida na
consulta do teste. **Suíte do arquivo 20/20**, regressão de rodapé 26/26, typecheck,
`git diff --check` e lint verdes, **sem tocar em produção**.

## Causa raiz

O `PublicFooter` compartilhado renderiza **duas** navegações legítimas, cada uma com nome
acessível via `aria-labelledby` (`src/components/landing/public-footer.tsx`):

| `<nav>` | `aria-labelledby` | Nome acessível | Conteúdo |
|---|---|---|---|
| 1 | `footer-explore-heading` | "Explore o Vendeo" | Floriculturas, Padarias, Mercados, Campanhas |
| 2 | `footer-institutional-heading` | "Institucional" | Termos, Privacidade, Uso Aceitável, Contato, Novidades, Entrar |

Os links legais e o Contato pertencem à navegação **"Institucional"**. O teste consultava
`within(footer).getByRole("navigation")` sem nome acessível, o que é ambíguo com dois
landmarks `navigation` e dispara
`TestingLibraryElementError: Found multiple elements with the role "navigation"`.

Não há defeito de produto: as duas navegações são intencionais e corretamente nomeadas.
A falha era exclusivamente de consulta do teste (a mesma falha `landing-page` 1 já
aparecia como preexistente no histórico do STATE).

## Diff aplicado

`src/components/landing/__tests__/landing-page.test.tsx` — única alteração funcional:

```diff
-    const nav = within(footer as HTMLElement).getByRole("navigation");
+    // O rodapé tem duas navegações legítimas ("Explore o Vendeo" e "Institucional").
+    // Os links legais e o Contato pertencem à navegação "Institucional".
+    const nav = within(footer as HTMLElement).getByRole("navigation", {
+      name: "Institucional",
+    });
```

As quatro asserções seguintes permanecem intactas, todas via `within(nav)`:

- `Termos de Uso` → `/termos`
- `Política de Privacidade` → `/privacidade`
- `Uso Aceitável` → `/uso-aceitavel`
- `Contato` → `mailto:`

Nenhuma asserção removida, nenhum `skip`, nenhum `queryAllByRole`/`first()`/índice 0.
Nenhum `<nav>`, link, `aria-labelledby` ou copy foi alterado.

## Resultados reais

| Gate | Comando | Resultado |
|---|---|---|
| Baseline (antes) | `npx vitest run src/components/landing/__tests__/landing-page.test.tsx` | **1 failed \| 19 passed (20)** |
| Suíte landing-page (depois) | idem | **20/20 passed** |
| Regressão de rodapé | `npx vitest run .../public-footer.test.tsx .../landing-page.test.tsx` | **26/26 passed (2 files)** |
| Typecheck | `npm run typecheck` | **exit 0** |
| Diff check | `git diff --check` | **exit 0, sem saída** |
| Lint | `npm run lint` (`eslint .`) | **exit 0** (ver limitação) |

### Limitação do lint (registrada, não mascarada)

`eslint.config.mjs` não define `files`, parser TypeScript nem plugin TS, então o flat config
só alcança os arquivos JS padrão: **`.ts`/`.tsx` ficam fora do escopo do `eslint .`**. O
exit 0 não cobre o arquivo de teste alterado — mesma limitação já registrada em quick
anteriores ("lint 0 (sem TS)"). A validação efetiva do arquivo é o typecheck + Vitest.

### Escopo de validação

A suíte **global** (`npm test`) **não foi reexecutada**; portanto nada aqui declara a suíte
global verde. As outras 5 falhas da última execução global permanecem fora deste escopo.

## Preservação do worktree

Os dois `__pycache__` preexistentes
(`.codex/skills/ui-ux-pro-max/scripts/__pycache__/*.pyc`) foram mantidos modificados e
**fora** de todos os commits.

## Commits

- `29d28527` — `fix(261121-iem): escopar consulta da navegacao do rodape por nome acessivel`
- commit documental imediatamente seguinte, registrando este SUMMARY e o STATE.md

## Parada para revisão

Sem merge, push, deploy, migration, flag, banco, Storage ou provider. Aguardando revisão
antes de qualquer integração.
