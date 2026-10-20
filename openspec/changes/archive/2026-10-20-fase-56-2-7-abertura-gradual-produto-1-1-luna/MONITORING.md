# Monitoramento pós-archive — 56.2.7

**Status:** **TRANSFERIDO E EM ANDAMENTO** — não concluído, não executado e não dispensado.
**Task OpenSpec:** **5.5 permanece aberta** no archive.
**Início:** 2026-10-19
**Data final:** **2026-10-26, 23:59 BRT**
**Responsável:** aprovador humano do Checkpoint 3.

## Ponteiro durável

O registro completo está em:

`.planning/phases/56.2.7-abertura-gradual-produto-1-1-luna/56.2.7-MONITORING-TRANSFER.md`

O acompanhamento diário e as alegações comerciais estão em:

`.planning/phases/56.2.7-abertura-gradual-produto-1-1-luna/56.2.7-BETA-MONITORING.md`

## Escopo

- `spent_usd` / `cap_usd`;
- `delivered` / `failed` / `unknown`;
- `pilot_requires_reconciliation` / `pilot_cap_reached`;
- retry/fallback, erros e uso por loja;
- custos separados de `brand_profile_text` / `brand_profile_vision`;
- alegações comerciais inferidas, separadas das fornecidas pelo lojista.

## Critérios de parada

- teto atingido ou gasto sem margem;
- `unknown` ou reconciliação pendente;
- aumento anormal de falhas/retry/fallback;
- divergência de custo, pricing ou modelo efetivo;
- alegação comercial nova, não fornecida e não verificada, com risco;
- decisão explícita do responsável.

O desligamento, se necessário, ocorre pelo painel (OFF + revogação), sem
`VENDEO_GENERATION_PAUSED` e sem cancelar operações em andamento.

## Snapshot operacional datado

Os valores de 2026-10-19 (`all_stores=true`, `test_stores=false`, cap `5,00`,
`spent_usd=0,1484`) são um **snapshot**, não um estado permanentemente atual.
Reler painel/banco antes de qualquer decisão.

**O archive da entrega não encerra este acompanhamento.**
