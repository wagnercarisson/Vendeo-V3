# Execução da suíte de testes

Fonte única da partição: `scripts/testing/test-categories.json`. Quatro categorias executáveis e verificáveis.

## Comandos

```powershell
npm.cmd test
npm.cmd run test:watch
npm.cmd run test:scripts
npm.cmd run test:integration:postgres
npm.cmd run test:integration:product-1-1
npm.cmd run test:gates
```

No PowerShell, `npm` pode resolver para o shim de `C:\Windows\System32\npm`, que não executa corretamente. Use sempre `npm.cmd` e não altere o `PATH`.

## Mapa das 4 categorias

| Categoria | Runner | Arquivos | Pré-requisito |
| --- | --- | --- | --- |
| local (Vitest) | `npm.cmd test` | todos os testes restantes (~598) | nenhum |
| scripts (`node:test`) | `npm.cmd run test:scripts` | 6 | nenhum |
| integração PostgreSQL/homolog | `npm.cmd run test:integration:postgres` | 10 | `TEST_DATABASE_URL` |
| integração isolada Produto 1:1 | `npm.cmd run test:integration:product-1-1` | 15 | trio `F562A_ISOLATED_*` |

Os runners novos chamam `process.execPath` + `node_modules/vitest/vitest.mjs`; nunca usam `npx` nem `npm` internamente.

## Pré-requisitos

- **PostgreSQL/homolog:** `TEST_DATABASE_URL` com esquema `postgresql://` e host `127.0.0.1` ou `localhost`.
- **Condicional f50-4-concurrency:** `F50_4_RUN_CONCURRENCY` e `F50_4_DB_URL`. Ausentes → gate condicional SKIPADO — NÃO APROVADO.
- **Produto 1:1:** `F562A_ISOLATED_SUPABASE_URL` exatamente `http://127.0.0.1:56321`, `F562A_ISOLATED_SERVICE_ROLE_KEY` não vazio e `F562A_ISOLATED_DATABASE_URL` Postgres loopback na porta 56322.
- **Aliases Produto 1:1:** se `P1_1_ISOLATED_*` estiver totalmente ausente, o runner deriva os aliases a partir de `F562A_ISOLATED_*` (mesma instância isolada). Se estiver parcial ou divergente, aborta sem executar.

Nenhum comando provisiona, cria ou altera banco. Nenhum valor de segredo é impresso — apenas nomes de variáveis.

## Regra de gate

**GATE NÃO EXECUTADO ≠ APROVADO.** Exit 2 nos comandos de integração significa ausência ou invalidez de ambiente, não falha de teste. `npm.cmd run test:gates` mostra a prontidão de cada gate sem executá-lo.

## Runners existentes

Estes scripts **não** são chamados pelos comandos acima e alguns aplicam migrations/criam ambiente:

- `scripts/run-f56-2a-isolated-integration.ps1`
- `scripts/run-f56-2b1b-isolated-integration.ps1`
- `scripts/run-f56-2b2a-isolated-integration.ps1`
- `scripts/run-f56-2b2a-f562b-proof.ps1`
- `scripts/run-f56-2b2b-isolated-integration.ps1`
- `scripts/f56-2e/run-local-activation-proofs.ps1`
- `scripts/f57-2/run-f57-2-proofs.ps1` (use `-Action status` apenas para leitura)
- `scripts/f50-4/run-sql-tests.mjs`

Não execute esses runners sem autorização explícita.

## Limitações conhecidas

- Produto 1:1 ainda não tem runner dedicado em `package.json` para provisionar a instância isolada; os comandos assumem ambiente já existente.
- `src/lib/credit/__tests__/operation-cost-service.integration.test.ts` lê `.env.local` e exige Supabase/DB real.
- `f50-4-concurrency` auto-skip sem `F50_4_RUN_CONCURRENCY` e `F50_4_DB_URL`.
- O shim `C:\Windows\System32\npm` não executa; use `npm.cmd`.

## Baseline 2026-11-02

Fotografia via `npm.cmd`: 7501 passed / 13 failed / 161 skipped / 627 arquivos, 32 arquivos em falha.

Falhas conhecidas reservadas para quicks futuras: store-ownership draft, contrato SQL CRLF/LF (`openai-pricing-migration.contract`), mojibake fallback (`text-only-inference-service`) e `legacy-frontier.guard`. Após esta quick, `npm.cmd test` continua não-verde por essas falhas, mas sem os erros de coleta `node:test` e sem falhas de integração.

## Como adicionar testes

1. Coloque o teste na categoria local por padrão.
2. Se exigir ambiente externo, liste o arquivo em `scripts/testing/test-categories.json` e use a config/runner correspondente.
3. Nunca esconda um teste com glob amplo de exclusão.
