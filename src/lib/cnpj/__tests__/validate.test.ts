import { describe, it, expect } from "vitest";
import { validateCnpj } from "../validate";

const INVALID = "CNPJ inválido";
const LENGTH = "CNPJ deve ter 14 caracteres";

function expectNormalized(raw: string, normalized: string) {
  const result = validateCnpj(raw);
  expect(result).not.toBeInstanceOf(Error);
  expect((result as { normalized: string }).normalized).toBe(normalized);
}

function expectError(raw: string, message: string) {
  const result = validateCnpj(raw);
  expect(result).toBeInstanceOf(Error);
  expect((result as Error).message).toBe(message);
}

describe("validateCnpj", () => {
  describe("valid numeric CNPJ (regression)", () => {
    it("accepts numeric CNPJ with punctuation", () => {
      expectNormalized("12.345.678/0001-95", "12345678000195");
    });

    it("accepts numeric CNPJ with digits only", () => {
      expectNormalized("12345678000195", "12345678000195");
    });
  });

  describe("valid alphanumeric CNPJ", () => {
    it("accepts canonical alphanumeric CNPJ", () => {
      expectNormalized("12.ABC.345/01DE-35", "12ABC34501DE35");
    });

    it("canonicalizes lowercase alphanumeric CNPJ", () => {
      expectNormalized("12.abc.345/01de-35", "12ABC34501DE35");
    });

    it("accepts the first emitted alphanumeric CNPJ", () => {
      expectNormalized("00.000.000/E08G-12", "00000000E08G12");
    });

    it("tolerates known formatting and spaces", () => {
      expectNormalized(" 12. ABC. 345/01DE-35 ", "12ABC34501DE35");
    });
  });

  describe("invalid check digits", () => {
    it("rejects alphanumeric CNPJ with wrong check digits", () => {
      expectError("12.ABC.345/01DE-34", INVALID);
    });

    it("rejects numeric CNPJ with wrong check digits", () => {
      expectError("12.345.678/0001-00", INVALID);
    });
  });

  describe("invalid format", () => {
    it("rejects letter in the first check digit position", () => {
      expectError("12.ABC.345/01DE-3A", INVALID);
    });

    it("rejects letter in the second check digit position", () => {
      expectError("12.ABC.345/01DE-A5", INVALID);
    });
  });

  describe("invalid length", () => {
    it("rejects short numeric CNPJ", () => {
      expectError("12.345.678/0001", LENGTH);
    });

    it("rejects long numeric CNPJ", () => {
      expectError("12.345.678/0001-9000", LENGTH);
    });

    it("rejects short alphanumeric CNPJ", () => {
      expectError("12.ABC.345/01DE", LENGTH);
    });

    it("rejects one character short alphanumeric CNPJ", () => {
      expectError("12.ABC.345/01DE-3", LENGTH);
    });

    it("rejects one character long alphanumeric CNPJ", () => {
      expectError("12.ABC.345/01DE-355", LENGTH);
    });

    it("rejects empty string", () => {
      expectError("", LENGTH);
    });
  });

  describe("known invalid sequences", () => {
    it("rejects sequence 11...", () => {
      expectError("11.111.111/0001-11", INVALID);
    });

    it("rejects sequence 00...", () => {
      expectError("00.000.000/0001-00", INVALID);
    });
  });

  describe("unknown characters", () => {
    it("rejects emoji instead of discarding it", () => {
      expectError("12.ABC.345/01DE-35😀", INVALID);
    });

    it("rejects symbol instead of discarding it", () => {
      expectError("12.ABC.345/01DE-35!", INVALID);
    });

    it("rejects accented letter instead of discarding it", () => {
      expectError("12.ÁBC.345/01DE-35", INVALID);
    });
  });
});
