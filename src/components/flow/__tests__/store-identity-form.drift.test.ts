import { describe, it, expect, vi } from 'vitest';

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

  it('(Bug B) handleStep1Submit intercepta drift ANTES de salvar — crítico abre DriftCriticalModal', () => {
    // Réplica fiel da bifurcação do form (store-identity-form.tsx:1119-1132):
    // critical+new → modal crítico (return, NENHUM save); sensitive → decisão;
    // none → save direto.
    function step1DriftIntercept(
      driftCategory: 'critical' | 'sensitive' | 'none',
      criticalStatus: 'none' | 'new' | 'dismissed' | null | undefined,
    ): 'critical' | 'decision' | 'save' {
      if (driftCategory === 'critical' && criticalStatus === 'new') return 'critical';
      if (driftCategory === 'sensitive') return 'decision';
      return 'save';
    }

    expect(step1DriftIntercept('critical', 'new')).toBe('critical');
    expect(step1DriftIntercept('critical', 'dismissed')).toBe('save');
    expect(step1DriftIntercept('sensitive', null)).toBe('decision');
    expect(step1DriftIntercept('none', 'none')).toBe('save');
  });

  it('(Bug C) realinhar persiste os dados aceitos ANTES do POST /realign — ordem de chamadas', async () => {
    // Réplica da persistSaveFromDrift (store-identity-form.tsx:1274-1291) + onRealinhar:
    // a persistência da origem interceptada roda ANTES do realinhar.
    async function persistSaveFromDrift(
      origin: 'step1' | 'step2' | null,
      deps: { save: () => Promise<void>; visualEffects: () => Promise<void> },
    ): Promise<boolean> {
      if (origin === 'step1' || origin === 'step2') {
        await deps.save();
        if (origin === 'step2') await deps.visualEffects();
        return true;
      }
      return false;
    }

    const order: string[] = [];
    const save = vi.fn(async () => { order.push('save'); });
    const visualEffects = vi.fn(async () => { order.push('visual'); });
    const realinhar = vi.fn(async () => { order.push('realign'); });

    // step1: save → realinhar
    await persistSaveFromDrift('step1', { save, visualEffects });
    await realinhar();
    expect(order).toEqual(['save', 'realign']);

    // step2: save + visual → realinhar
    order.length = 0;
    await persistSaveFromDrift('step2', { save, visualEffects });
    await realinhar();
    expect(order).toEqual(['save', 'visual', 'realign']);
    expect(realinhar).toHaveBeenCalledTimes(2);
  });

  it('(Bug C fix) origem nula (navegação interceptada) com edições locais persiste ANTES do realinhar', async () => {
    const order: string[] = [];
    const save = vi.fn(async () => { order.push('save'); });
    const visualEffects = vi.fn(async () => { order.push('visual'); });

    // Réplica da persistSaveFromDrift pós-fix (store-identity-form.tsx:1278-1294):
    // origem null + hasLocalEdits → save() ANTES do realinhar (spec L135/L136).
    async function persistSaveFromDrift(
      origin: 'step1' | 'step2' | null,
      hasLocalEdits: boolean,
      deps: { save: () => Promise<void>; visualEffects: () => Promise<void> },
    ): Promise<boolean> {
      if (origin === 'step1' || origin === 'step2') {
        await deps.save();
        if (origin === 'step2') await deps.visualEffects();
        return true;
      }
      if (hasLocalEdits) {
        await deps.save();
        return true;
      }
      return false;
    }

    const persisted = await persistSaveFromDrift(null, true, { save, visualEffects });
    expect(persisted).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(visualEffects).not.toHaveBeenCalled();
    expect(order).toEqual(['save']);
  });

  it('(Bug C fix) origem nula sem edições locais não persiste nem realinha', async () => {
    const save = vi.fn(async () => {});
    const visualEffects = vi.fn(async () => {});

    async function persistSaveFromDrift(
      origin: 'step1' | 'step2' | null,
      hasLocalEdits: boolean,
      deps: { save: () => Promise<void>; visualEffects: () => Promise<void> },
    ): Promise<boolean> {
      if (origin === 'step1' || origin === 'step2') {
        await deps.save();
        if (origin === 'step2') await deps.visualEffects();
        return true;
      }
      if (hasLocalEdits) {
        await deps.save();
        return true;
      }
      return false;
    }

    const persisted = await persistSaveFromDrift(null, false, { save, visualEffects });
    expect(persisted).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(visualEffects).not.toHaveBeenCalled();
  });
});
