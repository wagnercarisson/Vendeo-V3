# 62-03 — Evidência de gates (execução)

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Baseline da execução:** `6f637fe4` (aceite técnico do 62-02), worktree limpo
**Escopo:** somente `62-03`. Sem banco, Storage, provider, geração, migration aplicada, flag em ambiente, merge, push, deploy, sync ou archive.

## Commits

| Commit | Conteúdo |
|---|---|
| `bc5c46ea` | opt-in legado 1024 + `ArtifactOrigin` + testes de composição |
| `6ea0afd0` | ponte estável de proveniência + testes |
| `9cb43c39` | congelamento de seleção/pricing/economia + testes |
| `04d2433a` | cliente financeiro strict + testes |
| `3de5fd3a` | leitor canônico sanitizado + testes |
| `63eddf83` | correção de fronteira: remover import do runtime 1:1 |
| `fb3f279d` | autorização dirigida no plano (allowlist + seleção completa) |
| `8dd7e254` | seis caminhos exatos na allowlist + comparação completa da seleção |

## Gates dirigidos (plano)

| Gate | Comando | Resultado |
|---|---|---|
| Resolve source | `npx vitest run src/lib/campaign/composition-artifacts/__tests__/resolve-source.contract.test.ts` | PASS |
| Persist | `npx vitest run src/lib/campaign/composition-artifacts/__tests__/persist.contract.test.ts` | PASS |
| Ponte | `npx vitest run src/lib/campaign/format-addition/__tests__/bridge.contract.test.ts` | PASS |
| Economia | `npx vitest run src/lib/campaign/format-addition/__tests__/frozen-economics.contract.test.ts` | PASS |
| Cliente financeiro | `npx vitest run src/lib/campaign/format-addition/__tests__/financial-client.contract.test.ts` | PASS |
| Leitor | `npx vitest run src/lib/campaign/format-addition/__tests__/delivery-reader.contract.test.ts` | PASS |
| Combinado | os seis arquivos | **6 arquivos / 93 testes PASS** |

## Correções dirigidas (2026-11-23)

1. **Guard F60.4 autorizado:** os seis caminhos exatos de `composition-artifacts` foram adicionados a `AUTHORIZED_CONTRACT_CHANGES` com referência F62/62-03; `PHASE_BASE_SHA`, `PROTECTED_PATHS`, `CONTRACT_PATHS`, comparação temporal, controle positivo e demais asserções preservados. Nenhum diretório inteiro foi liberado.
2. **Seleção congelada completa:** `preflightFrozenExpansion` compara modelo, qualidade, `configVersionId` e origem antes de delegar; divergência retorna falha fechada com `detail: frozen_selection_mismatch:<campo>`. Motor compartilhado não alterado.

## Gates gerais

| Gate | Resultado real |
|---|---|
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** (não cobre TypeScript — limitação preexistente) |
| `npm.cmd run build` | exit **0**; 102/102 páginas |
| Guard F60.4 | **8/8 PASS** |
| Suíte global local | **exit 0**; **852 arquivos PASS + 2 skipped (854)**; **10.635 testes PASS + 10 skipped (10.645)** |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Aceite

- **Aprovado tecnicamente, local/offline, em 2026-11-23, sem bloqueadores.**
- Revisor (antes da correção): **6 suítes/93 testes PASS**; guard **7 PASS/1 FAIL** pelos seis caminhos; OpenSpec strict válido; worktree limpo; suíte global não reexecutada pelo revisor.
- Executor (após a correção): **6 suítes/93 PASS**; guard **8/8**; typecheck/lint/build **0**; global **exit 0** (852 arquivos + 2 skipped; 10.635 testes + 10 skipped); OpenSpec **1/0**; diff-check limpo.
- Migration **autorada e NÃO aplicada**; nenhum banco, Storage, provider, flag em ambiente, merge, push, deploy, sync ou archive.
- `62-04` autorizado somente para as Tasks 1–2; Tasks 3–4 e `62-05`+ bloqueados.

## Não executado

PostgreSQL/homolog, PostgreSQL/local, f50-4, app-env, Produto 1:1, F60 e F60.1. Nenhuma conexão de banco, `psql`, Docker, Supabase CLI, Storage ou provider. A migration do 62-02 permanece autorada e **NÃO aplicada**.

## Limitações

- Testes estáticos/fakes não provam concorrência, RLS, locks, lease, upload/download nem PostgREST reais.
- A fonte é baixada duas vezes (validação F60.1 + bytes para a ponte); custo de Storage, sem chamada paga.
- A allowlist do cliente financeiro é estática e fechada; novos motivos exigem atualização explícita.
