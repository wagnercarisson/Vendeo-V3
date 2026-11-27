import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Cliente lazy: o getter de `supabaseAdmin` conta cada resolução. O módulo
 * `offer.ts` deve resolver o cliente UMA única vez e reutilizá-lo nas duas
 * RPCs de `readTrialOfferSchedule`.
 */
const lazyState = vi.hoisted(() => ({
  resolutions: 0,
  calls: [] as Array<{ name: string; args: unknown; owner: unknown }>,
}));

vi.mock("@/lib/supabase/server", () => {
  const startedAt = "2026-10-20T00:00:00.000Z";
  const conditions = {
    offer_key: "trial_28d_v1",
    version_id: "11111111-1111-4111-8111-111111111111",
    version_label: "v1",
    public_name: "Teste gratuito de 28 dias",
    duration_days: 28,
    max_total_credits: 20,
    release_frequency: "weekly",
    credits_per_release: 5,
    published_at: "2026-11-26T23:07:35.123456+00:00",
  };
  const schedule = {
    expires_at: "2026-11-17T00:00:00.000Z",
    releases: [0, 7, 14, 21].map((days, seq) => ({
      seq,
      due_at: new Date(Date.parse(startedAt) + days * 86_400_000).toISOString(),
      amount: 5,
    })),
    total: 20,
  };

  const client = {
    rpc(this: unknown, name: string, args?: unknown) {
      lazyState.calls.push({ name, args, owner: this });
      if (name === "trial_offer_conditions") return Promise.resolve({ data: conditions, error: null });
      if (name === "trial_offer_release_schedule") return Promise.resolve({ data: schedule, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };

  return {
    get supabaseAdmin() {
      lazyState.resolutions += 1;
      return client;
    },
    createServerClient: vi.fn(),
  };
});

import {
  FORBIDDEN_PUBLIC_FIELDS,
  TRIAL_OFFER_RPC,
} from "@/lib/credit/trial-offer/offer-contract";
import {
  TrialOfferReadError,
  readCurrentTrialOffer,
  readTrialOfferConditions,
  readTrialOfferSchedule,
  type TrialOfferRpcClient,
} from "@/lib/credit/trial-offer/offer";

const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const STARTED_AT = "2026-10-20T00:00:00.000Z";
const PUBLISHED_AT = "2026-11-26T23:07:35.123456+00:00";

interface RpcCall {
  name: string;
  args: unknown;
  owner: unknown;
}

type RpcResponse = { data: unknown; error: unknown };

function createFakeClient(handlers: Record<string, RpcResponse>) {
  const calls: RpcCall[] = [];
  const fake = {
    rpc(this: unknown, name: string, args?: unknown) {
      calls.push({ name, args, owner: this });
      const response = handlers[name];
      if (!response) throw new Error(`unexpected rpc call: ${name}`);
      return Promise.resolve(response);
    },
  };

  return {
    client: fake as unknown as TrialOfferRpcClient,
    raw: fake,
    calls,
  };
}

function publicWeekly(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version_label: "v1",
    public_name: "Teste gratuito de 28 dias",
    duration_days: 28,
    max_total_credits: 20,
    release_frequency: "weekly",
    credits_per_release: 5,
    ...overrides,
  };
}

function conditionsWeekly(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    offer_key: "trial_28d_v1",
    version_id: VERSION_ID,
    version_label: "v1",
    public_name: "Teste gratuito de 28 dias",
    duration_days: 28,
    max_total_credits: 20,
    release_frequency: "weekly",
    credits_per_release: 5,
    published_at: PUBLISHED_AT,
    ...overrides,
  };
}

function scheduleFor(
  amounts: number[],
  options: {
    startDays?: number[];
    expiresAt?: string;
    total?: number;
    seqs?: number[];
  } = {},
): Record<string, unknown> {
  const days = options.startDays ?? amounts.map((_, index) => index * 7);
  return {
    expires_at: options.expiresAt ?? "2026-11-17T00:00:00.000Z",
    releases: amounts.map((amount, index) => ({
      seq: options.seqs?.[index] ?? index,
      due_at: new Date(Date.parse(STARTED_AT) + days[index] * 86_400_000).toISOString(),
      amount,
    })),
    total: options.total ?? amounts.reduce((sum, amount) => sum + amount, 0),
  };
}

async function captureError(run: () => Promise<unknown>): Promise<TrialOfferReadError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(TrialOfferReadError);
    return error as TrialOfferReadError;
  }
  throw new Error("expected TrialOfferReadError");
}

beforeEach(() => {
  lazyState.calls.length = 0;
});

describe("F63 offer-contract", () => {
  it("exposes the exact RPC names and forbidden public fields", () => {
    expect(TRIAL_OFFER_RPC).toEqual({
      conditions: "trial_offer_conditions",
      publicOffer: "trial_offer_public_offer",
      schedule: "trial_offer_release_schedule",
    });
    expect([...FORBIDDEN_PUBLIC_FIELDS]).toEqual([
      "id",
      "offer_key",
      "version_id",
      "published_by",
      "created_by",
      "publication_reason",
      "releases",
      "release_count",
    ]);
  });
});

describe("readCurrentTrialOffer", () => {
  it("maps a valid weekly public offer to exactly six camelCase fields", async () => {
    const fake = createFakeClient({
      trial_offer_public_offer: { data: publicWeekly(), error: null },
    });

    const offer = await readCurrentTrialOffer(fake.client);

    expect(offer).toEqual({
      versionLabel: "v1",
      publicName: "Teste gratuito de 28 dias",
      durationDays: 28,
      maxTotalCredits: 20,
      releaseFrequency: "weekly",
      creditsPerRelease: 5,
    });
    expect(Object.keys(offer)).toEqual([
      "versionLabel",
      "publicName",
      "durationDays",
      "maxTotalCredits",
      "releaseFrequency",
      "creditsPerRelease",
    ]);
    for (const key of Object.keys(offer)) {
      expect(key).not.toContain("_");
    }
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].name).toBe("trial_offer_public_offer");
    // RPC de projeção pública é chamada sem argumentos.
    expect(fake.calls[0].args).toBeUndefined();
  });

  it("accepts a once offer with null credits_per_release", async () => {
    const fake = createFakeClient({
      trial_offer_public_offer: {
        data: publicWeekly({ release_frequency: "once", credits_per_release: null }),
        error: null,
      },
    });

    const offer = await readCurrentTrialOffer(fake.client);

    expect(offer.releaseFrequency).toBe("once");
    expect(offer.creditsPerRelease).toBeNull();
  });

  it("rejects a once offer with numeric credits_per_release", async () => {
    const fake = createFakeClient({
      trial_offer_public_offer: {
        data: publicWeekly({ release_frequency: "once", credits_per_release: 5 }),
        error: null,
      },
    });

    const error = await captureError(() => readCurrentTrialOffer(fake.client));

    expect(error.code).toBe("invalid_field");
    expect(error.field).toBe("credits_per_release");
  });

  it.each([null, 0, -1, 21])(
    "rejects recurring credits_per_release=%s",
    async (credits) => {
      const fake = createFakeClient({
        trial_offer_public_offer: {
          data: publicWeekly({ credits_per_release: credits }),
          error: null,
        },
      });

      const error = await captureError(() => readCurrentTrialOffer(fake.client));

      expect(error.code).toBe("invalid_field");
      expect(error.field).toBe("credits_per_release");
    },
  );

  it.each(["id", "offer_key", "version_id", "release_count"])(
    "rejects a public payload carrying forbidden key %s, even when null",
    async (key) => {
      const fake = createFakeClient({
        trial_offer_public_offer: { data: publicWeekly({ [key]: null }), error: null },
      });

      const error = await captureError(() => readCurrentTrialOffer(fake.client));

      expect(error.code).toBe("invalid_payload");
      expect(error.field).toBe(key);
    },
  );

  it("rejects a null payload with a typed error instead of a raw exception", async () => {
    const fake = createFakeClient({
      trial_offer_public_offer: { data: null, error: null },
    });

    const error = await captureError(() => readCurrentTrialOffer(fake.client));

    expect(error.code).toBe("invalid_payload");
    expect(error.message).not.toContain("null");
  });
});

describe("readTrialOfferConditions", () => {
  it("maps the nine conditions fields and preserves publishedAt", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
    });

    const conditions = await readTrialOfferConditions(null, fake.client);

    expect(conditions).toEqual({
      offerKey: "trial_28d_v1",
      versionId: VERSION_ID,
      versionLabel: "v1",
      publicName: "Teste gratuito de 28 dias",
      durationDays: 28,
      maxTotalCredits: 20,
      releaseFrequency: "weekly",
      creditsPerRelease: 5,
      publishedAt: PUBLISHED_AT,
    });
    expect(Object.keys(conditions)).toHaveLength(9);
    // A chave é sempre enviada, inclusive quando null (vigente).
    expect(fake.calls[0].args).toEqual({ p_version_id: null });
  });

  it("rejects an invalid published_at", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: {
        data: conditionsWeekly({ published_at: "26/11/2026" }),
        error: null,
      },
    });

    const error = await captureError(() => readTrialOfferConditions(null, fake.client));

    expect(error.code).toBe("invalid_field");
    expect(error.field).toBe("published_at");
  });

  it("rejects a version_id different from the requested one", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: {
        data: conditionsWeekly({ version_id: OTHER_VERSION_ID }),
        error: null,
      },
    });

    const error = await captureError(() =>
      readTrialOfferConditions(VERSION_ID, fake.client),
    );

    expect(error.code).toBe("invalid_field");
    expect(error.field).toBe("version_id");
  });

  it("fails closed with rpc_error and preserves the cause", async () => {
    const rpcError = { message: "trial_offer_current_version_missing", code: "P0001" };
    const fake = createFakeClient({
      trial_offer_conditions: { data: null, error: rpcError },
    });

    const error = await captureError(() => readTrialOfferConditions(null, fake.client));

    expect(error.code).toBe("rpc_error");
    expect(error.cause).toBe(rpcError);
  });
});

describe("readTrialOfferSchedule", () => {
  it("calls conditions first and then schedule with exact args, returning total 20", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: { data: scheduleFor([5, 5, 5, 5]), error: null },
    });

    const schedule = await readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client);

    expect(fake.calls.map((call) => call.name)).toEqual([
      "trial_offer_conditions",
      "trial_offer_release_schedule",
    ]);
    expect(fake.calls[0].args).toEqual({ p_version_id: VERSION_ID });
    expect(fake.calls[1].args).toEqual({
      p_version_id: VERSION_ID,
      p_started_at: STARTED_AT,
    });
    expect(schedule.total).toBe(20);
    expect(schedule.releases).toHaveLength(4);
    expect(schedule.releases.map((release) => release.seq)).toEqual([0, 1, 2, 3]);
    expect(schedule.releases[0].dueAt).toBe(STARTED_AT);
    expect(schedule.expiresAt).toBe("2026-11-17T00:00:00.000Z");
  });

  it("accepts a 7/7/6 breakdown when the total is 20", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: { data: scheduleFor([7, 7, 6]), error: null },
    });

    const schedule = await readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client);

    expect(schedule.releases.map((release) => release.amount)).toEqual([7, 7, 6]);
    expect(schedule.total).toBe(20);
  });

  it("rejects a sum that differs from total as total_mismatch", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: {
        data: scheduleFor([5, 5, 5, 4], { total: 20 }),
        error: null,
      },
    });

    const error = await captureError(() =>
      readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client),
    );

    expect(error.code).toBe("total_mismatch");
  });

  it("rejects a total different from max_total_credits as total_mismatch", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: {
        data: scheduleFor([5, 5, 5], { total: 15 }),
        error: null,
      },
    });

    const error = await captureError(() =>
      readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client),
    );

    expect(error.code).toBe("total_mismatch");
  });

  it("rejects non-contiguous seq values", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: {
        data: scheduleFor([5, 5, 5, 5], { seqs: [0, 2, 3, 4] }),
        error: null,
      },
    });

    const error = await captureError(() =>
      readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client),
    );

    expect(error.code).toBe("non_contiguous_seq");
  });

  it("rejects a first release that is not at started_at", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: {
        data: scheduleFor([5, 5, 5, 5], { startDays: [1, 8, 15, 22] }),
        error: null,
      },
    });

    const error = await captureError(() =>
      readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client),
    );

    expect(error.code).toBe("invalid_field");
    expect(error.field).toBe("releases[0].due_at");
  });

  it("rejects a last release equal to expires_at", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: {
        data: scheduleFor([5, 5, 5, 5], {
          startDays: [0, 7, 14, 28],
          expiresAt: "2026-11-17T00:00:00.000Z",
        }),
        error: null,
      },
    });

    const error = await captureError(() =>
      readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client),
    );

    expect(error.code).toBe("invalid_field");
    expect(error.field).toBe("expires_at");
  });

  it("does not call schedule when conditions fails", async () => {
    const rpcError = { message: "trial_offer_version_not_published" };
    const fake = createFakeClient({
      trial_offer_conditions: { data: null, error: rpcError },
      trial_offer_release_schedule: { data: scheduleFor([5, 5, 5, 5]), error: null },
    });

    const error = await captureError(() =>
      readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client),
    );

    expect(error.code).toBe("rpc_error");
    expect(error.cause).toBe(rpcError);
    expect(fake.calls.map((call) => call.name)).toEqual(["trial_offer_conditions"]);
  });

  it("uses the three exact RPC names across all readers", async () => {
    const fake = createFakeClient({
      trial_offer_public_offer: { data: publicWeekly(), error: null },
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: { data: scheduleFor([5, 5, 5, 5]), error: null },
    });

    await readCurrentTrialOffer(fake.client);
    await readTrialOfferConditions(VERSION_ID, fake.client);
    await readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client);

    expect(fake.calls.map((call) => call.name)).toEqual([
      "trial_offer_public_offer",
      "trial_offer_conditions",
      "trial_offer_conditions",
      "trial_offer_release_schedule",
    ]);
  });

  it("records both RPCs on the same injected client object", async () => {
    const fake = createFakeClient({
      trial_offer_conditions: { data: conditionsWeekly(), error: null },
      trial_offer_release_schedule: { data: scheduleFor([5, 5, 5, 5]), error: null },
    });

    await readTrialOfferSchedule(VERSION_ID, STARTED_AT, fake.client);

    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0].owner).toBe(fake.raw);
    expect(fake.calls[1].owner).toBe(fake.raw);
    expect(fake.calls[0].owner).toBe(fake.calls[1].owner);
  });

  it("resolves the lazy client once and reuses it for both RPCs", async () => {
    // Nenhum cliente injetado: o módulo importa `@/lib/supabase/server`
    // dinamicamente e deve resolver `supabaseAdmin` uma única vez.
    const schedule = await readTrialOfferSchedule(VERSION_ID, STARTED_AT);

    expect(lazyState.resolutions).toBe(1);
    expect(lazyState.calls.map((call) => call.name)).toEqual([
      "trial_offer_conditions",
      "trial_offer_release_schedule",
    ]);
    expect(lazyState.calls[0].args).toEqual({ p_version_id: VERSION_ID });
    expect(lazyState.calls[1].args).toEqual({
      p_version_id: VERSION_ID,
      p_started_at: STARTED_AT,
    });
    expect(lazyState.calls[0].owner).toBe(lazyState.calls[1].owner);
    expect(lazyState.calls[0].owner).not.toBeNull();
    expect(schedule.total).toBe(20);

    // Uma segunda chamada sem cliente reutiliza o cache do módulo: nenhuma
    // nova resolução/import acontece.
    await readTrialOfferSchedule(VERSION_ID, STARTED_AT);
    expect(lazyState.resolutions).toBe(1);
  });
});

describe("no writes", () => {
  it("exposes no mutation methods on the accepted client shape", () => {
    const fake = createFakeClient({});
    const client = fake.raw as Record<string, unknown>;

    for (const method of ["from", "insert", "update", "delete", "upsert"]) {
      expect(method in client).toBe(false);
    }
  });

  it("contains no insert/update/delete/upsert call in offer.ts", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/credit/trial-offer/offer.ts"),
      "utf8",
    );

    for (const token of [".insert(", ".update(", ".delete(", ".upsert("]) {
      expect(source).not.toContain(token);
    }
    expect(source).not.toContain('from("');
  });
});
