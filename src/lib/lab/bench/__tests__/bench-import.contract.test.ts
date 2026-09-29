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
  buildContentAddressedPath,
  buildImportAuditRow,
  buildSanitizedIdentity,
  computeChecksum,
  createReadOnlySourceClient,
  importOneStore,
  isForbiddenSourceTarget,
  parseImportArgs,
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
    [`store-logos:${ASSET_PATH}`]: LOGO_BYTES,
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
}

function makeDestination(options: DestinationOptions = {}) {
  const uploads: Array<{ bucket: string; path: string; bytes: number; contentType: string }> = [];
  const removals: Array<{ bucket: string; path: string }> = [];
  let user = options.existingUser ?? null;

  return {
    host: "local:54321",
    uploads,
    removals,
    async findUserByEmail(email: string) {
      return user && user.email === email ? user : null;
    },
    async createSyntheticUser(email: string) {
      user = { id: `owner:${email}`, email };
      return user;
    },
    async uploadBrandingObject({
      bucket,
      path,
      buffer,
      contentType,
    }: {
      bucket: string;
      path: string;
      buffer: Buffer;
      contentType: string;
    }) {
      if (options.uploadError) throw options.uploadError;
      uploads.push({ bucket, path, bytes: buffer.length, contentType });
      return { bucket, path };
    },
    async removeBrandingObjects(objects: Array<{ bucket: string; path: string }>) {
      for (const object of objects) removals.push(object);
      return { removed: objects.length, failed: 0 };
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
    // `logo_url` (índice 9) saneado para NULL.
    expect(storeStatement!.values[9]).toBeNull();

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
  it("reexecução sem mudanças produz os mesmos paths e não duplica", async () => {
    const source = makeSource();
    const manifestStore = makeManifestStore();

    const dest1 = makeDestination();
    await importOneStore({ storeId: STORE_ID, source, destination: dest1, db: makeDb(), manifestStore });
    const firstUploads = JSON.parse(JSON.stringify(dest1.uploads));

    // Segunda execução: a identidade anterior já aponta para os MESMOS paths novos.
    const dest2 = makeDestination();
    const db2 = makeDb({
      rows: {
        brandAssets: [{ asset_type: "logo", storage_path: dest1.uploads[0].path }],
        signatures: [{ storage_path: dest1.uploads[1].path }],
      },
    });
    await importOneStore({ storeId: STORE_ID, source, destination: dest2, db: db2, manifestStore });

    expect(dest2.uploads).toEqual(firstUploads);
    expect(dest2.removals).toEqual([]);
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
        { bucket: "store-logos", path: "old/logo.png" },
        { bucket: "visual-signatures", path: "old/sig.png" },
      ]),
    );
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
        { bucket: "store-logos", path: "old/logo.png" },
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
      { bucket: "store-logos", path: "keep.png" },
      { bucket: "store-logos", path: "drop.png" },
    ];
    const newObjects = [{ bucket: "store-logos", path: "keep.png" }];
    expect(selectUnreferencedOldObjects({ oldObjects, newObjects })).toEqual([
      { bucket: "store-logos", path: "drop.png" },
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
      store: { id: STORE_ID, name: "Loja", segment: "variedades", brand_color: "#000" },
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
    expect(identity.assets[0].storage_path).toBe(`${STORE_ID}/${ASSET_ID}/abc.png`);
    expect(identity.assets[0].store_id).toBe(STORE_ID);
    expect(identity.signature?.asset_url).toBe(`${STORE_ID}/${SIG_ID}/def.png`);
    expect(identity.profile?.active_logo_asset_id).toBe(ASSET_ID);
    expect(identity.profile?.visual_signature_id).toBe(SIG_ID);
  });
});
