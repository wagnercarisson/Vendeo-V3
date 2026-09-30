// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ALLOWED_ENTRY_RE,
  FORBIDDEN_TARGETS,
  createRecordingClient,
  type Row,
} from "@/lib/lab/__tests__/recording-supabase-client";

import {
  SOURCE_BUCKETS,
  SOURCE_TABLES,
  STORE_COLUMNS,
  VALID_IDENTITY_STATES,
  assertAllowedSourceColumns,
  assertBrandingMimeAllowedForBucket,
  assertValidIdentityState,
  buildContentAddressedPath,
  buildImportAuditRow,
  buildInsertStatement,
  buildSanitizedIdentity,
  buildSanitizedProfileRow,
  computeChecksum,
  createReadOnlySourceClient,
  ensureContentAddressedObject,
  importOneStore,
  isForbiddenSourceTarget,
  materializeStoreAssets,
  orderAssetsTopologically,
  parseImportArgs,
  parseSupabaseStatusEnv,
  readLocalIdentity,
  resolveAssetBucket,
  resolveBrandingMime,
  resolveLocalDestination,
  sanitizeMetadata,
  selectUnreferencedOldObjects,
  upsertManifestEntry,
} from "../../../../../scripts/lab/48-2-3-bench-import-stores.mjs";

/**
 * F48.2.3 (plano 03, task 3.10) — contrato da importação local de identidade.
 *
 * Testa com fakes/fixtures SEM rede e SEM banco real: nenhum teste abre conexão
 * remota nem local, nenhum provedor de IA é chamado e nenhum crédito é consumido.
 * Cobre os casos (a)–(k): fronteira de escrita remota, recusa de loja não-teste,
 * IDs implícitos/`--all`, allowlist, ausência de URLs assinadas persistidas,
 * múltiplos synced, idempotência, falha antes do commit, substituição integral,
 * proprietário sintético e ausência de chamada paga.
 */

// ─── Identificadores e fixtures ──────────────────────────────────────────────

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";
const SIG_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_PATH = "loja/logo.png";
const SIG_PATH = "loja/assinatura.png";
const LOGO_BYTES = Buffer.from("logo-bytes-1");
const SIG_BYTES = Buffer.from("sig-bytes-1");

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts/lab/48-2-3-bench-import-stores.mjs");

interface SourceSeed {
  isTestStore?: boolean;
  store?: Row;
  profiles?: Row[];
  assets?: Row[];
  signature?: Row | null;
  objects?: Record<string, Buffer>;
}

function makeSource(seed: SourceSeed = {}) {
  const store: Row = seed.store ?? {
    id: STORE_ID,
    name: "Loja de teste A",
    segment: "variedades",
    subsegment: "doces",
    tone_of_voice: "amigavel",
    positioning: "bairro",
    short_description: "loja de bairro",
    slogan: "aqui rende mais",
    brand_color: "#0F172A",
    identity_state: "logo",
    is_test_store: seed.isTestStore ?? true,
    updated_at: "2026-09-29T00:00:00.000Z",
  };

  const profiles: Row[] =
    seed.profiles ?? [
      {
        id: "profile-1",
        store_id: STORE_ID,
        source: "text_only",
        status: "synced",
        typography_direction: "serif elegante",
        safe_color_tokens: { primary: "#22C55E" },
        brand_colors_chosen: ["#22C55E", null],
        logo_colors_detected: ["#ffffff"],
        visual_style: "clean",
        visual_tone: "caloroso",
        brand_personality: "proxima",
        campaign_guidelines: "sem exageros",
        campaign_brief: "oferta clara",
        inferred_primary_color: "#22C55E",
        active_logo_asset_id: ASSET_ID,
        visual_signature_id: SIG_ID,
        updated_at: "2026-09-29T00:00:00.000Z",
      },
    ];

  const assets: Row[] =
    seed.assets ?? [
      {
        id: ASSET_ID,
        store_id: STORE_ID,
        asset_type: "logo",
        variant_type: "original",
        source: "user_upload",
        parent_asset_id: null,
        storage_path: ASSET_PATH,
        mime_type: "image/png",
        width: 512,
        height: 512,
        size_bytes: LOGO_BYTES.length,
        checksum: "origin-logo-checksum",
        version: 1,
        status: "active",
        metadata: { note: "ok" },
        updated_at: "2026-09-29T00:00:00.000Z",
      },
    ];

  const signature: Row | null =
    seed.signature === undefined
      ? {
          id: SIG_ID,
          store_id: STORE_ID,
          storage_path: SIG_PATH,
          asset_url: "https://signed.invalid/sig.png",
          type: "ai_generated",
          status: "active",
          metadata: { signed_url: "https://x/y.png", jwt: "a.b.c" },
          updated_at: "2026-09-29T00:00:00.000Z",
        }
      : seed.signature;

  const objects: Record<string, Buffer> = seed.objects ?? {
    [`store-brand-assets:${ASSET_PATH}`]: LOGO_BYTES,
    [`visual-signatures:${SIG_PATH}`]: SIG_BYTES,
  };

  const calls = {
    select: [] as Array<{ table: string }>,
    download: [] as Array<{ bucket: string; path: string }>,
    mutations: [] as string[],
  };

  return {
    host: "source.local:54321",
    calls,
    async select(table: string, _columns: string, filters: Record<string, unknown> = {}) {
      calls.select.push({ table });
      const rows =
        table === "stores"
          ? [store]
          : table === "store_brand_profiles"
            ? profiles
            : table === "store_brand_assets"
              ? assets
              : table === "store_visual_signatures"
                ? signature
                  ? [signature]
                  : []
                : [];
      const eq = (filters.eq ?? {}) as Record<string, unknown>;
      const filtered = rows.filter((row) => Object.entries(eq).every(([key, value]) => row[key] === value));
      return filters.maybeSingle ? (filtered[0] ?? null) : filtered;
    },
    async download(bucket: string, objectPath: string) {
      calls.download.push({ bucket, path: objectPath });
      const value = objects[`${bucket}:${objectPath}`];
      if (value === undefined) throw new Error("missing_object");
      return value;
    },
    insert() {
      calls.mutations.push("insert");
      throw new Error("mutation_forbidden");
    },
    update() {
      calls.mutations.push("update");
      throw new Error("mutation_forbidden");
    },
    delete() {
      calls.mutations.push("delete");
      throw new Error("mutation_forbidden");
    },
    upsert() {
      calls.mutations.push("upsert");
      throw new Error("mutation_forbidden");
    },
  };
}

interface DestinationOptions {
  existingUser?: { id: string; email: string } | null;
  uploadError?: Error;
  /** Simula erro no precheck `exists` (não pode ser interpretado como ausência). */
  existsError?: Error;
  /** Simula falha de download de um objeto existente. */
  downloadError?: Error;
  /** Objetos já existentes no destino: chave `${bucket}:${path}` → conteúdo. */
  existingObjects?: Record<string, Buffer>;
  /** Simula erro ambíguo/timeout no upload (o objeto é gravado e o erro retornado). */
  ambiguousUpload?: boolean;
}

const objectKey = (bucket: string, path: string) => `${bucket}:${path}`;

function makeDestination(options: DestinationOptions = {}) {
  const uploads: Array<{ bucket: string; path: string; bytes: number; contentType: string }> = [];
  const removals: Array<{ bucket: string; path: string }> = [];
  const objects = new Map<string, Buffer>();
  for (const [key, value] of Object.entries(options.existingObjects ?? {})) {
    objects.set(key, Buffer.from(value));
  }
  let user = options.existingUser ?? null;

  // Storage fake do destino local: `exists`/`download`/`upload` (upsert respeitado).
  const storage = {
    async exists(bucket: string, path: string) {
      if (options.existsError) throw new Error(options.existsError.message);
      return objects.has(objectKey(bucket, path))
        ? { data: true, error: null }
        : { data: false, error: { message: "Object not found", status: 404 } };
    },
    async download(bucket: string, path: string) {
      if (options.downloadError) {
        return { data: null, error: { message: options.downloadError.message } };
      }
      const value = objects.get(objectKey(bucket, path));
      if (value === undefined) return { data: null, error: { message: "Object not found" } };
      return { data: Buffer.from(value), error: null };
    },
    async upload(
      bucket: string,
      path: string,
      buffer: Buffer,
      opts: { contentType?: string; upsert?: boolean } = {},
    ) {
      if (options.uploadError) return { error: { message: options.uploadError.message } };
      const key = objectKey(bucket, path);
      if (objects.has(key) && !opts.upsert) {
        return { error: { message: "KeyAlreadyExists" } };
      }
      objects.set(key, Buffer.from(buffer));
      uploads.push({ bucket, path, bytes: buffer.length, contentType: opts.contentType ?? "" });
      if (options.ambiguousUpload) {
        return { error: { message: "The upstream server is timing out" } };
      }
      return { error: null };
    },
  };

  return {
    host: "local:54321",
    uploads,
    removals,
    objects,
    async findUserByEmail(email: string) {
      return user && user.email === email ? user : null;
    },
    async createSyntheticUser(email: string) {
      user = { id: `owner:${email}`, email };
      return user;
    },
    async ensureBrandingObject({
      bucket,
      path,
      buffer,
      contentType,
      expectedChecksum,
    }: {
      bucket: string;
      path: string;
      buffer: Buffer;
      contentType: string;
      expectedChecksum?: string;
    }) {
      return ensureContentAddressedObject({
        storage,
        bucket,
        path,
        buffer,
        contentType,
        expectedChecksum,
      });
    },
    async removeBrandingObjects(list: Array<{ bucket: string; path: string }>) {
      for (const object of list) {
        removals.push(object);
        objects.delete(objectKey(object.bucket, object.path));
      }
      return { removed: list.length, failed: 0 };
    },
  };
}

interface DbOptions {
  rows?: { brandAssets?: Row[]; signatures?: Row[] };
  failWhen?: (text: string) => boolean;
}

function makeDb(options: DbOptions = {}) {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  return {
    host: "local:54321",
    statements,
    async query(text: string, values: unknown[] = []) {
      statements.push({ text, values });
      if (options.failWhen?.(text)) throw new Error("db_failure");
      if (/^SELECT/i.test(text)) {
        if (/store_brand_assets/.test(text)) return { rows: options.rows?.brandAssets ?? [] };
        if (/store_visual_signatures/.test(text)) return { rows: options.rows?.signatures ?? [] };
        return { rows: [] };
      }
      return { rows: [] };
    },
    async close() {},
  };
}

function makeManifestStore(initial: Record<string, unknown> = { stores: [], notes: "manifesto local" }) {
  let manifest = JSON.parse(JSON.stringify(initial));
  return {
    async load() {
      return manifest;
    },
    async save(next: Record<string, unknown>) {
      manifest = next;
    },
    current(): { stores: Array<{ id: string; label: string }> } {
      return manifest;
    },
  };
}

function findStatement(statements: Array<{ text: string; values: unknown[] }>, re: RegExp) {
  return statements.find((statement) => re.test(statement.text));
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
    return;
  }
  throw new Error(`esperava o codigo de erro ${code}`);
}

function expectSyncCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
    return;
  }
  throw new Error(`esperava o codigo de erro ${code}`);
}

// ─── (c) IDs explícitos e recusa de descoberta ampla ─────────────────────────

describe("parseImportArgs — somente IDs explícitos", () => {
  it("(c) recusa a ausência de IDs", async () => {
    await expectCode(async () => parseImportArgs([]), "import_store_ids_required");
  });

  it("(c) recusa --all (descoberta ampla)", async () => {
    await expectCode(async () => parseImportArgs(["--all"]), "import_all_not_allowed");
  });

  it("aceita --store repetível e --stores csv, deduplicando", () => {
    const parsed = parseImportArgs([
      "--store",
      STORE_ID,
      "--stores",
      `${ASSET_ID},${STORE_ID}`,
      "--dry-run",
    ]);
    expect(parsed.storeIds).toEqual([STORE_ID, ASSET_ID]);
    expect(parsed.dryRun).toBe(true);
  });

  it("recusa flag desconhecida e --store sem valor", async () => {
    await expectCode(async () => parseImportArgs(["--store"]), "import_store_id_missing");
    await expectCode(async () => parseImportArgs(["--nope"]), "import_flag_unknown");
  });
});

// ─── (a)(d) Fronteira da origem: somente-leitura e allowlist ──────────────────

describe("origem somente-leitura e allowlist", () => {
  it("a allowlist de tabelas/buckets é exatamente a permitida", () => {
    expect([...SOURCE_TABLES]).toEqual([
      "stores",
      "store_brand_profiles",
      "store_brand_assets",
      "store_visual_signatures",
    ]);
    expect([...SOURCE_BUCKETS]).toEqual(["store-logos", "store-brand-assets", "visual-signatures"]);
  });

  it("(d) reconhece os alvos proibidos da origem", () => {
    for (const target of ["campaigns", "campaign_images", "generation_events", "ai_model_selection", "admin_audit_log", "credit_transactions", "prompts"]) {
      expect(isForbiddenSourceTarget(target), target).toBe(true);
    }
    expect(isForbiddenSourceTarget("stores")).toBe(false);
  });

  it("(a) o wrapper de origem não expõe métodos de mutação", () => {
    const wrapper = createReadOnlySourceClient(
      { url: "http://127.0.0.1:54321", serviceRoleKey: "k" },
      () => ({}) as never,
    );
    for (const method of ["insert", "update", "delete", "upsert", "rpc"]) {
      expect((wrapper as Record<string, unknown>)[method], method).toBeUndefined();
    }
  });

  it("(a)(d) o cliente gravador registra somente leituras da allowlist", async () => {
    const recording = createRecordingClient({ stores: [{ id: STORE_ID, name: "Loja" }] });
    const wrapper = createReadOnlySourceClient(
      { url: "http://127.0.0.1:54321", serviceRoleKey: "k" },
      () => recording.client,
    );

    await wrapper.select("stores", STORE_COLUMNS, { eq: { id: STORE_ID }, maybeSingle: true });

    expect(recording.accessLog).toContain("from:stores");
    expect(recording.accessLog.filter((entry) => entry.startsWith("write:"))).toEqual([]);
    for (const target of FORBIDDEN_TARGETS) {
      expect(
        recording.accessLog.filter((entry) => entry.includes(target)),
        `nenhum acesso a ${target}`,
      ).toEqual([]);
    }
    expect(recording.accessLog.filter((entry) => !ALLOWED_ENTRY_RE.test(entry))).toEqual([]);
  });
});

// ─── (b) Loja não-teste é recusada ───────────────────────────────────────────

describe("(b) loja não marcada como teste", () => {
  it("é recusada sem copiar identidade", async () => {
    const source = makeSource({ isTestStore: false });
    const destination = makeDestination();
    const db = makeDb();

    await expectCode(
      () => importOneStore({ storeId: STORE_ID, source, destination, db }),
      "import_store_not_test",
    );

    expect(destination.uploads).toEqual([]);
    expect(source.calls.download).toEqual([]);
    expect(db.statements).toEqual([]);
  });
});

// ─── (d)(e) Allowlist na execução e ausência de URLs assinadas ───────────────

describe("(d)(e) importação lê só a allowlist e não persiste URLs assinadas", () => {
  it("nunca lê fora da allowlist e grava apenas paths locais saneados", async () => {
    const source = makeSource();
    const destination = makeDestination();
    const db = makeDb();

    await importOneStore({ storeId: STORE_ID, source, destination, db, manifestStore: makeManifestStore() });

    // (d) allowlist de tabelas/buckets.
    for (const call of source.calls.select) {
      expect(SOURCE_TABLES).toContain(call.table);
    }
    for (const call of source.calls.download) {
      expect(SOURCE_BUCKETS).toContain(call.bucket);
    }
    expect(source.calls.select.map((call) => call.table)).not.toContain("campaigns");

    // (e) nenhuma URL assinada/token persistido no banco.
    expect(/https?:\/\//i.test(JSON.stringify(db.statements))).toBe(false);

    const storeStatement = findStatement(db.statements, /INSERT INTO public\.stores/);
    expect(storeStatement).toBeDefined();
    // `logo_url` (índice 10) saneado para NULL; `identity_state` (índice 9) importado.
    expect(storeStatement!.values[10]).toBeNull();
    expect(storeStatement!.values[9]).toBe("logo");

    const signatureStatement = findStatement(db.statements, /INSERT INTO public\.store_visual_signatures/);
    expect(signatureStatement).toBeDefined();
    const signatureText = JSON.stringify(signatureStatement!.values);
    expect(/https?:\/\//i.test(signatureText)).toBe(false);
    expect(signatureText).not.toContain("signed_url");
    expect(signatureText).not.toContain("jwt");

    const assetStatement = findStatement(db.statements, /INSERT INTO public\.store_brand_assets/);
    expect(assetStatement).toBeDefined();
    // `storage_path` é o path local content-addressed (não a URL remota).
    expect(destination.uploads[0].path.startsWith(`${STORE_ID}/${ASSET_ID}/`)).toBe(true);
    expect(/https?:\/\//i.test(JSON.stringify(destination.uploads))).toBe(false);
  });
});

// ─── Allowlist de colunas de `stores` (identity_state) ───────────────────────

describe("allowlist de colunas de stores", () => {
  it("aceita identity_state (derivada de STORE_COLUMNS)", () => {
    expect(STORE_COLUMNS.split(",").map((column) => column.trim())).toContain("identity_state");
    expect(() => assertAllowedSourceColumns("stores", STORE_COLUMNS)).not.toThrow();
  });

  it("recusa coluna fora da allowlist", () => {
    expectSyncCode(() => assertAllowedSourceColumns("stores", "id,accent_color"), "import_source_column_not_allowed");
    expectSyncCode(() => assertAllowedSourceColumns("stores", "id,user_id"), "import_source_column_not_allowed");
  });
});

// ─── Fail-closed de `identity_state` (fidelidade F48.2.3) ────────────────────

describe("identity_state fail-closed", () => {
  const baseStore = (over: Row = {}): Row => ({
    id: STORE_ID,
    name: "Loja de teste A",
    segment: "variedades",
    subsegment: null,
    tone_of_voice: null,
    positioning: null,
    short_description: null,
    slogan: null,
    brand_color: "#0F172A",
    is_test_store: true,
    updated_at: "2026-09-29T00:00:00.000Z",
    ...over,
  });

  it("assertValidIdentityState aceita o conjunto fechado e recusa o restante", () => {
    expect(VALID_IDENTITY_STATES).toEqual(["text_only", "logo", "visual_signature"]);
    for (const value of VALID_IDENTITY_STATES) {
      expect(assertValidIdentityState(value)).toBe(value);
    }
    for (const value of [undefined, null, "", "legacy", "LOGO", "logo "]) {
      expectSyncCode(() => assertValidIdentityState(value), "import_store_identity_state_invalid");
    }
  });

  it("aborta a importação quando identity_state está ausente, sem uploads nem statements", async () => {
    const source = makeSource({ store: baseStore() });
    const destination = makeDestination();
    const db = makeDb();

    await expectCode(
      () => importOneStore({ storeId: STORE_ID, source, destination, db }),
      "import_store_identity_state_invalid",
    );

    expect(destination.uploads).toEqual([]);
    expect(source.calls.download).toEqual([]);
    expect(db.statements).toEqual([]);
  });

  it("aborta a importação quando identity_state é desconhecido, sem uploads nem statements", async () => {
    const source = makeSource({ store: baseStore({ identity_state: "legacy" }) });
    const destination = makeDestination();
    const db = makeDb();

    await expectCode(
      () => importOneStore({ storeId: STORE_ID, source, destination, db }),
      "import_store_identity_state_invalid",
    );

    expect(destination.uploads).toEqual([]);
    expect(source.calls.download).toEqual([]);
    expect(db.statements).toEqual([]);
  });
});

// ─── (f) Múltiplos synced / ausência de synced ───────────────────────────────

describe("(f) estado atual pelo comportamento produtivo", () => {
  it("mais de um perfil synced recusa a importação", async () => {
    const source = makeSource({
      profiles: [
        { id: "p1", store_id: STORE_ID, source: "text_only", status: "synced" },
        { id: "p2", store_id: STORE_ID, source: "logo_analysis", status: "synced" },
      ],
    });
    const destination = makeDestination();

    await expectCode(
      () => importOneStore({ storeId: STORE_ID, source, destination, db: makeDb() }),
      "import_multiple_synced_profiles",
    );
    expect(destination.uploads).toEqual([]);
  });

  it("ausência de synced preserva brand_color/segmento e não insere perfil", async () => {
    const source = makeSource({ profiles: [], signature: null, assets: [], objects: {} });
    const destination = makeDestination();
    const db = makeDb();

    const result = await importOneStore({ storeId: STORE_ID, source, destination, db });

    expect(result.syncedProfiles).toBe(0);
    const storeStatement = findStatement(db.statements, /INSERT INTO public\.stores/);
    expect(storeStatement).toBeDefined();
    // brand_color (índice 8) e segment (índice 2) preservados.
    expect(storeStatement!.values[8]).toBe("#0F172A");
    expect(storeStatement!.values[2]).toBe("variedades");
    expect(findStatement(db.statements, /INSERT INTO public\.store_brand_profiles/)).toBeUndefined();
  });
});

// ─── (g) Idempotência ────────────────────────────────────────────────────────

describe("(g) idempotência (mesmos checksums → mesmos paths)", () => {
  it("reexecução reutiliza os objetos e não duplica", async () => {
    const source = makeSource();
    const manifestStore = makeManifestStore();

    // Mesmo destino nas duas execuções: os objetos content-addressed persistem.
    const destination = makeDestination();
    const first = await importOneStore({ storeId: STORE_ID, source, destination, db: makeDb(), manifestStore });
    expect(first.objectsWritten).toBe(2);
    expect(first.objectsReused).toBe(0);
    const firstUploads = JSON.parse(JSON.stringify(destination.uploads));

    // Segunda execução: a identidade anterior aponta para os MESMOS paths, que já
    // existem no destino → reutilizados, sem novo upload.
    const db2 = makeDb({
      rows: {
        brandAssets: [{ asset_type: "logo", storage_path: firstUploads[0].path }],
        signatures: [{ storage_path: firstUploads[1].path }],
      },
    });
    const second = await importOneStore({ storeId: STORE_ID, source, destination, db: db2, manifestStore });

    expect(second.objectsWritten).toBe(0);
    expect(second.objectsReused).toBe(2);
    expect(second.removedOldObjects).toBe(0);
    expect(destination.uploads).toEqual(firstUploads);
    expect(destination.removals).toEqual([]);
    expect(manifestStore.current().stores).toHaveLength(1);
  });
});

// ─── (h) Falha antes do commit ───────────────────────────────────────────────

describe("(h) falha antes do commit remove apenas os objetos novos", () => {
  it("remove só os novos e preserva a identidade anterior", async () => {
    const source = makeSource();
    const destination = makeDestination();
    const db = makeDb({
      rows: {
        brandAssets: [{ asset_type: "logo", storage_path: "old/logo.png" }],
        signatures: [{ storage_path: "old/sig.png" }],
      },
      failWhen: (text) => text === "COMMIT",
    });

    await expect(
      importOneStore({ storeId: STORE_ID, source, destination, db }),
    ).rejects.toThrow("db_failure");

    expect(destination.uploads).toHaveLength(2);
    expect(destination.removals).toEqual(
      destination.uploads.map((upload) => ({ bucket: upload.bucket, path: upload.path })),
    );
    expect(destination.removals).not.toEqual(
      expect.arrayContaining([
        { bucket: "store-brand-assets", path: "old/logo.png" },
        { bucket: "visual-signatures", path: "old/sig.png" },
      ]),
    );
  });
});

// ─── Idempotência do objeto content-addressed (correção de idempotência) ─────

describe("ensureContentAddressedObject — garantia idempotente", () => {
  const makeStorage = (
    seed: Record<string, Buffer> = {},
    opts: { ambiguous?: boolean; existsError?: boolean; downloadError?: boolean } = {},
  ) => {
    const objects = new Map<string, Buffer>(Object.entries(seed));
    const uploads: Array<{ bucket: string; path: string }> = [];
    return {
      objects,
      uploads,
      async exists(bucket: string, path: string) {
        if (opts.existsError) throw new Error("exists timeout");
        return objects.has(objectKey(bucket, path))
          ? { data: true, error: null }
          : { data: false, error: { message: "Object not found", status: 404 } };
      },
      async download(bucket: string, path: string) {
        if (opts.downloadError) return { data: null, error: { message: "download timeout" } };
        const value = objects.get(objectKey(bucket, path));
        return value === undefined
          ? { data: null, error: { message: "Object not found" } }
          : { data: Buffer.from(value), error: null };
      },
      async upload(bucket: string, path: string, buffer: Buffer) {
        const key = objectKey(bucket, path);
        if (objects.has(key)) return { error: { message: "KeyAlreadyExists" } };
        objects.set(key, Buffer.from(buffer));
        uploads.push({ bucket, path });
        if (opts.ambiguous) return { error: { message: "The upstream server is timing out" } };
        return { error: null };
      },
    };
  };

  it("objeto ausente → upload realizado → created", async () => {
    const storage = makeStorage();
    const result = await ensureContentAddressedObject({
      storage,
      bucket: "store-brand-assets",
      path: "s/a/x.png",
      buffer: Buffer.from("novo"),
      contentType: "image/png",
    });
    expect(result).toEqual({ bucket: "store-brand-assets", path: "s/a/x.png", created: true, reused: false });
    expect(storage.uploads).toHaveLength(1);
  });

  it("objeto existente com mesmo checksum → reutilizado, sem upload", async () => {
    const buffer = Buffer.from("igual");
    const path = `s/a/${computeChecksum(buffer)}.png`;
    const storage = makeStorage({ [`store-brand-assets:${path}`]: buffer });

    const result = await ensureContentAddressedObject({
      storage,
      bucket: "store-brand-assets",
      path,
      buffer,
      contentType: "image/png",
    });

    expect(result.created).toBe(false);
    expect(result.reused).toBe(true);
    expect(storage.uploads).toHaveLength(0);
  });

  it("objeto existente com checksum divergente → erro de integridade, sem overwrite nem remoção", async () => {
    const path = "s/a/divergente.png";
    const storage = makeStorage({ [`store-brand-assets:${path}`]: Buffer.from("antigo") });

    await expectCode(
      () =>
        ensureContentAddressedObject({
          storage,
          bucket: "store-brand-assets",
          path,
          buffer: Buffer.from("novo"),
          contentType: "image/png",
        }),
      "import_destination_object_integrity_mismatch",
    );

    expect(storage.uploads).toHaveLength(0);
    expect(storage.objects.get(`store-brand-assets:${path}`)?.toString()).toBe("antigo");
  });

  it("erro ambíguo no upload + readback com checksum correto → aceito como criado", async () => {
    const storage = makeStorage({}, { ambiguous: true });
    const result = await ensureContentAddressedObject({
      storage,
      bucket: "store-brand-assets",
      path: "s/a/amb.png",
      buffer: Buffer.from("ambiguo"),
      contentType: "image/png",
    });
    expect(result.created).toBe(true);
    expect(storage.uploads).toHaveLength(1);
  });

  it("erro ambíguo no upload + readback ausente → erro sanitizado", async () => {
    const storage = {
      async exists() {
        return { data: false, error: null };
      },
      async download() {
        return { data: null, error: { message: "Object not found" } };
      },
      async upload() {
        return { error: { message: "The upstream server is timing out" } };
      },
    };

    await expectCode(
      () =>
        ensureContentAddressedObject({
          storage,
          bucket: "store-brand-assets",
          path: "s/a/x.png",
          buffer: Buffer.from("x"),
          contentType: "image/png",
        }),
      "import_destination_upload_failed",
    );
  });

  it("erro/timeout no precheck (exists) → aborta sem tentar upload", async () => {
    const storage = makeStorage({}, { existsError: true });

    await expectCode(
      () =>
        ensureContentAddressedObject({
          storage,
          bucket: "store-brand-assets",
          path: "s/a/x.png",
          buffer: Buffer.from("x"),
          contentType: "image/png",
        }),
      "import_destination_exists_check_failed",
    );

    expect(storage.uploads).toHaveLength(0);
  });

  it("objeto existente cujo download falha → aborta sem upload e sem remoção", async () => {
    const path = `s/a/${computeChecksum(Buffer.from("preexistente"))}.png`;
    const storage = makeStorage(
      { [`store-brand-assets:${path}`]: Buffer.from("preexistente") },
      { downloadError: true },
    );

    await expectCode(
      () =>
        ensureContentAddressedObject({
          storage,
          bucket: "store-brand-assets",
          path,
          buffer: Buffer.from("preexistente"),
          contentType: "image/png",
        }),
      "import_destination_object_read_failed",
    );

    expect(storage.uploads).toHaveLength(0);
    // Objeto preexistente permanece intacto (nada foi removido).
    expect(storage.objects.has(`store-brand-assets:${path}`)).toBe(true);
  });

  it("erro no readback pós-upload não classifica o objeto como criado", async () => {
    const storage = makeStorage({}, { ambiguous: true, downloadError: true });

    await expectCode(
      () =>
        ensureContentAddressedObject({
          storage,
          bucket: "store-brand-assets",
          path: "s/a/amb2.png",
          buffer: Buffer.from("amb2"),
          contentType: "image/png",
        }),
      "import_destination_object_read_failed",
    );

    // O upload ocorreu, mas o resultado NÃO é reportado como criado.
    expect(storage.uploads).toHaveLength(1);
  });
});

describe("materializeStoreAssets — referenciado vs criado vs reutilizado", () => {
  const asset = (over: Row = {}): Row => ({
    id: ASSET_ID,
    store_id: STORE_ID,
    asset_type: "logo",
    variant_type: "original",
    source: "user_upload",
    parent_asset_id: null,
    storage_path: ASSET_PATH,
    mime_type: "image/png",
    width: 1,
    height: 1,
    size_bytes: LOGO_BYTES.length,
    checksum: null,
    version: 1,
    status: "active",
    metadata: {},
    ...over,
  });

  it("reutiliza objetos existentes e não os contabiliza como criados", async () => {
    const source = makeSource();
    const logoPath = `${STORE_ID}/${ASSET_ID}/${computeChecksum(LOGO_BYTES)}.png`;
    const sigPath = `${STORE_ID}/${SIG_ID}/${computeChecksum(SIG_BYTES)}.png`;
    const destination = makeDestination({
      existingObjects: {
        [`store-brand-assets:${logoPath}`]: LOGO_BYTES,
        [`visual-signatures:${sigPath}`]: SIG_BYTES,
      },
    });

    const result = await materializeStoreAssets({
      source,
      destination,
      storeId: STORE_ID,
      state: {
        assets: [asset()],
        signature: { id: SIG_ID, store_id: STORE_ID, storage_path: SIG_PATH, status: "active" },
      },
    });

    expect(result.referencedObjects).toHaveLength(2);
    expect(result.createdObjects).toEqual([]);
    expect(result.reusedObjects).toHaveLength(2);
    expect(destination.uploads).toEqual([]);
  });

  it("falha durante a materialização remove só os criados; reutilizados permanecem", async () => {
    const logoPath = `${STORE_ID}/${ASSET_ID}/${computeChecksum(LOGO_BYTES)}.png`;
    const createdPath = `${STORE_ID}/44444444-4444-4444-8444-444444444444/${computeChecksum(LOGO_BYTES)}.png`;
    const destination = makeDestination({
      existingObjects: { [`store-brand-assets:${logoPath}`]: LOGO_BYTES },
    });
    const source = makeSource({
      objects: {
        "store-brand-assets:loja/logo.png": LOGO_BYTES,
        "store-brand-assets:loja/novo.png": LOGO_BYTES,
        "store-brand-assets:loja/bad.bin": LOGO_BYTES,
      },
    });
    const assets = [
      asset({ id: ASSET_ID, storage_path: "loja/logo.png" }),
      asset({ id: "44444444-4444-4444-8444-444444444444", storage_path: "loja/novo.png" }),
      asset({
        id: "55555555-5555-4555-8555-555555555555",
        storage_path: "loja/bad.bin",
        mime_type: "application/octet-stream",
      }),
    ];

    await expect(
      materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets, signature: null } }),
    ).rejects.toThrow(/MIME de branding ausente\/desconhecido/);

    // Apenas o objeto CRIADO nesta tentativa é removido.
    expect(destination.removals).toEqual([{ bucket: "store-brand-assets", path: createdPath }]);
    // O objeto REUTILIZADO permanece intacto no destino.
    expect(destination.objects.has(`store-brand-assets:${logoPath}`)).toBe(true);
    expect(destination.objects.has(`store-brand-assets:${createdPath}`)).toBe(false);
  });

  it("falha na transação remove só os criados; reutilizado permanece", async () => {
    const source = makeSource();
    const logoPath = `${STORE_ID}/${ASSET_ID}/${computeChecksum(LOGO_BYTES)}.png`;
    const destination = makeDestination({
      existingObjects: { [`store-brand-assets:${logoPath}`]: LOGO_BYTES },
    });
    const db = makeDb({ failWhen: (text) => text === "COMMIT" });

    await expect(
      importOneStore({ storeId: STORE_ID, source, destination, db }),
    ).rejects.toThrow("db_failure");

    // Logo (reutilizado) permanece; assinatura (criada nesta tentativa) é removida.
    expect(destination.objects.has(`store-brand-assets:${logoPath}`)).toBe(true);
    expect(destination.removals).toHaveLength(1);
    expect(destination.removals[0].bucket).toBe("visual-signatures");
  });
});

// ─── (i) Substituição integral ───────────────────────────────────────────────

describe("(i) substituição integral remove resíduos da identidade anterior", () => {
  it("remove os objetos antigos sem referência após o commit", async () => {
    const source = makeSource();
    const destination = makeDestination();
    const db = makeDb({
      rows: {
        brandAssets: [{ asset_type: "logo", storage_path: "old/logo.png" }],
        signatures: [{ storage_path: "old/sig.png" }],
      },
    });

    await importOneStore({ storeId: STORE_ID, source, destination, db });

    expect(destination.removals).toEqual(
      expect.arrayContaining([
        { bucket: "store-brand-assets", path: "old/logo.png" },
        { bucket: "visual-signatures", path: "old/sig.png" },
      ]),
    );
    const newPaths = destination.uploads.map((upload) => upload.path);
    for (const removal of destination.removals) {
      expect(newPaths).not.toContain(removal.path);
    }
  });
});

// ─── (j) Proprietário sintético ──────────────────────────────────────────────

describe("(j) proprietário sintético por loja", () => {
  it("cria no primeiro import e reutiliza no seguinte", async () => {
    const source = makeSource();
    const manifestStore = makeManifestStore();

    const dest1 = makeDestination();
    const first = await importOneStore({ storeId: STORE_ID, source, destination: dest1, db: makeDb(), manifestStore });
    expect(first.ownerCreated).toBe(true);

    const dest2 = makeDestination({
      existingUser: { id: first.ownerUserId, email: `bench-store+${STORE_ID}@bench.local` },
    });
    const second = await importOneStore({ storeId: STORE_ID, source, destination: dest2, db: makeDb(), manifestStore });

    expect(second.ownerCreated).toBe(false);
    expect(second.ownerUserId).toBe(first.ownerUserId);
  });
});

// ─── (k) Sem chamada de IA e sem créditos ────────────────────────────────────

describe("(k) nenhuma chamada de IA e nenhum crédito", () => {
  it("o comando não referencia provider, custo ou telemetria produtiva", () => {
    const source = readFileSync(SCRIPT_PATH, "utf8");
    expect(source).not.toMatch(/@\/lib\/ai/);
    expect(source).not.toMatch(/AiCostTracker/);
    expect(source).not.toMatch(/OPENAI_API_KEY|GEMINI_API_KEY/);
    expect(source).not.toMatch(/\bgeneration_events\b/);
  });

  it("a execução não dispara mutação na origem nem toca alvos proibidos", async () => {
    const source = makeSource();
    const destination = makeDestination();
    const db = makeDb();

    await importOneStore({ storeId: STORE_ID, source, destination, db });

    expect(source.calls.mutations).toEqual([]);
    const persisted = JSON.stringify(db.statements);
    for (const target of ["campaigns", "generation_events", "ai_model_selection", "admin_audit_log", "campaign-images"]) {
      expect(persisted.includes(target), target).toBe(false);
    }
  });
});

// ─── `--dry-run` não materializa ─────────────────────────────────────────────

describe("--dry-run não materializa nem escreve localmente", () => {
  it("apenas lê o estado atual e não grava assets/transação/manifesto", async () => {
    const source = makeSource();
    const destination = makeDestination();
    const db = makeDb();

    const result = await importOneStore({
      storeId: STORE_ID,
      source,
      destination,
      db,
      dryRun: true,
      manifestStore: makeManifestStore(),
    });

    expect(result.dryRun).toBe(true);
    expect(result.imported).toBe(false);
    expect(destination.uploads).toEqual([]);
    expect(db.statements).toEqual([]);
    expect(source.calls.download).toEqual([]);
  });
});

// ─── Funções puras de apoio ──────────────────────────────────────────────────

describe("helpers puros da importação", () => {
  it("checksum e path content-addressed são determinísticos", () => {
    const buffer = Buffer.from("conteudo");
    const checksum = computeChecksum(buffer);
    expect(checksum).toBe(computeChecksum(Buffer.from("conteudo")));
    const pathA = buildContentAddressedPath({ storeId: STORE_ID, objectId: ASSET_ID, checksum, extension: ".png" });
    const pathB = buildContentAddressedPath({ storeId: STORE_ID, objectId: ASSET_ID, checksum, extension: ".png" });
    expect(pathA).toBe(pathB);
    expect(pathA).toBe(`${STORE_ID}/${ASSET_ID}/${checksum}.png`);
  });

  it("selectUnreferencedOldObjects devolve apenas os antigos sem referência", () => {
    const oldObjects = [
      { bucket: "store-brand-assets", path: "keep.png" },
      { bucket: "store-brand-assets", path: "drop.png" },
    ];
    const referencedObjects = [{ bucket: "store-brand-assets", path: "keep.png" }];
    expect(selectUnreferencedOldObjects({ oldObjects, referencedObjects })).toEqual([
      { bucket: "store-brand-assets", path: "drop.png" },
    ]);
  });

  it("upsertManifestEntry é idempotente e preserva o restante do manifesto", () => {
    const base = { stores: [{ id: STORE_ID, label: "Antigo" }], notes: "n" };
    const once = upsertManifestEntry(base, { id: STORE_ID, label: "Novo" });
    const twice = upsertManifestEntry(once, { id: STORE_ID, label: "Novo" });
    expect(once).toEqual({ stores: [{ id: STORE_ID, label: "Novo" }], notes: "n" });
    expect(twice).toEqual(once);
    expect(base.stores[0].label).toBe("Antigo");
  });

  it("buildImportAuditRow sanea o detail", () => {
    const row = buildImportAuditRow({
      storeId: STORE_ID,
      sourceHost: "source.local:54321",
      importedBy: "operador",
      sourceUpdatedAt: "2026-09-29T00:00:00.000Z",
      assetCount: 2,
      status: "succeeded",
      detail: { url: "https://x/y.png", ok: true },
    });
    expect(row.store_id).toBe(STORE_ID);
    expect(row.source_host).toBe("source.local:54321");
    expect(row.asset_count).toBe(2);
    expect(JSON.stringify(row.detail)).not.toContain("https://x/y.png");
    expect((row.detail as Record<string, unknown>).ok).toBe(true);
  });

  it("sanitizeMetadata remove chaves/valores sensíveis", () => {
    const sanitized = sanitizeMetadata({ signed_url: "https://x/y.png", token: "abc", jwt: "a.b.c", keep: "v" });
    expect(sanitized).toEqual({ keep: "v" });
  });

  it("buildSanitizedIdentity saneia logo_url, asset_url local e preserva IDs de FK", () => {
    const identity = buildSanitizedIdentity({
      store: { id: STORE_ID, name: "Loja", segment: "variedades", brand_color: "#000", identity_state: "visual_signature" },
      ownerUserId: "owner-1",
      state: {
        profile: { id: "p1", source: "text_only", status: "synced", active_logo_asset_id: ASSET_ID, visual_signature_id: SIG_ID },
        assets: [{ id: ASSET_ID, store_id: STORE_ID, asset_type: "logo", variant_type: "original", source: "user_upload", version: 1, storage_path: ASSET_PATH, mime_type: "image/png", width: 1, height: 1, size_bytes: 1, checksum: "c", status: "active", metadata: {} }],
        signature: { id: SIG_ID, store_id: STORE_ID, storage_path: SIG_PATH, asset_url: "https://signed.invalid/sig.png", type: "ai_generated", status: "active", metadata: {} },
      },
      storedAssets: [{ assetId: ASSET_ID, localPath: `${STORE_ID}/${ASSET_ID}/abc.png`, checksum: "abc", sizeBytes: 9 }],
      storedSignature: { signatureId: SIG_ID, localPath: `${STORE_ID}/${SIG_ID}/def.png` },
    });

    expect(identity.store.logo_url).toBeNull();
    expect(identity.store.user_id).toBe("owner-1");
    expect(identity.store.identity_state).toBe("visual_signature");
    expect(identity.assets[0].storage_path).toBe(`${STORE_ID}/${ASSET_ID}/abc.png`);
    expect(identity.assets[0].store_id).toBe(STORE_ID);
    expect(identity.signature?.asset_url).toBe(`${STORE_ID}/${SIG_ID}/def.png`);
    expect(identity.profile?.active_logo_asset_id).toBe(ASSET_ID);
    expect(identity.profile?.visual_signature_id).toBe(SIG_ID);
  });
});

describe("destino local — resolução de chave (correção descoberta no UAT)", () => {
  const LOCAL_URL = "http://127.0.0.1:54321";
  const MODERN_STATUS = {
    API_URL: LOCAL_URL,
    SECRET_KEY: "sb_secret_modern_key",
    SERVICE_ROLE_KEY: "legacy-stack-key",
  };
  const env = (values: Record<string, string | undefined>) =>
    ({ NODE_ENV: "test", ...values }) as unknown as NodeJS.ProcessEnv;

  it("parseSupabaseStatusEnv reconhece SECRET_KEY (moderna) e SERVICE_ROLE_KEY (legada)", () => {
    const parsed = parseSupabaseStatusEnv(
      [
        'API_URL="http://127.0.0.1:54321"',
        'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
        'SECRET_KEY="sb_secret_modern_key"',
        'SERVICE_ROLE_KEY="legacy-stack-key"',
      ].join("\n"),
    );
    expect(parsed.API_URL).toBe(LOCAL_URL);
    expect(parsed.SECRET_KEY).toBe("sb_secret_modern_key");
    expect(parsed.SERVICE_ROLE_KEY).toBe("legacy-stack-key");
  });

  it("prefere a chave atual do stack (SECRET_KEY) sobre uma SUPABASE_SERVICE_ROLE_KEY legada do env", () => {
    const result = resolveLocalDestination(
      env({ NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL, SUPABASE_SERVICE_ROLE_KEY: "legacy.hs256.jwt" }),
      () => MODERN_STATUS,
    );
    expect(result.url).toBe(LOCAL_URL);
    expect(result.serviceRoleKey).toBe("sb_secret_modern_key");
  });

  it("usa SERVICE_ROLE_KEY do stack quando não há SECRET_KEY", () => {
    const result = resolveLocalDestination(
      env({ SUPABASE_URL: LOCAL_URL, SUPABASE_SERVICE_ROLE_KEY: "legacy.hs256.jwt" }),
      () => ({ API_URL: LOCAL_URL, SERVICE_ROLE_KEY: "legacy-stack-key" }),
    );
    expect(result.serviceRoleKey).toBe("legacy-stack-key");
  });

  it("BENCH_LOCAL_SERVICE_ROLE_KEY é override explícito sobre o stack", () => {
    const result = resolveLocalDestination(
      env({ NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL, BENCH_LOCAL_SERVICE_ROLE_KEY: "explicit-key" }),
      () => MODERN_STATUS,
    );
    expect(result.serviceRoleKey).toBe("explicit-key");
  });

  it("NÃO usa BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY como chave do destino", () => {
    const result = resolveLocalDestination(
      env({ NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL, BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY: "source-key" }),
      () => MODERN_STATUS,
    );
    expect(result.serviceRoleKey).toBe("sb_secret_modern_key");
  });

  it("recusa destino não local antes de qualquer I/O", () => {
    expect(() =>
      resolveLocalDestination(
        env({ NEXT_PUBLIC_SUPABASE_URL: "https://gvbzwihwgzujwsviufgy.supabase.co" }),
        () => MODERN_STATUS,
      ),
    ).toThrow();
  });
});

describe("MIME de branding — resolução e política de bucket (correção UAT)", () => {
  const logoAsset = (over: Row = {}): Row => ({
    id: ASSET_ID,
    store_id: STORE_ID,
    asset_type: "logo",
    variant_type: "original",
    source: "user_upload",
    parent_asset_id: null,
    storage_path: ASSET_PATH,
    mime_type: "image/png",
    width: 1,
    height: 1,
    size_bytes: LOGO_BYTES.length,
    checksum: "c",
    version: 1,
    status: "active",
    metadata: {},
    ...over,
  });

  it("resolveBrandingMime: MIME declarado válido vence Blob.type e extensão", () => {
    expect(
      resolveBrandingMime({ declaredMime: "image/jpeg", blobType: "image/png", storagePath: "x.png" }),
    ).toEqual({ mime: "image/jpeg", extension: ".jpg" });
  });

  it("resolveBrandingMime: usa Blob.type quando não há MIME declarado", () => {
    expect(resolveBrandingMime({ blobType: "image/webp", storagePath: "x.bin" })).toEqual({
      mime: "image/webp",
      extension: ".webp",
    });
  });

  it("resolveBrandingMime: usa extensão segura quando não há MIME", () => {
    expect(resolveBrandingMime({ storagePath: "loja/assinatura.svg" })).toEqual({
      mime: "image/svg+xml",
      extension: ".svg",
    });
  });

  it("resolveBrandingMime: recusa MIME ausente/desconhecido", () => {
    expect(() =>
      resolveBrandingMime({ declaredMime: "application/octet-stream", storagePath: "loja/logo.bin" }),
    ).toThrow(/MIME de branding ausente\/desconhecido/);
  });

  it("materializeStoreAssets: assinatura PNG sem coluna mime_type é enviada como image/png (nunca octet-stream)", async () => {
    const source = makeSource();
    const destination = makeDestination();
    const signature = { id: SIG_ID, store_id: STORE_ID, storage_path: SIG_PATH, status: "active" };

    await materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets: [], signature } });

    expect(destination.uploads).toHaveLength(1);
    expect(destination.uploads[0].bucket).toBe("visual-signatures");
    expect(destination.uploads[0].contentType).toBe("image/png");
    expect(destination.uploads[0].path.endsWith(".png")).toBe(true);
  });

  it("materializeStoreAssets: asset com MIME declarado usa o declarado", async () => {
    const source = makeSource({ objects: { "store-brand-assets:loja/marca.jpg": LOGO_BYTES } });
    const destination = makeDestination();
    const asset = logoAsset({ mime_type: "image/jpeg", storage_path: "loja/marca.jpg" });

    await materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets: [asset], signature: null } });

    expect(destination.uploads[0].contentType).toBe("image/jpeg");
    expect(destination.uploads[0].path.endsWith(".jpg")).toBe(true);
  });

  it("materializeStoreAssets: resolve por Blob.type quando não há MIME nem extensão segura", async () => {
    const destination = makeDestination();
    const source = {
      async download() {
        return {
          type: "image/webp",
          async arrayBuffer() {
            return Uint8Array.from([1, 2, 3]).buffer;
          },
        };
      },
    };
    const asset = logoAsset({ mime_type: undefined, storage_path: "asset.bin" });

    await materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets: [asset], signature: null } });

    expect(destination.uploads[0].contentType).toBe("image/webp");
    expect(destination.uploads[0].path.endsWith(".webp")).toBe(true);
  });

  it("materializeStoreAssets: recusa MIME desconhecido ANTES do upload", async () => {
    const destination = makeDestination();
    const source = makeSource({ objects: { "store-brand-assets:loja/logo.bin": LOGO_BYTES } });
    const asset = logoAsset({ mime_type: "application/octet-stream", storage_path: "loja/logo.bin" });

    await expect(
      materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets: [asset], signature: null } }),
    ).rejects.toThrow(/MIME de branding ausente\/desconhecido/);
    expect(destination.uploads).toHaveLength(0);
  });

  it("materializeStoreAssets: limpa objetos já materializados quando um asset posterior falha", async () => {
    const destination = makeDestination();
    const source = makeSource({
      objects: {
        "store-brand-assets:loja/logo.png": LOGO_BYTES,
        "store-brand-assets:loja/logo2.bin": LOGO_BYTES,
      },
    });
    const assets = [
      logoAsset({ id: ASSET_ID, storage_path: "loja/logo.png", mime_type: "image/png" }),
      logoAsset({
        id: "44444444-4444-4444-8444-444444444444",
        storage_path: "loja/logo2.bin",
        mime_type: "application/octet-stream",
      }),
    ];

    await expect(
      materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets, signature: null } }),
    ).rejects.toThrow(/MIME de branding ausente\/desconhecido/);

    expect(destination.uploads).toHaveLength(1);
    expect(destination.removals).toHaveLength(1);
    expect(destination.removals[0]).toEqual({
      bucket: destination.uploads[0].bucket,
      path: destination.uploads[0].path,
    });
  });
});

describe("MIME por bucket de branding — política real (correção UAT)", () => {
  const logoAsset = (over: Row = {}): Row => ({
    id: ASSET_ID,
    store_id: STORE_ID,
    asset_type: "logo",
    storage_path: ASSET_PATH,
    mime_type: "image/png",
    status: "active",
    ...over,
  });

  it("HEIC/HEIF recusados nos buckets de branding", () => {
    for (const bucket of ["store-logos", "store-brand-assets", "visual-signatures"]) {
      expect(() => assertBrandingMimeAllowedForBucket(bucket, "image/heic")).toThrow(/não permitido/);
      expect(() => assertBrandingMimeAllowedForBucket(bucket, "image/heif")).toThrow(/não permitido/);
    }
  });

  it("SVG permitido apenas em visual-signatures", () => {
    expect(assertBrandingMimeAllowedForBucket("visual-signatures", "image/svg+xml")).toBe("image/svg+xml");
    expect(() => assertBrandingMimeAllowedForBucket("store-logos", "image/svg+xml")).toThrow(/não permitido/);
    expect(() => assertBrandingMimeAllowedForBucket("store-brand-assets", "image/svg+xml")).toThrow(/não permitido/);
  });

  it("JPEG/WEBP recusados em visual-signatures", () => {
    expect(() => assertBrandingMimeAllowedForBucket("visual-signatures", "image/jpeg")).toThrow(/não permitido/);
    expect(() => assertBrandingMimeAllowedForBucket("visual-signatures", "image/webp")).toThrow(/não permitido/);
  });

  it("PNG permitido nos três buckets", () => {
    for (const bucket of ["store-logos", "store-brand-assets", "visual-signatures"]) {
      expect(assertBrandingMimeAllowedForBucket(bucket, "image/png")).toBe("image/png");
    }
  });

  it("materializeStoreAssets: MIME incompatível falha ANTES de qualquer upload", async () => {
    const destination = makeDestination();
    const source = makeSource({ objects: { "store-brand-assets:loja/logo.heic": LOGO_BYTES } });
    const asset = logoAsset({ mime_type: "image/heic", storage_path: "loja/logo.heic" });

    await expect(
      materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets: [asset], signature: null } }),
    ).rejects.toThrow(/não permitido/);
    expect(destination.uploads).toHaveLength(0);
  });

  it("materializeStoreAssets: assinatura SVG é permitida em visual-signatures", async () => {
    const source = makeSource({ objects: { "visual-signatures:loja/assinatura.svg": SIG_BYTES } });
    const destination = makeDestination();
    const signature = { id: SIG_ID, store_id: STORE_ID, storage_path: "loja/assinatura.svg", status: "active" };

    await materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets: [], signature } });

    expect(destination.uploads).toHaveLength(1);
    expect(destination.uploads[0].bucket).toBe("visual-signatures");
    expect(destination.uploads[0].contentType).toBe("image/svg+xml");
    expect(destination.uploads[0].path.endsWith(".svg")).toBe(true);
  });
});

describe("buildInsertStatement — fronteira JSONB com node-postgres (correção UAT)", () => {
  it("serializa arrays JSONB com placeholder ::jsonb", () => {
    const s = buildInsertStatement("store_brand_profiles", {
      id: "p1",
      brand_colors_chosen: ["#111", null],
      logo_colors_detected: ["#fff"],
    });
    expect(s.text).toContain('"brand_colors_chosen"');
    expect(s.text).toMatch(/\$2::jsonb/);
    expect(s.values[1]).toBe('["#111",null]');
    expect(s.values[2]).toBe('["#fff"]');
  });

  it("serializa objetos JSONB (safe_color_tokens/metadata/detail)", () => {
    const p = buildInsertStatement("store_brand_profiles", { safe_color_tokens: { primary: "#22C55E" } });
    expect(p.text).toMatch(/\$1::jsonb/);
    expect(p.values[0]).toBe('{"primary":"#22C55E"}');

    const a = buildInsertStatement("store_brand_assets", { metadata: { note: "ok" } });
    expect(a.text).toMatch(/\$1::jsonb/);
    expect(a.values[0]).toBe('{"note":"ok"}');

    const d = buildInsertStatement("lab_bench_store_imports", { detail: { a: 1 } });
    expect(d.text).toMatch(/\$1::jsonb/);
    expect(d.values[0]).toBe('{"a":1}');
  });

  it("objeto vazio é serializado como {} (não null)", () => {
    const s = buildInsertStatement("store_visual_signatures", { metadata: {} });
    expect(s.text).toMatch(/\$1::jsonb/);
    expect(s.values[0]).toBe("{}");
  });

  it("null permanece SQL NULL (não JSON null) e mantém ::jsonb", () => {
    const s = buildInsertStatement("store_brand_profiles", {
      safe_color_tokens: null,
      brand_colors_chosen: null,
    });
    expect(s.text).toMatch(/\$1::jsonb/);
    expect(s.values[0]).toBeNull();
    expect(s.values[1]).toBeNull();
  });

  it("campos comuns NÃO são serializados nem recebem ::jsonb", () => {
    const s = buildInsertStatement("store_brand_profiles", {
      id: "p1",
      source: "text_only",
      typography_direction: "serif",
    });
    expect(s.text).not.toContain("::jsonb");
    expect(s.values).toEqual(["p1", "text_only", "serif"]);
  });
});

describe("mapeamento de bucket de assets (correção UAT)", () => {
  const VARIANTS = ["original", "normalized", "on_light", "on_dark", "square_safe", "horizontal_safe"];

  it("resolveAssetBucket devolve store-brand-assets para qualquer asset_type/variant_type", () => {
    for (const asset_type of ["logo", "other", undefined]) {
      for (const variant_type of VARIANTS) {
        expect(resolveAssetBucket({ asset_type, variant_type })).toBe("store-brand-assets");
      }
    }
    expect(resolveAssetBucket(undefined)).toBe("store-brand-assets");
  });

  it("materializa as seis variantes em store-brand-assets e NUNCA em store-logos", async () => {
    const assets = VARIANTS.map((variant_type, index) => ({
      id: `asset-${index}`,
      store_id: STORE_ID,
      asset_type: "logo",
      variant_type,
      storage_path: `loja/${variant_type}.png`,
      mime_type: "image/png",
      status: "active",
    }));
    const objects: Record<string, Buffer> = {};
    for (const asset of assets) objects[`store-brand-assets:${asset.storage_path}`] = LOGO_BYTES;

    const source = makeSource({ objects });
    const destination = makeDestination();

    await materializeStoreAssets({ source, destination, storeId: STORE_ID, state: { assets, signature: null } });

    expect(destination.uploads).toHaveLength(6);
    for (const upload of destination.uploads) expect(upload.bucket).toBe("store-brand-assets");
    expect(source.calls.download).toHaveLength(6);
    for (const call of source.calls.download) expect(call.bucket).toBe("store-brand-assets");
    expect(source.calls.download.some((call) => call.bucket === "store-logos")).toBe(false);
  });

  it("readLocalIdentity lê assets locais de store-brand-assets (e assinatura de visual-signatures)", async () => {
    const db = makeDb({
      rows: {
        brandAssets: [{ asset_type: "logo", storage_path: "x/logo.png" }],
        signatures: [{ storage_path: "x/sig.png" }],
      },
    });

    const objects = await readLocalIdentity(db, STORE_ID);

    expect(objects).toContainEqual({ bucket: "store-brand-assets", path: "x/logo.png" });
    expect(objects).toContainEqual({ bucket: "visual-signatures", path: "x/sig.png" });
    expect(objects.some((object) => object.bucket === "store-logos")).toBe(false);
  });
});

describe("ordenação topológica de assets (endurecimento UAT)", () => {
  const parent = { id: "p", store_id: STORE_ID, parent_asset_id: null, asset_type: "logo", variant_type: "original" };
  const childA = { id: "a", store_id: STORE_ID, parent_asset_id: "p", asset_type: "logo", variant_type: "normalized" };
  const childB = { id: "b", store_id: STORE_ID, parent_asset_id: "p", asset_type: "logo", variant_type: "on_light" };

  it("coloca o pai antes dos filhos e mantém ordem estável entre irmãos", () => {
    const ordered = orderAssetsTopologically([childA, childB, parent]);
    expect(ordered.map((asset) => asset.id)).toEqual(["p", "a", "b"]);
  });

  it("aceita lista vazia", () => {
    expect(orderAssetsTopologically([])).toEqual([]);
  });

  it("recusa IDs duplicados", () => {
    expect(() => orderAssetsTopologically([parent, { ...childA, id: "p" }])).toThrow(/duplicado/);
  });

  it("recusa parent ausente do conjunto", () => {
    expect(() => orderAssetsTopologically([childA])).toThrow(/parent_asset_id ausente/);
  });

  it("recusa pai de outra loja", () => {
    expect(() => orderAssetsTopologically([{ ...parent, store_id: "outra-loja" }, childA])).toThrow(/outra loja/);
  });

  it("recusa ciclo", () => {
    const a = { id: "a", store_id: STORE_ID, parent_asset_id: "b" };
    const b = { id: "b", store_id: STORE_ID, parent_asset_id: "a" };
    expect(() => orderAssetsTopologically([a, b])).toThrow(/Ciclo/);
  });

  it("preserva parent_asset_id (não remove)", () => {
    const ordered = orderAssetsTopologically([childA, parent]);
    expect(ordered.find((asset) => asset.id === "a")?.parent_asset_id).toBe("p");
  });
});

describe("guarda de FKs do perfil (endurecimento UAT)", () => {
  it("zera active_logo_asset_id/visual_signature_id quando o referenciado não é importado", () => {
    const profile = {
      id: "prof",
      store_id: STORE_ID,
      source: "logo_analysis",
      status: "synced",
      active_logo_asset_id: "nao-importado",
      visual_signature_id: "nao-importado",
    };
    const row = buildSanitizedProfileRow({
      profile,
      storeId: STORE_ID,
      importedAssetIds: new Set(["outro"]),
      importedSignatureId: "sig-1",
    });
    expect(row?.active_logo_asset_id).toBeNull();
    expect(row?.visual_signature_id).toBeNull();
  });

  it("preserva as FKs quando o referenciado é importado", () => {
    const profile = {
      id: "prof",
      store_id: STORE_ID,
      source: "logo_analysis",
      status: "synced",
      active_logo_asset_id: "asset-1",
      visual_signature_id: "sig-1",
    };
    const row = buildSanitizedProfileRow({
      profile,
      storeId: STORE_ID,
      importedAssetIds: new Set(["asset-1"]),
      importedSignatureId: "sig-1",
    });
    expect(row?.active_logo_asset_id).toBe("asset-1");
    expect(row?.visual_signature_id).toBe("sig-1");
  });
});
