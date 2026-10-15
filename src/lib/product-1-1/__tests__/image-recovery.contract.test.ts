// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

// ---------------------------------------------------------------------------
// F56.2b2b — Plano 02 / Task 2: contrato da ROTA AUTENTICADA
// (`src/app/api/campaign/[id]/image-recovery/route.ts`).
// Dublês CONTROLADOS de auth/ownership/getCampaign/não-ativação + serviço de
// recuperação SIMULADO. A rota NUNCA regenera nem declara `refunded`; apenas
// delega. Nenhuma chamada paga, nenhuma migration aplicada.
// ---------------------------------------------------------------------------

const routeHarness = vi.hoisted(() => {
  const state = {
    order: [] as string[],
    authUser: { userId: "user-1" } as unknown,
    authError: null as unknown,
    ownershipError: null as unknown,
    sameOriginThrows: false,
    campaign: null as unknown,
    flow: "new_flow" as string,
    authDecision: { allowed: true } as unknown,
    authThrows: false,
    operation: null as unknown,
    operationThrows: false,
    recoverResult: null as unknown,
    recoverError: null as unknown,
    recoverCalls: [] as Array<Record<string, unknown>>,
  };
  return { state };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: (): void => {
    routeHarness.state.order.push("sameOrigin");
    if (routeHarness.state.sameOriginThrows) throw new ForbiddenError("cross_origin");
  },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: async (): Promise<unknown> => {
    routeHarness.state.order.push("requireUser");
    if (routeHarness.state.authError) throw routeHarness.state.authError;
    return routeHarness.state.authUser;
  },
  requireUser: async (): Promise<unknown> => routeHarness.state.authUser,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: async (): Promise<unknown> => {
    routeHarness.state.order.push("ownership");
    if (routeHarness.state.ownershipError) throw routeHarness.state.ownershipError;
    return { id: "store-1", is_test_store: true };
  },
  getCurrentStore: async (): Promise<unknown> => ({ id: "store-1", is_test_store: true }),
}));

vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: async (): Promise<unknown> => {
    routeHarness.state.order.push("getCampaign");
    return routeHarness.state.campaign;
  },
}));

vi.mock("@/lib/campaign/new-flow-marker", () => ({
  classifyCampaignFlow: (): string => {
    routeHarness.state.order.push("classify");
    return routeHarness.state.flow;
  },
}));

vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: async (): Promise<unknown> => {
    routeHarness.state.order.push("authorization");
    if (routeHarness.state.authThrows) throw new Error("read_failure");
    return routeHarness.state.authDecision;
  },
}));

vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: (): unknown => ({
    requestedScope: "test_stores",
    expectedInstanceIdentity: "test-instance",
    expectedEnvironment: "isolated",
  }),
}));

vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    async getCampaignOperation(): Promise<unknown> {
      routeHarness.state.order.push("operation");
      if (routeHarness.state.operationThrows) {
        throw new Error("campaign_operation_read_failure");
      }
      return routeHarness.state.operation;
    }
  },
}));

vi.mock("@/lib/product-1-1/artifact/artifact-recovery", () => ({
  ProductOneToOneArtifactRecovery: class {
    async recoverDelivery(input: Record<string, unknown>): Promise<unknown> {
      routeHarness.state.order.push("recover");
      routeHarness.state.recoverCalls.push(input);
      if (routeHarness.state.recoverError) throw routeHarness.state.recoverError;
      return routeHarness.state.recoverResult;
    }
  },
}));

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const DIVERGENT_OPERATION_ID = "99999999-9999-4999-8999-999999999999";
const ROUTE_FILE = "src/app/api/campaign/[id]/image-recovery/route.ts";

function newFlowCampaign() {
  return {
    id: CAMPAIGN_ID,
    store_id: "11111111-1111-4111-8111-111111111111",
    product_name: "Produto Teste",
    input_snapshot: { frozenContentReferences: [] },
  };
}

function persistedOperation() {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    status: "art_uploaded",
    terminal: false,
    unknown: false,
  };
}

function deliveredResult() {
  return Object.freeze({
    outcome: "delivered",
    kind: "integral",
    status: "delivered",
    ref: { storagePath: "p", width: 1024, height: 1024, mimeType: "image/jpeg" },
  });
}

function resetHarness(): void {
  const s = routeHarness.state;
  s.order = [];
  s.authUser = { userId: "user-1" };
  s.authError = null;
  s.ownershipError = null;
  s.sameOriginThrows = false;
  s.campaign = newFlowCampaign();
  s.flow = "new_flow";
  s.authDecision = { allowed: true };
  s.authThrows = false;
  s.operation = persistedOperation();
  s.operationThrows = false;
  s.recoverResult = deliveredResult();
  s.recoverError = null;
  s.recoverCalls = [];
}

function postRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/campaign/${id}/image-recovery`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function getRequest(id: string): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/campaign/${id}/image-recovery`, { method: "GET" }),
  );
}

async function importRoute() {
  return import("@/app/api/campaign/[id]/image-recovery/route");
}

async function callPost(id: string, body: unknown) {
  const { POST } = await importRoute();
  return POST(postRequest(id, body), { params: Promise.resolve({ id }) });
}

async function callGet(id: string) {
  const { GET } = await importRoute();
  return GET(getRequest(id), { params: Promise.resolve({ id }) });
}

const validBody = () => ({ operationId: OPERATION_ID });

describe("F56.2b2b — rota image-recovery: fonte estática (sem regeneração/estorno)", () => {
  it("delega ao serviço de recuperação e NÃO regenera nem declara `refunded`", () => {
    const source = readFileSync(path.resolve(process.cwd(), ROUTE_FILE), "utf8");
    const active = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    expect(active).toMatch(/ProductOneToOneArtifactRecovery/);
    expect(active).toMatch(/recoverDelivery/);
    // NUNCA importa geração/provider/estorno/cliente de crédito (G-NA + D4).
    expect(active).not.toMatch(/storeArtifact|generation-orchestrator|credit-operation/);
    expect(active).not.toMatch(/refund|refunded/i);
    expect(active).toMatch(/export const GET/);
    expect(active).toMatch(/export const POST/);
    expect(active).toMatch(/runtime = "nodejs"/);
  });
});

describe("F56.2b2b — rota image-recovery: prelude auth/ownership SEM IA", () => {
  beforeEach(() => resetHarness());

  it("ordem do prelude: sameOrigin → requireApiUser → getCampaign → ownership → barreira → recover", async () => {
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(200);
    expect(routeHarness.state.order).toEqual([
      "sameOrigin",
      "requireUser",
      "getCampaign",
      "ownership",
      "classify",
      "operation",
      "authorization",
      "recover",
    ]);
  });

  it("SEM autenticação ⇒ 401 ANTES de qualquer recuperação", async () => {
    routeHarness.state.authError = new UnauthorizedError();
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(401);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });

  it("SEM ownership ⇒ 403 e ZERO recuperação", async () => {
    routeHarness.state.ownershipError = new ForbiddenError();
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(403);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
    // Ownership ANTES de qualquer leitura de operação/recuperação.
    expect(routeHarness.state.order).not.toContain("operation");
    expect(routeHarness.state.order).not.toContain("recover");
  });

  it("`id` não-UUID ⇒ 404; campanha ausente ⇒ 404 (sem IA)", async () => {
    const bad = await callPost("not-a-uuid", validBody());
    expect(bad.status).toBe(404);
    routeHarness.state.campaign = null;
    const missing = await callPost(CAMPAIGN_ID, validBody());
    expect(missing.status).toBe(404);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });

  it("CSRF: mesma origem exigida no POST (nega antes da recuperação)", async () => {
    routeHarness.state.sameOriginThrows = true;
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(403);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });
});

describe("F56.2b2b — rota image-recovery: barreira de não-ativação/identidade", () => {
  beforeEach(() => resetHarness());

  it("fluxo `legacy` ⇒ 403 SEM recuperação", async () => {
    routeHarness.state.flow = "legacy";
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(403);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });

  it("fluxo `indeterminate` ⇒ 409 (fail-closed) SEM recuperação", async () => {
    routeHarness.state.flow = "indeterminate";
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(409);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });

  it("autorização `off`/`read_failure` ⇒ 403 SEM recuperação", async () => {
    routeHarness.state.authDecision = { allowed: false, code: "flag_not_applicable_off" };
    const off = await callPost(CAMPAIGN_ID, validBody());
    expect(off.status).toBe(403);

    resetHarness();
    routeHarness.state.authThrows = true;
    const thrown = await callPost(CAMPAIGN_ID, validBody());
    expect(thrown.status).toBe(403);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });

  it("`operationId` divergente ⇒ 409 operation_identity_conflict SEM recuperação", async () => {
    const res = await callPost(CAMPAIGN_ID, { operationId: DIVERGENT_OPERATION_ID });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("operation_identity_conflict");
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });

  it("operação persistida ausente ⇒ 409 SEM recuperação", async () => {
    routeHarness.state.operation = null;
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(409);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });

  it("LEITURA da operação REJEITADA ⇒ 503 seguro (nunca ausência) ANTES de recuperar", async () => {
    routeHarness.state.operationThrows = true;
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("recovery_unavailable");
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });
});

describe("F56.2b2b — rota image-recovery: corpo inválido (.strict()) sem recuperação", () => {
  beforeEach(() => resetHarness());

  it("campo desconhecido / operationId ausente / não-UUID ⇒ 400 + fieldErrors", async () => {
    const invalidBodies: unknown[] = [
      { operationId: OPERATION_ID, extra: "nope" },
      {},
      { operationId: "not-a-uuid" },
    ];
    for (const body of invalidBodies) {
      const res = await callPost(CAMPAIGN_ID, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      const payload = (await res.json()) as {
        error?: { details?: Record<string, unknown> };
      };
      expect(payload.error?.details).toBeTruthy();
    }
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });
});

describe("F56.2b2b — rota image-recovery: delegação (lojista apenas solicita)", () => {
  beforeEach(() => resetHarness());

  it("POST válido ⇒ delega UMA vez com a identidade SERVER-SIDE e devolve o resultado", async () => {
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(200);
    expect(routeHarness.state.recoverCalls).toHaveLength(1);
    expect(routeHarness.state.recoverCalls[0]).toMatchObject({
      storeId: "11111111-1111-4111-8111-111111111111",
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    const body = (await res.json()) as { recovery?: { outcome?: string } };
    expect(body.recovery?.outcome).toBe("delivered");
  });

  it("falha do serviço ⇒ 503 seguro (sem 500 cru)", async () => {
    routeHarness.state.recoverError = new Error("storage_unavailable");
    const res = await callPost(CAMPAIGN_ID, validBody());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("recovery_unavailable");
  });
});

describe("F56.2b2b — rota image-recovery: GET query-only", () => {
  beforeEach(() => resetHarness());

  it("devolve a operação persistida VERBATIM e NÃO recupera/gera/cobra", async () => {
    const res = await callGet(CAMPAIGN_ID);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { operation?: { operationId?: string } };
    expect(body.operation?.operationId).toBe(OPERATION_ID);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
    // GET é somente consulta: não chama o serviço de recuperação.
    expect(routeHarness.state.order).not.toContain("recover");
  });

  it("operação ausente ⇒ 404; leitura rejeitada ⇒ 503 (nunca 200 vazio)", async () => {
    routeHarness.state.operation = null;
    const absent = await callGet(CAMPAIGN_ID);
    expect(absent.status).toBe(404);

    resetHarness();
    routeHarness.state.operationThrows = true;
    const thrown = await callGet(CAMPAIGN_ID);
    expect(thrown.status).toBe(503);
    expect(routeHarness.state.recoverCalls).toHaveLength(0);
  });
});
