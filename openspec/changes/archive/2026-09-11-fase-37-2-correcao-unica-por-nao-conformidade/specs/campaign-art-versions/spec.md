# Campaign Art Versions

## Purpose

Evolução da capability `campaign-art-versions` (F37.1) pela **F37.2 realinhada — Correção Única por Não Conformidade** (D37.2-R5/R7). A tabela `campaign_art_versions` passa a aceitar o valor de `asset_status` **`'superseded'`** ("não é mais candidata, asset preservado") via **troca transacional e idempotente do CHECK** (preservando `active|discarded`); a **conclusão da v2** (`complete_campaign_correction_v2`) insere a nova linha `version_number=2` e **demove a v1 para `superseded` com `storage_path` preservado** (o lifecycle "substituir → descartar" da F37.1, `discarded` + path nulo, **não** serve à preservação para suporte/auditoria). A RPC F37.1 `approve_campaign_art_version` **permanece intacta** como transação atômica de aprovação (chamada dentro da RPC aditiva `approve_campaign_candidate` — R8); `campaigns.rejection_count` passa a ser escrito **somente pela RPC de consumo da oportunidade** (0 → 1; CHECK 0..2 inalterado; nesta fatia nunca chega a 2).

## MODIFIED Requirements

### Requirement: Tabela campaign_art_versions

O sistema SHALL prover a tabela `campaign_art_versions` (fonte da verdade das artes da campanha; **1 candidata por vez**):

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`.
- `campaign_id` UUID NOT NULL REFERENCES `campaigns(id)` ON DELETE CASCADE.
- `version_number` SMALLINT NOT NULL `CHECK (version_number BETWEEN 1 AND 3)`.
- `status` TEXT NOT NULL `CHECK (status IN ('pending','approved','rejected'))`.
- `correction_in_progress` BOOLEAN NOT NULL DEFAULT false — **marcador da candidata durante correção**; fonte do estado "regenerating" na UI. **Na 37.2 é exercitado** pela RPC de consumo.
- `storage_path` TEXT — NULL após descarte do asset; **NUNCA NULL ao demover para `superseded`** (F37.2 preserva o path).
- `asset_status` TEXT NOT NULL DEFAULT 'active' `CHECK (asset_status IN ('active','discarded','superseded'))` — **MODIFICADO (F37.2):** novo valor `'superseded'` = "não é mais candidata, asset preservado". Troca do CHECK feita de forma **transacional e idempotente** (bloco `DO` idempotente no padrão do CHECK `campaigns_approved_requires_version` da F37.1), **preservando `active|discarded`**; não é adição pura de coluna nem `CREATE OR REPLACE` de RPC existente.
- `asset_deleted_at` TIMESTAMPTZ — preenchido ao descartar o arquivo (não ao superseder).
- `brief_snapshot` JSONB NOT NULL — snapshot `campaign_brief_v1` (F39), sem base64 por construção.
- `render_snapshot` JSONB — por versão (NULL na v1 da 37.1; preenchido na v2 quando aplicável).
- `generation_metadata` JSONB — por versão (NULL na v1 da 37.1; na v2 inclui `operation_run_id` + snapshots econômicos da correção).
- `rejection_reason` JSONB — motivo/texto livre (na 37.2 o relato vive em `campaign_correction_submissions`; campo permanece).
- `created_at` TIMESTAMPTZ DEFAULT now().
- `UNIQUE (campaign_id, version_number)`.
- RLS habilitada, acesso somente `service_role` (padrão `feature_flags`); migration idempotente e não destrutiva.

#### Scenario: CHECK de asset_status aceita superseded preservando active|discarded

- **WHEN** a migration evolutiva da F37.2 é aplicada (idempotente)
- **THEN** o CHECK de `asset_status` passa a ser `('active','discarded','superseded')`
- **AND** `active`/`discarded` continuam válidos (nenhum dado existente é afetado)
- **AND** uma linha pode ser marcada `asset_status='superseded'` mantendo `storage_path`

#### Scenario: Superseded preserva o storage_path (sem descarte)

- **WHEN** a v1 é demovida pela conclusão da v2
- **THEN** a v1 recebe `asset_status='superseded'` e **NÃO** tem `storage_path` zerado nem `asset_deleted_at` preenchido
- **AND** o arquivo permanece acessível para suporte/auditoria via signed URLs server-side

### Requirement: Colunas de aprovação em campaigns

O sistema SHALL manter as colunas de aprovação em `campaigns` (D7, F37.1) com semântica atualizada pela F37.2:

- `approval_status` TEXT NOT NULL DEFAULT 'pending_approval' `CHECK (approval_status IN ('pending_approval','approved'))`.
- `rejection_count` SMALLINT NOT NULL DEFAULT 0 `CHECK (rejection_count BETWEEN 0 AND 2)` — **MODIFICADO (F37.2):** passa a ser o **contador de consumo da oportunidade** — `0 → 1` **na RPC de consumo** (`consume_campaign_correction_opportunity`), no início da 1ª chamada ao provider; a **conclusão da v2 NÃO incrementa de novo** e a falha pós-provider **mantém 1**; nesta fatia **nunca chega a 2** (CHECK 0..2 inalterado; guard de oportunidade única usa `rejection_count=0` + estado do caso + presença de v2 — não "cap 2").
- `approved_version_id` UUID REFERENCES `campaign_art_versions(id)`.
- `approved_at` TIMESTAMPTZ.
- `CHECK (approval_status <> 'approved' OR approved_version_id IS NOT NULL)`.

- **Sem backfill** (F37.1 preservado).

#### Scenario: rejection_count é escrito somente na RPC de consumo

- **WHEN** a RPC de consumo da oportunidade roda (início do provider)
- **THEN** `campaigns.rejection_count` vai de 0 para 1 atomicamente
- **AND** nem a conclusão da v2 nem a falha pós-provider incrementam de novo (permanece 1)

### Requirement: Tipos de domínio das versões de arte

O sistema SHALL prover os tipos em `src/lib/campaign/types.ts` (extensão de `CampaignRecord`):

```ts
export type CampaignApprovalStatus = "pending_approval" | "approved";
export type ArtVersionStatus = "pending" | "approved" | "rejected";
export type ArtAssetStatus = "active" | "discarded" | "superseded"; // MODIFICADO F37.2

export interface CampaignArtVersion {
  id: string;
  campaign_id: string;
  version_number: number;                 // 1..3
  status: ArtVersionStatus;
  storage_path: string | null;            // NULL após descarte; preservado em 'superseded'
  asset_status: ArtAssetStatus;           // + 'superseded' (F37.2)
  asset_deleted_at: string | null;
  brief_snapshot: Record<string, unknown>; // campaign_brief_v1 (F39), sem base64
  render_snapshot: Record<string, unknown> | null;
  generation_metadata: Record<string, unknown> | null;
  rejection_reason: Record<string, unknown> | null;
  correction_in_progress: boolean;        // exercitado na 37.2
  created_at: string;
}
// CampaignRecord += approval_status, rejection_count, approved_version_id, approved_at
```

#### Scenario: Tipo de domínio aceita superseded

- **WHEN** o tipo `CampaignArtVersion.asset_status` é usado
- **THEN** aceita `"active" | "discarded" | "superseded"`

## ADDED Requirements

### Requirement: Persistência da v2 e demissão da v1 preservada

O sistema SHALL persistir a **v2** como nova linha em `campaign_art_versions` e **demover a v1** sem descartar o asset, exclusivamente via a RPC própria de conclusão (`complete_campaign_correction_v2` — especificada em `campaign-correction-reports`):

- A v2 nasce `version_number=2`, `status='pending'`, `asset_status='active'`, `storage_path` próprio, `brief_snapshot` = mesmo snapshot aprovado, `generation_metadata` com `operation_run_id` e snapshots econômicos da correção.
- A v1 (relatada) é demovida para `asset_status='superseded'` com **`storage_path` preservado** — **sem** passar pelo descarte defensivo da RPC F37.1 (`discarded` + `storage_path=NULL`).
- Após a v2, a v1 **deixa de ser candidata** e **não é aprovável pela UX nem pela API** (o `approve_campaign_candidate`/`approve_campaign_art_version` exigem `asset_status='active'` → `version_not_active` 409).

#### Scenario: v2 vira a única candidata

- **WHEN** a RPC de conclusão persiste a v2
- **THEN** `campaign_art_versions` tem a v2 como `active`/`pending` (candidata) e a v1 como `superseded`
- **AND** a v1 não é oferecida pela UX nem aprovada pela API

#### Scenario: RPC F37.1 de aprovação permanece intacta

- **WHEN** a F37.2 roda
- **THEN** a RPC `approve_campaign_art_version` NÃO é alterada (assinatura/validações/descarte defensivo intactos)
- **AND** ela continua sendo a transação atômica de aprovação, agora invocada dentro da RPC aditiva `approve_campaign_candidate` (R8) na rota `approve`
