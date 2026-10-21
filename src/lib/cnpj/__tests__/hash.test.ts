import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashCnpjRoot } from "../hash";
import { normalizeCnpj } from "../normalize";

const TEST_PEPPER = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

beforeEach(() => {
  vi.stubEnv("CNPJ_PEPPER", TEST_PEPPER);
});

describe("hashCnpjRoot", () => {
  it("returns a 64-character hex string", () => {
    const result = hashCnpjRoot("12345678");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic with same pepper", () => {
    const r1 = hashCnpjRoot("12345678");
    const r2 = hashCnpjRoot("12345678");
    expect(r1).toBe(r2);
  });

  it("changes when pepper changes", () => {
    const r1 = hashCnpjRoot("12345678");
    vi.stubEnv("CNPJ_PEPPER", "b2a1c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    const r2 = hashCnpjRoot("12345678");
    expect(r1).not.toBe(r2);
  });

  it("hashes the canonical alphanumeric root", () => {
    const root = normalizeCnpj("12.abc.345/01de-35").slice(0, 8);
    expect(root).toBe("12ABC345");
    expect(hashCnpjRoot(root)).toBe(hashCnpjRoot("12ABC345"));
  });

  it("differs between alphanumeric and numeric roots", () => {
    expect(hashCnpjRoot("12ABC345")).not.toBe(hashCnpjRoot("12345678"));
  });
});
