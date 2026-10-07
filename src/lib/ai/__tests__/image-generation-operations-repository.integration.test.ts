// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PostgresClient } from "pg";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import { resolveProductOneToOneFlow } from "@/lib/product-1-1/feature-flow-decision-service";
import { SupabaseImageGenerationOperationsRepository } from "../image-generation-operations-repository";

const TABLE = "image_generation_operations";
const FLAG_KEYS = [
  "product_1_1_test_stores_enabled",
  "product_1_1_all_stores_enabled",
] as const;
const LOCAL_API_URL = "http://127.0.0.1:56321";

interface IdRow {
  id: string;
}

interface MigrationRows {
  version: string;
}

interface RolePrivilegeRow {
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
  rls_enabled: boolean;
}

interface FlagRow {
  key: string;
  enabled: boolean;
}

let supabase: SupabaseClient;
let repository: SupabaseImageGenerationOperationsRepository;
let postgres: PostgresClient;
let campaignA: string;
let campaignB: string;
let snapshotA: string;
let snapshotB: string;
let validOperation: { id: string; operationId: string };

async function insertOne<T>(
  table: string,
  values: Record<string, unknown>,
  columns: string,
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .insert(values)
    .select(columns)
    .single<T>();

  if (error) throw new Error(`integration_fixture_insert_failed:${error.message}`);
  if (!data) throw new Error(`integration_fixture_insert_failed:${table}_missing_row`);
  return data;
}

async function setFlags(enabled: boolean): Promise<void> {
  const { data, error } = await supabase
    .from("feature_flags")
    .update({ enabled })
    .in("key", [...FLAG_KEYS])
    .select("key, enabled");

  if (error) throw new Error(`integration_flags_update_failed:${error.message}`);
  if (data?.length !== FLAG_KEYS.length) {
    throw new Error(`integration_flags_update_failed:expected_${FLAG_KEYS.length}_rows`);
  }
}

async function readFlags(): Promise<FlagRow[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled")
    .in("key", [...FLAG_KEYS]);

  if (error) throw new Error(`integration_flags_read_failed:${error.message}`);
  return (data ?? []) as FlagRow[];
}

async function expectImmutableTriggerFailure(
  sql: string,
  parameters: readonly unknown[],
): Promise<void> {
  await postgres.query("BEGIN");
  try {
    await postgres.query("SAVEPOINT operation_mutation_attempt");
    let mutationError: unknown;
    try {
      await postgres.query(sql, [...parameters]);
    } catch (error) {
      mutationError = error;
    }

    expect(mutationError).toBeInstanceOf(Error);
    expect((mutationError as Error | undefined)?.message).toBe(
      "image_generation_operations_immutable",
    );
    await postgres.query("ROLLBACK TO SAVEPOINT operation_mutation_attempt");
  } finally {
    // Revert only the attempted UPDATE/DELETE; retain the inserted UAT evidence row.
    await postgres.query("ROLLBACK");
  }
}

describe("image-generation-operations-repository — PostgreSQL isolated integration (F56.2a)", () => {
  beforeAll(async () => {
    const url = process.env.F562A_ISOLATED_SUPABASE_URL;
    const serviceRoleKey = process.env.F562A_ISOLATED_SERVICE_ROLE_KEY;
    const databaseUrl = process.env.F562A_ISOLATED_DATABASE_URL;

    if (!url || !serviceRoleKey || !databaseUrl) {
      throw new Error("isolated_integration_requires_runner_and_redacted_preflight");
    }
    if (url !== LOCAL_API_URL) {
      throw new Error("isolated_integration_api_url_mismatch");
    }
    const parsedDatabaseUrl = new URL(databaseUrl);
    if (
      !["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname) ||
      parsedDatabaseUrl.port !== "56322"
    ) {
      throw new Error("isolated_integration_database_url_mismatch");
    }

    supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    repository = new SupabaseImageGenerationOperationsRepository(supabase);
    postgres = new PostgresClient({ connectionString: databaseUrl, ssl: false });
    await postgres.connect();

    const migrationRows = await postgres.query<MigrationRows>(
      "SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ($1, $2) ORDER BY version",
      ["20261006000001", "20261006000002"],
    );
    expect(migrationRows.rows.map((row) => row.version)).toEqual([
      "20261006000001",
      "20261006000002",
    ]);

    const privilegeResult = await postgres.query<RolePrivilegeRow>(
      `SELECT
         has_table_privilege('service_role', 'public.image_generation_operations', 'SELECT') AS can_select,
         has_table_privilege('service_role', 'public.image_generation_operations', 'INSERT') AS can_insert,
         has_table_privilege('service_role', 'public.image_generation_operations', 'UPDATE') AS can_update,
         has_table_privilege('service_role', 'public.image_generation_operations', 'DELETE') AS can_delete,
         (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.image_generation_operations'::regclass) AS rls_enabled`,
    );
    expect(privilegeResult.rows[0]).toEqual({
      can_select: true,
      can_insert: true,
      can_update: false,
      can_delete: false,
      rls_enabled: true,
    });

    const initialFlags = await readFlags();
    expect(initialFlags).toHaveLength(2);
    expect(initialFlags.every((flag) => flag.enabled === false)).toBe(true);

    // Auth, stores, campaigns, snapshots and operations are synthetic and remain
    // local in this disposable instance until the post-checkpoint final reset.
    const fixtureToken = randomUUID();
    const { data: authUserData, error: authUserError } =
      await supabase.auth.admin.createUser({
        email: `f56-2a-${fixtureToken}@example.invalid`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (authUserError) {
      throw new Error(`integration_auth_fixture_failed:${authUserError.message}`);
    }
    if (!authUserData.user) throw new Error("integration_auth_fixture_failed:user_missing");

    const store = await insertOne<IdRow>(
      "stores",
      {
        user_id: authUserData.user.id,
        name: `F56.2a ${fixtureToken.slice(0, 8)}`,
        segment: "outros",
        is_test_store: true,
      },
      "id",
    );

    const campaignARecord = await insertOne<IdRow>(
      "campaigns",
      {
        store_id: store.id,
        status: "ready",
        product_name: "F56.2a integration A",
        storage_path: `f56-2a-isolated/${fixtureToken}/campaign-a.png`,
      },
      "id",
    );
    const campaignBRecord = await insertOne<IdRow>(
      "campaigns",
      {
        store_id: store.id,
        status: "ready",
        product_name: "F56.2a integration B",
        storage_path: `f56-2a-isolated/${fixtureToken}/campaign-b.png`,
      },
      "id",
    );
    campaignA = campaignARecord.id;
    campaignB = campaignBRecord.id;

    const snapshotARecord = await insertOne<IdRow>(
      "image_generation_config_snapshots",
      {
        campaign_id: campaignA,
        primary_model: "gpt-image-2.5-sunburst",
        primary_quality: "medium",
        fallback_model: "gpt-image-2",
        fallback_quality: "medium",
        config_version_id: randomUUID(),
        origin: "selection",
        run_id: randomUUID(),
        trace_id: `f56-2a-trace-${fixtureToken}-a`,
      },
      "id",
    );
    const snapshotBRecord = await insertOne<IdRow>(
      "image_generation_config_snapshots",
      {
        campaign_id: campaignB,
        primary_model: "gpt-image-2.5-sunburst",
        primary_quality: "medium",
        fallback_model: "gpt-image-2",
        fallback_quality: "medium",
        config_version_id: randomUUID(),
        origin: "selection",
        run_id: randomUUID(),
        trace_id: `f56-2a-trace-${fixtureToken}-b`,
      },
      "id",
    );
    snapshotA = snapshotARecord.id;
    snapshotB = snapshotBRecord.id;

    console.info(
      "[F56.2a isolated fixture IDs]",
      JSON.stringify({ storeId: store.id, campaignA, campaignB, snapshotA, snapshotB }),
    );
  }, 60_000);

  afterAll(async () => {
    try {
      if (supabase) await setFlags(false);
    } finally {
      if (postgres) await postgres.end();
    }
  });

  it("persists a valid attempt linked to its campaign and original snapshot", async () => {
    const operationId = randomUUID();
    validOperation = await repository.recordOperation({
      campaignId: campaignA,
      snapshotOriginalId: snapshotA,
      operationId,
      attemptNumber: 1,
      target: "primary",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      runId: randomUUID(),
      traceId: `f56-2a-valid-${operationId}`,
    });

    const attempts = await repository.listByOperationId({
      campaignId: campaignA,
      operationId,
    });
    expect(validOperation.operationId).toBe(operationId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      campaignId: campaignA,
      snapshotOriginalId: snapshotA,
      operationId,
      attemptNumber: 1,
      target: "primary",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
  });

  it("rejects a missing campaign by its independent campaign foreign key", async () => {
    const missingCampaign = randomUUID();
    await expect(
      repository.recordOperation({
        campaignId: missingCampaign,
        snapshotOriginalId: snapshotA,
        operationId: randomUUID(),
        attemptNumber: 1,
        target: "primary",
        model: "gpt-image-2.5-sunburst",
        quality: "medium",
      }),
    ).rejects.toThrow(/image_generation_operations_campaign_id_fkey/);
  });

  it("rejects a missing snapshot by its independent snapshot foreign key", async () => {
    await expect(
      repository.recordOperation({
        campaignId: campaignA,
        snapshotOriginalId: randomUUID(),
        operationId: randomUUID(),
        attemptNumber: 1,
        target: "primary",
        model: "gpt-image-2.5-sunburst",
        quality: "medium",
      }),
    ).rejects.toThrow(/image_generation_operations_snapshot_original_id_fkey/);
  });

  it("rejects two existing IDs when the snapshot belongs to another campaign", async () => {
    const operationId = randomUUID();
    await expect(
      repository.recordOperation({
        campaignId: campaignA,
        snapshotOriginalId: snapshotB,
        operationId,
        attemptNumber: 1,
        target: "primary",
        model: "gpt-image-2.5-sunburst",
        quality: "medium",
      }),
    ).rejects.toThrow(/image_generation_operations_snapshot_campaign_mismatch/);

    await expect(
      repository.listByOperationId({ campaignId: campaignA, operationId }),
    ).resolves.toEqual([]);
  });

  it("proves service_role has no UPDATE/DELETE and database triggers reject both mutations", async () => {
    expect(validOperation).toBeDefined();

    const serviceRoleUpdate = await supabase
      .from(TABLE)
      .update({ model: "gpt-image-2" })
      .eq("id", validOperation.id);
    expect(serviceRoleUpdate.error).not.toBeNull();

    const serviceRoleDelete = await supabase
      .from(TABLE)
      .delete()
      .eq("id", validOperation.id);
    expect(serviceRoleDelete.error).not.toBeNull();

    await expectImmutableTriggerFailure(
      "UPDATE public.image_generation_operations SET model = $1 WHERE id = $2",
      ["gpt-image-2", validOperation.id],
    );
    await expectImmutableTriggerFailure(
      "DELETE FROM public.image_generation_operations WHERE id = $1",
      [validOperation.id],
    );

    const retained = await repository.listByOperationId({
      campaignId: campaignA,
      operationId: validOperation.operationId,
    });
    expect(retained).toHaveLength(1);
    expect(retained[0]?.model).toBe("gpt-image-2.5-sunburst");
  });

  it("with both flags true still only returns a decision; finally restores both false", async () => {
    const before = await readFlags();
    expect(before.every((flag) => flag.enabled === false)).toBe(true);

    try {
      await setFlags(true);
      const service = new FeatureFlagService(supabase);
      await expect(
        resolveProductOneToOneFlow({ isTestStore: true }, service),
      ).resolves.toBe("new_flow");
      await expect(
        resolveProductOneToOneFlow({ isTestStore: false }, service),
      ).resolves.toBe("new_flow");
      // This integration test invokes neither shopper routes nor generation/provider services.
    } finally {
      await setFlags(false);
    }

    const after = await readFlags();
    expect(after).toHaveLength(2);
    expect(after.every((flag) => flag.enabled === false)).toBe(true);
  });
});
