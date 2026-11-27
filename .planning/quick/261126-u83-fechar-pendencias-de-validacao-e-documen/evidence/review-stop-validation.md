# Quick 261126-u83 — validação do Review Stop

**Data:** 2026-11-26/27
**HEAD de partida:** `4152777f`
**Banco:** nenhuma escrita nesta etapa; somente leitura no homolog.

## 1. Guarda reconciliado

`src/lib/campaign/square-base/__tests__/regression.contract.test.ts`

- `PHASE_BASE_SHA` mantido (`55276323…`).
- `PROTECTED_PATHS` mantido integralmente.
- Exceção única: `src/lib/product-1-1/orchestration/generation-orchestrator.ts`,
  aceita somente se o conteúdo do worktree for idêntico ao commit imutável
  `346d16d5536f9fbae7abba2bf1d99bda9539c5a5`.
- Referência de aprovação: o commit imutável, **não** `HEAD`.
- Testes negativos: conteúdo diferente no arquivo autorizado, outro caminho protegido e caminho
  apenas parecido são rejeitados.

Execução focada: **13/13 PASS** (`vitest run regression.contract.test.ts`).

## 2. Lint TypeScript delimitado

Config: `eslint.diagnostic.config.mjs` (sem parser novo, sem dependência nova).
Comando reproduzível: `npm run lint:f63` ou
`node scripts/f63/validate-ts-lint.mjs --out <json>`.

Flags equivalentes: `--config eslint.diagnostic.config.mjs --no-inline-config --max-warnings 0`.

**9/9 arquivos PASS:** não ignorados, parser `typescript-eslint/parser`,
`@typescript-eslint/no-unused-vars` ativo, 0 erros, 0 warnings, 0 suprimidos.

Evidência: `evidence/ts-lint.json`.

## 3. Gates executados

| Gate | Resultado |
|---|---|
| `npm run lint` (oficial, JS/MJS) | exit 0 |
| `npm run lint:f63` (TS delimitado) | 9/9 PASS |
| `npm run typecheck` | exit 0 |
| `npm run test:scripts` | 119/119 PASS |
| `npm run test:lint-config` | 11/11 PASS |
| `npm run test:gates` | exit 0 (gates de ambiente não executados) |
| `git diff --check` | exit 0 |
| `vitest regression.contract` | 13/13 PASS |
| `npm test` | **exit 1** — 874 arquivos PASS, 2 FAIL, 2 skipped; 10.950 testes PASS, 2 FAIL, 10 skipped |

### Falhas atuais do `npm test` (transitórias, dependem do commit)

As duas falhas são exclusivamente a migration D **não rastreada**:

- `boundaries.contract.test.ts` — `?? supabase/migrations/20261127004704_f63_trial_offer_versions_guard_comment.sql`
- `joint-boundaries.contract.test.ts` — mesma causa

A falha original do `regression.contract.test.ts` **não ocorre mais**. Após o commit da migration D,
os dois guardas de fronteira devem voltar a passar e o `npm test` será reexecutado no HEAD final.

## 4. Migration D

- Arquivo: `supabase/migrations/20261127004704_f63_trial_offer_versions_guard_comment.sql`
- SHA-256: `ec12d10f7d4742d0f59608b5b408e5ba9bc0cfe47c0e81e74a48a311d6c5b833`
- Uma única instrução executável: `COMMENT ON FUNCTION public.trial_offer_versions_guard()`.
- Texto do comentário comparado ao constante do relatório: idêntico (458 caracteres).
- Timestamp UTC `20261127004704` sem colisão na worktree, `HEAD`, `main`, `origin/main`,
  feature paralela conhecida e backup.

Hashes A/B/C conferidos e inalterados:

| Migration | SHA-256 |
|---|---|
| A `20261126223854` | `ed652a26…` |
| B `20261126230735` | `e511295e…` |
| C `20261126231022` | `817cbd8a…` |

## 5. Preflight read-only do homolog

- Container `supabase_db_vendeo-homolog`, `127.0.0.1:57782/postgres`, PostgreSQL 17.6.
- Ledger: **161**, max `20261126231022`, SHA-256 `d95abc29…`; D ausente.
- Comentário atual: texto antigo da Migration A.
- Definição do guard: MD5 `b34efa4421273ae70338ebdd4c2c6544`.
- Preservadas: 1 / 41 / 265 / 1, com os MD5 do baseline.
- `current_version_id` = v1, `NOT NULL`.
- 16 versões publicadas (v1 + 15 fixtures inertes), 0 rascunhos, 0 referenciadas.

Evidência: `evidence/pre-d-preflight.json`.

## 6. Dry-run da aplicação

- `--stage post-d --dry-run` exit 0.
- Versão ausente do ledger; wrapper `BEGIN; SET LOCAL …; <migration>; INSERT ledger; COMMIT;`.
- Nenhum `docker cp`/`psql -f` executado.

## 7. Pendente de aprovação

- Aplicar D no homolog e capturar `post-d`.
- Commitar os arquivos desta quick.
- Reexecutar guardas de fronteira e `npm test` no HEAD final.
