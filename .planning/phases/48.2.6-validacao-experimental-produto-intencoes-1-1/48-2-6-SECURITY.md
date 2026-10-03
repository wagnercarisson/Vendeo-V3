---
phase: 48.2.6-validacao-experimental-produto-intencoes-1-1
review_type: STRIDE
asvs_level: L1
threats_total: 6
threats_open: 0
status: verified
---

# F48.2.6 — Revisão de segurança anterior ao CHECKPOINT A

## Escopo

Revisão proporcional aos limites aprovados no OpenSpec e à cadeia implementada nos Planos 02–06. Evidência baseada em código, contratos automatizados offline, typecheck/lint/build e diffs de fronteiras em `48-2-6-GATES.md`. Nenhum provider, endpoint externo, Supabase remoto, geração paga ou chave real foi consultado.

## Threat register (STRIDE)

| ID | STRIDE | Ameaça | Evidência / mitigação | Severidade residual | Estado |
|---|---|---|---|---|---|
| T-48.2.6-16 | E | Acesso às rotas/lojas/branding fora dos guards locais e admin | Rotas mantêm `requireAdmin → assertLabEnvironment → storeId → assertBenchTestStore` antes das leituras por loja; contratos API e boundary cobrem recusa e ausência de operações posteriores. | Low | Fechado |
| T-48.2.6-17 | T | Escrita em produção, migrations, créditos, pricing ou transporte | Diffs `BASE_SHA..HEAD` e `BASE_SHA → worktree` vazios para todas as fronteiras protegidas; status também sem untracked em migrations. Pricing/adapters/allowlists produtivos permanecem intocados. | Low | Fechado |
| T-48.2.6-18 | I | Chave produtiva exposta ou fallback cruzado no caminho bench | `getBenchApiKey` só lê `OPENAI_BENCH_API_KEY`; erros sanitizados; `bench-api-key.contract.test.ts` cobre ausência, exclusividade e não disclosure. Nenhuma credencial real é lida nos gates. | Low | Fechado |
| T-48.2.6-19 | D | Duplicação/retry/concor­rência de runs | CAS `draft → pending` e slot single-run preservados; contratos de concorrência provam uma confirmação vencedora, idempotência sem novo insert e nenhuma repetição automática. | Low | Fechado |
| T-48.2.6-20 | T | Payload comercial ou preflight alterado alcançar persistência/provider | Matriz e validade são revalidadas em schema, snapshot e rotas; recusas precedem composição/lookup/CAS/persistência. Recomposição server-side e igualdade de bytes recusam evidência stale. API/preflight contracts verificam zero side effects. | Low | Fechado |
| T-48.2.6-SC | T | Dependência externa introduzir comportamento/operação não aprovada | Nenhum pacote adicionado; todos os testes do corte são offline e fetch não mockado falha na execução de contratos de execução/fronteira. | Low | Fechado |

## Evidência e achados

- ASVS L1: os controles aplicáveis às superfícies neste escopo estão representados no threat register e cobertos por contratos/gates listados no `48-2-6-GATES.md`.
- Erros de execução continuam sanitizados; testes verificam ausência de segredo/URL em erro persistido/stream.
- `bench-boundary.contract.test.ts` e `bench-execution.contract.test.ts` agora usam resolvedor de custo determinístico e falham se algum fetch não mockado for tentado; a execução corrigida comprovou zero fetch.
- **Nota histórica, sem inferência:** uma execução ampla anterior reportou quatro `fetch failed`, mas os logs disponíveis não contêm hostname/porta. Destino histórico **não determinado**; não se afirma que houve nem que não houve leitura remota. O teste foi isolado no commit `15bc1ae9`; todos os casos afetados passaram na reexecução offline.
- Sem chamada/provider real, geração paga, `db push`, leitura remota intencional ou alteração produtiva/migration.

## Risco residual

Nenhuma ameaça `high` conhecida permanece aberta neste corte; `threats_open: 0`. O destino histórico dos quatro fetches permanece não determinado e é mantido como ressalva factual, sem ser classificado como acesso remoto confirmado. Os testes corrigidos previnem nova tentativa de fetch pela cadeia de pricing desses contratos. CHECKPOINT A foi aprovado em 2026-10-03 para readiness local e documentação do Plano 09; a decisão não autoriza paid UAT, provider ou geração.
