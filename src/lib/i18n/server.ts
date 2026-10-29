import "server-only";

import { cache } from "react";

import type { UserLocalePreferenceDTO } from "@/lib/market-preferences/dtos";
import {
  PreferencesUnavailableError,
  StoredPreferencesInvalidError,
} from "@/lib/market-preferences/errors";
import { getUserLocalePreference } from "@/lib/market-preferences/user-preferences-service";

import type { SupportedUiLocale } from "./locales";

/**
 * Resolução server-first do idioma da interface (F57.4).
 *
 * - cache por requisição via `cache()` do React (nunca estado mutável de módulo);
 * - limite de espera de 200 ms sem alterar o cliente Supabase;
 * - fallback `pt-BR` apenas para falhas conhecidas, sem bloquear a página;
 * - erro desconhecido propaga para não mascarar bug;
 * - logs sem PII.
 */

export const UI_LOCALE_READ_TIMEOUT_MS = 200;

export type UiRenderErrorCode =
  | "preferences_unavailable"
  | "stored_preferences_invalid"
  | "preferences_read_timeout";

export type UiRenderContext =
  | { ok: true; locale: SupportedUiLocale; preference: UserLocalePreferenceDTO }
  | { ok: false; locale: "pt-BR"; errorCode: UiRenderErrorCode };

type UiRenderOutcome = "ok" | "timeout" | "unavailable" | "invalid";

const READ_TIMEOUT = Symbol("ui-locale-read-timeout");

function failure(errorCode: UiRenderErrorCode): UiRenderContext {
  return Object.freeze({ ok: false, locale: "pt-BR", errorCode });
}

function success(
  locale: SupportedUiLocale,
  preference: UserLocalePreferenceDTO,
): UiRenderContext {
  return Object.freeze({ ok: true, locale, preference });
}

function warn(code: UiRenderErrorCode): void {
  console.warn(`[i18n] ${code}`);
}

export const getUiRenderContext = cache(
  async (userId: string): Promise<UiRenderContext> => {
    const startedAt = Date.now();
    let outcome: UiRenderOutcome = "ok";
    let timer: ReturnType<typeof setTimeout> | undefined;

    const read = getUserLocalePreference(userId);
    // Isola rejeição tardia da leitura original sem alterar o resultado do race.
    read.catch(() => undefined);

    try {
      const timeout = new Promise<typeof READ_TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(READ_TIMEOUT), UI_LOCALE_READ_TIMEOUT_MS);
      });

      const result = await Promise.race([read, timeout]);

      if (result === READ_TIMEOUT) {
        outcome = "timeout";
        warn("preferences_read_timeout");
        return failure("preferences_read_timeout");
      }

      return success(result.uiLocale, result);
    } catch (error) {
      if (error instanceof PreferencesUnavailableError) {
        outcome = "unavailable";
        warn("preferences_unavailable");
        return failure("preferences_unavailable");
      }
      if (error instanceof StoredPreferencesInvalidError) {
        outcome = "invalid";
        warn("stored_preferences_invalid");
        return failure("stored_preferences_invalid");
      }
      throw error;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (process.env.I18N_TIMING === "1") {
        console.info(
          "[i18n] ui_locale_read_ms",
          Date.now() - startedAt,
          "outcome=" + outcome,
        );
      }
    }
  },
);
