// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LAB_ALLOWED_ARTIFACT_MIME_TYPES,
  LAB_ARTIFACT_BUCKET,
  LAB_OUTPUT_ARTIFACT_KIND,
  LAB_SIGNED_URL_TTL_SECONDS,
  buildOutputArtifactPath,
  createArtifactSignedUrl,
  createArtifactSignedUrls,
  listRunArtifacts,
  persistOutputArtifact,
} from "../artifact-service";
import { LAB_ARTIFACT_RETENTION_DAYS } from "../../limits";

import {
  DEFAULT_RETENTION_DAYS,
  isRunInProgress,
  main,
  parseArtifactStoragePath,
  partitionArtifacts,
  resolveRetentionDays,
  selectEligibleArtifacts,
} from "../../../../../scripts/lab/48-cleanup-artifacts.mjs";

const { mockCreateClient } = vi.hoisted(() => ({ mockCreateClient: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

/**
 * F48.1 — suíte de contrato nº 2 (48-1-12, task 12.3): artefatos.
 *
 * Trava o contrato do bucket **próprio** (`lab-artifacts`), do path canônico
 * (`experiments/{experimentId}/runs/{runId}/output.{ext}`), dos metadados com
 * checksum SHA-256, do rollback sem órfão, da leitura por URL assinada de 3600s
 * e do cleanup **manual** que nunca remove run em andamento.
 *
 * Client 100% fake em memória: nenhuma chamada de rede e nenhuma chamada paga.
 */

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const ARCHIVED_RUN_ID = "33333333-3333-4333-8333-333333333333";
const STALE_RUN_ID = "44444444-4444-4444-8444-444444444444";
const ACTIVE_RUN_ID = "55555555-5555-4555-8555-555555555555";

const BUFFER = Buffer.from("artefato-fixo-f48-1-12", "utf8");

// ─── Fake do Supabase (storage + query builder) ──────────────────────────────

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

interface Filter {
  column: string;
  value: unknown;
  op: "eq" | "is";
}

class FakeQueryBuilder {
  private readonly filters: Filter[] = [];
  private insertPayload: Record<string, unknown> | null = null;

  constructor(
    private readonly fake: FakeStorageClient,
    private readonly table: string,
  ) {}

  select(_columns?: string): this {
    this.fake.accessLog.push({ table: this.table, op: "select" });
    return this;
  }

  insert(values: Record<string, unknown>): this {
    this.insertPayload = values;
    this.fake.insertCalls.push({ table: this.table, values });
    this.fake.accessLog.push({ table: this.table, op: "insert" });
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.fake.accessLog.push({ table: this.table, op: "update" });
    this.fake.updateCalls.push({ table: this.table, values });
    return this;
  }

  delete(): this {
    this.fake.accessLog.push({ table: this.table, op: "delete" });
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value, op: "eq" });
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push({ column, value, op: "is" });
    return this;
  }

  order(): this {
    return this;
  }

  async single(): Promise<FakeResult> {
    if (this.insertPayload) return this.fake.insertResult;
    return this.resolve();
  }

  async maybeSingle(): Promise<FakeResult> {
    return this.resolve();
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolve(): FakeResult {
    let rows = [...this.fake.selectRows];
    for (const filter of this.filters) {
      rows = rows.filter((row) => {
        if (filter.op === "is" && filter.value === null) {
          return row[filter.column] === null || row[filter.column] === undefined;
        }
        return row[filter.column] === filter.value;
      });
    }
    return { data: rows, error: this.fake.selectError };
  }
}

class FakeStorageClient {
  readonly storageFromCalls: string[] = [];
  readonly uploadCalls: Array<{ bucket: string; path: string; options: unknown }> = [];
  readonly removeCalls: Array<{ bucket: string; paths: string[] }> = [];
  readonly signedUrlCalls: Array<{ bucket: string; path: string; expiresIn: number }> = [];
  readonly insertCalls: Array<{ table: string; values: Record<string, unknown> }> = [];
  readonly updateCalls: Array<{ table: string; values: Record<string, unknown> }> = [];
  readonly accessLog: Array<{ table: string; op: string }> = [];
  readonly publicUrlCalls: string[] = [];

  uploadResult: FakeResult = { data: { path: "ok" }, error: null };
  insertResult: FakeResult = { data: { id: "artifact-1" }, error: null };
  signedUrlResult: FakeResult = { data: { signedUrl: "https://signed.test/art" }, error: null };
  selectRows: Array<Record<string, unknown>> = [];
  selectError: { message: string } | null = null;
  signedUrlFailsForPaths: string[] = [];

  readonly storage = {
    from: (bucket: string) => {
      this.storageFromCalls.push(bucket);
      return {
        upload: (storagePath: string, _buffer: Buffer, options: unknown) => {
          this.uploadCalls.push({ bucket, path: storagePath, options });
          return Promise.resolve(this.uploadResult);
        },
        remove: (paths: string[]) => {
          this.removeCalls.push({ bucket, paths });
          return Promise.resolve({ data: null, error: null });
        },
        createSignedUrl: (storagePath: string, expiresIn: number) => {
          this.signedUrlCalls.push({ bucket, path: storagePath, expiresIn });
          if (this.signedUrlFailsForPaths.includes(storagePath)) {
            return Promise.resolve({ data: null, error: { message: "sign boom" } });
          }
          return Promise.resolve(this.signedUrlResult);
        },
        getPublicUrl: (storagePath: string) => {
          this.publicUrlCalls.push(storagePath);
          return { data: { publicUrl: `https://public.test/${storagePath}` } };
        },
      };
    },
  };

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }
}

function asClient(fake: FakeStorageClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

// ─── 1. Bucket e path próprios ───────────────────────────────────────────────

describe("contrato de artefatos — bucket e path próprios", () => {
  it("deriva o path canônico com a extensão do MIME", () => {
    expect(
      buildOutputArtifactPath({ experimentId: EXPERIMENT_ID, runId: RUN_ID, mimeType: "image/png" }),
    ).toBe(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`);
    expect(
      buildOutputArtifactPath({
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        mimeType: "image/jpeg",
      }),
    ).toBe(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.jpg`);
    expect(
      buildOutputArtifactPath({
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        mimeType: "image/webp",
      }),
    ).toBe(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.webp`);
  });

  it("grava no bucket lab-artifacts e nunca monta path do bucket de campanhas", async () => {
    const fake = new FakeStorageClient();

    const result = await persistOutputArtifact({
      client: asClient(fake),
      experimentId: EXPERIMENT_ID,
      runId: RUN_ID,
      buffer: BUFFER,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
    });

    expect(LAB_ARTIFACT_BUCKET).toBe("lab-artifacts");
    expect(fake.storageFromCalls).toContain("lab-artifacts");
    expect(fake.uploadCalls[0].bucket).toBe("lab-artifacts");

    // Asserção negativa: nenhum path do laboratório usa o bucket de campanhas.
    expect(result.storagePath).not.toContain("campaign-images");
    expect(fake.uploadCalls[0].path).not.toContain("campaign-images");
    expect(fake.storageFromCalls).not.toContain("campaign-images");
    expect(fake.publicUrlCalls).toHaveLength(0);
  });
});

// ─── 2. Metadados e checksum ─────────────────────────────────────────────────

describe("contrato de artefatos — metadados e checksum", () => {
  it("registra path, MIME, dimensões, bytes e SHA-256 de 64 hex", async () => {
    const fake = new FakeStorageClient();
    const expectedChecksum = createHash("sha256").update(BUFFER).digest("hex");
    const expectedPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;

    const result = await persistOutputArtifact({
      client: asClient(fake),
      experimentId: EXPERIMENT_ID,
      runId: RUN_ID,
      buffer: BUFFER,
      mimeType: "image/png",
      width: 512,
      height: 512,
    });

    expect(fake.insertCalls).toHaveLength(1);
    expect(fake.insertCalls[0].table).toBe("lab_artifacts");
    expect(fake.insertCalls[0].values).toMatchObject({
      run_id: RUN_ID,
      kind: LAB_OUTPUT_ARTIFACT_KIND,
      storage_path: expectedPath,
      mime_type: "image/png",
      width: 512,
      height: 512,
      bytes: BUFFER.byteLength,
      checksum: expectedChecksum,
    });
    expect(expectedChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.checksum).toBe(expectedChecksum);
    expect(LAB_ALLOWED_ARTIFACT_MIME_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });
});

// ─── 3. Rollback sem órfão ───────────────────────────────────────────────────

describe("contrato de artefatos — rollback sem órfão", () => {
  it("remove o objeto quando o insert falha e nenhum registro permanece", async () => {
    const fake = new FakeStorageClient();
    fake.insertResult = { data: null, error: { message: "insert boom" } };
    const expectedPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;

    await expect(
      persistOutputArtifact({
        client: asClient(fake),
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        buffer: BUFFER,
        mimeType: "image/png",
        width: null,
        height: null,
      }),
    ).rejects.toThrow("artifact_persistence_failed");

    expect(fake.removeCalls).toHaveLength(1);
    expect(fake.removeCalls[0].bucket).toBe("lab-artifacts");
    expect(fake.removeCalls[0].paths).toEqual([expectedPath]);
    expect(fake.selectRows).toHaveLength(0);
  });

  it("não insere nem remove quando o upload falha", async () => {
    const fake = new FakeStorageClient();
    fake.uploadResult = { data: null, error: { message: "upload boom" } };

    await expect(
      persistOutputArtifact({
        client: asClient(fake),
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        buffer: BUFFER,
        mimeType: "image/png",
        width: null,
        height: null,
      }),
    ).rejects.toThrow("artifact_upload_failed");

    expect(fake.insertCalls).toHaveLength(0);
    expect(fake.removeCalls).toHaveLength(0);
  });
});

// ─── 4. URL assinada ─────────────────────────────────────────────────────────

describe("contrato de artefatos — leitura por URL assinada", () => {
  it("assina no bucket do laboratório com TTL exato de 3600s", async () => {
    const fake = new FakeStorageClient();
    const storagePath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;

    const url = await createArtifactSignedUrl({ client: asClient(fake), storagePath });

    expect(LAB_SIGNED_URL_TTL_SECONDS).toBe(3600);
    expect(fake.signedUrlCalls).toHaveLength(1);
    expect(fake.signedUrlCalls[0]).toEqual({
      bucket: "lab-artifacts",
      path: storagePath,
      expiresIn: 3600,
    });
    expect(url).toBe("https://signed.test/art");
    // Nenhuma URL pública é montada manualmente.
    expect(fake.publicUrlCalls).toHaveLength(0);
  });

  it("devolve o mapa storagePath → signedUrl e omite paths inválidos", async () => {
    const fake = new FakeStorageClient();
    const okPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;
    const failingPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.jpg`;
    fake.signedUrlFailsForPaths = [failingPath];

    const map = await createArtifactSignedUrls({
      client: asClient(fake),
      storagePaths: [okPath, failingPath, ""],
    });

    expect(map).toEqual({ [okPath]: "https://signed.test/art" });
    expect(Object.values(map).every((value) => !value.includes("public"))).toBe(true);
    expect(fake.signedUrlCalls.map((call) => call.expiresIn)).toEqual([3600, 3600]);
  });
});

// ─── 5. Cleanup manual ───────────────────────────────────────────────────────

describe("contrato de artefatos — cleanup manual protegendo run em andamento", () => {
  const NOW = new Date("2026-09-16T12:00:00.000Z");
  const OLD = new Date(NOW.getTime() - (LAB_ARTIFACT_RETENTION_DAYS + 5) * 86400000).toISOString();
  const RECENT = new Date(NOW.getTime() - 86400000).toISOString();

  function pathFor(runId: string): string {
    return `experiments/${EXPERIMENT_ID}/runs/${runId}/output.png`;
  }

  function runsById(): Map<string, Record<string, unknown>> {
    return new Map([
      [
        ARCHIVED_RUN_ID,
        {
          status: "succeeded",
          created_at: RECENT,
          finished_at: RECENT,
          experiment_id: EXPERIMENT_ID,
          experiment_status: "archived",
        },
      ],
      [
        STALE_RUN_ID,
        {
          status: "succeeded",
          created_at: OLD,
          finished_at: OLD,
          experiment_id: EXPERIMENT_ID,
          experiment_status: "evaluated",
        },
      ],
      [
        ACTIVE_RUN_ID,
        {
          status: "running",
          created_at: OLD,
          finished_at: null,
          experiment_id: EXPERIMENT_ID,
          experiment_status: "running",
        },
      ],
      [
        RUN_ID,
        {
          status: "succeeded",
          created_at: RECENT,
          finished_at: RECENT,
          experiment_id: EXPERIMENT_ID,
          experiment_status: "evaluated",
        },
      ],
    ]);
  }

  const ARTIFACTS = [
    { id: "a-archived", run_id: ARCHIVED_RUN_ID, storage_path: pathFor(ARCHIVED_RUN_ID), removed_at: null },
    { id: "a-stale", run_id: STALE_RUN_ID, storage_path: pathFor(STALE_RUN_ID), removed_at: null },
    { id: "a-active", run_id: ACTIVE_RUN_ID, storage_path: pathFor(ACTIVE_RUN_ID), removed_at: null },
    { id: "a-recent", run_id: RUN_ID, storage_path: pathFor(RUN_ID), removed_at: null },
    { id: "a-removed", run_id: RUN_ID, storage_path: pathFor(RUN_ID), removed_at: "2026-09-15T00:00:00.000Z" },
    {
      id: "a-invalid",
      run_id: RUN_ID,
      storage_path: `experiments/${EXPERIMENT_ID}/runs/not-a-uuid/output.png`,
      removed_at: null,
    },
  ];

  it("remove apenas os elegíveis e nunca o run em andamento", () => {
    const eligible = selectEligibleArtifacts({
      artifacts: ARTIFACTS,
      runsById: runsById(),
      now: NOW,
      retentionDays: LAB_ARTIFACT_RETENTION_DAYS,
    });

    const ids = eligible.map((artifact) => artifact.artifactId);
    expect(ids).toContain("a-archived");
    expect(ids).toContain("a-stale");
    expect(ids).not.toContain("a-active");
    expect(ids).not.toContain("a-recent");
    expect(ids).not.toContain("a-removed");
    expect(ids).not.toContain("a-invalid");
    expect(eligible.every((artifact) => artifact.storagePath.length > 0)).toBe(true);
  });

  it("reporta path incoerente como invalid sem apagar nenhuma evidência", () => {
    const { eligible, invalid } = partitionArtifacts({
      artifacts: ARTIFACTS,
      runsById: runsById(),
      now: NOW,
      retentionDays: LAB_ARTIFACT_RETENTION_DAYS,
    });

    expect(invalid.map((entry) => entry.artifactId)).toEqual(["a-invalid"]);
    expect(eligible.map((artifact) => artifact.artifactId)).not.toContain("a-invalid");
    expect(parseArtifactStoragePath(`experiments/${EXPERIMENT_ID}/runs/not-a-uuid/output.png`)).toBeNull();
    expect(parseArtifactStoragePath(pathFor(RUN_ID))).toEqual({
      experimentId: EXPERIMENT_ID.toLowerCase(),
      runId: RUN_ID.toLowerCase(),
    });
  });

  it("usa LAB_ARTIFACT_RETENTION_DAYS (30) como retenção e não cria scheduler", () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(30);
    expect(DEFAULT_RETENTION_DAYS).toBe(LAB_ARTIFACT_RETENTION_DAYS);
    expect(resolveRetentionDays(undefined)).toBe(30);
    expect(resolveRetentionDays("10")).toBe(10);
    expect(isRunInProgress("pending")).toBe(true);
    expect(isRunInProgress("running")).toBe(true);
    expect(isRunInProgress("succeeded")).toBe(false);

    const source = readFileSync(
      path.join(process.cwd(), "scripts/lab/48-cleanup-artifacts.mjs"),
      "utf8",
    );
    // Cleanup é manual/opt-in: nenhum agendamento e nenhum delete de evidência.
    expect(source).not.toMatch(/setInterval|setTimeout|cron/i);
    expect(source).toContain("removed_at");
    expect(source).not.toMatch(/\.delete\(/);
  });

  it("executa o cleanup real: remove só os paths elegíveis e marca removed_at só neles", async () => {
    // Datas relativas ao relógio real (o `main` usa `new Date()` internamente).
    const realNow = Date.now();
    const oldIso = new Date(realNow - (LAB_ARTIFACT_RETENTION_DAYS + 5) * 86400000).toISOString();
    const recentIso = new Date(realNow - 86400000).toISOString();
    const archivedExperimentId = "99999999-9999-4999-8999-999999999999";

    const artifacts = [
      {
        id: "a-archived",
        run_id: ARCHIVED_RUN_ID,
        storage_path: `experiments/${archivedExperimentId}/runs/${ARCHIVED_RUN_ID}/output.png`,
        removed_at: null,
      },
      { id: "a-stale", run_id: STALE_RUN_ID, storage_path: pathFor(STALE_RUN_ID), removed_at: null },
      { id: "a-active", run_id: ACTIVE_RUN_ID, storage_path: pathFor(ACTIVE_RUN_ID), removed_at: null },
      { id: "a-recent", run_id: RUN_ID, storage_path: pathFor(RUN_ID), removed_at: null },
      {
        id: "a-removed",
        run_id: RUN_ID,
        storage_path: pathFor(RUN_ID),
        removed_at: "2026-09-15T00:00:00.000Z",
      },
      {
        id: "a-invalid",
        run_id: RUN_ID,
        storage_path: `experiments/${EXPERIMENT_ID}/runs/not-a-uuid/output.png`,
        removed_at: null,
      },
    ];

    const runs = [
      { id: ARCHIVED_RUN_ID, status: "succeeded", created_at: recentIso, finished_at: recentIso, experiment_id: archivedExperimentId },
      { id: STALE_RUN_ID, status: "succeeded", created_at: oldIso, finished_at: oldIso, experiment_id: EXPERIMENT_ID },
      { id: ACTIVE_RUN_ID, status: "running", created_at: oldIso, finished_at: null, experiment_id: EXPERIMENT_ID },
      { id: RUN_ID, status: "succeeded", created_at: recentIso, finished_at: recentIso, experiment_id: EXPERIMENT_ID },
    ];

    const experiments = [
      { id: EXPERIMENT_ID, status: "evaluated" },
      { id: archivedExperimentId, status: "archived" },
    ];

    const calls = {
      remove: [] as Array<{ bucket: string; paths: string[] }>,
      updates: [] as Array<{ table: string; values: Record<string, unknown>; id: string }>,
      deletes: [] as string[],
    };

    mockCreateClient.mockReturnValue({
      from(table: string) {
        return {
          select: () =>
            Promise.resolve({
              data:
                table === "lab_artifacts" ? artifacts : table === "lab_runs" ? runs : experiments,
              error: null,
            }),
          update: (values: Record<string, unknown>) => ({
            eq: (_column: string, id: string) => {
              calls.updates.push({ table, values, id });
              return Promise.resolve({ data: null, error: null });
            },
          }),
          delete: () => {
            calls.deletes.push(table);
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
      },
      storage: {
        from(bucket: string) {
          return {
            remove: (paths: string[]) => {
              calls.remove.push({ bucket, paths });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      },
    });

    const summary = await main([], {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    } as unknown as typeof process.env);

    expect(summary).toMatchObject({ eligible: 2, invalid: 1, removed: 2, skipped: 0, dryRun: false });

    // Storage: apenas os paths elegíveis, no bucket do laboratório.
    expect(calls.remove).toEqual([
      {
        bucket: LAB_ARTIFACT_BUCKET,
        paths: [`experiments/${archivedExperimentId}/runs/${ARCHIVED_RUN_ID}/output.png`],
      },
      { bucket: LAB_ARTIFACT_BUCKET, paths: [pathFor(STALE_RUN_ID)] },
    ]);

    // `removed_at` gravado apenas nos registros correspondentes.
    expect(calls.updates).toEqual([
      { table: "lab_artifacts", values: { removed_at: expect.any(String) }, id: "a-archived" },
      { table: "lab_artifacts", values: { removed_at: expect.any(String) }, id: "a-stale" },
    ]);
    for (const untouched of ["a-active", "a-recent", "a-removed", "a-invalid"]) {
      expect(calls.updates.map((update) => update.id)).not.toContain(untouched);
    }
    // O run em andamento nunca tem o path removido do storage.
    expect(calls.remove.flatMap((call) => call.paths)).not.toContain(pathFor(ACTIVE_RUN_ID));

    // Nenhum `delete` em tabela: metadados/histórico permanecem.
    expect(calls.deletes).toEqual([]);
  });
});

// ─── 6. Acesso negado / bucket privado ───────────────────────────────────────

describe("contrato de artefatos — leitura restrita e bucket privado", () => {
  it("lista apenas artefatos não removidos e valida o path de cada metadado", async () => {
    const fake = new FakeStorageClient();
    const activePath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;
    fake.selectRows = [
      {
        id: "a-active",
        run_id: RUN_ID,
        kind: "output",
        storage_path: activePath,
        mime_type: "image/png",
        width: 8,
        height: 8,
        bytes: 128,
        checksum: "c".repeat(64),
        created_at: "2026-09-16T00:00:00.000Z",
        removed_at: null,
      },
      {
        id: "a-removed",
        run_id: RUN_ID,
        kind: "output",
        storage_path: activePath,
        mime_type: "image/png",
        width: 8,
        height: 8,
        bytes: 128,
        checksum: "c".repeat(64),
        created_at: "2026-09-15T00:00:00.000Z",
        removed_at: "2026-09-16T00:00:00.000Z",
      },
    ];

    const artifacts = await listRunArtifacts({ client: asClient(fake), runId: RUN_ID });

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].storagePath).toBe(activePath);
    expect(artifacts[0].checksum).toBe("c".repeat(64));
    // O bucket permanece privado: nenhuma chamada de URL pública.
    expect(fake.publicUrlCalls).toHaveLength(0);
    expect(fake.accessLog.filter((entry) => entry.table === "lab_artifacts")).toHaveLength(1);
  });
});
