import { normalizeCnpj } from "./normalize";
import { hasInvalidCnpjChars } from "./input-mask";
import type { CnpjOutput } from "./types";

const KNOWN_INVALID_SEQUENCES = [
  "00000000000000",
  "11111111111111",
  "22222222222222",
  "33333333333333",
  "44444444444444",
  "55555555555555",
  "66666666666666",
  "77777777777777",
  "88888888888888",
  "99999999999999",
];

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

// Canonical contract: 12 alphanumeric positions + 2 numeric check digits.
const CANONICAL_CNPJ = /^[A-Z0-9]{12}[0-9]{2}$/;

function computeDigit(values: number[], weights: number[]): number {
  const sum = values.reduce((acc, value, i) => acc + value * weights[i], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function validateCnpj(raw: string): CnpjOutput | Error {
  if (hasInvalidCnpjChars(raw)) {
    return new Error("CNPJ inválido");
  }

  const normalized = normalizeCnpj(raw);

  if (normalized.length !== 14) {
    return new Error("CNPJ deve ter 14 caracteres");
  }

  if (!CANONICAL_CNPJ.test(normalized)) {
    return new Error("CNPJ inválido");
  }

  if (KNOWN_INVALID_SEQUENCES.includes(normalized)) {
    return new Error("CNPJ inválido");
  }

  // Official modulo 11: character value = ASCII code − 48 (A = 17 … Z = 42).
  const values = normalized.split("").map((char) => char.charCodeAt(0) - 48);

  if (computeDigit(values.slice(0, 12), FIRST_WEIGHTS) !== values[12]) {
    return new Error("CNPJ inválido");
  }

  if (computeDigit(values.slice(0, 13), SECOND_WEIGHTS) !== values[13]) {
    return new Error("CNPJ inválido");
  }

  return { normalized };
}
