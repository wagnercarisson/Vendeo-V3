import { normalizeCnpj } from "./normalize";

// Allowlist of characters accepted from a CNPJ input: digits, ASCII letters and
// the known formatting separators (plus whitespace). Anything else — accents,
// emoji, symbols — is an invalid character and must never be discarded.
const ALLOWED_INPUT_CHARS = /^[0-9A-Za-z./\-\s]*$/;

// Canonical contract: 12 alphanumeric positions + 2 numeric check digits.
const CANONICAL_CNPJ = /^[A-Z0-9]{12}[0-9]{2}$/;

const MAX_CANONICAL_LENGTH = 14;

/**
 * Returns true when `raw` contains a character outside the CNPJ input allowlist.
 * Fail-closed helper shared by validation and the UI input mask.
 */
export function hasInvalidCnpjChars(raw: string): boolean {
  return !ALLOWED_INPUT_CHARS.test(raw);
}

/**
 * Progressive input mask (`XX.XXX.XXX/XXXX-DV`).
 *
 * Fail-closed: when the raw value contains an unknown character, the previous
 * value is returned unchanged so the hostile character never reaches the UI.
 */
export function formatCnpjInput(raw: string, previousValue = ""): string {
  if (hasInvalidCnpjChars(raw)) {
    return previousValue;
  }

  const canonical = normalizeCnpj(raw).slice(0, MAX_CANONICAL_LENGTH);
  const formatted: string[] = [];

  for (let i = 0; i < canonical.length; i++) {
    if (i === 2 || i === 5) {
      formatted.push(".");
    }
    if (i === 8) {
      formatted.push("/");
    }
    if (i === 12) {
      formatted.push("-");
    }
    formatted.push(canonical[i]);
  }

  return formatted.join("");
}

/**
 * Formats a canonical CNPJ for display. Fail-closed: anything outside the
 * canonical contract returns the safe placeholder instead of the raw value.
 */
export function formatCnpj(canonical: string): string {
  if (!CANONICAL_CNPJ.test(canonical)) {
    return "CNPJ inválido";
  }

  return `${canonical.slice(0, 2)}.${canonical.slice(2, 5)}.${canonical.slice(5, 8)}/${canonical.slice(8, 12)}-${canonical.slice(12)}`;
}
