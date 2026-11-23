# 62-02 — Evidência de gates (execução)

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Baseline da execução:** `e5bc0053` (aceite documental do `62-01`), worktree limpo
**Escopo:** somente `62-02`. A migration foi **autorada e NÃO aplicada** em nenhum banco (inclusive local). Nenhum Storage, provider, geração, flag em ambiente, merge, push, deploy, sync ou archive.

## Baseline

| Verificação | Resultado |
|---|---|
| `git rev-parse --abbrev-ref HEAD` | `feat/campaign-add-vertical` |
| `git rev-parse HEAD` | `e5bc0053` (antes do primeiro commit do 62-02) |
| `git status --porcelain` | limpo |
| `git diff --check` | limpo |
| `npx openspec validate --changes --strict` | `1 passed, 0 failed` |

## Timestamp e unicidade da migration

| Item | Valor |
|---|---|
| Timestamp UTC real | `2026-11-23T13:02:52Z` → `20261123130252` |
| Arquivo | `supabase/migrations/20261123130252_campaign_format_addition.sql` |
| Worktree | nenhum outro prefixo `20261123130252` |
| `main` / `origin/main` | nenhum prefixo `20261123130252` |
| `feature/fase-44-temas-de-campanha-v2` / `origin/...` | nenhum prefixo `20261123130252` |
| Duplicidade global no diretório | nenhuma (agrupamento por prefixo retornou vazio) |

## Commits

| Commit | Conteúdo |
|---|---|
| `958bbe6a` | feat: migration autorada (tabela, constraints, RLS/grants, ponte, RPCs, filtro primário, seed da flag) + 3 suítes estáticas |
| `3944c77a` | feat: flag dedicada no serviço e no painel existente + testes |
| `202b22f4` | fix: reconciliação idempotente da entrega antes de revalidar o arte vertical |
| `213e9df6` | fix: fonte corrente/proveniência na abertura + path/bucket/procedência na entrega + REVERT não destrutivo |
| `2a882476` | docs: reconciliação da seleção configurada em campanha legada |

## Correções dirigidas da revisão (2026-11-23)

1. **Abertura:** lê `campaigns.storage_path` sob trava e compara origem/path/checksum/dimensão/MIME da ponte com a fonte corrente; no fluxo novo exige path canônico da operação-fonte; no legado exige path histórico. Novos motivos: `source_path_missing`, `source_operation_artifact_mismatch`, `source_path_mismatch`, `source_provenance_mismatch`.
2. **Entrega:** valida bucket/path canônicos do vertical e do `square_prepared`, origem `ai_expansion`/`deterministic_preparation`, derivação e proveniência allowlistada antes de mark/deliver; falha não consome crédito e a reconciliação de crédito já `delivered` é preservada.
3. **REVERT:** rollback operacional por flag, sem apagar vínculos/créditos/artefatos; reversão estrutural é procedimento separado com pré-condições e não contém `DROP TABLE` nesta migration.

## Gates dirigidos

| Gate | Comando | Resultado real |
|---|---|---|
| Migration | `npx vitest run src/lib/campaign/format-addition/__tests__/migration.contract.test.ts` | **18/18 PASS** |
| RPCs | `npx vitest run src/lib/campaign/format-addition/__tests__/rpc-contracts.test.ts` | **29/29 PASS** |
| Filtro primário | `npx vitest run src/lib/campaign/format-addition/__tests__/primary-operation-filter.contract.test.ts` | **5/5 PASS** |
| Combinado | os três arquivos | **3 arquivos / 52 testes PASS** |
| Flag + painel | `npx vitest run src/lib/feature-flags/__tests__/feature-flag-service.test.ts "src/app/(app)/admin/feature-flags/__tests__/page.test.tsx"` | **2 arquivos / 37 testes PASS** |
| Cinco arquivos da revisão | os cinco arquivos | **5 arquivos / 89 testes PASS** |
| Typecheck | `npm.cmd run typecheck` | exit **0** |
| Lint | `npm.cmd run lint` | exit **0** (limitação preexistente: não cobre TypeScript) |
| Build | `npm.cmd run build` | exit **0**; `102/102` páginas; shared `102 kB` |
| Suíte global local | `npm.cmd test -- --reporter=dot` | exit **0**; **848 arquivos PASS + 2 skipped (850)**; **10.585 testes PASS + 10 skipped (10.595)**; 98,44 s |
| OpenSpec | `npx openspec validate --changes --strict` | **1 passed, 0 failed** |
| Diff-check | `git diff --check` | limpo |

### Observação real sobre a primeira execução global

A primeira execução da suíte global (antes dos commits obrigatórios) acusou **3 falhas em 2 suítes de fronteira** (`square-base/boundaries.contract.test.ts` e `product-two-format/orchestration/joint-boundaries.contract.test.ts`). As falhas eram causadas apenas pelo **working tree sujo com a migration e o painel autorizados** (`git status`), não por regressão funcional. Nenhum guard foi alterado. Após os commits obrigatórios, as duas suítes passaram (**13/13**) e a suíte global passou integralmente na reexecução.

## Gates NÃO executados (por escopo)

PostgreSQL/homolog, PostgreSQL/local, f50-4, app-env, Produto 1:1, F60 e F60.1 **não foram executados**. Não houve conexão de banco, `psql`, Docker, Supabase CLI, Storage ou provider. Portanto:

- sintaxe SQL, constraints, FKs, índices e RLS **não foram provados em PostgreSQL real**;
- atomicidade, locks, deadlocks, isolamento e concorrência **não foram provados**;
- a migration **não foi aplicada** em nenhum ambiente;
- nenhuma flag foi alterada em ambiente (apenas serviço/painel e seed autorado).
