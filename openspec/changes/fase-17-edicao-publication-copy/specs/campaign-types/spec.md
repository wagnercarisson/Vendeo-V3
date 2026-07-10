# Campaign Types

> Part of `fase-17-edicao-publication-copy` (MODIFIED).
> Delta spec — modifies requirements from main `openspec/specs/campaign-types/spec.md`.

## Purpose

Adicionar campo `publication_copy_current: Record<string, unknown> | null` opcional na interface `CampaignRecord` para suportar a versão editada pelo usuário do publication copy.

## MODIFIED Requirements

### Requirement: CampaignRecord interface

O sistema SHALL definir a interface `CampaignRecord` com todos os campos da tabela `public.campaigns`:
`id (string)`, `store_id (string)`, `status (CampaignStatus)`, `product_name (string)`, `input_snapshot (Record<string, unknown>)`, `identity_snapshot (Record<string, unknown> | null)`, `generation_metadata (Record<string, unknown> | null)`, `render_snapshot (Record<string, unknown> | null)`, `publication_copy_snapshot (Record<string, unknown> | null)`, `publication_copy_current (Record<string, unknown> | null)`, `storage_path (string)`, `error_message (string | null)`, `created_at (string)`, `updated_at (string)`.

**Nota:** O campo `publication_copy_current` é ADICIONADO. Quando presente, contém os mesmos campos de `PublicationCopySnapshot` (`caption`, `hashtags`, `cta_post`). Quando `null`, o sistema usa `publication_copy_snapshot` como fallback.

#### Scenario: CampaignRecord aceita publication_copy_current

- **WHEN** um registro de `campaigns` é mapeado para `CampaignRecord`
- **THEN** o campo `publication_copy_current` está presente como `Record<string, unknown> | null`
- **AND** é opcional — registros sem edição têm `publication_copy_current = null`
