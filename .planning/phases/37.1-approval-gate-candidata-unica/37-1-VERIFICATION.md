---
status: passed
phase: 37.1-approval-gate-candidata-unica
updated: 2026-09-01
---

# Phase 37.1: Approval Gate + Candidata Única — Verification

**Verificado em:** 2026-09-01
**Fonte da verdade:** `openspec/changes/fase-37-1-approval-gate-candidata-unica/`
**Context:** `.planning/phases/37.1-approval-gate-candidata-unica/37-1-CONTEXT.md`

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **255 files / 2379 tests passed** (F43 base: 2317 → +62 na fatia) |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | 0 | Sem erros |
| Lint | `npm run lint` (`eslint .`) | 0 | Sem erros |
| Build | `npm run build` (`next build`) | 0 | Build bem-sucedido (59 rotas; `/api/campaign/[id]/approve` compilada) |

## 2. Matriz Planos × Gates

| Plan | O que construiu | Testes associados | Typecheck | Lint |
|------|-----------------|-------------------|-----------|------|
| 37-1-01 | Trackings F37 em fatias 37.1/37.2/37.3 (6 arquivos + ROADMAP raiz) | grep (não-vitest) | ✓ | ✓ |
| 37-1-02 | Migrations `campaign_art_versions` + colunas campaigns + RPC approve (aplicadas no remoto) | SQL (manual) | ✓ | ✓ |
| 37-1-03 | Flag `campaign_approval_enabled` (constante + ALL_FEATURE_FLAG_KEYS + isCampaignApprovalEnabled fail-closed) | feature-flag-service 19/19 | ✓ | ✓ |
| 37-1-04 | Tipos `CampaignArtVersion` + persistência createArtVersion/listArtVersions | persistence 19/19 | ✓ | ✓ |
| 37-1-05 | `ApprovalDisplayState` + computeApprovalState + isDeliveryReleased + candidata ativa | display-approval 7/7 | ✓ | ✓ |
| 37-1-06 | generate-image insere v1 (flag on, fail-safe) | generate-image 63/63 | ✓ | ✓ |
| 37-1-07 | Gates download + publication-copy (403) | download 10/10 + copy 12/12 | ✓ | ✓ |
| 37-1-08 | Rota `POST /api/campaign/[id]/approve` | campaign-approve 12/12 | ✓ | ✓ |
| 37-1-09 | UI: page.tsx + `CampaignApprovalView` + client.tsx | approval-view 5/5 + page 8/8 + page-server 5/5 | ✓ | ✓ |
| 37-1-10 | Testes estados (13.1-13.7) | display-approval 7/7 | ✓ | ✓ |
| 37-1-11 | Testes rota approve (14.1-14.4) | campaign-approve 12/12 | ✓ | ✓ |
| 37-1-12 | Testes generate-image v1 + download/copy gated (15/16.x) | 3 suítes 85/85 | ✓ | ✓ |
| 37-1-13 | Testes UI revisão (17.1-17.5) + co-migração páginas | 3 suítes 18/18 | ✓ | ✓ |
| 37-1-14 | Regressão + co-migração fixtures | suíte completa 2379 | ✓ | ✓ |
| 37-1-15 | Verificação final + UAT (este documento + `37-1-UAT.md`) | 4 gates verdes | ✓ | ✓ |

## 3. Matriz de Cobertura F37.1-01..F37.1-27

| Requisito | Cobertura (plano/teste) |
|-----------|-------------------------|
| F37.1-01 Constante CAMPAIGN_APPROVAL_ENABLED_KEY + ALL_FEATURE_FLAG_KEYS | 37-1-03 (grep), 37-1-14 (18.4) |
| F37.1-02 Método isCampaignApprovalEnabled fail-closed sem envOverride + export | 37-1-03 (grep), 37-1-14 (18.3, 5 cenários) |
| F37.1-03 Seed campaign_approval_enabled=false + admin sem novo RPC/CHECK | 37-1-02 (migration), 37-1-03 (verificação), 37-1-14 (18.4) |
| F37.1-04 Migration tabela campaign_art_versions (todas as colunas) + RLS | 37-1-02 (SQL + db push remoto) |
| F37.1-05 Colunas campaigns (approval_status/rejection_count/approved_version_id/approved_at) | 37-1-02 (SQL) |
| F37.1-06 Índice único parcial 1-approved | 37-1-02 (SQL), 37-1-10 Teste 13.6 (fonte) |
| F37.1-07 Sem backfill + sem alteração chk_generation_events_type | 37-1-02 (grep) |
| F37.1-08 RPC approve_campaign_art_version transacional | 37-1-02 (SQL), 37-1-11 Teste 14.1 (fonte) |
| F37.1-09 Tipos CampaignApprovalStatus/ArtVersionStatus/CampaignArtVersion + CampaignRecord | 37-1-04 (grep), typecheck |
| F37.1-10 createArtVersion + listArtVersions | 37-1-04, 37-1-12 Testes 15.x |
| F37.1-11 ApprovalDisplayState + computeApprovalState + isDeliveryReleased | 37-1-05, 37-1-10 Testes 13.1-13.5 |
| F37.1-12 Derivação (not_enabled/legacy/pending/approved/regenerating) | 37-1-05, 37-1-10 Testes 13.1-13.4, 13.7 |
| F37.1-13 isDeliveryReleased true/false; campaigns.status intocado | 37-1-05, 37-1-10 Teste 13.5/13.7 |
| F37.1-14 Candidata ativa (asset_status='active') — fonte oficial da arte | 37-1-05 (getActiveCandidateArtVersion), 37-1-09 |
| F37.1-15 generate-image insere v1 (flag on/off, fail-safe) | 37-1-06, 37-1-12 Testes 15.1/15.2 |
| F37.1-16 Gate de download (403 pending) | 37-1-07, 37-1-12 Testes 16.1-16.3, 16.5 |
| F37.1-17 Gate de publication-copy (403 antes de persistir) | 37-1-07, 37-1-12 Testes 16.4-16.5 |
| F37.1-18 Rota POST approve (guards + RPC + mapeamento) | 37-1-08, 37-1-11 Testes 14.1-14.4 |
| F37.1-19 page.tsx deriva estado + props approval | 37-1-09, 37-1-13 (page-server) |
| F37.1-20 CampaignApprovalView (aprovar, corrigir ausente, sem entrega/copy) | 37-1-09, 37-1-13 Testes 17.1-17.5 |
| F37.1-21 client.tsx roteia pending → revisão | 37-1-09, 37-1-13 (page) |
| F37.1-22 UX sem histórico recuperável (apenas candidata ativa) | 37-1-09, 37-1-13 Teste 17.3 |
| F37.1-23 A11y/mobile/microcopy | 37-1-09 (grep), 37-1-13 |
| F37.1-24 Testes (~17+ do checklist da fatia) | 37-1-10/11/12/13 (36 testes novos) |
| F37.1-25 Regressão + co-migração de fixtures | 37-1-14 (suíte completa 2379) |
| F37.1-26 Verificação 4 gates + UAT | 37-1-15 (este documento + `37-1-UAT.md`) |
| F37.1-27 Trackings (F37 em fatias 37.1/37.2/37.3) | 37-1-01 (grep-verificação) |

## 4. Verificação da Meta da Fase

- **Flag `campaign_approval_enabled` (fail-closed):** constante + `ALL_FEATURE_FLAG_KEYS` + `isCampaignApprovalEnabled()` → `readFlag(key, false)` sem envOverride; seed `false` na migration; listada no admin sem novo RPC/CHECK (37-1-02/03/14).
- **Base de dados:** tabela `campaign_art_versions` (1 candidata por vez, RLS service_role) + colunas de aprovação em `campaigns` + índice único parcial 1-approved + CHECK `campaigns_approved_requires_version` + RPC `approve_campaign_art_version` transacional (guarded update + defensivo + repontar) — **aplicadas no remoto** (37-1-02, aplicação manual pelo usuário, projeto `gvbzwihwgzujwsviufgy`).
- **generate-image insere v1:** candidata `pending`/`active` com `brief_snapshot` = `campaign_brief_v1` persistido quando a flag ligada; flag off → zero inserções; falha → log + continua (fail-safe, campanha legacy) (37-1-06).
- **Estado de aprovação + gating:** `ApprovalDisplayState` (not_enabled/legacy/pending/approved/regenerating) + `computeApprovalState` + `isDeliveryReleased` (fail-closed); gates em download e publication-copy (403 enquanto pending/regenerating com flag on) (37-1-05/07).
- **Tela de revisão:** campanha `ready` + `pending` → `CampaignApprovalView` (candidata ativa, sem entrega/copy, "Aprovar e liberar campanha", "Corrigir" ausente sem dialog); approved/legacy/not_enabled → `ReadyView` atual (37-1-09).
- **Rota approve:** `POST /api/campaign/[id]/approve` transacional com mapeamento correto (400/403/404/409/200); segunda aprovação idempotente (409) (37-1-08).

## 5. Pendências / Checkpoint

- **UAT humana PENDENTE (BLOCKING):** cenários 19.5–19.10 em `37-1-UAT.md` — a automação executou os itens automáticos (19.5 parcial: flag ligada via admin com auditoria; 19.7: "Corrigir" ausente/desabilitado); **19.6 (aprovar → entrega), 19.8 (campanha legada), 19.9 (flag desligada) e 19.10 (mobile 320px/375px) dependem de validação humana**.
- **Migrations aplicadas no remoto:** `20260901000001` e `20260901000002` aplicadas pelo usuário (37-1-02 resolvido).
- **Fail-closed de leitura da flag coberto por teste automatizado:** 37-1-14 (18.3 — not-found/erro → false).

## 6. Notas

- **Sem renumeração (D9):** F37 já numerada; F38–F43 concluídas; Stripe/Monetização Pública fora da numeração (v1.7+).
- **Sem correção em qualquer forma (37.2/37.3):** botão "Corrigir" ausente; sem parser, sem `/regenerate`, sem cap, sem `prompts/regen/*`; `rejection_count` criada mas nada escreve nela; `regenerating` inalcançável por fluxo (contrato reservado, coberto por teste de função pura 13.7).
- **Base pronta para a 37.2** (correção visual com referência) — schema/estado/contrato prontos.

---

*Fase 37.1 verificada: gates automáticos passed + UAT humana em andamento (ver `37-1-UAT.md`).*
