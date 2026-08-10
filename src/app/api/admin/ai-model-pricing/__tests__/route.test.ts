import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

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

// Query chain mocks do GET (select → [eq] → is | order)
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();

function mockPricingQuery(rows: unknown[], error: unknown = null) {
  mockIs.mockResolvedValue({ data: rows, error });
  mockOrder.mockResolvedValue({ data: rows, error });
  mockEq.mockReturnValue({ eq: mockEq, is: mockIs, order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq, is: mockIs, order: mockOrder });
  mockFrom.mockImplementation((table: string) => {
    if (table === "ai_model_pricing") return { select: mockSelect };
    return {};
  });
}

async function getPricing(url = "http://localhost/api/admin/ai-model-pricing") {
  const { GET } = await import("../route");
  return GET(new NextRequest(url));
}

async function putPricing(body: Record<string, unknown>) {
  const { PUT } = await import("../route");
  return PUT(
    new NextRequest(
      new Request("http://localhost/api/admin/ai-model-pricing", {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockPricingQuery([]);
});

describe("PUT /api/admin/ai-model-pricing (D8 — versionamento)", () => {
  it("PUT válido → RPC admin_set_ai_model_price com p_actor_id/p_reason/dimensões/p_source_* + 200 pricing", async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: "new-pricing-id",
        provider: "openai",
        model: "gpt-4o",
        effective_from: "2026-08-08T12:00:00.000Z",
        previous_id: "old-pricing-id",
      },
      error: null,
    });

    const res = await putPricing({
      provider: "openai",
      model: "gpt-4o",
      inputCostUsd: 3.0,
      outputCostUsd: 15.0,
      cachedInputCostUsd: 0.5,
      imageUnitCostUsd: 0.05,
      imageTokenCostUsd: 0.02,
      reason: "ajuste beta",
      sourceUrl: "https://platform.openai.com/docs/pricing",
      sourceNote: "revisado manualmente",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pricing).toEqual({
      id: "new-pricing-id",
      provider: "openai",
      model: "gpt-4o",
      effectiveFrom: "2026-08-08T12:00:00.000Z",
      previousId: "old-pricing-id",
    });
    expect(mockRpc).toHaveBeenCalledWith("admin_set_ai_model_price", {
      p_actor_id: "admin-1",
      p_provider: "openai",
      p_model: "gpt-4o",
      p_input: 3.0,
      p_output: 15.0,
      p_reason: "ajuste beta",
      p_cached: 0.5,
      p_image_unit: 0.05,
      p_image_token: 0.02,
      p_source_url: "https://platform.openai.com/docs/pricing",
      p_source_note: "revisado manualmente",
    });
  });

  it("PUT cria 2ª linha — previousId = id da linha fechada (nunca sobrescreve, D8)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: "new2",
        provider: "openai",
        model: "gpt-image-2",
        effective_from: "2026-08-08T13:00:00.000Z",
        previous_id: "prev1",
      },
      error: null,
    });

    const res = await putPricing({
      provider: "openai",
      model: "gpt-image-2",
      imageUnitCostUsd: 0.05,
      reason: "alta de preço",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pricing.previousId).toBe("prev1");
    expect(body.pricing.id).toBe("new2");
    expect(mockRpc).toHaveBeenCalledWith("admin_set_ai_model_price", {
      p_actor_id: "admin-1",
      p_provider: "openai",
      p_model: "gpt-image-2",
      p_input: null,
      p_output: null,
      p_reason: "alta de preço",
      p_cached: null,
      p_image_unit: 0.05,
      p_image_token: null,
      p_source_url: null,
      p_source_note: null,
    });
  });

  it("PUT sem reason → 400 zod (rastreabilidade D8)", async () => {
    const res = await putPricing({
      provider: "openai",
      model: "gpt-4o",
      inputCostUsd: 3.0,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Dados inválidos");
  });

  it("PUT sem nenhuma dimensão de preço → 400 zod (refine pelo menos um custo)", async () => {
    const res = await putPricing({
      provider: "openai",
      model: "gpt-4o",
      reason: "sem dimensão",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Dados inválidos");
  });

  it("PUT versiona a linha da tool image_generation (F38.1 fechamento — provider openai / model responses:image_generation)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: "tool-pricing-v2",
        provider: "openai",
        model: "responses:image_generation",
        effective_from: "2026-08-09T14:00:00.000Z",
        previous_id: "tool-pricing-v1",
      },
      error: null,
    });

    const res = await putPricing({
      provider: "openai",
      model: "responses:image_generation",
      imageUnitCostUsd: 0.08,
      reason: "ajuste provisório após novos UATs",
      sourceNote:
        "F38.1 beta estimate calibrated from OpenAI dashboard/Costs CSV; provisional until provider cost reconciliation",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pricing).toEqual({
      id: "tool-pricing-v2",
      provider: "openai",
      model: "responses:image_generation",
      effectiveFrom: "2026-08-09T14:00:00.000Z",
      previousId: "tool-pricing-v1",
    });
    expect(mockRpc).toHaveBeenCalledWith("admin_set_ai_model_price", {
      p_actor_id: "admin-1",
      p_provider: "openai",
      p_model: "responses:image_generation",
      p_input: null,
      p_output: null,
      p_reason: "ajuste provisório após novos UATs",
      p_cached: null,
      p_image_unit: 0.08,
      p_image_token: null,
      p_source_url: null,
      p_source_note:
        "F38.1 beta estimate calibrated from OpenAI dashboard/Costs CSV; provisional until provider cost reconciliation",
    });
  });
});

describe("GET /api/admin/ai-model-pricing (D8 — lista vigentes + histórico)", () => {
  it("GET retorna estrutura vigente (effective_until IS NULL) + includeHistory=true traz superseded + sourceUrl/sourceNote", async () => {
    mockPricingQuery([
      {
        id: "p1",
        provider: "openai",
        model: "gpt-4o",
        input_token_usd_per_1m: "2.5",
        output_token_usd_per_1m: "10",
        cached_input_token_usd_per_1m: null,
        image_unit_usd: null,
        image_token_usd_per_1m: null,
        effective_from: "2026-08-08T00:00:00.000Z",
        effective_until: null,
        source_url: "https://platform.openai.com/docs/pricing",
        source_note: "bootstrap F38.1",
        updated_by: null,
        updated_at: "2026-08-08T00:00:00.000Z",
      },
    ]);

    const res = await getPricing();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prices).toHaveLength(1);
    expect(body.prices[0]).toEqual({
      id: "p1",
      provider: "openai",
      model: "gpt-4o",
      inputTokenUsdPer1M: 2.5,
      outputTokenUsdPer1M: 10,
      cachedInputTokenUsdPer1M: null,
      imageUnitUsd: null,
      imageTokenUsdPer1M: null,
      effectiveFrom: "2026-08-08T00:00:00.000Z",
      effectiveUntil: null,
      sourceUrl: "https://platform.openai.com/docs/pricing",
      sourceNote: "bootstrap F38.1",
      updatedBy: null,
      updatedAt: "2026-08-08T00:00:00.000Z",
    });
    // vigente por default: filtro .is("effective_until", null), sem histórico
    expect(mockIs).toHaveBeenCalledWith("effective_until", null);
    expect(mockOrder).not.toHaveBeenCalled();

    // includeHistory=true → NÃO aplica filtro de vigentes, apenas ordena effective_from desc
    mockPricingQuery([
      {
        id: "p1",
        provider: "openai",
        model: "gpt-4o",
        input_token_usd_per_1m: "2.5",
        output_token_usd_per_1m: "10",
        cached_input_token_usd_per_1m: null,
        image_unit_usd: null,
        image_token_usd_per_1m: null,
        effective_from: "2026-08-08T00:00:00.000Z",
        effective_until: "2026-08-09T00:00:00.000Z",
        source_url: "https://platform.openai.com/docs/pricing",
        source_note: "bootstrap F38.1",
        updated_by: null,
        updated_at: "2026-08-08T00:00:00.000Z",
      },
      {
        id: "p2",
        provider: "openai",
        model: "gpt-4o",
        input_token_usd_per_1m: "3",
        output_token_usd_per_1m: "12",
        cached_input_token_usd_per_1m: null,
        image_unit_usd: null,
        image_token_usd_per_1m: null,
        effective_from: "2026-08-09T00:00:00.000Z",
        effective_until: null,
        source_url: "https://platform.openai.com/docs/pricing",
        source_note: "revisado",
        updated_by: "admin-1",
        updated_at: "2026-08-09T00:00:00.000Z",
      },
    ]);

    // isola a 2ª chamada: limpa histórico antes do GET includeHistory
    mockIs.mockClear();
    mockOrder.mockClear();
    const resHistory = await getPricing(
      "http://localhost/api/admin/ai-model-pricing?includeHistory=true",
    );
    expect(resHistory.status).toBe(200);
    const historyBody = await resHistory.json();
    expect(historyBody.prices).toHaveLength(2);
    expect(mockIs).not.toHaveBeenCalled();
    expect(mockOrder).toHaveBeenCalledWith("effective_from", {
      ascending: false,
    });
    // rastreabilidade manual: sourceUrl/sourceNote presentes na resposta
    expect(historyBody.prices[1].sourceUrl).toBe(
      "https://platform.openai.com/docs/pricing",
    );
    expect(historyBody.prices[1].sourceNote).toBe("revisado");
  });

  it("GET inclui a linha da tool image_generation com imageUnitUsd (F38.1 fechamento)", async () => {
    mockPricingQuery([
      {
        id: "tool-pricing-v1",
        provider: "openai",
        model: "responses:image_generation",
        input_token_usd_per_1m: null,
        output_token_usd_per_1m: null,
        cached_input_token_usd_per_1m: null,
        image_unit_usd: "0.065",
        image_token_usd_per_1m: null,
        effective_from: "2026-08-09T00:00:00.000Z",
        effective_until: null,
        source_url: "https://platform.openai.com/docs/pricing",
        source_note:
          "F38.1 beta estimate calibrated from OpenAI dashboard/Costs CSV; provisional until provider cost reconciliation",
        updated_by: null,
        updated_at: "2026-08-09T00:00:00.000Z",
      },
    ]);

    const res = await getPricing();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prices).toHaveLength(1);
    expect(body.prices[0]).toEqual({
      id: "tool-pricing-v1",
      provider: "openai",
      model: "responses:image_generation",
      inputTokenUsdPer1M: null,
      outputTokenUsdPer1M: null,
      cachedInputTokenUsdPer1M: null,
      imageUnitUsd: 0.065,
      imageTokenUsdPer1M: null,
      effectiveFrom: "2026-08-09T00:00:00.000Z",
      effectiveUntil: null,
      sourceUrl: "https://platform.openai.com/docs/pricing",
      sourceNote:
        "F38.1 beta estimate calibrated from OpenAI dashboard/Costs CSV; provisional until provider cost reconciliation",
      updatedBy: null,
      updatedAt: "2026-08-09T00:00:00.000Z",
    });
  });
});

describe("403 — acesso não-admin (requireAdmin + RLS)", () => {
  it("GET sem admin, PUT sem admin e GET com usuário autenticado não-admin → 403", async () => {
    // GET sem admin (não autenticado)
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const resGet = await getPricing();
    expect(resGet.status).toBe(403);

    // PUT sem admin
    const resPut = await putPricing({
      provider: "openai",
      model: "gpt-4o",
      inputCostUsd: 1,
      reason: "x",
    });
    expect(resPut.status).toBe(403);

    // GET com usuário autenticado não-admin (store owner) — RLS nega via requireAdmin
    mockRequireAdmin.mockRejectedValue(
      new ForbiddenError("Acesso restrito a administradores"),
    );
    const resOwner = await getPricing();
    expect(resOwner.status).toBe(403);
    const body = await resOwner.json();
    expect(body.error).toBe("Acesso restrito a administradores");
  });
});
