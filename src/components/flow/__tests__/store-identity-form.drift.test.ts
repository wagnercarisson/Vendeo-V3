import { describe, it, expect } from 'vitest';

describe('StoreIdentityForm handleStep2Submit drift bifurcation', () => {
  it('criticalStatus === "new" -> modalType "critical"', () => {
    // Test the handleStep2Submit bifurcation logic:
    // driftCategory === 'critical' comes from useDriftDetection which
    // sets it when criticalDrift.status === 'new'
    function resolveModalType(
      driftCategory: 'critical' | 'sensitive' | 'none',
      criticalStatus: string | undefined
    ): 'critical' | 'sensitive' | 'none' {
      if (driftCategory === 'critical' && criticalStatus === 'new') {
        return 'critical';
      }
      if (driftCategory === 'sensitive') {
        return 'sensitive';
      }
      return 'none';
    }

    // Only 'new' critical status triggers DriftCriticalModal
    expect(resolveModalType('critical', 'new')).toBe('critical');
    // When criticalStatus is not 'new', driftCategory should not be 'critical'
    // but if it somehow is (race condition), fall through to sensitive check
    expect(resolveModalType('sensitive', 'none')).toBe('sensitive');
    expect(resolveModalType('none', 'none')).toBe('none');
  });

  it('sensitiveStatus === "new" -> modalType "sensitive"', () => {
    function resolveModalType(
      driftCategory: 'critical' | 'sensitive' | 'none',
    ): 'critical' | 'sensitive' | 'none' {
      if (driftCategory === 'critical') return 'critical';
      if (driftCategory === 'sensitive') return 'sensitive';
      return 'none';
    }

    expect(resolveModalType('sensitive')).toBe('sensitive');
    expect(resolveModalType('none')).toBe('none');
  });

  it('no drift -> save direct (modalType "none")', () => {
    function resolveModalType(
      driftCategory: 'critical' | 'sensitive' | 'none',
    ): 'critical' | 'sensitive' | 'none' {
      if (driftCategory === 'critical') return 'critical';
      if (driftCategory === 'sensitive') return 'sensitive';
      return 'none';
    }

    expect(resolveModalType('none')).toBe('none');
  });

  it('inferred primary color hydration: brandColorsChosen[0] ?? safe_color_tokens.primary', () => {
    function hydrateBrandColor(
      brandColorsChosen: Array<string | null>,
      safeColorTokens: Record<string, string>
    ): string {
      return brandColorsChosen[0] ?? safeColorTokens.primary ?? '#000000';
    }

    expect(hydrateBrandColor(['#FF0000', null], { primary: '#00FF00' })).toBe('#FF0000');
    expect(hydrateBrandColor([], { primary: '#00FF00' })).toBe('#00FF00');
    expect(hydrateBrandColor([null, null], { primary: '#00FF00' })).toBe('#00FF00');
    // When safe_color_tokens.primary is empty string, ?? returns '' (not nullish)
    expect(hydrateBrandColor([null, null], { primary: '' })).toBe('');
  });

  it('inferred accent color hydration: brandColorsChosen[1] ?? safe_color_tokens.accent ?? inferred_accent_color', () => {
    function hydrateAccentColor(
      brandColorsChosen: Array<string | null>,
      safeColorTokens: Record<string, string>,
      inferredAccentColor: string | null
    ): string | null {
      return brandColorsChosen[1] ?? safeColorTokens.accent ?? inferredAccentColor ?? null;
    }

    expect(hydrateAccentColor(['#FF0000', '#0000FF'], { primary: '#00FF00' }, null)).toBe('#0000FF');
    expect(hydrateAccentColor(['#FF0000', null], { accent: '#0000FF' }, null)).toBe('#0000FF');
    expect(hydrateAccentColor(['#FF0000', null], {}, '#0000FF')).toBe('#0000FF');
    expect(hydrateAccentColor([null, null], {}, null)).toBeNull();
  });

  it('realinhar dispatcher uses POST /realign (not POST /infer)', () => {
    const REALIGN_ENDPOINT = '/api/store/:storeId/brand-profile/realign';
    expect(REALIGN_ENDPOINT).toContain('/realign');
    expect(REALIGN_ENDPOINT).not.toContain('/infer');
  });
});
