# F60 / Plano 60-01 — Parecer de revisão pré-aplicação

**Data:** 2026-11-09
**Escopo:** código preparado do 60-01 (migration, scripts, matriz e documentos da prova).
**Veredito:** **APROVADO — sem bloqueadores.**
**Efeito:** encerra a revisão do código preparado. **Não** aprova a prova, **não** autoriza escritas em homolog e **não** libera 60-02..60-04.

## Evidências confirmadas

| Item | Resultado |
|---|---|
| Testes funcionais offline do comparador | **12/12 PASS** |
| Guardas estáticas | **14/14 PASS** |
| Preflight do `prove` exige `f60_applied === true` | Confirmado |
| Modo de pré-aplicação (`status`) exige F60 ausente | Confirmado |
| `git diff --check` | Sem erros |
| `node --check` dos `.mjs` | Exit 0 |
| Parse do `.ps1` | Sem erros |
| OpenSpec `--strict` | Válido |

## Pontos revisados e aceitos

1. Comparador sem colisão `string`/`objeto`: `expected_delta_status` + `expected_delta_by_table`.
2. Snapshot com identidade por tabela (`store_id` em `credit_balances`), `auth.users` e as quatro tabelas novas.
3. Comparação esperado × observado, rejeição de extras/ausentes e tabelas sem correspondência.
4. Ledger validado antes do harness, com F60 aplicada exigida no `prove`.
5. Cleanup conservador, com autorização D independente, run id e manifesto da execução.
6. Aquisição bloqueia falha definitiva/desconhecida, inclusive `abandoned`/`unknown`.
7. Retomada coerente com a política por alvo (`retry_base` principal → fallback).
8. S11 com sobreposição transacional real; S13 cobre os contratos legados das três RPCs compartilhadas.

## Limites explícitos

> **Adendo pós-execução (2026-11-09):** a migration foi aplicada na janela autorizada (run `f60-20261109-02`); a prova S01–S13 foi executada e a conferência final read-only está em `evidence/f60-20261109-final/`. As afirmações abaixo descrevem o estado no momento da revisão.

- A aprovação é **documental e de código**, não operacional.
- Nenhuma conexão ou escrita em homolog foi feita nesta revisão.
- A migration permanece **autorada e não aplicada**.
- A prova S01–S13 permanece **não executada**.
- A decisão da prova (`60-01-PROOF-DECISION.md`) permanece `PENDENTE`.
- Os planos `60-02..60-04` permanecem bloqueados até a decisão formal da prova.

## Próximo passo

Preencher e conceder as autorizações A/B/C/D em `60-01-AUTHORIZATION-REQUEST.md`. Sem elas, nada toca no banco.
