import { describe, it, expect } from 'vitest';
import { isValidHex, normalizeBrandColorsChosen, hasUserChosenColors, validateBrandColorsChosen } from '../color';

describe('isValidHex', () => {
  it('accepts valid 6-digit hex', () => {
    expect(isValidHex('#FF0000')).toBe(true);
    expect(isValidHex('#00ff00')).toBe(true);
    expect(isValidHex('#1E40AF')).toBe(true);
    expect(isValidHex('#ffffff')).toBe(true);
  });

  it('rejects invalid strings', () => {
    expect(isValidHex('')).toBe(false);
    expect(isValidHex('#FFF')).toBe(false);
    expect(isValidHex('#GGGGGG')).toBe(false);
    expect(isValidHex('FF0000')).toBe(false);
    expect(isValidHex('#FF00001')).toBe(false);
    expect(isValidHex('red')).toBe(false);
  });
});

describe('hasUserChosenColors', () => {
  it('returns false for empty array', () => {
    expect(hasUserChosenColors([])).toBe(false);
  });

  it('returns true when primary is chosen', () => {
    expect(hasUserChosenColors(['#FF0000', null])).toBe(true);
  });

  it('returns true when accent is chosen', () => {
    expect(hasUserChosenColors([null, '#00FF00'])).toBe(true);
  });

  it('returns true when both are chosen', () => {
    expect(hasUserChosenColors(['#FF0000', '#00FF00'])).toBe(true);
  });

  it('returns false when both are null', () => {
    expect(hasUserChosenColors([null, null])).toBe(false);
  });

  it('returns false for invalid hex values', () => {
    expect(hasUserChosenColors(['#GGGGGG', null])).toBe(false);
  });
});

describe('normalizeBrandColorsChosen', () => {
  it('converts [null, null] to empty array', () => {
    expect(normalizeBrandColorsChosen([null, null])).toEqual([]);
  });

  it('preserves partial choice', () => {
    expect(normalizeBrandColorsChosen(['#FF0000', null])).toEqual(['#FF0000', null]);
    expect(normalizeBrandColorsChosen([null, '#00FF00'])).toEqual([null, '#00FF00']);
  });

  it('preserves full choice', () => {
    expect(normalizeBrandColorsChosen(['#FF0000', '#00FF00'])).toEqual(['#FF0000', '#00FF00']);
  });

  it('preserves empty array', () => {
    expect(normalizeBrandColorsChosen([])).toEqual([]);
  });
});

describe('validateBrandColorsChosen', () => {
  it('accepts valid arrays', () => {
    expect(validateBrandColorsChosen([])).toBe(true);
    expect(validateBrandColorsChosen(['#FF0000', null])).toBe(true);
    expect(validateBrandColorsChosen([null, '#00FF00'])).toBe(true);
    expect(validateBrandColorsChosen(['#FF0000', '#00FF00'])).toBe(true);
    expect(validateBrandColorsChosen([null, null])).toBe(true);
  });

  it('rejects single-element array', () => {
    expect(validateBrandColorsChosen(['#FF0000'])).toBe(false);
  });

  it('rejects invalid hex values', () => {
    expect(validateBrandColorsChosen(['#GGGGGG', null])).toBe(false);
    expect(validateBrandColorsChosen(['#FF0000', '#GGGGGG'])).toBe(false);
  });

  it('rejects non-array values', () => {
    expect(validateBrandColorsChosen(null)).toBe(false);
    expect(validateBrandColorsChosen(undefined)).toBe(false);
    expect(validateBrandColorsChosen('#FF0000')).toBe(false);
  });

  it('rejects three-element array', () => {
    expect(validateBrandColorsChosen(['#FF0000', '#00FF00', '#0000FF'])).toBe(false);
  });
});
