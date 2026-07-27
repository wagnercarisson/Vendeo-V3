import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashCnpjRoot } from "../hash";

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
});
