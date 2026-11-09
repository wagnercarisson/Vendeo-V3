# F60 / Plano 60-02 — Resultado da suíte Postgres (RUN 1 — histórico)

**Status:** **EXECUTADA COM FALHA — 7/8 PASS; NÃO APROVADA.**
**Nota histórica:** a falha era exclusivamente da asserção do teste, que esperava `search_path=` em vez de `search_path=""`. O PostgreSQL representa a configuração vazia como `search_path=""`. A asserção foi corrigida para exigir exatamente `search_path=""`, mantendo `SECURITY DEFINER` e a verificação das seis funções. Este resultado é preservado como histórico; a RUN 2 está em `60-02-POSTGRES-RESULT.md`.
**Data:** 2026-11-09, 16:35:11 -03:00
**Alvo:** `127.0.0.1:57782/postgres` (homolog)
**Janela:** `2026-11-09T16:35:00-03:00 / 2026-11-09T17:35:00-03:00 / responsavel-sessao` — **active**
**Comando:** `node scripts/testing/run-integration.mjs f60`
**Exit code:** **1**

## Resultado por teste

| # | Teste | Resultado |
|---|---|---|
| 1 | RLS/grants: `service_role` lê, não escreve; helper de abandono é interno | PASS |
| 2 | Funções são `SECURITY DEFINER` com `search_path` vazio | **FAIL** |
| 3 | Abertura idempotente; base concluída mantém crédito `reserved` | PASS |
| 4 | CAS rejeita token divergente e transição após conclusão | PASS |
| 5 | Índice parcial impede segunda tentativa ativa | PASS |
| 6 | `request_id` idempotente e conflito se o alvo divergir | PASS |
| 7 | Desfecho idempotente e divergência é conflito | PASS |
| 8 | Escrita direta como `service_role` recusada com `42501` | PASS |

## Falha

`AssertionError`: `expected [ 'search_path=""' ] to include 'search_path='`.

O PostgreSQL representou o `proconfig` como `search_path=""`; a asserção do teste esperava a string `search_path=`. Não foi identificado defeito no módulo, na migration ou no contrato SQL; a falha está na forma de comparar o `proconfig` no teste.

Nenhum ajuste de expectativa foi feito após a falha, conforme a regra da execução.

## Rollback e fixtures

| Verificação | Antes | Depois | Delta |
|---|---:|---:|---:|
| `auth.users` com `p916test-%@f60.test` | 18 | 18 | **0** |
| `public.stores` com nome `p916test-%` | 18 | 18 | **0** |
| Consultas concorrentes nas RPCs compartilhadas | 0 | 0 | **0** |

As contagens incluem fixtures retidas do 60-01; a suíte 60-02 não adicionou fixtures persistentes. Todos os testes usam `inTransaction` com `ROLLBACK`.

## Limites

- **Validação Postgres NÃO aprovada.**
- Nenhum código, migration, expectativa ou teste foi alterado após a falha.
- 60-01 não foi reexecutado.
- 60-03 permanece bloqueado.
- Nenhuma execução de produção, deploy, push, flag ou IA.
