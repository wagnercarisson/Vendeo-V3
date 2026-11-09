# F60 / Plano 60-02 — Resultado da suíte Postgres (RUN 2)

**Status:** **ACEITO TECNICAMENTE — 8/8 PASS; validação Postgres aprovada.**
**Aceite:** 2026-11-09, pelo responsável.
**RUN 1:** 7/8 preservada em `60-02-POSTGRES-RESULT-RUN1.md` como histórico da correção de asserção.
**Data:** 2026-11-09, 16:37:20 -03:00
**Alvo:** `127.0.0.1:57782/postgres` (homolog)
**Janela:** `2026-11-09T16:35:00-03:00 / 2026-11-09T17:35:00-03:00 / responsavel-sessao` — **active**
**Comando:** `node scripts/testing/run-integration.mjs f60`
**Exit code:** **0**

## Correção aplicada antes da RUN 2

Somente a asserção de `proconfig` foi alterada:

```ts
expect(row.proconfig ?? []).toContain('search_path=""');
```

Motivo: o PostgreSQL representa `search_path` vazio como `search_path=""`, não `search_path=`. Foram preservados `prosecdef === true` e a exigência das **seis** funções. Nenhuma outra configuração de `search_path` é aceita.

O resultado anterior (7/8) está preservado em `60-02-POSTGRES-RESULT-RUN1.md`.

## Resultado dos 8 testes

| # | Teste | Resultado |
|---|---|---|
| 1 | RLS/grants: `service_role` lê, não escreve; helper interno | **PASS** |
| 2 | Funções `SECURITY DEFINER` com `search_path=""` | **PASS** |
| 3 | Abertura idempotente; base `reserved` | **PASS** |
| 4 | CAS com token/status divergentes | **PASS** |
| 5 | Índice parcial impede segunda tentativa ativa | **PASS** |
| 6 | `request_id` idempotente/conflito | **PASS** |
| 7 | Desfecho idempotente/conflito | **PASS** |
| 8 | Escrita direta `service_role` → `42501` | **PASS** |

## Rollback e fixtures

| Verificação | Antes | Depois | Delta |
|---|---:|---:|---:|
| `auth.users` com `p916test-%@f60.test` | 18 | 18 | **0** |
| `public.stores` com nome `p916test-%` | 18 | 18 | **0** |
| Consultas concorrentes nas RPCs compartilhadas | 0 | 0 | **0** |

As 18 fixtures são retidas do 60-01; a suíte 60-02 não adicionou fixtures persistentes. Todos os testes usam `inTransaction` com `ROLLBACK`.

## Limites

- Resultado é validação local/homolog, **não** aceitação produtiva.
- `60-03` permanece **não autorizado**; o aceite do 60-02 libera apenas sua revisão.
- Nenhuma migration, deploy, push, flag ou IA.
- 60-01 não foi reexecutado.
