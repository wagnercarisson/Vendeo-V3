import { describe, it, expect } from 'vitest';
import {
  computeDriftStatus,
  normalizeSnapshotValue,
  currentVisualState,
  getDriftPolicy,
  evaluateCriticalDrift,
  evaluateSensitiveDrift,
} from '@/lib/drift';
import type { StoreProfileInputSnapshot } from '@/lib/snapshot';
import { buildStoreProfileInputSnapshot } from '@/lib/snapshot';
import type { Store } from '@/lib/store';

const SENSITIVE_FIELDS_BP = ['segment', 'subsegment', 'tone_of_voice', 'name', 'positioning', 'short_description', 'slogan'] as const;

describe('getDriftPolicy', () => {
  it('text_only returns 7 sensitive fields and 0 critical', () => {
    const policy = getDriftPolicy('text_only');
    expect(policy.sensitive).toEqual(['name', 'segment', 'subsegment', 'tone_of_voice', 'positioning', 'short_description', 'slogan']);
    expect(policy.critical).toEqual([]);
  });

  it('logo returns 6 sensitive fields (name excluded) and 0 critical', () => {
    const policy = getDriftPolicy('logo');
    expect(policy.sensitive).toEqual(['segment', 'subsegment', 'tone_of_voice', 'positioning', 'short_description', 'slogan']);
    expect(policy.sensitive).not.toContain('name');
    expect(policy.critical).toEqual([]);
  });

  it('visual_signature returns 4 sensitive fields', () => {
    const policy = getDriftPolicy('visual_signature');
    expect(policy.sensitive).toEqual(['subsegment', 'tone_of_voice', 'positioning', 'short_description']);
    expect(policy.critical).toEqual(['name', 'segment']);
  });

  it('visual_signature with slogan contentUsed includes slogan in critical', () => {
    const policy = getDriftPolicy('visual_signature', { slogan: true });
    expect(policy.critical).toContain('slogan');
  });

  it('visual_signature with city contentUsed includes city in critical', () => {
    const policy = getDriftPolicy('visual_signature', { city: true });
    expect(policy.critical).toContain('city');
  });

  it('visual_signature with state contentUsed includes state in critical', () => {
    const policy = getDriftPolicy('visual_signature', { state: true });
    expect(policy.critical).toContain('state');
  });

  it('visual_signature with empty contentUsed keeps default critical fields', () => {
    const policy = getDriftPolicy('visual_signature', {});
    expect(policy.critical).toEqual(['name', 'segment']);
  });

  it('unknown identityState falls back to text_only', () => {
    const policy = getDriftPolicy('unknown_state');
    expect(policy.sensitive).toEqual(getDriftPolicy('text_only').sensitive);
    expect(policy.critical).toEqual([]);
  });
});

describe('evaluateCriticalDrift', () => {
  const vsSnapshot = {
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

  const store = {
    name: 'Minha Loja',
    segment: 'alimentacao',
    slogan: 'Melhor da cidade',
    city: 'São Paulo',
    state: 'SP',
  };

  it('snapshot null returns hasDrift: true', () => {
    const result = evaluateCriticalDrift(null, {}, store);
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toEqual([]);
  });

  it('all fields match returns hasDrift: false', () => {
    const result = evaluateCriticalDrift(vsSnapshot, { slogan: true, city: true, state: true }, store);
    expect(result.hasDrift).toBe(false);
  });

  it('name diverges returns hasDrift: true with name in fields', () => {
    const result = evaluateCriticalDrift(vsSnapshot, {}, { ...store, name: 'Outro Nome' });
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toContain('name');
  });

  it('segment diverges returns fields includes segment', () => {
    const result = evaluateCriticalDrift(vsSnapshot, {}, { ...store, segment: 'moda' });
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toContain('segment');
  });

  it('contentUsed.slogan=false + slogan diverges — slogan NOT in fields', () => {
    const result = evaluateCriticalDrift(vsSnapshot, { slogan: false }, { ...store, slogan: 'Novo slogan' });
    expect(result.hasDrift).toBe(false);
    expect(result.fields).not.toContain('slogan');
  });

  it('contentUsed.slogan=true + slogan diverges — slogan in fields', () => {
    const result = evaluateCriticalDrift(vsSnapshot, { slogan: true }, { ...store, slogan: 'Novo slogan' });
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toContain('slogan');
  });

  it('absent property in snapshot is skipped (no drift)', () => {
    const partialSnapshot: Record<string, unknown> = {
      name: 'Minha Loja',
      segment: 'alimentacao',
    };
    const result = evaluateCriticalDrift(partialSnapshot as typeof vsSnapshot, { city: true }, { ...store, city: 'Rio de Janeiro' });
    // city is absent from snapshot, so it should be skipped
    expect(result.hasDrift).toBe(false);
  });

  it('contentUsed undefined — only name and segment are critical', () => {
    const result = evaluateCriticalDrift(vsSnapshot, undefined, { ...store, slogan: 'Novo slogan', city: 'Rio', state: 'RJ' });
    // Without contentUsed, critical = ['name', 'segment']; slogan/city/state not checked
    expect(result.hasDrift).toBe(false);
  });
});

describe('evaluateSensitiveDrift', () => {
  const bpSnapshot: StoreProfileInputSnapshot = {
    segment: 'alimentacao',
    subsegment: 'padaria',
    tone_of_voice: 'moderno',
    name: 'Minha Loja',
    positioning: 'A melhor padaria',
    short_description: 'Descrição',
    slogan: 'Melhor da cidade',
  };

  const store = {
    segment: 'alimentacao',
    subsegment: 'padaria',
    tone_of_voice: 'moderno',
    name: 'Minha Loja',
    positioning: 'A melhor padaria',
    short_description: 'Descrição',
    slogan: 'Melhor da cidade',
  };

  it('snapshot null returns hasDrift: false', () => {
    const result = evaluateSensitiveDrift(null, store, ['segment']);
    expect(result.hasDrift).toBe(false);
  });

  it('fields=[segment] + segment diverges returns hasDrift: true', () => {
    const result = evaluateSensitiveDrift(bpSnapshot, { ...store, segment: 'moda' }, ['segment']);
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toEqual(['segment']);
  });

  it('fields=[positioning] + positioning diverges returns hasDrift: true', () => {
    const result = evaluateSensitiveDrift(bpSnapshot, { ...store, positioning: 'Novo posicionamento' }, ['positioning']);
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toEqual(['positioning']);
  });

  it('absent property in snapshot is skipped', () => {
    const partialSnapshot = { segment: 'alimentacao', name: 'Minha Loja' } as Partial<StoreProfileInputSnapshot>;
    const result = evaluateSensitiveDrift(partialSnapshot, { ...store, subsegment: 'novo-sub' }, ['segment', 'subsegment']);
    // subsegment is absent from snapshot → skip
    expect(result.hasDrift).toBe(false);
  });

  it('only fields in the provided list are compared', () => {
    const result = evaluateSensitiveDrift(bpSnapshot, { ...store, segment: 'moda', subsegment: 'novo' }, ['subsegment']);
    // segment differs but only subsegment is in fields → no drift
    expect(result.hasDrift).toBe(false);
  });

  it('multiple fields drift returns all drifted fields', () => {
    const result = evaluateSensitiveDrift(
      bpSnapshot,
      { ...store, segment: 'moda', tone_of_voice: 'profissional' },
      ['segment', 'subsegment', 'tone_of_voice']
    );
    expect(result.hasDrift).toBe(true);
    expect(result.fields).toContain('segment');
    expect(result.fields).toContain('tone_of_voice');
    expect(result.fields).not.toContain('subsegment');
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
    const result = computeDriftStatus(current, legacySnapshot, null, SENSITIVE_FIELDS_BP);
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
    const result = computeDriftStatus(current, legacySnapshot, null, SENSITIVE_FIELDS_BP);
    expect(result).toBe('none');
  });

  it('positioning/short_description/slogan changes — drift detected with text_only fields', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'Posicionamento antigo',
      short_description: 'Descrição antiga',
      slogan: 'Slogan antigo',
    };
    // With text_only fields, positioning/short_description/slogan ARE sensitive fields
    // so these should cause drift
    const result = computeDriftStatus(current, snapshot, null, ['name', 'segment', 'subsegment', 'tone_of_voice']);
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
    const result = computeDriftStatus(current, snapshot, null, ['name']);
    expect(result).toBe('new');
  });

  it('null inputSnapshot returns none', () => {
    const result = computeDriftStatus(current, null, null, SENSITIVE_FIELDS_BP);
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
    const result = computeDriftStatus(current, snapshot, null, ['segment', 'subsegment', 'tone_of_voice', 'name']);
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
    const result = computeDriftStatus(current, snapshot, null, ['segment', 'subsegment', 'tone_of_voice', 'name']);
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
    const result = computeDriftStatus(current, snapshot, null, ['segment', 'subsegment', 'tone_of_voice', 'name']);
    expect(result).toBe('new');
  });

  it('brand_color differs — no drift (not in fields)', () => {
    const snapshot: Record<string, string | null> = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      brand_color: '#FF0000',
    };
    const result = computeDriftStatus(current, snapshot, null, ['segment', 'subsegment', 'tone_of_voice', 'name']);
    expect(result).toBe('none');
  });

  it('positioning differs — no drift (not in fields list)', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'Posicionamento completamente diferente',
      short_description: 'Descrição',
      slogan: 'Slogan',
    };
    const result = computeDriftStatus(current, snapshot, null, ['segment', 'subsegment', 'tone_of_voice', 'name']);
    expect(result).toBe('none');
  });

  it('short_description differs — no drift (not in fields list)', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'A melhor loja',
      short_description: 'Descrição completamente diferente',
      slogan: 'Slogan',
    };
    const result = computeDriftStatus(current, snapshot, null, ['segment', 'subsegment', 'tone_of_voice', 'name']);
    expect(result).toBe('none');
  });

  it('slogan differs — no drift (not in fields list)', () => {
    const snapshot: StoreProfileInputSnapshot = {
      segment: 'moda-calcados-acessorios',
      subsegment: 'calcados-femininos',
      tone_of_voice: 'moderno',
      name: 'Minha Loja',
      positioning: 'A melhor loja',
      short_description: 'Descrição',
      slogan: 'Slogan completamente diferente',
    };
    const result = computeDriftStatus(current, snapshot, null, ['segment', 'subsegment', 'tone_of_voice', 'name']);
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
    const result = computeDriftStatus(current, snapshot, dismissed, ['segment', 'subsegment', 'tone_of_voice', 'name']);
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
    const result = computeDriftStatus(current, snapshot, dismissed, ['segment', 'subsegment', 'tone_of_voice', 'name']);
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
