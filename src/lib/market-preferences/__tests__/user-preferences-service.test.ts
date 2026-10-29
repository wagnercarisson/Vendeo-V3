import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: db }));

import {
  PreferencesUnavailableError,
  PreferencesValidationError,
  PreferencesVersionConflictError,
  StoredPreferencesInvalidError,
} from "../errors";
import {
  getUserLocalePreference,
  mapStoredUserLocalePreference,
  updateUserLocalePreference,
} from "../user-preferences-service";
import type { SupportedUiLocale } from "@/lib/market-context";

function mockRead(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  db.from.mockReturnValue({ select });
  return { select, eq, maybeSingle };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserLocalePreference", () => {
  it("usuário sem linha lê pt-BR/legacy_br sem escrever", async () => {
    const chain = mockRead({ data: null, error: null });
    const dto = await getUserLocalePreference("user-a");
    expect(dto).toEqual({ uiLocale: "pt-BR", source: "legacy_br", version: 0 });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("linha explícita devolve o valor persistido", async () => {
    mockRead({
      data: { ui_locale: "es-419", ui_locale_source: "explicit", version: 3 },
      error: null,
    });
    await expect(getUserLocalePreference("user-a")).resolves.toEqual({
      uiLocale: "es-419",
      source: "explicit",
      version: 3,
    });
  });

  it("linha NULL + legacy_br é válida (não 500)", async () => {
    mockRead({
      data: { ui_locale: null, ui_locale_source: "legacy_br", version: 1 },
      error: null,
    });
    await expect(getUserLocalePreference("user-a")).resolves.toEqual({
      uiLocale: "pt-BR",
      source: "legacy_br",
      version: 1,
    });
  });

  it("falha de banco vira 503, nunca legado", async () => {
    mockRead({ data: null, error: { message: "down" } });
    await expect(getUserLocalePreference("user-a")).rejects.toBeInstanceOf(
      PreferencesUnavailableError,
    );
  });

  it.each([
    { ui_locale: "es-PY", ui_locale_source: "legacy_br", version: 1 },
    { ui_locale: "es-PY", ui_locale_source: "explicit", version: 1 },
    { ui_locale: null, ui_locale_source: "explicit", version: 1 },
    { ui_locale: null, ui_locale_source: null, version: 1 },
    { ui_locale: "es-AR", ui_locale_source: "explicit", version: 1 },
    { ui_locale: "pt-BR", ui_locale_source: "explicit", version: -1 },
    { ui_locale: "pt-BR", ui_locale_source: "explicit", version: null },
    { ui_locale: "pt-BR", ui_locale_source: "explicit", version: true },
    { ui_locale: "pt-BR", ui_locale_source: "explicit", version: "" },
    { ui_locale: "pt-BR", ui_locale_source: "explicit", version: "1.5" },
  ])("par persistido corrompido vira 500: %j", async (row) => {
    mockRead({ data: row, error: null });
    await expect(getUserLocalePreference("user-a")).rejects.toBeInstanceOf(
      StoredPreferencesInvalidError,
    );
  });
});

describe("updateUserLocalePreference", () => {
  it("null limpa, chama RPC com 3 chaves e incrementa versão", async () => {
    db.rpc.mockResolvedValue({
      data: { ui_locale: null, ui_locale_source: "legacy_br", version: 2 },
      error: null,
    });
    const dto = await updateUserLocalePreference("user-a", {
      uiLocale: null,
      expectedVersion: 1,
    });
    expect(dto).toEqual({ uiLocale: "pt-BR", source: "legacy_br", version: 2 });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("write_user_locale_preference", {
      p_user_id: "user-a",
      p_ui_locale: null,
      p_expected_version: 1,
    });
  });

  it("valor suportado grava explicit", async () => {
    db.rpc.mockResolvedValue({
      data: { ui_locale: "es-419", ui_locale_source: "explicit", version: 2 },
      error: null,
    });
    await expect(
      updateUserLocalePreference("user-a", { uiLocale: "es-419", expectedVersion: 1 }),
    ).resolves.toEqual({ uiLocale: "es-419", source: "explicit", version: 2 });
  });

  it("omitido com versão válida não chama RPC", async () => {
    mockRead({
      data: { ui_locale: null, ui_locale_source: "legacy_br", version: 1 },
      error: null,
    });
    const dto = await updateUserLocalePreference("user-a", { expectedVersion: 1 });
    expect(dto).toEqual({ uiLocale: "pt-BR", source: "legacy_br", version: 1 });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("omitido com versão divergente devolve 409 sem RPC", async () => {
    mockRead({
      data: { ui_locale: "es-419", ui_locale_source: "explicit", version: 2 },
      error: null,
    });
    await expect(
      updateUserLocalePreference("user-a", { expectedVersion: 1 }),
    ).rejects.toMatchObject({ name: "PreferencesVersionConflictError", currentVersion: 2 });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("valor inválido não chama RPC", async () => {
    await expect(
      updateUserLocalePreference("user-a", {
        uiLocale: "es-AR" as SupportedUiLocale,
        expectedVersion: 0,
      }),
    ).rejects.toBeInstanceOf(PreferencesValidationError);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("es-PY não é aceito como idioma da interface", async () => {
    await expect(
      updateUserLocalePreference("user-a", {
        uiLocale: "es-PY" as SupportedUiLocale,
        expectedVersion: 0,
      }),
    ).rejects.toBeInstanceOf(PreferencesValidationError);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("conflito da RPC usa a versão do hint", async () => {
    db.rpc.mockResolvedValue({
      data: null,
      error: { message: "preferences_version_conflict", hint: "4" },
    });
    await expect(
      updateUserLocalePreference("user-a", { uiLocale: "pt-BR", expectedVersion: 2 }),
    ).rejects.toEqual(new PreferencesVersionConflictError(4));
  });

  it("falha de banco na RPC vira 503", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    await expect(
      updateUserLocalePreference("user-a", { uiLocale: "pt-BR", expectedVersion: 0 }),
    ).rejects.toBeInstanceOf(PreferencesUnavailableError);
  });

  it("retorno incoerente da RPC vira 500", async () => {
    db.rpc.mockResolvedValue({
      data: { ui_locale: null, ui_locale_source: "explicit", version: 2 },
      error: null,
    });
    await expect(
      updateUserLocalePreference("user-a", { uiLocale: null, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(StoredPreferencesInvalidError);
  });

  it("A/B: usa somente o userId informado e não toca stores", async () => {
    db.rpc.mockResolvedValue({
      data: { ui_locale: "pt-BR", ui_locale_source: "explicit", version: 1 },
      error: null,
    });
    await updateUserLocalePreference("user-b", { uiLocale: "pt-BR", expectedVersion: 0 });
    expect(db.rpc).toHaveBeenCalledWith("write_user_locale_preference", {
      p_user_id: "user-b",
      p_ui_locale: "pt-BR",
      p_expected_version: 0,
    });
    expect(db.from).not.toHaveBeenCalledWith("stores");
    expect(db.from).not.toHaveBeenCalledWith("store_market_settings");
  });
});

describe("mapStoredUserLocalePreference", () => {
  it("é o único tradutor e não expõe chaves cruas", () => {
    const dto = mapStoredUserLocalePreference({
      ui_locale: null,
      ui_locale_source: "legacy_br",
      version: 1,
    });
    expect(Object.keys(dto)).toEqual(["uiLocale", "source", "version"]);
  });
});
