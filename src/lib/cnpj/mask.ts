// Canonical contract: 12 alphanumeric positions + 2 numeric check digits.
const CANONICAL_CNPJ = /^[A-Z0-9]{12}[0-9]{2}$/;

/**
 * Masks a canonical CNPJ in the `**.***.***` slash `YYYY` dash `**` shape,
 * preserving positions 9–12 (which may contain uppercase letters). Fail-closed:
 * invalid input returns the placeholder and never the full fiscal identifier.
 */
export function maskCnpj(normalized: string): string {
  if (!CANONICAL_CNPJ.test(normalized)) {
    return "CNPJ inválido";
  }

  const suffix = normalized.slice(8, 12);
  return `**.***.***/${suffix}-**`;
}
