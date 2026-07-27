import { normalizeCnpj } from "./normalize";
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

function computeDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function validateCnpj(raw: string): CnpjOutput | Error {
  const normalized = normalizeCnpj(raw);

  if (normalized.length !== 14) {
    return new Error("CNPJ deve ter 14 dígitos");
  }

  if (!/^\d{14}$/.test(normalized)) {
    return new Error("CNPJ deve ter 14 dígitos");
  }

  if (KNOWN_INVALID_SEQUENCES.includes(normalized)) {
    return new Error("CNPJ inválido");
  }

  const digits = normalized.split("").map(Number);
  const first12 = digits.slice(0, 12);
  const firstCheck = computeDigit(first12, FIRST_WEIGHTS);

  if (firstCheck !== digits[12]) {
    return new Error("CNPJ inválido");
  }

  const first13 = digits.slice(0, 13);
  const secondCheck = computeDigit(first13, SECOND_WEIGHTS);

  if (secondCheck !== digits[13]) {
    return new Error("CNPJ inválido");
  }

  return { normalized };
}
