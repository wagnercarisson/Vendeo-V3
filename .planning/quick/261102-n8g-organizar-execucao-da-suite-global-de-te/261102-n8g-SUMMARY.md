---
quick_id: 261102-n8g
phase: quick
date: 2026-11-02
status: complete
commits:
  - 7402417a
  - 5dfe6f15
  - cf5b1af2
  - 33cc455e
  - 461e186f
  - eae55fa4
  - 0df79724
  - 14757a35
  - 1e43fe07
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
| `npm.cmd run lint` | exit 0 (após remover 1 constante não usada em `test-status.mjs`) |
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

## Complemento corretivo pós-revisão (2026-11-02)

Três achados de revisão foram corrigidos; nenhuma integração foi executada contra banco real.

### 1. Perfis PostgreSQL separados e validados

O perfil único que aceitava qualquer URL loopback foi dividido em três:

- **`postgres-homolog`** (3 suítes F57.2): exige `TEST_DATABASE_URL` exatamente `127.0.0.1:57782/postgres`, `F57_2_EXPECTED_LEDGER_COUNT >= 149`, `F57_2_EXPECTED_LEDGER_SHA256` com 64 hex e ausência de `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_URL`.
- **`postgres-local`** (5 suítes antigas): exige `TEST_DATABASE_URL` loopback e `POSTGRES_LOCAL_ALLOW_WRITES=1`; recusa o alvo do homolog. Documentado que as suítes gravam/limpam fixtures, algumas com `session_replication_role=replica`.
- **`postgres-f50-4`** (1 suíte): exige `F50_4_RUN_CONCURRENCY=1`, `F50_4_DB_URL` loopback na porta `F50_4_DB_PORT` (padrão 54422) e caminho `/postgres`.

`npm.cmd run test:integration:postgres` passou a ser status/recusa: mostra a prontidão dos três perfis e sai 2 sem executar nada. Comandos explícitos: `:postgres:homolog`, `:postgres:local`, `:postgres:f50-4`.

### 2. `operation-cost-service` isolado em `app-env`

A suíte que relê `.env.local` saiu do conjunto PostgreSQL. O perfil `app-env` valida o alvo **efetivo** (arquivo e processo), exige URL loopback em `NEXT_PUBLIC_SUPABASE_URL` e as chaves `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, rejeitando `*.supabase.co/in/com`. O parser normaliza CRLF para validar o arquivo como ele é lido no repositório. Nenhum valor de segredo é impresso.

### 3. `npm test` encaminha argumentos

`run-local-suite.mjs` passou a repassar `process.argv.slice(2)` ao Vitest. Verificado com `npm.cmd test -- src/lib/legal/__tests__/integration.test.ts --reporter=dot`: apenas 1 arquivo / 5 testes executados.

### Verificação do complemento

| Comando | Resultado |
| --- | --- |
| `node scripts/testing/test-status.mjs` | exit 0; 7 categorias; app-env "ambiente presente — NÃO EXECUTADO" (loopback), demais gates não executados |
| `npm.cmd run test:scripts` | 73/73 |
| `npm.cmd test` | 7501 passed / 6 failed / 10 skipped / 598 arquivos (apenas falhas conhecidas) |
| `npm.cmd test -- <arquivo> --reporter=dot` | 1 arquivo / 5 testes; argumentos encaminhados |
| preflight matrix (homolog 54322, local sem opt-in, local no alvo homolog, f50-4 porta errada, app-env remoto, `.env.local` remoto com processo loopback) | todos bloqueados |
| `npm.cmd run test:integration:postgres` | exit 2, status/recusa, nada executado |
| `node scripts/testing/run-integration.mjs nope` | exit 3 |
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd run lint` | exit 0 |
| `git diff --check` | exit 0 |

Nenhum banco foi provisionado ou alterado; nenhum perfil de integração foi executado.

### Segundo complemento corretivo (revisão final)

Dois achados adicionais foram corrigidos:

1. **Recusa do homolog por aliases loopback.** `postgres-local` agora bloqueia `57782/postgres` quando o host é `127.0.0.1`, `localhost` ou `[::1]`/`::1`. Verificado por matriz: os três alvos retornam `ready=false`.
2. **URL malformada do Produto 1:1 sem exceção.** `product11GateStatus` passou a usar `parsePostgresUrl` com retorno `null`; `F562A_ISOLATED_DATABASE_URL='postgresql://['` retorna status inválido, o runner sai 2 e não imprime a URL. Verificado também que `npm.cmd test` continua iniciando normalmente com essa variável malformada.

Gates do segundo complemento: `node --check` exit 0, `test:gates` exit 0, `lint` exit 0, `git diff --check` limpo; nenhum banco ou integração executado.

## Limitações

- Produto 1:1 continua sem runner dedicado em `package.json` para provisionar a instância isolada; assume ambiente já existente.
- `operation-cost-service.integration.test.ts` lê `.env.local` e exige Supabase/DB real.
- `npm` puro no PowerShell pode resolver para o shim de `System32`; usar `npm.cmd`.
- O baseline do plano (7501 passed / 13 failed / 32 arquivos) é fotográfico; a execução local final registrou 7501 passed / 6 failed / 4 arquivos — exatamente as falhas conhecidas reservadas.
