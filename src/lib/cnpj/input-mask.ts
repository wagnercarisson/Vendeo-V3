// Allowlist of characters accepted from a CNPJ input: digits, ASCII letters and
// the known formatting separators (plus whitespace). Anything else — accents,
// emoji, symbols — is an invalid character and must never be discarded.
const ALLOWED_INPUT_CHARS = /^[0-9A-Za-z./\-\s]*$/;

/**
 * Returns true when `raw` contains a character outside the CNPJ input allowlist.
 * Fail-closed helper shared by validation and the UI input mask.
 */
export function hasInvalidCnpjChars(raw: string): boolean {
  return !ALLOWED_INPUT_CHARS.test(raw);
}
