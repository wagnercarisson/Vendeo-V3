import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetStoreReadiness = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/store-readiness', () => ({
  getStoreReadiness: mockGetStoreReadiness,
}));

vi.mock('@/lib/auth/require-user', () => ({
  requireUser: vi.fn(async () => ({ userId: 'user-123' })),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Usuário não autenticado") { super(message); this.name = "UnauthorizedError"; }
  },
}));

class MockStoreNotFoundError extends Error {
  constructor(message = "Store not found or access denied") { super(message); this.name = "StoreNotFoundError"; }
}

const mockRequireAuthorizedStore = vi.fn();

vi.mock('@/lib/auth/store-ownership', () => ({
  requireAuthorizedStore: (...args: unknown[]) => mockRequireAuthorizedStore(...args),
  StoreNotFoundError: MockStoreNotFoundError,
}));

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

function createRequest(storeId: string): NextRequest {
  return new NextRequest("http://localhost/api/store/check-readiness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId }),
  });
}

describe('POST /api/store/check-readiness — ownership validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns readiness for own store', async () => {
    mockRequireAuthorizedStore.mockResolvedValue({ id: STORE_ID, user_id: 'user-123' });
    mockGetStoreReadiness.mockResolvedValue({ ready: true, missing: [] });

    const { POST } = await import('../route');
    const res = await POST(createRequest(STORE_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.missing).toEqual([]);
  });

  it('returns 404 for non-existent store', async () => {
    mockRequireAuthorizedStore.mockRejectedValue(new MockStoreNotFoundError('Store not found'));

    const { POST } = await import('../route');
    const res = await POST(createRequest('00000000-0000-0000-0000-000000000000'));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Store not found');
  });

  it('returns 401 for unauthenticated request', async () => {
    const { UnauthorizedError } = await import('@/lib/auth/require-user');
    mockRequireAuthorizedStore.mockRejectedValue(new UnauthorizedError());

    const { POST } = await import('../route');
    const res = await POST(createRequest(STORE_ID));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid storeId format', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest("http://localhost/api/store/check-readiness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: 'not-a-uuid' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid uuid');
  });
});
