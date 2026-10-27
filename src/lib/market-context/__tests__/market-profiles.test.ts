import { describe, expect, it } from "vitest";
import { MARKET_PROFILES } from "../market-profiles";
import { checkMarketProfileRegistry } from "../validation";
import {
  MARKET_PROFILE_VERSION,
  SUPPORTED_CONTENT_LOCALES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_MARKETS,
  SUPPORTED_TIME_ZONES,
} from "../types";

describe("market profiles", () => {
  it("defines BR reference values", () => {
    expect(MARKET_PROFILES.BR).toEqual({
      market: "BR",
      profileVersion: MARKET_PROFILE_VERSION,
      defaultContentLocale: "pt-BR",
      defaultCurrency: "BRL",
      defaultTimeZone: "America/Sao_Paulo",
    });
  });

  it("defines PY reference values (reference only, not enablement)", () => {
    expect(MARKET_PROFILES.PY).toEqual({
      market: "PY",
      profileVersion: MARKET_PROFILE_VERSION,
      defaultContentLocale: "es-PY",
      defaultCurrency: "PYG",
      defaultTimeZone: "America/Asuncion",
    });
  });

  it("has a consistent static registry", () => {
    expect(checkMarketProfileRegistry()).toBeNull();
  });

  it("freezes the registry and every profile recursively", () => {
    expect(Object.isFrozen(MARKET_PROFILES)).toBe(true);
    expect(Object.isFrozen(MARKET_PROFILES.BR)).toBe(true);
    expect(Object.isFrozen(MARKET_PROFILES.PY)).toBe(true);
  });

  it("freezes exported supported-value lists", () => {
    expect(Object.isFrozen(SUPPORTED_MARKETS)).toBe(true);
    expect(Object.isFrozen(SUPPORTED_CONTENT_LOCALES)).toBe(true);
    expect(Object.isFrozen(SUPPORTED_CURRENCIES)).toBe(true);
    expect(Object.isFrozen(SUPPORTED_TIME_ZONES)).toBe(true);
  });

  it("does not allow mutating a profile in place", () => {
    const mutable = MARKET_PROFILES.BR as unknown as {
      defaultCurrency: string;
    };
    expect(() => {
      mutable.defaultCurrency = "USD";
    }).toThrow(TypeError);
    expect(MARKET_PROFILES.BR.defaultCurrency).toBe("BRL");
  });

  it("does not allow mutating the registry in place", () => {
    const mutable = MARKET_PROFILES as unknown as Record<string, unknown>;
    expect(() => {
      mutable.AR = {};
    }).toThrow(TypeError);
    expect(Object.keys(MARKET_PROFILES).sort()).toEqual(["BR", "PY"]);
  });

  it("does not allow mutating exported lists", () => {
    const mutable = SUPPORTED_MARKETS as unknown as string[];
    expect(() => {
      mutable.push("AR");
    }).toThrow(TypeError);
    expect(SUPPORTED_MARKETS).toEqual(["BR", "PY"]);
  });
});
