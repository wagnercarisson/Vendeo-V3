const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

function isValidHex(value: string): boolean {
  return HEX_REGEX.test(value);
}

function normalizeBrandColorsChosen(colors: Array<string | null>): Array<string | null> {
  if (colors.length === 2 && colors[0] === null && colors[1] === null) return [];
  return colors;
}

function hasUserChosenColors(colors: Array<string | null>): boolean {
  return colors.some(c => c !== null && isValidHex(c));
}

function validateBrandColorsChosen(colors: unknown): colors is Array<string | null> {
  if (!Array.isArray(colors)) return false;
  if (colors.length !== 0 && colors.length !== 2) return false;
  return colors.every(
    (c) => c === null || (typeof c === 'string' && isValidHex(c))
  );
}

export { isValidHex, normalizeBrandColorsChosen, hasUserChosenColors, validateBrandColorsChosen };
