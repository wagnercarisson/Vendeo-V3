# F60 / Plano 60-02 — Summary de implementação

**Status:** **CONCLUÍDO E APROVADO — revisão offline e validação Postgres (2026-11-09).**
**Evidências:** `60-02-POSTGRES-RESULT.md` (RUN 2, 8/8 PASS) e `60-02-POSTGRES-RESULT-RUN1.md` (histórico 7/8).
**Próximo passo:** revisão do `60-03-PLAN.md`. A execução do 60-03 permanece não autorizada.

## Correções desta revisão

1. **Janela de homolog compartilhada e validada:** `scripts/testing/f60-window.mjs` reconhece `127.0.0.1`, `localhost`, `::1` e `[::1]`; exige janela `início / fim / responsável` **ativa** e recusa `invalid`, `closed` e `future`. Runner e suíte Postgres usam a mesma validação.
2. **Política consistente:** `isConsistentProviderFailure` valida classe × motivo × evidência; `abandoned` nunca reabre; `timeout` após possível envio não vira retry; `other`/evidência inconsistente retorna `insufficient_failure_evidence`; `decideNextAction` reutiliza `decideNextAttempt` para base e expansão.
3. **Parsers fechados:** `resume` exige `origin`, `credit_status`, `unknown`, `failed_outcome` e `next_target`; ações `acquire_*`/`retry_*` exigem target e `deliver`/`wait`/`blocked` o recusam. `open` rejeita etapas duplicadas; tokens vazios e números em texto são recusados.
4. **Testes Postgres completos:** CAS com token/status divergentes, índice parcial, replay/conflito de `request_id`, idempotência/conflito de desfecho e escrita direta como `service_role` com `42501`. Execução pendente de autorização. No caso `42501`, não há `RESET ROLE` após o erro; o `ROLLBACK` do `inTransaction` encerra a transação abortada e desfaz o `SET LOCAL ROLE`.

## Resultados offline

| Gate | Resultado |
|---|---|
| `two-stage-control.test.ts` | **25/25 PASS** |
| `f60-window.test.mjs` | **8/8 PASS** |
| `npx tsc -p tsconfig.typecheck.json --noEmit` | **0 erros** |
| `npm.cmd run lint` | **0 erros / 0 warnings** |
| `node scripts/testing/test-status.mjs` | inventário válido; perfil `f60` reconhecido |
| `git diff --check` | limpo |

## Teste Postgres

- Criado; **não executado**.
- Comando: `node scripts/testing/run-integration.mjs f60`.
- Gate: `F60_TEST_ALLOW_WRITES=1`; homolog exige nova `F60_HOMOLOG_AUTHORIZED=1` e janela vigente. A janela do 60-01 não é reutilizável.

## Limitações

- Suíte local global: 2 arquivos com falhas não relacionadas (`landing-page.test.tsx` e `legacy-frontier.guard.test.ts`), mantidos em acompanhamento separado.
- Teste Postgres não executado; a prova 60-01 permanece válida, mas não substitui esses testes.
- Produção, deploy, push, flag, UI e IA fora do escopo.
