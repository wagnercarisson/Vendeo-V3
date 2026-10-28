import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: db }));

import { StoreNotFoundError } from "@/lib/auth/store-ownership";
import {
  CountryNotMutableError,
  PreferencesUnavailableError,
  PreferencesVersionConflictError,
  StoredPreferencesInvalidError,
} from "../errors";
import {
  getStoreMarketSettings,
  loadOwnedStoreForMarketSettings,
  recomposeStoreMarketSettings,
  updateStoreMarketSettings,
  legacyStoreMarketSettingsState,
  type StoreMarketSettingsState,
} from "../store-market-settings-service";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function state(overrides: Partial<StoreMarketSettingsState> = {}): StoreMarketSettingsState {
  return { ...legacyStoreMarketSettingsState(), ...overrides };
}

function mockQueries(options: {
  store?: { data: unknown; error: unknown };
  settings?: { data: unknown; error: unknown };
}) {
  db.from.mockImplementation((table: string) => {
    if (table === "stores") {
      const result = options.store ?? { data: { id: STORE_ID, user_id: USER_ID }, error: null };
      const maybeSingle = vi.fn().mockResolvedValue(result);
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    if (table === "store_market_settings") {
      const result = options.settings ?? { data: null, error: null };
      const maybeSingle = vi.fn().mockResolvedValue(result);
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

function rowFromState(value: StoreMarketSettingsState) {
  return {
    country_code: value.countryCode,
    country_source: value.countrySource,
    default_campaign_market: value.defaultCampaignMarket,
    default_campaign_market_source: value.defaultCampaignMarketSource,
    default_content_locale: value.defaultContentLocale,
    default_content_locale_source: value.defaultContentLocaleSource,
    default_currency: value.defaultCurrency,
    default_currency_source: value.defaultCurrencySource,
    time_zone: value.timeZone,
    time_zone_source: value.timeZoneSource,
    context_version: value.contextVersion,
    settings_version: value.settingsVersion,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadOwnedStoreForMarketSettings", () => {
  it("distingue found, not_found e read_error", async () => {
    mockQueries({});
    await expect(loadOwnedStoreForMarketSettings(USER_ID)).resolves.toEqual({
      kind: "found",
      storeId: STORE_ID,
      ownerId: USER_ID,
    });

    mockQueries({ store: { data: null, error: null } });
    await expect(loadOwnedStoreForMarketSettings(USER_ID)).resolves.toEqual({ kind: "not_found" });

    mockQueries({ store: { data: null, error: { message: "down" } } });
    await expect(loadOwnedStoreForMarketSettings(USER_ID)).resolves.toEqual({
      kind: "read_error",
    });
  });
});

describe("getStoreMarketSettings", () => {
  it("(1) loja sem linha devolve legado BR com todas as fontes legacy_br e versão 0", async () => {
    mockQueries({});
    const dto = await getStoreMarketSettings(USER_ID);
    expect(dto).toMatchObject({
      countryCode: "BR",
      countrySource: "legacy_br",
      defaultCampaignMarket: "BR",
      defaultContentLocale: "pt-BR",
      defaultCurrency: "BRL",
      timeZone: "America/Sao_Paulo",
      settingsVersion: 0,
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("(2) linha materializada de legado", async () => {
    mockQueries({ settings: { data: rowFromState(state()), error: null } });
    const dto = await getStoreMarketSettings(USER_ID);
    expect(dto.defaultContentLocaleSource).toBe("legacy_br");
    expect(dto.defaultCurrencySource).toBe("legacy_br");
  });

  it("(11a) read_error vira 503, não 404", async () => {
    mockQueries({ store: { data: null, error: { message: "down" } } });
    await expect(getStoreMarketSettings(USER_ID)).rejects.toBeInstanceOf(
      PreferencesUnavailableError,
    );
  });

  it("loja inexistente vira StoreNotFoundError (404)", async () => {
    mockQueries({ store: { data: null, error: null } });
    await expect(getStoreMarketSettings(USER_ID)).rejects.toBeInstanceOf(StoreNotFoundError);
  });

  it("normaliza versões persistidas como string decimal", async () => {
    mockQueries({
      settings: {
        data: {
          ...rowFromState(state()),
          context_version: "1",
          settings_version: "2",
        },
        error: null,
      },
    });
    const dto = await getStoreMarketSettings(USER_ID);
    expect(dto.contextVersion).toBe(1);
    expect(dto.settingsVersion).toBe(2);
  });

  it("(11b) linha inválida vira 500", async () => {
    mockQueries({
      settings: {
        data: { ...rowFromState(state()), default_currency: "USD" },
        error: null,
      },
    });
    await expect(getStoreMarketSettings(USER_ID)).rejects.toBeInstanceOf(
      StoredPreferencesInvalidError,
    );
  });

  it("context_version desconhecida no GET vira 500", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ contextVersion: 2 })), error: null },
    });
    await expect(getStoreMarketSettings(USER_ID)).rejects.toBeInstanceOf(
      StoredPreferencesInvalidError,
    );
  });

  it("(17) billing não é consultado e país BR permanece", async () => {
    mockQueries({ settings: { data: rowFromState(state()), error: null } });
    const dto = await getStoreMarketSettings(USER_ID);
    expect(dto.countryCode).toBe("BR");
    expect(db.from).not.toHaveBeenCalledWith("store_billing_info");
  });

  it("(18) idioma do app não é consultado", async () => {
    mockQueries({ settings: { data: rowFromState(state()), error: null } });
    await getStoreMarketSettings(USER_ID);
    expect(db.from).not.toHaveBeenCalledWith("user_preferences");
  });
});

describe("recomposeStoreMarketSettings", () => {
  it("(3) BR→PY recomputa es-PY/PYG default e mantém fuso BR", () => {
    const next = recomposeStoreMarketSettings(state(), { defaultCampaignMarket: "PY" });
    expect(next.defaultCampaignMarket).toBe("PY");
    expect(next.defaultCampaignMarketSource).toBe("explicit");
    expect(next.defaultContentLocale).toBe("es-PY");
    expect(next.defaultContentLocaleSource).toBe("default");
    expect(next.defaultCurrency).toBe("PYG");
    expect(next.defaultCurrencySource).toBe("default");
    expect(next.timeZone).toBe("America/Sao_Paulo");
  });

  it("(4) PY→BR recomputa pt-BR/BRL", () => {
    const py = state({
      defaultCampaignMarket: "PY",
      defaultCampaignMarketSource: "explicit",
      defaultContentLocale: "es-PY",
      defaultContentLocaleSource: "default",
      defaultCurrency: "PYG",
      defaultCurrencySource: "default",
    });
    const next = recomposeStoreMarketSettings(py, { defaultCampaignMarket: "BR" });
    expect(next.defaultContentLocale).toBe("pt-BR");
    expect(next.defaultCurrency).toBe("BRL");
    expect(next.timeZone).toBe("America/Sao_Paulo");
  });

  it("(5) país BR + mercado PY explícito mantém es-PY/PYG e fuso SP", () => {
    const current = state({
      defaultCampaignMarket: "PY",
      defaultCampaignMarketSource: "explicit",
      defaultContentLocale: "es-PY",
      defaultContentLocaleSource: "default",
      defaultCurrency: "PYG",
      defaultCurrencySource: "default",
    });
    const next = recomposeStoreMarketSettings(current, { timeZone: "America/Sao_Paulo" });
    expect(next.countryCode).toBe("BR");
    expect(next.defaultContentLocale).toBe("es-PY");
    expect(next.defaultCurrency).toBe("PYG");
    expect(next.timeZone).toBe("America/Sao_Paulo");
    expect(next.timeZoneSource).toBe("explicit");
  });

  it("(6) explicit preservado em mudança de mercado", () => {
    const current = state({
      defaultContentLocale: "pt-BR",
      defaultContentLocaleSource: "explicit",
    });
    const next = recomposeStoreMarketSettings(current, { defaultCampaignMarket: "PY" });
    expect(next.defaultContentLocale).toBe("pt-BR");
    expect(next.defaultContentLocaleSource).toBe("explicit");
    expect(next.defaultCurrency).toBe("PYG");
  });

  it("(7) null em idioma recomputa para default", () => {
    const current = state({
      defaultContentLocale: "es-PY",
      defaultContentLocaleSource: "explicit",
    });
    const next = recomposeStoreMarketSettings(current, { defaultContentLocale: null });
    expect(next.defaultContentLocale).toBe("pt-BR");
    expect(next.defaultContentLocaleSource).toBe("default");
  });

  it("(8) omitido preserva valor e fonte", () => {
    const current = state({
      defaultContentLocale: "es-PY",
      defaultContentLocaleSource: "explicit",
    });
    const next = recomposeStoreMarketSettings(current, { defaultCurrency: "PYG" });
    expect(next.defaultContentLocale).toBe("es-PY");
    expect(next.defaultContentLocaleSource).toBe("explicit");
  });

  it("(12) country no patch lança CountryNotMutableError", () => {
    expect(() =>
      recomposeStoreMarketSettings(state(), { country: "PY" } as never),
    ).toThrow(CountryNotMutableError);
  });

  it("(13) PATCH de moeda sem mercado não reescreve fontes legadas", () => {
    const current = state();
    const next = recomposeStoreMarketSettings(current, { defaultCurrency: "PYG" });
    expect(next.defaultContentLocale).toBe("pt-BR");
    expect(next.defaultContentLocaleSource).toBe("legacy_br");
    expect(next.defaultCurrency).toBe("PYG");
    expect(next.defaultCurrencySource).toBe("explicit");
  });

  it("(13b) PATCH de idioma preserva fonte de moeda legacy_br", () => {
    const next = recomposeStoreMarketSettings(state(), { defaultContentLocale: "es-PY" });
    expect(next.defaultCurrencySource).toBe("legacy_br");
  });

  it("(14) primeira materialização só com timeZone mantém defaults legados nos demais", () => {
    const current = legacyStoreMarketSettingsState();
    const next = recomposeStoreMarketSettings(current, { timeZone: "America/Asuncion" });
    expect(next.timeZone).toBe("America/Asuncion");
    expect(next.timeZoneSource).toBe("explicit");
    expect(next.defaultCampaignMarketSource).toBe("legacy_br");
    expect(next.defaultContentLocaleSource).toBe("legacy_br");
    expect(next.defaultCurrencySource).toBe("legacy_br");
  });

  it("(15) legado materializado + BR→PY atualiza idioma/moeda para default", () => {
    const current = state({
      defaultCampaignMarket: "BR",
      defaultContentLocale: "pt-BR",
      defaultCurrency: "BRL",
    });
    const next = recomposeStoreMarketSettings(current, { defaultCampaignMarket: "PY" });
    expect(next.defaultContentLocale).toBe("es-PY");
    expect(next.defaultCurrency).toBe("PYG");
    expect(next.defaultContentLocaleSource).toBe("default");
    expect(next.defaultCurrencySource).toBe("default");
    expect(next.countrySource).toBe("legacy_br");
  });

  it("(16) patch vazio não muda valores/fontes", () => {
    const current = state();
    const next = recomposeStoreMarketSettings(current, {});
    expect(next).toEqual(current);
  });
});

describe("updateStoreMarketSettings", () => {
  it("context_version desconhecida no PATCH sem campos vira 500 sem RPC", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ contextVersion: 2 })), error: null },
    });
    await expect(
      updateStoreMarketSettings(USER_ID, { expectedVersion: 0 }),
    ).rejects.toBeInstanceOf(StoredPreferencesInvalidError);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("context_version desconhecida no PATCH com alteração vira 500 sem RPC", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ contextVersion: 2 })), error: null },
    });
    await expect(
      updateStoreMarketSettings(USER_ID, {
        defaultCurrency: "PYG",
        expectedVersion: 0,
      }),
    ).rejects.toBeInstanceOf(StoredPreferencesInvalidError);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("(9) PATCH sem campos só valida versão e não chama RPC", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ settingsVersion: 2 })), error: null },
    });
    const dto = await updateStoreMarketSettings(USER_ID, { expectedVersion: 2 });
    expect(dto.settingsVersion).toBe(2);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("(9b) versão divergente devolve 409 sem RPC", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ settingsVersion: 2 })), error: null },
    });
    await expect(
      updateStoreMarketSettings(USER_ID, { expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(PreferencesVersionConflictError);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("(10) concorrência: RPC devolve conflito com versão do hint", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ settingsVersion: 1 })), error: null },
    });
    db.rpc.mockResolvedValue({
      data: null,
      error: { message: "settings_version_conflict", hint: "2" },
    });
    await expect(
      updateStoreMarketSettings(USER_ID, {
        defaultCurrency: "PYG",
        expectedVersion: 1,
      }),
    ).rejects.toEqual(new PreferencesVersionConflictError(2));
  });

  it("(14b) loja sem linha + PATCH só timeZone materializa com defaults legados", async () => {
    mockQueries({ settings: { data: null, error: null } });
    db.rpc.mockResolvedValue({
      data: rowFromState(
        state({
          settingsVersion: 1,
          timeZone: "America/Asuncion",
          timeZoneSource: "explicit",
        }),
      ),
      error: null,
    });
    const dto = await updateStoreMarketSettings(USER_ID, {
      timeZone: "America/Asuncion",
      expectedVersion: 0,
    });
    expect(dto.timeZone).toBe("America/Asuncion");
    expect(db.rpc).toHaveBeenCalledWith(
      "write_store_market_settings",
      expect.objectContaining({
        p_country_code: "BR",
        p_country_source: "legacy_br",
        p_default_campaign_market: "BR",
        p_default_campaign_market_source: "legacy_br",
        p_default_content_locale: "pt-BR",
        p_default_content_locale_source: "legacy_br",
        p_default_currency: "BRL",
        p_default_currency_source: "legacy_br",
        p_expected_version: 0,
      }),
    );
  });

  it("(11) falha de RPC vira 503", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ settingsVersion: 1 })), error: null },
    });
    db.rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(
      updateStoreMarketSettings(USER_ID, {
        defaultCurrency: "PYG",
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(PreferencesUnavailableError);
  });

  it("(17b) RPC leva p_country_code BR mesmo com billing PY", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ settingsVersion: 1 })), error: null },
    });
    db.rpc.mockResolvedValue({
      data: rowFromState(state({ settingsVersion: 2, timeZone: "America/Asuncion", timeZoneSource: "explicit" })),
      error: null,
    });
    await updateStoreMarketSettings(USER_ID, {
      timeZone: "America/Asuncion",
      expectedVersion: 1,
    });
    expect(db.rpc).toHaveBeenCalledWith(
      "write_store_market_settings",
      expect.objectContaining({
        p_country_code: "BR",
        p_country_source: "legacy_br",
        p_expected_version: 1,
      }),
    );
    expect(db.from).not.toHaveBeenCalledWith("store_billing_info");
  });

  it("(18b) update não consulta user_preferences", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ settingsVersion: 1 })), error: null },
    });
    db.rpc.mockResolvedValue({
      data: rowFromState(state({ settingsVersion: 2, defaultCurrency: "PYG", defaultCurrencySource: "explicit" })),
      error: null,
    });
    await updateStoreMarketSettings(USER_ID, {
      defaultCurrency: "PYG",
      expectedVersion: 1,
    });
    expect(db.from).not.toHaveBeenCalledWith("user_preferences");
  });

  it("envia as 13 chaves da RPC e retorna DTO", async () => {
    mockQueries({
      settings: { data: rowFromState(state({ settingsVersion: 1 })), error: null },
    });
    db.rpc.mockResolvedValue({
      data: rowFromState(state({ settingsVersion: 2, defaultContentLocale: "es-PY", defaultContentLocaleSource: "explicit" })),
      error: null,
    });
    const dto = await updateStoreMarketSettings(USER_ID, {
      defaultContentLocale: "es-PY",
      expectedVersion: 1,
    });
    expect(dto.defaultContentLocale).toBe("es-PY");
    const args = db.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual(
      [
        "p_store_id",
        "p_default_campaign_market",
        "p_default_campaign_market_source",
        "p_default_content_locale",
        "p_default_content_locale_source",
        "p_default_currency",
        "p_default_currency_source",
        "p_time_zone",
        "p_time_zone_source",
        "p_country_code",
        "p_country_source",
        "p_context_version",
        "p_expected_version",
      ].sort(),
    );
  });
});
