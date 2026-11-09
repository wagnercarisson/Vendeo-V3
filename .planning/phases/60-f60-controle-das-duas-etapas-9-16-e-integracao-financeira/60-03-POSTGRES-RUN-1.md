# 60-03 — Execução Postgres autorizada (RUN 1)

**Autorização:** concedida explicitamente pelo solicitante na sessão de revisão do 60-03.
**Ambiente:** homolog `vendeo-homolog`, fora de produção.
**Alvo executado:** `127.0.0.1:57782/postgres` (loopback; preflight compartilhado F60).
**Escopo:** as quatro suítes do perfil `integration.f60`, somente testes e conferências read-only antes/depois.
**Fora do escopo:** alterar código, aplicar migrations, iniciar 60-04, deploy, push, produção.

## Janela de exclusividade registrada ANTES da conexão

| Campo | Valor |
|---|---|
| Início (UTC) | `2026-11-09T20:30:00Z` |
| Fim (UTC) | `2026-11-09T21:30:00Z` |
| Duração | 1 hora |
| Responsável | solicitante da autorização 60-03 |
| Operador | agente OpenCode |
| Concorrência | `pg_stat_activity`: 0 outras sessões ativas (`state <> 'idle'`) imediatamente antes da execução; 11 sessões ociosas, sem uso concorrente observável das RPCs compartilhadas |

## Execução

| Campo | Valor |
|---|---|
| Início real (UTC) | `2026-11-09T20:30:14Z` |
| Fim real (UTC) | `2026-11-09T20:30:15Z` |
| Comando | `node scripts/testing/run-integration.mjs f60` |
| Exit code | **1** |
| Resultado | **NÃO APROVADO** — 2 falhas em 26 testes |
| Log | `C:\Users\wagne\AppData\Local\Temp\opencode\f60-run1.log` |

## Resultados individuais

| Suíte | Testes | Resultado |
|---|---|---|
| `two-stage-control.postgres.test.ts` (60-02) | **8/8** | **PASS** |
| `origin-views.postgres.test.ts` | **2/2** | **PASS** |
| `financial-integration.integration.test.ts` | **7/8** | **FAIL** — “operação delivered recusa estorno” |
| `shared-reading-compatibility.integration.test.ts` | **7/8** | **FAIL** — “origem nova sem sonda vertical fica inconclusiva na listagem (nunca quadrada)” |
| **Total** | **24/26** | **FAIL** |

### Falha 1 — `financial-integration`

Mensagem: `current transaction is aborted, commands ignored until end of transaction block`.

O teste chama `refundOnDefinitiveFailure` sobre operação `delivered` e espera a recusa; a transação de teste fica abortada após o erro esperado da RPC e a conferência posterior de `credit_transactions` não pode executar. É um problema do harness transacional do teste, não uma persistência observada. Nenhum código foi alterado.

### Falha 2 — `shared-reading-compatibility`

Mensagem: `expected "vi.fn()" to not be called at all, but actually been called 1 times`.

A listagem `listPendingOperations()` é global por status e o homolog contém pendências legadas pré-existentes; a sonda quadrada foi chamada para uma linha legada da mesma listagem. A asserção “sonda quadrada nunca chamada” é ampla demais para alvo compartilhado. Nenhum código foi alterado.

## Conferências read-only ANTES

| Item | Valor |
|---|---|
| Banco / usuário | `postgres` / `postgres` |
| Endereço interno | `172.21.0.10:5432` (publicado em `127.0.0.1:57782`) |
| Ledger | **154** migrations; última `20261109174110` |
| Outras sessões ativas | **0** |
| Fixtures `p916test-*` | 18 users / 18 stores / 18 campaigns / 19 credit ops (pré-existentes) |
| Fixtures `p916fin-*` / `p916compat-*` | 0 / 0 |
| `credit_transactions` | 168 |
| `product_1_1_campaign_credit_operations` | 51 |
| `product_1_1_generation_attempt_claims` | 31 |
| `product_1_1_generation_outcomes` | 5 |
| `admin_audit_log` | 97 |
| `product_9_16_two_stage_operations` | 14 |
| Tabelas `product_9_16_%credit%` | **0** |

## Conferências read-only DEPOIS

| Item | Valor | Comparação |
|---|---|---|
| Ledger | **154**; última `20261109174110` | inalterado |
| Outras sessões ativas | **0** | sem uso concorrente |
| Fixtures `p916test-*` | 18 users / 18 stores / 18 campaigns / 19 credit ops | **inalterado** |
| Fixtures `p916fin-*` / `p916compat-*` | 0 / 0 | **nenhuma nova persistida** |
| `credit_transactions` | 168 | inalterado |
| `product_1_1_campaign_credit_operations` | 51 | inalterado |
| `product_1_1_generation_attempt_claims` | 31 | inalterado |
| `product_1_1_generation_outcomes` | 5 | inalterado |
| `admin_audit_log` | 97 | inalterado |
| `product_9_16_two_stage_operations` | 14 | inalterado |
| Tabelas `product_9_16_%credit%` | **0** | nenhum ledger paralelo |

## Evidência de rollback

- As contagens globais e os prefixos das fixtures permaneceram **idênticos** antes/depois.
- Nenhuma fixture `p916fin-*` ou `p916compat-*` sobreviveu.
- As 18 fixtures `p916test-*` já existiam antes da janela (criadas em `2026-11-09T18:29Z`, portanto de execuções anteriores) e permaneceram em 18 — não houve incremento.
- Nenhuma migration nova, nenhuma tabela contábil paralela e nenhuma alteração de schema.

**Ressalva:** o critério original “todas as fixtures p916 com n=0” não era atendido ANTES da execução por resíduos históricos `p916test-*`. O critério efetivo desta RUN 1 foi **não incremento** antes/depois, que foi comprovado. Os resíduos históricos não foram removidos (fora do escopo read-only).

## Parecer

**RUN 1 NÃO APROVADA.** Postgres permanece **não aprovado**. `60-04` continua **bloqueado**. Nenhuma correção de código foi aplicada nesta execução.
