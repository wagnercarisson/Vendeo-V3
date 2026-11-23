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

## Gates gerais

| Gate | Resultado real |
|---|---|
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** (não cobre TypeScript — limitação preexistente) |
| `npm.cmd run build` | exit **0**; 102/102 páginas |
| Suíte global local | **exit 1**; **851 arquivos PASS + 2 skipped + 1 FAILED (854)**; **10.634 testes PASS + 10 skipped + 1 failed (10.645)** |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Falha global conhecida (não contornada)

`src/lib/campaign/square-base/__tests__/regression.contract.test.ts` (F60.4) acusa os seis arquivos autorizados de `composition-artifacts`:

- `src/lib/campaign/composition-artifacts/__tests__/persist.contract.test.ts`
- `src/lib/campaign/composition-artifacts/__tests__/resolve-source.contract.test.ts`
- `src/lib/campaign/composition-artifacts/persist.ts`
- `src/lib/campaign/composition-artifacts/resolve-source.ts`
- `src/lib/campaign/composition-artifacts/source-validation.ts`
- `src/lib/campaign/composition-artifacts/types.ts`

Eles estão em `files_modified` do plano 62-03, mas não em `AUTHORIZED_CONTRACT_CHANGES`. O guard **não foi alterado**. A reconciliação exige autorização explícita (arquivo fora do plano).

## Não executado

PostgreSQL/homolog, PostgreSQL/local, f50-4, app-env, Produto 1:1, F60 e F60.1. Nenhuma conexão de banco, `psql`, Docker, Supabase CLI, Storage ou provider. A migration do 62-02 permanece autorada e **NÃO aplicada**.

## Limitações

- Testes estáticos/fakes não provam concorrência, RLS, locks, lease, upload/download nem PostgREST reais.
- A fonte é baixada duas vezes (validação F60.1 + bytes para a ponte); custo de Storage, sem chamada paga.
- A allowlist do cliente financeiro é estática e fechada; novos motivos exigem atualização explícita.
