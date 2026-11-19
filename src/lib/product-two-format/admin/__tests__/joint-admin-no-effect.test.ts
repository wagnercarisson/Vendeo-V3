// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { resolveJointPending } from "../../orchestration/resolve-joint-pending";
import { readJointResolutionState } from "../joint-admin-deps";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const CONTROL = "33333333-3333-4333-8333-333333333333";
const SQUARE = "44444444-4444-4444-8444-444444444444";

type TableResponse = { data: unknown; error: unknown };

function validResponses(): Record<string, TableResponse> {
  return {
    campaigns: { data: { store_id: STORE }, error: null },
    product_two_format_deliveries: {
      data: [
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
      error: null,
    },
    product_1_1_campaign_credit_operations: {
      data: [
        { operation_id: CONTROL, store_id: STORE, status: "delivered" },
        { operation_id: SQUARE, store_id: STORE, status: "reserved" },
      ],
      error: null,
    },
    product_generation_operation_outcomes_v: {
      data: [
        { operation_id: CONTROL, outcome: "failed" },
        { operation_id: SQUARE, outcome: "failed" },
      ],
      error: null,
    },
    product_generation_active_claims_v: { data: [], error: null },
    admin_audit_log: { data: null, error: null },
  };
}

function fakeClient(responses: Record<string, TableResponse>) {
  return {
    from(table: string) {
      const query: Record<string, unknown> = {};
      const result = responses[table] ?? { data: [], error: null };
      query.select = () => query;
      query.eq = () => query;
      query.in = () => query;
      query.maybeSingle = async () => result;
      query.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result).then(resolve);
      return query;
    },
  };
}

function foundView() {
  return {
    origin: "two_format_two_stage" as const,
    campaignId: CAMPAIGN,
    operationId: CONTROL,
    square: {
      format: "1:1" as const,
      state: "delivered" as const,
      creditRefunded: false,
      deliveryOperationId: SQUARE,
      artifactRole: "square_original" as const,
      artifactPath: `${STORE}/${CAMPAIGN}/${CONTROL}/square_original.jpg`,
      supportReference: null,
    },
    vertical: {
      format: "9:16" as const,
      state: "delivered" as const,
      creditRefunded: false,
      deliveryOperationId: CONTROL,
      artifactRole: "vertical" as const,
      artifactPath: `${STORE}/${CAMPAIGN}/${CONTROL}/vertical.jpg`,
      supportReference: null,
    },
    preferredThumbnail: null,
  };
}

function depsFor(responses: Record<string, TableResponse>) {
  const effect = vi.fn(async () => {
    throw new Error("effect must not run on malformed read");
  });
  return {
    readDelivery: vi.fn(async () => ({ kind: "found" as const, view: foundView() })),
    readResolutionState: (input: {
      campaignId: string;
      operationId: string;
      deliveryOperationId: string;
    }) =>
      readJointResolutionState(
        fakeClient(responses) as never,
        input,
      ),
    probeSquare: effect,
    probeVertical: effect,
    beginPublication: effect,
    abortPublication: effect,
    getPublicationEpoch: effect,
    recordFormatOutcome: effect,
    deliverFormat: effect,
    refundFormat: effect,
    writeAudit: effect,
    readAuditByOperationId: effect,
  };
}

describe("F60.7 C4-O — leituras malformadas não autorizam efeito", () => {
  const invalidCases: Array<[string, (r: Record<string, TableResponse>) => void]> = [
    ["outcomes nulos", (r) => { r.product_generation_operation_outcomes_v = { data: null, error: null }; }],
    ["outcomes duplicados", (r) => {
      r.product_generation_operation_outcomes_v = {
        data: [
          { operation_id: CONTROL, outcome: "failed" },
          { operation_id: CONTROL, outcome: "unknown" },
          { operation_id: SQUARE, outcome: "failed" },
        ],
        error: null,
      };
    }],
    ["crédito sem loja", (r) => {
      r.product_1_1_campaign_credit_operations = {
        data: [
          { operation_id: CONTROL, status: "delivered" },
          { operation_id: SQUARE, status: "reserved" },
        ],
        error: null,
      };
    }],
    ["crédito de outra loja", (r) => {
      r.product_1_1_campaign_credit_operations = {
        data: [
          { operation_id: CONTROL, store_id: "other", status: "delivered" },
          { operation_id: SQUARE, store_id: STORE, status: "reserved" },
        ],
        error: null,
      };
    }],
    ["crédito duplicado", (r) => {
      r.product_1_1_campaign_credit_operations = {
        data: [
          { operation_id: CONTROL, store_id: STORE, status: "delivered" },
          { operation_id: SQUARE, store_id: STORE, status: "reserved" },
          { operation_id: SQUARE, store_id: STORE, status: "delivered" },
        ],
        error: null,
      };
    }],
    ["claims nulos", (r) => { r.product_generation_active_claims_v = { data: null, error: null }; }],
    ["vínculos nulos", (r) => { r.product_two_format_deliveries = { data: null, error: null }; }],
  ];

  for (const [name, mutate] of invalidCases) {
    for (const action of ["deliver", "refund"] as const) {
      it(`${name} (${action}) ⇒ serviço indisponível e zero efeito`, async () => {
        const responses = validResponses();
        mutate(responses);
        const deps = depsFor(responses);

        const outcome = await resolveJointPending(
          {
            actorId: "admin-1",
            campaignId: CAMPAIGN,
            operationId: CONTROL,
            format: "1:1",
            action,
            reason: "teste negativo",
          },
          deps,
        );

        expect(outcome).toEqual({ kind: "unavailable", reason: "read_failed" });
        expect(deps.beginPublication).not.toHaveBeenCalled();
        expect(deps.abortPublication).not.toHaveBeenCalled();
        expect(deps.getPublicationEpoch).not.toHaveBeenCalled();
        expect(deps.recordFormatOutcome).not.toHaveBeenCalled();
        expect(deps.deliverFormat).not.toHaveBeenCalled();
        expect(deps.refundFormat).not.toHaveBeenCalled();
        expect(deps.probeSquare).not.toHaveBeenCalled();
        expect(deps.probeVertical).not.toHaveBeenCalled();
        expect(deps.writeAudit).not.toHaveBeenCalled();
        expect(deps.readAuditByOperationId).not.toHaveBeenCalled();
      });
    }
  }
});
