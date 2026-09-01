# Phase 37.1: Approval Gate + Candidata Única — Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-37-1-approval-gate-candidata-unica/`) — fonte da verdade (decisão do usuário 2026-09-01: usar a pasta real da fatia, padrão F38.1/F38.2)

<domain>
## Phase Boundary

Hoje o Vendeo gera a campanha e a entrega no exato momento em que ela fica `ready`: o lojista cai direto na página com download + Kit de Publicação (`/campanhas/[id]` → `ReadyView`). Não existe passo de aprovação da arte — o valor central ("campanha publicável") é entregue sem confirmação humana, e a primeira geração que não agrada só tem dois caminhos: gerar outra campanha (outro crédito) ou desistir. A **F37 — Revisão e Aprovação da Arte** (v1.5, experimento beta controlado por feature flag) transforma a primeira entrega em um **ciclo de aprovação** guiado. Esta é a **base técnica da fatia 37.1 — Approval Gate + Candidata Única** (D12), que entrega valor parcial: valida o modelo de aprovação **sem tocar no pipeline de imagem** (mitiga regressão no core). Fonte da verdade: `openspec/changes/fase-37-1-approval-gate-candidata-unica/` (proposal.md, design.md D1–D10, 7 specs, tasks.md).

**Estado real verificado em código (2026-09-01):**

- **Entrega imediata hoje:** `POST /api/campaign/generate-image` cria a campanha (`route.ts:455-460`, `createCampaign` com `campaignIdPre` e `inputSnapshot` = `buildCampaignBriefSnapshot(brief)`, linha `:452`) e reserva crédito (`:480`); ao ficar `ready`, `/campanhas/[id]` renderiza `ReadyView` (`[id]/client.tsx`) com arte + Kit de Publicação + "Baixar Original". Não existe passo de aprovação.
- **Rotas de entrega sem gate:** `GET /api/campaign/[id]/download/route.ts` serve `campaign.storage_path` direto (após auth + ownership, `:23-28`). `PATCH /api/campaign/[id]/publication-copy/route.ts` persiste `publication_copy_current` (após CSRF + auth + ownership + validação, `:33`/`:53-75`).
- **Display:** `src/lib/campaign/display.ts` tem `getCampaignForDisplay`, `generateSignedPreviewUrl`, `computeDisplayStatus` e `mapCampaignToProps` (com `CampaignPageProps`) — **sem estado de aprovação**. A página `[id]/page.tsx` gera o signed URL de `campaign.storage_path` quando `ready` (`:32-35`).
- **Persistência:** `src/lib/campaign/persistence.ts` tem `createCampaign` (com `operation_run_id`, F38.1), `updateCampaignReady`, `getCampaign`, `uploadCampaignImage`, `deleteCampaignImage`, `uploadCampaignInputImage`, `removeCampaignInputs` (F41) — sem funções de versão de arte.
- **Types:** `src/lib/campaign/types.ts` — `CampaignRecord` sem `approval_status`/`approved_version_id`/`approved_at`/`rejection_count`.
- **Flags (padrão F43/QCW):** `src/lib/feature-flags/feature-flag-service.ts` — `FeatureFlagService.readFlag(key, fallback, envOverride?)`, `ALL_FEATURE_FLAG_KEYS` (tela admin "Controles operacionais"), RPC `admin_update_feature_flag` genérico por `key` com auditoria atômica (sem mudança de RPC/CHECKs para nova flag). `admin/feature-flags/page.tsx` + `api/admin/feature-flags/route.ts` renderizam as flags de `ALL_FEATURE_FLAG_KEYS`.
- **Transacionalidade em banco (precedente):** RPCs `SECURITY DEFINER` com `SET search_path=''` (F43 `admin_update_feature_flag`, F38 access_requests) — padrão para a aprovação atômica.
- **Snapshot:** `buildCampaignBriefSnapshot(brief)` produz o `campaign_brief_v1` persistido em `campaigns.input_snapshot` (F39, sem base64) — fonte do `brief_snapshot` por versão.
- **Migrations:** existe até `20260831000001_f44_1_1_theme_visual_reference.sql`; a fatia adiciona `20260901000001_f37_1_create_campaign_art_versions.sql` + `20260901000002_f37_1_approve_campaign_art_version_rpc.sql` (sem conflito de numeração).

**Contrato com fatias futuras (NÃO implementado aqui):** Correction Brief Parser, `briefPatch`/`validateBriefPatch`, referência de arte na regeração, cap de correções, `/regenerate`, modal em 2 etapas, `prompts/regen/*`, `rebuildBriefFromSnapshot`, estratégia A/B — tudo **37.2/37.3** (ver proposal). A coluna `rejection_count` nasce no schema (D7) mas **nada escreve nela** na 37.1.

**O que esta fatia entrega:**

- **Flag `campaign_approval_enabled` em `feature_flags` (D1)** — padrão F43/QCW: nova `key` (default `false`, **fail-closed**), leitura via `FeatureFlagService.isCampaignApprovalEnabled()` (fallback seguro), inclusão em `ALL_FEATURE_FLAG_KEYS` → tela admin "Controles operacionais" (motivo obrigatório + auditoria já existentes). **Sem env/launch-config** para a flag principal. Estratégia de correção (text_only × text_plus_reference) **NÃO** entra nesta fatia (37.2).
- **Nova tabela `campaign_art_versions` (D7)** — 1 candidata por vez; colunas `status` (`pending|approved|rejected`), `asset_status` (`active|discarded`), `correction_in_progress` (marcador, decisão 5), `storage_path` nullable, `brief_snapshot` (jsonb `campaign_brief_v1`, F39, sem base64), `render_snapshot`, `generation_metadata`, `rejection_reason`, `created_at`, `UNIQUE(campaign_id, version_number)`, índice único parcial **1 `approved` por `campaign_id`**.
- **Colunas em `campaigns` (D7)** — `approval_status` (`pending_approval|approved`), `rejection_count` (smallint 0..2, schema; guard do cap é 37.2), `approved_version_id` (FK opcional), `approved_at`. **Sem backfill** (campanhas `ready` pré-flag permanecem como estão — legacy, D2). **Sem alteração** no CHECK de `generation_events` (telemetria via metadata/campaign_art_versions, D8).
- **`generate-image` insere v1 (D8/D10, mínimo)** — quando a flag está ligada, o `POST /api/campaign/generate-image` passa a **também** inserir `campaign_art_versions` (v1, `pending`, `asset_status='active'`, `brief_snapshot` = snapshot `campaign_brief_v1` persistido). Flag off → comportamento atual inalterado.
- **Estado de aprovação explícito (D2 + decisões 3/5)** — novo `ApprovalDisplayState` (`not_enabled | legacy | pending | approved | regenerating`) + `computeApprovalState(campaign, versions, flagEnabled)` + `isDeliveryReleased(state)` em `src/lib/campaign/display.ts`. **Estado `legacy` explícito:** flag ligada + zero linhas em `campaign_art_versions` → entregue como hoje, sem gate. `regenerating` é **derivado** do marcador `correction_in_progress` (decisão 5) e é **inalcançável por fluxo nesta fatia** (nenhum fluxo/UI/rota seta `correction_in_progress=true` — correção é 37.2) — entra no tipo para o contrato do módulo e para `isDeliveryReleased`, e é coberto por **testes de contrato puro** em `computeApprovalState`/`isDeliveryReleased` (decisão do usuário 2026-09-01: o tipo e a coluna já nascem nesta fatia para preservar o contrato da 37.2; "não exercita regenerating" = nenhum fluxo/UI/rota, não nenhum teste de função pura). Fonte oficial da arte exibida = **candidata ativa** (`asset_status='active'` em `campaign_art_versions`, decisão 3); legado continua usando `campaigns.storage_path`.
- **Download e copy gated (D2 + decisão 4)** — `GET /api/campaign/[id]/download` e `PATCH /api/campaign/[id]/publication-copy` verificam o estado de aprovação: `pending`/`regenerating` (flag on) → **403**; `not_enabled`/`legacy`/`approved` → liberados como hoje.
- **Tela de revisão da candidata (decisões 3/12) + aprovar** — `/campanhas/[id]` com flag ligada e campanha nova não aprovada exibe a **tela de revisão** (`CampaignApprovalView`): arte candidata ativa (sem download, sem copy/Kit de Publicação), botão primário **"Aprovar e liberar campanha"** e botão secundário **"Corrigir" ausente (ou desabilitado) que nunca abre modal** — correção NÃO existe na 37.1. **Nenhuma versão anterior é selecionável/recuperável** (decisão 12).
- **`POST /api/campaign/[id]/approve` (nova rota, D8 transacional)** — guards (ownership + flag + versão alvo válida); transação: aprova a **candidata** (`pending` → `approved`), **defensivo** garante que nenhuma outra linha retenha asset ativo, atualiza `campaigns` (`storage_path` → aprovada, `approved_version_id`, `approved_at`, `approval_status='approved'`), registra telemetria de aprovação **sem novo `generation_type`**. Após aprovar, entrega liberada como hoje (arte aprovada + copys + download).
- **Trackings (D11/D12)** — sem renumeração (F37 já numerada; F38–F43 concluídas; Stripe fora da numeração). Confirmar/preencher trackings: F37 em execução com **fatias 37.1/37.2/37.3** (padrão F38/38.1/38.2). **Decisão do usuário (2026-09-01):** usar a pasta real da fatia `openspec/changes/fase-37-1-approval-gate-candidata-unica/` como source of truth nos trackings/CONTEXT (não a expressão guarda-chuva `fase-37-revisao-aprovacao-arte/` do D12).

## Constraints

- **Sem correção em qualquer forma (D12/decisões 3/12)** — botão "Corrigir" ausente/desabilitado que **nunca abre modal**; sem parser, sem `/regenerate`, sem cap, sem `prompts/regen/*`, sem referência de arte (37.2); sem correção factual de briefing `briefPatch`/`validateBriefPatch` (37.3).
- **Sem escrever em `rejection_count`** — coluna criada (D7), guard do cap é 37.2.
- **Sem exercitar `regenerating` por fluxo** — estado no tipo do módulo (contrato de `isDeliveryReleased`), inalcançável na 37.1 (nada seta `correction_in_progress`); **testes de contrato puro** em `computeApprovalState`/`isDeliveryReleased` permitidos (decisão do usuário 2026-09-01: "nenhum fluxo/UI/rota exercita", não "nenhum teste").
- **Sem `setCorrectionInProgress`/`markVersionRejected`/`discardArtAsset`** — funções da correção (37.2).
- **Sem mudar `campaigns.status`** para representar correção (decisão 5 — permanece `generating|ready|error`).
- **Sem alterar CHECK `chk_generation_events_type`** (telemetria por metadata/`campaign_art_versions` — D8).
- **Sem backfill / gate retroativo** — campanhas `ready` pré-flag permanecem entregues (legacy, D2).
- **Sem galeria de versões aprováveis, v4+, meia cobrança, nova `operation_key`** — fora do beta (D3).
- **Sem tocar no pipeline de imagem / providers / prompts / créditos** — intocados.
- **Flag fail-closed (D1)** — `isCampaignApprovalEnabled()` → `readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)`, sem `envOverride`; falha de leitura/not-found → `false` → comportamento atual; a flag nunca derruba o fluxo de geração/entrega.
- **Fail-safe no insert da v1 (D1/D8)** — falha no insert da v1 com flag ligada → log de erro operacional + continua a geração; campanha exibida como `legacy` (entregue).
- **Sem env/launch-config** para a flag principal (decisão 1 — env var seria apenas fail-safe emergencial de infra, não decisão).
- **Migrações idempotentes, não destrutivas, RLS service_role-only** (padrão `feature_flags`); `campaign_art_versions` com RLS habilitada e acesso somente `service_role`.
- **Deploy fail-closed (ordem):** migrations antes do código que as consome; deploy com a flag `false` (default) — leitura fail-closed garante comportamento atual mesmo sem a migration.
- **Transação de aprovação atômica (D8)** — RPC `approve_campaign_art_version` (`SECURITY DEFINER`, `SET search_path=''`, service_role-only); se qualquer passo falhar, nada é aplicado (ROLLBACK).
- **Anti-concorrência** — guarded update do RPC + índice único parcial 1-approved tornam a segunda aprovação idempotente (409).
- **Telemetria sem novo `generation_type`** — funil de aprovação via `campaign_art_versions.status` + `campaigns.approved_at`; custo por campanha aprovada já aparece no painel F38.2 via `operation_run_id` (sem mudança).
- **Artefatos históricos não são reescritos** na renumeração; `openspec/changes/fase-37-1-approval-gate-candidata-unica/` é a fonte da verdade (decisão do usuário 2026-09-01).

## Dependencies

- F39 (Brief Estruturado de Campanha — domínio `CampaignBrief`/snapshot `campaign_brief_v1`, `buildCampaignBriefSnapshot`, mapper)
- F40 (Campos Comerciais e Avisos do Brief — form state `validity`/`mandatoryArtworkText`, `ILLUSTRATIVE_NOTICE_TEXT`)
- F41 (Mídia de Campanha Mobile — multi-imagem `productImages[]`, persistência de inputs com `storagePath`, `campaignId` pré-gerado)
- F43 (Revisão do Brief Pré-Geração — infra `feature_flags` + `FeatureFlagService` + `ALL_FEATURE_FLAG_KEYS` + admin "Controles operacionais" + RPC `admin_update_feature_flag`)
- F31.x (intents, prompts por intent, diretores, revisor) — via pipeline, sem mudança
- F38/F38.1 (custos/telemetria — `operation_run_id` já persistido em `campaigns`, preparo reuso F37; sem mudança nesta fatia)
- F24/F25 (pipeline de créditos/generação — reserva/dedução/estorno intactos)
- F38.2.1 (snapshot econômico — padrão de snapshot imutável)
- **Antecede** a 37.2 (correção visual com referência) e 37.3 (correção factual de briefing) — contratos de schema/estado prontos (D7)

## Key Requirements

Mapeados dos 7 specs OpenSpec + tasks.md (fonte: `openspec/changes/fase-37-1-approval-gate-candidata-unica/`):

- **F37.1-01** (feature-flag-control): constante `CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled"` em `feature-flag-service.ts` + inclusão em `ALL_FEATURE_FLAG_KEYS` (D1)
- **F37.1-02** (feature-flag-control): método `isCampaignApprovalEnabled(): Promise<boolean>` → `readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)` (**fail-closed**, sem envOverride) + export de conveniência `isCampaignApprovalEnabled()` (D1)
- **F37.1-03** (feature-flag-control): seed `campaign_approval_enabled = false` na migration (descrição administrativa; `ON CONFLICT (key) DO NOTHING`); admin "Controles operacionais" lista a nova flag via `ALL_FEATURE_FLAG_KEYS` sem novo RPC/CHECK (verificação) (D1)
- **F37.1-04** (campaign-art-versions): migration idempotente `20260901000001_f37_1_create_campaign_art_versions.sql` — tabela `campaign_art_versions` (id UUID PK, campaign_id FK CASCADE, version_number 1..3, status pending/approved/rejected, correction_in_progress default false, storage_path nullable, asset_status active/discarded default active, asset_deleted_at, brief_snapshot jsonb NOT NULL, render_snapshot, generation_metadata, rejection_reason, created_at, UNIQUE(campaign_id, version_number)) + RLS service_role-only + seção REVERT (D7)
- **F37.1-05** (campaign-art-versions): colunas em `campaigns` (`ADD COLUMN IF NOT EXISTS`): `approval_status` default 'pending_approval' CHECK IN ('pending_approval','approved'); `rejection_count` smallint default 0 CHECK 0..2; `approved_version_id` uuid FK; `approved_at`; CHECK `approval_status <> 'approved' OR approved_version_id IS NOT NULL` via bloco idempotente `DO $$ ... IF NOT EXISTS (pg_constraint) ... END $$` (sem `ADD CONSTRAINT IF NOT EXISTS`, não portável) (D7)
- **F37.1-06** (campaign-art-versions): índice único parcial 1 `approved` por `campaign_id` (`CREATE UNIQUE INDEX ... WHERE status='approved'`) (D7)
- **F37.1-07** (campaign-art-versions): **sem backfill**; **sem alteração do CHECK `chk_generation_events_type`** (D7/D8)
- **F37.1-08** (campaign-art-versions): migration `20260901000002_f37_1_approve_campaign_art_version_rpc.sql` — RPC `approve_campaign_art_version(p_campaign_id uuid, p_version_id uuid)` (`SECURITY DEFINER`, `SET search_path=''`, service_role-only): `SELECT ... FOR UPDATE` → valida `version_not_found`/`version_campaign_mismatch`/`version_not_pending`/`version_not_active`; **defensivo** marca demais linhas ativas como descartadas (`asset_status='discarded'`, `storage_path=NULL`, `asset_deleted_at=now()` — no-op na 37.1); marca a candidata `approved`; atualiza `campaigns` (storage_path → aprovada, approved_version_id, approved_at=now(), approval_status='approved') na mesma transação; REVOKE/GRANT service_role + REVERT (D8)
- **F37.1-09** (campaign-art-versions): tipos em `src/lib/campaign/types.ts` — `CampaignApprovalStatus`, `ArtVersionStatus`, interface `CampaignArtVersion` (com `correction_in_progress`, `asset_status`, `storage_path` nullable, `brief_snapshot`, `rejection_reason: Record<string, unknown> | null`); `CampaignRecord` estendido com `approval_status`, `rejection_count`, `approved_version_id`, `approved_at` (D7)
- **F37.1-10** (campaign-art-versions): `createArtVersion(campaignId, versionNumber, storagePath, briefSnapshot)` → INSERT (`status='pending'`, `asset_status='active'`) e `listArtVersions(campaignId)` → ordenado por `version_number` em `src/lib/campaign/persistence.ts` (D7)
- **F37.1-11** (campaign-approval-gate): `ApprovalDisplayState` (`not_enabled | legacy | pending | approved(approvedAt) | regenerating`), `computeApprovalState(campaign, versions, flagEnabled)`, `isDeliveryReleased(state)` em `src/lib/campaign/display.ts` (D2)
- **F37.1-12** (campaign-approval-gate): derivação — `!flagEnabled → not_enabled`; flag + zero versões → `legacy`; `approved_version_id` → `approved` (+`approvedAt`); candidata com `correction_in_progress=true` → `regenerating` (inalcançável na 37.1 — contrato reservado); senão `pending` (D2/decisão 5)
- **F37.1-13** (campaign-approval-gate): `isDeliveryReleased` = true para `not_enabled|legacy|approved`; false para `pending|regenerating`; `campaigns.status` NÃO muda para representar correção (decisão 5) (D2)
- **F37.1-14** (campaign-approval-gate): helper de leitura da **candidata ativa** (`asset_status='active'`) em `campaign_art_versions` — fonte oficial da arte da revisão (decisão 3)
- **F37.1-15** (ai-image-generation): `generate-image` — após o sucesso de `createCampaign` (pré-stream), ler `isCampaignApprovalEnabled()`; se `true`, `createArtVersion(campaign.id, 1, campaign.storagePath, inputSnapshot)` (`inputSnapshot` = objeto `campaign_brief_v1` persistido); **fail-safe** (falha → log + continua, campanha legacy); flag off → nenhuma inserção; sem persistência nova de produto fonte (F41) (D8/D10/decisão 2)
- **F37.1-16** (campaign-download-route): gate em `GET /api/campaign/[id]/download` — após auth + ownership, ler flag + `listArtVersions` + `computeApprovalState`; `!isDeliveryReleased(state)` → **403** `{ error: "Campaign pending approval" }`; `not_enabled`/`legacy`/`approved` → serve `campaign.storage_path` como hoje (D2)
- **F37.1-17** (publication-copy-route): gate em `PATCH /api/campaign/[id]/publication-copy` — após auth + ownership (antes de persistir), ler flag + `listArtVersions` + `computeApprovalState`; `!isDeliveryReleased(state)` → **403** (nada persistido); `not_enabled`/`legacy`/`approved` → comportamento atual (edição + restore) (decisão 4)
- **F37.1-18** (campaign-approval-gate): rota `POST /api/campaign/[id]/approve` — `requireSameOrigin` → `requireApiUser` → UUID v4 (400) → `getCampaign` (404) → `requireOwnership` (404) → `!isCampaignApprovalEnabled()` → **403** → `campaign.status !== 'ready'` → **409** → zod body `{ versionId: uuid }` → `rpc('approve_campaign_art_version', { p_campaign_id, p_version_id })`; mapeamento: `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active` → 409; sucesso → `200 { campaignUrl: "/campanhas/{id}", status: "approved" }` (D8)
- **F37.1-19** (campaign-page-ui): `[id]/page.tsx` para campanhas `ready` — ler `isCampaignApprovalEnabled()` + `listArtVersions(id)` → `computeApprovalState`; estender `CampaignPageProps` com `approval?: { state, candidateImageUrl?, candidateVersionId? }` (D2/decisão 3)
- **F37.1-20** (campaign-page-ui): novo componente `src/components/campaign/campaign-approval-view.tsx` (client) — arte da candidata ativa (signed URL), botão primário **"Aprovar e liberar campanha"**, botão secundário **"Corrigir" ausente** (ou desabilitado) que **nunca abre modal**; sem download, sem Kit/copy; aprovar → `POST approve { versionId }` → `router.refresh()` → entrega; estados loading/erro PT-BR (D8/decisões 3/12)
- **F37.1-21** (campaign-page-ui): `[id]/client.tsx` — renderiza `CampaignApprovalView` quando `approval.state === "pending"`; `approved`/`legacy`/`not_enabled` → `ReadyView` atual (D2/decisão 3)
- **F37.1-22** (campaign-page-ui): UX sem histórico recuperável — mostra **apenas a candidata ativa**; nenhuma versão anterior selecionável/recuperável (decisão 12)
- **F37.1-23** (campaign-page-ui): a11y/mobile/microcopy — touch ≥ 44px, `label`/`aria`, "Revise a arte antes de liberar: a IA pode cometer erros.", imagem sem recorte (`object-contain`), sem scroll horizontal em 320px/375px, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`) (design-system)
- **F37.1-24** (testes, tasks 13-17): ~17+ testes do checklist da fatia — estados (1-4, 6, 8, novo decision 5), aprovação transacional (7, 10, novos RPC/rota), generate-image v1 (29, novo fail-safe), download/copy gated (30-32, 35, novo flag-off), UI revisão (33-34, 39-40, novo corrigir) (alinhamento 1-4, 6-8, 10, 29-35, 39-40)
- **F37.1-25** (regressão, tasks 18): co-migração de fixtures `route.test.ts` (generate-image), download/publication-copy tests, `feature-flag-service.test.ts`, admin feature-flags tests, fixtures de `display`/`persistence`; regressão geração/créditos/legado/flag-off (D1–D8)
- **F37.1-26** (verificação, task 19): `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros; UAT local com flag ligada/desligada e campanha legada (D2–D8)
- **F37.1-27** (trackings, D9/task 1): confirmar/preencher F37 em fatias 37.1/37.2/37.3 nos 6 arquivos (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `.planning/REQUIREMENTS.md`) — source of truth `openspec/changes/fase-37-1-approval-gate-candidata-unica/` (D11/D12)

## Out of Scope

- **Correção em qualquer forma** — botão "Corrigir" nunca abre modal; sem parser, sem `/regenerate`, sem cap, sem `prompts/regen/*`, sem referência de arte (37.2)
- **Correção factual de briefing** (`briefPatch`/`validateBriefPatch`) (37.3)
- **Escrever em `rejection_count`** — coluna criada (D7), guard do cap é 37.2
- **Exercitar `regenerating`** — estado no tipo do módulo, inalcançável na 37.1 (nada seta `correction_in_progress`)
- **`setCorrectionInProgress`/`markVersionRejected`/`discardArtAsset`** — funções da correção (37.2)
- **`rebuildBriefFromSnapshot` / reabertura do `operation_run_id` cross-request** (37.2)
- **Estratégia de correção A/B** (text_only × text_plus_reference) e flag de estratégia (37.2)
- **Mudar `campaigns.status`** para representar correção (decisão 5 — permanece `generating|ready|error`)
- **Alterar CHECK `chk_generation_events_type`** (telemetria por metadata/`campaign_art_versions` — D8)
- **Backfill / gate retroativo** — campanhas `ready` pré-flag permanecem entregues (legacy)
- **Galeria de versões aprováveis, v4+, meia cobrança, nova `operation_key`** — fora do beta (D3)
- **Pipeline de imagem / providers / prompts / créditos** — intocados
- **Stripe/Monetização Pública** — iniciativa diferida v1.7+, fora da numeração
</domain>

<decisions>
## Implementation Decisions

### D1 — Flag `campaign_approval_enabled` em `feature_flags` (padrão F43/QCW)
`DECIDIDO`. Nova constante `CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled"` em `feature-flag-service.ts`, adicionada a `ALL_FEATURE_FLAG_KEYS` (a tela admin "Controles operacionais" e o `GET /api/admin/feature-flags` passam a exibi-la automaticamente). Método `isCampaignApprovalEnabled(): Promise<boolean>` → `readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)` — **fail-closed**: falha de leitura/flag desligada ⇒ `false` ⇒ comportamento exatamente o atual. **Sem `envOverride`** para esta flag (decisão 1: sem env/launch-config para o flag principal; env var seria apenas fail-safe emergencial de infra, não decisão). **Seed** na migration: `campaign_approval_enabled = false` (padrão), descrição administrativa clara ("Quando ligada, campanhas novas entram no fluxo de revisão/aprovação da arte antes da entrega..."). `ON CONFLICT (key) DO NOTHING`. **Admin sem mudança de RPC/CHECKs:** o `admin_update_feature_flag` é genérico por `key`; os CHECKs `feature_flag_update`/`feature_flag` já existem (F43). Nenhuma nova action/target_type. Alternativa rejeitada: env var / launch-config como decisão principal (contraria decisão 1 e o padrão F43/QCW).

### D2 — Estado de aprovação + legacy explícito + gating (decisões 3/4/5)
`DECIDIDO`. Em `src/lib/campaign/display.ts`:
```ts
export type ApprovalDisplayState =
  | { status: "not_enabled" }            // flag off → comportamento atual (entrega livre)
  | { status: "legacy" }                 // flag on, zero linhas em campaign_art_versions → entregue como hoje
  | { status: "pending" }                // flag on, campanha nova não aprovada → revisão (gate)
  | { status: "approved"; approvedAt: string }
  | { status: "regenerating" };          // derivado do marcador correction_in_progress (decisão 5) — inalcançável na 37.1

export function computeApprovalState(campaign: CampaignRecord, versions: CampaignArtVersion[], flagEnabled: boolean): ApprovalDisplayState;
export function isDeliveryReleased(state: ApprovalDisplayState): boolean;
// true: not_enabled | legacy | approved
// false: pending | regenerating
```
Derivação: `!flagEnabled → not_enabled`; `flagEnabled && versions.length === 0 → legacy`; `flagEnabled && approved_version_id → approved` (com `approved_at`); `flagEnabled && candidata ativa com correction_in_progress → regenerating`; senão `pending`. `campaigns.status` permanece `ready` (decisão 5 — não toca o enum). `regenerating` entra no contrato (e em `isDeliveryReleased`) porque a tabela já nasce com o marcador (D7); na 37.1 **nenhum fluxo/UI/rota o ativa** (nada escreve `correction_in_progress=true`) — é coberto por **testes de contrato puro** (decisão do usuário 2026-09-01: "nenhum fluxo exercita", não "nenhum teste"; será exercitado por fluxo na 37.2). Fonte oficial da arte (decisão 3): revisão renderiza a **candidata ativa** (`asset_status='active'`); ao aprovar, `campaigns.storage_path` é repontado; **legacy** continua usando `campaigns.storage_path`. Campanhas `error`/`generating` seguem seus fluxos atuais.

### D3 — Migration `campaign_art_versions` + colunas em `campaigns` (D7)
`DECIDIDO`. `20260901000001_f37_1_create_campaign_art_versions.sql` (idempotente, não destrutiva, RLS service_role-only como `feature_flags`, seção REVERT): tabela com `version_number` CHECK 1..3, `status` CHECK pending/approved/rejected, `correction_in_progress` default false, `storage_path` nullable, `asset_status` CHECK active/discarded default active, `asset_deleted_at`, `brief_snapshot` jsonb NOT NULL, `render_snapshot`/`generation_metadata`/`rejection_reason` jsonb, `created_at`, `UNIQUE (campaign_id, version_number)`, índice único parcial `campaign_art_versions_one_approved_per_campaign` (`WHERE status = 'approved'`). `campaigns` (aditivos): `approval_status` default 'pending_approval' CHECK IN ('pending_approval','approved'), `rejection_count` smallint default 0 CHECK 0..2, `approved_version_id` uuid FK, `approved_at`; CHECK `campaigns_approved_requires_version` (`approval_status <> 'approved' OR approved_version_id IS NOT NULL`) **via bloco idempotente `DO $$ ... IF NOT EXISTS (pg_constraint) ... END $$`** (evitar `ADD CONSTRAINT IF NOT EXISTS`, não portável no PostgreSQL/Supabase). **Sem backfill.** **Sem** mudança em `chk_generation_events_type`. Seed da flag (na mesma migration ou em `20260901000002`): `campaign_approval_enabled = false`. RLS: `ENABLE ROW LEVEL SECURITY`, policy só para `service_role`; REVOKE de anon/authenticated (padrão `feature_flags`).

### D4 — `generate-image` insere v1 quando a flag está ligada (D8/D10, mínimo)
`DECIDIDO`. No `route.ts`, **após** o sucesso de `createCampaign` (`:455-460`), ler `isCampaignApprovalEnabled()`; se `true`, `createArtVersion(campaign.id, 1, campaign.storagePath, inputSnapshot)` — `inputSnapshot` é exatamente o objeto `campaign_brief_v1` persistido em `campaigns.input_snapshot` (`buildCampaignBriefSnapshot(brief)`), `status='pending'`, `asset_status='active'`. **Falha do insert da v1 → log de erro operacional + continua** (não derruba a geração): a campanha nasce sem linhas de versão e é exibida como `legacy` (fail-safe — a flag nunca quebra o fluxo atual, D1). Alternativa considerada (falhar a geração e rolar back) foi rejeitada por violar o princípio fail-closed/anti-fragilidade da flag. `render_snapshot`/`generation_metadata` da v1 ficam `NULL` na 37.1. `storage_path` da v1 reaproveita o path existente da geração inicial (`{storeId}/{campaignId}.jpg`); a convenção `{storeId}/{campaignId}/v{n}.jpg` é da regeração (37.2). **Sem persistência nova de produto fonte** (F41 já persiste os inputs; decisão 2).

### D5 — Persistência: `createArtVersion`, `listArtVersions`, `approveArtVersion` (D7/D8)
`DECIDIDO`. Em `src/lib/campaign/persistence.ts` (extensões) + tipos em `types.ts`: `CampaignApprovalStatus = "pending_approval" | "approved"`, `ArtVersionStatus = "pending" | "approved" | "rejected"`, interface `CampaignArtVersion` (com `brief_snapshot: Record<string, unknown>`, `render_snapshot`/`generation_metadata`/`rejection_reason` nullable, `correction_in_progress`, `asset_status`, `asset_deleted_at` nullable, `created_at`). `CampaignRecord` + `approval_status`, `rejection_count`, `approved_version_id`, `approved_at`. `createArtVersion(campaignId, versionNumber, storagePath, briefSnapshot)` → INSERT (v1, `pending`, `active`). `listArtVersions(campaignId)` → linhas ordenadas por `version_number` (fonte para `computeApprovalState` e para a tela). `approveArtVersion` → **RPC `approve_campaign_art_version(p_campaign_id uuid, p_version_id uuid)`** (`SECURITY DEFINER`, `SET search_path=''`, service_role-only, padrão F43): (1) `SELECT ... FOR UPDATE` da versão; `version_not_found`/`version_campaign_mismatch` (404) / `version_not_pending` (409 — já resolvida) / `version_not_active` (409). (2) **Defensivo (D8):** `UPDATE campaign_art_versions SET asset_status='discarded', storage_path=NULL, asset_deleted_at=now() WHERE campaign_id=p_campaign_id AND id<>p_version_id AND asset_status='active'` — no-op na 37.1 (só existe v1); remoção física de arquivo dessas linhas é do fluxo de substituição (37.2). (3) `UPDATE campaign_art_versions SET status='approved' WHERE id=p_version_id`. (4) `UPDATE campaigns SET storage_path=v.storage_path, approved_version_id=p_version_id, approved_at=now(), approval_status='approved' WHERE id=p_campaign_id`. **Telemetria (D8):** sem novo `generation_type`; o funil usa `campaign_art_versions.status` + `campaigns.approved_at`; o custo por campanha aprovada já aparece no painel F38.2 via `operation_run_id` (sem mudança). Não implementados na 37.1: `markVersionRejected`, `discardArtAsset`, `setCorrectionInProgress` (37.2).

### D6 — Rota `POST /api/campaign/[id]/approve` (D8)
`DECIDIDO`. `requireSameOrigin` (CSRF, padrão publication-copy) → `requireApiUser` → UUID v4 → `getCampaign` → `requireOwnership` → `if (!isCampaignApprovalEnabled()) return 403` → `campaign.status !== 'ready' → 409` (sem candidata para aprovar em `generating`/`error`) → zod do body `{ versionId: uuid }` → `rpc('approve_campaign_art_version', { p_campaign_id, p_version_id })`. Mapeamento de erros do RPC: `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active` → 409 (already resolved / inválida). Sucesso → `200 { campaignUrl: "/campanhas/{id}", status: "approved" }`. Anti-concorrência: o guarded update do RPC + o índice único parcial tornam a segunda aprovação idempotente (409).

### D7 — UI: tela de revisão + entrega (decisões 3/12 + D2)
`DECIDIDO`. `[id]/page.tsx`: quando `ready`, ler `isCampaignApprovalEnabled()` + `listArtVersions(id)` → `computeApprovalState`; estender `CampaignPageProps` com `approval?: { state, candidateImageUrl?, candidateVersionId? }`. `pending` → renderiza `CampaignApprovalView`; senão `ReadyView` (como hoje; arte de `campaigns.storage_path`). **`CampaignApprovalView`** (novo, `src/components/campaign/campaign-approval-view.tsx`, client): arte candidata via `generateSignedPreviewUrl(candidate.storage_path)`; botão primário **"Aprovar e liberar campanha"**; botão secundário **"Corrigir" ausente** (alternativa aceitável: desabilitado) — **nunca abre modal**; sem download, sem Kit de Publicação/copy; microcopy "Revise a arte antes de liberar: a IA pode cometer erros."; aprovar → `POST approve { versionId }` → `router.refresh()`; estados loading/erro PT-BR; touch ≥ 44px, a11y labels, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`). **UX sem histórico recuperável (decisão 12):** a tela mostra **apenas a candidata ativa**; nenhuma versão anterior é selecionável/recuperável (o histórico é interno/auditoria).

### D8 — Gates nas rotas de download e publication-copy (decisão 4 + D2)
`DECIDIDO`. `download/route.ts`: após `requireOwnership`, `isCampaignApprovalEnabled()` + `listArtVersions` + `computeApprovalState`; `!isDeliveryReleased(state) → 403 { error: "Campaign pending approval" }`; senão serve `campaign.storage_path` (approved → repontado; legacy/not_enabled → atual). `publication-copy/route.ts`: mesmo gate antes de aplicar o PATCH → 403 enquanto `pending`/`regenerating`; `not_enabled`/`legacy`/`approved` → comportamento atual. Custo: 2 lookups simples (flag + versões); fast path para legado (zero linhas). Estado derivado de `campaign_art_versions` (single source), não de coluna adicional.

### D9 — Trackings (D11/D12) — confirmar/preencher, sem renumeração
`DECIDIDO`. `ROADMAP.md` (raiz): confirmar linha 37 "Revisão e Aprovação da Arte | v1.5 | 0/0 | ○ Pending" (0/0 mantido até a fase concluir; execução em fatias 37.1/37.2/37.3). `.planning/ROADMAP.md`: seção "### Phase 37" no formato das fases concluídas, com sub-seções **37.1/37.2/37.3** (goal/success criteria/dependencies por fatia; **source of truth `openspec/changes/fase-37-1-approval-gate-candidata-unica/`** — decisão do usuário 2026-09-01); Dependency Graph (F39/F43 → F37); rodapé "Last updated". `.planning/STATE.md`: `current_phase: 37` (37.1 em execução — decisão do usuário 2026-09-01); seção da Fase 37 (fatias 37.1 → 37.2 → 37.3); "Current Position" + "Last updated". `.planning/PROJECT.md`/`MILESTONES.md`: F37 em execução (37.1/37.2/37.3); F38–F43 concluídas; Stripe diferida (confirmar). `.planning/REQUIREMENTS.md`: requisitos da F37 entram quando os specs forem aprovados. **Sem renumeração** (F37 já numerada; F38–F43 concluídas; Stripe fora da numeração).

### D10 — Nomeação da mudança
`DECIDIDO` (padrão do repositório, confirmado pelo usuário 2026-09-01). Pasta `openspec/changes/fase-37-1-approval-gate-candidata-unica/` segue o padrão de sub-fases da F38 (`fase-38-1-ai-cost-accounting`, `fase-38-2-admin-custos-operacionais`, `fase-38-2-1-economic-snapshot`). A expressão do D12 ("`openspec/changes/fase-37-revisao-aprovacao-arte/` organiza as fatias como 37-1/37-2/37-3") é interpretada como guarda-chuva da fase; **cada fatia é uma mudança OpenSpec independente** (padrão estabelecido no repositório), com prefixo de data adicionado no arquivamento. **Divergência registrada e resolvida:** a fonte da verdade citada nos trackings é a pasta real da fatia (não a guarda-chuva).

## Success Criteria

1. Flag `campaign_approval_enabled` em `feature_flags` (fail-closed, seed false), listada na tela "Controles operacionais" sem novo RPC/CHECK (D1)
2. `campaign_art_versions` criada (idempotente, RLS service_role, índice único parcial 1-approved) + colunas em `campaigns` (approval_status/rejection_count/approved_version_id/approved_at) + CHECK `campaigns_approved_requires_version` (D7)
3. RPC `approve_campaign_art_version` transacional (guarded update + defensivo + repontar campaigns) (D8)
4. `generate-image` insere v1 (pending/active, brief_snapshot = campaign_brief_v1) quando flag ligada; flag off → comportamento atual; falha no insert → continua (legacy) (D8/D10/D1)
5. `ApprovalDisplayState`/`computeApprovalState`/`isDeliveryReleased` corretos (not_enabled/legacy/pending/approved/regenerating) (D2)
6. Download e publication-copy gated: pending/regenerating + flag on → 403; not_enabled/legacy/approved → liberado (D2/decisão 4)
7. `/campanhas/[id]` exibe tela de revisão (candidata ativa, sem download/copy) quando pending; entrega como hoje quando approved/legacy/not_enabled (D7/decisões 3/12)
8. `POST /api/campaign/[id]/approve` transacional com mapeamento de erros correto; sucesso → 200 + entrega liberada (D8)
9. Botão "Corrigir" ausente/desabilitado, nenhum modal de correção abre (D12/decisão 3)
10. `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros; ~17+ testes novos + regressão co-migrada; UAT local (flag ligada/desligada, campanha legada, mobile 320px/375px)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec base da fatia (fonte da verdade)
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/proposal.md` — escopo, capacidades, impacto, FORA DE ESCOPO (37.2/37.3)
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/design.md` — D1–D10 (flag, estado/gating, migration, generate-image v1, persistência, rota approve, UI, gates, trackings, nomeação)
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/tasks.md` — 19 seções de tarefas executáveis (1 trackings, 2-3 migrations, 4 flag, 5 types, 6 persistência, 7 display, 8 generate-image, 9-10 gates, 11 rota approve, 12 UI, 13-17 testes, 18 regressão, 19 verificação)
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/specs/campaign-art-versions/spec.md` — tabela/colunas/tipos/persistência/RPC transacional (requisitos e cenários)
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/specs/campaign-approval-gate/spec.md` — ApprovalDisplayState/computeApprovalState/isDeliveryReleased, fonte oficial da arte, tela de revisão, rota approve, gates download/copy, nenhum fluxo de correção
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/specs/ai-image-generation/spec.md` — generate-image insere v1 (flag on/off, fail-safe)
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/specs/campaign-download-route/spec.md` — gate de download (403/200/legacy)
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/specs/publication-copy-route/spec.md` — gate de publication-copy (403/200/legacy)
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/specs/campaign-page-ui/spec.md` — tela de revisão + entrega, sem histórico recuperável, a11y/mobile
- `openspec/changes/fase-37-1-approval-gate-candidata-unica/specs/feature-flag-control/spec.md` — flag campaign_approval_enabled (fail-closed, seed, admin sem novo RPC/CHECK)

### Alinhamento F37 (referência)
- `docs/alinhamento-fase-37-revisao-aprovacao-arte.md` — D1-D12, decisões 1-16, fatiamento 37.1/37.2/37.3, testes 1-44, runbook de trackings D11/D12

### Código fonte (para replicar padrões)
- `src/lib/feature-flags/feature-flag-service.ts` — padrão F43/QCW (constantes, ALL_FEATURE_FLAG_KEYS, readFlag fail-closed, exports de conveniência)
- `src/lib/campaign/display.ts` — CampaignPageProps, getCampaignForDisplay, generateSignedPreviewUrl, computeDisplayStatus, mapCampaignToProps (base para ApprovalDisplayState)
- `src/lib/campaign/persistence.ts` — createCampaign/getCampaign/updateCampaignReady (base para createArtVersion/listArtVersions)
- `src/lib/campaign/types.ts` — CampaignRecord (base para extensão com campos de aprovação)
- `src/app/api/campaign/generate-image/route.ts` — createCampaign `:455-460`, inputSnapshot `:452` (ponto de inserção da v1)
- `src/app/api/campaign/[id]/download/route.ts` — pipeline auth/ownership/download (ponto do gate)
- `src/app/api/campaign/[id]/publication-copy/route.ts` — pipeline CSRF/auth/ownership/validate/update (ponto do gate)
- `src/app/(app)/campanhas/[id]/page.tsx` e `client.tsx` — renderização ready/generating/stale/error (base para CampaignApprovalView)
- `src/app/(app)/admin/feature-flags/page.tsx` e `src/app/api/admin/feature-flags/route.ts` — tela "Controles operacionais" (lista via ALL_FEATURE_FLAG_KEYS)
- `supabase/migrations/20260821000001_f43_create_feature_flags.sql` — precedente RLS/policy/seed/RPC (padrão service_role-only)
</canonical_refs>

<specifics>
## Specific Ideas

- **Migrations:** `20260901000001_f37_1_create_campaign_art_versions.sql` (tabela + colunas campaigns + índice único parcial + seed flag) e `20260901000002_f37_1_approve_campaign_art_version_rpc.sql` (RPC). Idempotentes, não destrutivas, sem backfill, sem alterar `chk_generation_events_type`.
- **RPC:** `approve_campaign_art_version(p_campaign_id uuid, p_version_id uuid)` — `SECURITY DEFINER`, `SET search_path=''`, service_role-only, com guarded update + defensivo (descartar outras ativas) + repontar campaigns na mesma transação.
- **Status codes:** approve → 400 (uuid inválido) / 404 (não existe / sem ownership / version_not_found / version_campaign_mismatch) / 403 (flag off) / 409 (campaign não ready, version_not_pending, version_not_active) / 200. Download/copy → 403 (pending/regenerating com flag on).
- **Testes (~17+):** 13.1-13.7 (estados: not_enabled, legacy, pending, approved+approvedAt, isDeliveryReleased, índice único parcial, decision 5 status ready), 14.1-14.4 (aprovação transacional, só candidata ativa, version_not_pending/mismatch, rota guards), 15.1-15.2 (generate-image v1 flag on/off + fail-safe), 16.1-16.5 (download 403/200/legacy, copy 403/200/legacy, flag off), 17.1-17.5 (UI: copy oculto, copy após aprovação, só candidata, fonte da arte, corrigir ausente).
- **Trackings:** 6 arquivos (ROADMAP raiz, .planning/ROADMAP.md, STATE.md, PROJECT.md, MILESTONES.md, REQUIREMENTS.md) confirmados/preenchidos para F37 em fatias 37.1/37.2/37.3.
</specifics>

<deferred>
## Deferred Ideas

- **37.2** — Correção visual/criativa (Correction Brief Parser, `/regenerate`, cap `rejection_count < 2`, modal 2 etapas, `prompts/regen/*`, referência de arte na regeração, `setCorrectionInProgress`/`markVersionRejected`/`discardArtAsset`, `rebuildBriefFromSnapshot`, estratégia A/B, estado `regenerating` exercitado)
- **37.3** — Correção factual de briefing (`briefPatch`/`validateBriefPatch`, preço/validade/aviso legal/badge/digitação)
- **Fora da F37 como um todo:** v4+ paga/meia cobrança por correção; nova `operation_key` (`campaign_regeneration`/`campaign_approval`); galeria de versões aprováveis (variações); rebriefing estratégico livre; estorno/reembolso automático; extração de "core de geração" compartilhado; aprovação colaborativa/multi-approver; notificações push/email; rascunho/autosave de feedback; Stripe/Monetização Pública (diferida v1.7+)
</deferred>

---

*Phase: 37.1-approval-gate-candidata-unica*
*Context gathered: 2026-09-01 via OpenSpec base (fonte da verdade, decisão do usuário)*
