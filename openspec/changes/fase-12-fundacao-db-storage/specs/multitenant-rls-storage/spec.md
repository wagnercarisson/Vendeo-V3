# Multi-Tenant RLS & Storage

> Delta from `fase-12-fundacao-db-storage` (MODIFIED: +campaigns).

## MODIFIED Requirements

### Requirement: RLS enabled on campaigns

O sistema SHALL enable Row Level Security on `campaigns` and create a SELECT policy for the owner.

- Migration SHALL run: `ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY`
- Policy SHALL allow SELECT for `authenticated` role where `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))`
- No INSERT/UPDATE/DELETE policies SHALL be granted to `authenticated` — writes remain in privileged handlers with `supabaseAdmin`
- SHALL run `GRANT SELECT ON TABLE public.campaigns TO authenticated`

#### Scenario: Owner can SELECT from campaigns

- **WHEN** an owner queries `campaigns` via `createServerClient()`
- **THEN** only rows belonging to their store are returned

#### Scenario: Other tenant sees no rows

- **WHEN** another authenticated user queries the same store_id via `createServerClient()`
- **THEN** 0 results are returned (no data leak)

### Requirement: Storage policy restricted for campaign-images

O sistema SHALL create a SELECT policy on the `campaign-images` Storage bucket for owner prefix access.

- SHALL create policy `owner_select_campaign_images` on `storage.objects`
- `FOR SELECT TO authenticated`
- `USING (bucket_id = 'campaign-images' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())))`
- Bucket SHALL be `public = false` (privado)

#### Scenario: Owner lists objects in own campaign-images prefix

- **WHEN** an owner lists objects in `campaign-images/{storeId}/` via `createServerClient()`
- **THEN** objects in their prefix are returned

#### Scenario: Owner cannot list objects in alien prefix

- **WHEN** an owner lists objects in `campaign-images/{alienStoreId}/`
- **THEN** no objects are returned
