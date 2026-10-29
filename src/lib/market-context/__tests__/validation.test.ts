import { describe, expect, it } from "vitest";
import {
  getMarketProfile,
  isSupportedCurrency,
  isSupportedLocale,
  isSupportedMarket,
  isSupportedTimeZone,
  isSupportedUiLocale,
} from "../validation";

describe("validation guards", () => {
  describe("isSupportedMarket", () => {
    it("accepts BR and PY", () => {
      expect(isSupportedMarket("BR")).toBe(true);
      expect(isSupportedMarket("PY")).toBe(true);
    });

    it("rejects unsupported or malformed values without throwing", () => {
      expect(isSupportedMarket("AR")).toBe(false);
      expect(isSupportedMarket("br")).toBe(false);
      expect(isSupportedMarket(null)).toBe(false);
      expect(isSupportedMarket(undefined)).toBe(false);
      expect(isSupportedMarket(1)).toBe(false);
      expect(isSupportedMarket({})).toBe(false);
    });
  });

  describe("isSupportedLocale", () => {
    it("accepts pt-BR and es-PY for content", () => {
      expect(isSupportedLocale("pt-BR")).toBe(true);
      expect(isSupportedLocale("es-PY")).toBe(true);
    });

    it("rejects es-AR, es-419 and malformed values for content", () => {
      expect(isSupportedLocale("es-AR")).toBe(false);
      expect(isSupportedLocale("es-419")).toBe(false);
      expect(isSupportedLocale("pt")).toBe(false);
      expect(isSupportedLocale(undefined)).toBe(false);
    });
  });

  describe("isSupportedUiLocale", () => {
    it("accepts pt-BR and es-419 for the interface", () => {
      expect(isSupportedUiLocale("pt-BR")).toBe(true);
      expect(isSupportedUiLocale("es-419")).toBe(true);
    });

    it("rejects es-PY, es-AR and malformed values for the interface", () => {
      expect(isSupportedUiLocale("es-PY")).toBe(false);
      expect(isSupportedUiLocale("es-AR")).toBe(false);
      expect(isSupportedUiLocale("pt")).toBe(false);
      expect(isSupportedUiLocale(null)).toBe(false);
    });
  });

  describe("isSupportedCurrency", () => {
    it("accepts BRL and PYG", () => {
      expect(isSupportedCurrency("BRL")).toBe(true);
      expect(isSupportedCurrency("PYG")).toBe(true);
    });

    it("rejects USD and malformed values", () => {
      expect(isSupportedCurrency("USD")).toBe(false);
      expect(isSupportedCurrency("brl")).toBe(false);
      expect(isSupportedCurrency(null)).toBe(false);
    });
  });

  describe("isSupportedTimeZone", () => {
    it("accepts America/Sao_Paulo and America/Asuncion", () => {
      expect(isSupportedTimeZone("America/Sao_Paulo")).toBe(true);
      expect(isSupportedTimeZone("America/Asuncion")).toBe(true);
    });

    it("rejects America/Mexico_City and malformed values", () => {
      expect(isSupportedTimeZone("America/Mexico_City")).toBe(false);
      expect(isSupportedTimeZone("")).toBe(false);
      expect(isSupportedTimeZone(42)).toBe(false);
    });
  });

  describe("getMarketProfile", () => {
    it("returns the frozen profile for supported markets", () => {
      const profile = getMarketProfile("BR");
      expect(profile?.defaultCurrency).toBe("BRL");
      expect(Object.isFrozen(profile)).toBe(true);
    });

    it("returns undefined for unsupported markets", () => {
      expect(getMarketProfile("AR")).toBeUndefined();
      expect(getMarketProfile(undefined)).toBeUndefined();
    });
  });
});
