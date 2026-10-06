import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const { mockRequireAdmin, mockFindByReference } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockFindByReference: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
}));

vi.mock("@/lib/ai/image-generation-diagnosis-repository", () => ({
  SupabaseImageGenerationDiagnosisRepository: class {
    constructor(_client: unknown) {}
    findByReference(reference: string) {
      return mockFindByReference(reference);
    }
  },
}));

const VALID_REFERENCE = "11111111-1111-4111-8111-111111111111";

const DIAGNOSIS = {
  reference: VALID_REFERENCE,
  internalCategory: "quota",
  model: "gpt-image-2.5-sunburst",
  quality: "medium",
  target: "primary" as const,
  attemptNumber: 1,
  normalizedError: "insufficient_quota",
};

async function getDiagnosis(
  url = `http://localhost/api/admin/image-generation-diagnosis?reference=${VALID_REFERENCE}`,
) {
  const { GET } = await import("../image-generation-diagnosis/route");
  return GET(new NextRequest(new Request(url)));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("GET /api/admin/image-generation-diagnosis", () => {
  it("retorna 403 quando o usuário não é admin", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await getDiagnosis();

    expect(res.status).toBe(403);
    expect(mockFindByReference).not.toHaveBeenCalled();
  });

  it("retorna 400 para referência malformada (não UUID v4)", async () => {
    const res = await getDiagnosis(
      "http://localhost/api/admin/image-generation-diagnosis?reference=not-a-uuid",
    );

    expect(res.status).toBe(400);
    expect(mockFindByReference).not.toHaveBeenCalled();
  });

  it("retorna 400 quando a referência está ausente", async () => {
    const res = await getDiagnosis("http://localhost/api/admin/image-generation-diagnosis");

    expect(res.status).toBe(400);
    expect(mockFindByReference).not.toHaveBeenCalled();
  });

  it("retorna 404 quando a referência não existe", async () => {
    mockFindByReference.mockResolvedValue(null);

    const res = await getDiagnosis();

    expect(res.status).toBe(404);
    expect(mockFindByReference).toHaveBeenCalledWith(VALID_REFERENCE);
  });

  it("retorna o diagnóstico interno para referência válida e existente", async () => {
    mockFindByReference.mockResolvedValue(DIAGNOSIS);

    const res = await getDiagnosis();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockFindByReference).toHaveBeenCalledWith(VALID_REFERENCE);
    expect(body.diagnosis.reference).toBe(VALID_REFERENCE);
    expect(body.diagnosis.internalCategory).toBe("quota");
    expect(body.diagnosis.model).toBe("gpt-image-2.5-sunburst");
    expect(body.diagnosis.quality).toBe("medium");
    expect(body.diagnosis.target).toBe("primary");
    expect(body.diagnosis.attemptNumber).toBe(1);
  });

  it("não usa estado em memória: consulta o repositório a cada requisição", async () => {
    mockFindByReference.mockResolvedValue(null);

    await getDiagnosis();
    await getDiagnosis();

    expect(mockFindByReference).toHaveBeenCalledTimes(2);
  });

  it("é read-only: não exporta POST/PUT/DELETE", async () => {
    const route = await import("../image-generation-diagnosis/route");

    expect(typeof route.GET).toBe("function");
    expect((route as Record<string, unknown>).POST).toBeUndefined();
    expect((route as Record<string, unknown>).PUT).toBeUndefined();
    expect((route as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
