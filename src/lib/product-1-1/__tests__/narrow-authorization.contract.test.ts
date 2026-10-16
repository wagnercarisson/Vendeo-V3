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
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(),
  },
}));

vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));

vi.mock("@/lib/product-1-1/authorization/instance-identity", () => ({
  resolveCanonicalInstanceIdentity: () => "127.0.0.1:57781",
}));

import {
  decideProductFlowAuthorization,
  STAGE_ENVIRONMENT_COMPATIBILITY,
  STAGE_SCOPE_COMPATIBILITY,
  type AuthorizationFlagsRead,
  type DecideProductFlowAuthorizationInput,
} from "../authorization/authorization-decision";
import type { CurrentStageAuthorization } from "../authorization/types";

const INSTANCE = "127.0.0.1:57781";
const OPERATION_ID = "00000000-0000-4000-8000-000000000002";
const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20261017000001_f56_2b2c_narrow_authorization.sql";

const NARROW_BODY = {
  stage: "isolated_pilot",
  scope: "test_stores",
  reason: "abrir a janela do piloto (recorte estreito)",
  operationId: OPERATION_ID,
};

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
    stage: "isolated_pilot",
    scope: "test_stores",
    instanceIdentity: INSTANCE,
    expiresAtMs: null,
    revokedAtMs: null,
    ...over,
  };
}

function decide(over: Partial<DecideProductFlowAuthorizationInput> = {}) {
  return decideProductFlowAuthorization({
    nowMs: 0,
    requestedScope: "test_stores",
    expectedInstanceIdentity: INSTANCE,
    expectedEnvironment: "isolated",
    authorization: authz(),
    flags: flags({ testStoresEnabled: true }),
    ...over,
  });
}

function postStage(body: unknown) {
  return import("@/app/api/admin/product-flow-authorizations/route").then(({ POST }) =>
    POST(
      new NextRequest(
        new Request("http://127.0.0.1/api/admin/product-flow-authorizations", {
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
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("F56.2b2c — migration do ajuste mínimo da barreira (SQL estático)", () => {
  const rawText = readFileSync(
    path.resolve(process.cwd(), MIGRATION_RELATIVE_PATH),
    "utf8",
  );
  // Asserções de CÓDIGO ignoram linhas de comentário (o cabeçalho cita `db push`).
  const code = rawText
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("concede somente a via estreita isolated_pilot + test_stores", () => {
    expect(code).toContain("v_narrow := (p_stage = 'isolated_pilot' AND p_scope = 'test_stores')");
    expect(code).toContain("'stage', 'isolated_pilot', 'scope', 'test_stores'");
  });

  it("preserva a barreira global (recusa do restante habilitador)", () => {
    expect(code).toContain("operational_activation_blocked_in_b1a");
    expect(code).toContain("v_enabling := (p_stage <> 'off') AND NOT v_narrow");
  });

  it("mantém idempotência, auditoria e append-only", () => {
    expect(code).toContain("operation_id_conflict");
    expect(code).toContain("ON CONFLICT (operation_id) DO NOTHING");
    expect(code).toContain("granted_by");
    expect(code).toContain("INSERT INTO public.product_flow_stage_authorizations");
  });

  it("preserva a ASSINATURA de 6 parâmetros (sem p_expires_at/overload)", () => {
    expect(code).toContain("p_actor_id");
    expect(code).toContain("p_operation_id");
    expect(code).not.toContain("p_expires_at");
    expect(code).toContain("SECURITY DEFINER");
    expect(code).toContain("SET search_path = ''");
    expect(code).toContain(
      "GRANT EXECUTE ON FUNCTION public.admin_grant_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID)",
    );
  });
});

describe("F56.2b2c — decisão da via estreita (fail-closed)", () => {
  it("isolated_pilot + test_stores + isolated com a flag aplicável é permitido", () => {
    expect(decide()).toEqual({
      allowed: true,
      stage: "isolated_pilot",
      usedGeneralPrecedence: false,
    });
  });

  it("o piloto isolado nunca autoriza o ambiente operacional", () => {
    expect(decide({ expectedEnvironment: "operational" })).toEqual({
      allowed: false,
      code: "stage_environment_mismatch",
    });
  });

  it("o piloto isolado nunca autoriza o escopo geral (all_stores)", () => {
    expect(
      decide({ authorization: authz({ scope: "all_stores" }) }),
    ).toEqual({ allowed: false, code: "scope_mismatch" });
  });

  it("flag de teste desligada nega", () => {
    expect(decide({ flags: flags({ testStoresEnabled: false }) })).toEqual({
      allowed: false,
      code: "flag_not_applicable_off",
    });
  });

  it("sem autorização, revogada ou expirada negam", () => {
    expect(decide({ authorization: null })).toEqual({
      allowed: false,
      code: "missing_authorization",
    });
    expect(decide({ authorization: authz({ revokedAtMs: 5 }) })).toEqual({
      allowed: false,
      code: "revoked",
    });
    expect(decide({ nowMs: 100, authorization: authz({ expiresAtMs: 100 }) })).toEqual({
      allowed: false,
      code: "expired",
    });
  });

  it("instância divergente nega (identidade é server-side e exata)", () => {
    expect(decide({ authorization: authz({ instanceIdentity: "outra" }) })).toEqual({
      allowed: false,
      code: "instance_mismatch",
    });
  });

  it("nenhum parâmetro do cliente altera o resultado", () => {
    const input = {
      nowMs: 0,
      requestedScope: "all_stores",
      expectedInstanceIdentity: INSTANCE,
      expectedEnvironment: "isolated",
      authorization: authz({ scope: "all_stores" }),
      flags: flags({ allStoresEnabled: false, testStoresEnabled: true }),
      clientRequestedAllow: true,
    } as Parameters<typeof decideProductFlowAuthorization>[0];
    expect(decideProductFlowAuthorization(input).allowed).toBe(false);
  });

  it("a matriz permanece fechada (isolated_pilot ↔ test_stores/isolated)", () => {
    expect(STAGE_SCOPE_COMPATIBILITY.isolated_pilot).toEqual(["test_stores"]);
    expect(STAGE_ENVIRONMENT_COMPATIBILITY.isolated_pilot).toEqual(["isolated"]);
  });
});

describe("F56.2b2c — rota admin aceita a via estreita e preserva a barreira", () => {
  it("aceita concessão isolated_pilot + test_stores (200)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        granted: true,
        refused: false,
        stage: "isolated_pilot",
        scope: "test_stores",
      },
      error: null,
    });

    const res = await postStage(NARROW_BODY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.granted).toBe(true);
    expect(body.stage).toBe("isolated_pilot");
    expect(body.scope).toBe("test_stores");
    expect(mockRpc).toHaveBeenCalledWith("admin_grant_product_flow_stage_authorization", {
      p_actor_id: "admin-1",
      p_stage: "isolated_pilot",
      p_scope: "test_stores",
      p_instance_identity: "127.0.0.1:57781",
      p_reason: NARROW_BODY.reason,
      p_operation_id: OPERATION_ID,
    });
  });

  it("replay da via estreita mantém 200 e o mesmo desfecho", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: true,
        granted: true,
        refused: false,
        stage: "isolated_pilot",
        scope: "test_stores",
      },
      error: null,
    });
    const res = await postStage(NARROW_BODY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(body.stage).toBe("isolated_pilot");
  });

  it("escopo geral (all_stores) continua RECUSADO (403)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        granted: false,
        refused: true,
        reason: "operational_activation_blocked_in_b1a",
        stage: "all_stores",
        scope: "all_stores",
      },
      error: null,
    });
    const res = await postStage({ ...NARROW_BODY, stage: "all_stores", scope: "all_stores" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.refused).toBe(true);
    expect(body.granted).toBe(false);
  });

  it("isolated_pilot com escopo all_stores é recusado (barreira preservada)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        granted: false,
        refused: true,
        reason: "operational_activation_blocked_in_b1a",
        stage: "isolated_pilot",
        scope: "all_stores",
      },
      error: null,
    });
    const res = await postStage({ ...NARROW_BODY, scope: "all_stores" });
    expect(res.status).toBe(403);
  });

  it("concessão estreita contraditória (stage ≠ isolated_pilot) retorna 502", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: true, refused: false, stage: "off", scope: "test_stores" },
      error: null,
    });
    const res = await postStage(NARROW_BODY);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("authorization_rpc_inconsistent_response");
  });

  it("concessão estreita com escopo divergente retorna 502", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        granted: true,
        refused: false,
        stage: "isolated_pilot",
        scope: "all_stores",
      },
      error: null,
    });
    const res = await postStage(NARROW_BODY);
    expect(res.status).toBe(502);
  });
});
