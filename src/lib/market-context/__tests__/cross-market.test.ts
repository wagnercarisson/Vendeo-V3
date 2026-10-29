import { describe, expect, it } from "vitest";
import {
  readCampaignMarketContext,
  resolveCampaignMarketContext,
  resolveStoreMarketContext,
  resolveUiLocale,
  type CampaignMarketContext,
  type StoreMarketContext,
} from "../index";

function store(input: unknown): StoreMarketContext {
  const result = resolveStoreMarketContext(input);
  if (!result.ok) throw new Error(result.error.code);
  return result.context;
}

function campaign(
  config: Parameters<typeof resolveCampaignMarketContext>[0],
): CampaignMarketContext {
  const result = resolveCampaignMarketContext(config);
  if (!result.ok) throw new Error(result.error.code);
  return result.context;
}

describe("cross-market campaigns", () => {
  it("resolves BR store to PY campaign and PY store to BR campaign", () => {
    const brStore = store({ kind: "configured", country: "BR" });
    const toPy = campaign({ store: brStore, overrides: { market: "PY" } });
    expect(toPy).toEqual({
      contextVersion: 1,
      market: "PY",
      contentLocale: "es-PY",
      currency: "PYG",
    });

    const pyStore = store({ kind: "configured", country: "PY" });
    const toBr = campaign({ store: pyStore, overrides: { market: "BR" } });
    expect(toBr).toEqual({
      contextVersion: 1,
      market: "BR",
      contentLocale: "pt-BR",
      currency: "BRL",
    });
  });

  it("keeps destination defaults suggested on both sides while overrides win", () => {
    const brStore = store({ kind: "configured", country: "BR" });

    const pyDefaults = campaign({ store: brStore, overrides: { market: "PY" } });
    expect(pyDefaults.contentLocale).toBe("es-PY");
    expect(pyDefaults.currency).toBe("PYG");

    const pyWithOverride = campaign({
      store: brStore,
      overrides: { market: "PY", contentLocale: "pt-BR" },
    });
    expect(pyWithOverride.market).toBe("PY");
    expect(pyWithOverride.contentLocale).toBe("pt-BR");
    expect(pyWithOverride.currency).toBe("PYG");

    const pyStore = store({ kind: "configured", country: "PY" });
    const brDefaults = campaign({ store: pyStore, overrides: { market: "BR" } });
    expect(brDefaults.contentLocale).toBe("pt-BR");
    expect(brDefaults.currency).toBe("BRL");
  });

  it("uses store defaults when the campaign stays in the store default market, even across countries", () => {
    // BR-registered store whose default campaign market is PY, with explicit
    // pt-BR/BRL preferences at store level.
    const brStoreSellingPy = store({
      kind: "configured",
      country: "BR",
      defaultCampaignMarket: "PY",
      defaultContentLocale: "pt-BR",
      defaultCurrency: "BRL",
    });

    const sameMarket = campaign({ store: brStoreSellingPy });
    expect(sameMarket.market).toBe("PY");
    expect(sameMarket.contentLocale).toBe("pt-BR");
    expect(sameMarket.currency).toBe("BRL");

    // Switching destination to BR uses BR profile defaults.
    const brDestination = campaign({
      store: brStoreSellingPy,
      overrides: { market: "BR" },
    });
    expect(brDestination.market).toBe("BR");
    expect(brDestination.contentLocale).toBe("pt-BR");
    expect(brDestination.currency).toBe("BRL");
  });

  it("keeps app locale independent from campaign content locale", () => {
    const pyStore = store({ kind: "configured", country: "PY" });
    const campaignToPy = campaign({ store: pyStore, overrides: { market: "PY" } });
    expect(campaignToPy.contentLocale).toBe("es-PY");

    const appPt = resolveUiLocale({ kind: "explicit", uiLocale: "pt-BR" });
    expect(appPt.ok).toBe(true);
    if (!appPt.ok) return;
    expect(appPt.uiLocale).toBe("pt-BR");
    expect(campaignToPy.contentLocale).toBe("es-PY");

    const appEs = resolveUiLocale({ kind: "explicit", uiLocale: "es-419" });
    expect(appEs.ok).toBe(true);
    if (!appEs.ok) return;
    expect(appEs.uiLocale).toBe("es-419");
    expect(campaignToPy.contentLocale).toBe("es-PY");
  });

  it("keeps currency independent from market", () => {
    const brStore = store({ kind: "configured", country: "BR" });
    const brCampaignPyCurrency = campaign({
      store: brStore,
      overrides: { currency: "PYG" },
    });
    expect(brCampaignPyCurrency.market).toBe("BR");
    expect(brCampaignPyCurrency.contentLocale).toBe("pt-BR");
    expect(brCampaignPyCurrency.currency).toBe("PYG");

    const pyCampaignBrCurrency = campaign({
      store: store({ kind: "configured", country: "PY" }),
      overrides: { market: "PY", currency: "BRL" },
    });
    expect(pyCampaignBrCurrency.market).toBe("PY");
    expect(pyCampaignBrCurrency.contentLocale).toBe("es-PY");
    expect(pyCampaignBrCurrency.currency).toBe("BRL");
  });

  it("produces frozen, independent results across modules", () => {
    const mutableStore = { ...store({ kind: "configured", country: "BR" }) };
    const result = resolveCampaignMarketContext({ store: mutableStore });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    (mutableStore as unknown as { defaultCampaignMarket: string })
      .defaultCampaignMarket = "PY";
    (mutableStore as unknown as { defaultContentLocale: string })
      .defaultContentLocale = "es-PY";

    expect(result.context.market).toBe("BR");
    expect(result.context.contentLocale).toBe("pt-BR");
    expect(Object.isFrozen(result.context)).toBe(true);
  });

  it("delivered campaign context stays stable after store preferences change", () => {
    const initialStore = store({ kind: "configured", country: "BR" });
    const deliveredContext = campaign({
      store: initialStore,
      overrides: { market: "PY" },
    });

    // Simulate later store preference changes.
    const changedStore = store({
      kind: "configured",
      country: "BR",
      defaultCampaignMarket: "BR",
      defaultContentLocale: "pt-BR",
      defaultCurrency: "BRL",
    });
    expect(changedStore.defaultCampaignMarket).toBe("BR");

    const read = readCampaignMarketContext(deliveredContext);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    expect(read.context).toEqual(deliveredContext);
    expect(read.context.market).toBe("PY");
    expect(read.context.contentLocale).toBe("es-PY");
    expect(read.context.currency).toBe("PYG");
  });

  it("legacy stores propagate legacy provenance to campaign sources", () => {
    const legacyStore = store({ kind: "legacy" });
    const result = resolveCampaignMarketContext({
      store: legacyStore,
      storeIsLegacy: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.market).toBe("BR");
    expect(result.sources.market).toBe("legacy_br");
    expect(result.sources.contentLocale).toBe("legacy_br");
    expect(result.sources.currency).toBe("legacy_br");
  });
});
