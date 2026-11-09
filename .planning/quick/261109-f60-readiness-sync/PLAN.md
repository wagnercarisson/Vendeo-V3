# Quick 261109-f60-readiness-sync

**Objetivo:** investigar e corrigir a sincronização do teste `store-identity-form.direction-pending.test.tsx` que falhou na suíte global do 60-04.
**Escopo:** somente teste. Não tocar no módulo F60, migration ou Postgres.
**Data:** 2026-11-09.

## Hipótese

O teste aguarda o banner desaparecer e verifica imediatamente a contagem de chamadas de readiness. O componente remove o banner e incrementa `readinessRefreshKey` no mesmo fluxo, mas o `fetch` de readiness ocorre em um efeito separado. A verificação pode ocorrer antes do efeito executar, configurando uma corrida de sincronização do teste.

## Correção candidata

No teste `realinhamento bem-sucedido limpa o banner e reexecuta readiness`:

- aguardar explicitamente, em `waitFor`, o **aumento da contagem** de chamadas `/api/store/check-readiness`;
- manter a asserção original de aumento;
- sem sleeps, sem enfraquecer a asserção e sem alterar o componente.

## Gates

- teste focado `store-identity-form.direction-pending.test.tsx`;
- suíte global (`npm test`), preservando os resultados anteriores e registrando qualquer divergência;
- `git diff --check`.

## Fora de escopo

Módulo F60, migrations, Postgres, deploy, push, merge, ativação.
