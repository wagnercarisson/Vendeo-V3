import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock("server-only", () => ({}));

const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    rpc: mockRpc,
  },
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/auth/csrf', () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock('@/lib/auth/require-user', () => ({
  requireUser: vi.fn(() => Promise.resolve({ userId: '00000000-0000-0000-0000-000000000001' })),
}));

vi.mock('@/lib/store-response', () => ({
  buildStoreResponse: vi.fn(),
}));

vi.mock('@/lib/legal/document-versions', () => ({
  getCurrentVersion: vi.fn(async () => ({ version: 'v1.0', effectiveAt: '2026-07-23T00:00:00Z', summary: null })),
}));

describe('POST /api/store — onboarding grant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates store + grants credits via legal RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { id: 'store-1', name: 'Minha Loja', segment: 'moda-calcados-acessorios', balance: 10 },
      error: null,
    });

    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Minha Loja',
        segment: 'moda-calcados-acessorios',
        acceptedTerms: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('store-1');
    expect(body.balance).toBe(10);
    expect(mockRpc).toHaveBeenCalledWith('create_store_with_legal_acceptance', expect.any(Object));
  });

  it('returns 400 when acceptedTerms missing', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Minha Loja',
        segment: 'moda-calcados-acessorios',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('RPC failure returns 500', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'grant failed' },
    });

    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Minha Loja',
        segment: 'moda-calcados-acessorios',
        acceptedTerms: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
