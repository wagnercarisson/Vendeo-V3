# Quick 261109-f60-readiness-sync — Summary

**Status:** concluída; teste de sincronização corrigido, sem alteração no módulo F60.
**Escopo:** somente `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx`.
**Fora de escopo:** módulo F60, migration, Postgres, deploy, push, merge, ativação.

## Causa confirmada

O teste aguardava apenas o banner desaparecer. O componente remove o banner e incrementa `readinessRefreshKey` no mesmo fluxo, mas o `fetch("/api/store/check-readiness")` ocorre em um efeito separado. A verificação imediata da contagem podia ocorrer antes do efeito, configurando uma corrida de sincronização do teste.

## Correção

No teste `realinhamento bem-sucedido limpa o banner e reexecuta readiness`:

- `waitFor` agora aguarda **duas condições**: banner ausente e `readinessCalls() > readinessBefore`;
- a asserção original `readinessAfter > readinessBefore` foi preservada;
- sem sleeps, sem enfraquecer a asserção e sem alterar o componente.

## Gates

| Gate | Resultado |
|---|---|
| Teste focado | **16/16 PASS**, exit 0 |
| Suíte global | **8282 PASS / 4 FAIL / 10 skipped** — exit 1 |
| Typecheck | exit 0 |
| Lint | exit 0 |
| `git diff --check` | exit 0 |

As 4 falhas da suíte global são exatamente as conhecidas: `landing-page.test.tsx` (1) e `legacy-frontier.guard.test.ts` (3). A falha nova de `store-identity-form` **não se reproduziu** na suíte global após a correção.

## Preservação de resultados anteriores

- Resultado anterior do 60-04 (5 falhas, com a divergência) permanece em `60-04-GATES-REPORT.md` e em `evidence/f60-20261109-04/global-suite.log`.
- Resultado desta quick em `.planning/quick/261109-f60-readiness-sync/evidence/`.

## Evidências

- `evidence/focused.log`
- `evidence/global-suite.log`
- `evidence/diff-check.log`

## Limitações

- A suíte global segue **não verde** por 4 falhas conhecidas, fora do escopo desta quick.
- O aceite final do 60-04 continua pendente de revisão do diff/resultados/logs.
