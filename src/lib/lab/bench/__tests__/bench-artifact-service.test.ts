// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BENCH_ARTIFACT_PATH_PREFIX,
  BENCH_INPUT_ARTIFACT_KIND,
  BENCH_OUTPUT_ARTIFACT_KIND,
  buildBenchInputArtifactPath,
  buildBenchOutputArtifactPath,
  createBenchArtifactSignedUrl,
  listBenchArtifacts,
  persistBenchArtifact,
} from "../persistence/bench-artifact-service";

/**
 * Serviço de artefatos da bancada (F48.2.2, D5/D14).
 *
 * Client **100% fake em memória** — nenhuma chamada de rede e nenhuma chamada
 * paga. Cobre o path próprio `bench/{runId}/...` no bucket `lab-artifacts`,
 * metadados + checksum, rollback sem órfão com marcação da geração como falha,
 * leitura por URL assinada e ausência de uso do bucket de campanha.
 */

const RUN_ID = "22222222-2222-4222-8222-222222222222";
const FIXED_BUFFER = Buffer.from("artefato-fixo-f48-2-2", "utf8");

// ─── Fake do Supabase (storage + query builder) ──────────────────────────────

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

interface FakeFilter {
  column: string;
  value: unknown;
  op: "eq" | "is";
}

class FakeQueryBuilder {
  private readonly filters: FakeFilter[] = [];

  constructor(
    private readonly table: string,
    private readonly fake: FakeSupabaseClient,
  ) {}

  select(columns: string): this {
    this.fake.selectCalls.push({ table: this.table, columns });
    return this;
  }

  insert(values: Record<string, unknown>): this {
    this.fake.insertCalls.push({ table: this.table, values });
    return this;
  }

  eq(column: string, value: unknown): this {
    this.fake.eqCalls.push({ column, value });
    this.filters.push({ column, value, op: "eq" });
    return this;
  }

  is(column: string, value: unknown): this {
    this.fake.isCalls.push({ column, value });
    this.filters.push({ column, value, op: "is" });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.fake.orderCalls.push({ column, options });
    return this;
  }

  single(): Promise<FakeResult> {
    return Promise.resolve(this.fake.insertResult);
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.applyFilters(this.fake.selectResult)).then(onfulfilled, onrejected);
  }

  private applyFilters(result: FakeResult): FakeResult {
    if (!Array.isArray(result.data)) return result;
    let rows = result.data as Array<Record<string, unknown>>;
    for (const filter of this.filters) {
      if (filter.op === "is" && filter.value === null) {
        rows = rows.filter((row) => row[filter.column] === null || row[filter.column] === undefined);
      } else {
        rows = rows.filter((row) => row[filter.column] === filter.value);
      }
    }
    return { ...result, data: rows };
  }
}

class FakeSupabaseClient {
  readonly storageFromCalls: string[] = [];
  readonly uploadCalls: Array<{ bucket: string; path: string; options: unknown }> = [];
  readonly removeCalls: Array<{ bucket: string; paths: string[] }> = [];
  readonly signedUrlCalls: Array<{ bucket: string; path: string; expiresIn: number }> = [];
  readonly insertCalls: Array<{ table: string; values: Record<string, unknown> }> = [];
  readonly selectCalls: Array<{ table: string; columns: string }> = [];
  readonly eqCalls: Array<{ column: string; value: unknown }> = [];
  readonly isCalls: Array<{ column: string; value: unknown }> = [];
  readonly orderCalls: Array<{ column: string; options?: { ascending?: boolean } }> = [];

  uploadResult: FakeResult = { data: { path: "ok" }, error: null };
  removeResult: FakeResult = { data: [], error: null };
  signedUrlResult: FakeResult = { data: { signedUrl: "https://signed.test/bench" }, error: null };
  insertResult: FakeResult = { data: { id: "bench-artifact-1" }, error: null };
  selectResult: FakeResult = { data: [], error: null };
  removeThrows = false;

  readonly storage = {
    from: (bucket: string) => {
      this.storageFromCalls.push(bucket);
      return {
        upload: (path: string, _buffer: Buffer, options: unknown) => {
          this.uploadCalls.push({ bucket, path, options });
          return Promise.resolve(this.uploadResult);
        },
        remove: (paths: string[]) => {
          this.removeCalls.push({ bucket, paths });
          if (this.removeThrows) return Promise.reject(new Error("remove boom"));
          return Promise.resolve(this.removeResult);
        },
        createSignedUrl: (path: string, expiresIn: number) => {
          this.signedUrlCalls.push({ bucket, path, expiresIn });
          return Promise.resolve(this.signedUrlResult);
        },
      };
    },
  };

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(table, this);
  }
}

function asClient(fake: FakeSupabaseClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

// ─── Builders de path ────────────────────────────────────────────────────────

describe("builders de path da bancada", () => {
  it("monta o path de entrada em bench/{runId}/inputs/{index}.{ext}", () => {
    expect(
      buildBenchInputArtifactPath({ runId: RUN_ID, index: 0, mimeType: "image/png" }),
    ).toBe(`bench/${RUN_ID}/inputs/0.png`);
    expect(
      buildBenchInputArtifactPath({ runId: RUN_ID, index: 3, mimeType: "image/jpeg" }),
    ).toBe(`bench/${RUN_ID}/inputs/3.jpg`);
  });

  it("monta o path de saída em bench/{runId}/output.{ext}", () => {
    expect(buildBenchOutputArtifactPath({ runId: RUN_ID, mimeType: "image/png" })).toBe(
      `bench/${RUN_ID}/output.png`,
    );
    expect(buildBenchOutputArtifactPath({ runId: RUN_ID, mimeType: "image/webp" })).toBe(
      `bench/${RUN_ID}/output.webp`,
    );
  });

  it("recusa MIME fora da allowlist do bucket", () => {
    expect(() => buildBenchOutputArtifactPath({ runId: RUN_ID, mimeType: "image/gif" })).toThrow(
      "unsupported_artifact_mime_type",
    );
  });

  it("expõe o prefixo próprio da bancada", () => {
    expect(BENCH_ARTIFACT_PATH_PREFIX).toBe("bench");
    expect(BENCH_INPUT_ARTIFACT_KIND).toBe("input");
    expect(BENCH_OUTPUT_ARTIFACT_KIND).toBe("output");
  });
});

// ─── Persistência com rollback ───────────────────────────────────────────────

describe("persistBenchArtifact", () => {
  it("grava a entrada no bucket lab-artifacts e registra kind/path/MIME/dimensões/bytes/checksum", async () => {
    const fake = new FakeSupabaseClient();
    const expectedChecksum = createHash("sha256").update(FIXED_BUFFER).digest("hex");

    const result = await persistBenchArtifact({
      client: asClient(fake),
      runId: RUN_ID,
      kind: BENCH_INPUT_ARTIFACT_KIND,
      buffer: FIXED_BUFFER,
      mimeType: "image/png",
      index: 0,
      width: 512,
      height: 512,
    });

    const expectedPath = `bench/${RUN_ID}/inputs/0.png`;

    expect(fake.uploadCalls).toHaveLength(1);
    expect(fake.uploadCalls[0].bucket).toBe("lab-artifacts");
    expect(fake.uploadCalls[0].path).toBe(expectedPath);
    expect(fake.uploadCalls[0].options).toEqual({ contentType: "image/png", upsert: false });

    expect(fake.insertCalls).toHaveLength(1);
    expect(fake.insertCalls[0].table).toBe("lab_bench_artifacts");
    expect(fake.insertCalls[0].values).toMatchObject({
      run_id: RUN_ID,
      kind: "input",
      storage_path: expectedPath,
      mime_type: "image/png",
      width: 512,
      height: 512,
      bytes: FIXED_BUFFER.byteLength,
      checksum: expectedChecksum,
    });

    expect(result).toEqual({
      artifactId: "bench-artifact-1",
      storagePath: expectedPath,
      checksum: expectedChecksum,
      bytes: FIXED_BUFFER.byteLength,
    });
    expect(fake.removeCalls).toHaveLength(0);
  });

  it("grava a saída com kind output em bench/{runId}/output.{ext}", async () => {
    const fake = new FakeSupabaseClient();

    await persistBenchArtifact({
      client: asClient(fake),
      runId: RUN_ID,
      kind: BENCH_OUTPUT_ARTIFACT_KIND,
      buffer: FIXED_BUFFER,
      mimeType: "image/webp",
      width: 1024,
      height: 1024,
    });

    expect(fake.uploadCalls[0].path).toBe(`bench/${RUN_ID}/output.webp`);
    expect(fake.insertCalls[0].values).toMatchObject({
      kind: "output",
      storage_path: `bench/${RUN_ID}/output.webp`,
    });
  });

  it("nunca usa o bucket de campanha (somente lab-artifacts)", async () => {
    const fake = new FakeSupabaseClient();
    await persistBenchArtifact({
      client: asClient(fake),
      runId: RUN_ID,
      kind: BENCH_OUTPUT_ARTIFACT_KIND,
      buffer: FIXED_BUFFER,
      mimeType: "image/png",
    });
    expect(fake.storageFromCalls).toEqual(["lab-artifacts"]);
  });

  it("recusa buffer vazio sem tocar o storage", async () => {
    const fake = new FakeSupabaseClient();
    await expect(
      persistBenchArtifact({
        client: asClient(fake),
        runId: RUN_ID,
        kind: BENCH_OUTPUT_ARTIFACT_KIND,
        buffer: Buffer.alloc(0),
        mimeType: "image/png",
      }),
    ).rejects.toThrow("empty_artifact_buffer");
    expect(fake.uploadCalls).toHaveLength(0);
    expect(fake.insertCalls).toHaveLength(0);
  });

  it("remove o objeto e marca a geração como failed quando o insert falha (sem órfão)", async () => {
    const fake = new FakeSupabaseClient();
    fake.insertResult = { data: null, error: { message: "insert boom" } };
    const finalizeRun = vi.fn().mockResolvedValue(undefined);
    const expectedPath = `bench/${RUN_ID}/output.png`;

    await expect(
      persistBenchArtifact({
        client: asClient(fake),
        runId: RUN_ID,
        kind: BENCH_OUTPUT_ARTIFACT_KIND,
        buffer: FIXED_BUFFER,
        mimeType: "image/png",
        finalizeRun,
      }),
    ).rejects.toThrow("artifact_persistence_failed");

    expect(fake.removeCalls).toHaveLength(1);
    expect(fake.removeCalls[0].bucket).toBe("lab-artifacts");
    expect(fake.removeCalls[0].paths).toEqual([expectedPath]);
    expect(finalizeRun).toHaveBeenCalledTimes(1);
    expect(finalizeRun).toHaveBeenCalledWith({
      runId: RUN_ID,
      status: "failed",
      errorType: "artifact_persistence_failed",
    });
  });

  it("faz o rollback e lança mesmo sem finalizeRun injetado", async () => {
    const fake = new FakeSupabaseClient();
    fake.insertResult = { data: null, error: { message: "insert boom" } };

    await expect(
      persistBenchArtifact({
        client: asClient(fake),
        runId: RUN_ID,
        kind: BENCH_OUTPUT_ARTIFACT_KIND,
        buffer: FIXED_BUFFER,
        mimeType: "image/png",
      }),
    ).rejects.toThrow("artifact_persistence_failed");

    expect(fake.removeCalls).toHaveLength(1);
  });

  it("não insere nem remove quando o upload falha", async () => {
    const fake = new FakeSupabaseClient();
    fake.uploadResult = { data: null, error: { message: "upload boom" } };

    await expect(
      persistBenchArtifact({
        client: asClient(fake),
        runId: RUN_ID,
        kind: BENCH_OUTPUT_ARTIFACT_KIND,
        buffer: FIXED_BUFFER,
        mimeType: "image/png",
      }),
    ).rejects.toThrow("artifact_upload_failed");

    expect(fake.insertCalls).toHaveLength(0);
    expect(fake.removeCalls).toHaveLength(0);
  });
});

// ─── Leitura de metadados ────────────────────────────────────────────────────

describe("listBenchArtifacts", () => {
  it("exclui removidos e mapeia os metadados", async () => {
    const fake = new FakeSupabaseClient();
    const activePath = `bench/${RUN_ID}/output.png`;
    fake.selectResult = {
      data: [
        {
          id: "a-active",
          run_id: RUN_ID,
          kind: "output",
          storage_path: activePath,
          mime_type: "image/png",
          width: 1024,
          height: 1024,
          bytes: 1234,
          checksum: "abc",
          created_at: "2026-09-28T00:00:00.000Z",
          removed_at: null,
        },
        {
          id: "a-removed",
          run_id: RUN_ID,
          kind: "output",
          storage_path: activePath,
          mime_type: "image/png",
          width: 1024,
          height: 1024,
          bytes: 1234,
          checksum: "abc",
          created_at: "2026-09-27T00:00:00.000Z",
          removed_at: "2026-09-28T00:00:00.000Z",
        },
      ],
      error: null,
    };

    const artifacts = await listBenchArtifacts({ client: asClient(fake), runId: RUN_ID });

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toEqual({
      id: "a-active",
      kind: "output",
      storagePath: activePath,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      bytes: 1234,
      checksum: "abc",
      createdAt: "2026-09-28T00:00:00.000Z",
    });
    expect(fake.selectCalls[0].table).toBe("lab_bench_artifacts");
    expect(fake.isCalls).toContainEqual({ column: "removed_at", value: null });
  });

  it("propaga falha de leitura como bench_artifact_list_failed", async () => {
    const fake = new FakeSupabaseClient();
    fake.selectResult = { data: null, error: { message: "select boom" } };
    await expect(listBenchArtifacts({ client: asClient(fake), runId: RUN_ID })).rejects.toThrow(
      "bench_artifact_list_failed",
    );
  });
});

// ─── Leitura por URL assinada ────────────────────────────────────────────────

describe("createBenchArtifactSignedUrl", () => {
  it("assina no bucket lab-artifacts com TTL do servidor", async () => {
    const fake = new FakeSupabaseClient();
    const storagePath = `bench/${RUN_ID}/output.png`;

    const url = await createBenchArtifactSignedUrl({ client: asClient(fake), storagePath });

    expect(url).toBe("https://signed.test/bench");
    expect(fake.signedUrlCalls).toHaveLength(1);
    expect(fake.signedUrlCalls[0].bucket).toBe("lab-artifacts");
    expect(fake.signedUrlCalls[0].path).toBe(storagePath);
    expect(fake.signedUrlCalls[0].expiresIn).toBe(3600);
  });

  it("não aceita path do bucket de campanha", async () => {
    const fake = new FakeSupabaseClient();
    await expect(
      createBenchArtifactSignedUrl({
        client: asClient(fake),
        storagePath: "campaign-images/store-1/campaign.jpg",
      }),
    ).rejects.toThrow("invalid_artifact_path");
    expect(fake.signedUrlCalls).toHaveLength(0);
  });
});
