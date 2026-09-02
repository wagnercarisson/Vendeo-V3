# Campaign Art Versions

## Purpose

Modelo de dados e persistência das versões de arte da campanha (F37 D7/D8, fatia 37.1 — Approval Gate + Candidata Única). Nova tabela **`campaign_art_versions`** (1 candidata por vez, `status` `pending|approved|rejected`, `asset_status` `active|discarded`, marcador `correction_in_progress` — decisão 5, `brief_snapshot` jsonb `campaign_brief_v1` F39 sem base64), colunas em `campaigns` (`approval_status`, `rejection_count`, `approved_version_id`, `approved_at`), índice único parcial **1 `approved` por `campaign_id`** e funções `createArtVersion`/`listArtVersions`/`approveArtVersion` (RPC transacional). **Sem backfill** (campanhas `ready` pré-flag seguem como estão — legacy, D2); **sem** alteração do CHECK `chk_generation_events_type` (telemetria via metadata/`campaign_art_versions`, D8).

## ADDED Requirements

### Requirement: Tabela campaign_art_versions

O sistema SHALL prover a tabela `campaign_art_versions` (fonte da verdade das artes da campanha; **1 candidata por vez**):

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`.
- `campaign_id` UUID NOT NULL REFERENCES `campaigns(id)` ON DELETE CASCADE.
- `version_number` SMALLINT NOT NULL `CHECK (version_number BETWEEN 1 AND 3)`.
- `status` TEXT NOT NULL `CHECK (status IN ('pending','approved','rejected'))`.
- `correction_in_progress` BOOLEAN NOT NULL DEFAULT false — **marcador da candidata durante correção** (decisão 5); fonte do estado "regenerating" na UI. **Na 37.1 nenhum fluxo o ativa** (correção é 37.2).
- `storage_path` TEXT — `{storeId}/{campaignId}/v{n}.jpg`; NULL após descarte do asset. **v1 reaproveita o path da geração inicial** (`{storeId}/{campaignId}.jpg`).
- `asset_status` TEXT NOT NULL DEFAULT 'active' `CHECK (asset_status IN ('active','discarded'))` — 'active' só para a candidata/aprovada.
- `asset_deleted_at` TIMESTAMPTZ — preenchido ao descartar o arquivo.
- `brief_snapshot` JSONB NOT NULL — snapshot `campaign_brief_v1` (F39) usado na geração da versão, sem base64 por construção.
- `render_snapshot` JSONB — por versão (NULL na v1 da 37.1).
- `generation_metadata` JSONB — por versão (NULL na v1 da 37.1; inclui `operation_run_id` + snapshots econômicos no fluxo de regeração — 37.2).
- `rejection_reason` JSONB — motivo/texto livre (preenchido ao rejeitar — 37.2; NULL na 37.1).
- `created_at` TIMESTAMPTZ DEFAULT now().
- `UNIQUE (campaign_id, version_number)`.
- RLS habilitada, acesso somente `service_role` (padrão `feature_flags`); migration idempotente e não destrutiva.

#### Scenario: Tabela criada com colunas e candidata única

- **WHEN** a migration da fatia 37.1 é aplicada
- **THEN** a tabela `campaign_art_versions` existe com `campaign_id`, `version_number` (1..3), `status`, `correction_in_progress`, `storage_path`, `asset_status`, `asset_deleted_at`, `brief_snapshot`, `render_snapshot`, `generation_metadata`, `rejection_reason`, `created_at`
- **AND** há `UNIQUE (campaign_id, version_number)` e RLS com acesso apenas `service_role`

#### Scenario: Migration idempotente e sem backfill

- **WHEN** a migration da fatia 37.1 é aplicada novamente
- **THEN** nenhum erro ocorre (idempotente)
- **AND** nenhuma campanha `ready` pré-existente recebe linha de versão (sem backfill — estado legacy, D2)

#### Scenario: Somente uma aprovada por campanha

- **WHEN** uma segunda linha de `campaign_art_versions` de uma campanha é marcada como `status='approved'`
- **THEN** a operação é rejeitada pelo índice único parcial (1 `approved` por `campaign_id`)

### Requirement: Colunas de aprovação em campaigns

O sistema SHALL estender a tabela `campaigns` com as colunas de aprovação (D7), preservando valores existentes:

- `approval_status` TEXT NOT NULL DEFAULT 'pending_approval' `CHECK (approval_status IN ('pending_approval','approved'))`.
- `rejection_count` SMALLINT NOT NULL DEFAULT 0 `CHECK (rejection_count BETWEEN 0 AND 2)` — **schema criado na 37.1; nada escreve nela nesta fatia** (guard do cap é 37.2).
- `approved_version_id` UUID REFERENCES `campaign_art_versions(id)`.
- `approved_at` TIMESTAMPTZ.
- `CHECK (approval_status <> 'approved' OR approved_version_id IS NOT NULL)` — aprovação sempre referencia a versão aprovada.

- **Sem backfill:** campanhas `ready` pré-flag não recebem `approved_version_id`/`approved_at` (permanecem `pending_approval` por default e são derivadas como **legacy** na UI — D2).

#### Scenario: Colunas criadas com defaults seguros

- **WHEN** a migration da fatia 37.1 é aplicada
- **THEN** `campaigns` tem `approval_status` (default `pending_approval`), `rejection_count` (default 0, 0..2), `approved_version_id` (nullable), `approved_at` (nullable)
- **AND** o CHECK impede `approval_status='approved'` sem `approved_version_id`

#### Scenario: Campanha legada permanece sem dados de aprovação

- **WHEN** uma campanha `ready` pré-existente é consultada após a migration
- **THEN** ela não possui `approved_version_id`/`approved_at` preenchidos nem linhas em `campaign_art_versions`
- **AND** permanece entregue como hoje (estado legacy — D2)

### Requirement: Tipos de domínio das versões de arte

O sistema SHALL prover os tipos em `src/lib/campaign/types.ts` (extensão de `CampaignRecord`):

```ts
export type CampaignApprovalStatus = "pending_approval" | "approved";
export type ArtVersionStatus = "pending" | "approved" | "rejected";

export interface CampaignArtVersion {
  id: string;
  campaign_id: string;
  version_number: number;                 // 1..3
  status: ArtVersionStatus;
  storage_path: string | null;            // NULL após descarte do asset
  asset_status: "active" | "discarded";
  asset_deleted_at: string | null;
  brief_snapshot: Record<string, unknown>; // campaign_brief_v1 (F39), sem base64
  render_snapshot: Record<string, unknown> | null;
  generation_metadata: Record<string, unknown> | null;
  rejection_reason: Record<string, unknown> | null;
  correction_in_progress: boolean;        // decisão 5 — inalcançável na 37.1
  created_at: string;
}
// CampaignRecord += approval_status, rejection_count, approved_version_id, approved_at
```

- Tipos de correção (`RejectionReason`, `ArtCorrectionStrategy`, `BriefPatch`, `CorrectionIntent`) são **37.2/37.3** — fora desta fatia (proposal).

#### Scenario: CampaignRecord estendido com campos de aprovação

- **WHEN** uma campanha sob a flag é carregada via `getCampaign`
- **THEN** o `CampaignRecord` tipado inclui `approval_status`, `rejection_count`, `approved_version_id` e `approved_at`

### Requirement: Persistência de versões (createArtVersion / listArtVersions)

O sistema SHALL prover em `src/lib/campaign/persistence.ts`:

- `createArtVersion(campaignId, versionNumber, storagePath, briefSnapshot)` — INSERT em `campaign_art_versions` (`status='pending'`, `asset_status='active'`).
- `listArtVersions(campaignId)` — retorna as linhas ordenadas por `version_number` (fonte para `computeApprovalState` e para a tela de revisão).

- Funções de correção (`markVersionRejected`, `discardArtAsset`, `setCorrectionInProgress`) são **37.2** — fora desta fatia.

#### Scenario: createArtVersion insere a v1 pendente e ativa

- **WHEN** o `generate-image` chama `createArtVersion(campaignId, 1, storagePath, briefSnapshot)` com a flag ligada
- **THEN** uma linha em `campaign_art_versions` é criada com `version_number=1`, `status='pending'`, `asset_status='active'`, `storage_path` e `brief_snapshot` iguais aos da geração

#### Scenario: listArtVersions retorna ordenado por versão

- **WHEN** uma campanha com v1 é consultada via `listArtVersions`
- **THEN** retorna 1 linha com `version_number=1`
- **AND** campanhas sem linhas retornam lista vazia (estado legacy)

### Requirement: Aprovação transacional da candidata (approveArtVersion / RPC)

O sistema SHALL prover a aprovação **transacional** da candidata (D8) via RPC `approve_campaign_art_version(p_campaign_id uuid, p_version_id uuid)` (`SECURITY DEFINER`, `SET search_path=''`, acesso `service_role`), atômica em um único bloco plpgsql:

1. `SELECT ... FOR UPDATE` da versão; valida existência (`version_not_found`), vínculo com a campanha (`version_campaign_mismatch`), `status='pending'` (`version_not_pending` — já resolvida) e `asset_status='active'` (`version_not_active`).
2. **Defensivo (D8):** nenhuma outra linha da campanha pode reter asset ativo — `UPDATE campaign_art_versions SET asset_status='discarded', storage_path=NULL, asset_deleted_at=now() WHERE campaign_id=p_campaign_id AND id<>p_version_id AND asset_status='active'` (no-op na 37.1 — só existe v1; remoção física de arquivo é do fluxo de substituição, 37.2).
3. Marca a candidata `status='approved'`.
4. Atualiza `campaigns`: `storage_path` → path da aprovada, `approved_version_id`, `approved_at=now()`, `approval_status='approved'`.

- Se qualquer passo falhar, nada é aplicado (ROLLBACK automático do bloco).
- **Telemetria (D8):** sem novo `generation_type`; o funil de aprovação usa `campaign_art_versions.status` + `campaigns.approved_at`.

#### Scenario: Aprovação da candidata v1 é transacional

- **WHEN** a rota `approve` chama o RPC para a v1 pendente de uma campanha sob a flag
- **THEN** a v1 vira `status='approved'`
- **AND** a campanha ganha `storage_path` apontando para a aprovada, `approved_version_id`, `approved_at` e `approval_status='approved'` na mesma transação

#### Scenario: Versão já resolvida não aprova de novo

- **WHEN** o RPC é chamado para uma versão já `approved` (ou `rejected`)
- **THEN** retorna `version_not_pending` (409) e nada é alterado

#### Scenario: Versão de outra campanha ou inexistente

- **WHEN** o RPC é chamado com `p_version_id` inexistente
- **THEN** retorna `version_not_found`
- **WHEN** o RPC é chamado com `p_version_id` de outra campanha
- **THEN** retorna `version_campaign_mismatch` (404)

#### Scenario: Nenhuma outra linha retém asset ativo (defensivo)

- **WHEN** há outra linha da campanha com `asset_status='active'` e `status <> 'approved'` no momento da aprovação
- **THEN** o RPC a marca como `asset_status='discarded'`, `storage_path=NULL`, `asset_deleted_at=now()`
- **AND** a aprovação continua (na 37.1 esse caminho não ocorre — somente v1 existe)
