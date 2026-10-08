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
  STAGE_ENVIRONMENT_COMPATIBILITY,
  STAGE_SCOPE_COMPATIBILITY,
  type AuthorizationFlagsRead,
  type DecideProductFlowAuthorizationInput,
} from "../authorization/authorization-decision";
import { deriveCurrentAuthorization } from "../authorization/derive";
import { resolveProductFlowAuthorization } from "../authorization/authorization-service";
import type { StageAuthorizationRepository } from "../authorization/stage-authorization-repository";
import type {
  CurrentStageAuthorization,
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

function decide(over: Partial<DecideProductFlowAuthorizationInput> = {}) {
  return decideProductFlowAuthorization({
    nowMs: 0,
    requestedScope: "all_stores",
    expectedInstanceIdentity: INSTANCE,
    expectedEnvironment: "isolated",
    authorization: authz(),
    flags: flags(),
    ...over,
  });
}

const ENABLING_BODY = {
  stage: "all_stores",
  scope: "all_stores",
  instanceIdentity: INSTANCE,
  reason: "tentativa de ativação",
  operationId: OPERATION_ID,
};

const OFF_BODY = { ...ENABLING_BODY, stage: "off", reason: "manter desligado" };

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
  it("exige a flag aplicável ao escopo; a flag de teste não habilita o escopo geral", () => {
    expect(
      decide({
        requestedScope: "all_stores",
        flags: flags({ testStoresEnabled: true, allStoresEnabled: false }),
      }),
    ).toEqual({ allowed: false, code: "flag_not_applicable_off" });
  });

  it("a flag geral prevalece sem eliminar a autorização (D-03)", () => {
    expect(
      decide({
        requestedScope: "test_stores",
        authorization: authz({ scope: "test_stores", stage: "test_stores" }),
        flags: flags({ testStoresEnabled: false, allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: true, stage: "test_stores", usedGeneralPrecedence: true });
  });

  it("flag de teste ligada habilita o escopo de teste", () => {
    expect(
      decide({
        requestedScope: "test_stores",
        authorization: authz({ scope: "test_stores", stage: "test_stores" }),
        flags: flags({ testStoresEnabled: true, allStoresEnabled: false }),
      }),
    ).toEqual({ allowed: true, stage: "test_stores", usedGeneralPrecedence: false });
  });

  it("leitura parcial (status não válido) falha fechada", () => {
    expect(decide({ flags: flags({ allStoresStatus: "missing" }) })).toEqual({
      allowed: false,
      code: "flags_unavailable",
    });
  });

  it("sem autorização → missing_authorization", () => {
    expect(decide({ authorization: null, flags: flags({ allStoresEnabled: true }) })).toEqual({
      allowed: false,
      code: "missing_authorization",
    });
  });

  it("estado operacional off nunca habilita (stage_not_enabling)", () => {
    expect(decide({ authorization: authz({ stage: "off" }), flags: flags({ allStoresEnabled: true }) })).toEqual(
      { allowed: false, code: "stage_not_enabling" },
    );
  });

  it("mismatch de instância e de escopo negam", () => {
    expect(
      decide({ authorization: authz({ instanceIdentity: "outra" }), flags: flags({ allStoresEnabled: true }) }),
    ).toEqual({ allowed: false, code: "instance_mismatch" });

    expect(
      decide({
        requestedScope: "test_stores",
        authorization: authz({ scope: "all_stores" }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "scope_mismatch" });
  });

  it("expiração e revogação negam", () => {
    expect(
      decide({ nowMs: 100, authorization: authz({ expiresAtMs: 100 }), flags: flags({ allStoresEnabled: true }) }),
    ).toEqual({ allowed: false, code: "expired" });

    expect(
      decide({ authorization: authz({ revokedAtMs: 5 }), flags: flags({ allStoresEnabled: true }) }),
    ).toEqual({ allowed: false, code: "revoked" });
  });

  it("nenhum parâmetro extra do cliente força a autorização", () => {
    const input = {
      nowMs: 0,
      requestedScope: "all_stores",
      expectedInstanceIdentity: INSTANCE,
      expectedEnvironment: "isolated",
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

describe("F56.2b1a — matriz estágio × escopo × ambiente", () => {
  it("piloto isolado não autoriza o escopo geral (all_stores)", () => {
    expect(
      decide({
        requestedScope: "all_stores",
        authorization: authz({ stage: "isolated_pilot", scope: "all_stores" }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "stage_scope_mismatch" });
  });

  it("piloto isolado não autoriza o ambiente operacional", () => {
    expect(
      decide({
        requestedScope: "test_stores",
        expectedEnvironment: "operational",
        authorization: authz({ stage: "isolated_pilot", scope: "test_stores" }),
        flags: flags({ testStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "stage_environment_mismatch" });
  });

  it("piloto isolado autoriza lojas de teste no ambiente isolado", () => {
    expect(
      decide({
        requestedScope: "test_stores",
        expectedEnvironment: "isolated",
        authorization: authz({ stage: "isolated_pilot", scope: "test_stores" }),
        flags: flags({ testStoresEnabled: true }),
      }),
    ).toEqual({ allowed: true, stage: "isolated_pilot", usedGeneralPrecedence: false });
  });

  it("test_stores não autoriza all_stores; all_stores autoriza all_stores", () => {
    expect(
      decide({
        authorization: authz({ stage: "test_stores", scope: "all_stores" }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: false, code: "stage_scope_mismatch" });

    expect(
      decide({
        authorization: authz({ stage: "all_stores", scope: "all_stores" }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: true, stage: "all_stores", usedGeneralPrecedence: false });
  });

  it("all_stores é compatível com o ambiente isolado (teste controlado)", () => {
    expect(
      decide({
        expectedEnvironment: "isolated",
        authorization: authz({ stage: "all_stores", scope: "all_stores" }),
        flags: flags({ allStoresEnabled: true }),
      }),
    ).toEqual({ allowed: true, stage: "all_stores", usedGeneralPrecedence: false });
  });

  it("a matriz é fechada e determinística", () => {
    expect(STAGE_SCOPE_COMPATIBILITY.isolated_pilot).toEqual(["test_stores"]);
    expect(STAGE_SCOPE_COMPATIBILITY.all_stores).toEqual(["all_stores"]);
    expect(STAGE_ENVIRONMENT_COMPATIBILITY.isolated_pilot).toEqual(["isolated"]);
    expect(STAGE_ENVIRONMENT_COMPATIBILITY.all_stores).toEqual(["isolated", "operational"]);
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
        {
          requestedScope: "all_stores",
          expectedInstanceIdentity: INSTANCE,
          expectedEnvironment: "isolated",
          nowMs: 10,
        },
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
        {
          requestedScope: "all_stores",
          expectedInstanceIdentity: INSTANCE,
          expectedEnvironment: "isolated",
        },
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
        {
          requestedScope: "all_stores",
          expectedInstanceIdentity: INSTANCE,
          expectedEnvironment: "isolated",
        },
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
    const res = await postStage(ENABLING_BODY);
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("recusa concessão de estágio habilitador com 403 e audita via RPC", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: false, refused: true, stage: "all_stores" },
      error: null,
    });

    const res = await postStage(ENABLING_BODY);

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

  it("repetir uma recusa mantém 403 (replay preserva o resultado)", async () => {
    const refusalReplay = {
      data: {
        success: true,
        idempotent: true,
        granted: false,
        refused: true,
        reason: "operational_activation_blocked_in_b1a",
        stage: "all_stores",
        scope: "all_stores",
      },
      error: null,
    };
    mockRpc.mockResolvedValue(refusalReplay);

    const first = await postStage(ENABLING_BODY);
    expect(first.status).toBe(403);

    mockRpc.mockResolvedValue(refusalReplay);
    const second = await postStage(ENABLING_BODY);
    expect(second.status).toBe(403);
    const body = await second.json();
    expect(body.refused).toBe(true);
    expect(body.granted).toBe(false);
  });

  it("concessão off e sua repetição mantêm o mesmo resultado", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, idempotent: false, granted: true, refused: false, stage: "off", scope: "all_stores" },
      error: null,
    });
    const first = await postStage(OFF_BODY);
    expect(first.status).toBe(200);
    expect((await first.json()).granted).toBe(true);

    mockRpc.mockResolvedValue({
      data: { success: true, idempotent: true, granted: true, refused: false, stage: "off", scope: "all_stores" },
      error: null,
    });
    const second = await postStage(OFF_BODY);
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.granted).toBe(true);
    expect(body.idempotent).toBe(true);
    expect(body.stage).toBe("off");
  });

  it("operation_id reutilizado com conteúdo diferente retorna 409 conflito (sem sucesso)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        conflict: true,
        reason: "operation_id_conflict",
        operation_id: OPERATION_ID,
        event_type: "granted",
      },
      error: null,
    });

    const res = await postStage(OFF_BODY);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.conflict).toBe(true);
    expect(body.error).toBe("operation_id_conflict");
  });

  it("colisão concessão × revogação retorna 409 conflito", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        conflict: true,
        reason: "operation_id_conflict",
        operation_id: OPERATION_ID,
        event_type: "revoked",
      },
      error: null,
    });

    const res = await postStage(ENABLING_BODY);
    expect(res.status).toBe(409);
  });

  it("resposta {granted:true} incompleta retorna erro (502)", async () => {
    mockRpc.mockResolvedValue({ data: { granted: true }, error: null });
    const res = await postStage(OFF_BODY);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("authorization_rpc_inconsistent_response");
  });

  it("sucesso de concessão contraditório (stage ≠ off) retorna erro (502)", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: true, refused: false, stage: "all_stores", scope: "all_stores" },
      error: null,
    });
    const res = await postStage(OFF_BODY);
    expect(res.status).toBe(502);
  });

  it("sucesso de concessão com escopo divergente da solicitação retorna erro (502)", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: true, refused: false, stage: "off", scope: "test_stores" },
      error: null,
    });
    const res = await postStage(OFF_BODY);
    expect(res.status).toBe(502);
  });

  it("resposta ausente/inválida da RPC não vira sucesso (502)", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, idempotent: true, event_type: "refused" },
      error: null,
    });
    const legacy = await postStage(ENABLING_BODY);
    expect(legacy.status).toBe(502);

    mockRpc.mockResolvedValue({ data: {}, error: null });
    const empty = await postStage(ENABLING_BODY);
    expect(empty.status).toBe(502);
  });

  it("motivo ausente → 400 sem chamar a RPC", async () => {
    const res = await postStage({ ...ENABLING_BODY, reason: "" });
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
