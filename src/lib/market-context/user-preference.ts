import type {
  MarketContextError,
  SupportedContentLocale,
  UserLocaleResolution,
} from "./types";
import {
  createError,
  findUnexpectedKey,
  isPlainObject,
  isSupportedLocale,
  receivedValue,
} from "./validation";

function failure(error: MarketContextError): UserLocaleResolution {
  const result: UserLocaleResolution = { ok: false, error };
  return Object.freeze(result);
}

/**
 * Resolve o idioma do aplicativo.
 *
 * Regra dura: esta função NÃO recebe loja, país ou mercado. Mercado não
 * escolhe idioma de app. Ausência total precisa ser declarada como `legacy`.
 */
export function resolveUiLocale(input: unknown): UserLocaleResolution {
  if (!isPlainObject(input)) {
    return failure(
      createError("invalid_input", {
        reason: "not_an_object",
        received: receivedValue(input),
      }),
    );
  }

  const kind = input.kind;

  if (kind === "legacy") {
    // Legado significa ausência TOTAL de preferência. Um `uiLocale` presente
    // contradiz a declaração e não pode ser descartado em favor de pt-BR.
    const extraKey = findUnexpectedKey(input, ["kind"]);
    if (extraKey !== undefined) {
      return failure(
        createError("invalid_input", {
          field: extraKey,
          reason: "invalid_field",
          received: receivedValue(input[extraKey]),
        }),
      );
    }

    const result: UserLocaleResolution = {
      ok: true,
      uiLocale: "pt-BR",
      provenance: "legacy_br",
    };
    return Object.freeze(result);
  }

  if (kind !== "explicit") {
    return failure(
      createError("invalid_input", {
        field: "kind",
        reason: "invalid_field",
        received: receivedValue(kind),
      }),
    );
  }

  const uiLocale = input.uiLocale;
  if (uiLocale === undefined || uiLocale === null) {
    return failure(
      createError("invalid_input", {
        field: "uiLocale",
        reason: "incomplete",
      }),
    );
  }
  if (!isSupportedLocale(uiLocale)) {
    return failure(
      createError("unsupported_locale", {
        field: "uiLocale",
        reason: "invalid_field",
        received: receivedValue(uiLocale),
      }),
    );
  }

  const locale: SupportedContentLocale = uiLocale;
  const result: UserLocaleResolution = {
    ok: true,
    uiLocale: locale,
    provenance: "explicit",
  };
  return Object.freeze(result);
}
