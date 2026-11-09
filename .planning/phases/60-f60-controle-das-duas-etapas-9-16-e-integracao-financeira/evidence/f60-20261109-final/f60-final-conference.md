# F60 — Conferência final read-only

- Run: `f60-20261109-02`
- Executado em: 2026-11-09T18:47:45.773Z
- 13 UUIDs removidos ausentes: **SIM**
- Integridade preexistente: **PASS**
- Delta esperado: **PASS**
- Ledger: **PASS**
- Remoções autorizadas (run 01): 13

## Delta autorizado da run 01

13 usuários de teste órfãos, criados antes da falha de fixture, sem loja/campanha/transação.
A ausência foi verificada diretamente em `auth.users`.

## Integridade

- Linhas preexistentes removidas inesperadamente: 0
- Linhas preexistentes alteradas: 0
- Adições fora do manifesto da run 02: 0
- Adições esperadas ausentes: 0

> Conferência somente leitura; o harness não foi reexecutado.
