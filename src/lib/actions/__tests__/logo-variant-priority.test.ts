import { describe, it, expect, vi, beforeEach } from 'vitest';

const data = vi.hoisted(() => ({
  assets: null as any[] | null,
  profile: null as any | null,
  vs: null as any | null,
}));

function makeChain(resolveValue: any) {
  const chain: any = () => Promise.resolve(resolveValue);
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.single = () => Promise.resolve(resolveValue);
  chain.maybeSingle = () => Promise.resolve(resolveValue);
  chain.then = Promise.resolve(resolveValue).then.bind(Promise.resolve(resolveValue));
  chain.catch = Promise.resolve(resolveValue).catch.bind(Promise.resolve(resolveValue));
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'store_brand_profiles') {
        return { select: () => makeChain({ data: data.profile, error: null }) };
      }
      if (table === 'store_brand_assets') {
        return { select: () => makeChain({ data: data.assets, error: null }) };
      }
      if (table === 'store_visual_signatures') {
        return { select: () => makeChain({ data: data.vs, error: null }) };
      }
      return { select: () => makeChain({ data: null, error: null }) };
    },
    storage: {
      from: () => ({
        getPublicUrl: (storage_path: string) => ({ data: { publicUrl: `https://example.com/${storage_path}` } }),
      }),
    },
  },
}));

vi.mock('@/lib/visual-signature/persistence', () => ({
  getActiveVisualSignature: () => Promise.resolve(null),
}));

vi.mock('@/lib/store', () => ({
  getDefaultBrandColor: () => '#22C55E',
  getStoreInitials: (name: string) => name.slice(0, 2).toUpperCase(),
}));

import { resolveStoreIdentity } from '../store';

const baseStore = {
  id: 'test-uuid',
  name: 'Minha Loja',
  logo_url: null,
  segment: 'outros',
  brand_color: '#22C55E',
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  identity_state: 'logo' as string | null,
};

describe('resolveStoreIdentity — logo variant priority', () => {
  beforeEach(() => {
    data.profile = null;
    data.assets = null;
    data.vs = null;
  });

  it('prioritizes normalized over original and on_dark', async () => {
    data.assets = [
      { id: 'a1', variant_type: 'original', storage_path: 'original.png', status: 'active' },
      { id: 'a2', variant_type: 'normalized', storage_path: 'normalized.png', status: 'active' },
      { id: 'a3', variant_type: 'on_dark', storage_path: 'ondark.png', status: 'active' },
    ];

    const result = await resolveStoreIdentity(baseStore as any);
    expect(result.identityState).toBe('logo');
    expect(result.signature.type).toBe('logo');
    expect(result.signature.url).toContain('normalized.png');
  });

  it('falls back to original when no normalized variant', async () => {
    data.assets = [
      { id: 'a1', variant_type: 'original', storage_path: 'original.png', status: 'active' },
      { id: 'a3', variant_type: 'on_dark', storage_path: 'ondark.png', status: 'active' },
    ];

    const result = await resolveStoreIdentity(baseStore as any);
    expect(result.signature.type).toBe('logo');
    expect(result.signature.url).toContain('original.png');
  });

  it('falls back to on_dark when no normalized or original', async () => {
    data.assets = [
      { id: 'a3', variant_type: 'on_dark', storage_path: 'ondark.png', status: 'active' },
    ];

    const result = await resolveStoreIdentity(baseStore as any);
    expect(result.signature.type).toBe('logo');
    expect(result.signature.url).toContain('ondark.png');
  });

  it('returns null URL when no assets exist despite logo state', async () => {
    data.assets = [];

    const result = await resolveStoreIdentity(baseStore as any);
    expect(result.identityState).toBe('logo');
    expect(result.signature.url).toBeNull();
    expect(result.signature.type).toBeNull();
  });
});
