// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  requireApiUser: vi.fn(),
  requireOwnership: vi.fn(),
  resolveAuthorization: vi.fn(),
  reserveCredit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: m.from, rpc: m.rpc },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: m.requireApiUser,
  requireUser: m.requireApiUser,
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: m.requireOwnership,
}));

vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: vi.fn(() => ({
    generationPaused: false,
    rateLimitEnabled: false,
    creditsChargingEnabled: false,
    copyDirectorEnabled: false,
  })),
}));

vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: vi.fn(function () {
    return {
      getBalance: vi.fn(),
      reserveCredit: m.reserveCredit,
      confirmCredit: vi.fn(),
      refundCredit: vi.fn(),
      getOriginDemoGrantTxId: vi.fn(),
      getBalanceBreakdown: vi.fn(),
    };
  }),
}));

vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isForceBriefVisionCheckEnabled: vi.fn(async () => false),
  isCampaignApprovalEnabled: vi.fn(async () => false),
  FeatureFlagService: vi.fn(),
}));

vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: m.resolveAuthorization,
}));

vi.mock("@/lib/legal/clearance", () => ({
  requireLegalClearance: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/economic/economic-parameter-service", () => ({
  EconomicParameterService: vi.fn(function () {
    return { getParameter: vi.fn().mockResolvedValue({ value: 1 }) };
  }),
}));

vi.mock("@/lib/logging/pipeline-logger", () => ({ logPipelineEvent: vi.fn() }));

const { MockAiCostTracker } = vi.hoisted(() => {
  class MockAiCostTracker {
    startRun() {
      return { operationRunId: "run-1", traceId: "trace-1" };
    }
    async record() {}
  }
  return { MockAiCostTracker };
});
vi.mock("@/lib/ai-cost", () => ({
  AiCostTracker: MockAiCostTracker,
  resolveAiCost: vi.fn(),
  estimateAiCost: vi.fn(),
}));

import { StoreNotFoundError } from "@/lib/auth/errors";
import { assertSubmissionEligible } from "../submission/assert-submission-eligible";
import {
  detectExclusiveNewFlowFields,
  EXCLUSIVE_NEW_FLOW_FIELDS,
} from "../submission/exclusive-fields";
import { resolveEligibilityContext } from "../submission/eligibility-context";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function post(body: unknown) {
  return import("@/app/api/campaign/generate-image/route").then(({ POST }) =>
    POST(
      new NextRequest(
        new Request("http://localhost/api/campaign/generate-image", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  m.requireApiUser.mockResolvedValue({ userId: "user-1" });
  m.requireOwnership.mockResolvedValue({ is_test_store: false });
  m.resolveAuthorization.mockResolvedValue({
    allowed: false,
    code: "flag_not_applicable_off",
  });
});

describe("F56.2b1a — detector de campos exclusivos do novo fluxo", () => {
  it("detecta `backgroundDirection` e NÃO trata `campaignIntent` como exclusivo", () => {
    expect(detectExclusiveNewFlowFields({ backgroundDirection: "gradient" })).toEqual([
      "backgroundDirection",
    ]);
    expect(detectExclusiveNewFlowFields({ campaignIntent: "exclusive" })).toEqual([]);
    expect(detectExclusiveNewFlowFields({})).toEqual([]);
    expect(detectExclusiveNewFlowFields(null)).toEqual([]);
    expect(detectExclusiveNewFlowFields("x")).toEqual([]);
    expect(EXCLUSIVE_NEW_FLOW_FIELDS).toEqual(["backgroundDirection"]);
  });
});

describe("F56.2b1a — assertSubmissionEligible (puro)", () => {
  it("corpo legado → not_new_flow; elegível → allowed; inelegível → refused (sem tocar o corpo)", () => {
    const legacy = { productName: "X", campaignIntent: "offer" };
    expect(assertSubmissionEligible(legacy, { allowed: true, stage: "all_stores", usedGeneralPrecedence: false })).toEqual(
      { kind: "not_new_flow" },
    );

    const body = { backgroundDirection: "gradient" };
    expect(
      assertSubmissionEligible(body, { allowed: true, stage: "all_stores", usedGeneralPrecedence: false }),
    ).toEqual({ kind: "allowed", fields: ["backgroundDirection"] });

    expect(assertSubmissionEligible(body, { allowed: false, code: "flag_not_applicable_off" })).toEqual({
      kind: "refused",
      code: "new_flow_ineligible",
      fields: ["backgroundDirection"],
    });
    // O guard é puro: não remove/reinterpreta o campo exclusivo.
    expect(body).toEqual({ backgroundDirection: "gradient" });
  });
});

describe("F56.2b1a — contexto de elegibilidade derivado server-side", () => {
  it("escopo vem de is_test_store; instância/ambiente da configuração server-side", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:56321";
    expect(resolveEligibilityContext({ is_test_store: true })).toEqual({
      requestedScope: "test_stores",
      expectedInstanceIdentity: "127.0.0.1:56321",
      expectedEnvironment: "isolated",
    });

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(resolveEligibilityContext({ is_test_store: false })).toEqual({
      requestedScope: "all_stores",
      expectedInstanceIdentity: "example.supabase.co",
      expectedEnvironment: "operational",
    });
  });

  it("ausência de configuração lança (fail-closed)", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    expect(() => resolveEligibilityContext({ is_test_store: false })).toThrow();
    if (ORIGINAL_URL) process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  });
});

describe("F56.2b1a — guard conectado ao handler (ordem e fail-closed)", () => {
  it("payload legado NÃO faz consultas de autorização nem reserva", async () => {
    const res = await post({ storeId: STORE_ID, productImageDataUrl: "x" });
    // Falha no safeParse legado (sem productName) → 400, sem consultas novas.
    expect(res.status).toBe(400);
    expect(m.resolveAuthorization).not.toHaveBeenCalled();
    expect(m.reserveCredit).not.toHaveBeenCalled();
  });

  it("campos exclusivos sem elegibilidade são recusados antes da reserva", async () => {
    const res = await post({
      storeId: STORE_ID,
      productImageDataUrl: "x",
      backgroundDirection: "gradient",
    });

    expect(res.status).toBe(403);
    const bodyResponse = await res.json();
    expect(bodyResponse.error.code).toBe("new_flow_ineligible");
    expect(bodyResponse.error.fields).toEqual(["backgroundDirection"]);
    expect(m.resolveAuthorization).toHaveBeenCalledTimes(1);
    expect(m.reserveCredit).not.toHaveBeenCalled();
    expect(m.requireOwnership).toHaveBeenCalledWith(STORE_ID, "user-1");
  });

  it("loja alheia é rejeitada antes de consultar a autorização", async () => {
    m.requireOwnership.mockRejectedValueOnce(new StoreNotFoundError("não pertence"));

    const res = await post({
      storeId: STORE_ID,
      productImageDataUrl: "x",
      backgroundDirection: "gradient",
    });

    expect(res.status).toBe(404);
    expect(m.resolveAuthorization).not.toHaveBeenCalled();
  });

  it("tentativa de forjar escopo/ambiente é ignorada (derivação server-side)", async () => {
    const res = await post({
      storeId: STORE_ID,
      productImageDataUrl: "x",
      backgroundDirection: "gradient",
      scope: "test_stores",
      environment: "isolated",
      instanceIdentity: "forged-instance",
    });

    expect(res.status).toBe(403);
    expect(m.resolveAuthorization).toHaveBeenCalledWith({
      requestedScope: "all_stores",
      expectedInstanceIdentity: "example.supabase.co",
      expectedEnvironment: "operational",
    });
    const calledWith = m.resolveAuthorization.mock.calls[0][0];
    expect(calledWith.instanceIdentity).toBeUndefined();
    expect(calledWith.expectedInstanceIdentity).not.toBe("forged-instance");
  });

  it("falha de leitura da autorização é negada (fail-closed)", async () => {
    m.resolveAuthorization.mockRejectedValueOnce(new Error("db down"));

    const res = await post({
      storeId: STORE_ID,
      productImageDataUrl: "x",
      backgroundDirection: "gradient",
    });

    expect(res.status).toBe(403);
    expect(m.reserveCredit).not.toHaveBeenCalled();
  });

  it("storeId ausente/inválido com campo exclusivo → 400 identificável, sem consultas", async () => {
    const res = await post({ productImageDataUrl: "x", backgroundDirection: "gradient" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("new_flow_ineligible");
    expect(m.resolveAuthorization).not.toHaveBeenCalled();
  });
});
