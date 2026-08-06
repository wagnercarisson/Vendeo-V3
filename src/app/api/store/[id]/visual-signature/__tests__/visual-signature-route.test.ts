import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockValidateDrift = vi.fn();
const mockReconcileProfiles = vi.fn();
const mockGetBalance = vi.fn();
const mockGetLaunchConfig = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/auth/store-ownership', () => ({
  requireAuthorizedStore: vi.fn(() => Promise.resolve({
    userId: 'test-user',
    storeId: 'test-store',
    store: { id: 'test-store' },
  })),
}));

vi.mock('@/lib/auth/csrf', () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock('@/lib/visual-signature/drift-validator', () => ({
  validateDrift: mockValidateDrift,
}));

vi.mock('@/lib/brand-assets/profile-reconciliation', () => ({
  reconcileProfiles: mockReconcileProfiles,
}));

vi.mock('@/lib/launch-config/config', () => ({
  getLaunchConfig: mockGetLaunchConfig,
}));

vi.mock('@/lib/credit/credit-service', () => ({
  CreditService: class {
    getBalance = mockGetBalance;
  },
}));

vi.mock('@/lib/identity-transitions', () => ({
  transition: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('@/lib/constants', () => ({
  IDENTITY_TO_LOGO_STATUS: {
    text_only: 'explicit_none',
    logo: 'synced',
    visual_signature: 'generated',
  },
}));

function makeChain(result: any) {
  const data = result?.data ?? result;
  const resolvable = Promise.resolve({ ...result, data, count: result?.count ?? (Array.isArray(data) ? data.length : undefined) });
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  });
  return chain;
}

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockStore = {
  id: STORE_ID,
  name: 'Minha Loja',
  segment: 'alimentacao',
  city: null,
  state: null,
  slogan: null,
};

const mockVisualSignatures = [
  {
    id: 'sig-001',
    asset_url: 'https://example.com/vs1.png',
    type: 'ai_generated',
    status: 'active',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-15T00:00:00Z',
    metadata: {
      artDirectorOutput: {
        visual_direction: 'Moderna',
        content_used: { store_name: true, city: false, state: false, slogan: false },
      },
      input_snapshot: {
        name: 'Minha Loja',
        segment: 'alimentacao',
        city: null,
        state: null,
        slogan: null,
      },
    },
  },
  {
    id: 'sig-002',
    asset_url: 'https://example.com/vs2.png',
    type: 'ai_generated',
    status: 'archived',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    metadata: null,
  },
];

describe('GET /api/store/[id]/visual-signature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateDrift.mockReturnValue({
      has_drift: false,
      fields: [],
      reason: 'ok',
      requires_regeneration: false,
    });
    mockGetBalance.mockResolvedValue(0);
    mockGetLaunchConfig.mockReturnValue({ creditsChargingEnabled: true });
  });

  it('invalid store ID returns 400', async () => {
    const { GET } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store/invalid/visual-signature'));
    const res = await GET(req, { params: Promise.resolve({ id: 'invalid' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ID da loja inválido');
  });

  it('store not found returns 404', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: null, error: { message: 'not found' } });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Loja não encontrada');
  });

  it('returns array of signatures with restore_eligibility', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.signatures)).toBe(true);
    expect(body.total).toBe(2);
  });

  it('each signature has restore_eligibility fields', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    for (const sig of body.signatures) {
      expect(sig).toHaveProperty('restore_eligibility');
      expect(sig.restore_eligibility).toHaveProperty('can_restore');
      expect(sig.restore_eligibility).toHaveProperty('drift_fields');
      expect(sig.restore_eligibility).toHaveProperty('requires_regeneration');
      expect(sig.restore_eligibility).toHaveProperty('reason');
    }
  });

  it('signature metadata null uses missing_metadata reason', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    // Second signature has null metadata
    const archivedSig = body.signatures.find((s: any) => s.status === 'archived');
    expect(archivedSig.restore_eligibility.reason).toBe('missing_metadata');
    expect(archivedSig.restore_eligibility.can_restore).toBe(false);
  });

  it('validates drift for signatures with complete metadata', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
    await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    // Should call validateDrift at least for signatures with both input_snapshot and artDirectorOutput
    expect(mockValidateDrift).toHaveBeenCalled();
  });

  it('returns art_direction field with visual_direction and content_used', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
      return makeChain({ data: null, error: null });
    });
    const { GET } = await import('../route');
    const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
    const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    const activeSig = body.signatures.find((s: any) => s.status === 'active');
    expect(activeSig).toHaveProperty('art_direction');
    expect(activeSig.art_direction).toHaveProperty('visual_direction');
    expect(activeSig.art_direction).toHaveProperty('content_used');
  });

  describe('pagination', () => {
    it('?limit=6 passes range(0, 5) to Supabase and returns total', async () => {
      const manySigs = Array.from({ length: 10 }, (_, i) => ({
        id: `sig-${i}`,
        asset_url: `https://example.com/vs${i}.png`,
        type: 'ai_generated',
        status: 'archived',
        created_at: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        updated_at: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        metadata: null,
      }));
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: manySigs, error: null, count: 10 });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature?limit=6`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      expect(body.total).toBe(10);
      expect(Array.isArray(body.signatures)).toBe(true);
      // Verify range was called with correct offset+limit
      const storeSigCalls = mockSupabaseFrom.mock.calls
        .map((call: any, i: number) => ({ table: call[0], idx: i }))
        .filter(c => c.table === 'store_visual_signatures');
      const chainCall = mockSupabaseFrom.mock.results[storeSigCalls[0].idx]?.value;
      expect(chainCall?.range).toHaveBeenCalledWith(0, 5);
    });

    it('?limit=6&offset=6 passes range(6, 11) to Supabase', async () => {
      const manySigs = Array.from({ length: 10 }, (_, i) => ({
        id: `sig-${i}`,
        asset_url: `https://example.com/vs${i}.png`,
        type: 'ai_generated',
        status: 'archived',
        created_at: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        updated_at: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        metadata: null,
      }));
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: manySigs, error: null, count: 10 });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature?limit=6&offset=6`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      expect(body.total).toBe(10);
      const storeSigCalls = mockSupabaseFrom.mock.calls
        .map((call: any, i: number) => ({ table: call[0], idx: i }))
        .filter(c => c.table === 'store_visual_signatures');
      const chainCall = mockSupabaseFrom.mock.results[storeSigCalls[0].idx]?.value;
      expect(chainCall?.range).toHaveBeenCalledWith(6, 11);
    });

    it('default limit is 12 (range(0, 11))', async () => {
      const manySigs = Array.from({ length: 20 }, (_, i) => ({
        id: `sig-${i}`,
        asset_url: `https://example.com/vs${i}.png`,
        type: 'ai_generated',
        status: 'archived',
        created_at: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        updated_at: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        metadata: null,
      }));
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: manySigs, error: null, count: 20 });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      expect(body.total).toBe(20);
      const storeSigCalls = mockSupabaseFrom.mock.calls
        .map((call: any, i: number) => ({ table: call[0], idx: i }))
        .filter(c => c.table === 'store_visual_signatures');
      const chainCall = mockSupabaseFrom.mock.results[storeSigCalls[0].idx]?.value;
      expect(chainCall?.range).toHaveBeenCalledWith(0, 11);
    });
  });

  describe('critical_drift', () => {
    beforeEach(() => {
      mockValidateDrift.mockReturnValue({
        has_drift: false,
        fields: [],
        reason: 'ok',
        requires_regeneration: false,
      });
    });

    it('active signature returns non-null critical_drift', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      const activeSig = body.signatures.find((s: any) => s.status === 'active');
      expect(activeSig.critical_drift).not.toBeNull();
      expect(activeSig.critical_drift).toHaveProperty('status');
      expect(activeSig.critical_drift).toHaveProperty('fields');
      expect(activeSig.critical_drift).toHaveProperty('reason');
    });

    it('archived signature returns critical_drift: null', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      const archivedSig = body.signatures.find((s: any) => s.status === 'archived');
      expect(archivedSig.critical_drift).toBeNull();
    });

    it('critical_drift.status is none when no drift', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
        return makeChain({ data: null, error: null });
      });
      mockValidateDrift.mockReturnValue({
        has_drift: false,
        fields: [],
        reason: 'ok',
        requires_regeneration: false,
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      const activeSig = body.signatures.find((s: any) => s.status === 'active');
      expect(activeSig.critical_drift.status).toBe('none');
      expect(activeSig.critical_drift.reason).toBe('ok');
    });

    it('critical_drift.status is new when drift exists and no dismissed_snapshot', async () => {
      mockValidateDrift.mockReturnValue({
        has_drift: true,
        fields: ['name'],
        reason: 'critical_drift',
        requires_regeneration: true,
      });
      const driftedMockSig = [{
        id: 'sig-001',
        asset_url: 'https://example.com/vs1.png',
        type: 'ai_generated',
        status: 'active',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-15T00:00:00Z',
        metadata: {
          artDirectorOutput: {
            visual_direction: 'Moderna',
            content_used: { store_name: true, city: false, state: false, slogan: false },
          },
          input_snapshot: {
            name: 'Minha Loja',
            segment: 'alimentacao',
            city: null,
            state: null,
            slogan: null,
          },
          // No visual_signature_drift_dismissed_snapshot
        },
      }];
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: driftedMockSig, error: null });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      const activeSig = body.signatures.find((s: any) => s.status === 'active');
      expect(activeSig.critical_drift.status).toBe('new');
      expect(activeSig.critical_drift.fields).toContain('name');
      expect(activeSig.critical_drift.reason).toBe('critical_drift');
    });

    it('critical_drift.status is dismissed when dismissed_snapshot matches store', async () => {
      mockValidateDrift.mockReturnValue({
        has_drift: true,
        fields: ['name'],
        reason: 'critical_drift',
        requires_regeneration: true,
      });
      const dismissedMockSig = [{
        id: 'sig-001',
        asset_url: 'https://example.com/vs1.png',
        type: 'ai_generated',
        status: 'active',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-15T00:00:00Z',
        metadata: {
          artDirectorOutput: {
            visual_direction: 'Moderna',
            content_used: { store_name: true, city: false, state: false, slogan: false },
          },
          input_snapshot: {
            name: 'Minha Loja',
            segment: 'alimentacao',
            city: null,
            state: null,
            slogan: null,
          },
          visual_signature_drift_dismissed_snapshot: {
            name: 'Minha Loja',
            segment: 'alimentacao',
            slogan: null,
            city: null,
            state: null,
          },
        },
      }];
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: dismissedMockSig, error: null });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      const activeSig = body.signatures.find((s: any) => s.status === 'active');
      expect(activeSig.critical_drift.status).toBe('dismissed');
      expect(activeSig.critical_drift.reason).toBe('critical_drift');
    });

    it('critical_drift.status is new when dismissed_snapshot does NOT match store', async () => {
      mockValidateDrift.mockReturnValue({
        has_drift: true,
        fields: ['name'],
        reason: 'critical_drift',
        requires_regeneration: true,
      });
      const mismatchedDismissMockSig = [{
        id: 'sig-001',
        asset_url: 'https://example.com/vs1.png',
        type: 'ai_generated',
        status: 'active',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-15T00:00:00Z',
        metadata: {
          artDirectorOutput: {
            visual_direction: 'Moderna',
            content_used: { store_name: true, city: false, state: false, slogan: false },
          },
          input_snapshot: {
            name: 'Minha Loja',
            segment: 'alimentacao',
            city: null,
            state: null,
            slogan: null,
          },
          visual_signature_drift_dismissed_snapshot: {
            name: 'Outro Nome',  // doesn't match store.name
            segment: 'alimentacao',
            slogan: null,
            city: null,
            state: null,
          },
        },
      }];
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: mismatchedDismissMockSig, error: null });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      const activeSig = body.signatures.find((s: any) => s.status === 'active');
      expect(activeSig.critical_drift.status).toBe('new');
    });
  });

  describe('credit + drift metadata (F36 gate de geração)', () => {
    beforeEach(() => {
      mockValidateDrift.mockReturnValue({
        has_drift: false,
        fields: [],
        reason: 'ok',
        requires_regeneration: false,
      });
      mockGetBalance.mockResolvedValue(0);
      mockGetLaunchConfig.mockReturnValue({ creditsChargingEnabled: true });
    });

    it('GET returns credit_balance and credits_charging_enabled at top level', async () => {
      mockGetBalance.mockResolvedValue(7);
      mockGetLaunchConfig.mockReturnValue({ creditsChargingEnabled: true });
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      expect(body.credit_balance).toBe(7);
      expect(body.credits_charging_enabled).toBe(true);
    });

    it('GET returns credit_balance 0 and charging false when configured so', async () => {
      mockGetBalance.mockResolvedValue(0);
      mockGetLaunchConfig.mockReturnValue({ creditsChargingEnabled: false });
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      expect(body.credit_balance).toBe(0);
      expect(body.credits_charging_enabled).toBe(false);
    });

    it('each signature exposes input_snapshot and dismissed_snapshot for the client-side critical compute', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'stores') return makeChain({ data: mockStore, error: null });
        if (table === 'store_visual_signatures') return makeChain({ data: mockVisualSignatures, error: null });
        return makeChain({ data: null, error: null });
      });
      const { GET } = await import('../route');
      const req = new NextRequest(new Request(`http://localhost/api/store/${STORE_ID}/visual-signature`));
      const res = await GET(req, { params: Promise.resolve({ id: STORE_ID }) });
      const body = await res.json();
      const activeSig = body.signatures.find((s: any) => s.status === 'active');
      expect(activeSig.input_snapshot).toEqual({
        name: 'Minha Loja',
        segment: 'alimentacao',
        city: null,
        state: null,
        slogan: null,
      });
      expect(activeSig.dismissed_snapshot).toBeNull();
      expect(activeSig.art_direction.content_used).toEqual({ store_name: true, city: false, state: false, slogan: false });
    });
  });
});
