---
phase: 38.2.1-economic-snapshot
verified: 2026-08-12T17:30:00Z
status: passed
score: "I1-I7: 53/53 asserts em banco real + 4 gates verdes"
overrides_applied: 0
re_verification:
  previous_status: none (primeira verificacao da fase)
  gaps_remaining:
    - "Linhas fantasma neutralizadas de teste permanecem em generation_events (append-only — operation_run_id NULL, metadata verification 38-2-1-*); excluídas dos asserts por tag"
    - "Trail de audit economic_parameter_audit recebeu linhas da verificação I6 (reason 38-2-1-07-verification / -revert-to-original) — append-only por desenho (mesmo padrão F38.2)"
gaps: []

# Phase 38.2.1: Snapshot Econômico — Verificação SQL/integrada I1–I7 + Gates + UAT

**Phase Goal:** Snapshot econômico congelado na geração (usd_brl_rate_at_generation / credit_value_brl_at_generation + origens em generation_events), backfill idempotente, RPCs expondo snapshots, service/API/UI com nomenclatura estimada e estabilidade temporal (alterar parâmetro → histórico não muda).
**Verified:** 2026-08-12
**Status:** passed — I1–I7 53/53 asserts em banco real, 4 gates verdes (1887 testes), UAT manual pendente de aprovação humana (checkpoint do plano 38-2-1-07).

## 9.1 — Verificação SQL/integrada em banco real (script `scripts/verify/38-2-1-f38-2-1-verification.mjs`)

**Comando:** `node scripts/verify/38-2-1-f38-2-1-verification.mjs` → **53 passed / 0 failed / 53 total** (executado 3× — idempotente entre execuções).

| Indicador | O que valida | Asserts | Resultado |
|-----------|--------------|---------|-----------|
| **I1 — Migration** | As 4 colunas `usd_brl_rate_at_generation`, `credit_value_brl_at_generation`, `usd_brl_rate_source_at_generation`, `credit_value_brl_source_at_generation` existem e são selecionáveis em `generation_events`; CHECK de origem rejeita `economic_parameter_fallback` (23514 `chk_gen_events_usd_rate_source`); CHECK de paridade rejeita valor-sem-origem nos DOIS pares (23514 `chk_gen_events_usd_rate_parity` / `chk_gen_events_credit_value_parity`) | 6 | ✓ PASS |
| **I2 — Backfill** | Paridade enforced: 0 valores sem origem / origens sem valor (usd e credit); 0 linhas backfilled sem valor; 0 linhas elegíveis reais (`value IS NULL AND created_at IS NOT NULL`, fora das linhas de teste do script) → re-aplicação é no-op; origens restritas ao conjunto permitido; contrato de seed: linhas `backfilled_seed` = **5.18 usd / 1.00 credit** (221 linhas amostradas — OVERRIDE 2026-08-11); simulação de re-aplicação em registro de teste: 1ª aplicação preenche, 2ª aplicação altera 0 linhas (idempotência), valores/origens mantidos | 10 | ✓ PASS |
| **I3 — Tracker** | Insert de teste com snapshots **5.20/2.00** (espelhando o contrato do `AiCostTracker.record` — valores no evento, origens definidas pelo tracker) → linha persistida com origens `captured_at_generation`; RPC lista confirma o snapshot capturado no run | 2 | ✓ PASS |
| **I4 — RPC lista** | `admin_get_ai_operation_runs` expõe os **4 campos por run** no JSON; run de referência com snapshot não-null; run de teste (filtro operation_run_id) expõe 5.20/2.00 + `captured_at_generation` (snapshot do evento de referência — 1º evento com valor preenchido) | 6 | ✓ PASS |
| **I5 — RPC detalhe** | `admin_get_ai_operation_run_events` expõe os **4 campos por evento e no run**; snapshot do run de detalhe = capturado do evento de teste | 7 | ✓ PASS |
| **I6 — Estabilidade temporal** | Run real com snapshot (e626f452…, usd=5.18/credit=1.00, custoUSD=0.132079, líquidos=1): derivação ANTES (custoBrl/receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct) → altera `usd_brl_rate`/`credit_value_brl` para **9.99** via `admin_set_economic_parameter` (reason de teste + operationId) → re-derivação DEPOIS → **valores IDÊNTICOS** (histórico não muda); contraste: com o parâmetro novo a derivação DIFERIRIA (ancoramento do snapshot provado); parâmetros **revertidos aos valores originais** (5.2/1.00) | 10 | ✓ PASS |
| **I7 — Fallback legacy** | Evento/run sem valor persistido (insert de teste NULL⇔NULL): RPC devolve snapshot NULL nos 4 campos → o service deriva com o **parâmetro corrente** + sinaliza `creditValueSource = economic_parameter_fallback` / `revenueEstimationNote = estimated_from_admin_credit_value` (contrato do deriveBrl); **backfilled NUNCA tratado como captured_at_generation** (runs backfilled na página mantêm origens backfilled_*); linha de teste neutralizada | 8 | ✓ PASS |
| **NOM — Nomenclatura** | Grep nos contratos TS (service + API + UI, fora `__tests__`) por `receitaRealBrl|resultadoRealBrl|margemRealPct` → **0 ocorrências** | 1 | ✓ PASS |
| **Cleanup** | Parâmetros econômicos revertidos aos originais; linhas de teste neutralizadas (append-only — DELETE é 403 para service_role; UPDATE de neutralização, padrão F38.1) | — | ✓ executado em todas as rodadas |

**Total: 53/53 asserts verdes em banco real.** `scripts/verify/38-2-f38-2-verification.mjs` (F38.2) **sem diff** — padrão preservado.

### Evidências-chave do estado real

- **221 linhas** em `generation_events` com snapshot `5.18/backfilled_seed` + `1.00/backfilled_seed` (backfill aplicado no remoto).
- **0 linhas** com valor sem origem (paridade enforced por dados + CHECK).
- **20 runs** no RPC de lista (janela 90d); run de referência com snapshot 5.18/1.00.
- Parâmetros correntes após verificação: `usd_brl_rate = 5.2`, `credit_value_brl = 1.00` (estado original preservado).

## 9.2 — Gates automáticos (regressão completa)

| Gate | Comando | Resultado |
|------|---------|-----------|
| 1. Vitest | `npx vitest run` | **213 files, 1887/1887 testes passando (0 failed)** |
| 2. Typecheck | `npm run typecheck` | **exit 0** (tsc -p tsconfig.typecheck.json --noEmit) |
| 3. Lint | `npm run lint` | **exit 0** (eslint . — 0 errors, 0 warnings) |
| 4. Build | `npm run build` | **exit 0** (next build) |

Nenhum teste foi alterado para "fazer passar" — nenhum arquivo de teste modificado nesta fase de verificação (apenas o script novo + este documento).

## 9.3 — Regressão manual UAT (checkpoint humano — plano 38-2-1-07 Task 3)

Checklist para aprovação humana (gate blocking, `autonomous: false` — apresentado ao usuário):

| # | Cenário | Como verificar |
|---|---------|----------------|
| 1 | Aviso de semântica | `/admin/operation-costs` ("Configurações Econômicas") → aviso "Alterações nos parâmetros econômicos valem para novas gerações..." visível na seção Parâmetros |
| 2 | Estado inicial | Anotar custo médio IA e KPIs atuais em `/admin/ai-operation-costs` (receita/resultado/margem estimados) |
| 3 | Alterar parâmetros | Alterar `usd_brl_rate` (ex.: 5.50) e `credit_value_brl` (ex.: 2.50) com motivo em Configurações Econômicas → salvar |
| 4 | Histórico estável | Recarregar `/admin/ai-operation-costs` → runs com snapshot MANTÊM os valores BRL; runs legados podem mudar e exibem "estimado de parâmetro atual" |
| 5 | `/admin/metrics` estável | Card "Custo Médio IA" dos períodos com snapshot não muda após a alteração |
| 6 | Nova geração usa vigente | Gerar UMA nova campanha (ou VS) → novo run usa os valores vigentes (5.50/2.50) |
| 7 | Labels estimados | Painel exibe "Receita estimada"/"Resultado estimado"/"Margem estimada" — nenhum "receita real"/"lucro" |
| 8 | Reversão | Reverter os parâmetros aos valores originais com motivo (opcional — o script I6 já reverte; confirmar estado final) |

**Resume signal:** "approved" se tudo passou, ou descrição dos problemas.

## Limitações e notas

- **Linhas fantasma de teste**: os eventos de teste do script (tags `metadata.verification` = `38-2-1-*`) são neutralizados (operation_run_id → NULL) mas permanecem em `generation_events` — append-only por desenho (DELETE 403). Não entram em nenhum RPC (filtram `operation_run_id IS NOT NULL`) e são excluídas dos asserts de elegibilidade por tag. Mesmo padrão do F38.1.
- **Trail de audit da verificação**: o I6 grava linhas em `economic_parameter_audit` (9.99 → revert 5.2/1.00) com reason `38-2-1-07-verification` — append-only, rastreável, não afeta a UI.
- **Sem psql direto**: senha do banco não acessível — verificação via REST service_role + RPCs definer (mesmo cenário F38/F38.1/F38.2).
- **Dado-dependentes**: asserts calibrados contra o estado real (221 linhas backfilled_seed, 20 runs, parâmetros 5.2/1.00) — execuções futuras validam o estado vigente.

---

_Verified: 2026-08-12_
_Execução: plano 38-2-1-07 (verificação final da fase 38.2.1)_
