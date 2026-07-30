---
quick_id: 260730-pfq
type: fix
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260731000002_fix_admin_create_test_store_cnpj_root_hash.sql
  - src/app/api/admin/stores/create-test/route.ts
  - src/app/api/admin/stores/__tests__/create-test.test.ts
autonomous: true
---

# Fix: Admin Create Test Store — Missing `cnpj_root_hash` (chk_stores_cnpj_atomic)

## Objective

The `admin_create_test_store` RPC inserts into `public.stores` with `cnpj_normalized` but omits `cnpj_root_hash`. The constraint `chk_stores_cnpj_atomic` (added in `20260729000002_fix_cnpj_atomicity.sql`) requires `cnpj_root_hash != ''` whenever `cnpj_normalized` is not null. This causes the admin create-test-store route to fail with a CHECK constraint violation.

**Purpose:** Restore admin create-test-store functionality by making the RPC and route `cnpj_root_hash`-aware.
**Output:** Working admin create-test-store endpoint that satisfies the atomicity constraint.

## Context

@.planning/STATE.md

### Relevant Code

**Route** — `src/app/api/admin/stores/create-test/route.ts` calls the RPC without `p_cnpj_root_hash`:
```typescript
const { data, error } = await supabaseAdmin.rpc("admin_create_test_store", {
  p_user_id: userId,
  p_name: name.trim(),
  p_segment: segment,
  p_cnpj_normalized: cnpjResult.normalized,
  p_razao_social: typeof razaoSocial === "string" ? razaoSocial : null,
  p_nome_fantasia: typeof nomeFantasia === "string" ? nomeFantasia : null,
  p_city: typeof city === "string" ? city : null,
  p_state: typeof state === "string" ? state : null,
  p_granted_by: admin.userId,
});
```

**Hash function** — `src/lib/cnpj/hash.ts`:
```typescript
export function hashCnpjRoot(root: string): string {
  const pepper = process.env.CNPJ_PEPPER;
  if (!pepper) { throw new Error("CNPJ_PEPPER ..."); }
  return createHmac("sha256", pepper).update(root).digest("hex");
}
```

**Constraint** (`chk_stores_cnpj_atomic` in `20260729000002_fix_cnpj_atomicity.sql`):
```sql
CHECK (
  (cnpj_normalized IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL AND cnpj_root_hash = '')
  OR
  (cnpj_normalized IS NOT NULL AND cnpj_normalized ~ '^\d{14}$' AND cnpj_root_hash != '')
)
```

**Pattern from similar functions:**
- `create_store_with_cnpj` (in `20260727000001_freemium_anti_abuso_cnpj.sql` line 202) accepts `p_cnpj_root_hash TEXT` and inserts `cnpj_root_hash`
- `update_store_cnpj` (in `20260730000001_extend_update_store_cnpj.sql` line 13) accepts `p_cnpj_root_hash TEXT` and updates `cnpj_root_hash`

**Current RPC** (`admin_create_test_store` in `20260728000001_f33_cnpj_verification.sql` line 229) — no `p_cnpj_root_hash` parameter, no `cnpj_root_hash` in INSERT.

**Test file:** `src/app/api/admin/stores/__tests__/create-test.test.ts` — mocks RPC but doesn't verify `p_cnpj_root_hash`.

## Tasks

### Task 1: Migration — Add `p_cnpj_root_hash` parameter to RPC

<task type="auto">
  <name>Add p_cnpj_root_hash to admin_create_test_store RPC</name>
  <files>
    - Create: supabase/migrations/20260731000002_fix_admin_create_test_store_cnpj_root_hash.sql
  </files>
  <action>
    Create a new migration file that:

    1. Drops the old function signature to avoid overload ambiguity:
       ```sql
       DROP FUNCTION IF EXISTS public.admin_create_test_store(
         p_user_id UUID, p_name TEXT, p_segment TEXT,
         p_cnpj_normalized TEXT, p_razao_social TEXT, p_nome_fantasia TEXT,
         p_city TEXT, p_state TEXT, p_granted_by UUID
       );
       ```

    2. Recreates with the new `p_cnpj_root_hash TEXT` parameter (no default — it is required when p_cnpj_normalized is provided):
       - Add `p_cnpj_root_hash TEXT` as the second parameter (after `p_cnpj_normalized`, matching the convention in `create_store_with_cnpj`)
       - In the INSERT, add `cnpj_root_hash` to both the column list and VALUES, mapping from `p_cnpj_root_hash`
        - Add explicit validation right after `BEGIN`:
          ```sql
  BEGIN
    IF p_cnpj_normalized IS NOT NULL AND (p_cnpj_root_hash IS NULL OR p_cnpj_root_hash = '') THEN
      RAISE EXCEPTION 'cnpj_root_hash_required';
    END IF;
          ```
          This ensures a clear error message if someone passes an empty hash, rather than a cryptic constraint violation.
        - Keep all existing parameters and behavior unchanged
        - Keep SECURITY DEFINER, search_path = '', RETURNING, audit log INSERT, and JSONB response

     3. Include REVERT section per project convention — use the **new 10-arg signature** for DROP:
        ```sql
        -- REVERT
        -- DROP FUNCTION IF EXISTS public.admin_create_test_store(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
        -- CREATE OR REPLACE FUNCTION ... (old signature without p_cnpj_root_hash) ...
        ```
        The 10 parameters in order: p_user_id UUID, p_name TEXT, p_segment TEXT, p_cnpj_normalized TEXT, p_cnpj_root_hash TEXT, p_razao_social TEXT, p_nome_fantasia TEXT, p_city TEXT, p_state TEXT, p_granted_by UUID.

    Follow the exact pattern from `create_store_with_cnpj` (lines 202-277 of 20260727000001_freemium_anti_abuso_cnpj.sql) for how the parameter and column are handled.
  </action>
  <verify>
    <automated>Missing — Wave 0: SQL is structural; verify via SQL syntax check.</automated>
    Manual check: grep the created migration for both "p_cnpj_root_hash" and "cnpj_root_hash" appearing in the INSERT statement.
  </verify>
  <done>
    New migration exists at the correct path, DROP + CREATE with p_cnpj_root_hash parameter, cnpj_root_hash in INSERT, REVERT section present.
  </done>
</task>

### Task 2: Route — Compute and pass `p_cnpj_root_hash`

<task type="auto">
  <name>Update route to compute and pass cnpj_root_hash</name>
  <files>
    - Edit: src/app/api/admin/stores/create-test/route.ts
  </files>
  <action>
    In `src/app/api/admin/stores/create-test/route.ts`:

    1. **Add import** for `hashCnpjRoot`:
       ```typescript
       import { hashCnpjRoot } from "@/lib/cnpj/hash";
       ```

    2. **After the `validateCnpj` call** (line 30-33), compute the root hash:
       ```typescript
       const cnpjRootHash = hashCnpjRoot(cnpjResult.normalized.slice(0, 8));
       ```
       Place this right after the validation check (`if (cnpjResult instanceof Error)` block).
       The root is the first 8 digits of the normalized CNPJ (the CNPJ root/raiz, before the 4-digit suffix).

    3. **Add `p_cnpj_root_hash` to the RPC call** (between lines 35-45):
       Add `p_cnpj_root_hash: cnpjRootHash,` to the RPC arguments object.

    The final RPC call should look like:
    ```typescript
    const { data, error } = await supabaseAdmin.rpc("admin_create_test_store", {
      p_user_id: userId,
      p_name: name.trim(),
      p_segment: segment,
      p_cnpj_normalized: cnpjResult.normalized,
      p_cnpj_root_hash: cnpjRootHash,
      p_razao_social: typeof razaoSocial === "string" ? razaoSocial : null,
      p_nome_fantasia: typeof nomeFantasia === "string" ? nomeFantasia : null,
      p_city: typeof city === "string" ? city : null,
      p_state: typeof state === "string" ? state : null,
      p_granted_by: admin.userId,
    });
    ```
  </action>
  <verify>
    <automated>cd C:\Projetos\Vendeo V3 && npx tsc --noEmit --pretty 2>&1 | Select-String -SimpleMatch "error" -NotMatch</automated>
  </verify>
  <done>
    route.ts imports hashCnpjRoot, computes cnpjRootHash from first 8 digits of normalized CNPJ, passes p_cnpj_root_hash in RPC call. TypeScript check passes.
  </done>
</task>

### Task 3: Tests — Update mock and assertions

<task type="auto">
  <name>Update tests to verify p_cnpj_root_hash</name>
  <files>
    - Edit: src/app/api/admin/stores/__tests__/create-test.test.ts
  </files>
  <action>
    In `src/app/api/admin/stores/__tests__/create-test.test.ts`:

    1. **Add `hashCnpjRoot` mock** in the `vi.hoisted` block:
       ```typescript
       const mockHashCnpjRoot = vi.fn((root: string) => `hashed_${root}`);
       ```
       Place it alongside the existing mocks (`mockRpc`, `mockValidateCnpj`).

    2. **Add mock for `@/lib/cnpj/hash`** in the vi.mock section:
       ```typescript
       vi.mock("@/lib/cnpj/hash", () => ({
         hashCnpjRoot: mockHashCnpjRoot,
       }));
       ```

     3. **In the "creates test store successfully" test** (line 46), add assertions:
        - After the POST call, verify `mockHashCnpjRoot` was called with `"12345678"` (first 8 digits of `"12345678000195"`):
          ```typescript
          expect(mockHashCnpjRoot).toHaveBeenCalledWith("12345678");
          ```
        - Verify the RPC was called with the **exact** values:
          ```typescript
          expect(mockRpc).toHaveBeenCalledWith(
            "admin_create_test_store",
            expect.objectContaining({
              p_cnpj_normalized: "12345678000195",
              p_cnpj_root_hash: "hashed_12345678",
            }),
          );
          ```

    The test CNPJ `"12345678000195"` has root `"12345678"`, so `hashCnpjRoot` should be called with `"12345678"` and the mock should return `"hashed_12345678"`. The assertion validates exact values for both `p_cnpj_normalized` and `p_cnpj_root_hash`.
  </action>
  <verify>
    <automated>cd C:\Projetos\Vendeo V3 && npx vitest run src/app/api/admin/stores/__tests__/create-test.test.ts --reporter=verbose 2>&1</automated>
  </verify>
  <done>
    Tests pass (3/3). mockHashCnpjRoot is called with "12345678". RPC is called with p_cnpj_root_hash. TypeScript/lint/build all clean.
  </done>
</task>

## Verification

```bash
# TypeScript
cd C:\Projetos\Vendeo V3 && npx tsc --noEmit --pretty

# Tests
cd C:\Projetos\Vendeo V3 && npx vitest run src/app/api/admin/stores/__tests__/create-test.test.ts --reporter=verbose

# Lint
cd C:\Projetos\Vendeo V3 && npx next lint
```

## Success Criteria

- New migration `20260731000002_fix_admin_create_test_store_cnpj_root_hash.sql` created with DROP + CREATE + REVERT
- Route computes `hashCnpjRoot(cnpjResult.normalized.slice(0, 8))` and passes `p_cnpj_root_hash`
- Test verifies hash function call and RPC parameter presence
- Admin create-test-store endpoint works end-to-end without `chk_stores_cnpj_atomic` violation
- TypeScript clean, tests passing, lint clean
