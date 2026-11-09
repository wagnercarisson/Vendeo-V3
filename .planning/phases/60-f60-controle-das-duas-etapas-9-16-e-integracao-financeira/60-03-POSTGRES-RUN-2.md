# 60-03 — Execução Postgres autorizada (RUN 2)

**Autorização:** concedida explicitamente após aprovação técnica do diff de harness.
**Ambiente:** homolog `vendeo-homolog`, fora de produção.
**Alvo executado:** `127.0.0.1:57782/postgres` (loopback; preflight compartilhado F60).
**Escopo:** as quatro suítes do perfil `integration.f60`, somente testes e conferências read-only antes/depois.
**Fora do escopo:** alterar código, aplicar migrations, iniciar 60-04, deploy, push, produção.

## Janela de exclusividade

| Campo | Valor |
|---|---|
| Início (UTC) | `2026-11-09T20:40:00Z` |
| Fim (UTC) | `2026-11-09T21:40:00Z` |
| Duração | 1 hora |
| Responsável | solicitante da autorização 60-03 |
| Operador | agente OpenCode |
| Concorrência | `pg_stat_activity`: 0 outras sessões ativas (`state <> 'idle'`) antes e depois |

## Execução

| Campo | Valor |
|---|---|
| Início real (UTC) | `2026-11-09T20:40:22Z` |
| Fim real (UTC) | `2026-11-09T20:40:23Z` |
| Comando | `node scripts/testing/run-integration.mjs f60` |
| Exit code | **0** |
| Resultado | **APROVADO — 26/26 PASS** |
| Log | `C:\Users\wagne\AppData\Local\Temp\opencode\f60-run2.log` |

## Resultados individuais — 26/26 PASS

### `two-stage-control.postgres.test.ts` — 8/8 PASS

1. RLS/grants: service_role lê, não escreve; helper de abandono é interno — **PASS**
2. Funções são SECURITY DEFINER com search_path vazio — **PASS**
3. Abertura é idempotente e base concluída mantém crédito reservado — **PASS**
4. CAS rejeita token divergente e transição após conclusão — **PASS**
5. Índice parcial impede segunda tentativa ativa — **PASS**
6. `request_id` é idempotente e conflita se o alvo divergir — **PASS**
7. Desfecho é idempotente e divergência é conflito — **PASS**
8. Escrita direta como service_role é recusada com 42501 — **PASS**

### `origin-views.postgres.test.ts` — 2/2 PASS

9. Views respeitam status, anti-join e desfecho opcional — **PASS**
10. Funções são SECURITY DEFINER com `search_path=""` e helper interno — **PASS**

### `financial-integration.integration.test.ts` — 8/8 PASS

11. Duas aberturas reservam UM crédito e uma transação — **PASS**
12. Base `done` permanece `reserved` e não grava arte/entrega — **PASS**
13. Expansão iniciada não reserva crédito adicional — **PASS**
14. Entrega vertical confirma uma vez e replay não muta — **PASS**
15. Falha definitiva sem arte estorna uma vez; `integral` exige entrega — **PASS**
16. Operação `delivered` recusa estorno — **PASS**
17. `unknown` não estorna sozinho; resolução administrativa usa cliente/identidade e projeta — **PASS**
18. Origem nova SEM sonda vertical não entrega nem estorna pela via administrativa — **PASS**

### `shared-reading-compatibility.integration.test.ts` — 8/8 PASS

19. 1:1 entregue preserva campo legado a campo legado — **PASS**
20. 9:16 direto estornado NÃO é tratado como duas etapas e preserva campos legados — **PASS**
21. `unknown` legado mantém `processing`/`failed`/`unknown`/`supportReference` — **PASS**
22. Histórico legado mantém ordem por `attempt_number DESC` — **PASS**
23. Views por origem: `ORDER BY source` devolve `9_16_two_stage` antes de `legacy` — **PASS**
24. Entre etapas: base `done` + expansão `pending` expõe `origin`/`stage` e entra na listagem — **PASS**
25. Listagem legada mantém `origin='legacy'` e sem segunda fila — **PASS**
26. Origem nova sem sonda vertical fica inconclusiva na listagem (nunca quadrada) — **PASS**

## Conferências read-only ANTES

| Item | Valor |
|---|---|
| Banco / usuário | `postgres` / `postgres` |
| Endereço interno | `172.21.0.10:5432` (publicado em `127.0.0.1:57782`) |
| Ledger | **154** migrations; última `20261109174110` |
| Outras sessões ativas | **0** |
| Fixtures `p916test-*` | 18 users (históricas, de `2026-11-09T18:29Z`) |
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
| Fixtures `p916test-*` | **18** | inalterado (não removidas) |
| Fixtures `p916fin-*` / `p916compat-*` | **0 / 0** | **nenhuma nova persistida** |
| `credit_transactions` | 168 | inalterado |
| `product_1_1_campaign_credit_operations` | 51 | inalterado |
| `product_1_1_generation_attempt_claims` | 31 | inalterado |
| `product_1_1_generation_outcomes` | 5 | inalterado |
| `admin_audit_log` | 97 | inalterado |
| `product_9_16_two_stage_operations` | 14 | inalterado |
| Tabelas `product_9_16_%credit%` | **0** | nenhum ledger paralelo |

## Evidência de rollback / ausência de novas fixtures

- Baseline e pós-execução são **idênticos** em todas as contagens globais.
- Nenhuma fixture `p916fin-*` ou `p916compat-*` foi persistida.
- As **18** fixtures históricas `p916test-*` do 60-01/60-02 permaneceram exatamente em **18** — preservadas, sem incremento.
- Nenhuma migration nova, nenhuma tabela contábil paralela, nenhuma alteração de schema.
- Critério aplicado: **nenhuma nova persistência em relação ao baseline**.

## Parecer da execução

**RUN 2 aprovada tecnicamente: exit 0, 26/26 PASS, sem novas fixtures persistentes.**

## Aceite técnico

**Aceite técnico do Postgres do 60-03 aprovado em 2026-11-09.** O revisor conferiu o relatório e o log: quatro suítes, **26/26 PASS**, exit 0, contagens antes/depois inalteradas.

- `60-03` fica **concluído e aprovado** (revisão offline + validação Postgres).
- A **RUN 1 permanece como histórico**.
- O aceite libera a **revisão do `60-04`**, não sua execução automática.
- Produção, deploy e IA continuam fora deste aceite.
