import { describe, it, expect } from 'vitest';
import type { StoreIdentitySnapshot } from '@/components/campaign/types';

// Inline normalization logic (mirrors what preview/page.tsx does)
function normalizeLegacy(payload: Record<string, unknown>): StoreIdentitySnapshot {
  const legacy = payload.storeIdentity as Record<string, unknown> | undefined;
  if (!legacy) throw new Error('Missing storeIdentity');

  if ('identityState' in legacy) {
    return legacy as unknown as StoreIdentitySnapshot;
  }

  const hasLogoUrl = typeof legacy.logoUrl === 'string' && (legacy.logoUrl as string).length > 0;
  const hasVsUrl = typeof legacy.visualSignatureUrl === 'string' && (legacy.visualSignatureUrl as string).length > 0;

  if (hasLogoUrl) {
    legacy.identityState = 'logo';
    legacy.signature = { url: legacy.logoUrl, type: 'logo' };
  } else if (hasVsUrl) {
    legacy.identityState = 'visual_signature';
    legacy.signature = { url: legacy.visualSignatureUrl, type: 'visual_signature' };
  } else {
    legacy.identityState = 'text_only';
    legacy.signature = { url: null, type: null };
  }

  return legacy as unknown as StoreIdentitySnapshot;
}

describe('preview legacy normalization', () => {
  it('legacy with logoUrl derives identityState=logo', () => {
    const payload = {
      storeIdentity: {
        storeName: 'Loja',
        storeSegment: 'outros',
        brandColor: '#000',
        logoUrl: 'https://example.com/logo.png',
        visualSignatureUrl: null,
        storeInitials: 'LO',
        brandProfile: null,
      },
      campaignSpec: {},
      productImageUrl: null,
      generatedAt: '2026-01-01',
    };

    const result = normalizeLegacy(payload);
    expect(result.identityState).toBe('logo');
    expect(result.signature).toEqual({ url: 'https://example.com/logo.png', type: 'logo' });
  });

  it('legacy with visualSignatureUrl derives identityState=visual_signature', () => {
    const payload = {
      storeIdentity: {
        storeName: 'Loja',
        storeSegment: 'outros',
        brandColor: '#000',
        logoUrl: null,
        visualSignatureUrl: 'https://example.com/vs.png',
        storeInitials: 'LO',
        brandProfile: null,
      },
      campaignSpec: {},
      productImageUrl: null,
      generatedAt: '2026-01-01',
    };

    const result = normalizeLegacy(payload);
    expect(result.identityState).toBe('visual_signature');
    expect(result.signature).toEqual({ url: 'https://example.com/vs.png', type: 'visual_signature' });
  });

  it('legacy without assets derives identityState=text_only', () => {
    const payload = {
      storeIdentity: {
        storeName: 'Loja',
        storeSegment: 'outros',
        brandColor: '#000',
        logoUrl: null,
        visualSignatureUrl: null,
        storeInitials: 'LO',
        brandProfile: null,
      },
      campaignSpec: {},
      productImageUrl: null,
      generatedAt: '2026-01-01',
    };

    const result = normalizeLegacy(payload);
    expect(result.identityState).toBe('text_only');
    expect(result.signature).toEqual({ url: null, type: null });
  });

  it('new format (with identityState) passes through unchanged', () => {
    const payload = {
      storeIdentity: {
        storeName: 'Loja',
        storeSegment: 'outros',
        brandColor: '#000',
        identityState: 'logo',
        signature: { url: 'https://example.com/logo.png', type: 'logo' },
        storeInitials: 'LO',
        brandProfile: null,
      },
      campaignSpec: {},
      productImageUrl: null,
      generatedAt: '2026-01-01',
    };

    const result = normalizeLegacy(payload);
    expect(result.identityState).toBe('logo');
    expect(result.signature.url).toBe('https://example.com/logo.png');
  });
});
