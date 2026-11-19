// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  createJointAdminDeps,
  readJointResolutionState,
} from "../joint-admin-deps";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const CONTROL = "33333333-3333-4333-8333-333333333333";
const SQUARE = "44444444-4444-4444-8444-444444444444";

interface Fixture {
  campaign?: { store_id: string } | null;
  links?: Array<Record<string, unknown>>;
  credits?: Array<Record<string, unknown>>;
  outcomes?: Array<Record<string, unknown>>;
  claims?: Array<Record<string, unknown>>;
  errorTable?: string;
  responses?: Partial<Record<string, { data: unknown; error: unknown }>>;
}

function client(fixture: Fixture) {
  return {
    from(table: string) {
      const query: Record<string, unknown> = {};
      const result = () => {
        const overridden = fixture.responses?.[table];
        if (overridden) return overridden;
        if (fixture.errorTable === table) {
          return { data: null, error: { message: `${table}_failed` } };
        }
        if (table === "campaigns") {
          return { data: fixture.campaign ?? null, error: null };
        }
        if (table === "product_two_format_deliveries") {
          return { data: fixture.links ?? [], error: null };
        }
        if (table === "product_1_1_campaign_credit_operations") {
          return { data: fixture.credits ?? [], error: null };
        }
        if (table === "product_generation_operation_outcomes_v") {
          return { data: fixture.outcomes ?? [], error: null };
        }
        if (table === "product_generation_active_claims_v") {
          return { data: fixture.claims ?? [], error: null };
        }
        if (table === "admin_audit_log") {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      };
      query.select = () => query;
      query.eq = () => query;
      query.in = () => query;
      query.maybeSingle = async () => result();
      query.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve);
      return query;
    },
  };
}

function baseFixture(): Fixture {
  return {
    campaign: { store_id: STORE },
    links: [
      {
        campaign_id: CAMPAIGN,
        operation_id: CONTROL,
        store_id: STORE,
        format: "1:1",
        delivery_operation_id: SQUARE,
        artifact_role: "square_original",
      },
      {
        campaign_id: CAMPAIGN,
        operation_id: CONTROL,
        store_id: STORE,
        format: "9:16",
        delivery_operation_id: CONTROL,
        artifact_role: "vertical",
      },
    ],
    credits: [
      { operation_id: CONTROL, store_id: STORE, status: "delivered" },
      { operation_id: SQUARE, store_id: STORE, status: "reserved" },
    ],
    outcomes: [
      { operation_id: CONTROL, outcome: "failed" },
      { operation_id: SQUARE, outcome: "failed" },
    ],
    claims: [],
  };
}

const input = {
  campaignId: CAMPAIGN,
  operationId: CONTROL,
  deliveryOperationId: SQUARE,
};

describe("F60.7 C4 — leitor de resolução conjunta", () => {
  it("lê estado completo, terminais e outcomes pela identidade direta", async () => {
    const result = await readJointResolutionState(
      client(baseFixture()) as never,
      input,
    );
    expect(result).toEqual({
      kind: "found",
      state: {
        storeId: STORE,
        creditStatus: "reserved",
        outcomeKind: "failed",
        sharedOutcomeKind: "failed",
        sharedCreditStatus: "delivered",
        activeClaim: false,
        linkComplete: true,
      },
    });

    const terminal = baseFixture();
    terminal.credits = [
      { operation_id: CONTROL, store_id: STORE, status: "refunded" },
      { operation_id: SQUARE, store_id: STORE, status: "refunded" },
    ];
    const refunded = await readJointResolutionState(
      client(terminal) as never,
      input,
    );
    expect(refunded).toMatchObject({
      kind: "found",
      state: {
        creditStatus: "refunded",
        sharedCreditStatus: "refunded",
        linkComplete: true,
      },
    });
  });

  it("preserva indeterminação do outcome e claim ativo", async () => {
    const fixture = baseFixture();
    fixture.outcomes = [
      { operation_id: CONTROL, outcome: "unknown" },
      { operation_id: SQUARE, outcome: "other" },
    ];
    fixture.claims = [{ operation_id: CONTROL }];

    const result = await readJointResolutionState(
      client(fixture) as never,
      input,
    );
    expect(result).toMatchObject({
      kind: "found",
      state: {
        outcomeKind: "indeterminate",
        sharedOutcomeKind: "unknown",
        activeClaim: true,
      },
    });
  });

  it("par incompleto falha em linkComplete, sem inventar estado", async () => {
    const fixture = baseFixture();
    fixture.links = fixture.links?.slice(0, 1);

    const result = await readJointResolutionState(
      client(fixture) as never,
      input,
    );
    expect(result).toMatchObject({
      kind: "found",
      state: { linkComplete: false },
    });
  });

  it("falha de leitura é fail-closed", async () => {
    const fixture = baseFixture();
    fixture.errorTable = "product_1_1_campaign_credit_operations";
    await expect(
      readJointResolutionState(client(fixture) as never, input),
    ).resolves.toEqual({
      kind: "read_failed",
      reason: "product_1_1_campaign_credit_operations_failed",
    });

    fixture.errorTable = "product_generation_operation_outcomes_v";
    await expect(
      readJointResolutionState(client(fixture) as never, input),
    ).resolves.toMatchObject({ kind: "read_failed" });
  });

  it("resposta malformada nunca vira ausência nem autoriza", async () => {
    const cases: Array<[string, unknown, string]> = [
      ["product_generation_operation_outcomes_v", null, "outcomes_malformed"],
      ["product_generation_active_claims_v", {}, "claims_malformed"],
      ["product_two_format_deliveries", null, "links_malformed"],
    ];
    for (const [table, data, reason] of cases) {
      const fixture = baseFixture();
      fixture.responses = { [table]: { data, error: null } };
      await expect(
        readJointResolutionState(client(fixture) as never, input),
      ).resolves.toEqual({ kind: "read_failed", reason });
    }
  });

  it("cardinalidade/duplicidade de outcomes e vínculos bloqueiam", async () => {
    const outcomes = baseFixture();
    outcomes.outcomes = [
      { operation_id: CONTROL, outcome: "failed" },
      { operation_id: CONTROL, outcome: "unknown" },
      { operation_id: SQUARE, outcome: "failed" },
    ];
    await expect(
      readJointResolutionState(client(outcomes) as never, input),
    ).resolves.toEqual({ kind: "read_failed", reason: "outcomes_duplicate" });

    const links = baseFixture();
    links.links = [
      ...(links.links ?? []),
      {
        campaign_id: CAMPAIGN,
        operation_id: CONTROL,
        store_id: STORE,
        format: "1:1",
        delivery_operation_id: SQUARE,
        artifact_role: "square_original",
      },
    ];
    await expect(
      readJointResolutionState(client(links) as never, input),
    ).resolves.toEqual({ kind: "read_failed", reason: "links_cardinality" });
  });

  it("identidade dos créditos (loja, ausência, duplicidade) é validada", async () => {
    const missingStore = baseFixture();
    missingStore.credits = [
      { operation_id: CONTROL, status: "delivered" },
      { operation_id: SQUARE, status: "reserved" },
    ];
    await expect(
      readJointResolutionState(client(missingStore) as never, input),
    ).resolves.toEqual({ kind: "read_failed", reason: "credits_malformed" });

    const wrongStore = baseFixture();
    wrongStore.credits = [
      { operation_id: CONTROL, store_id: "other", status: "delivered" },
      { operation_id: SQUARE, store_id: STORE, status: "reserved" },
    ];
    await expect(
      readJointResolutionState(client(wrongStore) as never, input),
    ).resolves.toEqual({ kind: "read_failed", reason: "credits_identity" });

    const duplicate = baseFixture();
    duplicate.credits = [
      ...(duplicate.credits ?? []),
      { operation_id: SQUARE, store_id: STORE, status: "delivered" },
    ];
    await expect(
      readJointResolutionState(client(duplicate) as never, input),
    ).resolves.toEqual({ kind: "read_failed", reason: "credits_duplicate" });

    const missingSibling = baseFixture();
    missingSibling.credits = [
      { operation_id: SQUARE, store_id: STORE, status: "reserved" },
    ];
    await expect(
      readJointResolutionState(client(missingSibling) as never, input),
    ).resolves.toEqual({ kind: "read_failed", reason: "credit_operation_missing" });

    const missingSquareForVertical = baseFixture();
    missingSquareForVertical.credits = [
      { operation_id: CONTROL, store_id: STORE, status: "delivered" },
    ];
    await expect(
      readJointResolutionState(client(missingSquareForVertical) as never, {
        ...input,
        deliveryOperationId: CONTROL,
      }),
    ).resolves.toEqual({ kind: "read_failed", reason: "credit_operation_missing" });
  });

  it("composição expõe todas as portas de resolveJointPending", () => {
    const deps = createJointAdminDeps({ client: client(baseFixture()) as never });
    expect(Object.keys(deps).sort()).toEqual(
      [
        "abortPublication",
        "beginPublication",
        "deliverFormat",
        "getPublicationEpoch",
        "probeSquare",
        "probeVertical",
        "readAuditByOperationId",
        "readDelivery",
        "readResolutionState",
        "recordFormatOutcome",
        "refundFormat",
        "writeAudit",
      ].sort(),
    );
  });
});
