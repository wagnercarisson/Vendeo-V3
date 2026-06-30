import { describe, it, expect } from 'vitest';
import { computeDriftStatus, normalizeSnapshotValue, DRIFT_FIELDS, currentVisualState } from '@/lib/drift';
import type { StoreProfileInputSnapshot } from '@/lib/snapshot';
import { buildStoreProfileInputSnapshot } from '@/lib/snapshot';
import type { Store } from '@/lib/store';

describe('DRIFT_FIELDS', () => {
  it('has exactly 4 fields', () => {
    expect(DRIFT_FIELDS.length).toBe(4);
  });

  it('includes segment, subsegment, tone_of_voice, name', () => {
    expect(DRIFT_FIELDS).toContain('segment');
    expect(DRIFT_FIELDS).toContain('subsegment');
    expect(DRIFT_FIELDS).toContain('tone_of_voice');
    expect(DRIFT_FIELDS).toContain('name');
  });

  it('does not include brand_color or accent_color', () => {
    expect(DRIFT_FIELDS).not.toContain('brand_color');
    expect(DRIFT_FIELDS).not.toContain('accent_color');
  });
});

describe('computeDriftStatus — backward compat', () => {
  const current: StoreProfileInputSnapshot = {
    segment: 'moda-calcados-acessorios',
    subsegment: 'calcados-femininos',
    tone_of_voice: 'moderno',
    name: 'Minha Loja',
    positioning: 'A melhor loja',
    short_description: 'Descrição',
    slogan: 'Slogan',
  };

  it('legacy snapshot without positioning — no false drift', () => {
    const legacySnapshot: Record<string, string | null> = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
    };
    const result = computeDriftStatus(current, legacySnapshot, null);
    expect(result).toBe('none');
  });

  it('only brand_color change in legacy snapshot — no drift', () => {
    const legacySnapshot: Record<string, string | null> = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      brand_color: '#FF0000',
      accent_color: '#00FF00',
    };
    const result = computeDriftStatus(current, legacySnapshot, null);
    expect(result).toBe('none');
  });

  it('positioning/short_description/slogan changes — no drift (inert fields)', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'Posicionamento antigo',
      short_description: 'Descrição antiga',
      slogan: 'Slogan antigo',
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('none');
  });

  it('name change — drift detected', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Outro Nome',
      positioning: null,
      short_description: null,
      slogan: null,
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('new');
  });

  it('null inputSnapshot returns none', () => {
    const result = computeDriftStatus(current, null, null);
    expect(result).toBe('none');
  });

  it('all fields match — no drift', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'A melhor loja',
      short_description: 'Descrição',
      slogan: 'Slogan',
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('none');
  });

  it('segment differs — drift detected as new', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'alimentacao',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: null,
      short_description: null,
      slogan: null,
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('new');
  });

  it('tone_of_voice differs — drift detected as new', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'profissional',
      name: 'Minha Loja',
      positioning: null,
      short_description: null,
      slogan: null,
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('new');
  });

  it('brand_color differs — no drift (not in DRIFT_FIELDS)', () => {
    const snapshot: Record<string, string | null> = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      brand_color: '#FF0000',
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('none');
  });

  it('positioning differs — no drift (not in DRIFT_FIELDS)', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'Posicionamento completamente diferente',
      short_description: 'Descrição',
      slogan: 'Slogan',
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('none');
  });

  it('short_description differs — no drift (not in DRIFT_FIELDS)', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'A melhor loja',
      short_description: 'Descrição completamente diferente',
      slogan: 'Slogan',
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('none');
  });

  it('slogan differs — no drift (not in DRIFT_FIELDS)', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'A melhor loja',
      short_description: 'Descrição',
      slogan: 'Slogan completamente diferente',
    };
    const result = computeDriftStatus(current, snapshot, null);
    expect(result).toBe('none');
  });

  it('drift + dismissedSnapshot matches current — returns dismissed', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'alimentacao',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: null,
      short_description: null,
      slogan: null,
    };
    // dismissedSnapshot must match the CURRENT store values (not the drifted input)
    const dismissed: Partial<StoreProfileInputSnapshot> = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
    };
    const result = computeDriftStatus(current, snapshot, dismissed);
    expect(result).toBe('dismissed');
  });

  it('drift + dismissedSnapshot does NOT match — returns new', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'alimentacao',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: null,
      short_description: null,
      slogan: null,
    };
    const dismissed: Partial<StoreProfileInputSnapshot> = {
      segment: 'moda-calcados-acessorios',
    };
    const result = computeDriftStatus(current, snapshot, dismissed);
    expect(result).toBe('new');
  });
});

describe('normalizeSnapshotValue', () => {
  it('null returns empty string', () => {
    expect(normalizeSnapshotValue(null)).toBe('');
  });

  it('undefined returns empty string', () => {
    expect(normalizeSnapshotValue(undefined)).toBe('');
  });

  it('hex color returns lowercase', () => {
    expect(normalizeSnapshotValue('#FF0000')).toBe('#ff0000');
    expect(normalizeSnapshotValue('#00FF00')).toBe('#00ff00');
  });

  it('hex color with mixed case returns lowercase', () => {
    expect(normalizeSnapshotValue('#AaBbCc')).toBe('#aabbcc');
  });

  it('non-hex string returns unchanged', () => {
    expect(normalizeSnapshotValue('moderno')).toBe('moderno');
    expect(normalizeSnapshotValue('Minha Loja')).toBe('Minha Loja');
  });

  it('empty string returns empty string', () => {
    expect(normalizeSnapshotValue('')).toBe('');
  });
});

describe('currentVisualState', () => {
  it('returns StoreProfileInputSnapshot with 7 fields', () => {
    const store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'> = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'A melhor loja',
      short_description: 'Descrição',
      slogan: 'Slogan',
    };
    const result = currentVisualState(store);
    expect(result).toEqual({
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'A melhor loja',
      short_description: 'Descrição',
      slogan: 'Slogan',
    });
  });

  it('delegates to buildStoreProfileInputSnapshot', () => {
    const store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'> = {
      segment: 'alimentacao',
      subsegment: null,
      tone_of_voice: null,
      name: 'Loja Teste',
      positioning: null,
      short_description: null,
      slogan: null,
    };
    const expected = buildStoreProfileInputSnapshot(store);
    const result = currentVisualState(store);
    expect(result).toEqual(expected);
  });
});
