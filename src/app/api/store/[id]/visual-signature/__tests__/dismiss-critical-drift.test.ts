import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

function makeChain(result: any) {
  const resolvable = Promise.resolve(result);
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  });
  return chain;
}

function makeUpdateTrackingChain(initialResult: any, updateDataRef: { data: Record<string, unknown> | null }[]) {
  const resolvable = Promise.resolve(initialResult);
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(initialResult)),
    maybeSingle: vi.fn(() => Promise.resolve(initialResult)),
    update: vi.fn((data: any) => {
      updateDataRef.push({ data });
      return chain;
    }),
  });
  return chain;
}

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockStore = {
  name: 'Minha Loja',
  segment: 'alimentacao',
  slogan: null,
  city: null,
  state: null,
};

const mockActiveVS = {
  id: 'vs-active-001',
  store_id: STORE_ID,
  status: 'active',
  asset_url: 'https://example.com/vs.png',
  metadata: {
    artDirectorOutput: {
      visual_direction: 'Moderna',
      content_used: { store_name: true, city: false, state: false, slogan: false },
    },
    input_snapshot: {
      name: 'Minha Loja',
      segment: 'alimentacao',
      slogan: null,
      city: null,
      state: null,
    },
    existing_field: 'should be preserved',
  },
};

function makeRequest() {
  return new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature/dismiss-critical-drift`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }));
}

describe('POST /api/store/[id]/visual-signature/dismiss-critical-drift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 204 when store has active VS and persist snapshot', async () => {
    const updates: { data: Record<string, unknown> | null }[] = [];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') {
        // First call -> select active VS, second call -> update
        if (updates.length === 0) {
          return makeUpdateTrackingChain({ data: mockActiveVS, error: null }, updates);
        }
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../dismiss-critical-drift/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    expect(res.status).toBe(204);

    // Verify the update was called with snapshot
    const snapshotUpdate = updates.find(u => u.data?.metadata);
    expect(snapshotUpdate).toBeDefined();
    const metadata = snapshotUpdate!.data!.metadata as Record<string, unknown>;
    const snapshot = metadata.visual_signature_drift_dismissed_snapshot as Record<string, unknown>;
    expect(snapshot).toBeDefined();
    expect(snapshot.name).toBe('Minha Loja');
    expect(snapshot.segment).toBe('alimentacao');
    expect(snapshot.slogan).toBeNull();
    expect(snapshot.city).toBeNull();
    expect(snapshot.state).toBeNull();
    expect(Object.keys(snapshot)).toEqual(['name', 'segment', 'slogan', 'city', 'state']);
  });

  it('should return 404 when store has no active VS', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../dismiss-critical-drift/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(404);
  });

  it('should return 404 when store is not found', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: null, error: { message: 'not found' } });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../dismiss-critical-drift/route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid store UUID', async () => {
    const { POST } = await import('../dismiss-critical-drift/route');
    const req = new NextRequest(new Request('http://localhost/api/store/invalid/visual-signature/dismiss-critical-drift', {
      method: 'POST',
      body: '{}',
    }));
    const res = await POST(req, { params: Promise.resolve({ id: 'invalid' }) });
    expect(res.status).toBe(400);
  });

  it('should preserve existing metadata fields when persisting snapshot', async () => {
    const updates: { data: Record<string, unknown> | null }[] = [];

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') {
        if (updates.length === 0) {
          return makeUpdateTrackingChain({ data: mockActiveVS, error: null }, updates);
        }
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../dismiss-critical-drift/route');
    await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });

    const snapshotUpdate = updates.find(u => u.data?.metadata);
    expect(snapshotUpdate).toBeDefined();
    const metadata = snapshotUpdate!.data!.metadata as Record<string, unknown>;

    // Existing field should be preserved
    expect(metadata.existing_field).toBe('should be preserved');
    // artDirectorOutput should be preserved
    expect(metadata.artDirectorOutput).toBeDefined();
    // input_snapshot should be preserved
    expect(metadata.input_snapshot).toBeDefined();
    // New snapshot should be added
    expect(metadata.visual_signature_drift_dismissed_snapshot).toBeDefined();
  });
});
