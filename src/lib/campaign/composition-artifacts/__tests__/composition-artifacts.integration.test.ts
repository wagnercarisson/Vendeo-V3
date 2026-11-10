// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PostgresClient } from "pg";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { evaluateF601Target } from "../../../../../scripts/testing/f60-1-gate.mjs";
import {
  COMPOSITION_ARTIFACT_BUCKET,
  compositionArtifactStoragePath,
} from "../artifact-path";
import { computeChecksumSha256 } from "../integrity";
import { persistCompositionArtifact } from "../persist";
import { retrieveCompositionArtifact } from "../retrieve";
import { resolveReusableSquareSource } from "../resolve-source";
import { CAMPAIGN_IMAGES_BUCKET } from "../storage";
import type {
  ArtifactIdentity,
  ArtifactRole,
  PersistArtifactInput,
} from "../types";

/**
 * F60.1 — integração REAL (banco + Storage), exclusivamente em alvo loopback
 * descartável/homolog autorizado.
 *
 * Este arquivo é registrado em `integration.f60-1` e excluído da suíte local.
 * Sem `F60_TEST_ALLOW_WRITES=1`, sem `SUPABASE_URL` loopback ou sem credencial
 * de teste, a suíte falha fechada antes de criar qualquer client/objeto.
 */

const TABLE = "campaign_composition_artifacts";
const INTERNAL_BUCKET = COMPOSITION_ARTIFACT_BUCKET;
const REQUIRED_ENV = [
  "F60_1_TARGET",
  "TEST_DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "F60_1_TEST_USER_EMAIL",
  "F60_1_TEST_USER_PASSWORD",
] as const;

interface Fixture {
  readonly runId: string;
  readonly storeId: string;
  readonly storeCreated: boolean;
  readonly userId: string;
  readonly legacyCampaignId: string;
  readonly newFlowCampaignId: string;
  readonly otherStoreId: string;
  readonly otherCampaignId: string;
  readonly newFlowOperationId: string;
  readonly otherUserId: string;
}

interface ArtifactRow {
  readonly id: string;
}

interface CountRow {
  readonly n: number;
}

interface ErrorWithCode {
  readonly code?: string;
  readonly message?: string;
}

const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  ".planning/phases/60.1-f60-1-persistencia-e-recuperacao-de-artefatos-reutilizaveis/evidence",
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ManifestStatus = "in_progress" | "completed" | "incomplete" | "failed";

interface FixtureManifest {
  runId: string;
  startedAt: string;
  target: {
    kind: string;
    dbPort: string;
    apiPort: string;
  };
  status: ManifestStatus;
  error?: string;
  referenceBaselineSha256?: string;
  users: Array<{ id: string; created: boolean }>;
  stores: Array<{ id: string; created: boolean }>;
  campaigns: Array<{
    id: string;
    kind: string;
    storagePath: string;
  }>;
  artifacts: Array<{
    id?: string;
    storeId: string;
    campaignId: string;
    operationId: string;
    role: string;
    storagePath: string;
  }>;
  objects: Array<{ bucket: string; path: string }>;
  completedAt?: string;
}

let manifest: FixtureManifest | null = null;
let manifestPath = "";
let manifestFailed = false;

let service: SupabaseClient;
let anon: SupabaseClient;
let authenticated: SupabaseClient;
let postgres: PostgresClient;
let fixture: Fixture;
let baselineHash: string;
let legacyJpeg: Buffer;
let newFlowJpeg: Buffer;
let originalJpeg: Buffer;
let preparedJpeg: Buffer;
let differentJpeg: Buffer;

function requireEnv(name: (typeof REQUIRED_ENV)[number]): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`f60_1_integration_missing_env:${name}`);
  }
  return value;
}

function persistManifest(): void {
  if (!manifest || !manifestPath) return;
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

function initManifest(
  runId: string,
  gate: {
    targetKind?: string | null;
    expected?: { dbPort?: string; apiPort?: string } | null;
  },
): void {
  manifest = {
    runId,
    startedAt: new Date().toISOString(),
    target: {
      kind: gate.targetKind ?? "unknown",
      dbPort: gate.expected?.dbPort ?? "unknown",
      apiPort: gate.expected?.apiPort ?? "unknown",
    },
    status: "in_progress",
    users: [],
    stores: [],
    campaigns: [],
    artifacts: [],
    objects: [],
  };
  manifestPath = path.join(EVIDENCE_DIR, `60.1-04-fixtures-${runId}.json`);
  persistManifest();
}

function recordUser(id: string, created: boolean): void {
  if (!manifest || manifest.users.some((entry) => entry.id === id)) return;
  manifest.users.push({ id, created });
  persistManifest();
}

function recordStore(id: string, created: boolean): void {
  if (!manifest || manifest.stores.some((entry) => entry.id === id)) return;
  manifest.stores.push({ id, created });
  persistManifest();
}

function recordCampaign(
  id: string,
  kind: string,
  storagePath: string,
): void {
  if (!manifest || manifest.campaigns.some((entry) => entry.id === id)) return;
  manifest.campaigns.push({ id, kind, storagePath });
  persistManifest();
}

function recordArtifact(entry: {
  id?: string;
  storeId: string;
  campaignId: string;
  operationId: string;
  role: string;
  storagePath: string;
}): void {
  if (
    !manifest ||
    manifest.artifacts.some(
      (current) =>
        current.storeId === entry.storeId &&
        current.campaignId === entry.campaignId &&
        current.operationId === entry.operationId &&
        current.role === entry.role,
    )
  ) {
    return;
  }
  manifest.artifacts.push(entry);
  persistManifest();
}

function recordObject(bucket: string, objectPath: string): void {
  if (
    !manifest ||
    manifest.objects.some(
      (entry) => entry.bucket === bucket && entry.path === objectPath,
    )
  ) {
    return;
  }
  manifest.objects.push({ bucket, path: objectPath });
  persistManifest();
}

function recordIdentityArtifact(identity: ArtifactIdentity): void {
  const storagePath = compositionArtifactStoragePath(identity);
  recordArtifact({
    storeId: identity.storeId,
    campaignId: identity.campaignId,
    operationId: identity.operationId,
    role: identity.role,
    storagePath,
  });
  recordObject(INTERNAL_BUCKET, storagePath);
}

function markManifest(status: ManifestStatus, error?: string): void {
  if (!manifest) return;
  manifest.status = status;
  if (error !== undefined) manifest.error = error;
  if (status === "completed") manifest.completedAt = new Date().toISOString();
  persistManifest();
}

function requireAuthorizedTarget(): ReturnType<typeof evaluateF601Target> {
  const gate = evaluateF601Target(process.env);
  if (!gate.ready) {
    throw new Error(
      `f60_1_integration_gate_refused:${gate.reasons.join("; ")}`,
    );
  }
  return gate;
}

function assertNoError(
  result: { readonly error: { readonly message?: string } | null },
  context: string,
): void {
  if (result.error) {
    throw new Error(`${context}:${result.error.message ?? "unknown_error"}`);
  }
}

async function insertOne<T>(
  table: string,
  values: Record<string, unknown>,
  columns: string,
): Promise<T> {
  const result = await service.from(table).insert(values).select(columns).single<T>();
  assertNoError(result, `fixture_insert_failed:${table}`);
  if (!result.data) throw new Error(`fixture_insert_missing:${table}`);
  return result.data;
}

async function uploadFixture(
  bucket: string,
  path: string,
  bytes: Buffer,
): Promise<void> {
  const result = await service.storage.from(bucket).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (result.error) {
    throw new Error(`fixture_upload_failed:${bucket}:${result.error.message}`);
  }
  recordObject(bucket, path);
}

async function resolveTestStore(userId: string): Promise<{
  storeId: string;
  created: boolean;
}> {
  const authorizedStoreId = process.env.F60_1_TEST_STORE_ID;
  if (authorizedStoreId) {
    if (!UUID_RE.test(authorizedStoreId)) {
      throw new Error("f60_1_test_store_id_invalid");
    }
    const existing = await service
      .from("stores")
      .select("id, user_id, is_test_store")
      .eq("id", authorizedStoreId)
      .maybeSingle<{
        id: string;
        user_id: string;
        is_test_store: boolean;
      }>();
    assertNoError(existing, "fixture_authorized_store_lookup_failed");
    if (
      !existing.data ||
      existing.data.user_id !== userId ||
      existing.data.is_test_store !== true
    ) {
      throw new Error("f60_1_authorized_store_not_a_test_fixture");
    }
    recordStore(existing.data.id, false);
    return { storeId: existing.data.id, created: false };
  }

  const existing = await service
    .from("stores")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();
  assertNoError(existing, "fixture_store_lookup_failed");
  if (existing.data?.id) {
    throw new Error("f60_1_existing_store_requires_F60_1_TEST_STORE_ID");
  }

  const created = await insertOne<{ id: string }>(
    "stores",
    {
      user_id: userId,
      name: `F60.1 ${randomUUID().slice(0, 8)}`,
      segment: "outros",
      is_test_store: true,
    },
    "id",
  );
  recordStore(created.id, true);
  return { storeId: created.id, created: true };
}

async function createOtherStore(): Promise<{
  storeId: string;
  userId: string;
  createdUser: boolean;
}> {
  const providedUserId = process.env.F60_1_SECOND_TEST_USER_ID;
  let userId: string;
  let createdUser = false;

  if (providedUserId) {
    if (!UUID_RE.test(providedUserId)) {
      throw new Error("f60_1_second_user_id_invalid");
    }
    userId = providedUserId;
    recordUser(userId, false);
  } else if (process.env.F60_1_ALLOW_TEST_USER_CREATION === "1") {
    const user = await service.auth.admin.createUser({
      email: `f60-1-${randomUUID()}@example.invalid`,
      password: randomUUID(),
      email_confirm: true,
    });
    if (user.error || !user.data.user) {
      throw new Error(`fixture_other_user_failed:${user.error?.message}`);
    }
    userId = user.data.user.id;
    createdUser = true;
    recordUser(userId, true);
  } else {
    throw new Error(
      "f60_1_second_user_not_authorized:F60_1_SECOND_TEST_USER_ID_or_F60_1_ALLOW_TEST_USER_CREATION",
    );
  }

  const store = await insertOne<{ id: string }>(
    "stores",
    {
      user_id: userId,
      name: `F60.1 other ${randomUUID().slice(0, 8)}`,
      segment: "outros",
      is_test_store: true,
    },
    "id",
  );
  recordStore(store.id, true);
  return { storeId: store.id, userId, createdUser };
}

async function referenceHash(campaignIds: readonly string[]): Promise<string> {
  const { rows } = await postgres.query<{ payload: string }>(
    `with ref as (
       select 'campaign' as kind, id::text as id, store_id::text as a,
              status as b, coalesce(storage_path, '') as c, updated_at::text as d
       from public.campaigns
       where id <> all($1::uuid[])
       union all
       select 'p11', id::text, campaign_id::text, operation_id::text,
              storage_path, width::text || 'x' || height::text || ':' ||
              mime_type || ':' || created_at::text
       from public.product_1_1_campaign_artifacts
       where campaign_id <> all($1::uuid[])
       union all
       select 'cav', id::text, campaign_id::text, version_number::text,
              status, coalesce(storage_path, '') || ':' || asset_status || ':' ||
              created_at::text
       from public.campaign_art_versions
       where campaign_id <> all($1::uuid[])
     )
     select coalesce(jsonb_agg(to_jsonb(ref) order by kind, id)::text, '[]') as payload
     from ref`,
    [campaignIds],
  );
  return createHash("sha256").update(rows[0]?.payload ?? "[]").digest("hex");
}

async function artifactRowCount(identity: ArtifactIdentity): Promise<number> {
  const { rows } = await postgres.query<CountRow>(
    `select count(*)::int as n from public.campaign_composition_artifacts
     where store_id = $1 and campaign_id = $2 and operation_id = $3 and role = $4`,
    [identity.storeId, identity.campaignId, identity.operationId, identity.role],
  );
  return rows[0]?.n ?? 0;
}

function inputFor(
  identity: ArtifactIdentity,
  bytes: Buffer,
  overrides: Partial<PersistArtifactInput> = {},
): PersistArtifactInput {
  return {
    identity,
    authorization: { kind: "system" },
    bytes,
    origin: "provider_generation",
    source: { kind: "none" },
    provenance: {},
    ...overrides,
  };
}

function identityFor(
  campaignId: string,
  role: ArtifactRole,
  operationId = randomUUID(),
): ArtifactIdentity {
  return {
    storeId: fixture.storeId,
    campaignId,
    operationId,
    role,
  };
}

async function expectPgError(
  sql: string,
  params: readonly unknown[],
  code: string,
  messagePart?: string,
): Promise<void> {
  try {
    await postgres.query(sql, params as unknown[]);
  } catch (error) {
    const record = error as ErrorWithCode;
    expect(record.code).toBe(code);
    if (messagePart) expect(record.message ?? "").toContain(messagePart);
    return;
  }
  throw new Error(`expected_pg_error:${code}`);
}

interface ArtifactInsert {
  readonly store_id: string;
  readonly campaign_id: string;
  readonly operation_id: string;
  readonly role: string;
  readonly format: string;
  readonly origin: string;
  readonly derived_from_artifact_id: string | null;
  readonly source_campaign_id: string | null;
  readonly storage_bucket: string;
  readonly storage_path: string;
  readonly width: number;
  readonly height: number;
  readonly mime_type: string;
  readonly byte_size: number;
  readonly checksum_sha256: string;
  readonly provenance: Record<string, unknown>;
}

function artifactInsert(
  overrides: Partial<ArtifactInsert> = {},
): ArtifactInsert & { id: string } {
  return {
    id: randomUUID(),
    store_id: fixture.storeId,
    campaign_id: fixture.newFlowCampaignId,
    operation_id: randomUUID(),
    role: "square_original",
    format: "1:1",
    origin: "provider_generation",
    derived_from_artifact_id: null,
    source_campaign_id: null,
    storage_bucket: INTERNAL_BUCKET,
    storage_path: `${fixture.storeId}/${fixture.newFlowCampaignId}/${randomUUID()}/square_original.jpg`,
    width: 1024,
    height: 1024,
    mime_type: "image/jpeg",
    byte_size: originalJpeg.byteLength,
    checksum_sha256: computeChecksumSha256(originalJpeg),
    provenance: {},
    ...overrides,
  };
}

async function insertArtifactRow(
  overrides: Partial<ArtifactInsert> = {},
): Promise<string> {
  const row = artifactInsert(overrides);
  const columns = Object.keys(row);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const values = columns.map((column) => {
    const value = row[column as keyof typeof row];
    return column === "provenance" ? JSON.stringify(value) : value;
  });
  await postgres.query(
    `insert into public.campaign_composition_artifacts (${columns.join(", ")})
     values (${placeholders})`,
    values,
  );
  recordArtifact({
    id: row.id,
    storeId: row.store_id,
    campaignId: row.campaign_id,
    operationId: row.operation_id,
    role: row.role,
    storagePath: row.storage_path,
  });
  return row.id;
}

function failingInsertClient(
  client: SupabaseClient,
  table: string,
): SupabaseClient {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "from") {
        return (name: string) => {
          const builder = target.from(name);
          if (name !== table) return builder;
          return new Proxy(builder, {
            get(builderTarget, builderProperty) {
              if (builderProperty === "insert") {
                return () => ({
                  select: () => ({
                    single: async () => ({
                      data: null,
                      error: { message: "injected_insert_failure" },
                    }),
                  }),
                });
              }
              const value = Reflect.get(builderTarget, builderProperty, builderTarget);
              return typeof value === "function"
                ? value.bind(builderTarget)
                : value;
            },
          });
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as SupabaseClient;
}

interface StorageCalls {
  signed: number;
  publicUrl: number;
  remove: number;
  update: number;
  uploads: Array<{ bucket: string; path: string; upsert: unknown }>;
}

function instrumentedClient(client: SupabaseClient): {
  client: SupabaseClient;
  calls: StorageCalls;
} {
  const calls: StorageCalls = {
    signed: 0,
    publicUrl: 0,
    remove: 0,
    update: 0,
    uploads: [],
  };
  const proxy = new Proxy(client, {
    get(target, property, receiver) {
      if (property === "storage") {
        return {
          from(bucket: string) {
            const builder = target.storage.from(bucket);
            return new Proxy(builder, {
              get(builderTarget, builderProperty) {
                if (builderProperty === "createSignedUrl") {
                  return (...args: unknown[]) => {
                    calls.signed += 1;
                    return (
                      builderTarget.createSignedUrl as unknown as (
                        ...inner: unknown[]
                      ) => Promise<unknown>
                    )(...args);
                  };
                }
                if (builderProperty === "getPublicUrl") {
                  return (...args: unknown[]) => {
                    calls.publicUrl += 1;
                    return (
                      builderTarget.getPublicUrl as unknown as (
                        ...inner: unknown[]
                      ) => unknown
                    )(...args);
                  };
                }
                if (builderProperty === "remove") {
                  return (...args: unknown[]) => {
                    calls.remove += 1;
                    return (
                      builderTarget.remove as unknown as (
                        ...inner: unknown[]
                      ) => Promise<unknown>
                    )(...args);
                  };
                }
                if (builderProperty === "update") {
                  return (...args: unknown[]) => {
                    calls.update += 1;
                    return (
                      builderTarget.update as unknown as (
                        ...inner: unknown[]
                      ) => Promise<unknown>
                    )(...args);
                  };
                }
                if (builderProperty === "upload") {
                  return (
                    path: string,
                    bytes: Buffer,
                    options?: Record<string, unknown>,
                  ) => {
                    calls.uploads.push({
                      bucket,
                      path,
                      upsert: options?.upsert,
                    });
                    return (
                      builderTarget.upload as unknown as (
                        innerPath: string,
                        innerBytes: Buffer,
                        innerOptions?: Record<string, unknown>,
                      ) => Promise<unknown>
                    )(path, bytes, options);
                  };
                }
                const value = Reflect.get(builderTarget, builderProperty, builderTarget);
                return typeof value === "function"
                  ? value.bind(builderTarget)
                  : value;
              },
            });
          },
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as SupabaseClient;
  return { client: proxy, calls };
}

function evidencePayload(metadata: unknown): Record<string, unknown> | null {
  if (metadata === null || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const payload =
    record.vendeo_composition_artifact ?? record.vendeoCompositionArtifact;
  return payload !== null && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

async function downloadBytes(path: string): Promise<Buffer> {
  const result = await service.storage.from(INTERNAL_BUCKET).download(path);
  assertNoError(result, "object_download_failed");
  if (!result.data) throw new Error("object_download_missing");
  const arrayBuffer = await result.data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function readMetadata(path: string): Promise<Record<string, unknown>> {
  const result = await service.storage.from(INTERNAL_BUCKET).info(path);
  assertNoError(result, "object_info_failed");
  const metadata = result.data?.metadata;
  return metadata !== null && typeof metadata === "object"
    ? (metadata as Record<string, unknown>)
    : {};
}

beforeAll(async () => {
  const gate = requireAuthorizedTarget();
  const runId = `${Date.now()}-${randomUUID()}`;
  initManifest(runId, gate);

  try {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  authenticated = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signIn = await authenticated.auth.signInWithPassword({
    email: requireEnv("F60_1_TEST_USER_EMAIL"),
    password: requireEnv("F60_1_TEST_USER_PASSWORD"),
  });
  if (signIn.error || !signIn.data.user) {
    throw new Error(`f60_1_integration_sign_in_failed:${signIn.error?.message}`);
  }
  recordUser(signIn.data.user.id, false);

  postgres = new PostgresClient({
    connectionString: requireEnv("TEST_DATABASE_URL"),
    ssl: false,
  });
  await postgres.connect();

  const testStore = await resolveTestStore(signIn.data.user.id);
  const otherStore = await createOtherStore();

  originalJpeg = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  preparedJpeg = await sharp({
    create: {
      width: 1152,
      height: 1152,
      channels: 3,
      background: { r: 30, g: 120, b: 60 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  legacyJpeg = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 3,
      background: { r: 120, g: 60, b: 40 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  newFlowJpeg = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 40, g: 60, b: 120 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  differentJpeg = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 200, g: 20, b: 30 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const legacyCampaignId = randomUUID();
  const newFlowCampaignId = randomUUID();
  const otherCampaignId = randomUUID();
  const newFlowOperationId = randomUUID();

  fixture = {
    runId,
    storeId: testStore.storeId,
    storeCreated: testStore.created,
    userId: signIn.data.user.id,
    legacyCampaignId,
    newFlowCampaignId,
    otherStoreId: otherStore.storeId,
    otherCampaignId,
    newFlowOperationId,
    otherUserId: otherStore.userId,
  };

  // Baseline capturado ANTES das campanhas de fixture. As linhas de fixture são
  // excluídas por UUID; nada é excluído por prefixo textual.
  baselineHash = await referenceHash([
    legacyCampaignId,
    newFlowCampaignId,
    otherCampaignId,
  ]);
  if (manifest) {
    manifest.referenceBaselineSha256 = baselineHash;
    persistManifest();
  }

  const legacyPath = `${testStore.storeId}/${legacyCampaignId}.jpg`;
  const newFlowPath = `${testStore.storeId}/${newFlowCampaignId}/product-1-1/${newFlowOperationId}/art-1024.jpg`;

  await insertOne("campaigns", {
    id: legacyCampaignId,
    store_id: testStore.storeId,
    status: "ready",
    product_name: `F60.1 legacy ${runId}`,
    storage_path: legacyPath,
    input_snapshot: {},
  }, "id");
  recordCampaign(legacyCampaignId, "legacy_campaign", legacyPath);
  await insertOne("campaigns", {
    id: newFlowCampaignId,
    store_id: testStore.storeId,
    status: "ready",
    product_name: `F60.1 new ${runId}`,
    storage_path: newFlowPath,
    input_snapshot: {},
  }, "id");
  recordCampaign(newFlowCampaignId, "new_flow_1_1", newFlowPath);
  await insertOne("campaigns", {
    id: otherCampaignId,
    store_id: otherStore.storeId,
    status: "ready",
    product_name: `F60.1 other ${runId}`,
    storage_path: `${otherStore.storeId}/${otherCampaignId}.jpg`,
    input_snapshot: {},
  }, "id");
  recordCampaign(
    otherCampaignId,
    "other_store",
    `${otherStore.storeId}/${otherCampaignId}.jpg`,
  );

  await uploadFixture(CAMPAIGN_IMAGES_BUCKET, legacyPath, legacyJpeg);
  await uploadFixture(CAMPAIGN_IMAGES_BUCKET, newFlowPath, newFlowJpeg);
  } catch (error) {
    markManifest(
      "failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
});

afterEach((context) => {
  if (context.task.result?.state === "fail") {
    manifestFailed = true;
  }
});

afterAll(async () => {
  if (manifest && manifest.status === "in_progress") {
    markManifest(manifestFailed ? "failed" : "completed");
  }
  // Nenhum objeto/linha de `campaign_composition_artifacts` é apagado: a linha
  // é imutável e a repetição usa UUIDs novos. Resíduos ficam na evidência.
  await postgres?.end().catch(() => undefined);
});

describe("F60.1 integration — estrutura e constraints", () => {
  it("cria tabela, constraints, trigger e índice aditivo", async () => {
    const table = await postgres.query<{ oid: string | null }>(
      "select to_regclass('public.campaign_composition_artifacts')::text as oid",
    );
    expect(table.rows[0]?.oid).not.toBeNull();

    const constraints = await postgres.query<{ conname: string }>(
      `select conname from pg_constraint
       where conrelid = 'public.campaign_composition_artifacts'::regclass`,
    );
    const names = new Set(constraints.rows.map((row) => row.conname));
    for (const name of [
      "uq_cca_identity",
      "fk_cca_campaign_store",
      "fk_cca_source_campaign_store",
      "ck_cca_role",
      "ck_cca_format",
      "ck_cca_role_format",
      "ck_cca_origin",
      "ck_cca_storage_bucket",
      "ck_cca_width",
      "ck_cca_height",
      "ck_cca_mime",
      "ck_cca_byte_size",
      "ck_cca_checksum",
      "ck_cca_provenance_object",
    ]) {
      expect(names.has(name)).toBe(true);
    }

    const trigger = await postgres.query<{ tgname: string }>(
      `select tgname from pg_trigger
       where tgrelid = 'public.campaign_composition_artifacts'::regclass
         and not tgisinternal`,
    );
    expect(trigger.rows.map((row) => row.tgname)).toContain(
      "trg_campaign_composition_artifacts_immutable",
    );

    const index = await postgres.query<{ indexname: string }>(
      `select indexname from pg_indexes
       where schemaname = 'public' and tablename = 'campaigns'
         and indexname = 'uq_campaigns_id_store_id'`,
    );
    expect(index.rows).toHaveLength(1);
  });

  it("aplica unicidade, FKs compostas e CHECKs", async () => {
    const operationId = randomUUID();
    const firstPath = `${fixture.storeId}/${fixture.newFlowCampaignId}/${operationId}/square_original.jpg`;
    await insertArtifactRow({
      campaign_id: fixture.newFlowCampaignId,
      operation_id: operationId,
      storage_path: firstPath,
    });

    await expectPgError(
      `insert into public.campaign_composition_artifacts
       (store_id, campaign_id, operation_id, role, format, origin, storage_bucket,
        storage_path, width, height, mime_type, byte_size, checksum_sha256, provenance)
       values ($1,$2,$3,'square_original','1:1','provider_generation',$4,$5,1024,1024,'image/jpeg',$6,$7,'{}'::jsonb)`,
      [
        fixture.storeId,
        fixture.newFlowCampaignId,
        operationId,
        INTERNAL_BUCKET,
        `${firstPath}.duplicate`,
        originalJpeg.byteLength,
        computeChecksumSha256(originalJpeg),
      ],
      "23505",
      "uq_cca_identity",
    );

    await expectPgError(
      `insert into public.campaign_composition_artifacts
       (store_id, campaign_id, operation_id, role, format, origin, storage_bucket,
        storage_path, width, height, mime_type, byte_size, checksum_sha256, provenance)
       values ($1,$2,$3,'square_original','1:1','provider_generation',$4,$5,1024,1024,'image/jpeg',$6,$7,'{}'::jsonb)`,
      [
        fixture.storeId,
        fixture.otherCampaignId,
        randomUUID(),
        INTERNAL_BUCKET,
        `${fixture.storeId}/${fixture.newFlowCampaignId}/${randomUUID()}/square_original.jpg`,
        originalJpeg.byteLength,
        computeChecksumSha256(originalJpeg),
      ],
      "23503",
      "fk_cca_campaign_store",
    );

    await expectPgError(
      `insert into public.campaign_composition_artifacts
       (store_id, campaign_id, operation_id, role, format, origin, source_campaign_id,
        storage_bucket, storage_path, width, height, mime_type, byte_size,
        checksum_sha256, provenance)
       values ($1,$2,$3,'square_original','1:1','deterministic_preparation',$4,$5,$6,1024,1024,'image/jpeg',$7,$8,'{}'::jsonb)`,
      [
        fixture.storeId,
        fixture.newFlowCampaignId,
        randomUUID(),
        fixture.otherCampaignId,
        INTERNAL_BUCKET,
        `${fixture.storeId}/${fixture.newFlowCampaignId}/${randomUUID()}/square_original.jpg`,
        originalJpeg.byteLength,
        computeChecksumSha256(originalJpeg),
      ],
      "23503",
      "fk_cca_source_campaign_store",
    );

    await expectPgError(
      `insert into public.campaign_composition_artifacts
       (store_id, campaign_id, operation_id, role, format, origin,
        derived_from_artifact_id, storage_bucket, storage_path, width, height,
        mime_type, byte_size, checksum_sha256, provenance)
       values ($1,$2,$3,'square_prepared','1:1','deterministic_preparation',$4,$5,$6,1152,1152,'image/jpeg',$7,$8,'{}'::jsonb)`,
      [
        fixture.storeId,
        fixture.newFlowCampaignId,
        randomUUID(),
        randomUUID(),
        INTERNAL_BUCKET,
        `${fixture.storeId}/${fixture.newFlowCampaignId}/${randomUUID()}/square_prepared.jpg`,
        preparedJpeg.byteLength,
        computeChecksumSha256(preparedJpeg),
      ],
      "23503",
      "derived_from_artifact_id",
    );

    const invalidRows: Array<{ overrides: Partial<ArtifactInsert>; code: string }> = [
      { overrides: { role: "bogus" }, code: "23514" },
      { overrides: { format: "9:16" }, code: "23514" },
      { overrides: { origin: "bogus" }, code: "23514" },
      { overrides: { storage_bucket: "campaign-images" }, code: "23514" },
      { overrides: { mime_type: "image/png" }, code: "23514" },
      { overrides: { byte_size: 0 }, code: "23514" },
      { overrides: { checksum_sha256: "z".repeat(64) }, code: "23514" },
    ];
    for (const { overrides } of invalidRows) {
      const row = artifactInsert(overrides);
      const columns = Object.keys(row);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const values = columns.map((column) => {
        const value = row[column as keyof typeof row];
        return column === "provenance" ? JSON.stringify(value) : value;
      });
      await expectPgError(
        `insert into public.campaign_composition_artifacts (${columns.join(", ")})
         values (${placeholders})`,
        values,
        "23514",
      );
    }
  });

  it("recusa UPDATE/DELETE pelo owner e pelo service_role", async () => {
    const rowId = await insertArtifactRow();
    const before = await postgres.query<{ checksum_sha256: string }>(
      "select checksum_sha256 from public.campaign_composition_artifacts where id = $1",
      [rowId],
    );

    await expectPgError(
      "update public.campaign_composition_artifacts set checksum_sha256 = $2 where id = $1",
      [rowId, "a".repeat(64)],
      "P0001",
      "campaign_composition_artifacts_immutable",
    );
    await expectPgError(
      "delete from public.campaign_composition_artifacts where id = $1",
      [rowId],
      "P0001",
      "campaign_composition_artifacts_immutable",
    );

    const after = await postgres.query<{ checksum_sha256: string }>(
      "select checksum_sha256 from public.campaign_composition_artifacts where id = $1",
      [rowId],
    );
    expect(after.rows[0]?.checksum_sha256).toBe(before.rows[0]?.checksum_sha256);

    const serviceUpdate = await service
      .from(TABLE)
      .update({ checksum_sha256: "a".repeat(64) })
      .eq("id", rowId);
    expect(serviceUpdate.error?.message ?? "").toMatch(/permission denied/i);

    const serviceDelete = await service.from(TABLE).delete().eq("id", rowId);
    expect(serviceDelete.error?.message ?? "").toMatch(/permission denied/i);
  });

  it("restringe anon/authenticated e mantém grants de service_role", async () => {
    const grants = await postgres.query<{
      grantee: string;
      privilege_type: string;
    }>(
      `select grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public'
         and table_name = 'campaign_composition_artifacts'`,
    );
    for (const grantee of ["anon", "authenticated"]) {
      expect(grants.rows.some((row) => row.grantee === grantee)).toBe(false);
    }
    const servicePrivileges = grants.rows
      .filter((row) => row.grantee === "service_role")
      .map((row) => row.privilege_type);
    expect(servicePrivileges).toEqual(expect.arrayContaining(["SELECT", "INSERT"]));
    expect(servicePrivileges).not.toContain("UPDATE");
    expect(servicePrivileges).not.toContain("DELETE");

    const anonSelect = await anon.from(TABLE).select("id").limit(1);
    expect(anonSelect.error).not.toBeNull();

    const authenticatedSelect = await authenticated
      .from(TABLE)
      .select("id")
      .limit(1);
    expect(authenticatedSelect.error).not.toBeNull();
  });

  it("cria bucket privado e não expõe policy a anon/authenticated", async () => {
    const bucket = await postgres.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>(
      `select public, file_size_limit, allowed_mime_types
       from storage.buckets where id = $1`,
      [INTERNAL_BUCKET],
    );
    expect(bucket.rows).toHaveLength(1);
    expect(bucket.rows[0].public).toBe(false);
    expect(Number(bucket.rows[0].file_size_limit)).toBe(10485760);
    expect(bucket.rows[0].allowed_mime_types).toEqual(["image/jpeg"]);

    const policies = await postgres.query<{
      policyname: string;
      roles: string[];
    }>(
      `select policyname, roles::text[] as roles from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname like '%campaign-internal-artifacts%'`,
    );
    const exposed = policies.rows.filter(
      (row) =>
        row.roles.includes("anon") || row.roles.includes("authenticated"),
    );
    expect(exposed).toHaveLength(0);
  });
});

describe("F60.1 integration — privacidade", () => {
  it("nega leitura do objeto interno ao usuário autenticado da própria loja", async () => {
    const operationId = randomUUID();
    const path = `${fixture.storeId}/${fixture.newFlowCampaignId}/${operationId}/square_original.jpg`;
    await uploadFixture(INTERNAL_BUCKET, path, originalJpeg);

    const serviceDownload = await service
      .storage.from(INTERNAL_BUCKET)
      .download(path);
    assertNoError(serviceDownload, "service_download_failed");
    expect(serviceDownload.data).not.toBeNull();

    const denied = await authenticated
      .storage.from(INTERNAL_BUCKET)
      .download(path);
    expect(denied.error).not.toBeNull();
    expect(denied.data ?? null).toBeNull();

    const listed = await authenticated
      .storage.from(INTERNAL_BUCKET)
      .list(`${fixture.storeId}/${fixture.newFlowCampaignId}`);
    const empty = (listed.data ?? []).length === 0;
    expect(listed.error !== null || empty).toBe(true);
  });
});

describe("F60.1 integration — fluxos reais", () => {
  it("persiste com evidência e recupera integral", async () => {
    const identity = identityFor(fixture.newFlowCampaignId, "square_original");
    const instrumented = instrumentedClient(service);

    const created = await persistCompositionArtifact(
      inputFor(identity, originalJpeg),
      { client: instrumented.client },
    );
    expect(created).toEqual({ kind: "created" });
    recordIdentityArtifact(identity);

    const path = compositionArtifactStoragePath(identity);
    const metadata = await readMetadata(path);
    const payload = evidencePayload(metadata);
    expect(payload).not.toBeNull();
    expect(String(payload?.evidenceDigest ?? "")).toMatch(/^[0-9a-f]{64}$/);
    const evidence = payload?.evidence as
      | { checksumSha256?: string; byteSize?: number }
      | undefined;
    expect(evidence?.checksumSha256).toBe(computeChecksumSha256(originalJpeg));
    expect(evidence?.byteSize).toBe(originalJpeg.byteLength);

    const retrieved = await retrieveCompositionArtifact(
      { identity, authorization: { kind: "system" } },
      { client: service },
    );
    expect(retrieved.kind).toBe("integral");
    if (retrieved.kind === "integral") {
      expect(retrieved.bytes.equals(originalJpeg)).toBe(true);
    }

    expect(instrumented.calls.signed).toBe(0);
    expect(instrumented.calls.publicUrl).toBe(0);
    expect(instrumented.calls.remove).toBe(0);
    expect(instrumented.calls.update).toBe(0);
    expect(instrumented.calls.uploads).toHaveLength(1);
    expect(instrumented.calls.uploads[0]).toMatchObject({
      bucket: INTERNAL_BUCKET,
      path,
      upsert: false,
    });
  });

  it("preserva evidência após falha de insert e adota na repetição", async () => {
    const identity = identityFor(fixture.newFlowCampaignId, "square_original");
    const instrumented = instrumentedClient(service);
    const failing = failingInsertClient(instrumented.client, TABLE);

    const first = await persistCompositionArtifact(
      inputFor(identity, originalJpeg),
      { client: failing },
    );
    expect(first.kind).toBe("persistence_failure");
    expect(await artifactRowCount(identity)).toBe(0);
    recordObject(INTERNAL_BUCKET, compositionArtifactStoragePath(identity));

    const path = compositionArtifactStoragePath(identity);
    const payload = evidencePayload(await readMetadata(path));
    expect(payload).not.toBeNull();
    expect(String(payload?.evidenceDigest ?? "")).toMatch(/^[0-9a-f]{64}$/);
    expect(await downloadBytes(path)).toEqual(originalJpeg);

    const second = await persistCompositionArtifact(
      inputFor(identity, originalJpeg),
      { client: instrumented.client },
    );
    expect(second).toEqual({ kind: "reused", adoption: true });
    recordIdentityArtifact(identity);
    expect(await artifactRowCount(identity)).toBe(1);
    expect(instrumented.calls.uploads).toHaveLength(1);
    expect(instrumented.calls.remove).toBe(0);
    expect(instrumented.calls.update).toBe(0);
    expect(instrumented.calls.signed).toBe(0);
  });

  it("converge em concorrência idêntica para uma linha", async () => {
    const identity = identityFor(fixture.newFlowCampaignId, "square_original");
    const results = await Promise.allSettled([
      persistCompositionArtifact(inputFor(identity, originalJpeg), {
        client: service,
      }),
      persistCompositionArtifact(inputFor(identity, originalJpeg), {
        client: service,
      }),
    ]);
    const kinds = results
      .map((result) =>
        result.status === "fulfilled" ? result.value.kind : "rejected",
      )
      .sort();
    expect(kinds).toEqual(["created", "reused"]);
    recordIdentityArtifact(identity);
    expect(await artifactRowCount(identity)).toBe(1);
  });

  it("recusa proveniências divergentes na concorrência", async () => {
    const identity = identityFor(fixture.newFlowCampaignId, "square_original");
    const results = await Promise.allSettled([
      persistCompositionArtifact(
        inputFor(identity, originalJpeg, {
          provenance: { sourceStoragePath: "a/source.jpg" },
        }),
        { client: service },
      ),
      persistCompositionArtifact(
        inputFor(identity, originalJpeg, {
          provenance: { sourceStoragePath: "b/source.jpg" },
        }),
        { client: service },
      ),
    ]);
    const kinds = results
      .map((result) =>
        result.status === "fulfilled" ? result.value.kind : "rejected",
      )
      .sort();
    expect(kinds).toContain("provenance_conflict");
    expect(kinds).toContain("created");
    recordIdentityArtifact(identity);
    expect(await artifactRowCount(identity)).toBe(1);
  });

  it("recusa bytes divergentes na concorrência sem sobrescrever", async () => {
    const identity = identityFor(fixture.newFlowCampaignId, "square_original");
    const results = await Promise.allSettled([
      persistCompositionArtifact(inputFor(identity, originalJpeg), {
        client: service,
      }),
      persistCompositionArtifact(inputFor(identity, differentJpeg), {
        client: service,
      }),
    ]);
    const kinds = results
      .map((result) =>
        result.status === "fulfilled" ? result.value.kind : "rejected",
      )
      .sort();
    expect(kinds).toContain("content_conflict");
    expect(kinds).toContain("created");

    const path = compositionArtifactStoragePath(identity);
    const winner = await downloadBytes(path);
    expect([originalJpeg, differentJpeg].some((bytes) => bytes.equals(winner))).toBe(
      true,
    );
    recordIdentityArtifact(identity);
    expect(await artifactRowCount(identity)).toBe(1);
  });

  it("resolve fonte legada 1080×1080 e fonte 1:1 atual 1024×1024", async () => {
    const legacy = await resolveReusableSquareSource(
      {
        kind: "legacy_campaign",
        storeId: fixture.storeId,
        campaignId: fixture.legacyCampaignId,
        authorization: { kind: "system" },
      },
      { client: service },
    );
    expect(legacy.kind).toBe("reusable");
    if (legacy.kind === "reusable") {
      expect(legacy.source.origin).toBe("legacy_campaign");
      expect(legacy.source.width).toBe(1080);
      expect(legacy.source.height).toBe(1080);
      expect(legacy.source.checksumSha256).toBe(
        computeChecksumSha256(legacyJpeg),
      );
    }

    const newFlow = await resolveReusableSquareSource(
      {
        kind: "new_flow_1_1",
        storeId: fixture.storeId,
        campaignId: fixture.newFlowCampaignId,
        authorization: { kind: "system" },
      },
      { client: service },
    );
    expect(newFlow.kind).toBe("reusable");
    if (newFlow.kind === "reusable") {
      expect(newFlow.source.origin).toBe("new_flow_1_1");
      expect(newFlow.source.width).toBe(1024);
      expect(newFlow.source.height).toBe(1024);
      expect(newFlow.source.checksumSha256).toBe(
        computeChecksumSha256(newFlowJpeg),
      );
    }
  });

  it("mantém as estruturas de referência idênticas ao baseline", async () => {
    const after = await referenceHash([
      fixture.legacyCampaignId,
      fixture.newFlowCampaignId,
      fixture.otherCampaignId,
    ]);
    expect(after).toBe(baselineHash);
  });
});
