# Campaigns Table

> Synced from `fase-12-fundacao-db-storage` (ADDED).

## Purpose

DDL da tabela `public.campaigns` com constraints, trigger scoped de `updated_at`, RLS com policy de owner subquery, índices e GRANT SELECT TO authenticated.

## Requirements

### Requirement: Campaigns table DDL

O sistema SHALL criar a tabela `public.campaigns` com os seguintes campos e constraints:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE`
- `status TEXT NOT NULL DEFAULT 'generating'` com CHECK `status IN ('generating', 'ready', 'error')`
- `product_name TEXT NOT NULL`
- `input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb`
- `identity_snapshot JSONB`
- `generation_metadata JSONB`
- `render_snapshot JSONB`
- `publication_copy_snapshot JSONB`
- `storage_path TEXT NOT NULL`
- `error_message TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- CHECK constraint `chk_campaigns_error_message`: `status <> 'error' OR nullif(trim(error_message), '') IS NOT NULL`

#### Scenario: campaigns table exists after migration

- **WHEN** migration `20260708000001_create_campaigns_table.sql` é executada
- **THEN** a tabela `public.campaigns` existe com todos os campos, defaults e constraints

### Requirement: error_message CHECK constraint

O sistema SHALL garantir que `error_message` não seja vazio ou nulo quando `status = 'error'`.

#### Scenario: UPDATE status=error without message is rejected

- **WHEN** um UPDATE seta `status = 'error'` sem `error_message` ou com `error_message` vazio
- **THEN** a constraint `chk_campaigns_error_message` rejeita a operação

#### Scenario: UPDATE status=error with message succeeds

- **WHEN** um UPDATE seta `status = 'error'` com `error_message` não vazio
- **THEN** a operação é aceita

### Requirement: updated_at trigger scoped

O sistema SHALL criar a função `public.update_campaigns_updated_at()` e o trigger `trg_campaigns_updated_at` (BEFORE UPDATE, FOR EACH ROW) que atualiza `updated_at` para `now()`.

#### Scenario: updated_at changes on UPDATE

- **WHEN** um UPDATE é executado em qualquer linha de `campaigns`
- **THEN** o campo `updated_at` é atualizado para o timestamp atual

### Requirement: RLS enabled on campaigns

O sistema SHALL habilitar RLS em `public.campaigns` com policy `owner_select_campaigns`:

- Policy `FOR SELECT TO authenticated` usando subquery: `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))`
- `GRANT SELECT ON TABLE public.campaigns TO authenticated`
- Nenhuma policy INSERT/UPDATE/DELETE para `authenticated` — writes permanecem com `supabaseAdmin`

#### Scenario: Owner can SELECT own campaigns

- **WHEN** owner autenticado consulta `campaigns` via `createServerClient()`
- **THEN** apenas registros pertencentes às suas lojas são retornados

#### Scenario: Other tenant sees no campaigns

- **WHEN** outro usuário autenticado consulta a mesma store_id via `createServerClient()`
- **THEN** 0 resultados são retornados (sem vazamento de dados)

#### Scenario: Client-side INSERT fails

- **WHEN** um cliente tenta INSERT em `campaigns` via `createServerClient()`
- **THEN** a operação é rejeitada por RLS/ausência de policy de escrita

### Requirement: Campaigns indexes

O sistema SHALL criar índices para performance:

- `idx_campaigns_store_id` ON `public.campaigns (store_id)`
- `idx_campaigns_created_at` ON `public.campaigns (created_at DESC)`

#### Scenario: Indexes exist after migration

- **WHEN** migration é executada
- **THEN** ambos os índices existem em `public.campaigns`
