import { describe, it, expect } from 'vitest';
import { revalidateCriticalDrift } from '@/lib/visual-signature/drift-revalidator';
import type { DriftRevalidationInput } from '@/lib/visual-signature/drift-revalidator';

const validVsSnapshot = {
  name: 'Minha Loja',
  segment: 'alimentacao',
  subsegment: 'padaria',
  tone_of_voice: 'moderno',
  positioning: 'A melhor padaria',
  short_description: 'Descrição',
  slogan: 'Melhor da cidade',
  city: 'São Paulo',
  state: 'SP',
  brand_color: '#FF0000',
  accent_color: '#00FF00',
};

const validStore = {
  name: 'Minha Loja',
  segment: 'alimentacao',
  slogan: 'Melhor da cidade',
  city: 'São Paulo',
  state: 'SP',
};

function makeInput(overrides?: Partial<DriftRevalidationInput>): DriftRevalidationInput {
  return {
    vsSnapshot: validVsSnapshot,
    contentUsed: { slogan: true, city: true, state: true },
    store: validStore,
    ...overrides,
  };
}

describe('revalidateCriticalDrift', () => {
  it('snapshot absent returns reason: missing_metadata', () => {
    const result = revalidateCriticalDrift(makeInput({ vsSnapshot: null }));
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toEqual([]);
    expect(result.reason).toBe('missing_metadata');
  });

  it('snapshot undefined returns reason: missing_metadata', () => {
    const result = revalidateCriticalDrift(makeInput({ vsSnapshot: undefined }));
    expect(result.hasDrift).toBe(true);
    expect(result.reason).toBe('missing_metadata');
  });

  it('drift present returns reason: critical_drift with fields', () => {
    const result = revalidateCriticalDrift(makeInput({
      store: { ...validStore, name: 'Outro Nome' },
    }));
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toContain('name');
    expect(result.reason).toBe('critical_drift');
  });

  it('no drift returns reason: ok', () => {
    const result = revalidateCriticalDrift(makeInput());
    expect(result.hasDrift).toBe(false);
    expect(result.fields).toEqual([]);
    expect(result.reason).toBe('ok');
  });

  it('content_used controls which optional fields are checked', () => {
    const result = revalidateCriticalDrift(makeInput({
      contentUsed: { slogan: true, city: false, state: false },
      store: { ...validStore, city: 'Rio de Janeiro' },
    }));
    // city is not checked because contentUsed.city=false
    expect(result.hasDrift).toBe(false);
    expect(result.reason).toBe('ok');
  });

  it('absent property in snapshot is skipped', () => {
    const partialSnapshot: Record<string, unknown> = {
      name: 'Minha Loja',
      segment: 'alimentacao',
    };
    const result = revalidateCriticalDrift(makeInput({
      vsSnapshot: partialSnapshot as typeof validVsSnapshot,
      store: { ...validStore, slogan: 'Novo slogan', city: 'Rio', state: 'RJ' },
    }));
    // slogan, city, state absent from snapshot → skipped
    expect(result.hasDrift).toBe(false);
    expect(result.reason).toBe('ok');
  });
});
