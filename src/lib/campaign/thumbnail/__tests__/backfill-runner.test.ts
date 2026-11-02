// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  runBackfill,
  type BackfillCandidate,
  type BackfillDeps,
  type BackfillOptions,
} from "../backfill-runner";
import type { ThumbnailContext, ThumbnailResult } from "../thumbnail-generator";

const STORE = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const ENDPOINT = "http://127.0.0.1:54321";

function uuidFor(index: number): string {
  return `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`;
}

function candidate(index: number, storeId = STORE): BackfillCandidate {
  return {
    campaignId: `campaign-${index}`,
    storeId,
    originalPath: `${storeId}/${uuidFor(index)}.jpg`,
    createdAt: new Date(2026, 0, index + 1).toISOString(),
  };
}

function context(): ThumbnailContext {
  return {
    endpoint: ENDPOINT,
    uploader: {
      endpoint: ENDPOINT,
      upload: vi.fn(async () => ({ error: null })),
    },
  };
}

function baseOptions(overrides: Partial<BackfillOptions> = {}): BackfillOptions {
  return {
    mode: "dry-run",
    env: "local",
    expectedEndpoint: ENDPOINT,
    actualEndpoint: ENDPOINT,
    confirmEnv: null,
    limit: 10,
    batchSize: 10,
    concurrency: 2,
    context: null,
    ...overrides,
  };
}

function fakeDeps(overrides: Partial<BackfillDeps> = {}): BackfillDeps & {
  calls: {
    list: number;
    download: number;
    exists: number;
    generate: number;
  };
  active: { current: number; max: number };
} {
  const calls = { list: 0, download: 0, exists: 0, generate: 0 };
  const active = { current: 0, max: 0 };
  const deps: BackfillDeps = {
    async listCampaignsPage() {
      calls.list += 1;
      return { items: [], nextCursor: null };
    },
    async downloadOriginal() {
      calls.download += 1;
      active.current += 1;
      active.max = Math.max(active.max, active.current);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active.current -= 1;
      return { data: Buffer.from("image"), error: null };
    },
    async thumbnailExists() {
      calls.exists += 1;
      return { exists: false };
    },
    async inspectOriginal() {
      return { format: "jpeg", width: 1024, height: 1024 };
    },
    async generate() {
      calls.generate += 1;
      return { status: "created", thumbnailPath: "x", width: 288, height: 288 };
    },
    ...overrides,
  };
  return Object.assign(deps, { calls, active });
}

describe("runBackfill", () => {
  it("dry-run não chama generate nem escreve", async () => {
    const deps = fakeDeps({
      async listCampaignsPage() {
        deps.calls.list += 1;
        return {
          items: [candidate(1), candidate(2)],
          nextCursor: null,
        };
      },
    });

    const result = await runBackfill({ deps, options: baseOptions() });

    expect(result.blockedReason).toBeUndefined();
    expect(result.report.counters).toMatchObject({
      seen: 2,
      eligible: 2,
      wouldCreate: 2,
      created: 0,
      alreadyExists: 0,
    });
    expect(deps.calls.generate).toBe(0);
    expect(deps.calls.download).toBe(2);
  });

  it("guarda de endpoint bloqueia antes de qualquer chamada", async () => {
    const deps = fakeDeps();
    const result = await runBackfill({
      deps,
      options: baseOptions({ actualEndpoint: "http://127.0.0.1:54322" }),
    });

    expect(result.blockedReason).toBe("endpoint_mismatch");
    expect(deps.calls).toEqual({
      list: 0,
      download: 0,
      exists: 0,
      generate: 0,
    });
  });

  it("homolog/produção permanecem bloqueados nesta quick", async () => {
    for (const env of ["homolog", "production"] as const) {
      const deps = fakeDeps();
      const result = await runBackfill({
        deps,
        options: baseOptions({ env, mode: "write", confirmEnv: env }),
      });
      expect(result.blockedReason).toBe("target_env_blocked");
      expect(deps.calls.list).toBe(0);
    }
  });

  it("write exige confirmação e contexto compatível", async () => {
    const deps = fakeDeps();
    const noConfirm = await runBackfill({
      deps,
      options: baseOptions({ mode: "write", context: context() }),
    });
    expect(noConfirm.blockedReason).toBe("write_not_confirmed");
    expect(deps.calls.list).toBe(0);

    const mismatch = await runBackfill({
      deps,
      options: baseOptions({
        mode: "write",
        confirmEnv: "local",
        context: { ...context(), endpoint: "http://127.0.0.1:54322" },
      }),
    });
    expect(mismatch.blockedReason).toBe("context_endpoint_mismatch");
    expect(deps.calls.list).toBe(0);
  });

  it("respeita limit e concorrência máxima", async () => {
    const items = Array.from({ length: 10 }, (_, i) => candidate(i + 1));
    const deps = fakeDeps({
      async listCampaignsPage({ limit }) {
        deps.calls.list += 1;
        return { items: items.slice(0, limit), nextCursor: null };
      },
    });

    const result = await runBackfill({
      deps,
      options: baseOptions({ limit: 3, batchSize: 3, concurrency: 2 }),
    });

    expect(result.report.counters.seen).toBe(3);
    expect(result.report.items).toHaveLength(3);
    expect(deps.active.max).toBeLessThanOrEqual(2);
    expect(deps.active.max).toBeGreaterThan(1);
  });

  it("exclui inputs e paths de outro store", async () => {
    const deps = fakeDeps({
      async listCampaignsPage() {
        return {
          items: [
            {
              campaignId: "c1",
              storeId: STORE,
              originalPath: `${STORE}/${CAMPAIGN}/inputs/${OPERATION}.jpg`,
              createdAt: "2026-01-01T00:00:00.000Z",
            },
            {
              campaignId: "c2",
              storeId: STORE,
              originalPath: `${OTHER}/${uuidFor(2)}.jpg`,
              createdAt: "2026-01-02T00:00:00.000Z",
            },
            candidate(3),
          ],
          nextCursor: null,
        };
      },
    });

    const result = await runBackfill({ deps, options: baseOptions() });
    expect(result.report.counters.ineligible).toBe(2);
    expect(result.report.counters.wouldCreate).toBe(1);
    expect(deps.calls.download).toBe(1);
  });

  it("separa original ausente de erro de acesso", async () => {
    let index = 0;
    const deps = fakeDeps({
      async listCampaignsPage() {
        return { items: [candidate(1), candidate(2)], nextCursor: null };
      },
      async downloadOriginal() {
        deps.calls.download += 1;
        index += 1;
        return index === 1
          ? { data: null, error: { statusCode: "404", message: "Object not found" } }
          : { data: null, error: { statusCode: "403", message: "Forbidden" } };
      },
    });

    const result = await runBackfill({ deps, options: baseOptions() });
    expect(result.report.counters.missingOriginal).toBe(1);
    expect(result.report.counters.accessError).toBe(1);
  });

  it("dry-run classifica conteúdo inválido como invalid_format sem gerar", async () => {
    const deps = fakeDeps({
      async listCampaignsPage() {
        return { items: [candidate(1)], nextCursor: null };
      },
      async inspectOriginal() {
        return null;
      },
    });

    const result = await runBackfill({ deps, options: baseOptions() });
    expect(result.report.counters.invalidFormat).toBe(1);
    expect(result.report.counters.wouldCreate).toBe(0);
    expect(deps.calls.generate).toBe(0);
  });

  it("lote final parcial emite cursor nulo (nunca o UUID da campanha)", async () => {
    const deps = fakeDeps({
      async listCampaignsPage() {
        return { items: [candidate(1), candidate(2)], nextCursor: null };
      },
    });

    const result = await runBackfill({
      deps,
      options: baseOptions({ limit: 5, batchSize: 5 }),
    });

    expect(result.report.cursor).toBeNull();
    expect(result.report.counters.wouldCreate).toBe(2);
  });

  it("retoma com o cursor keyset opaco da página anterior", async () => {
    const cursor = `2026-01-01T00:00:00.000Z|${uuidFor(2)}`;
    const seen: Array<string | null> = [];
    let call = 0;
    const deps = fakeDeps({
      async listCampaignsPage({ after }) {
        seen.push(after);
        call += 1;
        if (call === 1) {
          return { items: [candidate(1), candidate(2)], nextCursor: cursor };
        }
        return { items: [], nextCursor: null };
      },
    });

    const first = await runBackfill({
      deps,
      options: baseOptions({ limit: 2, batchSize: 2 }),
    });
    expect(first.report.cursor).toBe(cursor);

    const second = await runBackfill({
      deps,
      options: baseOptions({ limit: 2, batchSize: 2, after: cursor }),
    });
    expect(seen).toEqual([null, cursor]);
    expect(second.report.cursor).toBeNull();
  });

  it("retoma de forma idempotente após timeout (objeto pode ter sido persistido)", async () => {
    const target = candidate(1);
    let persisted = false;
    const generate = vi.fn(
      async (): Promise<ThumbnailResult> => ({
        status: "failed",
        reason: "thumbnail_upload_timeout",
        thumbnailPath: `${STORE}/${CAMPAIGN}-1.thumb-v1.webp`,
      }),
    );

    const deps = fakeDeps({
      async listCampaignsPage() {
        return { items: [target], nextCursor: null };
      },
      async thumbnailExists() {
        deps.calls.exists += 1;
        return { exists: persisted };
      },
      generate,
    });

    const first = await runBackfill({
      deps,
      options: baseOptions({ mode: "write", confirmEnv: "local", context: context() }),
    });
    expect(first.report.counters.failed).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);

    persisted = true;
    generate.mockClear();
    const second = await runBackfill({
      deps,
      options: baseOptions({ mode: "write", confirmEnv: "local", context: context() }),
    });
    expect(second.report.counters.alreadyExists).toBe(1);
    expect(generate).not.toHaveBeenCalled();
  });
});
