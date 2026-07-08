## ADDED Requirements

### Requirement: RLS enabled on store_brand_assets

The system SHALL enable Row Level Security on `store_brand_assets` and create a SELECT policy for the owner.

- Migration SHALL run: `ALTER TABLE store_brand_assets ENABLE ROW LEVEL SECURITY`
- Policy SHALL allow SELECT for `authenticated` role where `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))`
- No INSERT/UPDATE/DELETE policies SHALL be granted to `authenticated` — writes remain in privileged handlers with `supabaseAdmin`

#### Scenario: Owner can SELECT from store_brand_assets

- **WHEN** an owner queries `store_brand_assets` via `createServerClient()`
- **THEN** only rows belonging to their store are returned

### Requirement: RLS enabled on store_brand_profiles

The system SHALL enable Row Level Security on `store_brand_profiles` and create a SELECT policy for the owner.

- Migration SHALL run: `ALTER TABLE store_brand_profiles ENABLE ROW LEVEL SECURITY`
- Policy SHALL use the same subquery pattern as `store_brand_assets`
- No write policies SHALL be granted to `authenticated`

#### Scenario: Owner can SELECT from store_brand_profiles

- **WHEN** an owner queries `store_brand_profiles` via `createServerClient()`
- **THEN** only rows belonging to their store are returned

### Requirement: RLS enabled on store_visual_signatures

The system SHALL enable Row Level Security on `store_visual_signatures` and create a SELECT policy for the owner.

- Migration SHALL run: `ALTER TABLE store_visual_signatures ENABLE ROW LEVEL SECURITY`
- Policy SHALL use the same subquery pattern as `store_brand_assets`
- No write policies SHALL be granted to `authenticated`

#### Scenario: Owner can SELECT from store_visual_signatures

- **WHEN** an owner queries `store_visual_signatures` via `createServerClient()`
- **THEN** only rows belonging to their store are returned

### Requirement: RLS enabled on generation_events (default-deny)

The system SHALL enable Row Level Security on `generation_events` with default-deny (no policies for `authenticated`).

- Migration SHALL run: `ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY`
- SHALL NOT create any policy for `authenticated` role
- Only `supabaseAdmin` (service role) SHALL be able to access this table

#### Scenario: Authenticated user sees nothing in generation_events

- **WHEN** an authenticated user queries `generation_events` via `createServerClient()`
- **THEN** no rows are returned (default-deny)

### Requirement: Storage policy restricted for store-brand-assets

The system SHALL restrict the SELECT policy on the `store-brand-assets` Storage bucket.

- SHALL drop any existing public SELECT policy on `storage.objects` for `store-brand-assets`
- SHALL create a new policy `FOR SELECT TO authenticated` using `(storage.foldername(name))[1] IN (SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid()))`
- Bucket SHALL remain `public = true` — download by known URL is still permitted
- Only list/discovery operations are blocked cross-tenant

#### Scenario: Owner lists objects in own prefix

- **WHEN** an owner lists objects in `store-brand-assets/{storeId}/` via `createServerClient()`
- **THEN** objects in their prefix are returned

#### Scenario: Owner cannot list objects in alien prefix

- **WHEN** an owner lists objects in `store-brand-assets/{alienStoreId}/`
- **THEN** no objects are returned

### Requirement: Storage policy restricted for visual-signatures

The system SHALL restrict the SELECT policy on the `visual-signatures` Storage bucket following the same pattern as `store-brand-assets`.

- SHALL drop any existing public SELECT policy on `storage.objects` for `visual-signatures`
- SHALL create a new policy `FOR SELECT TO authenticated` with path prefix verification
- Bucket SHALL remain `public = true`

#### Scenario: Owner lists objects in own visual-signatures prefix

- **WHEN** an owner lists objects in `visual-signatures/{storeId}/`
- **THEN** objects in their prefix are returned

### Requirement: store-logos documented as temporary exception

The system SHALL document `store-logos` as a temporary exception.

- The existing public SELECT policy on `store-logos` SHALL remain unchanged
- A comment/documentation entry SHALL be added noting the exception
- No new flows SHALL read/write to `store-logos` without ownership check

#### Scenario: store-logos policy unchanged

- **WHEN** inspecting Storage policies for `store-logos`
- **THEN** the existing public SELECT policy remains active
