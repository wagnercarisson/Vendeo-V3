import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock("server-only", () => ({}));

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/auth/csrf', () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock('@/lib/auth/require-user', () => ({
  requireUser: vi.fn(() => Promise.resolve({ userId: '00000000-0000-0000-0000-000000000001' })),
  requireApiUser: vi.fn(),
  UnauthorizedError: class extends Error {},
}));

vi.mock('@/lib/store-response', () => ({
  buildStoreResponse: vi.fn(),
}));

vi.mock('@/lib/legal/document-versions', () => ({
  getCurrentVersion: vi.fn(async () => ({ version: 'v1.0', effectiveAt: '2026-07-23T00:00:00Z', summary: null })),
}));

vi.mock('@/lib/cnpj/validate', () => ({
  validateCnpj: vi.fn((raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "12345678000195") {
      return { normalized: "12345678000195" };
    }
    if (digits === "22345678000195") {
      return { normalized: "22345678000195" };
    }
    if (digits === "11111111111111") {
      return new Error("CNPJ inv\u00e1lido");
    }
    return new Error("CNPJ inv\u00e1lido");
  }),
}));

vi.mock('@/lib/cnpj/mask', () => ({
  maskCnpj: vi.fn((n: string) => "**.***.***/0001-**"),
}));

vi.mock('@/lib/cnpj/hash', () => ({
  hashCnpjRoot: vi.fn(() => "mocked_hash_64chars_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),
}));

vi.mock('@/lib/cnpj/similarity', () => ({
  compareBusinessName: vi.fn(() => ({ bestScore: 1, nameToLegal: 1, nameToFantasy: null, label: "match" })),
}));

import { POST } from "../route";

// Ensure CNPJ_PEPPER is set for hashCnpjRoot
process.env.CNPJ_PEPPER = "test_pepper_hex_64_chars_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/store", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": "127.0.0.1", "user-agent": "test" },
  });
}

describe("POST /api/store — CNPJ onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates store with CNPJ and grants onboarding when root is new", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        store: [{ id: "store-1", name: "Minha Loja", segment: "moda-calcados-acessorios" }],
        onboardingGranted: true,
      },
      error: null,
    });

    const res = await POST(createRequest({
      name: "Minha Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("store-1");
    expect(body.onboardingGranted).toBe(true);
    expect(body.cnpjMasked).toBeDefined();
  });

  it("creates store without onboarding grant when same root already used", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        store: [{ id: "store-2", name: "Filial", segment: "moda-calcados-acessorios" }],
        onboardingGranted: false,
      },
      error: null,
    });

    const res = await POST(createRequest({
      name: "Filial",
      segment: "moda-calcados-acessorios",
      cnpj: "22.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("store-2");
    expect(body.onboardingGranted).toBe(false);
  });

  it("returns 500 when RPC returns no store object", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { onboardingGranted: false },
      error: null,
    });

    const res = await POST(createRequest({
      name: "Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(500);
  });

  it("returns 400 for invalid CNPJ", async () => {
    const res = await POST(createRequest({
      name: "Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "11.111.111/0001-11",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CNPJ inv\u00e1lido");
  });

  it("returns 400 when CNPJ is missing", async () => {
    const res = await POST(createRequest({
      name: "Loja",
      segment: "moda-calcados-acessorios",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CNPJ \u00e9 obrigat\u00f3rio");
  });

  it("returns 400 when CNPJ is invalid (known sequence)", async () => {
    const res = await POST(createRequest({
      name: "Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "11.111.111/0001-11",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(400);
  });
});
