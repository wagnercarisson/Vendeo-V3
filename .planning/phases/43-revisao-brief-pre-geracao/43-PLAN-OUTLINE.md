# Phase 43 — Plan Outline

> Chunked planning manifest. One plan per OpenSpec task section (15 sections → 15 plans, 26 testes numerados).
> Requirement IDs: specs usam `### Requirement: <título>` (sem IDs F43-XX) — cada plan referencia os nomes canônicos + F43-XX do CONTEXT.

> **STATUS: 15/15 plans planejados (7 waves), aguardando revisão humana.**

| Plan ID | Status | Objective | Wave | Depends On | Requirements |
|---------|--------|-----------|------|------------|--------------|
| 43-01 | ○ Planejado | Trackings — renumeração D1 (F42 Signup concluída, F43 Revisão do Brief, Stripe fora da numeração) — verificar consistência já aplicada no ciclo de planejamento (commit c5141bef) + registrar | 1 | — | F43-01 |
| 43-02 | ○ Planejado | Helpers puros — `prepareCampaignImages` + `buildCampaignGenerationBody` (D3/D4) | 2 | 43-01 | F43-08, F43-09 |
| 43-03 | ○ Planejado | Hook — estado `reviewMode` + snapshot travado + transições (D2/D3/D4) | 3 | 43-02 | F43-02, F43-03, F43-04, F43-05, F43-06, F43-07 |
| 43-04 | ○ Planejado | UI — tela de revisão do brief (campaign-brief-review) + botão "Revisar e gerar" (D6/D7) | 4 | 43-03 | F43-25, F43-26 |
| 43-05 | ○ Planejado | Schema + validação — override `brief_review_confirmed` (D5) | 2 | 43-01 | F43-11, F43-12, F43-13 |
| 43-06 | ○ Planejado | Serviço — fase `input_validation` `skipped` + GenerationProgress (D5) | 3 | 43-05 | F43-14, F43-15, F43-16 |
| 43-07 | ○ Planejado | Migration — `feature_flags` + RPC `admin_update_feature_flag` + CHECKs `admin_audit_log` [BLOCKING db push] (D5) | 2 | 43-01 | F43-17, F43-18, F43-19 |
| 43-08 | ○ Planejado | Rota — skip + normalização ponta a ponta da flag + serviço de leitura (D5) | 4 | 43-06, 43-07 | F43-20, F43-21 |
| 43-09 | ○ Planejado | Admin — rota `PUT /api/admin/feature-flags` + página "Controles operacionais" + navegação (D5) | 3 | 43-07 | F43-22, F43-23, F43-24 |
| 43-10 | ○ Planejado | Testes 1–10 — Hook / form (D2/D3/D4/D6) | 4 | 43-03 | F43-27 |
| 43-11 | ○ Planejado | Testes 11–16 — UI do resumo (D6/D7/D3) | 5 | 43-04 | F43-27 |
| 43-12 | ○ Planejado | Testes 17–23 — Backend / schema / rota / serviço (D5) | 5 | 43-05, 43-08 | F43-27 |
| 43-13 | ○ Planejado | Testes 24–26 — Admin da flag (D5) | 4 | 43-09 | F43-27 |
| 43-14 | ○ Planejado | Regressão e co-migração de fixtures (D2–D7) | 6 | 43-10, 43-11, 43-12, 43-13 | F43-28 |
| 43-15 | ○ Planejado | Verificação — 4 gates + UAT (mobile, flag ligada/desligada, fallback) | 7 | 43-14 | F43-29 |

## OUTLINE COMPLETE — 15 plans, 7 waves
