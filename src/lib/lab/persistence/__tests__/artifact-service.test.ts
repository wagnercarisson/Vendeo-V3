// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LAB_ALLOWED_ARTIFACT_MIME_TYPES,
  LAB_ARTIFACT_BUCKET,
  LAB_OUTPUT_ARTIFACT_KIND,
  LAB_SIGNED_URL_TTL_SECONDS,
  assertLabArtifactPath,
  buildInputArtifactPath,
  buildOutputArtifactPath,
  computeArtifactChecksum,
  createArtifactSignedUrl,
  createArtifactSignedUrls,
  listRunArtifacts,
  persistOutputArtifact,
} from "../artifact-service";

/**
 * Serviço de artefatos do laboratório (F48.1, D10/D15).
 *
 * Client **100% fake em memória** — nenhuma chamada de rede e nenhuma chamada
 * paga. Cobre bucket/path próprios, metadados + checksum SHA-256, rollback sem
 * órfão, nenhum insert quando o upload falha e a barreira anti-traversal.
 */

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";

const FIXED_BUFFER = Buffer.from("artefato-fixo-f48-1", "utf8");

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
    return Promise.resolve(this.applyFilters(this.fake.selectResult)).then(
      onfulfilled,
      onrejected,
    );
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
  signedUrlResult: FakeResult = { data: { signedUrl: "https://signed.test/art" }, error: null };
  insertResult: FakeResult = { data: { id: "artifact-1" }, error: null };
  selectResult: FakeResult = { data: [], error: null };
  removeThrows = false;
  signedUrlFailsForPaths: string[] = [];

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
          if (this.signedUrlFailsForPaths.includes(path)) {
            return Promise.resolve({ data: null, error: { message: "sign boom" } });
          }
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

// ─── Bucket e paths próprios ─────────────────────────────────────────────────

describe("buildOutputArtifactPath / buildInputArtifactPath", () => {
  it("usa o path próprio do laboratório com a extensão derivada do MIME", () => {
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

  it("monta o path de entrada em inputs/{index}.{ext}", () => {
    expect(
      buildInputArtifactPath({
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        index: 0,
        mimeType: "image/png",
      }),
    ).toBe(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/inputs/0.png`);
  });

  it("recusa MIME fora da allowlist do bucket", () => {
    expect(() =>
      buildOutputArtifactPath({ experimentId: EXPERIMENT_ID, runId: RUN_ID, mimeType: "image/gif" }),
    ).toThrow("unsupported_artifact_mime_type");
  });
});

describe("assertLabArtifactPath (barreira anti-traversal)", () => {
  it("aceita o path canônico do laboratório", () => {
    expect(() =>
      assertLabArtifactPath(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`),
    ).not.toThrow();
  });

  it("recusa path do bucket de campanhas", () => {
    expect(() => assertLabArtifactPath("campaign-images/store-1/campaign.jpg")).toThrow(
      "invalid_artifact_path",
    );
  });

  it("recusa traversal com ..", () => {
    expect(() => assertLabArtifactPath("experiments/../etc/passwd")).toThrow(
      "invalid_artifact_path",
    );
  });

  it("recusa caminho absoluto", () => {
    expect(() => assertLabArtifactPath("/abs/path.png")).toThrow("invalid_artifact_path");
  });

  it("recusa path vazio, backslash e URL", () => {
    expect(() => assertLabArtifactPath("")).toThrow("invalid_artifact_path");
    expect(() => assertLabArtifactPath("experiments\\evil\\output.png")).toThrow(
      "invalid_artifact_path",
    );
    expect(() => assertLabArtifactPath("https://evil.test/output.png")).toThrow(
      "invalid_artifact_path",
    );
  });

  it("recusa ausência do prefixo experiments/ e IDs não-UUID", () => {
    expect(() => assertLabArtifactPath("store-1/campaign.jpg")).toThrow("invalid_artifact_path");
    expect(() => assertLabArtifactPath("experiments/not-a-uuid/runs/whatever/output.png")).toThrow(
      "invalid_artifact_path",
    );
  });
});

// ─── Checksum ────────────────────────────────────────────────────────────────

describe("computeArtifactChecksum", () => {
  it("é o SHA-256 hex do buffer", () => {
    const expected = createHash("sha256").update(FIXED_BUFFER).digest("hex");
    expect(computeArtifactChecksum(FIXED_BUFFER)).toBe(expected);
  });
});

// ─── Persistência com rollback ───────────────────────────────────────────────

describe("persistOutputArtifact", () => {
  it("grava no bucket lab-artifacts com upsert: false, contentType e metadados + checksum", async () => {
    const fake = new FakeSupabaseClient();
    const expectedChecksum = createHash("sha256").update(FIXED_BUFFER).digest("hex");

    const result = await persistOutputArtifact({
      client: asClient(fake),
      experimentId: EXPERIMENT_ID,
      runId: RUN_ID,
      buffer: FIXED_BUFFER,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
    });

    const expectedPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;

    expect(fake.storageFromCalls).toContain(LAB_ARTIFACT_BUCKET);
    expect(fake.uploadCalls).toHaveLength(1);
    expect(fake.uploadCalls[0].bucket).toBe("lab-artifacts");
    expect(fake.uploadCalls[0].path).toBe(expectedPath);
    expect(fake.uploadCalls[0].options).toEqual({ contentType: "image/png", upsert: false });

    expect(fake.insertCalls).toHaveLength(1);
    expect(fake.insertCalls[0].table).toBe("lab_artifacts");
    expect(fake.insertCalls[0].values).toMatchObject({
      run_id: RUN_ID,
      kind: LAB_OUTPUT_ARTIFACT_KIND,
      storage_path: expectedPath,
      mime_type: "image/png",
      width: 1024,
      height: 1024,
      bytes: FIXED_BUFFER.byteLength,
      checksum: expectedChecksum,
    });

    expect(result).toEqual({
      artifactId: "artifact-1",
      storagePath: expectedPath,
      checksum: expectedChecksum,
      bytes: FIXED_BUFFER.byteLength,
    });
    expect(fake.removeCalls).toHaveLength(0);
  });

  it("usa output.jpg para image/jpeg", async () => {
    const fake = new FakeSupabaseClient();
    await persistOutputArtifact({
      client: asClient(fake),
      experimentId: EXPERIMENT_ID,
      runId: RUN_ID,
      buffer: FIXED_BUFFER,
      mimeType: "image/jpeg",
      width: null,
      height: null,
    });
    expect(fake.uploadCalls[0].path).toBe(
      `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.jpg`,
    );
    expect(fake.uploadCalls[0].options).toEqual({ contentType: "image/jpeg", upsert: false });
  });

  it("recusa buffer vazio sem chamar o storage", async () => {
    const fake = new FakeSupabaseClient();
    await expect(
      persistOutputArtifact({
        client: asClient(fake),
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        buffer: Buffer.alloc(0),
        mimeType: "image/png",
        width: null,
        height: null,
      }),
    ).rejects.toThrow("empty_artifact_buffer");

    expect(fake.uploadCalls).toHaveLength(0);
    expect(fake.insertCalls).toHaveLength(0);
  });

  it("remove o objeto exatamente 1 vez quando o insert falha (nenhum órfão)", async () => {
    const fake = new FakeSupabaseClient();
    fake.insertResult = { data: null, error: { message: "insert boom" } };
    const expectedPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;

    await expect(
      persistOutputArtifact({
        client: asClient(fake),
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        buffer: FIXED_BUFFER,
        mimeType: "image/png",
        width: null,
        height: null,
      }),
    ).rejects.toThrow("artifact_persistence_failed");

    expect(fake.removeCalls).toHaveLength(1);
    expect(fake.removeCalls[0].bucket).toBe(LAB_ARTIFACT_BUCKET);
    expect(fake.removeCalls[0].paths).toEqual([expectedPath]);
  });

  it("não mascara o erro original quando o rollback também falha", async () => {
    const fake = new FakeSupabaseClient();
    fake.insertResult = { data: null, error: { message: "insert boom" } };
    fake.removeThrows = true;

    await expect(
      persistOutputArtifact({
        client: asClient(fake),
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        buffer: FIXED_BUFFER,
        mimeType: "image/png",
        width: null,
        height: null,
      }),
    ).rejects.toThrow("artifact_persistence_failed");

    expect(fake.removeCalls).toHaveLength(1);
  });

  it("inspeciona { error } do remove (resolve, não lança) e preserva o erro original", async () => {
    const fake = new FakeSupabaseClient();
    fake.insertResult = { data: null, error: { message: "insert boom" } };
    fake.removeResult = { data: null, error: { message: "remove boom" } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await expect(
        persistOutputArtifact({
          client: asClient(fake),
          experimentId: EXPERIMENT_ID,
          runId: RUN_ID,
          buffer: FIXED_BUFFER,
          mimeType: "image/png",
          width: null,
          height: null,
        }),
      ).rejects.toThrow("artifact_persistence_failed");

      expect(fake.removeCalls).toHaveLength(1);
      // O `{ error }` resolvido pelo Supabase é detectado e reportado — o
      // rollback não falha silenciosamente.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("rollback falhou");
    } finally {
      warn.mockRestore();
    }
  });

  it("não insere nem remove quando o upload falha", async () => {
    const fake = new FakeSupabaseClient();
    fake.uploadResult = { data: null, error: { message: "upload boom" } };

    await expect(
      persistOutputArtifact({
        client: asClient(fake),
        experimentId: EXPERIMENT_ID,
        runId: RUN_ID,
        buffer: FIXED_BUFFER,
        mimeType: "image/png",
        width: null,
        height: null,
      }),
    ).rejects.toThrow("artifact_upload_failed");

    expect(fake.insertCalls).toHaveLength(0);
    expect(fake.removeCalls).toHaveLength(0);
  });
});

// ─── Leitura de metadados ────────────────────────────────────────────────────

describe("listRunArtifacts", () => {
  it("exclui artefatos já removidos e mapeia os metadados", async () => {
    const fake = new FakeSupabaseClient();
    const activePath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;
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
          created_at: "2026-09-16T00:00:00.000Z",
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
          created_at: "2026-09-15T00:00:00.000Z",
          removed_at: "2026-09-16T00:00:00.000Z",
        },
      ],
      error: null,
    };

    const artifacts = await listRunArtifacts({ client: asClient(fake), runId: RUN_ID });

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
      createdAt: "2026-09-16T00:00:00.000Z",
    });
    expect(fake.isCalls).toContainEqual({ column: "removed_at", value: null });
    expect(fake.orderCalls).toContainEqual({
      column: "created_at",
      options: { ascending: true },
    });
  });

  it("propaga falha de leitura como artifact_list_failed", async () => {
    const fake = new FakeSupabaseClient();
    fake.selectResult = { data: null, error: { message: "select boom" } };
    await expect(listRunArtifacts({ client: asClient(fake), runId: RUN_ID })).rejects.toThrow(
      "artifact_list_failed",
    );
  });
});

// ─── Leitura por URL assinada ────────────────────────────────────────────────

describe("createArtifactSignedUrl", () => {
  it("assina no bucket lab-artifacts com TTL de 3600s", async () => {
    const fake = new FakeSupabaseClient();
    const storagePath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;

    const url = await createArtifactSignedUrl({ client: asClient(fake), storagePath });

    expect(url).toBe("https://signed.test/art");
    expect(fake.signedUrlCalls).toHaveLength(1);
    expect(fake.signedUrlCalls[0].bucket).toBe("lab-artifacts");
    expect(fake.signedUrlCalls[0].path).toBe(storagePath);
    expect(fake.signedUrlCalls[0].expiresIn).toBe(3600);
    expect(LAB_SIGNED_URL_TTL_SECONDS).toBe(3600);
  });

  it("lança missing_artifact_path para path vazio sem chamar o storage", async () => {
    const fake = new FakeSupabaseClient();
    await expect(
      createArtifactSignedUrl({ client: asClient(fake), storagePath: "" }),
    ).rejects.toThrow("missing_artifact_path");
    expect(fake.signedUrlCalls).toHaveLength(0);
    expect(fake.storageFromCalls).toHaveLength(0);
  });

  it("lança artifact_signed_url_failed quando a assinatura falha", async () => {
    const fake = new FakeSupabaseClient();
    fake.signedUrlResult = { data: null, error: { message: "sign boom" } };
    await expect(
      createArtifactSignedUrl({
        client: asClient(fake),
        storagePath: `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`,
      }),
    ).rejects.toThrow("artifact_signed_url_failed");
  });

  it("não aceita path do bucket de campanhas", async () => {
    const fake = new FakeSupabaseClient();
    await expect(
      createArtifactSignedUrl({
        client: asClient(fake),
        storagePath: "campaign-images/store-1/campaign.jpg",
      }),
    ).rejects.toThrow("invalid_artifact_path");
    expect(fake.signedUrlCalls).toHaveLength(0);
  });
});

describe("createArtifactSignedUrls", () => {
  it("devolve apenas os paths resolvidos e tolera uma falha entre dois", async () => {
    const fake = new FakeSupabaseClient();
    const okPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;
    const failingPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.jpg`;
    fake.signedUrlFailsForPaths = [failingPath];

    const map = await createArtifactSignedUrls({
      client: asClient(fake),
      storagePaths: [okPath, failingPath],
    });

    expect(map).toEqual({ [okPath]: "https://signed.test/art" });
    expect(fake.signedUrlCalls).toHaveLength(2);
  });

  it("deduplica paths repetidos", async () => {
    const fake = new FakeSupabaseClient();
    const okPath = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;
    const map = await createArtifactSignedUrls({
      client: asClient(fake),
      storagePaths: [okPath, okPath],
    });
    expect(Object.keys(map)).toEqual([okPath]);
    expect(fake.signedUrlCalls).toHaveLength(1);
  });
});

// ─── Contrato de constantes ──────────────────────────────────────────────────

describe("constantes de artefato", () => {
  it("mantém o bucket próprio e a allowlist de MIME do bucket", () => {
    expect(LAB_ARTIFACT_BUCKET).toBe("lab-artifacts");
    expect(LAB_ALLOWED_ARTIFACT_MIME_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });
});
