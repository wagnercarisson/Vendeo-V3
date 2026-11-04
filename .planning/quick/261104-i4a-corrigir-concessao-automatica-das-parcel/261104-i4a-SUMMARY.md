---
quick_id: 261104-i4a
slug: corrigir-concessao-automatica-das-parcelas-do-teste-gratuito-28-dias-f50-2
status: complete
mode: implementation
type: quick
date: 2026-11-04
branch: feat/ajuste-concessao-creditos-oferta
base_commit: c0fa5c36
head_commit: 698af979
scope: local-only
production_activation: separate-step
tags: [cron, middleware, credits, trial-offer, testing, integration]
key-files:
  created:
    - src/lib/credit/__tests__/trial-offer-installments.integration.test.ts
  modified:
    - src/middleware.ts
    - src/app/api/cron/demo-credits/route.ts
    - src/app/api/cron/demo-credits/__tests__/route.test.ts
    - scripts/testing/test-categories.json
decisions:
  - Exact-path cron passthrough in middleware; CRON_SECRET remains the authorization gate.
  - Stable error codes with numeric aggregates only; no database messages in responses.
  - Reconciliation always runs before a non-2xx status is returned.
  - Behavioural route tests import the real middleware rather than copying it; static contract assertions preserved in the same file.
metrics:
  tasks_completed: 3
  tasks_total: 3
  commits: 3
  duration: "~25 min"
  completed: 2026-11-04
---

# Quick 261104-i4a — Concessão automática das parcelas do teste gratuito (F50.2)

One-liner: **libera o cron diário de demo-credits no middleware, devolve status não-2xx com códigos estáveis quando o RPC de parcelas falha, e prova recuperação tardia/idempotência em teste opt-in de banco descartável.**

## O que foi entregue

| Item | Entrega | Commit |
|---|---|---|
| A | Rota exata `"/api/cron/demo-credits"` adicionada ao `API_PASSTHROUGH` do `src/middleware.ts`, com o mesmo comentário das vizinhas. Sem glob/prefixo; `matcher` e `CRON_SECRET` intactos. | `efb95d94` |
| B | `route.ts`: `cron_secret_not_configured` (500), `balance_query_failed` (500, sem `balanceError.message`), e 500 estável (`trial_offer_processing_failed` / `trial_offer_processing_errors`) **após** toda a reconciliação. `trialOffer` sempre numérico. | `efb95d94` |
| C | Teste comportamental da rota importando o `middleware` **real** de `@/middleware`; casos de scheduler sem sessão, bearer ausente/inválido, secret ausente, erro do RPC, `errors > 0`, sucesso e rota vizinha 401. Contrato estático (Bearer, `materialize_demo_expiration`, dedup por `tx.id`, `demo_expiring_24h`, agendamento no `vercel.json`) preservado no mesmo arquivo. | `836885dc` |
| D | Teste de integração opt-in (`F50_4_RUN_CONCURRENCY=1`) em PostgreSQL descartável: recuperação de seq 1/2/3 em execução no dia 21 (total 20, 4 transações demo, expiração única) e idempotência real na repetição. Registrado apenas em `integration.postgres-f50-4`. | `698af979` |
| E | Validação local focada, typecheck, lint e build (evidência abaixo). | — |

## Detalhes de implementação

### Middleware (`src/middleware.ts`)

```ts
const API_PASSTHROUGH = new Set([
  "/api/cron/monthly-credits",
  // A rota valida CRON_SECRET; agendamentos não possuem sessão de usuário.
  "/api/cron/demo-credits",
  // A rota valida CRON_SECRET; agendamentos não possuem sessão de usuário.
  "/api/cron/sync-openai-pricing",
  "/api/legal/current-versions",
]);
```

O passthrough libera apenas a sessão; a autorização continua sendo `Authorization: Bearer CRON_SECRET` dentro do handler (T-i4a-01).

### Rota (`src/app/api/cron/demo-credits/route.ts`)

- Ordem preservada: RPC `process_trial_offer_installments` → consulta de saldos → materialização de expiração → reparo de notificações/eventos → `demo_expiring_24h` → dreno de e-mails.
- `processingFailed = Boolean(trialOfferError)` e `processingErrors = trialOffer.errors > 0`.
- Em falha: `{ ok: false, error, materialized, repaired, emails, trialOffer: { granted, skipped, errors } }` com status 500. Nenhuma mensagem de banco/stack é serializada (T-i4a-02).
- Sucesso: 200 `{ ok: true, materialized, repaired, emails, trialOffer }`, com `trialOfferData` ausente normalizado para `{ granted: 0, skipped: 0, errors: 0 }`.

### Teste comportamental

- `vi.hoisted` + `vi.mock` para `@/lib/supabase/middleware`, `@/lib/supabase/server`, `@/lib/notifications/outbox`, `@/lib/email/resend`, `@/lib/product-events/service`.
- Cadeias de `credit_balances` (`select().gt()`) e `credit_transactions` (`select().in().order().limit()`) com dados vazios por padrão; `claimEmailNotification` resolve `null`.
- O `middleware` real é importado de `@/middleware`; não há cópia/reimplementação no teste.
- Asserção extra de que a reconciliação continua rodando mesmo com o RPC falhando (`mockFrom` chamado para `credit_balances` e `credit_transactions`, `claimEmailNotification` chamado).

### Teste de integração

- Fail-closed: `F50_4_DB_URL`/`TEST_DATABASE_URL`, host `127.0.0.1|localhost`, porta `F50_4_DB_PORT` (default `54422`), database `/postgres`; recusa qualquer outro alvo antes de conectar.
- `beforeAll` exige `public.f50_4_harness_identity` com `purpose='disposable'`.
- Fixture: `auth.users` + `stores` (CNPJ 14 chars, `cnpj_root_hash` único, `onboarding_completed_at` = início do enrollment, usuário criado após `launch_at`).
- Semeia com `start_trial_offer_enrollment(store_id, started_at)` (dia 0 → 5 créditos) e executa `process_trial_offer_installments(started_at + 21 days)`.
- Asserções por `store_id`: `last_granted_seq=3`, `granted_total=20`, 4 transações `demo` com `credit_program='trial_28d'` seqs 0/1/2/3, `demo_balance=20`, `demo_expires_at` igual ao `expires_at` do enrollment, 4 `metadata->>'expires_at'` idênticos, `errors=0`.
- Repetição: zero novas transações; `granted_total`/`last_granted_seq`/`demo_balance` inalterados.
- Cleanup em `afterEach` com `session_replication_role = replica` (restaura `origin`); client fechado em `afterAll`; nenhuma evidência escrita em `.planning`.

## Gates e evidência

| Gate | Comando | Resultado |
|---|---|---|
| Testes focados (rota + irmãos) | `node node_modules/vitest/vitest.mjs run src/app/api/cron/demo-credits/__tests__/route.test.ts src/app/api/cron/sync-openai-pricing/__tests__/route.test.ts src/__tests__/middleware/redirect.test.ts` | **17 passed / 3 files** (Task 1) |
| Teste comportamental isolado | `node node_modules/vitest/vitest.mjs run src/app/api/cron/demo-credits/__tests__/route.test.ts` | **11 passed** (Task 2) |
| Integração sem opt-in | `node node_modules/vitest/vitest.mjs run --config vitest.integration-postgres-f50-4.config.ts src/lib/credit/__tests__/trial-offer-installments.integration.test.ts` | **1 skipped, exit 0** — skip limpo, sem conexão |
| Registro da categoria | `node -e "...includes(...)"` | **registry OK** |
| Typecheck | `npm.cmd run typecheck` | **exit 0**, sem saída de erros (executado após Tasks 1, 2 e 3) |
| Lint | `npm.cmd run lint` | **exit 0** (limitação conhecida: sem cobertura de TypeScript) |
| Build | `npm.cmd run build` | **exit 0** (`check:cnae OK`; `Compiled successfully`; build de produção completo) |

### Gate NÃO EXECUTADO (nunca reportado como pass)

- **Integração real em PostgreSQL descartável (F50_4_RUN_CONCURRENCY=1):** **NOT-EXECUTED**. Este ambiente não possui banco local descartável nem sentinela `f50_4_harness_identity`; o arquivo fez skip limpo. A prova real de recuperação tardia, expiração compartilhada e idempotência permanece pendente de execução com banco descartável autorizado.
- Nenhum reset de banco, migration remota, `db push`, deploy, cron de produção ou concessão manual foi executado.

## Caso de referência (evidência de produto, sem concessão)

Usuário `f52de76e-30df-4da0-9aab-da12985b21a2` / "Farmácia do Povo": enrollment iniciado em 2026-10-20 18:50, expira em 2026-11-17 18:50. Em uma execução do cron em **2026-11-04**, o estado esperado é:

- seq 1 (devido 27/10) e seq 2 (devido 03/11) elegíveis → **15 créditos acumulados** (5 iniciais + 5 + 5);
- seq 3 (devido **10/11**) ainda **não** elegível.

Nada foi concedido manualmente nesta quick; esta é apenas a expectativa para uma execução futura autorizada.

## Deviations from Plan

### Auto-fixed / ajustes

**1. [Rule 2 - Robustez do teste] Ativação controlada de `trial_offer_settings` no banco descartável**
- **Found during:** Task 3
- **Issue:** o seed da migration cria `trial_offer_settings` com `enabled=false` e `launch_at=NULL`; sem ativar a oferta, `start_trial_offer_enrollment` retornaria `offer_disabled` e o teste não exerceria as parcelas.
- **Fix:** o teste ativa `enabled=true` e preenche `launch_at` (fallback fixo somente se nulo) no `beforeAll` e restaura os valores originais no `afterAll`. Restrito ao banco descartável.
- **Files:** `src/lib/credit/__tests__/trial-offer-installments.integration.test.ts`

**2. [Contrato preservado] Teste estático mantido no mesmo arquivo**
- **Found during:** Task 2
- **Issue:** o plano pedia substituir o teste por comportamento, mas o guard pedia não perder as asserções de contrato.
- **Fix:** o arquivo reescrito mantém um `describe("contrato estático preservado")` com Bearer, `materialize_demo_expiration`, dedup por `tx.id` (demo/expiration/exhausted), `demo_expiring_24h` e agendamento no `vercel.json`, além dos testes comportamentais com middleware real.
- **Files:** `src/app/api/cron/demo-credits/__tests__/route.test.ts`

Nenhuma outra mudança de escopo. As RPCs, elegibilidade, coortes, janela de 28 dias, locks, `vercel.json` e `matcher` não foram alterados.

## Threat model — disposições aplicadas

| Threat ID | Disposição | Evidência |
|---|---|---|
| T-i4a-01 | mitigate | Passthrough exato no middleware; `CRON_SECRET` obrigatório no handler; teste prova 401 sem bearer mesmo alcançando o handler |
| T-i4a-02 | mitigate | Códigos estáveis + agregados numéricos; teste garante ausência de `SQLSTATE`/stack no corpo |
| T-i4a-03 | mitigate | Teste de integração prova idempotência e expiração única; nenhuma RPC alterada |
| T-i4a-04 | mitigate | Caminho exato; teste garante 401 em `/api/cron/demo-credits/other` |
| T-i4a-SC | accept | Nenhuma dependência nova |

## Diff final

```text
 scripts/testing/test-categories.json               |   3 +-
 .../api/cron/demo-credits/__tests__/route.test.ts  | 239 +++++++++++++++-
 src/app/api/cron/demo-credits/route.ts             |  52 +++-
 .../trial-offer-installments.integration.test.ts   | 301 +++++++++++++++++++++
 src/middleware.ts                                  |   2 +
 5 files changed, 584 insertions(+), 13 deletions(-)
```

Equivalente a `git diff --stat c0fa5c36..698af979`.

## Commits

- `efb95d94` — `fix(quick-261104-i4a): allow demo-credits cron through middleware and fail loudly on RPC errors`
- `836885dc` — `test(quick-261104-i4a): exercise demo-credits cron through the real middleware`
- `698af979` — `test(quick-261104-i4a): add opt-in integration for trial-offer installment recovery`

## Correção pós-revisão do orquestrador (commit `55b7da4a`)

Revisão do diff antes do commit documental encontrou dois ajustes, aplicados e revalidados:

1. `src/middleware.ts`: removido comentário duplicado sobre `CRON_SECRET` (a rota entrou entre duas linhas que já tinham o mesmo comentário). Passthrough exato preservado.
2. `src/lib/credit/__tests__/trial-offer-installments.integration.test.ts`:
   - `firstRun.granted` passou de `toBe(3)` para `toBeGreaterThanOrEqual(3)`. O RPC processa **todos** os enrollments do banco descartável e os arquivos da categoria `postgres-f50-4` podem rodar em paralelo; a prova da fixture continua nas asserções por `store_id`.
   - `afterAll` só restaura settings e fecha o client se eles existirem (evita `TypeError` quando `beforeAll` falha antes de conectar).

Revalidação após a correção:

| Gate | Resultado |
|---|---|
| Focados (demo-credits + sync-openai-pricing + 2 de middleware) | **28 passed / 4 files** |
| Typecheck | **exit 0** |
| Lint | **exit 0** (limitação conhecida: sem cobertura TS) |
| Build | **exit 0** (96/96, `Compiled successfully`) |
| Integração sem opt-in | **1 skipped, exit 0** — NOT-EXECUTED |

Diff final: `5 files changed, 585 insertions(+), 13 deletions(-)` (`git diff --stat c0fa5c36..55b7da4a`).

## Self-Check: PASSED

- SUMMARY.md presente no diretório da quick.
- Commits `efb95d94`, `836885dc`, `698af979` e `55b7da4a` presentes no histórico.
- Arquivos criados/modificados conferidos contra o mapa de arquivos do plano.
- Artefatos documentais (SUMMARY/STATE/PLAN) não commitados — a cargo do orquestrador.

## Known stubs / pendências

- Execução real do teste de integração em banco descartável (gate NOT-EXECUTED).
- Publicação/ativação em produção é passo separado e não autorizado.
