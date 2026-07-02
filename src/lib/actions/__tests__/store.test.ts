import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StoreIdentitySnapshot, CampaignBrief, IdentityState, CampaignInput } from '@/components/campaign/types';

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/asset.png' } })),
      })),
    },
  },
}));

vi.mock('@/lib/visual-signature/persistence', () => ({
  getActiveVisualSignature: vi.fn(),
}));

vi.mock('@/lib/store', () => ({
  getDefaultBrandColor: vi.fn(() => '#22C55E'),
  getStoreInitials: vi.fn((name: string) => name.slice(0, 2).toUpperCase()),
}));

// Import after mocks
import { resolveStoreIdentity, validateIdentityReference, buildCampaignBrief } from '../store';
import type { Store } from '@/lib/store';
import { getActiveVisualSignature } from '@/lib/visual-signature/persistence';

const mockStore = (overrides: Partial<Pick<Store, 'id' | 'name' | 'segment' | 'brand_color' | 'identity_state' | 'subsegment' | 'tone_of_voice' | 'positioning' | 'short_description' | 'slogan'>> = {}) => ({
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
  identity_state: 'text_only' as string | null,
  ...overrides,
});

const mockCampaignInput: CampaignInput = {
  productName: 'Produto Teste',
  discountedPriceCents: 1990,
  productImageDataUrl: 'data:image/jpeg;base64,abc123',
};

describe('resolveStoreIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('text_only state: identityState=text_only, signature.url=null', async () => {
    const store = mockStore({ identity_state: 'text_only' });
    const result = await resolveStoreIdentity(store);

    expect(result.identityState).toBe('text_only');
    expect(result.signature.url).toBeNull();
    expect(result.signature.type).toBeNull();
  });

  it('logo state with missing asset: returns null URL and type, identityState unchanged', async () => {
    const store = mockStore({ identity_state: 'logo' });
    const result = await resolveStoreIdentity(store);

    expect(result.identityState).toBe('logo');
    expect(result.signature.type).toBeNull();
    expect(result.signature.url).toBeNull();
  });

  it('visual_signature state with missing VS: returns null URL, identityState unchanged', async () => {
    vi.mocked(getActiveVisualSignature).mockResolvedValue(null);

    const store = mockStore({ identity_state: 'visual_signature' });
    const result = await resolveStoreIdentity(store);

    expect(result.identityState).toBe('visual_signature');
    expect(result.signature.url).toBeNull();
  });

  it('text_only: brandProfile may be null but still returns', async () => {
    const store = mockStore({ identity_state: 'text_only' });
    const result = await resolveStoreIdentity(store);

    expect(result.identityState).toBe('text_only');
    expect(result.signature.url).toBeNull();
    expect(result.storeName).toBe('Minha Loja');
  });
});

describe('validateIdentityReference', () => {
  it('null URL returns copy without fetch', async () => {
    const snapshot: StoreIdentitySnapshot = {
      storeName: 'Test',
      storeSegment: 'outros',
      brandColor: '#000',
      identityState: 'text_only',
      signature: { url: null, type: null },
      storeInitials: 'TE',
      brandProfile: null,
      toneOfVoice: null,
      subsegment: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
    };

    const result = await validateIdentityReference(snapshot);
    expect(result).not.toBe(snapshot); // must be a copy
    expect(result.signature.url).toBeNull();
  });

  it('returns copy with nulled URL on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const snapshot: StoreIdentitySnapshot = {
      storeName: 'Test',
      storeSegment: 'outros',
      brandColor: '#000',
      identityState: 'logo',
      signature: { url: 'https://example.com/logo.png', type: 'logo' },
      storeInitials: 'TE',
      brandProfile: null,
      toneOfVoice: null,
      subsegment: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
    };

    const result = await validateIdentityReference(snapshot);
    expect(result).not.toBe(snapshot);
    expect(result.signature.url).toBeNull();
    expect(result.identityState).toBe('logo'); // preserved
  });

  it('returns copy unchanged on successful fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const snapshot: StoreIdentitySnapshot = {
      storeName: 'Test',
      storeSegment: 'outros',
      brandColor: '#000',
      identityState: 'logo',
      signature: { url: 'https://example.com/logo.png', type: 'logo' },
      storeInitials: 'TE',
      brandProfile: null,
      toneOfVoice: null,
      subsegment: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
    };

    const result = await validateIdentityReference(snapshot);
    expect(result).not.toBe(snapshot);
    expect(result.signature.url).toBe('https://example.com/logo.png');
  });
});

describe('buildCampaignBrief', () => {
  const baseSnapshot = (overrides: Partial<StoreIdentitySnapshot> = {}): StoreIdentitySnapshot => ({
    storeName: 'Minha Loja',
    storeSegment: 'outros',
    brandColor: '#22C55E',
    identityState: 'text_only',
    signature: { url: null, type: null },
    storeInitials: 'ML',
    brandProfile: null,
    toneOfVoice: null,
    subsegment: null,
    positioning: null,
    shortDescription: null,
    slogan: null,
    ...overrides,
  });

  it('text_only directive: no logo, no VS', async () => {
    const snapshot = baseSnapshot({ identityState: 'text_only' });
    const brief = await buildCampaignBrief(snapshot, mockCampaignInput);

    expect(brief.identity.state).toBe('text_only');
    expect(brief.identity.imageUrl).toBeNull();
    expect(brief.identity.directive).toContain('Não colocar logotipo');
    expect(brief.identity.directive).toContain('Não gerar assinatura visual');
  });

  it('logo with asset directive', async () => {
    const snapshot = baseSnapshot({
      identityState: 'logo',
      signature: { url: 'https://example.com/logo.png', type: 'logo' },
    });
    const brief = await buildCampaignBrief(snapshot, mockCampaignInput);

    expect(brief.identity.state).toBe('logo');
    expect(brief.identity.imageUrl).toBe('https://example.com/logo.png');
    expect(brief.identity.directive).toContain('Assinar a campanha com o logotipo da loja');
  });

  it('logo without asset directive', async () => {
    const snapshot = baseSnapshot({
      identityState: 'logo',
      signature: { url: null, type: 'logo' },
    });
    const brief = await buildCampaignBrief(snapshot, mockCampaignInput);

    expect(brief.identity.directive).toContain('Não inventar logotipo');
  });

  it('VS with asset directive', async () => {
    const snapshot = baseSnapshot({
      identityState: 'visual_signature',
      signature: { url: 'https://example.com/vs.png', type: 'visual_signature' },
    });
    const brief = await buildCampaignBrief(snapshot, mockCampaignInput);

    expect(brief.identity.directive).toContain('Assinar a campanha com a assinatura visual');
    expect(brief.identity.directive).toContain('Não adicionar logotipo');
  });

  it('VS without asset directive', async () => {
    const snapshot = baseSnapshot({
      identityState: 'visual_signature',
      signature: { url: null, type: 'visual_signature' },
    });
    const brief = await buildCampaignBrief(snapshot, mockCampaignInput);

    expect(brief.identity.directive).toContain('Não inventar assinatura visual nem logotipo');
  });

  it('campaignInput passed through without modification', async () => {
    const snapshot = baseSnapshot({ identityState: 'text_only' });
    const brief = await buildCampaignBrief(snapshot, mockCampaignInput);

    expect(brief.campaignInput.productName).toBe('Produto Teste');
    expect(brief.campaignInput.discountedPriceCents).toBe(1990);
  });

  it('campaignInput preserves optional fields as undefined', async () => {
    const minimalInput: CampaignInput = {
      productName: 'Teste',
      discountedPriceCents: 990,
      productImageDataUrl: 'data:image/png;base64,xyz',
    };
    const snapshot = baseSnapshot({ identityState: 'text_only' });
    const brief = await buildCampaignBrief(snapshot, minimalInput);

    expect(brief.campaignInput.productName).toBe('Teste');
    expect(brief.campaignInput.description).toBeUndefined();
    expect(brief.campaignInput.hook).toBeUndefined();
    expect(brief.campaignInput.cta).toBeUndefined();
    expect(brief.campaignInput.badgeText).toBeUndefined();
  });

  it('store fields populated from snapshot', async () => {
    const snapshot = baseSnapshot({
      storeName: 'Loja Exemplo',
      storeSegment: 'moda-calcados-acessorios',
      brandColor: '#EC4899',
      toneOfVoice: 'jovem',
      subsegment: 'calcados',
      positioning: 'Premium',
      shortDescription: 'Loja de calçados',
      slogan: 'Seu estilo nossa paixão',
    });
    const brief = await buildCampaignBrief(snapshot, mockCampaignInput);

    expect(brief.store.name).toBe('Loja Exemplo');
    expect(brief.store.segment).toBe('moda-calcados-acessorios');
    expect(brief.store.brandColor).toBe('#EC4899');
    expect(brief.store.toneOfVoice).toBe('jovem');
    expect(brief.store.subsegment).toBe('calcados');
  });
});
