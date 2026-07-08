# Campaign Images Storage

> Synced from `fase-12-fundacao-db-storage` (ADDED).

## Purpose

Bucket Supabase Storage privado `campaign-images` com limites de tamanho e MIME, e 3 políticas de acesso (sem UPDATE por imutabilidade).

## Requirements

### Requirement: Private bucket with size and MIME limits

O sistema SHALL criar o bucket `campaign-images` com:

- `public = false`
- `file_size_limit = 10485760` (10MB)
- `allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']`
- `ON CONFLICT (id) DO NOTHING` para idempotência

#### Scenario: Bucket exists and is private

- **WHEN** a migration `20260708000002_create_campaign_images_bucket.sql` é executada
- **THEN** o bucket `campaign-images` existe com `public = false`, limite 10MB e MIME types PNG/JPEG/WEBP

### Requirement: Owner SELECT policy on storage objects

O sistema SHALL criar policy `owner_select_campaign_images` em `storage.objects`:

- `FOR SELECT TO authenticated`
- `USING (bucket_id = 'campaign-images' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())))`

#### Scenario: Owner lists objects in own prefix

- **WHEN** owner autenticado lista objetos em `campaign-images/{storeId}/` via `createServerClient()`
- **THEN** objetos no seu prefixo são retornados

#### Scenario: Owner cannot list objects in alien prefix

- **WHEN** owner autenticado lista objetos em `campaign-images/{alienStoreId}/`
- **THEN** nenhum objeto é retornado

### Requirement: Service_role INSERT policy

O sistema SHALL criar policy `service_insert_campaign_images` em `storage.objects`:

- `FOR INSERT TO service_role`
- `WITH CHECK (bucket_id = 'campaign-images')`

#### Scenario: Service_role can upload objects

- **WHEN** `supabaseAdmin.storage.from('campaign-images').upload()` é chamado
- **THEN** o upload é bem-sucedido

#### Scenario: Client-side upload fails

- **WHEN** `createServerClient().storage.from('campaign-images').upload()` é chamado
- **THEN** o upload é rejeitado (401/403)

### Requirement: Service_role DELETE policy

O sistema SHALL criar policy `service_delete_campaign_images` em `storage.objects`:

- `FOR DELETE TO service_role`
- `USING (bucket_id = 'campaign-images')`

#### Scenario: Service_role can delete objects

- **WHEN** `supabaseAdmin.storage.from('campaign-images').remove()` é chamado
- **THEN** o objeto é removido

### Requirement: No UPDATE policy (imutabilidade)

O sistema NÃO SHALL criar policy de UPDATE para `campaign-images`. Nenhuma policy com nome contendo `service_update_campaign` deve existir no bucket.

#### Scenario: UPDATE policy is absent

- **WHEN** inspecionando Storage policies de `campaign-images`
- **THEN** NENHUMA policy `service_update_campaign_images` existe

### Requirement: Signed URL allows reading

O sistema SHALL permitir leitura via signed URL gerada por service_role. A URL pública direta NÃO SHALL funcionar.

#### Scenario: Signed URL returns image

- **WHEN** `supabaseAdmin.storage.from('campaign-images').createSignedUrl(path, 3600)` é chamado
- **THEN** a URL temporária retorna a imagem com status 200

#### Scenario: Public URL returns error

- **WHEN** uma requisição GET é feita para `{supabaseUrl}/storage/v1/object/public/campaign-images/{path}`
- **THEN** a requisição retorna 404/403
