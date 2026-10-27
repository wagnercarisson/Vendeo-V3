import { describe, expect, it } from "vitest";
import {
  parseStoreMarketContext,
  resolveStoreMarketContext,
} from "../store-context";
import type {
  StoreMarketContext,
  StoreMarketContextResult,
} from "../types";

function expectSuccess(result: StoreMarketContextResult): StoreMarketContext {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result.context;
}

function expectFailure(result: StoreMarketContextResult) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  return result.error;
}

describe("resolveStoreMarketContext", () => {
  it("derives language and currency from the default campaign market and timezone from the country", () => {
    const context = expectSuccess(
      resolveStoreMarketContext({ kind: "configured", country: "BR" }),
    );
    expect(context).toEqual({
      contextVersion: 1,
      country: "BR",
      defaultCampaignMarket: "BR",
      defaultContentLocale: "pt-BR",
      defaultCurrency: "BRL",
      timeZone: "America/Sao_Paulo",
    });
  });

  it("BR store with default campaign market PY gets es-PY/PYG but keeps BR country and Sao_Paulo timezone", () => {
    const context = expectSuccess(
      resolveStoreMarketContext({
        kind: "configured",
        country: "BR",
        defaultCampaignMarket: "PY",
      }),
    );
    expect(context.country).toBe("BR");
    expect(context.defaultCampaignMarket).toBe("PY");
    expect(context.defaultContentLocale).toBe("es-PY");
    expect(context.defaultCurrency).toBe("PYG");
    expect(context.timeZone).toBe("America/Sao_Paulo");
  });

  it("PY store with default campaign market BR gets pt-BR/BRL and Asuncion timezone", () => {
    const context = expectSuccess(
      resolveStoreMarketContext({
        kind: "configured",
        country: "PY",
        defaultCampaignMarket: "BR",
      }),
    );
    expect(context.country).toBe("PY");
    expect(context.defaultCampaignMarket).toBe("BR");
    expect(context.defaultContentLocale).toBe("pt-BR");
    expect(context.defaultCurrency).toBe("BRL");
    expect(context.timeZone).toBe("America/Asuncion");
  });

  it("explicit store overrides win over profile defaults", () => {
    const context = expectSuccess(
      resolveStoreMarketContext({
        kind: "configured",
        country: "BR",
        defaultCampaignMarket: "BR",
        defaultContentLocale: "es-PY",
        defaultCurrency: "PYG",
        timeZone: "America/Asuncion",
      }),
    );
    expect(context.defaultContentLocale).toBe("es-PY");
    expect(context.defaultCurrency).toBe("PYG");
    expect(context.timeZone).toBe("America/Asuncion");
  });

  it("reports per-field sources", () => {
    const result = resolveStoreMarketContext({
      kind: "configured",
      country: "BR",
      defaultCampaignMarket: "PY",
      defaultCurrency: "BRL",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance).toBe("configured");
    expect(result.sources).toEqual({
      country: "configured",
      defaultCampaignMarket: "configured",
      defaultContentLocale: "default",
      defaultCurrency: "configured",
      timeZone: "default",
    });
  });

  it("requires country when configured (never silently BR)", () => {
    const error = expectFailure(
      resolveStoreMarketContext({ kind: "configured" }),
    );
    expect(error.code).toBe("missing_country");
    expect(error.field).toBe("country");
  });

  it("rejects unsupported country with a typed error", () => {
    const error = expectFailure(
      resolveStoreMarketContext({ kind: "configured", country: "AR" }),
    );
    expect(error.code).toBe("unsupported_market");
    expect(error.field).toBe("country");
    expect(error.received).toBe("AR");
  });

  it("rejects unsupported optional preferences", () => {
    expect(
      expectFailure(
        resolveStoreMarketContext({
          kind: "configured",
          country: "BR",
          defaultCampaignMarket: "AR",
        })).code,
    ).toBe("unsupported_market");
    expect(
      expectFailure(
        resolveStoreMarketContext({
          kind: "configured",
          country: "BR",
          defaultContentLocale: "es-AR",
        })).code,
    ).toBe("unsupported_locale");
    expect(
      expectFailure(
        resolveStoreMarketContext({
          kind: "configured",
          country: "BR",
          defaultCurrency: "USD",
        })).code,
    ).toBe("unsupported_currency");
    expect(
      expectFailure(
        resolveStoreMarketContext({
          kind: "configured",
          country: "BR",
          timeZone: "America/Mexico_City",
        })).code,
    ).toBe("unsupported_time_zone");
  });

  it("only resolves legacy when declared explicitly", () => {
    const result = resolveStoreMarketContext({ kind: "legacy" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance).toBe("legacy_br");
    expect(result.context).toEqual({
      contextVersion: 1,
      country: "BR",
      defaultCampaignMarket: "BR",
      defaultContentLocale: "pt-BR",
      defaultCurrency: "BRL",
      timeZone: "America/Sao_Paulo",
    });
    expect(result.sources.country).toBe("legacy_br");
    expect(result.sources.timeZone).toBe("legacy_br");
  });

  it("rejects non-object input without throwing", () => {
    expect(expectFailure(resolveStoreMarketContext(null)).code).toBe(
      "invalid_input",
    );
    expect(expectFailure(resolveStoreMarketContext("BR")).reason).toBe(
      "not_an_object",
    );
    expect(expectFailure(resolveStoreMarketContext({})).field).toBe("kind");
  });

  it("returns frozen, independent copies", () => {
    const config = {
      kind: "configured" as const,
      country: "BR",
      defaultCampaignMarket: "PY",
    };
    const result = resolveStoreMarketContext(config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.context)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);

    (config as unknown as { defaultCampaignMarket: string }).defaultCampaignMarket =
      "BR";
    expect(result.context.defaultCampaignMarket).toBe("PY");
    expect(result.context.defaultContentLocale).toBe("es-PY");
  });
});

describe("parseStoreMarketContext", () => {
  const valid = {
    contextVersion: 1,
    country: "PY",
    defaultCampaignMarket: "BR",
    defaultContentLocale: "pt-BR",
    defaultCurrency: "BRL",
    timeZone: "America/Asuncion",
  } as const;

  it("accepts a complete valid value and returns a frozen copy", () => {
    const result = parseStoreMarketContext(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context).toEqual(valid);
    expect(Object.isFrozen(result.context)).toBe(true);
  });

  it("rejects empty objects as incomplete", () => {
    const result = parseStoreMarketContext({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("incomplete");
    expect(result.error.field).toBe("contextVersion");
  });

  it("rejects a missing field as incomplete (no defaults)", () => {
    const { defaultCurrency: _defaultCurrency, ...missingCurrency } = valid;
    void _defaultCurrency;
    const result = parseStoreMarketContext(missingCurrency);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("incomplete");
    expect(result.error.field).toBe("defaultCurrency");
  });

  it("rejects unsupported versions", () => {
    const result = parseStoreMarketContext({ ...valid, contextVersion: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported_context_version");
    expect(result.error.reason).toBe("unsupported_version");
    expect(result.error.received).toBe(2);
  });

  it("rejects unknown fields", () => {
    const result = parseStoreMarketContext({ ...valid, market: "BR" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_input");
    expect(result.error.reason).toBe("invalid_field");
    expect(result.error.field).toBe("market");
  });

  it("rejects unsupported field values", () => {
    const result = parseStoreMarketContext({ ...valid, country: "AR" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported_market");
    expect(result.error.field).toBe("country");
  });

  it("rejects non-object values", () => {
    const result = parseStoreMarketContext(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("not_an_object");
  });
});
