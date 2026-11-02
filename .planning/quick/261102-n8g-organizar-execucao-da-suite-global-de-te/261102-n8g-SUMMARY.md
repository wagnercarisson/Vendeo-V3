---
quick_id: 261102-n8g
phase: quick
date: 2026-11-02
status: complete
commits:
  - 7402417a
  - 5dfe6f15
  - cf5b1af2
files_created:
  - scripts/testing/test-categories.json
  - scripts/testing/test-status.mjs
  - scripts/testing/run-local-suite.mjs
  - scripts/testing/run-node-tests.mjs
  - scripts/testing/run-integration.mjs
  - vitest.shared.ts
  - vitest.integration-postgres.config.ts
  - vitest.integration-product-1-1.config.ts
  - docs/testes/execucao-da-suite.md
files_modified:
  - vitest.config.ts
  - package.json
  - README.md
---

# Quick 261102-n8g — Organizar a execução da suíte global de testes

Separação da suíte em 4 categorias executáveis e verificáveis, com inventário único como fonte da verdade, runners Node sem `npx`/`npm` e documentação operacional. Nenhum teste existente, código funcional, dependência, migration ou banco foi alterado.

## Mudanças

- `scripts/testing/test-categories.json`: inventário canônico com 31 caminhos únicos (6 `nodeTest`, 10 `integration.postgres`, 15 `integration.product-1-1`), ordenados.
- `vitest.shared.ts`: centraliza `loadTestCategories()`, `baseVitestConfig()`, `localExcludePatterns()` e resolução de `server-only`.
- `vitest.config.ts`: suíte local derivada do helper, excluindo exatamente os 31 arquivos do inventário.
- `vitest.integration-postgres.config.ts` / `vitest.integration-product-1-1.config.ts`: `test.include` a partir do inventário, `testTimeout: 120000`, `hookTimeout: 60000`.
- `scripts/testing/test-status.mjs`: valida unicidade, existência, `node:test` isolado em `nodeTest`, cobertura de integração por heurística explícita; imprime tabela e prontidão dos gates.
- `scripts/testing/run-local-suite.mjs`, `run-node-tests.mjs`, `run-integration.mjs`: runners via `process.execPath` + `node_modules/vitest/vitest.mjs`; integração sai 2 sem ambiente e nunca imprime segredos.
- `package.json`: novos scripts `test`, `test:scripts`, `test:integration:postgres`, `test:integration:product-1-1`, `test:gates`; `test:watch` mantido; dependências intactas.
- `docs/testes/execucao-da-suite.md`: comandos, mapa das 4 categorias, pré-requisitos, regra de gate, runners existentes, limitações e baseline.
- `README.md`: seção `# Test:` aponta ao novo guia e a `npm.cmd`.

## Comandos executados e resultados

| Comando | Resultado |
| --- | --- |
| `node -e "…inventário…"` | 31 arquivos únicos e existentes |
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd run test:gates` | exit 0; mapa válido; 598 local / 6 scripts / 10 postgres / 15 product-1-1 |
| `npm.cmd run test:scripts` | exit 0; 73/73 passed |
| `npm.cmd test` | exit 1 (falhas conhecidas); ver contagem abaixo |
| `node scripts/testing/run-integration.mjs postgres` | exit 2 + `GATE NÃO EXECUTADO — NÃO APROVADO`, sem valores |
| `node scripts/testing/run-integration.mjs product-1-1` | exit 2 + `GATE NÃO EXECUTADO — NÃO APROVADO`, sem valores |
| `node scripts/testing/run-integration.mjs nope` | exit 3 (categoria inválida) |
| `git diff --check` | exit 0 |
| `git status --short` | apenas arquivos das 3 tasks (+ artefatos de planejamento) |

### Verificação da partição

```
repoTestFiles=629 inventoried=31 local=598 sum=629
valid=true
LOCAL OK src/components/landing/__tests__/access-request-section.integration.test.tsx
LOCAL OK src/lib/legal/__tests__/integration.test.ts
LOCAL OK src/__tests__/api/freemium-integration.test.ts
LOCAL OK src/app/api/campaign/generate-image/__tests__/route.integration.test.ts
```

## Contagem final da suíte local (`npm.cmd test`)

Execução de confirmação do orquestrador (a execução do executor, minutos antes, teve 1 falha instável adicional em `store-identity-form.direction-pending`; ela passou nesta repetição e em isolamento):

```
Test Files  4 failed | 592 passed | 2 skipped (598)
Tests       6 failed | 7501 passed | 10 skipped (7517)
Duration    93.18s
```

Confirmações exigidas:

- **(a)** Nenhum dos 4 arquivos `node:test` (`scripts/f56-2e/__tests__/hosted-proofs.test.mjs`, `scripts/f56-2b2d/__tests__/release-gate.test.mjs`, `scripts/f57-2/__tests__/comparative-proof.test.mjs`, `scripts/f57-2/__tests__/orchestrator.ps1.test.mjs`) aparece na lista de FAIL — nem os demais `node:test`.
- **(b)** Nenhuma suíte de integração (`*.postgres.test.ts`, `product-1-1/**/*.integration.test.ts`, `tests/integration/product-1-1-credit-transaction.test.ts`, `image-generation-operations-repository.integration.test.ts`, `operation-cost-service.integration.test.ts`) aparece na lista de FAIL.

## Falhas remanescentes (nomeadas e atribuídas)

| Arquivo | Falha | Atribuição |
| --- | --- | --- |
| `src/__tests__/api/store-ownership-api.test.ts` | `ignores user_id in body … draft mode` (esperava `create_store_draft`, recebeu `record_onboarding_completion`) | quick futura de store-ownership draft |
| `src/lib/ai-cost/__tests__/openai-pricing-migration.contract.test.ts` | contrato SQL CRLF/LF (`MIGRATION` não contém `NULL … RETURNING id INTO`) | quick futura de contrato CRLF/LF |
| `src/lib/brand-assets/__tests__/text-only-inference-service.test.ts` | mojibake (`mock â€” desenvolvimento`) | quick futura de mojibake |
| `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` (3 testes) | caminhos/conteúdos de fronteira não autorizados | quick futura de `legacy-frontier.guard` |

Observação: uma execução intermediária do executor registrou também 1 falha instável em `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx`; a repetição de confirmação e a execução isolada passaram. Não é atribuída a esta quick.

Nenhuma dessas falhas é de coleta `node:test` nem de integração. O total de testes executados subiu para 7517 e os 31 arquivos separados deixaram a suíte local em 598 arquivos.

## Gates de integração não executados

- **PostgreSQL/homolog:** `TEST_DATABASE_URL` ausente → gate não executado (exit 2). `F50_4_RUN_CONCURRENCY`/`F50_4_DB_URL` também ausentes → `f50-4-concurrency` SKIPADO — NÃO APROVADO.
- **Produto 1:1:** trio `F562A_ISOLATED_*` ausente → gate não executado (exit 2).
- Nenhum banco foi provisionado, criado ou alterado; nenhum valor de segredo foi impresso.
- Runners PowerShell de provisionamento e `scripts/f50-4/run-sql-tests.mjs` não foram executados.

## Limitações

- Produto 1:1 continua sem runner dedicado em `package.json` para provisionar a instância isolada; assume ambiente já existente.
- `operation-cost-service.integration.test.ts` lê `.env.local` e exige Supabase/DB real.
- `npm` puro no PowerShell pode resolver para o shim de `System32`; usar `npm.cmd`.
- O baseline do plano (7501 passed / 13 failed / 32 arquivos) é fotográfico; a execução local final registrou 7501 passed / 6 failed / 4 arquivos — exatamente as falhas conhecidas reservadas.
