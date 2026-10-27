import { describe, expect, it } from "vitest";
import {
  parseCampaignMarketContext,
  readCampaignMarketContext,
  resolveCampaignMarketContext,
} from "../campaign-context";
import { resolveStoreMarketContext } from "../store-context";
import type {
  CampaignMarketContext,
  CampaignMarketResolution,
  StoreMarketContext,
} from "../types";

function store(input: unknown): StoreMarketContext {
  const result = resolveStoreMarketContext(input);
  if (!result.ok) {
    throw new Error(`store resolution failed: ${result.error.code}`);
  }
  return result.context;
}

function expectResolution(
  result: CampaignMarketResolution,
): CampaignMarketContext {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`expected success: ${result.error.code}`);
  return result.context;
}

describe("resolveCampaignMarketContext", () => {
  const brStore = store({ kind: "configured", country: "BR" });

  it("uses store defaults when no overrides are given", () => {
    const result = resolveCampaignMarketContext({ store: brStore });
    const context = expectResolution(result);
    expect(context).toEqual({
      contextVersion: 1,
      market: "BR",
      contentLocale: "pt-BR",
      currency: "BRL",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources).toEqual({
      market: "store_default",
      contentLocale: "store_default",
      currency: "store_default",
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(result.sources)).toBe(true);
  });

  it("suggests destination profile defaults when the market changes", () => {
    const result = resolveCampaignMarketContext({
      store: brStore,
      overrides: { market: "PY" },
    });
    const context = expectResolution(result);
    expect(context.market).toBe("PY");
    expect(context.contentLocale).toBe("es-PY");
    expect(context.currency).toBe("PYG");
    if (!result.ok) return;
    expect(result.sources).toEqual({
      market: "campaign_override",
      contentLocale: "market_profile_default",
      currency: "market_profile_default",
    });
  });

  it("lets an explicit override win per field, independently", () => {
    const result = resolveCampaignMarketContext({
      store: brStore,
      overrides: { market: "PY", currency: "BRL", contentLocale: "pt-BR" },
    });
    const context = expectResolution(result);
    expect(context.market).toBe("PY");
    expect(context.contentLocale).toBe("pt-BR");
    expect(context.currency).toBe("BRL");
    if (!result.ok) return;
    expect(result.sources.market).toBe("campaign_override");
    expect(result.sources.contentLocale).toBe("campaign_override");
    expect(result.sources.currency).toBe("campaign_override");
  });

  it("does not change market when only currency is overridden", () => {
    const context = expectResolution(
      resolveCampaignMarketContext({
        store: brStore,
        overrides: { currency: "PYG" },
      }),
    );
    expect(context.market).toBe("BR");
    expect(context.contentLocale).toBe("pt-BR");
    expect(context.currency).toBe("PYG");
  });

  it("marks store-derived sources as legacy_br when explicitly declared", () => {
    const legacyStore = store({ kind: "legacy" });
    const result = resolveCampaignMarketContext({
      store: legacyStore,
      storeIsLegacy: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources).toEqual({
      market: "legacy_br",
      contentLocale: "legacy_br",
      currency: "legacy_br",
    });
  });

  it("rejects invalid overrides with typed errors", () => {
    const market = resolveCampaignMarketContext({
      store: brStore,
      overrides: { market: "AR" },
    });
    expect(market.ok).toBe(false);
    if (market.ok) return;
    expect(market.error.code).toBe("unsupported_market");
    expect(market.error.field).toBe("market");

    const locale = resolveCampaignMarketContext({
      store: brStore,
      overrides: { contentLocale: "es-AR" },
    });
    expect(locale.ok).toBe(false);
    if (locale.ok) return;
    expect(locale.error.code).toBe("unsupported_locale");

    const currency = resolveCampaignMarketContext({
      store: brStore,
      overrides: { currency: "USD" },
    });
    expect(currency.ok).toBe(false);
    if (currency.ok) return;
    expect(currency.error.code).toBe("unsupported_currency");
  });

  it("rejects an invalid store value with a typed error", () => {
    const result = resolveCampaignMarketContext({
      store: {},
    } as unknown as Parameters<typeof resolveCampaignMarketContext>[0]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_input");
  });

  it("does not depend on the input object after resolution", () => {
    const mutableStore = { ...brStore };
    const result = resolveCampaignMarketContext({ store: mutableStore });
    const context = expectResolution(result);
    (mutableStore as unknown as { defaultCampaignMarket: string })
      .defaultCampaignMarket = "PY";
    (mutableStore as unknown as { defaultContentLocale: string })
      .defaultContentLocale = "es-PY";
    expect(context.market).toBe("BR");
    expect(context.contentLocale).toBe("pt-BR");
  });
});

describe("parseCampaignMarketContext", () => {
  const valid = {
    contextVersion: 1,
    market: "PY",
    contentLocale: "es-PY",
    currency: "PYG",
  } as const;

  it("returns a present copy for a complete valid context", () => {
    const result = parseCampaignMarketContext(valid);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.context).toEqual(valid);
    expect(Object.isFrozen(result.context)).toBe(true);
  });

  it("rejects empty objects as incomplete", () => {
    const result = parseCampaignMarketContext({});
    expect(result.kind).toBe("invalid");
    if (result.kind !== "invalid") return;
    expect(result.error.reason).toBe("incomplete");
  });

  it("rejects incomplete contexts", () => {
    const result = parseCampaignMarketContext({
      contextVersion: 1,
      market: "BR",
      contentLocale: "pt-BR",
    });
    expect(result.kind).toBe("invalid");
    if (result.kind !== "invalid") return;
    expect(result.error.reason).toBe("incomplete");
    expect(result.error.field).toBe("currency");
  });

  it("rejects unsupported versions", () => {
    const result = parseCampaignMarketContext({ ...valid, contextVersion: 2 });
    expect(result.kind).toBe("invalid");
    if (result.kind !== "invalid") return;
    expect(result.error.code).toBe("unsupported_context_version");
    expect(result.error.reason).toBe("unsupported_version");
  });

  it("rejects unknown fields and non-objects", () => {
    const extra = parseCampaignMarketContext({ ...valid, store: "BR" });
    expect(extra.kind).toBe("invalid");
    if (extra.kind !== "invalid") return;
    expect(extra.error.reason).toBe("invalid_field");

    const scalar = parseCampaignMarketContext("PY");
    expect(scalar.kind).toBe("invalid");
    if (scalar.kind !== "invalid") return;
    expect(scalar.error.reason).toBe("not_an_object");
  });
});

describe("readCampaignMarketContext", () => {
  const valid = {
    contextVersion: 1,
    market: "BR",
    contentLocale: "pt-BR",
    currency: "BRL",
  };

  it("distinguishes real absence as missing_legacy", () => {
    expect(readCampaignMarketContext(null)).toEqual({ kind: "missing_legacy" });
    expect(readCampaignMarketContext(undefined)).toEqual({
      kind: "missing_legacy",
    });
  });

  it("marks empty objects as invalid with a reason", () => {
    const result = readCampaignMarketContext({});
    expect(result.kind).toBe("invalid");
    if (result.kind !== "invalid") return;
    expect(result.error.reason).toBe("incomplete");
  });

  it("marks unknown versions as invalid", () => {
    const result = readCampaignMarketContext({ ...valid, contextVersion: 2 });
    expect(result.kind).toBe("invalid");
    if (result.kind !== "invalid") return;
    expect(result.error.reason).toBe("unsupported_version");
  });

  it("marks non-objects as invalid", () => {
    const result = readCampaignMarketContext(42);
    expect(result.kind).toBe("invalid");
    if (result.kind !== "invalid") return;
    expect(result.error.reason).toBe("not_an_object");
  });

  it("returns an independent frozen copy for a valid delivered context", () => {
    const source = { ...valid };
    const result = readCampaignMarketContext(source);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.context).toEqual(valid);
    expect(Object.isFrozen(result.context)).toBe(true);

    source.market = "PY";
    source.currency = "PYG";
    expect(result.context.market).toBe("BR");
    expect(result.context.currency).toBe("BRL");

    expect(() => {
      (result.context as unknown as { market: string }).market = "PY";
    }).toThrow(TypeError);
  });

  it("never consults current store preferences", () => {
    const delivered = readCampaignMarketContext(valid);
    expect(delivered.kind).toBe("present");

    // Changing store preferences later must not affect the delivered context.
    const changedStore = store({
      kind: "configured",
      country: "BR",
      defaultCampaignMarket: "PY",
      defaultContentLocale: "es-PY",
      defaultCurrency: "PYG",
    });
    expect(changedStore.defaultCampaignMarket).toBe("PY");

    if (delivered.kind !== "present") return;
    expect(delivered.context.market).toBe("BR");
    expect(delivered.context.contentLocale).toBe("pt-BR");
  });
});
