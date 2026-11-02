# Execução da suíte de testes

Fonte única da partição: `scripts/testing/test-categories.json`. As suítes são separadas por categoria e por perfil de ambiente, com pré-requisitos validados antes de qualquer execução.

## Comandos

```powershell
npm.cmd test
npm.cmd test -- src/lib/legal/__tests__/integration.test.ts --reporter=dot
npm.cmd run test:watch
npm.cmd run test:scripts

npm.cmd run test:integration:postgres                 # status/recusa: não executa nada
npm.cmd run test:integration:postgres:homolog
npm.cmd run test:integration:postgres:local
npm.cmd run test:integration:postgres:f50-4
npm.cmd run test:integration:app-env
npm.cmd run test:integration:product-1-1

npm.cmd run test:gates
```

No PowerShell, `npm` pode resolver para o shim de `C:\Windows\System32\npm`, que não executa corretamente. Use sempre `npm.cmd` e não altere o `PATH`.

`npm.cmd test` repassa os argumentos recebidos ao Vitest (arquivo específico, `--reporter`, `-t`, etc.).

## Mapa das categorias

| Categoria | Runner | Arquivos | Pré-requisito |
| --- | --- | --- | --- |
| local (Vitest) | `npm.cmd test` | todos os testes restantes (598) | nenhum |
| scripts (`node:test`) | `npm.cmd run test:scripts` | 6 | nenhum |
| PostgreSQL/homolog (F57.2) | `npm.cmd run test:integration:postgres:homolog` | 3 | alvo exato + fingerprint do ledger |
| PostgreSQL/local-disposable | `npm.cmd run test:integration:postgres:local` | 5 | `TEST_DATABASE_URL` loopback + opt-in de escrita |
| PostgreSQL/f50-4 | `npm.cmd run test:integration:postgres:f50-4` | 1 | opt-in + alvo descartável dedicado |
| app-env (`.env.local`) | `npm.cmd run test:integration:app-env` | 1 | alvo efetivo do `.env.local` validado |
| Produto 1:1 isolado | `npm.cmd run test:integration:product-1-1` | 15 | trio `F562A_ISOLATED_*` |

Os runners novos chamam `process.execPath` + `node_modules/vitest/vitest.mjs`; nunca usam `npx` nem `npm` internamente.

## Pré-requisitos por perfil

### PostgreSQL/homolog (F57.2)

- `TEST_DATABASE_URL` exatamente `postgresql://...@127.0.0.1:57782/postgres`.
- `F57_2_EXPECTED_LEDGER_COUNT` inteiro `>= 149`.
- `F57_2_EXPECTED_LEDGER_SHA256` com 64 caracteres hexadecimais.
- `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_URL` ausentes.
- As suítes criam fixtures com prefixo `f572test-` e fazem cleanup; não são read-only.

### PostgreSQL/local-disposable

- `TEST_DATABASE_URL` PostgreSQL em `127.0.0.1`/`localhost`.
- `POSTGRES_LOCAL_ALLOW_WRITES=1` como opt-in explícito: as suítes gravam, apagam e limpam fixtures, algumas com `session_replication_role=replica`.
- O perfil recusa o alvo do homolog na porta `57782/postgres` por qualquer alias loopback equivalente (`127.0.0.1`, `localhost`, `::1`).

### PostgreSQL/f50-4

- `F50_4_RUN_CONCURRENCY=1`.
- `F50_4_DB_URL` PostgreSQL loopback em `F50_4_DB_PORT` (padrão `54422`), caminho `/postgres`.
- A suíte exige a sentinela `public.f50_4_harness_identity` com `purpose='disposable'` e usa `session_replication_role=replica` no cleanup.

### app-env (`.env.local`)

- A suíte relê `.env.local` e sobrescreve `process.env`; por isso o preflight valida o **alvo efetivo**, não `TEST_DATABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_URL` efetiva (arquivo tem precedência) deve ser HTTP(S) loopback, nunca `*.supabase.co/in/com`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` efetivas precisam existir.
- A suíte atual (`operation-cost-service.integration.test.ts`) consulta `credit_operation_costs`; ainda assim, execute-a isoladamente.

### Produto 1:1 isolado

- `F562A_ISOLATED_SUPABASE_URL` exatamente `http://127.0.0.1:56321`.
- `F562A_ISOLATED_SERVICE_ROLE_KEY` não vazio.
- `F562A_ISOLATED_DATABASE_URL` PostgreSQL loopback na porta `56322`.
- Se `P1_1_ISOLATED_*` estiver totalmente ausente, o runner deriva os aliases a partir de `F562A_ISOLATED_*` (mesma instância isolada). Se estiver parcial ou divergente, aborta sem executar.

## Regra de gate

**GATE NÃO EXECUTADO ≠ APROVADO.** Exit 2 nos comandos de integração significa ausência ou invalidez de ambiente, não falha de teste e nem aprovação parcial. `npm.cmd run test:integration:postgres` sem perfil apenas mostra a prontidão dos três perfis PostgreSQL e sai 2; ele não executa nenhum deles.

O preflight nunca lança exceção por URL malformada: retorna status inválido, e o runner sai 2 sem imprimir a URL.

## Efeitos e runners existentes

Nenhum comando provisiona ou cria ambiente. As suítes de integração **alteram dados** no alvo validado: inserem, atualizam e removem fixtures, e algumas usam `session_replication_role=replica`. Não aponte um perfil para ambiente compartilhado sem autorização explícita.

Estes scripts existentes **não** são chamados pelos comandos acima e alguns aplicam migrations/criam ambiente:

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

- Os perfis PostgreSQL assumem ambiente já existente; não há provisionamento embutido.
- `operation-cost-service.integration.test.ts` depende de `.env.local`; por isso tem perfil próprio e validação do alvo efetivo.
- O perfil local-disposable exige opt-in de escrita e recusa o alvo do homolog.
- O shim `C:\Windows\System32\npm` não executa; use `npm.cmd`.

## Baseline 2026-11-02

Fotografia via `npm.cmd`: 7501 passed / 13 failed / 161 skipped / 627 arquivos, 32 arquivos em falha.

Falhas conhecidas reservadas para quicks futuras: store-ownership draft, contrato SQL CRLF/LF (`openai-pricing-migration.contract`), mojibake fallback (`text-only-inference-service`) e `legacy-frontier.guard`. Após esta quick, `npm.cmd test` continua não-verde por essas falhas, mas sem os erros de coleta `node:test` e sem falhas de integração.

## Como adicionar testes

1. Coloque o teste na categoria local por padrão.
2. Se exigir ambiente externo, escolha o perfil correto em `scripts/testing/test-categories.json` e use a config dedicada.
3. Se o teste reler `.env.local` ou outro arquivo, valide o alvo efetivo no preflight — nunca apenas a variável de processo.
4. Nunca esconda um teste com glob amplo de exclusão.
