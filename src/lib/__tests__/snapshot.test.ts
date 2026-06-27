import { describe, it, expect } from 'vitest';
import { buildStoreProfileInputSnapshot, SNAPSHOT_FIELDS } from '@/lib/snapshot';

describe('buildStoreProfileInputSnapshot', () => {
  const mockStore = {
    segment: 'moda-calcados-acessorios',
    subsegment: 'calcados-femininos',
    tone_of_voice: 'moderno',
    name: 'Minha Loja',
    positioning: 'A melhor loja da cidade',
    short_description: 'Loja de calçados femininos',
    slogan: 'Estilo que encanta',
  };

  it('returns exactly 7 keys', () => {
    const result = buildStoreProfileInputSnapshot(mockStore);
    expect(Object.keys(result).length).toBe(7);
  });

  it('preserves null as null', () => {
    const result = buildStoreProfileInputSnapshot({
      segment: 'outros',
      subsegment: null,
      tone_of_voice: null,
      name: 'Loja Teste',
      positioning: null,
      short_description: null,
      slogan: null,
    });
    expect(result.subsegment).toBeNull();
    expect(result.tone_of_voice).toBeNull();
    expect(result.positioning).toBeNull();
    expect(result.short_description).toBeNull();
    expect(result.slogan).toBeNull();
    expect(result.segment).toBe('outros');
    expect(result.name).toBe('Loja Teste');
  });

  it('preserves string values', () => {
    const result = buildStoreProfileInputSnapshot(mockStore);
    expect(result.segment).toBe('moda-calcados-acessorios');
    expect(result.subsegment).toBe('calcados-femininos');
    expect(result.tone_of_voice).toBe('moderno');
    expect(result.name).toBe('Minha Loja');
    expect(result.positioning).toBe('A melhor loja da cidade');
    expect(result.short_description).toBe('Loja de calçados femininos');
    expect(result.slogan).toBe('Estilo que encanta');
  });
});

describe('SNAPSHOT_FIELDS', () => {
  it('has exactly 7 fields', () => {
    expect(SNAPSHOT_FIELDS.length).toBe(7);
  });

  it('does not include brand_color or accent_color', () => {
    expect(SNAPSHOT_FIELDS).not.toContain('brand_color');
    expect(SNAPSHOT_FIELDS).not.toContain('accent_color');
  });

  it('includes all 7 text fields', () => {
    expect(SNAPSHOT_FIELDS).toContain('segment');
    expect(SNAPSHOT_FIELDS).toContain('subsegment');
    expect(SNAPSHOT_FIELDS).toContain('tone_of_voice');
    expect(SNAPSHOT_FIELDS).toContain('name');
    expect(SNAPSHOT_FIELDS).toContain('positioning');
    expect(SNAPSHOT_FIELDS).toContain('short_description');
    expect(SNAPSHOT_FIELDS).toContain('slogan');
  });
});
