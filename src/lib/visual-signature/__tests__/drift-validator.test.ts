import { describe, it, expect } from 'vitest';
import { validateDrift } from '@/lib/visual-signature/drift-validator';
import type { DriftValidationInput } from '@/lib/visual-signature/drift-validator';

const validSnapshot = {
  name: 'Minha Loja',
  segment: 'alimentacao',
  city: 'São Paulo',
  state: 'SP',
  slogan: 'Melhor da cidade',
};

const validContentUsed = {
  store_name: true,
  city: true,
  state: true,
  slogan: true,
};

const validStoreData = {
  name: 'Minha Loja',
  segment: 'alimentacao',
  city: 'São Paulo',
  state: 'SP',
  slogan: 'Melhor da cidade',
};

function makeInput(overrides?: Partial<DriftValidationInput>): DriftValidationInput {
  return {
    input_snapshot: validSnapshot,
    content_used: validContentUsed,
    currentStoreData: validStoreData,
    ...overrides,
  };
}

describe('validateDrift', () => {
  describe('null/absent metadata', () => {
    it('null input_snapshot returns has_drift:true reason:missing_metadata', () => {
      const result = validateDrift(makeInput({ input_snapshot: null }));
      expect(result.has_drift).toBe(true);
      expect(result.reason).toBe('missing_metadata');
      expect(result.requires_regeneration).toBe(true);
    });

    it('undefined input_snapshot returns has_drift:true reason:missing_metadata', () => {
      const result = validateDrift(makeInput({ input_snapshot: undefined }));
      expect(result.has_drift).toBe(true);
      expect(result.reason).toBe('missing_metadata');
    });

    it('null content_used returns has_drift:true reason:missing_metadata', () => {
      const result = validateDrift(makeInput({ content_used: null }));
      expect(result.has_drift).toBe(true);
      expect(result.reason).toBe('missing_metadata');
    });

    it('undefined content_used returns has_drift:true reason:missing_metadata', () => {
      const result = validateDrift(makeInput({ content_used: undefined }));
      expect(result.has_drift).toBe(true);
      expect(result.reason).toBe('missing_metadata');
    });
  });

  describe('all fields match', () => {
    it('all fields identical returns has_drift:false reason:ok', () => {
      const result = validateDrift(makeInput());
      expect(result.has_drift).toBe(false);
      expect(result.reason).toBe('ok');
      expect(result.fields).toEqual([]);
      expect(result.requires_regeneration).toBe(false);
    });
  });

  describe('individual field drift', () => {
    it('name differs — fields includes name', () => {
      const result = validateDrift(makeInput({
        currentStoreData: { ...validStoreData, name: 'Outro Nome' },
      }));
      expect(result.has_drift).toBe(true);
      expect(result.fields).toContain('name');
      expect(result.reason).toBe('critical_drift');
    });

    it('segment differs — fields includes segment', () => {
      const result = validateDrift(makeInput({
        currentStoreData: { ...validStoreData, segment: 'moda-calcados-acessorios' },
      }));
      expect(result.has_drift).toBe(true);
      expect(result.fields).toContain('segment');
    });
  });

  describe('content_used conditional logic', () => {
    it('content_used.city=true + city differs — fields includes city', () => {
      const result = validateDrift(makeInput({
        currentStoreData: { ...validStoreData, city: 'Rio de Janeiro' },
      }));
      expect(result.has_drift).toBe(true);
      expect(result.fields).toContain('city');
    });

    it('content_used.city=false + city differs — city NOT in fields', () => {
      const result = validateDrift(makeInput({
        content_used: { ...validContentUsed, city: false },
        currentStoreData: { ...validStoreData, city: 'Rio de Janeiro' },
      }));
      expect(result.has_drift).toBe(false);
      expect(result.fields).not.toContain('city');
    });

    it('content_used.state=true + state differs — fields includes state', () => {
      const result = validateDrift(makeInput({
        currentStoreData: { ...validStoreData, state: 'RJ' },
      }));
      expect(result.has_drift).toBe(true);
      expect(result.fields).toContain('state');
    });

    it('content_used.slogan=true + slogan differs — fields includes slogan', () => {
      const result = validateDrift(makeInput({
        currentStoreData: { ...validStoreData, slogan: 'Slogan novo' },
      }));
      expect(result.has_drift).toBe(true);
      expect(result.fields).toContain('slogan');
    });

    it('content_used.slogan=false + slogan differs — slogan NOT in fields', () => {
      const result = validateDrift(makeInput({
        content_used: { ...validContentUsed, slogan: false },
        currentStoreData: { ...validStoreData, slogan: 'Slogan novo' },
      }));
      expect(result.has_drift).toBe(false);
      expect(result.fields).not.toContain('slogan');
    });
  });

  describe('multiple fields drift', () => {
    it('multiple fields differ — all drifted fields in array', () => {
      const result = validateDrift(makeInput({
        currentStoreData: {
          name: 'Outro Nome',
          segment: 'moda-calcados-acessorios',
          city: 'Rio de Janeiro',
          state: 'RJ',
          slogan: 'Slogan novo',
        },
      }));
      expect(result.has_drift).toBe(true);
      expect(result.fields).toContain('name');
      expect(result.fields).toContain('segment');
      expect(result.fields).toContain('city');
      expect(result.fields).toContain('state');
      expect(result.fields).toContain('slogan');
      expect(result.fields.length).toBe(5);
    });
  });

  describe('snapshot with null values', () => {
    it('city is null in snapshot but not in store — drift only if content_used.city=true', () => {
      const result = validateDrift(makeInput({
        input_snapshot: { ...validSnapshot, city: null },
        content_used: { ...validContentUsed, city: true },
        currentStoreData: { ...validStoreData, city: 'São Paulo' },
      }));
      // null !== 'São Paulo' when city is used
      expect(result.has_drift).toBe(true);
      expect(result.fields).toContain('city');
    });

    it('city is null in snapshot and content_used.city=false — no drift', () => {
      const result = validateDrift(makeInput({
        input_snapshot: { ...validSnapshot, city: null },
        content_used: { ...validContentUsed, city: false },
        currentStoreData: { ...validStoreData, city: 'São Paulo' },
      }));
      expect(result.has_drift).toBe(false);
    });
  });
});
