import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSupabaseFrom = vi.fn();
const mockValidateDrift = vi.fn();
const mockBrandProfilerGenerate = vi.fn();
const mockUpdateEventDecision = vi.fn();
const mockReconcileProfiles = vi.fn();
const mockRevalidateCriticalDrift = vi.fn();

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

vi.mock('@/lib/visual-signature/brand-profiler', () => ({
  BrandProfilerWithoutLogoService: class {
    generate = mockBrandProfilerGenerate;
  },
}));

vi.mock('@/lib/visual-signature/generation-events', () => ({
  updateGenerationEventDecision: mockUpdateEventDecision,
}));

vi.mock('@/lib/brand-assets/profile-reconciliation', () => ({
  reconcileProfiles: mockReconcileProfiles,
}));

vi.mock('@/lib/visual-signature/drift-revalidator', () => ({
  revalidateCriticalDrift: mockRevalidateCriticalDrift,
}));

const storeBrandProfileUpdates: any[] = [];

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
    update: vi.fn(() => chain),
  });
  return chain;
}

function makeBrandProfileChain(result: any) {
  const resolvable = Promise.resolve(result);
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    update: vi.fn((data: any) => {
      storeBrandProfileUpdates.push(data);
      return chain;
    }),
  });
  return chain;
}

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SIG_ID = '660e8400-e29b-41d4-a716-446655440001';

const mockStore = {
  id: STORE_ID,
  name: 'Test Store',
  segment: 'food',
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  city: null,
  state: null,
  brand_color: '#CC0000',
  visual_signature_attempts: 0,
};

const mockSignature = {
  id: SIG_ID,
  store_id: STORE_ID,
  status: 'draft',
  asset_url: 'https://example.com/sig.png',
  metadata: {
    artDirectorOutput: {
      creative_description: 'Test',
      suggested_colors: ['#22C55E', '#1E40AF'],
      visual_direction: 'Modern',
      elements_used: ['store_name'],
      content_used: { store_name: true, city: false, state: false, slogan: false },
      intended_palette: { primary: '#22C55E', accent: '#1E40AF', background: '#0F172A', support: ['#3B82F6'] },
    },
  },
};

const mockProfile = {
  id: 'profile-001',
  status: 'synced',
  inferred_primary_color: '#22C55E',
  inferred_accent_color: '#1E40AF',
  logo_colors_detected: ['#22C55E', '#1E40AF'],
  safe_color_tokens: { primary: '#22C55E', secondary: '#3B82F6', accent: '#1E40AF', background: '#0F172A' },
  visual_style: 'Modern',
  visual_tone: 'Elegante',
  brand_personality: 'Sofisticado',
  brand_colors_chosen: ['#22C55E', '#1E40AF'],
  metadata: { color_validation: { global_status: 'all_confirmed' } },
};

function makeRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest(new Request('http://localhost/api/store/' + STORE_ID + '/visual-signature/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signatureId: SIG_ID, ...overrides }),
  }));
}

function setupStoreQuery(result: any) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'stores') return makeChain(result);
    if (table === 'store_visual_signatures') return makeChain({ data: mockSignature, error: null });
    if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [], error: null });
    return makeChain({ data: null, error: { message: 'unknown table' } });
  });
}

describe('POST /api/store/[id]/visual-signature/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeBrandProfileUpdates.length = 0;
    mockBrandProfilerGenerate.mockResolvedValue({
      profile: { ...mockProfile, id: 'new-profile-001' },
      success: true,
    });
    mockValidateDrift.mockReturnValue({
      has_drift: false, fields: [], reason: 'no_drift', requires_regeneration: false,
    });
    mockUpdateEventDecision.mockResolvedValue(undefined);
    mockReconcileProfiles.mockResolvedValue({
      activatedProfiles: ['profile-001'], outdatedProfiles: [], preservedFallback: false,
    });
  });

  it('12.1 — invalid store ID returns 400', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store/invalid-id/visual-signature/approve', {
      method: 'POST',
      body: JSON.stringify({ signatureId: SIG_ID }),
    }));
    const res = await POST(req, { params: Promise.resolve({ id: 'invalid-id' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ID da loja inválido');
  });

  it('12.2 — invalid JSON body returns 400', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store/' + STORE_ID + '/visual-signature/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }));
    const res = await POST(req, { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
  });

  it('12.3 — missing signatureId returns 400', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest(new Request('http://localhost/api/store/' + STORE_ID + '/visual-signature/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    const res = await POST(req, { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
  });

  it('12.4 — store not found returns 404', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: null, error: { message: 'not found' } });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Loja não encontrada');
  });

  it('12.5 — signature not found returns 404', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: null, error: { message: 'not found' } });
      if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Assinatura visual não encontrada');
  });

  it('12.6 — archived signature with drift returns 409', async () => {
    const archivedSig = {
      ...mockSignature,
      status: 'archived',
      metadata: {
        ...mockSignature.metadata,
        input_snapshot: {
          name: 'Old Store', segment: 'food', city: null, state: null, slogan: null,
        },
      },
    };
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: archivedSig, error: null });
      if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    mockValidateDrift.mockReturnValue({
      has_drift: true, fields: ['name'], reason: 'name_changed', requires_regeneration: true,
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(409);
  });

  it('12.7 — archived signature without drift proceeds', async () => {
    const archivedSig = { ...mockSignature, status: 'archived' };
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: archivedSig, error: null });
      if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
  });

  it('12.8 — reuses existing brand profile', async () => {
    storeBrandProfileUpdates.length = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockSignature, error: null });
      if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [mockProfile], error: null });
      return makeChain({ data: null, error: null });
    });
    mockReconcileProfiles.mockResolvedValue({
      activatedProfiles: ['profile-001'], outdatedProfiles: [], preservedFallback: false,
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brandProfile.id).toBe('profile-001');
    expect(body.brandProfile.status).toBe('synced');
    expect(mockBrandProfilerGenerate).not.toHaveBeenCalled();

    // Verify brand profile input_snapshot has 7 text fields (no brand_color/accent_color)
    const metadataUpdate = storeBrandProfileUpdates.find(
      (u: any) => u.metadata?.input_snapshot
    );
    expect(metadataUpdate).toBeDefined();
    const snapshotKeys = Object.keys(metadataUpdate.metadata.input_snapshot);
    expect(snapshotKeys.length).toBe(7);
    expect(snapshotKeys).not.toContain('brand_color');
    expect(snapshotKeys).not.toContain('accent_color');
  });

  it('12.9 — creates new brand profile via profiler', async () => {
    storeBrandProfileUpdates.length = 0;
    setupStoreQuery({ data: mockStore, error: null });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brandProfile.id).toBe('new-profile-001');
    expect(mockBrandProfilerGenerate).toHaveBeenCalledTimes(1);

    // Verify brand profile metadata.input_snapshot has 7 text fields (no brand_color/accent_color)
    const metadataUpdate = storeBrandProfileUpdates.find(
      (u: any) => u.metadata?.input_snapshot
    );
    expect(metadataUpdate).toBeDefined();
    const snapshotKeys = Object.keys(metadataUpdate.metadata.input_snapshot);
    expect(snapshotKeys.length).toBe(7);
    expect(snapshotKeys).not.toContain('brand_color');
    expect(snapshotKeys).not.toContain('accent_color');
    expect(snapshotKeys).toEqual(
      expect.arrayContaining(['segment', 'subsegment', 'tone_of_voice', 'name', 'positioning', 'short_description', 'slogan'])
    );
  });

  it('12.10 — brand profiler failure returns fallback', async () => {
    setupStoreQuery({ data: mockStore, error: null });
    mockBrandProfilerGenerate.mockRejectedValue(new Error('Vision failed'));
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brandProfile.status).toBe('failed');
    expect(body.brandProfileData).toBeNull();
  });

  it('12.11 — intendedPalette null → profiler called with null', async () => {
    const sigNoPalette = {
      ...mockSignature,
      metadata: {
        artDirectorOutput: {
          creative_description: 'Test',
          suggested_colors: ['#22C55E'],
          visual_direction: 'Modern',
          elements_used: ['store_name'],
          content_used: { store_name: true, city: false, state: false, slogan: false },
        },
      },
    };
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: sigNoPalette, error: null });
      if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    expect(mockBrandProfilerGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ intendedPalette: null })
    );
  });

  it('12.12 — profile reuses when existing synced profile found', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: mockSignature, error: null });
      if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [mockProfile], error: null });
      return makeChain({ data: null, error: null });
    });
    mockReconcileProfiles.mockResolvedValue({
      activatedProfiles: ['profile-001'], outdatedProfiles: [], preservedFallback: false,
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brandProfile.id).toBe('profile-001');
    expect(mockBrandProfilerGenerate).not.toHaveBeenCalled();
    expect(mockReconcileProfiles).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ activateProfileIds: ['profile-001'] }));
  });

  it('12.13 — drift error message is descriptive', async () => {
    const archivedSig = {
      ...mockSignature,
      status: 'archived',
      metadata: {
        ...mockSignature.metadata,
        input_snapshot: {
          name: 'Old Store', segment: 'food', city: null, state: null, slogan: null,
        },
      },
    };
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: archivedSig, error: null });
      return makeChain({ data: null, error: null });
    });
    mockValidateDrift.mockReturnValue({
      has_drift: true, fields: ['name'], reason: 'name_changed', requires_regeneration: true,
    });
    const { POST } = await import('../route');
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    const body = await res.json();
    expect(body.drift.fields).toEqual(['name']);
    expect(body.drift.requires_regeneration).toBe(true);
  });
});

describe('POST /api/store/[id]/visual-signature/approve — Substitution mode', () => {
  const mockVSStore = {
    id: STORE_ID,
    name: 'Test Store',
    segment: 'food',
    subsegment: null,
    tone_of_voice: null,
    positioning: null,
    short_description: null,
    slogan: null,
    city: null,
    state: null,
    brand_color: '#CC0000',
    visual_signature_attempts: 2,
    identity_state: 'visual_signature',
  };

  const mockActiveVS = {
    id: 'active-vs-001',
    store_id: STORE_ID,
    status: 'active',
    asset_url: 'https://example.com/active-vs.png',
    metadata: {
      artDirectorOutput: {
        visual_direction: 'Moderna',
        content_used: { store_name: true, city: false, state: false, slogan: false },
      },
      input_snapshot: {
        name: 'Test Store',
        segment: 'food',
        slogan: null,
        city: null,
        state: null,
      },
    },
  };

  const mockPendingVS = {
    id: SIG_ID,
    store_id: STORE_ID,
    status: 'draft',
    asset_url: 'https://example.com/pending-vs.png',
    metadata: {
      artDirectorOutput: mockSignature.metadata!.artDirectorOutput,
    },
  };

  function makeSubstitutionRequest(overrides: Record<string, unknown> = {}) {
    return new NextRequest(new Request('http://localhost/api/store/' + STORE_ID + '/visual-signature/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureId: SIG_ID, mode: 'substitution', ...overrides }),
    }));
  }

  function setupVSQuery() {
    // Track number of store_visual_signatures calls to return different results
    let vsCallCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') {
        vsCallCount++;
        if (vsCallCount <= 2) {
          // First call: active VS (Guard), second call: pending VS (Guard)
          return makeChain({ data: vsCallCount === 1 ? [mockActiveVS] : mockPendingVS, error: null });
        }
        // Third+ calls: archive/activate updates
        return makeChain({ data: [mockActiveVS], error: null });
      }
      if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    storeBrandProfileUpdates.length = 0;
    mockBrandProfilerGenerate.mockResolvedValue({
      profile: { ...mockProfile, id: 'new-sub-profile-001' },
      success: true,
    });
    mockRevalidateCriticalDrift.mockReturnValue({
      hasDrift: true,
      fields: ['name'],
      reason: 'critical_drift',
    });
  });

  it('SUB-1 — should reject substitution when identity_state !== visual_signature', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: { ...mockVSStore, identity_state: 'text_only' }, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');
    const res = await POST(makeSubstitutionRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_IDENTITY_STATE');
  });

  it('SUB-2 — should reject substitution when no active VS exists', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') return makeChain({ data: null, error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');
    const res = await POST(makeSubstitutionRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NO_ACTIVE_VS');
  });

  it('SUB-3 — should reject substitution when drift not confirmed against active VS', async () => {
    mockRevalidateCriticalDrift.mockReturnValue({
      hasDrift: false,
      fields: [],
      reason: 'ok',
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') {
        return makeChain({ data: [mockActiveVS], error: null });
      }
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');
    const res = await POST(makeSubstitutionRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('DRIFT_NOT_CONFIRMED');
  });

  it('SUB-4 — should restore previous VS on activation failure (Tier 1 compensate)', async () => {
    let vsCallCount = 0;
    let archivedId: string | null = null;
    let activatedId: string | null = null;
    let restoredId: string | null = null;

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stores') return makeChain({ data: mockVSStore, error: null });
      if (table === 'store_visual_signatures') {
        vsCallCount++;
        if (vsCallCount <= 3) {
          // Call 1: active VS, Call 2: pending VS, Call 3: archive active
          if (vsCallCount === 1) return makeChain({ data: [mockActiveVS], error: null });
          if (vsCallCount === 2) return makeChain({ data: mockPendingVS, error: null });
          // Archive
          const archiveChain = makeChain({ data: null, error: null });
          archiveChain.update = vi.fn((data: any) => {
            if (data.status === 'archived') archivedId = mockActiveVS.id;
            return archiveChain;
          });
          return archiveChain;
        }
        // Activation FAILS → restore
        const actChain = makeChain({ data: null, error: { message: 'activation failed' } });
        actChain.update = vi.fn((data: any) => {
          if (data.status === 'active') {
            activatedId = SIG_ID;
            // Return error to simulate activation failure
            return makeChain({ data: null, error: { message: 'activation failed' } });
          }
          if (data.status === 'archived') archivedId = mockActiveVS.id;
          return actChain;
        });
        return actChain;
      }
      if (table === 'store_brand_profiles') return makeBrandProfileChain({ data: [], error: null });
      return makeChain({ data: null, error: null });
    });

    const { POST } = await import('../route');
    const res = await POST(makeSubstitutionRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    // Should return 500 due to activation failure + restore
    expect(res.status).toBe(500);
  });

  it('SUB-5 — should return 200 with bp_status:failed when BP fails (Tier 2 fallback)', async () => {
    mockBrandProfilerGenerate.mockRejectedValue(new Error('BP generation failed'));

    setupVSQuery();

    const { POST } = await import('../route');
    const res = await POST(makeSubstitutionRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bp_status).toBe('failed');
    expect(body.visual_signature_id).toBe(SIG_ID);
    expect(body.signature.status).toBe('active');
    expect(body.warning).toBeDefined();
  });

  it('SUB-6 — should succeed with bp_status:success on full substitution', async () => {
    setupVSQuery();

    const { POST } = await import('../route');
    const res = await POST(makeSubstitutionRequest(), { params: Promise.resolve({ id: STORE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bp_status).toBe('success');
    expect(body.visual_signature_id).toBe(SIG_ID);
    expect(body.signature.status).toBe('active');
    expect(body.signature.id).toBe(SIG_ID);
  });
});
