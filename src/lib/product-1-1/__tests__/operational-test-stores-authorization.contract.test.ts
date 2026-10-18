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
const OPERATION_ID = "00000000-0000-4000-8000-0000000000d2";
const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20261019000001_f56_2b2d_operational_test_stores_authorization.sql";

const OPERATIONAL_BODY = {
  stage: "test_stores",
  scope: "test_stores",
  reason: "abrir a via operacional restrita a lojas de teste",
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
    stage: "test_stores",
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
    expectedEnvironment: "operational",
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

describe("F56.2b2d — migration da via operacional estreita (SQL estático)", () => {
  const rawText = readFileSync(
    path.resolve(process.cwd(), MIGRATION_RELATIVE_PATH),
    "utf8",
  );
  // Asserções de CÓDIGO ignoram linhas de comentário (o cabeçalho cita `db push`).
  const code = rawText
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("declara as DUAS vias estreitas (isolated_pilot e test_stores + test_stores)", () => {
    expect(code).toContain(
      "v_narrow_isolated := (p_stage = 'isolated_pilot' AND p_scope = 'test_stores')",
    );
    expect(code).toContain(
      "v_narrow_operational := (p_stage = 'test_stores' AND p_scope = 'test_stores')",
    );
    expect(code).toContain("v_narrow := v_narrow_isolated OR v_narrow_operational");
  });

  it("preserva a barreira global (recusa do restante habilitador, inclusive all_stores)", () => {
    expect(code).toContain("operational_activation_blocked_in_b1a");
    expect(code).toContain("v_enabling := (p_stage <> 'off') AND NOT v_narrow");
  });

  it("devolve o estágio PERSISTIDO no replay (sem literal isolated_pilot fixo)", () => {
    expect(code).toContain("'stage', v_existing_stage, 'scope', 'test_stores'");
    expect(code).not.toContain("'stage', 'isolated_pilot', 'scope', 'test_stores'");
    // Concessão nova devolve o estágio solicitado.
    expect(code).toContain("'stage', p_stage, 'scope', 'test_stores'");
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

  it("é apenas AUTORADA (com REVERT) e não contém mutação executável de tabela", () => {
    expect(rawText).toContain("apenas AUTORADA");
    expect(rawText).toMatch(/REVERT/);
    expect(code).not.toMatch(/ALTER TABLE|DROP TABLE/);
  });
});

describe("F56.2b2d — decisão da via operacional (fail-closed)", () => {
  it("test_stores + test_stores + operational com a flag aplicável é permitido", () => {
    expect(decide()).toEqual({
      allowed: true,
      stage: "test_stores",
      usedGeneralPrecedence: false,
    });
  });

  it("isolated_pilot + test_stores + isolated continua permitido (via inalterada)", () => {
    expect(
      decide({
        expectedEnvironment: "isolated",
        authorization: authz({ stage: "isolated_pilot" }),
      }),
    ).toEqual({
      allowed: true,
      stage: "isolated_pilot",
      usedGeneralPrecedence: false,
    });
  });

  it("all_stores permanece recusado (matriz fechada)", () => {
    expect(
      decide({ authorization: authz({ stage: "all_stores", scope: "all_stores" }) }),
    ).toEqual({ allowed: false, code: "scope_mismatch" });
    expect(STAGE_SCOPE_COMPATIBILITY.test_stores).toEqual(["test_stores"]);
    expect(STAGE_ENVIRONMENT_COMPATIBILITY.test_stores).toEqual(["isolated", "operational"]);
  });

  it("instância divergente nega (identidade é server-side e exata)", () => {
    expect(decide({ authorization: authz({ instanceIdentity: "outra" }) })).toEqual({
      allowed: false,
      code: "instance_mismatch",
    });
  });

  it("ambiente incompatível nega (piloto isolado nunca autoriza o operacional)", () => {
    expect(
      decide({ authorization: authz({ stage: "isolated_pilot" }) }),
    ).toEqual({ allowed: false, code: "stage_environment_mismatch" });
  });

  it("flag OFF nega e estágio não-habilitador nega", () => {
    expect(decide({ flags: flags({ testStoresEnabled: false }) })).toEqual({
      allowed: false,
      code: "flag_not_applicable_off",
    });
    expect(decide({ authorization: authz({ stage: "off" }) })).toEqual({
      allowed: false,
      code: "stage_not_enabling",
    });
  });
});

describe("F56.2b2d — rota admin aceita a via operacional e preserva a barreira", () => {
  it("aceita concessão test_stores + test_stores (200)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        granted: true,
        refused: false,
        stage: "test_stores",
        scope: "test_stores",
      },
      error: null,
    });

    const res = await postStage(OPERATIONAL_BODY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.granted).toBe(true);
    expect(body.stage).toBe("test_stores");
    expect(body.scope).toBe("test_stores");
    expect(mockRpc).toHaveBeenCalledWith("admin_grant_product_flow_stage_authorization", {
      p_actor_id: "admin-1",
      p_stage: "test_stores",
      p_scope: "test_stores",
      p_instance_identity: "127.0.0.1:57781",
      p_reason: OPERATIONAL_BODY.reason,
      p_operation_id: OPERATION_ID,
    });
  });

  it("replay idempotente da via operacional mantém 200 e o mesmo desfecho", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: true,
        granted: true,
        refused: false,
        stage: "test_stores",
        scope: "test_stores",
      },
      error: null,
    });
    const res = await postStage(OPERATIONAL_BODY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(body.stage).toBe("test_stores");
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
    const res = await postStage({ ...OPERATIONAL_BODY, stage: "all_stores", scope: "all_stores" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.refused).toBe(true);
    expect(body.granted).toBe(false);
    expect(body.error).toBe("operational_activation_blocked_in_b1a");
  });

  it("envelope operacional contraditório (stage ≠ test_stores) retorna 502", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: true, refused: false, stage: "off", scope: "test_stores" },
      error: null,
    });
    const res = await postStage(OPERATIONAL_BODY);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("authorization_rpc_inconsistent_response");
  });

  it("concessão operacional com escopo divergente retorna 502", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        granted: true,
        refused: false,
        stage: "test_stores",
        scope: "all_stores",
      },
      error: null,
    });
    const res = await postStage(OPERATIONAL_BODY);
    expect(res.status).toBe(502);
  });
});
