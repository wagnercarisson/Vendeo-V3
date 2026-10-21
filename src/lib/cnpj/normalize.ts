// Only known CNPJ formatting is removed. Accents, emoji, symbols and non-ASCII
// letters are preserved on purpose so validation can reject them instead of
// silently "fixing" the input.
const FORMATTING = /[./\-\s]/g;
const LOWERCASE_ASCII = /[a-z]/g;

/**
 * Canonical CNPJ normalization (14 chars: 12 `[A-Z0-9]` + 2 `[0-9]`).
 * Removes only `.`, `/`, `-` and whitespace; uppercases ASCII `a-z` only.
 */
export function normalizeCnpj(raw: string): string {
  return raw
    .replace(FORMATTING, "")
    .replace(LOWERCASE_ASCII, (char) => char.toUpperCase());
}
