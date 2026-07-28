export type CnpjInput = string;

export type CnpjOutput = {
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
