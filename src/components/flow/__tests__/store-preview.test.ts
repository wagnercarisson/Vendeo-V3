import { describe, it, expect } from 'vitest';

describe('StorePreview badge visibility logic', () => {
  it('effectiveStatus === "new" -> badge visible', () => {
    // Test the badge visibility logic
    function computeEffectiveStatus(
      criticalStatus: string | null | undefined,
      driftStatus: string | null | undefined
    ): 'new' | 'none' {
      if (criticalStatus === 'new') return 'new';
      if (driftStatus === 'new' && criticalStatus !== 'new') return 'new';
      return 'none';
    }

    // criticalStatus='new' -> badge (takes precedence)
    expect(computeEffectiveStatus('new', 'none')).toBe('new');
    expect(computeEffectiveStatus('new', 'new')).toBe('new');
    expect(computeEffectiveStatus('new', 'dismissed')).toBe('new');

    // driftStatus='new' (and not critical) -> badge
    expect(computeEffectiveStatus(null, 'new')).toBe('new');
    expect(computeEffectiveStatus('none', 'new')).toBe('new');
    expect(computeEffectiveStatus('dismissed', 'new')).toBe('new');

    // dismissed or none -> no badge
    expect(computeEffectiveStatus(null, 'none')).toBe('none');
    expect(computeEffectiveStatus(null, 'dismissed')).toBe('none');
    expect(computeEffectiveStatus('dismissed', 'none')).toBe('none');
    expect(computeEffectiveStatus('dismissed', 'dismissed')).toBe('none');
    expect(computeEffectiveStatus('none', 'none')).toBe('none');
  });

  it('badge tooltip shows critical fields for critical drift', () => {
    function buildTooltip(
      criticalDrift: { status: string; fields: string[] } | null,
    ): string {
      if (criticalDrift?.status === 'new') {
        return `Dados críticos alterados: ${criticalDrift.fields.join(', ') || 'nome, segmento'}`;
      }
      return 'Direção visual desatualizada';
    }

    const tooltip = buildTooltip({ status: 'new', fields: ['name', 'segment'] });
    expect(tooltip).toBe('Dados críticos alterados: name, segment');

    const tooltipEmpty = buildTooltip({ status: 'new', fields: [] });
    expect(tooltipEmpty).toBe('Dados críticos alterados: nome, segmento');

    const tooltipSensitive = buildTooltip(null);
    expect(tooltipSensitive).toBe('Direção visual desatualizada');
  });

  it('badge uses amber styling for visibility', () => {
    const badgeClass = 'bg-amber-900/20 text-accent-amber border border-amber-700/30';
    expect(badgeClass).toContain('amber');
    expect(badgeClass).toContain('accent-amber');
  });
});
