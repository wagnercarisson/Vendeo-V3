import { describe, expect, it } from "vitest";
import {
  assertSupportedUiLocale,
  toStoreMarketSettingsDTO,
  toUserLocalePreferenceDTO,
} from "../dtos";

describe("dtos", () => {
  it("renomeia ui_locale -> uiLocale e ui_locale_source -> source", () => {
    const dto = toUserLocalePreferenceDTO({
      ui_locale: "es-PY",
      ui_locale_source: "explicit",
      version: 1,
      user_id: "u-1",
      created_at: "2026-01-01",
    });
    expect(dto).toEqual({ uiLocale: "es-PY", source: "explicit", version: 1 });
    expect(Object.keys(dto).sort()).toEqual(["source", "uiLocale", "version"]);
    expect(Object.keys(dto).some((key) => key.includes("_"))).toBe(false);
  });

  it("mantém valor legado legítimo sem restringir valores", () => {
    const dto = toUserLocalePreferenceDTO({
      ui_locale: null,
      ui_locale_source: "legacy_br",
      version: 0,
    });
    expect(dto.source).toBe("legacy_br");
    expect(Object.keys(dto).some((key) => key.includes("_"))).toBe(false);
  });

  it("store settings: allowlist exata sem vazamento", () => {
    const dto = toStoreMarketSettingsDTO({
      store_id: "s-1",
      user_id: "u-1",
      cnpj_normalized: "123",
      country_code: "BR",
      country_source: "fiscal_confirmation",
      default_campaign_market: "PY",
      default_campaign_market_source: "explicit",
      default_content_locale: "es-PY",
      default_content_locale_source: "default",
      default_currency: "PYG",
      default_currency_source: "default",
      time_zone: "America/Sao_Paulo",
      time_zone_source: "default",
      context_version: 1,
      settings_version: 2,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
    expect(Object.keys(dto).sort()).toEqual(
      [
        "contextVersion",
        "countryCode",
        "countrySource",
        "defaultCampaignMarket",
        "defaultCampaignMarketSource",
        "defaultContentLocale",
        "defaultContentLocaleSource",
        "defaultCurrency",
        "defaultCurrencySource",
        "settingsVersion",
        "timeZone",
        "timeZoneSource",
      ].sort(),
    );
    expect(JSON.stringify(dto)).not.toContain("store_id");
    expect(JSON.stringify(dto)).not.toContain("user_id");
    expect(JSON.stringify(dto)).not.toContain("cnpj");
  });

  it("rejeita pares incoerentes no conversor público", () => {
    expect(() =>
      toUserLocalePreferenceDTO({
        ui_locale: null,
        ui_locale_source: "explicit",
        version: 1,
      }),
    ).toThrow();
    expect(() =>
      toUserLocalePreferenceDTO({
        ui_locale: "es-PY",
        ui_locale_source: "legacy_br",
        version: 1,
      }),
    ).toThrow();
  });

  it.each([null, true, false, "", " 1", "1.5", -1, 1.5])(
    "rejeita versão inválida %j",
    (version) => {
      expect(() =>
        toUserLocalePreferenceDTO({
          ui_locale: "pt-BR",
          ui_locale_source: "explicit",
          version,
        }),
      ).toThrow();
    },
  );

  it("aceita versão como string decimal válida", () => {
    const dto = toUserLocalePreferenceDTO({
      ui_locale: "pt-BR",
      ui_locale_source: "explicit",
      version: "2",
    });
    expect(dto.version).toBe(2);
  });

  it("assertSupportedUiLocale aceita apenas pt-BR/es-PY", () => {
    expect(assertSupportedUiLocale("pt-BR")).toBe(true);
    expect(assertSupportedUiLocale("es-PY")).toBe(true);
    expect(assertSupportedUiLocale("es-AR")).toBe(false);
    expect(assertSupportedUiLocale(null)).toBe(false);
  });
});
