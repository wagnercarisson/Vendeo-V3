import { describe, it, expect } from 'vitest';
import {
  TAB_ORDER,
  ONBOARDING_TABS,
  computeTabUnlock,
  isOnboardingTab,
} from '@/lib/store-onboarding/tabs';
import type { OnboardingTab } from '@/lib/store-onboarding/tabs';

const baseCtx = {
  name: 'Minha Loja',
  segment: 'moda-calcados-acessorios',
  legalAccepted: true,
  storeId: 'store-1',
  toneOfVoice: 'moderno',
  hasVisualDirection: false,
};

describe('TAB_ORDER e ONBOARDING_TABS', () => {
  it('TAB_ORDER tem 3 itens na ordem dados → posicionamento → direcao-visual', () => {
    expect(TAB_ORDER).toEqual(['dados', 'posicionamento', 'direcao-visual']);
    expect(TAB_ORDER).toHaveLength(3);
  });

  it('ONBOARDING_TABS tem 3 defs com labels desktop/mobile (D10)', () => {
    expect(ONBOARDING_TABS).toHaveLength(3);
    expect(ONBOARDING_TABS[0]).toEqual({ id: 'dados', label: 'Dados', labelMobile: 'Dados' });
    expect(ONBOARDING_TABS[1]).toEqual({ id: 'posicionamento', label: 'Posicionamento', labelMobile: 'Perfil' });
    expect(ONBOARDING_TABS[2]).toEqual({ id: 'direcao-visual', label: 'Direção Visual', labelMobile: 'Visual' });
  });

  it('id da aba permanece posicionamento/direcao-visual mesmo com labelMobile curto', () => {
    expect(ONBOARDING_TABS[1].id).toBe('posicionamento');
    expect(ONBOARDING_TABS[2].id).toBe('direcao-visual');
  });
});

describe('computeTabUnlock', () => {
  it('dados sempre desbloqueada com qualquer ctx', () => {
    expect(computeTabUnlock('dados', baseCtx)).toEqual({ unlocked: true });
    expect(
      computeTabUnlock('dados', {
        name: '',
        segment: '',
        legalAccepted: false,
        storeId: null,
        toneOfVoice: '',
        hasVisualDirection: false,
      }),
    ).toEqual({ unlocked: true });
  });

  it('posicionamento sem aceite legal → needs_legal_acceptance', () => {
    const result = computeTabUnlock('posicionamento', {
      ...baseCtx,
      legalAccepted: false,
      storeId: 'store-1',
    });
    expect(result).toEqual({ unlocked: false, reason: 'needs_legal_acceptance' });
  });

  it('posicionamento sem storeId → needs_store_created', () => {
    const result = computeTabUnlock('posicionamento', { ...baseCtx, storeId: null });
    expect(result).toEqual({ unlocked: false, reason: 'needs_store_created' });
  });

  it('posicionamento sem name/segment → needs_store_created', () => {
    const result = computeTabUnlock('posicionamento', {
      ...baseCtx,
      name: '   ',
      segment: '',
    });
    expect(result).toEqual({ unlocked: false, reason: 'needs_store_created' });
  });

  it('posicionamento desbloqueada com mínimo (legal + name + segment + storeId)', () => {
    expect(computeTabUnlock('posicionamento', baseCtx)).toEqual({ unlocked: true });
  });

  it('direcao-visual com hasVisualDirection → unlocked mesmo sem tom de voz (loja existente)', () => {
    const result = computeTabUnlock('direcao-visual', {
      ...baseCtx,
      toneOfVoice: '',
      hasVisualDirection: true,
    });
    expect(result).toEqual({ unlocked: true });
  });

  it('direcao-visual sem storeId → needs_store_created', () => {
    const result = computeTabUnlock('direcao-visual', {
      ...baseCtx,
      storeId: null,
    });
    expect(result).toEqual({ unlocked: false, reason: 'needs_store_created' });
  });

  it('direcao-visual sem toneOfVoice → needs_tone_of_voice', () => {
    const result = computeTabUnlock('direcao-visual', { ...baseCtx, toneOfVoice: '' });
    expect(result).toEqual({ unlocked: false, reason: 'needs_tone_of_voice' });
  });

  it('direcao-visual desbloqueada com storeId + toneOfVoice', () => {
    expect(computeTabUnlock('direcao-visual', baseCtx)).toEqual({ unlocked: true });
  });

  it('CNPJ nunca bloqueia navegação (D8) — ctx sem dados de CNPJ ainda desbloqueia', () => {
    // O ctx de computeTabUnlock nem possui campos de CNPJ — navegação avança
    // até a Direção Visual sem CNPJ
    expect(computeTabUnlock('posicionamento', baseCtx).unlocked).toBe(true);
    expect(computeTabUnlock('direcao-visual', baseCtx).unlocked).toBe(true);
  });

  it('tab inválida → fallback seguro bloqueado', () => {
    const result = computeTabUnlock('tab-inexistente' as OnboardingTab, baseCtx);
    expect(result).toEqual({ unlocked: false, reason: 'needs_store_created' });
  });
});

describe('isOnboardingTab', () => {
  it('retorna true para os 3 valores válidos', () => {
    expect(isOnboardingTab('dados')).toBe(true);
    expect(isOnboardingTab('posicionamento')).toBe(true);
    expect(isOnboardingTab('direcao-visual')).toBe(true);
  });

  it('retorna false para valores inválidos', () => {
    expect(isOnboardingTab('cadastro-fiscal')).toBe(false);
    expect(isOnboardingTab('visual-direction')).toBe(false);
    expect(isOnboardingTab('')).toBe(false);
    expect(isOnboardingTab('Dados')).toBe(false);
  });
});
