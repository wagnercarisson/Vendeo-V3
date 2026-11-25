---
quick_id: 261125-i10
title: Fechamento mínimo da branch feat/apenas-duas-imagens-de-entrada
date: 2026-11-25
status: completed
entrypoint: /gsd-quick
scope: branch-closure
plan_type: execute
wave: 1
depends_on: [261125-eo7, 261125-i09]
autonomous: false
branch: feat/apenas-duas-imagens-de-entrada
worktree_isolation: false
approval:
  status: approved
  note: Escopo autorizado pelo usuário — reconciliar a exceção do guard para form-rules.ts (eo7, commit 65d00e75), corrigir somente os whitespaces apontados por git diff main...HEAD --check, registrar a validação manual do limite de imagens e fechar o tracking. Sem publicação.
files_modified:
  - src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts
  - .planning/quick/261125-i06-identificacao-institucional-text-only/261125-i06-PLAN.md
  - .planning/quick/261125-i06-identificacao-institucional-text-only/261125-i06-SUMMARY.md
  - .planning/quick/261125-i10-fechamento-da-branch-apenas-duas-imagens/PLAN.md
  - .planning/quick/261125-i10-fechamento-da-branch-apenas-duas-imagens/SUMMARY.md
  - .planning/quick/261125-i10-fechamento-da-branch-apenas-duas-imagens/deferred-items.md
  - .planning/STATE.md
---

# Plano

## Objetivo

Fechar minimamente a branch `feat/apenas-duas-imagens-de-entrada` antes de
merge/push, sem publicar: reconciliar o guard de fronteira para a exceção já
aprovada da quick 261125-eo7, corrigir apenas os whitespaces apontados no
histórico da i06, registrar a validação manual do limite de imagens e atualizar o
tracking.

## Tarefas

1. **Guard de fronteira** — adicionar entrada específica para
   `src/lib/lab/bench/domain/form-rules.ts` em `AUTHORIZED_FRONTIER_CHANGES`,
   com autorização da quick 261125-eo7 e commit imutável `65d00e75`. Manter a
   comparação de conteúdo contra o commit aprovado, o `BASE_SHA`, o conjunto
   exato e os testes negativos. Nenhum diretório é liberado.
2. **Whitespace documental** — remover somente os três trailing spaces do
   `261125-i06-PLAN.md` e a linha em branco final do `261125-i06-SUMMARY.md`,
   sem reescrever conteúdo histórico.
3. **Validação manual eo7** — verificar evidência existente; o SUMMARY da eo7
   registrava **PENDENTE**. Solicitar ao usuário e registrar o resultado real,
   sem confundir testes automatizados com UAT.
4. **Gates** — guard, testes de teto de imagens/paridade da bancada, typecheck,
   lint, `git diff --check` e `git diff main...HEAD --check`; repetir o guard e o
   diff-check da faixa após o commit.

## Limites

- Não alterar prompts, cenários, temas, identidade, fluxo de geração ou regras
  de produto.
- Não corrigir erros estruturais preexistentes de outras specs.
- Sem merge, push, deploy, migrations, banco/Storage ou chamadas pagas.
- `.f62-check/` preservada e fora dos commits.
- Build não é repetido para mudanças exclusivas de teste/documentação; o build
  da branch já havia sido aprovado na revisão anterior.

## Critério de encerramento

Guard verde após o commit; testes focados, typecheck, lint e diff-checks
verdes; validação manual registrada com status honesto; tracking atualizado;
publicação explicitamente não executada.
