// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { ForbiddenError } from "@/lib/auth/errors";
import type { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import {
  decideProductFlowAuthorization,
  type AuthorizationFlagsRead,
} from "../authorization/authorization-decision";
import { deriveCurrentAuthorization } from "../authorization/derive";
import { resolveProductFlowAuthorization } from "../authorization/authorization-service";
import type { StageAuthorizationRepository } from "../authorization/stage-authorization-repository";
import type {
  CurrentStageAuthorization,
  ProductFlowScope,
  StageAuthorizationEvent,
} from "../authorization/types";

const INSTANCE = "vendeo-f562a-isolated";
const OPERATION_ID = "00000000-0000-4000-8000-000000000001";
const ROUTE_RELATIVE_PATH = "src/app/api/admin/product-flow-authorizations/route.ts";

function flags(over: Partial<AuthorizationFlagsRead> = {}): AuthorizationFlagsRead {
  return {
    testStoresEnabled: false,
    allStoresEnabled: false,
    testStoresStatus: "valid",
    allStoresStatus: "valid",
    ...over,
  };
}

function authz(over: Partial<CurrentStageAuthorization> = {}): CurrentStageAuthorization {
  return {
    stage: "all_stores",
    scope: "all_stores",
    instanceIdentity: INSTANCE,
    expiresAtMs: null,
    revokedAtMs: null,
    ...over,
  };
}

function event(over: Partial<StageAuthorizationEvent> = {}): StageAuthorizationEvent {
  return {
    eventType: "granted",
    stage: "all_stores",
    scope: "all_stores",
    instanceIdentity: INSTANCE,
    grantedBy: "admin-1",
    reason: "r",
    operationId: OPERATION_ID,
    expiresAtMs: null,
    createdAtMs: 1,
    ...over,
  };
}

function postStage(body: unknown) {
  return import("@/app/api/admin/product-flow-authorizations/route").then(({ POST }) =>
    POST(
      new NextRequest(
        new Request("http://localhost/api/admin/product-flow-authorizations", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

function getStage() {
  return import("@/app/api/admin/product-flow-authorizations/route").then(({ GET }) =>
    GET(
      new NextRequest(
        new Request(
          `http://localhost/api/admin/product-flow-authorizations?scope=all_stores&instanceIdentity=${INSTANCE}`,
        ),
      ),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("F56.2b1a — decisão pura de autorização (fail-closed)", () => {
  const scope: ProductFlowScope = "all_stores";

  it("exige a flag aplicável ao escopo; a flag de teste não habilita o escopo geral", () => {
    expect(
      decideProductFlowAuthorization({
        nowMs: 0,
        requestedScope: "all_stores",
        expectedInstanceIdentity: INSTANCE,
        authorization: authz({ scope: "all_stores", stage: "all_stores" }),
        flags: flags({ testStoresEnabled: true, allStoresEnabled: false }),
      }),
    ).toEqual({ allowed: false, code: "flag_not_applicable_off" });
  });

  it("a flag geral prevalece sem eliminar a autorização (D-03)", () => {
    const decision = decideProductFlowAuthorization({
      nowMs: 0,
      requestedScope: "test_stores",
      expectedInstanceIdentity: INSTANCE,
      authorization: authz({ scope: "test_stores", stage: "test_stores" }),
      flags: flags({ testStoresEnabled: false, allStoresEnabled: true }),
    });
    expect(decision).toEqual({
      allowed: true,
      stage: "test_stores",
      usedGeneralPrecedence: true,
    });
  });

  it("flag de teste ligada habilita o escopo de teste", () => {
    expect(
      decideProductFlowAuthorization({
        nowMs: 0,
        requestedScope: "test_stores",
        expectedInstanceIdentity: INSTANCE,
        authorization: authz({ scope: "test_stores", stage: "test_stores" }),
        flags: flags({ testStoresEnabled: true, allStoresEnabled: false }),
      }),
    ).toEqual({ allowed: true, stage: "test_stores", usedGeneralPrecedence: false });
  });

  it("leitura parcial (status não válido) falha fechada", () => {
    expect(
      decideProductFlowAuthorization({
        nowMs: 0,
        requestedScope: scope,
        expectedInstanceIdentity: INSTANCE,
        authorization: authz(),
        flags: flags({ allStoresStatus: "missing" }),
      }),
    ).toEqual({ allowed: false, code: "flags_unavailable" });
  });

  it("sem autorização → missing_authorization", () => {
    expect(
      decideProductFlowAuthorization({
        nowMs: 0,
        requestedScope: scope,
        expectedInstanceIdentity: INSTANCE,
        authorization: null,
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "missing_authorization" });
  });

  it("estado operacional off nunca habilita (stage_not_enabling)", () => {
    expect(
      decideProductFlowAuthorization({
        nowMs: 0,
        requestedScope: scope,
        expectedInstanceIdentity: INSTANCE,
        authorization: authz({ stage: "off" }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "stage_not_enabling" });
  });

  it("mismatch de instância e de escopo negam", () => {
    expect(
      decideProductFlowAuthorization({
        nowMs: 0,
        requestedScope: scope,
        expectedInstanceIdentity: INSTANCE,
        authorization: authz({ instanceIdentity: "outra-instancia" }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "instance_mismatch" });

    expect(
      decideProductFlowAuthorization({
        nowMs: 0,
        requestedScope: "test_stores",
        expectedInstanceIdentity: INSTANCE,
        authorization: authz({ scope: "all_stores" }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "scope_mismatch" });
  });

  it("expiração e revogação negam", () => {
    expect(
      decideProductFlowAuthorization({
        nowMs: 100,
        requestedScope: scope,
        expectedInstanceIdentity: INSTANCE,
        authorization: authz({ expiresAtMs: 100 }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "expired" });

    expect(
      decideProductFlowAuthorization({
        nowMs: 0,
        requestedScope: scope,
        expectedInstanceIdentity: INSTANCE,
        authorization: authz({ revokedAtMs: 5 }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "revoked" });
  });

  it("nenhum parâmetro extra do cliente força a autorização", () => {
    const input = {
      nowMs: 0,
      requestedScope: scope,
      expectedInstanceIdentity: INSTANCE,
      authorization: authz({ stage: "off" }),
      flags: flags({ allStoresEnabled: false }),
      clientRequestedAllow: true,
    } as Parameters<typeof decideProductFlowAuthorization>[0];
    expect(decideProductFlowAuthorization(input)).toEqual({
      allowed: false,
      code: "stage_not_enabling",
    });
  });
});

describe("F56.2b1a — derivação do histórico append-only", () => {
  it("granted habilita; revoked retorna a off", () => {
    const current = deriveCurrentAuthorization(
      [
        event({ eventType: "granted", stage: "all_stores", createdAtMs: 1 }),
        event({ eventType: "revoked", stage: "off", createdAtMs: 2 }),
      ],
      "all_stores",
      INSTANCE,
    );
    expect(current).toEqual({
      stage: "off",
      scope: "all_stores",
      instanceIdentity: INSTANCE,
      expiresAtMs: null,
      revokedAtMs: 2,
    });
  });

  it("eventos refused não alteram o estado e o histórico é filtrado por escopo/instância", () => {
    const current = deriveCurrentAuthorization(
      [
        event({ eventType: "granted", scope: "all_stores", createdAtMs: 1 }),
        event({ eventType: "refused", stage: "all_stores", createdAtMs: 2 }),
        event({ eventType: "granted", scope: "test_stores", createdAtMs: 3 }),
        event({ eventType: "granted", instanceIdentity: "outra", createdAtMs: 4 }),
      ],
      "all_stores",
      INSTANCE,
    );
    expect(current).toMatchObject({ stage: "all_stores", scope: "all_stores" });
  });
});

describe("F56.2b1a — serviço server-side fail-closed", () => {
  const flagsStub = { readProductOneToOneFlags: vi.fn() } as unknown as FeatureFlagService;
  const repoStub = { listEvents: vi.fn() } as unknown as StageAuthorizationRepository;

  it("combina flags e histórico válidos", async () => {
    (flagsStub.readProductOneToOneFlags as ReturnType<typeof vi.fn>).mockResolvedValue(
      flags({ allStoresEnabled: true }),
    );
    (repoStub.listEvents as ReturnType<typeof vi.fn>).mockResolvedValue([
      event({ eventType: "granted", stage: "all_stores", createdAtMs: 1 }),
    ]);

    await expect(
      resolveProductFlowAuthorization(
        { requestedScope: "all_stores", expectedInstanceIdentity: INSTANCE, nowMs: 10 },
        flagsStub,
        repoStub,
      ),
    ).resolves.toEqual({ allowed: true, stage: "all_stores", usedGeneralPrecedence: false });
  });

  it("erro na leitura do histórico falha fechada (read_failure)", async () => {
    (flagsStub.readProductOneToOneFlags as ReturnType<typeof vi.fn>).mockResolvedValue(
      flags({ allStoresEnabled: true }),
    );
    (repoStub.listEvents as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));

    await expect(
      resolveProductFlowAuthorization(
        { requestedScope: "all_stores", expectedInstanceIdentity: INSTANCE },
        flagsStub,
        repoStub,
      ),
    ).resolves.toEqual({ allowed: false, code: "read_failure" });
  });

  it("erro na leitura das flags falha fechada (read_failure)", async () => {
    (flagsStub.readProductOneToOneFlags as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("flags down"),
    );
    (repoStub.listEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(
      resolveProductFlowAuthorization(
        { requestedScope: "all_stores", expectedInstanceIdentity: INSTANCE },
        flagsStub,
        repoStub,
      ),
    ).resolves.toEqual({ allowed: false, code: "read_failure" });
  });
});

describe("F56.2b1a — API admin de autorização (superfície)", () => {
  it("exige requireAdmin", async () => {
    mockRequireAdmin.mockRejectedValueOnce(
      new ForbiddenError("Acesso restrito a administradores"),
    );
    const res = await postStage({
      stage: "all_stores",
      scope: "all_stores",
      instanceIdentity: INSTANCE,
      reason: "x",
      operationId: OPERATION_ID,
    });
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("recusa concessão de estágio habilitador com 403 e audita via RPC", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: false, refused: true, stage: "all_stores" },
      error: null,
    });

    const res = await postStage({
      stage: "all_stores",
      scope: "all_stores",
      instanceIdentity: INSTANCE,
      reason: "tentativa de ativação",
      operationId: OPERATION_ID,
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.refused).toBe(true);
    expect(body.granted).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith("admin_grant_product_flow_stage_authorization", {
      p_actor_id: "admin-1",
      p_stage: "all_stores",
      p_scope: "all_stores",
      p_instance_identity: INSTANCE,
      p_reason: "tentativa de ativação",
      p_operation_id: OPERATION_ID,
    });
  });

  it("mantém o estado operacional off em uma concessão permitida (stage off)", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: true, refused: false, stage: "off" },
      error: null,
    });

    const res = await postStage({
      stage: "off",
      scope: "all_stores",
      instanceIdentity: INSTANCE,
      reason: "manter desligado",
      operationId: OPERATION_ID,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.granted).toBe(true);
    expect(body.stage).toBe("off");
  });

  it("motivo ausente → 400 sem chamar a RPC", async () => {
    const res = await postStage({
      stage: "all_stores",
      scope: "all_stores",
      instanceIdentity: INSTANCE,
      reason: "",
      operationId: OPERATION_ID,
    });
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("GET exige requireAdmin", async () => {
    mockRequireAdmin.mockRejectedValueOnce(
      new ForbiddenError("Acesso restrito a administradores"),
    );
    const res = await getStage();
    expect(res.status).toBe(403);
  });

  it("a superfície não importa geração/provider/crédito/download e só importa authorization", () => {
    const source = readFileSync(path.resolve(process.cwd(), ROUTE_RELATIVE_PATH), "utf8");
    const forbidden =
      /(?:from\s*["'][^"']*(?:adapter|gateway|provider|credit|delivery|download|\/api\/campaign)[^"']*["']|import\s*["'][^"']*(?:adapter|gateway|provider|credit|delivery|download|\/api\/campaign)[^"']*["'])/i;
    expect(source).not.toMatch(forbidden);

    const productImports = [
      ...source.matchAll(/from\s*["']([^"']*product-1-1[^"']*)["']/g),
    ].map((m) => m[1]);
    expect(productImports.length).toBeGreaterThan(0);
    for (const specifier of productImports) {
      expect(specifier.startsWith("@/lib/product-1-1/authorization/")).toBe(true);
    }
  });
});
