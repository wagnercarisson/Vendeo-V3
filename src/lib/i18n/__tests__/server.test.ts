import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const service = vi.hoisted(() => ({
  getUserLocalePreference: vi.fn(),
}));

vi.mock("@/lib/market-preferences/user-preferences-service", () => ({
  getUserLocalePreference: service.getUserLocalePreference,
}));

import {
  PreferencesUnavailableError,
  StoredPreferencesInvalidError,
} from "@/lib/market-preferences/errors";
import type { UserLocalePreferenceDTO } from "@/lib/market-preferences/dtos";
import {
  UI_LOCALE_READ_TIMEOUT_MS,
  getUiRenderContext,
} from "../server";

const PT: UserLocalePreferenceDTO = {
  uiLocale: "pt-BR",
  source: "legacy_br",
  version: 0,
};

const ES: UserLocalePreferenceDTO = {
  uiLocale: "es-419",
  source: "explicit",
  version: 4,
};

let unhandledHandler:
  | ((reason: unknown, promise: Promise<unknown>) => void)
  | undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  if (unhandledHandler) {
    process.off("unhandledRejection", unhandledHandler);
    unhandledHandler = undefined;
  }
});

describe("getUiRenderContext", () => {
  it("devolve es-419 para preferência explícita sem escrever", async () => {
    service.getUserLocalePreference.mockResolvedValue(ES);

    const context = await getUiRenderContext("user-es");

    expect(context).toEqual({
      ok: true,
      locale: "es-419",
      preference: ES,
    });
    expect(service.getUserLocalePreference).toHaveBeenCalledTimes(1);
    expect(service.getUserLocalePreference).toHaveBeenCalledWith("user-es");
    // O módulo mockado só expõe leitura: nenhuma função de escrita existe.
    expect(Object.keys(service)).toEqual(["getUserLocalePreference"]);
  });

  it("devolve pt-BR para preferência legada", async () => {
    service.getUserLocalePreference.mockResolvedValue(PT);

    await expect(getUiRenderContext("user-legacy")).resolves.toEqual({
      ok: true,
      locale: "pt-BR",
      preference: PT,
    });
  });

  it("resolve leitura de 250 ms, acima do limite antigo de 200 ms", async () => {
    vi.useFakeTimers();

    let resolveRead: (value: UserLocalePreferenceDTO) => void = () => {};
    const pending = new Promise<UserLocalePreferenceDTO>((resolve) => {
      resolveRead = resolve;
    });
    service.getUserLocalePreference.mockReturnValue(pending);

    const promise = getUiRenderContext("user-250");
    await vi.advanceTimersByTimeAsync(250);
    resolveRead(ES);
    await vi.advanceTimersByTimeAsync(0);

    await expect(promise).resolves.toEqual({
      ok: true,
      locale: "es-419",
      preference: ES,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aplica timeout de 1000 ms, limpa o timer e isola rejeição tardia", async () => {
    vi.useFakeTimers();

    let rejectRead: (reason: unknown) => void = () => {};
    const pending = new Promise<UserLocalePreferenceDTO>((_resolve, reject) => {
      rejectRead = reject;
    });
    service.getUserLocalePreference.mockReturnValue(pending);

    const unhandled = vi.fn();
    unhandledHandler = unhandled;
    process.on("unhandledRejection", unhandledHandler);

    const promise = getUiRenderContext("user-slow");
    await vi.advanceTimersByTimeAsync(UI_LOCALE_READ_TIMEOUT_MS);

    await expect(promise).resolves.toEqual({
      ok: false,
      locale: "pt-BR",
      errorCode: "preferences_read_timeout",
    });
    expect(UI_LOCALE_READ_TIMEOUT_MS).toBe(1000);
    expect(vi.getTimerCount()).toBe(0);

    // Rejeição tardia da leitura original não pode virar unhandledRejection.
    rejectRead(new Error("late failure"));
    await Promise.resolve();
    await Promise.resolve();

    expect(unhandled).not.toHaveBeenCalled();
  });

  it("mapeia falhas conhecidas e propaga erro desconhecido sem PII", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    service.getUserLocalePreference.mockRejectedValueOnce(
      new PreferencesUnavailableError(),
    );
    await expect(getUiRenderContext("user-unavailable")).resolves.toEqual({
      ok: false,
      locale: "pt-BR",
      errorCode: "preferences_unavailable",
    });

    service.getUserLocalePreference.mockRejectedValueOnce(
      new StoredPreferencesInvalidError(),
    );
    await expect(getUiRenderContext("user-invalid")).resolves.toEqual({
      ok: false,
      locale: "pt-BR",
      errorCode: "stored_preferences_invalid",
    });

    service.getUserLocalePreference.mockRejectedValueOnce(
      new Error("unexpected boom"),
    );
    await expect(getUiRenderContext("user-unknown")).rejects.toThrow(
      "unexpected boom",
    );

    const logged = warn.mock.calls.flat().map((arg) => String(arg));
    expect(logged.join(" ")).not.toContain("user-unavailable");
    expect(logged.join(" ")).not.toContain("user-invalid");
  });

  it("usuários distintos não compartilham resultado", async () => {
    service.getUserLocalePreference.mockImplementation(async (userId: string) =>
      userId === "user-a" ? PT : ES,
    );

    const first = await getUiRenderContext("user-a");
    const second = await getUiRenderContext("user-b");
    const firstAgain = await getUiRenderContext("user-a");

    expect(first.ok && first.locale).toBe("pt-BR");
    expect(second.ok && second.locale).toBe("es-419");
    expect(firstAgain.ok && firstAgain.locale).toBe("pt-BR");
    expect(service.getUserLocalePreference).toHaveBeenCalledTimes(3);
  });

  it("emite timing apenas com I18N_TIMING=1, sem userId", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    service.getUserLocalePreference.mockResolvedValue(PT);

    vi.stubEnv("I18N_TIMING", "1");
    await getUiRenderContext("user-timing");
    expect(info).toHaveBeenCalledTimes(1);

    const [tag, elapsed, outcome] = info.mock.calls[0];
    expect(tag).toBe("[i18n] ui_locale_read_ms");
    expect(typeof elapsed).toBe("number");
    expect(String(outcome)).toMatch(
      /^outcome=(ok|timeout|unavailable|invalid)$/,
    );
    expect(info.mock.calls.flat().map((arg) => String(arg)).join(" ")).not.toContain(
      "user-timing",
    );

    info.mockClear();
    vi.stubEnv("I18N_TIMING", undefined);
    await getUiRenderContext("user-no-timing");
    expect(info).not.toHaveBeenCalled();
  });
});
