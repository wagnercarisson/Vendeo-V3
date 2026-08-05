import { describe, it, expect } from 'vitest';
import { computeTabState } from '@/lib/store-onboarding/tab-state';
import type { StoreReadinessResult } from '@/lib/store-readiness';
import type { OnboardingTab } from '@/lib/store-onboarding/tabs';

const readyReadiness: StoreReadinessResult = { ready: true, missing: [] };

const fiscalPendingReadiness: StoreReadinessResult = {
  ready: false,
  missing: [{ item: 'cadastro_fiscal', reason: 'CNPJ ausente' }],
};

const brandPendingReadiness: StoreReadinessResult = {
  ready: false,
  missing: [{ item: 'brand_profile', reason: 'Direção visual ausente' }],
};

const baseCtx = {
  hasLocalEdits: false,
  isPersisted: false,
  unlocked: true,
  readiness: readyReadiness,
};

describe('computeTabState — prioridade (D7)', () => {
  it('fiscal pendente → pending_generation com reason fiscal_pending (domina hasLocalEdits e unlocked)', () => {
    const result = computeTabState('dados', {
      hasLocalEdits: true,
      isPersisted: false,
      unlocked: true,
      readiness: fiscalPendingReadiness,
    });
    expect(result).toEqual({ state: 'pending_generation', reason: 'fiscal_pending' });
  });

  it('fiscal pendente domina até mesmo uma aba bloqueada', () => {
    const result = computeTabState('direcao-visual', {
      hasLocalEdits: false,
      isPersisted: true,
      unlocked: false,
      readiness: fiscalPendingReadiness,
    });
    expect(result).toEqual({ state: 'pending_generation', reason: 'fiscal_pending' });
  });

  it('!unlocked → blocked', () => {
    const result = computeTabState('posicionamento', {
      hasLocalEdits: false,
      isPersisted: true,
      unlocked: false,
      readiness: readyReadiness,
    });
    expect(result).toEqual({ state: 'blocked' });
  });

  it('hasLocalEdits && !isPersisted → draft', () => {
    const result = computeTabState('posicionamento', {
      hasLocalEdits: true,
      isPersisted: false,
      unlocked: true,
      readiness: readyReadiness,
    });
    expect(result).toEqual({ state: 'draft' });
  });

  it('isPersisted && readiness.ready → ready', () => {
    const result = computeTabState('dados', {
      hasLocalEdits: false,
      isPersisted: true,
      unlocked: true,
      readiness: readyReadiness,
    });
    expect(result).toEqual({ state: 'ready' });
  });

  it('isPersisted sem ready → saved (brand_profile pendente não é pending_generation)', () => {
    const result = computeTabState('direcao-visual', {
      hasLocalEdits: false,
      isPersisted: true,
      unlocked: true,
      readiness: brandPendingReadiness,
    });
    expect(result).toEqual({ state: 'saved' });
  });

  it('fallback → blocked', () => {
    const result = computeTabState('dados', baseCtx);
    expect(result).toEqual({ state: 'blocked' });
  });

  it('não é sensível ao tab informado (estado depende do ctx)', () => {
    const r1 = computeTabState('dados', { ...baseCtx, isPersisted: true });
    const r2 = computeTabState('direcao-visual' as OnboardingTab, { ...baseCtx, isPersisted: true });
    expect(r1).toEqual(r2);
  });
});
