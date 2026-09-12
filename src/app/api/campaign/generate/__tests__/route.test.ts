// @vitest-environment node
// F46-03 (Task 3): teste dedicado de POST /api/campaign/generate — a rota legada
// cria o AiTelemetryContext (run campaign_delivery) e o encaminha pelo serviço
// até o provider/gateway (D6/D9).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

vi.mock("server-only", () => ({}));

const { mockRequireApiUser, mockGetCurrentStore, mockProviderGenerate } = vi.hoisted(() => ({
  mockRequireApiUser: vi.fn(),
  mockGetCurrentStore: vi.fn(),
  mockProviderGenerate: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => mockRequireApiUser()),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async (userId: string) => mockGetCurrentStore(userId)),
}));

vi.mock("@/lib/ai-cost", () => ({
  AiCostTracker: class {
    startRun() {
      return { operationRunId: "run-1", traceId: "trace-1" };
    }
  },
  resolveAiCost: vi.fn(),
}));

vi.mock("@/lib/campaign-intelligence/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/campaign-intelligence/service")>();
  return {
    ...actual,
    createDefaultProvider: vi.fn(async () => ({
      name: "fake-provider",
      generate: mockProviderGenerate,
    })),
  };
});

const VALID_SPEC = {
  commercial_copy: { title: "T", subtitle: "S", hook: "H", cta: "C" },
  offer: {
    product_name: "Tênis Runner",
    original_price_display: null,
    discounted_price_display: "R$ 19,90",
    badge_text: null,
  },
  visual_parameters: {
    layout_preset: "produto-oferta-comercial",
    composition_type: "standard",
    hierarchy_focus: "product-image",
    palette_accent: "#22C55E",
    badge_style: "pill",
    background_style: "solid-light",
  },
  generation_metadata: {
    provider: "openai",
    model: "gpt-4o-mini",
    generated_at: "2026-09-12T00:00:00.000Z",
  },
};

const VALID_BODY = {
  productName: "Tênis Runner",
  discountedPriceCents: 1990,
  storeName: "Loja Teste",
  storeSegment: "outros",
  brandColor: "#22C55E",
};

function makeReq(body: unknown = VALID_BODY): NextRequest {
  return new NextRequest("http://localhost:3000/api/campaign/generate", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/campaign/generate (F46-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue({ userId: "user-1", claims: { sub: "user-1" } });
    mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja Teste" });
    mockProviderGenerate.mockResolvedValue({ raw: JSON.stringify(VALID_SPEC) });
  });

  it("200 + spec validado e AiTelemetryContext encaminhado ao provider", async () => {
    const { POST } = await import("@/app/api/campaign/generate/route");
    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commercial_copy.title).toBe("T");

    expect(mockProviderGenerate).toHaveBeenCalledTimes(1);
    const [input, telemetry] = mockProviderGenerate.mock.calls[0];
    expect(input.productName).toBe("Tênis Runner");
    expect(telemetry.operationRunId).toBe("run-1");
    expect(telemetry.operationRunType).toBe("campaign_delivery");
    expect(telemetry.traceId).toBe("trace-1");
    expect(telemetry.storeId).toBe("store-1");
    expect(telemetry.userId).toBe("user-1");
    expect(telemetry.sink).toBeDefined();
  });

  it("400 com input inválido (provider NÃO é chamado)", async () => {
    const { POST } = await import("@/app/api/campaign/generate/route");
    const res = await POST(makeReq({ productName: "" }));
    expect(res.status).toBe(400);
    expect(mockProviderGenerate).not.toHaveBeenCalled();
  });

  it("404 quando não há store", async () => {
    mockGetCurrentStore.mockResolvedValue(null);
    const { POST } = await import("@/app/api/campaign/generate/route");
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
  });
});
