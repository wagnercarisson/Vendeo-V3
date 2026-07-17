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

describe('POST /api/store — onboarding grant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates store + grants 5 credits via RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { id: 'store-1', name: 'Minha Loja', segment: 'moda-calcados-acessorios', balance: 5 },
      error: null,
    });

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
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('store-1');
    expect(body.balance).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith('create_store_with_initial_grant', expect.any(Object));
  });

  it('RPC idempotency — same key returns same balance', async () => {
    mockRpc.mockResolvedValue({
      data: { id: 'store-1', name: 'Minha Loja', segment: 'moda-calcados-acessorios', balance: 5 },
      error: null,
    });

    const { POST } = await import('../route');

    const req1 = new NextRequest(new Request('http://localhost/api/store', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Minha Loja',
        segment: 'moda-calcados-acessorios',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const body1 = await res1.json();
    expect(body1.balance).toBe(5);

    const req2 = new NextRequest(new Request('http://localhost/api/store', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Minha Loja',
        segment: 'moda-calcados-acessorios',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.balance).toBe(5);
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
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
