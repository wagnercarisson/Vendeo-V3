## 1. Trackings — confirmar/preencher F37 em fatias 37.1/37.2/37.3 (D11/D12)

- [ ] 1.1 **Pré-requisito:** confirmar F43 concluída nos trackings (`.planning/STATE.md` current_phase 43, 15/15 plans) e que `ROADMAP.md` (raiz) tem a linha 37 "Revisão e Aprovação da Arte | v1.5 | 0/0 | ○ Pending" — D11
- [ ] 1.2 `.planning/ROADMAP.md`: adicionar seção "### Phase 37 — Revisão e Aprovação da Arte" no formato das fases concluídas, com sub-seções **37.1/37.2/37.3** (goal/success criteria/dependencies por fatia; source of truth `openspec/changes/fase-37-revisao-aprovacao-arte/`); atualizar Dependency Graph (F39/F43 → F37) e rodapé "Last updated" — D11/D12
- [ ] 1.3 `.planning/STATE.md`: frontmatter `current_phase: 37`; seção da Fase 37 (fatias 37.1 → 37.2 → 37.3); "Current Position" + "Last updated" — D11
- [ ] 1.4 `.planning/PROJECT.md`: seção "Current Milestone: v1.5" → F37 em execução (37.1/37.2/37.3); confirmar F38–F43 concluídas e Stripe fora da numeração (iniciativa diferida v1.7+) — D11
- [ ] 1.5 `.planning/MILESTONES.md`: confirmar "Known Gaps" da v1.5 (Stripe diferida, fora da numeração) — D11
- [ ] 1.6 Verificação de consistência: grep nos 6 trackings por "F37" (estado e fatias) e "F38–F43 concluídas"/"Stripe diferida" — zero divergências (padrão F43-01) — D11

## 2. Migration — campaign_art_versions + colunas em campaigns + seed da flag (D7/D1)

- [ ] 2.1 Migration idempotente `20260901000001_f37_1_create_campaign_art_versions.sql`: tabela `campaign_art_versions` (`id` UUID PK, `campaign_id` FK CASCADE, `version_number` 1..3, `status` pending/approved/rejected, `correction_in_progress` bool default false, `storage_path` nullable, `asset_status` active/discarded default active, `asset_deleted_at`, `brief_snapshot` jsonb NOT NULL, `render_snapshot`, `generation_metadata`, `rejection_reason`, `created_at`, `UNIQUE(campaign_id, version_number)`) + RLS service_role-only (padrão `feature_flags`) — D7
- [ ] 2.2 Colunas em `campaigns` (`ADD COLUMN IF NOT EXISTS`): `approval_status` default 'pending_approval' CHECK IN ('pending_approval','approved'); `rejection_count` smallint default 0 CHECK 0..2; `approved_version_id` uuid FK; `approved_at`; CHECK `approval_status <> 'approved' OR approved_version_id IS NOT NULL` **via bloco idempotente `DO $$ ... IF NOT EXISTS (pg_constraint) ... END $$`** (evitar `ADD CONSTRAINT IF NOT EXISTS`, não portável no PostgreSQL/Supabase) — D7
- [ ] 2.3 Índice único parcial: 1 `approved` por `campaign_id` (`CREATE UNIQUE INDEX ... WHERE status='approved'`) — D7
- [ ] 2.4 Seed da flag `campaign_approval_enabled = false` (descrição administrativa; `ON CONFLICT (key) DO NOTHING`) — D1
- [ ] 2.5 **Sem backfill, sem alteração do CHECK `chk_generation_events_type`** (telemetria via metadata/`campaign_art_versions` — D8); seção REVERT completa — D7/D8

## 3. Migration — RPC approve_campaign_art_version (D8)

- [ ] 3.1 RPC `approve_campaign_art_version(p_campaign_id uuid, p_version_id uuid)` (`SECURITY DEFINER`, `SET search_path=''`, service_role-only, padrão `admin_update_feature_flag`): `SELECT ... FOR UPDATE` → valida `version_not_found`/`version_campaign_mismatch`/`version_not_pending`/`version_not_active` — D8
- [ ] 3.2 **Defensivo (D8):** no RPC, marcar como descartadas as demais linhas da campanha com `asset_status='active'` e `status <> 'approved'` (`asset_status='discarded'`, `storage_path=NULL`, `asset_deleted_at=now()`) — no-op na 37.1 — D8
- [ ] 3.3 No RPC: marcar a candidata `status='approved'` e atualizar `campaigns` (`storage_path` → aprovada, `approved_version_id`, `approved_at=now()`, `approval_status='approved'`) na mesma transação — D8
- [ ] 3.4 REVOKE/GRAINT do RPC (service_role); seção REVERT — D8

## 4. Flag — campaign_approval_enabled (D1, padrão F43/QCW)

- [ ] 4.1 `src/lib/feature-flags/feature-flag-service.ts`: constante `CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled"`; incluir em `ALL_FEATURE_FLAG_KEYS` — D1
- [ ] 4.2 Método `isCampaignApprovalEnabled(): Promise<boolean>` → `readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)` (**fail-closed**, sem envOverride) + export de conveniência `isCampaignApprovalEnabled()` — D1
- [ ] 4.3 **Sem novo RPC/CHECK**: a tela admin "Controles operacionais" e o `GET /api/admin/feature-flags` já listam a nova flag via `ALL_FEATURE_FLAG_KEYS` (mutação com motivo obrigatório + auditoria já existentes — F43) — verificação apenas — D1

## 5. Types (D7)

- [ ] 5.1 `src/lib/campaign/types.ts`: `CampaignApprovalStatus`, `ArtVersionStatus`, interface `CampaignArtVersion` (com `correction_in_progress`, `asset_status`, `storage_path` nullable, `brief_snapshot`, `rejection_reason: Record<string, unknown> | null`) — D7
- [ ] 5.2 `CampaignRecord` estendido com `approval_status`, `rejection_count`, `approved_version_id`, `approved_at` — D7
- [ ] 5.3 **NÃO** criar tipos de correção (`RejectionReason`, `ArtCorrectionStrategy`, `BriefPatch`, `CorrectionIntent`) — são 37.2/37.3 — D12

## 6. Persistência — createArtVersion / listArtVersions (D7)

- [ ] 6.1 `src/lib/campaign/persistence.ts`: `createArtVersion(campaignId, versionNumber, storagePath, briefSnapshot)` → INSERT (`status='pending'`, `asset_status='active'`) — D7
- [ ] 6.2 `listArtVersions(campaignId)` → linhas ordenadas por `version_number` — D7
- [ ] 6.3 **NÃO** criar `markVersionRejected`/`discardArtAsset`/`setCorrectionInProgress` (37.2) — D12

## 7. Display — ApprovalDisplayState + gating (D2 + decisões 3/5)

- [ ] 7.1 `src/lib/campaign/display.ts`: `ApprovalDisplayState` (`not_enabled | legacy | pending | approved(approvedAt) | regenerating`), `computeApprovalState(campaign, versions, flagEnabled)`, `isDeliveryReleased(state)` — D2
- [ ] 7.2 `computeApprovalState`: `!flagEnabled → not_enabled`; flag + zero versões → `legacy`; `approved_version_id` → `approved`; candidata com `correction_in_progress=true` → `regenerating` (inalcançável na 37.1 — contrato reservado); senão `pending` — D2/decisão 5
- [ ] 7.3 `isDeliveryReleased` = true para `not_enabled|legacy|approved`; false para `pending|regenerating` — D2
- [ ] 7.4 Helper de leitura da **candidata ativa** (`asset_status='active'`) em `campaign_art_versions` — decisão 3 (fonte oficial da arte da revisão)

## 8. generate-image — insere v1 quando a flag está ligada (D8/D10)

- [ ] 8.1 `src/app/api/campaign/generate-image/route.ts`: após o sucesso de `createCampaign` (pré-stream), ler `isCampaignApprovalEnabled()`; se `true`, `createArtVersion(campaign.id, 1, campaign.storagePath, inputSnapshot)` (`inputSnapshot` = objeto `campaign_brief_v1` persistido) — D8/D10
- [ ] 8.2 **Fail-safe:** falha no insert da v1 → log de erro operacional + continua a geração (campanha exibida como `legacy`; a flag nunca derruba o fluxo) — D1
- [ ] 8.3 Flag off → nenhuma inserção (comportamento atual); sem persistência nova de produto fonte (F41) — decisão 2/D10

## 9. Rota download — gate de aprovação (D2)

- [ ] 9.1 `src/app/api/campaign/[id]/download/route.ts`: após auth + ownership, ler `isCampaignApprovalEnabled()` + `listArtVersions(campaign.id)` → `computeApprovalState`; `!isDeliveryReleased(state)` → **403** `{ error: "Campaign pending approval" }` — D2
- [ ] 9.2 `not_enabled`/`legacy`/`approved` → serve `campaign.storage_path` como hoje (aprovada repontada no approve) — D2

## 10. Rota publication-copy — gate de aprovação (decisão 4)

- [ ] 10.1 `src/app/api/campaign/[id]/publication-copy/route.ts`: após auth + ownership (antes de persistir), ler `isCampaignApprovalEnabled()` + `listArtVersions(campaign.id)` → `computeApprovalState`; `!isDeliveryReleased(state)` → **403** (nada é persistido) — decisão 4
- [ ] 10.2 `not_enabled`/`legacy`/`approved` → edição normal e restore preservados (comportamento atual) — decisão 4

## 11. Rota POST /api/campaign/[id]/approve (D8)

- [ ] 11.1 Nova rota `src/app/api/campaign/[id]/approve/route.ts`: `requireSameOrigin` → `requireApiUser` → UUID v4 (400) → `getCampaign` (404) → `requireOwnership` (404) → `!isCampaignApprovalEnabled()` → **403** → `campaign.status !== 'ready'` → **409** → zod body `{ versionId }` (strict) — D8
- [ ] 11.2 Chamar `rpc('approve_campaign_art_version', { p_campaign_id, p_version_id })`; mapear erros: `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active` → 409 — D8
- [ ] 11.3 Sucesso → `200 { campaignUrl: "/campanhas/{id}", status: "approved" }`; telemetria sem novo `generation_type` (funil = `campaign_art_versions.status` + `campaigns.approved_at`) — D8

## 12. UI — tela de revisão da candidata (decisões 3/12 + D2)

- [ ] 12.1 `[id]/page.tsx`: para campanhas `ready`, ler `isCampaignApprovalEnabled()` + `listArtVersions(id)` → `computeApprovalState`; estender props com `approval` (`state`, `candidateImageUrl`, `candidateVersionId`) — D2/decisão 3
- [ ] 12.2 Novo componente `src/components/campaign/campaign-approval-view.tsx` (client): arte da candidata ativa (signed URL), botão primário **"Aprovar e liberar campanha"**, botão secundário **"Corrigir" ausente** (ou desabilitado) que **nunca abre modal**; sem download, sem Kit/copy — decisão 3/D12
- [ ] 12.3 Aprovar → `POST approve { versionId }` → `router.refresh()` → entrega (arte + copys + download, como hoje); estados loading/erro PT-BR — D8
- [ ] 12.4 `[id]/client.tsx`: renderiza `CampaignApprovalView` quando `approval.state === "pending"`; `approved`/`legacy`/`not_enabled` → `ReadyView` atual — D2/decisão 3
- [ ] 12.5 A11y/mobile/microcopy: touch ≥ 44px, `label`/`aria`, "Revise a arte antes de liberar: a IA pode cometer erros.", imagem sem recorte (`object-contain`), sem scroll horizontal em 320px/375px, tema dark (tokens) — design-system

## 13. Testes — estados de aprovação (alinhamento 1–4, 6, 8)

- [ ] 13.1 Teste 1: `computeApprovalState` flag off → `not_enabled` (comportamento atual preservado) — D2
- [ ] 13.2 Teste 2: flag on + zero versões → `legacy` (campanha antiga entregue mesmo com flag ligada) — D2
- [ ] 13.3 Teste 3: flag on + versões + sem aprovada → `pending` — D2
- [ ] 13.4 Teste 4: `approved_version_id` → `approved` + `approvedAt` — D2
- [ ] 13.5 Teste 6: `isDeliveryReleased` true para `not_enabled`/`legacy`/`approved`; false para `pending`/`regenerating` — D2
- [ ] 13.6 Teste 8: índice único parcial — não permite 2 `approved` por campanha (constraint da migration) — D7
- [ ] 13.7 Novo: `campaigns.status` permanece `ready` quando `regenerating` derivado (sem tocar no enum — decisão 5; contrato, exercitado na 37.2) — decisão 5

## 14. Testes — aprovação transacional e candidata (alinhamento 7, 10)

- [ ] 14.1 Teste 7: aprovação da candidata — vira `approved`; nenhuma outra linha retém asset ativo (defensivo) — D8
- [ ] 14.2 Teste 10: só a candidata (`asset_status='active'`) é aprovável; rejeitadas/descartadas não são oferecidas para aprovação — D7/D8
- [ ] 14.3 Novo: RPC `version_not_pending` (já resolvida) → 409 e nada é alterado; `version_campaign_mismatch` → 404 — D8
- [ ] 14.4 Novo: rota approve — ownership → 404; flag off → 403; campanha não `ready` → 409 — D8

## 15. Testes — generate-image v1 (alinhamento 29)

- [ ] 15.1 Teste 29: `generate-image` com flag on insere v1 em `campaign_art_versions` (pending, active, brief_snapshot = snapshot persistido); flag off não insere (comportamento atual); sem persistência nova de produto fonte (F41) — D7/D1/decisão 2
- [ ] 15.2 Novo: falha no insert da v1 com flag ligada → geração continua (log de erro; campanha exibida como legacy) — D1

## 16. Testes — download e copy gated (alinhamento 30–35)

- [ ] 16.1 Teste 30: download com `pending` + flag on → 403 — D2
- [ ] 16.2 Teste 31: download após aprovação → 200 (servindo a arte aprovada) — D2/D8
- [ ] 16.3 Teste 32: download de campanha **legacy** (flag on, sem versões) → 200 — D2
- [ ] 16.4 Teste 35: `PATCH /publication-copy` com `pending`/`regenerating` + flag on → 403 (nada persistido); após aprovação → 200; legado → 200 — decisão 4
- [ ] 16.5 Novo: flag off → download e copy funcionam como hoje (fail-closed) — D1

## 17. Testes — UI da revisão (alinhamento 33, 34, 39, 40)

- [ ] 17.1 Teste 33: copy oculto até aprovar (a revisão não renderiza Kit de Publicação) — D2
- [ ] 17.2 Teste 34: copy visível após aprovação (editável, F17 preservado) — D2
- [ ] 17.3 Teste 39: UI mostra **apenas a candidata ativa**; nenhuma versão anterior é selecionável/recuperável — decisão 12
- [ ] 17.4 Teste 40: revisão renderiza da candidata ativa em `campaign_art_versions`; legado renderiza de `campaigns.storage_path` — decisão 3
- [ ] 17.5 Novo: botão secundário "Corrigir" ausente/desabilitado e **nenhum modal de correção abre** na 37.1 — D12/decisão 3

## 18. Regressão e co-migração

- [ ] 18.1 `route.test.ts` (generate-image): fixtures co-migradas para a inserção da v1 (flag on/off) sem quebrar o fluxo atual — D8
- [ ] 18.2 `download`/`publication-copy` route tests existentes co-migrados para o gate (flag off e legado preservam o comportamento) — D2/decisão 4
- [ ] 18.3 `feature-flag-service.test.ts` co-migrado: `campaign_approval_enabled` fail-closed (leitura ok, not-found, falha) — D1
- [ ] 18.4 `admin/feature-flags` page/route tests co-migrados: nova flag listada; alteração com motivo obrigatório + auditoria (F43 infra, sem novo RPC/CHECK) — D1
- [ ] 18.5 `campaign-page`/`campaign-approval-view` tests novos + co-migrados; fixtures de `display`/`persistence` atualizadas — D2/D7
- [ ] 18.6 Regressão: geração completa, créditos/reserva (F24/F25/F38), legado e flag off **inalterados** — D1/D8

## 19. Verificação (gates + UAT)

- [ ] 19.1 `npx vitest run` — zero falhas (novos + co-migrados) — D2–D8
- [ ] 19.2 `npm run typecheck` — zero erros
- [ ] 19.3 `npm run lint` — zero erros
- [ ] 19.4 `npm run build` — build bem-sucedido
- [ ] 19.5 UAT: flag ligada na tela "Controles operacionais" (motivo + auditoria) → gerar campanha nova → cai na tela de revisão (candidata v1, sem download/copy) — D1/D2
- [ ] 19.6 UAT: aprovar a candidata → entrega liberada (arte + copys + download, como hoje) — D8
- [ ] 19.7 UAT: botão "Corrigir" ausente/desabilitado na 37.1 (nenhum modal abre) — D12
- [ ] 19.8 UAT: campanha antiga (pré-flag) continua entregue sem gate (legacy) — D2
- [ ] 19.9 UAT: flag desligada → fluxo atual intacto (entrega imediata, download livre, copy visível); leitura da flag falhando → comportamento atual (fail-closed) — D1
- [ ] 19.10 UAT: mobile real/estreito (320px/375px) na tela de revisão — imagem sem recorte, touch ≥ 44px, sem scroll horizontal
