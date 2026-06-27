import { describe, it, expect } from 'vitest';
import { computeDriftStatus, normalizeSnapshotValue, DRIFT_FIELDS } from '@/lib/drift';
import type { StoreProfileInputSnapshot } from '@/lib/snapshot';
import { buildStoreProfileInputSnapshot } from '@/lib/snapshot';

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
});
