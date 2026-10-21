export type CnpjInput = string;

export type CnpjOutput = {
  /**
   * Canonical CNPJ: 14 characters, 12 `[A-Z0-9]` followed by 2 `[0-9]`
   * (e.g. `12ABC34501DE35`). Numeric CNPJs are unchanged.
   */
  normalized: string;
};

export type CnpjValidationResult = CnpjOutput | Error;

export type CnpjValidationScore = {
  nameToLegal: number;
  nameToFantasy: number | null;
  bestScore: number;
  label: "match" | "mismatch" | "partial";
};

export type { CnpjLookupData } from "./lookup-providers/types";
