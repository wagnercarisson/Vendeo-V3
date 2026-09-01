## Context

A **F37 — Revisão e Aprovação da Arte** (v1.5, experimento beta controlado) transforma a primeira entrega de campanha em um **ciclo de aprovação**: o lojista aprova a arte ou pede ajuste (com motivo), e a campanha só é entregue (download + copys) após a aprovação. Esta é a base técnica da **fatia 37.1 — Approval Gate + Candidata Única** (D12), que entrega valor parcial: valida o modelo de aprovação **sem tocar no pipeline de imagem** (mitiga regressão no core de geração). Fonte da verdade: `docs/alinhamento-fase-37-revisao-aprovacao-arte.md` (D1, D2, D3-parcial, D7, D8-aprovação, D10, D11, D12, decisões 3/4/5/12).

**Estado real em código (explorado):**

- **Entrega imediata hoje:** `POST /api/campaign/generate-image` cria a campanha (`route.ts:~455`, `createCampaign` com `campaignIdPre`, `inputSnapshot` = `buildCampaignBriefSnapshot(brief)`) e reserva crédito (`:480`); ao ficar `ready`, `/campanhas/[id]` renderiza `ReadyView` (`[id]/client.tsx`) com arte + Kit de Publicação + "Baixar Original". Não existe passo de aprovação.
- **Rotas de entrega sem gate:** `GET /api/campaign/[id]/download/route.ts` serve `campaign.storage_path` direto (após auth + ownership). `PATCH /api/campaign/[id]/publication-copy/route.ts` persiste `publication_copy_current` (após CSRF + auth + ownership + validação).
- **Display:** `src/lib/campaign/display.ts` tem `getCampaignForDisplay`, `generateSignedPreviewUrl`, `computeDisplayStatus` e `mapCampaignToProps` — sem estado de aprovação. A página `[id]/page.tsx` gera o signed URL de `campaign.storage_path` quando `ready`.
- **Persistência:** `src/lib/campaign/persistence.ts` tem `createCampaign` (com `operation_run_id`, F38.1), `updateCampaignReady`, `getCampaign`, `uploadCampaignImage`, `deleteCampaignImage` — sem funções de versão de arte.
- **Types:** `src/lib/campaign/types.ts` — `CampaignRecord` sem `approval_status`/`approved_version_id`/`approved_at`/`rejection_count`.
- **Flags (padrão F43/QCW):** `src/lib/feature-flags/feature-flag-service.ts` — `FeatureFlagService.readFlag(key, fallback, envOverride?)`, `ALL_FEATURE_FLAG_KEYS` (tela admin "Controles operacionais"), RPC `admin_update_feature_flag` genérico por `key` com auditoria atômica (sem mudança de RPC/CHECKs para nova flag). `admin/feature-flags/page.tsx` renderiza as flags de `ALL_FEATURE_FLAG_KEYS`.
- **Transacionalidade em banco (precedente):** RPCs `SECURITY DEFINER` com `SET search_path=''` (F43 `admin_update_feature_flag`, F38 access_requests) — padrão para a aprovação atômica.
- **Snapshot:** `buildCampaignBriefSnapshot(brief)` produz o `campaign_brief_v1` persistido em `campaigns.input_snapshot` (F39, sem base64) — fonte do `brief_snapshot` por versão.

**Contrato com fatias futuras (NÃO implementado aqui):** Correction Brief Parser, `briefPatch`/`validateBriefPatch`, referência de arte na regeração, cap de correções, `/regenerate`, modal em 2 etapas, `prompts/regen/*`, `rebuildBriefFromSnapshot` — tudo **37.2/37.3** (ver proposal). A coluna `rejection_count` nasce no schema (D7) mas **nada escreve nela** na 37.1.

## Goals / Non-Goals

**Goals:**
- Flag **`campaign_approval_enabled`** em `feature_flags` (padrão F43/QCW), leitura fail-closed (`isCampaignApprovalEnabled()`), sem env/launch-config; tela admin "Controles operacionais" exibe a nova flag sem novo RPC/CHECK (D1)
- **`campaign_art_versions`** (1 candidata por vez) + colunas em `campaigns` (`approval_status`, `rejection_count` schema-only, `approved_version_id`, `approved_at`) + índice único parcial 1-approved (D7)
- `generate-image` **insere v1** em `campaign_art_versions` quando a flag está ligada (mudança mínima — D8/D10); flag off → comportamento atual
- **`ApprovalDisplayState`** (`not_enabled | legacy | pending | approved | regenerating`) + `computeApprovalState` + `isDeliveryReleased`; **estado legacy explícito** (flag on + zero versões → entregue como hoje); fonte oficial da arte = **candidata ativa** (decisão 3) (D2)
- **Gate em download e publication-copy** (decisão 4): `pending`/`regenerating` (flag on) → 403; `not_enabled`/`legacy`/`approved` → liberado (D2)
- **Tela de revisão** da candidata ativa em `/campanhas/[id]` (sem download, sem copy), botão primário **"Aprovar e liberar campanha"**, secundário **"Corrigir" ausente/desabilitado que nunca abre modal** (decisão 3/12; correção é 37.2)
- **`POST /api/campaign/[id]/approve`** transacional (RPC) — aprova a candidata, defensivo nenhuma outra linha com asset ativo, reponta `campaigns` (D8); telemetria sem novo `generation_type`
- Trackings confirmados (D11/D12): F37 em execução com fatias 37.1/37.2/37.3 (padrão F38/38.1/38.2)
- Testes (~17+ do checklist da fatia) + 4 gates verdes + regressão co-migrada

**Non-Goals:**
- **Correção em qualquer forma** — botão "Corrigir" nunca abre modal; sem parser, sem `/regenerate`, sem cap, sem `prompts/regen/*`, sem referência de arte (37.2)
- **Correção factual de briefing** (`briefPatch`/`validateBriefPatch`) (37.3)
- **Escrever em `rejection_count`** — coluna criada (D7), guard do cap é 37.2
- **Exercitar `regenerating`** — estado no tipo do módulo (contrato de `isDeliveryReleased`), inalcançável na 37.1 (nada seta `correction_in_progress`)
- **`setCorrectionInProgress` / `markVersionRejected` / `discardArtAsset`** — funções da correção (37.2)
- **`rebuildBriefFromSnapshot` / reabertura do `operation_run_id` cross-request** (37.2)
- **Estratégia de correção A/B** (text_only × text_plus_reference) e flag de estratégia (37.2)
- **Mudar `campaigns.status`** para representar correção (decisão 5 — permanece `generating|ready|error`)
- **Alterar CHECK `chk_generation_events_type`** (telemetria por metadata/`campaign_art_versions` — D8)
- **Backfill / gate retroativo** — campanhas `ready` pré-flag permanecem entregues (legacy)
- **Galeria de versões aprováveis, v4+, meia cobrança, nova `operation_key`** — fora do beta (D3)
- **Pipeline de imagem / providers / prompts / créditos** — intocados

## Decisions

### D1 — Flag `campaign_approval_enabled` em `feature_flags` (D1, padrão F43/QCW)

- Nova constante `CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled"` em `feature-flag-service.ts`, adicionada a `ALL_FEATURE_FLAG_KEYS` (a tela admin "Controles operacionais" e a rota `GET /api/admin/feature-flags` passam a exibi-la automaticamente).
- Método `isCampaignApprovalEnabled(): Promise<boolean>` → `readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)` — **fail-closed**: falha de leitura/flag desligada ⇒ `false` ⇒ comportamento exatamente o atual. **Sem `envOverride`** para esta flag (decisão 1: sem env/launch-config para o flag principal; env var seria apenas fail-safe emergencial de infra, não decisão).
- **Seed** na migration: `campaign_approval_enabled = false` (padrão), descrição administrativa clara ("Quando ligada, campanhas novas entram no fluxo de revisão/aprovação da arte antes da entrega..."). `ON CONFLICT (key) DO NOTHING`.
- **Admin sem mudança de RPC/CHECKs:** o `admin_update_feature_flag` é genérico por `key`; os CHECKs `feature_flag_update`/`feature_flag` já existem (F43). Nenhuma nova action/target_type.
- Alternativa rejeitada: env var / launch-config como decisão principal (contraria decisão 1 e o padrão F43/QCW).

### D2 — Estado de aprovação + legacy explícito + gating (D2 + decisões 3/4/5)

```ts
// src/lib/campaign/display.ts (extensões)
export type ApprovalDisplayState =
  | { status: "not_enabled" }            // flag off → comportamento atual (entrega livre)
  | { status: "legacy" }                 // flag on, zero linhas em campaign_art_versions → entregue como hoje
  | { status: "pending" }                // flag on, campanha nova não aprovada → revisão (gate)
  | { status: "approved"; approvedAt: string }
  | { status: "regenerating" };          // derivado do marcador correction_in_progress (decisão 5) — inalcançável na 37.1

export function computeApprovalState(
  campaign: CampaignRecord,
  versions: CampaignArtVersion[],
  flagEnabled: boolean
): ApprovalDisplayState;

export function isDeliveryReleased(state: ApprovalDisplayState): boolean;
// true: not_enabled | legacy | approved
// false: pending | regenerating
```

- **Derivação:** `!flagEnabled → not_enabled`; `flagEnabled && versions.length === 0 → legacy`; `flagEnabled && approved_version_id → approved` (com `approved_at`); `flagEnabled && candidata ativa com correction_in_progress → regenerating`; senão `pending`. `campaigns.status` permanece `ready` (decisão 5 — não toca o enum).
- **`regenerating` na 37.1:** o tipo entra no contrato do módulo (e em `isDeliveryReleased`) porque a tabela já nasce com o marcador `correction_in_progress` (D7); na 37.1 **nenhum fluxo o ativa** (nada escreve `true`) e **nenhum teste o exercita** — será exercitado na 37.2. Evita quebra de contrato e mantém `isDeliveryReleased` correto para o futuro.
- **Fonte oficial da arte (decisão 3):** com o gate ligado, a revisão renderiza a **candidata ativa** (`asset_status='active'` em `campaign_art_versions`); ao aprovar, `campaigns.storage_path` é repontado para a aprovada; **legacy** (sem linhas) continua usando `campaigns.storage_path`. Campanhas `error`/`generating` seguem seus fluxos atuais.

### D3 — Migration `campaign_art_versions` + colunas em `campaigns` (D7)

`20260901000001_f37_1_create_campaign_art_versions.sql` (idempotente, não destrutiva, RLS service_role-only como `feature_flags`, seção REVERT):

```sql
CREATE TABLE IF NOT EXISTS public.campaign_art_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  version_number smallint NOT NULL CHECK (version_number BETWEEN 1 AND 3),
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
  correction_in_progress boolean NOT NULL DEFAULT false,          -- decisão 5 (marcador "regenerating")
  storage_path text,                                               -- NULL após descarte do asset
  asset_status text NOT NULL DEFAULT 'active' CHECK (asset_status IN ('active','discarded')),
  asset_deleted_at timestamptz,
  brief_snapshot jsonb NOT NULL,                                   -- campaign_brief_v1 (F39), sem base64
  render_snapshot jsonb,
  generation_metadata jsonb,
  rejection_reason jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_art_versions_one_approved_per_campaign
  ON public.campaign_art_versions (campaign_id) WHERE status = 'approved';
```

`campaigns` (aditivos, preservando valores existentes):
```sql
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_approval'
    CHECK (approval_status IN ('pending_approval','approved')),
  ADD COLUMN IF NOT EXISTS rejection_count smallint NOT NULL DEFAULT 0
    CHECK (rejection_count BETWEEN 0 AND 2),                        -- guard do cap é 37.2 (nada escreve na 37.1)
  ADD COLUMN IF NOT EXISTS approved_version_id uuid
    REFERENCES public.campaign_art_versions(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- CHECK condicional idempotente (ADD CONSTRAINT IF NOT EXISTS não é portável no
-- PostgreSQL/Supabase) — bloco DO ... END $$:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_approved_requires_version'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_approved_requires_version
      CHECK (approval_status <> 'approved' OR approved_version_id IS NOT NULL);
  END IF;
END $$;
```

- **Sem backfill** (campanhas `ready` pré-flag seguem como estão — legacy). **Sem** mudança em `chk_generation_events_type`.
- Seed da flag (na mesma migration ou em `20260901000002`): `campaign_approval_enabled = false`.
- RLS: `ENABLE ROW LEVEL SECURITY`, policy só para `service_role`; REVOKE de anon/authenticated (padrão `feature_flags`).

### D4 — `generate-image` insere v1 quando a flag está ligada (D8/D10, mínimo)

- No `route.ts`, **após** o sucesso de `createCampaign` (`:462`), ler `isCampaignApprovalEnabled()`; se `true`, `createArtVersion(campaign.id, 1, campaign.storagePath, inputSnapshot)` — `inputSnapshot` é exatamente o objeto `campaign_brief_v1` persistido em `campaigns.input_snapshot` (`buildCampaignBriefSnapshot(brief)`), `status='pending'`, `asset_status='active'`.
- **Falha do insert da v1 → log de erro operacional + continua** (não derruba a geração): a campanha nasce sem linhas de versão e é exibida como `legacy` (fail-safe — a flag nunca quebra o fluxo atual, D1). Alternativa considerada (falhar a geração e rolar back) foi rejeitada por violar o princípio fail-closed/anti-fragilidade da flag.
- `render_snapshot`/`generation_metadata` da v1 ficam `NULL` na 37.1 (populados no fluxo de regeração — 37.2). `storage_path` da v1 reaproveita o path existente da geração inicial (`{storeId}/{campaignId}.jpg`); a convenção `{storeId}/{campaignId}/v{n}.jpg` é da regeração (37.2).
- **Sem persistência nova de produto fonte** (F41 já persiste os inputs; decisão 2).

### D5 — Persistência: `createArtVersion`, `listArtVersions`, `approveArtVersion` (D7/D8)

`src/lib/campaign/persistence.ts` (extensões) + tipos em `types.ts`:

```ts
export type CampaignApprovalStatus = "pending_approval" | "approved";
export type ArtVersionStatus = "pending" | "approved" | "rejected";
export interface CampaignArtVersion {
  id: string; campaign_id: string; version_number: number;
  status: ArtVersionStatus; storage_path: string | null;
  asset_status: "active" | "discarded"; asset_deleted_at: string | null;
  brief_snapshot: Record<string, unknown>;
  render_snapshot: Record<string, unknown> | null;
  generation_metadata: Record<string, unknown> | null;
  rejection_reason: Record<string, unknown> | null;
  correction_in_progress: boolean; created_at: string;
}
// CampaignRecord + approval_status, rejection_count, approved_version_id, approved_at
```

- `createArtVersion(campaignId, versionNumber, storagePath, briefSnapshot)` → INSERT (v1, `pending`, `active`).
- `listArtVersions(campaignId)` → linhas ordenadas por `version_number` (fonte para `computeApprovalState` e para a tela).
- `approveArtVersion` → **RPC `approve_campaign_art_version(p_campaign_id uuid, p_version_id uuid)`** (`SECURITY DEFINER`, `SET search_path=''`, service_role-only, padrão F43):
  1. `SELECT ... FOR UPDATE` da versão; `version_not_found` / `version_campaign_mismatch` (404) / `version_not_pending` (409 — já resolvida) / `version_not_active` (409).
  2. **Defensivo (D8):** `UPDATE campaign_art_versions SET asset_status='discarded', storage_path=NULL, asset_deleted_at=now() WHERE campaign_id=p_campaign_id AND id<>p_version_id AND asset_status='active'` — no-op na 37.1 (só existe v1); remoção física de arquivo dessas linhas é do fluxo de substituição (37.2).
  3. `UPDATE campaign_art_versions SET status='approved' WHERE id=p_version_id`.
  4. `UPDATE campaigns SET storage_path=v.storage_path, approved_version_id=p_version_id, approved_at=now(), approval_status='approved' WHERE id=p_campaign_id`.
- **Telemetria (D8):** sem novo `generation_type`; o funil usa `campaign_art_versions.status` + `campaigns.approved_at`; o custo por campanha aprovada já aparece no painel F38.2 via `operation_run_id` (sem mudança).
- Não implementados na 37.1: `markVersionRejected`, `discardArtAsset`, `setCorrectionInProgress` (37.2).

### D6 — Rota `POST /api/campaign/[id]/approve` (D8)

- `requireSameOrigin` (CSRF, padrão publication-copy) → `requireApiUser` → UUID v4 → `getCampaign` → `requireOwnership` → `if (!isCampaignApprovalEnabled()) return 403` → `campaign.status !== 'ready' → 409` (sem candidata para aprovar em `generating`/`error`) → zod do body `{ versionId: uuid }` → `rpc('approve_campaign_art_version', { p_campaign_id, p_version_id })`.
- Mapeamento de erros do RPC: `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active` → 409 (already resolved / inválida).
- Sucesso → `200 { campaignUrl: "/campanhas/{id}", status: "approved" }`. Anti-concorrência: o guarded update do RPC + o índice único parcial tornam a segunda aprovação idempotente (409).

### D7 — UI: tela de revisão + entrega (decisões 3/12 + D2)

- `[id]/page.tsx`: quando `ready`, ler `isCampaignApprovalEnabled()` + `listArtVersions(id)` → `computeApprovalState`; estender `CampaignPageProps` com `approval?: { state, candidateImageUrl?, candidateVersionId? }`. `pending` → renderiza `CampaignApprovalView`; senão `ReadyView` (como hoje; arte de `campaigns.storage_path`).
- **`CampaignApprovalView`** (novo, `src/components/campaign/campaign-approval-view.tsx`, client): arte candidata via `generateSignedPreviewUrl(candidate.storage_path)`; botão primário **"Aprovar e liberar campanha"**; botão secundário **"Corrigir" ausente** (alternativa aceitável: desabilitado) — **nunca abre modal**; sem download, sem Kit de Publicação/copy; microcopy "Revise a arte antes de liberar: a IA pode cometer erros."; aprovar → `POST approve { versionId }` → `router.refresh()`; estados loading/erro PT-BR; touch ≥ 44px, a11y labels, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`).
- **UX sem histórico recuperável (decisão 12):** a tela mostra **apenas a candidata ativa**; nenhuma versão anterior é selecionável/recuperável (o histórico é interno/auditoria).

### D8 — Gates nas rotas de download e publication-copy (D2 + decisão 4)

- `download/route.ts`: após `requireOwnership`, `isCampaignApprovalEnabled()` + `listArtVersions` + `computeApprovalState`; `!isDeliveryReleased(state) → 403 { error: "Campaign pending approval" }`; senão serve `campaign.storage_path` (approved → repontado; legacy/not_enabled → atual).
- `publication-copy/route.ts`: mesmo gate antes de aplicar o PATCH → 403 enquanto `pending`/`regenerating`; `not_enabled`/`legacy`/`approved` → comportamento atual.
- Custo: 2 lookups simples (flag + versões); fast path para legado (zero linhas). Estado derivado de `campaign_art_versions` (single source), não de coluna adicional.

### D9 — Trackings (D11/D12) — confirmar/preencher, sem renumeração

- `ROADMAP.md` (raiz): confirmar linha 37 "Revisão e Aprovação da Arte | v1.5 | 0/0 | ○ Pending" (0/0 mantido até a fase concluir; execução em fatias 37.1/37.2/37.3).
- `.planning/ROADMAP.md`: seção "### Phase 37" no formato das fases concluídas, com sub-seções **37.1/37.2/37.3** (goal/success criteria/dependencies por fatia; source of truth `openspec/changes/fase-37-revisao-aprovacao-arte/`); Dependency Graph (F39/F43 → F37); rodapé "Last updated".
- `.planning/STATE.md`: `current_phase: 37` (37.1 em execução); seção da Fase 37 (fatias 37.1 → 37.2 → 37.3); "Last updated".
- `.planning/PROJECT.md` / `MILESTONES.md`: F37 em execução (37.1/37.2/37.3); F38–F43 concluídas; Stripe diferida (confirmar).
- `.planning/REQUIREMENTS.md`: requisitos da F37 entram quando os specs forem aprovados.
- **Sem renumeração** (F37 já numerada; F38–F43 concluídas; Stripe fora da numeração).

### D10 — Nomeação da mudança

- Pasta `openspec/changes/fase-37-1-approval-gate-candidata-unica/` segue o padrão de sub-fases da F38 (`fase-38-1-ai-cost-accounting`, `fase-38-2-admin-custos-operacionais`, `fase-38-2-1-economic-snapshot`). A expressão do D12 ("`openspec/changes/fase-37-revisao-aprovacao-arte/` organiza as fatias como 37-1/37-2/37-3") é interpretada como guarda-chuva da fase; **cada fatia é uma mudança OpenSpec independente** (padrão estabelecido no repositório), com prefixo de data adicionado no arquivamento. **Divergência registrada para revisão** (ver Open Questions).

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Gate quebra download/copy de campanha nova sob a flag** | `isDeliveryReleased` fail-closed; legacy derivado da ausência de versões; approved libera; testes 30–35 (download 403/200/legacy, copy 403/200) |
| **Falha no insert da v1 com flag ligada** | Log + continua (fail-safe); campanha exibida como `legacy` (entregue); a flag nunca derruba a geração (D1) |
| **Aprovação duplicada/concorrente** | RPC guarded update + índice único parcial 1-approved; segunda aprovação → 409 |
| **Flag ligada antes da migration aplicada** | Leitura fail-closed (`false`) → comportamento atual; ordem de deploy: migration → código |
| **`regenerating`/`rejection_count` como "código morto" na 37.1** | Schema e contrato prontos (D7) sem exercício; documentado como design futuro; 37.2 ativa |
| **Botão "Corrigir" ausente frustra quem quer ajustar** | Escopo explícito da fatia (D12); 37.2 entrega o modal; microcopy orienta aprovar ou criar nova campanha |
| **Campanha legada "quebrada" pelo gate** | **Legacy explícito:** zero linhas em `campaign_art_versions` → entregue como hoje, mesmo com flag ligada (D2) |
| **Overhead de queries nas rotas de download/copy** | 2 lookups simples por request (flag + versões); fast path para legado; aceitável no beta |
| **`storage_path` da v1 ≠ convenção `v{n}.jpg`** | v1 reaproveita o path da geração inicial (`{storeId}/{campaignId}.jpg`); `v{n}.jpg` é convenção da regeração (37.2) |
| **Reverter aprovação acidental** | Aprovação é terminal no beta (1 candidata, 1 approved/campanha); sem v4/galeria; reverter = nova campanha (fluxo atual) |

## Migration Plan

1. **Migration `20260901000001_f37_1_create_campaign_art_versions.sql`** — tabela `campaign_art_versions` (+ `asset_status` + `correction_in_progress`), colunas em `campaigns`, índice único parcial, RLS, CHECK `campaigns_approved_requires_version`, **seed `campaign_approval_enabled = false`**. Idempotente, não destrutiva, sem backfill, sem alteração de `chk_generation_events_type`.
2. **Migration `20260901000002_f37_1_approve_campaign_art_version_rpc.sql`** — RPC `approve_campaign_art_version` (`SECURITY DEFINER`, `SET search_path=''`, service_role-only).
3. **Deploy (ordem fail-closed):** migrations antes do código que as consome; deploy do código com a flag `false` (default) — leitura fail-closed garante comportamento atual mesmo sem a migration.
4. **Smoke:** ligar `campaign_approval_enabled` na tela "Controles operacionais" (motivo + auditoria) → gerar campanha nova → cai na revisão; aprovar → entrega liberada; campanha antiga continua entregue; desligar flag → comportamento atual.
5. **Rollback:** desligar a flag na tela de admin (reversível sem redeploy); reverter commit não altera schema de banco; migrations idempotentes.
6. **Trackings (D9):** confirmar/preencher `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `.planning/REQUIREMENTS.md` na ordem listada.

## Open Questions

- **Nomeação (divergência registrada):** o D12 cita `openspec/changes/fase-37-revisao-aprovacao-arte/` como fonte da verdade organizando as fatias como 37-1/37-2/37-3; a prática do repositório (F38/38.1/38.2/38.2.1) usa **mudanças OpenSpec separadas por sub-fase**. Esta base técnica segue a prática (`fase-37-1-approval-gate-candidata-unica`) — **aguardando validação na revisão** antes de consolidar.
- **Nenhuma bloqueante de implementação restante.** As decisões técnicas desta fatia (flag fail-closed, RPC de aprovação, v1 reaproveitando o path atual, `regenerating` inalcançável, `rejection_count` schema-only, botão "Corrigir" ausente) são as registradas acima.
