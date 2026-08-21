import { describe, it, expect, vi, beforeEach } from "vitest";
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
    rpc: mockRpc,
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function putFlag(body: Record<string, unknown>) {
  return import("../route").then(({ PUT }) =>
    PUT(
      new NextRequest(
        new Request("http://localhost/api/admin/feature-flags", {
          method: "PUT",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
  );
}

function getFlag() {
  return import("../route").then(({ GET }) =>
    GET(new NextRequest(new Request("http://localhost/api/admin/feature-flags")))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("F43 admin feature-flags (Testes 24-25)", () => {
  it("Teste 24 (D5): PUT persiste a alteração com motivo obrigatório via RPC (enabled/updated_by/updated_at + auditoria)", async () => {
    mockRpc.mockResolvedValue({
      data: { id: "flag-id-1", key: "force_brief_vision_check", enabled: true },
      error: null,
    });

    const res = await putFlag({
      key: "force_brief_vision_check",
      enabled: true,
      reason: "Diagnóstico de campanha problemática",
      operationId: "op-123",
    });

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_update_feature_flag", {
      p_key: "force_brief_vision_check",
      p_enabled: true,
      p_reason: "Diagnóstico de campanha problemática",
      p_actor_id: "admin-1",
      p_operation_id: "op-123",
    });
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });

  it("Teste 24b (D5): motivo ausente → 400 (motivo obrigatório)", async () => {
    const res = await putFlag({
      key: "force_brief_vision_check",
      enabled: true,
      reason: "",
    });
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("Teste 25 (D5): RPC audita com action feature_flag_update / target_type feature_flag / target_id = feature_flags.id / metadata { key, old_value, new_value, reason }", async () => {
    // Simula a resposta do RPC — o RPC real registra na mesma transação; aqui
    // verificamos que a rota delega corretamente (o contrato de auditoria é do RPC).
    mockRpc.mockResolvedValue({
      data: { id: "flag-id-1", key: "force_brief_vision_check", enabled: false, idempotent: false },
      error: null,
    });

    const res = await putFlag({
      key: "force_brief_vision_check",
      enabled: false,
      reason: "Retorno ao padrão recomendado",
      operationId: "op-456",
    });
    expect(res.status).toBe(200);

    // A rota delega ao RPC admin_update_feature_flag — a auditoria
    // (feature_flag_update / feature_flag / metadata key/old_value/new_value/reason)
    // acontece na MESMA transação do RPC (validado na migration 43-07).
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_update_feature_flag",
      expect.objectContaining({
        p_key: "force_brief_vision_check",
        p_enabled: false,
        p_reason: "Retorno ao padrão recomendado",
      })
    );
  });

  it("GET retorna o estado atual da flag para a tela Controles operacionais", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { id: "flag-id-1", key: "force_brief_vision_check", enabled: false, description: "desc", updated_by: null, updated_at: null },
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      return {};
    });

    const res = await getFlag();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag.key).toBe("force_brief_vision_check");
  });
});