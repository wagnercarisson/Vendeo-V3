---
status: passed
phase: 37.2-correcao-unica-por-nao-conformidade
updated: 2026-09-10
---

# Phase 37.2: Correção Única por Não Conformidade — Verification

**Verificado em:** 2026-09-10
**Fonte da verdade:** `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`
**Context:** `.planning/phases/37.2-correcao-unica-por-nao-conformidade/37-2-CONTEXT.md`

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **264 files / 2578 tests passed** (F37.1 base: 255 files / 2379 → +9 files / +199 testes) |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | 0 | Sem erros |
| Lint | `npm run lint` (`eslint .`) | 0 | Sem erros |
| Build | `npm run build` (`next build`) | 0 | Build bem-sucedido (rotas `/campanhas/[id]`, `/api/campaign/[id]/problem-report`, `/api/admin/campaign-reports/[reportId]` compiladas) |

## 2. Migrations aplicadas no remoto

| Migration | Conteúdo | db push |
|-----------|----------|---------|
| `20260906000001_f37_2_create_campaign_correction_tables.sql` | `campaign_correction_reports` + `campaign_correction_submissions` + CHECK `asset_status` `superseded` + CHECKs semânticos + RLS + REVERT | ✅ aplicada (dry-run → up to date) |
| `20260906000002_f37_2_correction_flows.sql` | 7 RPCs (begin/complete_analysis/consume/complete_v2/fail/recover/approve_candidate) | ✅ aplicada (smoke service_role OK) |
| `20260906000003_f37_2_generation_events_type.sql` | CHECK `chk_generation_events_type` 14→15 valores | ✅ aplicada (probe aceita o literal) |

## 3. Matriz Planos × Gates

| Plan | O que construiu | Testes associados | Typecheck | Lint |
|------|-----------------|-------------------|-----------|------|
| 37-2-01 | Trackings F37.2 realinhada (6 arquivos + ROADMAP raiz) | grep (não-vitest) | ✓ | ✓ |
| 37-2-02 | M1 tabelas + CHECK `superseded` (aplicada no remoto) | SQL (manual + smoke REST) | ✓ | ✓ |
| 37-2-03 | M2/M3 RPCs (aplicadas no remoto) | smoke service_role (7 RPCs) | ✓ | ✓ |
| 37-2-04 | M4 CHECK + union `GenerationEventType` | probe CHECK + typecheck | ✓ | ✓ |
| 37-2-05 | Tipos + `correction-reports.ts` | campaign lib 94/94 | ✓ | ✓ |
| 37-2-06 | `CorrectionIntentService` | correction-intent 8/8 | ✓ | ✓ |
| 37-2-07 | Rota `problem-report` | campaign-problem-report-route 21/21 | ✓ | ✓ |
| 37-2-08 | Hook + bloco único + orquestrador `generateCorrectionV2` | correction-v2-persistence 9/9 | ✓ | ✓ |
| 37-2-09 | Aprovação protegida (rota approve) | campaign-approve 12/12 | ✓ | ✓ |
| 37-2-10 | Modal + dois botões | approval-view-problem 16/16 | ✓ | ✓ |
| 37-2-11 | Página `pending` v1/v2 + `regenerating` | campaign-page + page-server | ✓ | ✓ |
| 37-2-12 | Fila admin (lista/detalhe/marcação/link) | admin-campaign-reports 9/9 | ✓ | ✓ |
| 37-2-13 | Testes análise (12.2-12.9) | correction-intent 8/8 | ✓ | ✓ |
| 37-2-14 | Testes lifecycle/begin (13.1-13.10) | begin-rpc 10/10 | ✓ | ✓ |
| 37-2-15 | Testes consumo/serialização/recuperação (14.1-14.9) | consume-recover 9/9 | ✓ | ✓ |
| 37-2-16 | Testes única v2/geração/custo/paridade (15.1-15.9) | correction-v2-persistence 9/9 | ✓ | ✓ |
| 37-2-17 | Testes UI/gates/admin/rota (16.1-16.9) | 3 suítes 46/46 | ✓ | ✓ |
| 37-2-18 | Regressão + co-migração de fixtures | suíte completa 2578 | ✓ | ✓ |
| 37-2-19 | Verificação final + UAT (este documento + `37-2-UAT.md`) | 4 gates verdes | ✓ | ✓ |

## 4. Matriz de Cobertura F37.2-01..F37.2-19

| Requisito | Cobertura (plano/teste) |
|-----------|-------------------------|
| F37.2-01 Trackings | 37-2-01 (grep-verificação, zero resíduos) |
| F37.2-02 M1 tabelas + CHECK superseded | 37-2-02 (SQL + db push) |
| F37.2-03 M2/M3 RPCs | 37-2-03 (SQL + smoke) |
| F37.2-04 M4 CHECK + union | 37-2-04 (SQL + probe + typecheck) |
| F37.2-05 Persistência pai/filha | 37-2-05, 37-2-18 (correction-reports-persistence 12/12) |
| F37.2-06 `CorrectionIntentService` | 37-2-06, 37-2-13 (8/8) |
| F37.2-07 Rota `problem-report` | 37-2-07, 37-2-17 (21/21) |
| F37.2-08 Geração v2 | 37-2-08, 37-2-16 (9/9) |
| F37.2-09 Aprovação protegida | 37-2-09, 37-2-17 |
| F37.2-10 UI modal/dois botões | 37-2-10, 37-2-17 (16/16) |
| F37.2-11 Página campanha | 37-2-11, 37-2-17 |
| F37.2-12 Fila admin | 37-2-12, 37-2-17 (9/9) |
| F37.2-13 Testes análise | 37-2-13 |
| F37.2-14 Testes begin | 37-2-14 |
| F37.2-15 Testes consumo/recuperação | 37-2-15 |
| F37.2-16 Testes v2/persistência/custo | 37-2-16 |
| F37.2-17 Testes UI/gates/admin/rota | 37-2-17 |
| F37.2-18 Regressão/co-migração | 37-2-18 |
| F37.2-19 Verificação final | 37-2-19 (este documento + `37-2-UAT.md`) |

## 5. Verificação da Meta da Fase

- **Dois caminhos na revisão (R1):** `CampaignApprovalView` exibe [Aprovar arte] + [Informar problema] no `pending` v1; modal de 1 etapa (`campaign-problem-modal.tsx`) com preview, orientação corrigível×não, textarea obrigatório; Cancelar/X/ESC/backdrop sem efeito; vazio/pontuação → 400 sem caso/IA.
- **Análise textual (R2):** `CorrectionIntentService` via `createTextProvider` (JSON estrito + Zod `.strict()`), taxonomia §4, conteúdo não confiável delimitado/saneado; `unclear`/`analysis_failed` sem gerar/consumir; custo call-level `campaign_correction_analysis` no mesmo `operation_run_id`.
- **Caso + tentativas (R5):** tabelas pai/filha com `UNIQUE(campaign_id)` / `UNIQUE(report_id, attempt_number)` + CHECKs semânticos; decisão corrente por `attempt_number`; aprovação não espelhada.
- **Lifecycle (R2/R3.1):** `begin`/`complete_analysis` com locks candidata → campanha → relato, lease 2min, rate limit 3/30min (teto absoluto), validação semântica.
- **Consumo/falha/recuperação (R3/R4):** `consume` grava `rejection_count=1` + `correction_in_progress=true` + `generation_started`; `fail` mantém 1 e `failed_no_v2`; `recover` com teto 330s e reload lazy.
- **Geração da v2 (R4):** hook `onBeforeImageProviderCall` fire-once; bloco único de não conformidade em runtime (`.md` com diff vazio); `input_validation` skipped; revisor intocado; sem `candidateArtDataUrl`; sem nova reserva de crédito.
- **Conclusão da v2 (R5):** `complete_campaign_correction_v2` copia `brief_snapshot` da v1; v1 → `superseded` com path preservado; sem incrementar `rejection_count`.
- **Aprovação protegida (R8):** rota approve chama `recover` (best-effort) e `approve_campaign_candidate` (que invoca a RPC F37.1 intacta); `correction_in_progress` → 409.
- **Fila admin (R6):** `/admin/campaign-reports` + detalhe v1×v2 + histórico + marcação ortogonal + link.
- **Preservados (R7):** flag off/legado intactos; download/copy gated; `regenerating` exercitado.

## 6. Pendências / Checkpoint

- **UAT humana CONCLUÍDA:** cenários 37.2-1..9 em `37-2-UAT.md` — **PASS 9/9**. O cenário 37.2-6 (corrida aprovar × consumir) foi **validado por código** (reprodução manual determinística inviável): `approve_campaign_candidate` trava a candidata e `RAISE EXCEPTION 'correction_in_progress'` → 409; `consume_campaign_correction_opportunity` valida `approved_version_id IS NOT NULL`/`rejection_count=0` → `campaign_not_pending` antes do provider (locks candidata → campanha; testes `campaign-approve-route` e `campaign-correction-consume-recover` 14.7).
- **Migrations aplicadas no remoto:** `20260906000001`/`20260906000002`/`20260906000003` (dry-run → "Remote database is up to date").
- **Fix pós-UAT (commit `01a7021b`):** análise textual com schema discriminado (`eligible` sem `guidance` não é mais rebaixado a `unclear`); falhas de parse/schema → `analysis_failed` com telemetria (`json_parse_failed`/`schema_validation_failed`); erros 409 legíveis `{ code, message }` PT-BR exibidos pelo modal.

---

*Fase 37.2 verificada: 4 gates verdes + UAT humana PASS (9/9) — fatia concluída.*
