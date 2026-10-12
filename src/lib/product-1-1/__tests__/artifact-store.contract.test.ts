// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ProductOneToOneArtifactStore,
  artifactStoragePath,
  resizeToJpeg1024,
} from "../artifact/artifact-store";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 05: arte real 1024×1024 do novo fluxo (F7, pipeline PRÓPRIO
// `resizeToJpeg1024`, dimensões DECODIFICADAS dos bytes), registro imutável
// `product_1_1_campaign_artifacts` (migration LOCAL-ONLY, apenas AUTORADA) e
// resultados TIPADOS da operação. Contract test estático + simulado, sem banco,
// sem provider, sem crédito e SEM assinatura no probe (I3).
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261009000004_f56_2b1b_campaign_artifacts.sql";
const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);

const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const activeLines = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
const activeSql = activeLines.join("\n");

const IMAGE_PROCESSOR_PATH = path.resolve(
  process.cwd(),
  "src",
  "lib",
  "campaign",
  "image-processor.ts",
);

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

async function jpegDataUrl(width: number, height: number): Promise<string> {
  const png = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 24, g: 160, b: 72 },
    },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

interface FakeHandles {
  client: SupabaseClient;
  uploads: { path: string; buffer: Buffer; options: Record<string, unknown> }[];
  inserts: { table: string; row: Record<string, unknown> }[];
  downloads: string[];
  signed: { path: string; ttl: number }[];
}

function createFakeClient(
  overrides: {
    uploadError?: unknown;
    download?: { data: unknown; error: unknown };
    downloadThrows?: unknown;
    insertError?: unknown;
    metadata?: Record<string, unknown> | null;
  } = {},
): FakeHandles {
  const uploads: FakeHandles["uploads"] = [];
  const inserts: FakeHandles["inserts"] = [];
  const downloads: FakeHandles["downloads"] = [];
  const signed: FakeHandles["signed"] = [];

  const storageFrom = vi.fn(() => ({
    upload: vi.fn(async (p: string, b: Buffer, o: Record<string, unknown>) => {
      uploads.push({ path: p, buffer: b, options: o });
      return overrides.uploadError
        ? { data: null, error: overrides.uploadError }
        : { data: { path: p }, error: null };
    }),
    download: vi.fn(async (p: string) => {
      downloads.push(p);
      if (overrides.downloadThrows !== undefined) {
        throw overrides.downloadThrows;
      }
      return (
        overrides.download ?? {
          data: null,
          error: { message: "Object not found", statusCode: "404" },
        }
      );
    }),
    createSignedUrl: vi.fn(async (p: string, ttl: number) => {
      signed.push({ path: p, ttl });
      return { data: { signedUrl: `signed://${p}` }, error: null };
    }),
  }));

  const tableFrom = vi.fn((table: string) => ({
    insert: vi.fn(async (row: Record<string, unknown>) => {
      inserts.push({ table, row });
      return { error: overrides.insertError ?? null };
    }),
    select: vi.fn(() => {
      const chain = {
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data: overrides.metadata ?? null,
          error: null,
        })),
      };
      return chain;
    }),
  }));

  const client = {
    storage: { from: storageFrom },
    from: tableFrom,
  } as unknown as SupabaseClient;

  return { client, uploads, inserts, downloads, signed };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Migration 20261009000004 — contrato estático (LOCAL-ONLY, tabela imutável).
// ---------------------------------------------------------------------------

describe("F56.2b1b — migration 20261009000004 campaign_artifacts (contrato estático)", () => {
  it("é LOCAL-ONLY, sem comando mutável remoto e com bloco REVERT", () => {
    expect(activeLines.filter((l) => /db push/i.test(l))).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
  });

  it("cria product_1_1_campaign_artifacts com UNIQUE por operação e CHECKs de dimensão", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.product_1_1_campaign_artifacts/,
    );
    expect(activeSql).toMatch(/campaign_id\s+UUID NOT NULL REFERENCES public\.campaigns\(id\)/);
    expect(activeSql).toMatch(/storage_path\s+TEXT NOT NULL UNIQUE/);
    expect(activeSql).toMatch(/CHECK \(width BETWEEN 1 AND 8192\)/);
    expect(activeSql).toMatch(/CHECK \(height BETWEEN 1 AND 8192\)/);
    expect(activeSql).toMatch(/mime_type\s+TEXT NOT NULL/);
    expect(activeSql).toMatch(
      /CONSTRAINT uq_p1_1_artifact_op UNIQUE \(campaign_id, operation_id\)/,
    );
  });

  it("é imutável (trigger BEFORE UPDATE OR DELETE) e RLS service_role só SELECT/INSERT", () => {
    expect(activeSql).toMatch(
      /RAISE EXCEPTION 'product_1_1_campaign_artifacts_immutable'/,
    );
    expect(activeSql).toMatch(
      /BEFORE UPDATE OR DELETE ON public\.product_1_1_campaign_artifacts/,
    );
    expect(activeSql).toMatch(
      /ALTER TABLE public\.product_1_1_campaign_artifacts ENABLE ROW LEVEL SECURITY/,
    );
    expect(activeSql).toMatch(
      /REVOKE ALL ON TABLE public\.product_1_1_campaign_artifacts FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /GRANT SELECT, INSERT ON TABLE public\.product_1_1_campaign_artifacts TO service_role/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]*\b(UPDATE|DELETE)\b[^;]*ON TABLE public\.product_1_1_campaign_artifacts/,
    );
  });
});

// ---------------------------------------------------------------------------
// F7 — pipeline PRÓPRIO 1024×1024 (dimensões decodificadas dos BYTES).
// ---------------------------------------------------------------------------

describe("F7 — resizeToJpeg1024 (pipeline próprio, dimensões reais)", () => {
  it("produz um JPEG 1:1 1024×1024 decodificado dos BYTES (não literal)", async () => {
    const png = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: { r: 10, g: 90, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const output = await resizeToJpeg1024(png, "image/png");
    expect(output.mimeType).toBe("image/jpeg");

    const metadata = await sharp(output.buffer).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(1024);
  });

  it("recusa formato de entrada não suportado", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    await expect(resizeToJpeg1024(png, "image/gif")).rejects.toThrow(/Unsupported image format/);
  });

  it("o helper legado image-processor.ts permanece 1080×1080 (não alterado)", () => {
    const source = readFileSync(IMAGE_PROCESSOR_PATH, "utf8");
    expect(source).toMatch(/resize\(1080, 1080/);
    expect(source).not.toMatch(/1024/);
  });
});

// ---------------------------------------------------------------------------
// storeArtifact — upload imutável + persistência das dimensões DECODIFICADAS.
// ---------------------------------------------------------------------------

describe("Task 1 — storeArtifact (upload imutável + registro persistido)", () => {
  it("sobe com upsert:false e persiste as dimensões DECODIFICADAS dos BYTES", async () => {
    const handles = createFakeClient();
    const store = new ProductOneToOneArtifactStore(handles.client);

    const ref = await store.storeArtifact({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      imageDataUrl: await jpegDataUrl(512, 512),
    });

    expect(ref.storagePath).toBe(artifactStoragePath(STORE_ID, CAMPAIGN_ID, OPERATION_ID));
    expect(ref.width).toBe(1024);
    expect(ref.height).toBe(1024);
    expect(ref.mimeType).toBe("image/jpeg");

    // O path é exclusivo do novo fluxo e distinto do legado `${storeId}/${campaignId}.jpg`.
    expect(ref.storagePath).toBe(`${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`);
    expect(ref.storagePath).not.toBe(`${STORE_ID}/${CAMPAIGN_ID}.jpg`);

    // Upload imutável (upsert:false) e Content-Type de JPEG.
    expect(handles.uploads).toHaveLength(1);
    expect(handles.uploads[0].path).toBe(ref.storagePath);
    expect(handles.uploads[0].options).toEqual({ contentType: "image/jpeg", upsert: false });

    // O buffer efetivamente enviado decodifica como 1024×1024 (asserção real).
    const uploaded = await sharp(handles.uploads[0].buffer).metadata();
    expect(uploaded.width).toBe(1024);
    expect(uploaded.height).toBe(1024);

    // Registro imutável com dimensões decodificadas.
    expect(handles.inserts).toHaveLength(1);
    expect(handles.inserts[0].table).toBe("product_1_1_campaign_artifacts");
    expect(handles.inserts[0].row).toMatchObject({
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      storage_path: ref.storagePath,
      width: 1024,
      height: 1024,
      mime_type: "image/jpeg",
    });

    // storeArtifact NUNCA assina (I3).
    expect(handles.signed).toHaveLength(0);
  });

  it("conflito de path (objeto existente) ⇒ erro tipado, sem sobrescrever", async () => {
    const handles = createFakeClient({
      uploadError: { message: "The resource already exists", statusCode: "409" },
    });
    const store = new ProductOneToOneArtifactStore(handles.client);

    await expect(
      store.storeArtifact({
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        imageDataUrl: await jpegDataUrl(256, 256),
      }),
    ).rejects.toMatchObject({ code: "artifact_path_conflict" });

    expect(handles.uploads[0].options.upsert).toBe(false);
    expect(handles.inserts).toHaveLength(0);
  });

  it("falha ao persistir metadados ⇒ erro tipado artifact_metadata_persist_failed", async () => {
    const handles = createFakeClient({ insertError: { message: "insert failed" } });
    const store = new ProductOneToOneArtifactStore(handles.client);

    await expect(
      store.storeArtifact({
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        imageDataUrl: await jpegDataUrl(256, 256),
      }),
    ).rejects.toMatchObject({ code: "artifact_metadata_persist_failed" });
  });

  it("getArtifactMetadata recupera EXATAMENTE os valores persistidos", async () => {
    const handles = createFakeClient({
      metadata: {
        storage_path: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
        width: 1024,
        height: 1024,
        mime_type: "image/jpeg",
      },
    });
    const store = new ProductOneToOneArtifactStore(handles.client);

    const ref = await store.getArtifactMetadata(CAMPAIGN_ID, OPERATION_ID);
    expect(ref).toEqual({
      storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
    });
  });

  it("getArtifactMetadata devolve null quando não há registro", async () => {
    const handles = createFakeClient({ metadata: null });
    const store = new ProductOneToOneArtifactStore(handles.client);

    expect(await store.getArtifactMetadata(CAMPAIGN_ID, OPERATION_ID)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 2 — probeArtifact (integridade por CONTEÚDO, C2/I3) + assinatura SEPARADA.
// ---------------------------------------------------------------------------

async function artifactJpeg(size = 1024): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 5, g: 60, b: 120 },
    },
  })
    .jpeg()
    .toBuffer();
}

const DETERMINISTIC_PATH = artifactStoragePath(STORE_ID, CAMPAIGN_ID, OPERATION_ID);

describe("Task 2 — probeArtifact (resultados TIPADOS, C2; SEM assinatura, I3)", () => {
  it("integral: baixa, decodifica o CONTEÚDO e devolve metadados sem assinar", async () => {
    const handles = createFakeClient({
      download: { data: await artifactJpeg(1024), error: null },
      metadata: {
        storage_path: DETERMINISTIC_PATH,
        width: 1024,
        height: 1024,
        mime_type: "image/jpeg",
      },
    });
    const store = new ProductOneToOneArtifactStore(handles.client);

    const probe = await store.probeArtifact({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });

    expect(probe.kind).toBe("integral");
    if (probe.kind === "integral") {
      expect(probe.width).toBe(1024);
      expect(probe.height).toBe(1024);
      expect(probe.mimeType).toBe("image/jpeg");
      expect(probe.storagePath).toBe(DETERMINISTIC_PATH);
      expect(probe.ref).toMatchObject({
        storagePath: DETERMINISTIC_PATH,
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
      });
    }

    // Caminho determinístico do novo fluxo.
    expect(handles.downloads).toEqual([DETERMINISTIC_PATH]);

    // I3 — ZERO assinatura no probe.
    expect(handles.signed).toHaveLength(0);
  });

  it("C2: upload-ok + metadata-fail (sem linha) mas objeto íntegro ⇒ integral (sem regenerar)", async () => {
    const handles = createFakeClient({
      download: { data: await artifactJpeg(1024), error: null },
      metadata: null,
    });
    const store = new ProductOneToOneArtifactStore(handles.client);

    const probe = await store.probeArtifact({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });

    expect(probe.kind).toBe("integral");
    if (probe.kind === "integral") {
      expect(probe.ref.storagePath).toBe(DETERMINISTIC_PATH);
      expect(probe.ref.width).toBe(1024);
      expect(probe.ref.mimeType).toBe("image/jpeg");
    }
    expect(handles.signed).toHaveLength(0);
  });

  it("absent: ausência CONFIRMADA (404 no caminho determinístico)", async () => {
    const handles = createFakeClient({
      download: { data: null, error: { message: "Object not found", statusCode: "404" } },
      metadata: null,
    });
    const store = new ProductOneToOneArtifactStore(handles.client);

    const probe = await store.probeArtifact({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });

    expect(probe.kind).toBe("absent");
    expect(handles.downloads).toEqual([DETERMINISTIC_PATH]);
    expect(handles.signed).toHaveLength(0);
  });

  it("invalid: objeto PRESENTE mas não decodifica como imagem 1:1", async () => {
    const handles = createFakeClient({
      download: { data: Buffer.from("not-an-image-at-all"), error: null },
      metadata: null,
    });
    const store = new ProductOneToOneArtifactStore(handles.client);

    const probe = await store.probeArtifact({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });

    expect(probe.kind).toBe("invalid");
    expect(handles.signed).toHaveLength(0);
  });

  it("invalid: dimensões divergentes do persistido/esperado", async () => {
    const handles = createFakeClient({
      download: { data: await artifactJpeg(512), error: null },
      metadata: {
        storage_path: DETERMINISTIC_PATH,
        width: 1024,
        height: 1024,
        mime_type: "image/jpeg",
      },
    });
    const store = new ProductOneToOneArtifactStore(handles.client);

    const probe = await store.probeArtifact({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });

    expect(probe.kind).toBe("invalid");
  });

  it("indeterminate: erro/indisponibilidade do Storage ⇒ NUNCA absent, nunca null", async () => {
    const handles = createFakeClient({
      download: {
        data: null,
        error: { message: "storage unavailable / timeout", statusCode: "503" },
      },
      metadata: null,
    });
    const store = new ProductOneToOneArtifactStore(handles.client);

    const probe = await store.probeArtifact({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });

    expect(probe.kind).toBe("indeterminate");
    expect(probe.kind).not.toBe("absent");
    expect(handles.signed).toHaveLength(0);
  });

  it("os quatro casos são DISTINTOS entre si (nunca colapsam em null)", async () => {
    const statuses = new Set(["integral", "absent", "invalid", "indeterminate"]);
    expect(statuses.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// F1 (correção 05) — a leitura de HEADER não prova integridade. Dimensões
// 1024×1024 no header (metadata) NÃO bastam: é preciso o formato REAL dos bytes
// + decode COMPLETO (truncado/não-jpeg ⇒ invalid, nunca integral) + mimeType
// derivado do CONTEÚDO (nunca do path `.jpg`/do `mime_type` persistido).
// ---------------------------------------------------------------------------

/** PNG REAL de 1024×1024 (formato diferente servido no path `.jpg`). */
async function artifactPng(size = 1024): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 5, g: 60, b: 120 },
    },
  })
    .png()
    .toBuffer();
}

async function probeWithDownload(
  overrides: Parameters<typeof createFakeClient>[0],
): Promise<{ handles: FakeHandles; probe: Awaited<ReturnType<ProductOneToOneArtifactStore["probeArtifact"]>> }> {
  const handles = createFakeClient(overrides);
  const store = new ProductOneToOneArtifactStore(handles.client);
  const probe = await store.probeArtifact({
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
  });
  return { handles, probe };
}

const INTEGRAL_METADATA = {
  storage_path: DETERMINISTIC_PATH,
  width: 1024,
  height: 1024,
  mime_type: "image/jpeg",
};

describe("F1 — integridade por CONTEÚDO (formato real + decode completo 1024×1024)", () => {
  it.each([300, 500, 1000])(
    "invalid: JPEG TRUNCADO (%i bytes) no path esperado NUNCA é integral",
    async (cutAt) => {
      const full = await artifactJpeg(1024);
      // O header de um JPEG truncado ainda reporta 1024×1024 (metadata ok)…
      const headerOnly = await sharp(full.subarray(0, cutAt)).metadata();
      expect(headerOnly.width).toBe(1024);
      expect(headerOnly.height).toBe(1024);

      const truncated = full.subarray(0, cutAt);
      const { handles, probe } = await probeWithDownload({
        download: { data: truncated, error: null },
        metadata: INTEGRAL_METADATA,
      });

      // …mas o decode COMPLETO falha ⇒ invalid (nunca integral).
      expect(probe.kind).toBe("invalid");
      expect(probe.kind).not.toBe("integral");
      expect(handles.signed).toHaveLength(0);
    },
  );

  it("invalid: objeto de OUTRO formato (PNG real) no path `.jpg` ⇒ não é integral e nunca declara image/jpeg a partir do path", async () => {
    const png = await artifactPng(1024);
    const { handles, probe } = await probeWithDownload({
      download: { data: png, error: null },
      metadata: INTEGRAL_METADATA,
    });

    expect(probe.kind).toBe("invalid");
    expect(probe.kind).not.toBe("integral");
    // O path termina em `.jpg`, mas o formato REAL dos bytes é png ⇒ não integral.
    expect(handles.downloads).toEqual([DETERMINISTIC_PATH]);
    expect(handles.signed).toHaveLength(0);
  });

  it("integral: JPEG 1024×1024 válido com decode COMPLETO ⇒ mimeType derivado do CONTEÚDO (não do path/metadata)", async () => {
    const { handles, probe } = await probeWithDownload({
      download: { data: await artifactJpeg(1024), error: null },
      // metadata declara um mime_type ERRADO (image/png): o retorno deve derivar do conteúdo.
      metadata: { ...INTEGRAL_METADATA, mime_type: "image/png" },
    });

    expect(probe.kind).toBe("integral");
    if (probe.kind === "integral") {
      expect(probe.mimeType).toBe("image/jpeg");
      expect(probe.ref.mimeType).toBe("image/jpeg");
      expect(probe.width).toBe(1024);
      expect(probe.height).toBe(1024);
    }
    expect(handles.signed).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// F2 (correção 05) — ausência só é CONFIRMADA com prova OBJETO-específica no
// bucket esperado; TUDO o mais é `indeterminate` (nunca colapsa com absent).
// ---------------------------------------------------------------------------

describe("F2 — ausência CONFIRMADA vs indeterminado (nunca colapsam)", () => {
  it("absent: 404 cuja mensagem identifica o OBJETO como ausente", async () => {
    const { probe } = await probeWithDownload({
      download: { data: null, error: { message: "Object not found", statusCode: "404" } },
      metadata: null,
    });
    expect(probe.kind).toBe("absent");
  });

  it("indeterminate: 404 GENÉRICO/ambíguo (sem especificidade do objeto)", async () => {
    const { probe } = await probeWithDownload({
      download: { data: null, error: { message: "Not found", statusCode: "404" } },
      metadata: null,
    });
    expect(probe.kind).toBe("indeterminate");
    expect(probe.kind).not.toBe("absent");
  });

  it("indeterminate: 404 que indica o BUCKET (não o objeto)", async () => {
    const { probe } = await probeWithDownload({
      download: { data: null, error: { message: "Bucket not found", statusCode: "404" } },
      metadata: null,
    });
    expect(probe.kind).toBe("indeterminate");
    expect(probe.kind).not.toBe("absent");
  });

  const NON_ABSENCE_ERRORS: [string, { message: string; statusCode: string }][] = [
    ["401 Unauthorized", { message: "Unauthorized", statusCode: "401" }],
    ["403 Forbidden", { message: "Forbidden", statusCode: "403" }],
    ["JWT/auth", { message: "invalid JWT: signature verification failed", statusCode: "400" }],
    ["5xx", { message: "storage unavailable / timeout", statusCode: "503" }],
    ["network/sem status", { message: "fetch failed: socket hang up", statusCode: "" }],
  ];

  it.each(NON_ABSENCE_ERRORS)("indeterminate: erro de %s", async (_label, error) => {
    const { probe } = await probeWithDownload({ download: { data: null, error }, metadata: null });
    expect(probe.kind).toBe("indeterminate");
    expect(probe.kind).not.toBe("absent");
  });

  it("indeterminate: download() LANÇA (exceção) — nunca absent", async () => {
    const { probe } = await probeWithDownload({
      downloadThrows: new Error("socket hang up"),
      metadata: null,
    });
    expect(probe.kind).toBe("indeterminate");
    expect(probe.kind).not.toBe("absent");
  });

  it("indeterminate: !data sem erro", async () => {
    const { probe } = await probeWithDownload({
      download: { data: null, error: null },
      metadata: null,
    });
    expect(probe.kind).toBe("indeterminate");
  });
});

describe("Task 2 — getSignedArtifactUrl (assinatura SEPARADA, portão do Plano 06)", () => {
  it("usa o bucket privado com TTL do servidor (3600 por padrão)", async () => {
    const handles = createFakeClient();
    const store = new ProductOneToOneArtifactStore(handles.client);

    const url = await store.getSignedArtifactUrl(DETERMINISTIC_PATH);
    expect(url).toBe(`signed://${DETERMINISTIC_PATH}`);
    expect(handles.signed).toEqual([{ path: DETERMINISTIC_PATH, ttl: 3600 }]);
  });

  it("RECUSA assinar path fora do prefixo do novo fluxo (não aceita path arbitrário do cliente)", async () => {
    const handles = createFakeClient();
    const store = new ProductOneToOneArtifactStore(handles.client);

    await expect(
      store.getSignedArtifactUrl(`${STORE_ID}/${CAMPAIGN_ID}.jpg`),
    ).rejects.toMatchObject({ code: "artifact_invalid_path" });
    expect(handles.signed).toHaveLength(0);
  });
});
