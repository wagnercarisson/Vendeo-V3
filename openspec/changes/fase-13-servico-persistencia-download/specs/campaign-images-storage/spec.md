# Campaign Images Storage

> Synced from `fase-12-fundacao-db-storage` (ADDED).
> Delta from `fase-13-servico-persistencia-download` (ADDED).

## Purpose

Bucket Supabase Storage privado `campaign-images` com limites de tamanho e MIME, 3 políticas de acesso (sem UPDATE por imutabilidade), upload via service_role com `upsert: false`, signed URL generation para download.

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

## ADDED Requirements

### Requirement: Upload com upsert false

O sistema SHALL fazer upload para `campaign-images` com `upsert: false`. Se o objeto já existir no path, o upload falha (conflito).

#### Scenario: Upload com upsert false falha se path existe

- **WHEN** `supabaseAdmin.storage.from('campaign-images').upload(path, buffer, { upsert: false })` é chamado
- **AND** o path já existe
- **THEN** o upload falha com erro de conflito

### Requirement: Upload com contentType image/jpeg

O sistema SHALL fazer upload com `contentType: 'image/jpeg'`. O formato canônico de entrega é JPEG.

#### Scenario: Upload usa contentType image/jpeg

- **WHEN** `uploadCampaignImage` é chamado
- **THEN** o upload usa `contentType: 'image/jpeg'`

### Requirement: Path canônico .jpg

O sistema SHALL usar path pattern `{storeId}/{campaignId}.jpg` (extensão .jpg) para todos os uploads em `campaign-images`.

#### Scenario: Path termina em .jpg

- **WHEN** `uploadCampaignImage` é chamado com storeId e campaignId
- **THEN** o path é `{storeId}/{campaignId}.jpg`

### Requirement: Signed URL com expiração de 1 hora

O sistema SHALL gerar signed URLs com expiração de 3600 segundos (1 hora) para download de campanhas.

#### Scenario: Signed URL tem TTL de 3600s

- **WHEN** `createSignedUrl(storagePath, 3600)` é chamado
- **THEN** a URL expira após 3600 segundos
