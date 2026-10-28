import type { MarketContextError } from "@/lib/market-context";

/**
 * F57.2 — taxonomia de erros das preferências de mercado.
 *
 * Códigos públicos são uma união fechada; as classes carregam o status HTTP
 * esperado e nunca expõem detalhes internos do banco.
 */
export type PreferencesErrorCode =
  | "preferences_unavailable"
  | "preferences_version_conflict"
  | "settings_version_conflict"
  | "stored_preferences_invalid"
  | "country_not_mutable"
  | "validation_error";

export class PreferencesUnavailableError extends Error {
  readonly code = "preferences_unavailable" as const;
  readonly status = 503;

  constructor(message = "Preferências indisponíveis") {
    super(message);
    this.name = "PreferencesUnavailableError";
  }
}

export class PreferencesVersionConflictError extends Error {
  readonly code = "preferences_version_conflict" as const;
  readonly status = 409;

  constructor(readonly currentVersion: number) {
    super("A preferência foi alterada por outra operação");
    this.name = "PreferencesVersionConflictError";
  }
}

export class SettingsVersionConflictError extends Error {
  readonly code = "settings_version_conflict" as const;
  readonly status = 409;

  constructor(readonly currentVersion: number) {
    super("As configurações foram alteradas por outra operação");
    this.name = "SettingsVersionConflictError";
  }
}

export class PreferencesValidationError extends Error {
  readonly code = "validation_error" as const;
  readonly status = 400;

  constructor(readonly fieldErrors: Record<string, string>) {
    super("Dados inválidos");
    this.name = "PreferencesValidationError";
  }
}

export class CountryNotMutableError extends Error {
  readonly code = "country_not_mutable" as const;
  readonly status = 400;

  constructor(message = "País cadastral não é alterável por esta operação") {
    super(message);
    this.name = "CountryNotMutableError";
  }
}

export class StoredPreferencesInvalidError extends Error {
  readonly code = "stored_preferences_invalid" as const;
  readonly status = 500;

  constructor(readonly marketContextCause?: MarketContextError) {
    super("Preferência persistida inválida");
    this.name = "StoredPreferencesInvalidError";
  }
}

type PgLikeError = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

function asPgError(value: unknown): PgLikeError | null {
  if (typeof value !== "object" || value === null) return null;
  return value as PgLikeError;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function errorText(error: PgLikeError): string {
  return [textOf(error.message), textOf(error.details), textOf(error.hint)].join(" ");
}

function extractVersion(error: PgLikeError): number | null {
  for (const candidate of [error.hint, error.details]) {
    const text = textOf(candidate).trim();
    if (/^\d+$/.test(text)) {
      const parsed = Number(text);
      if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

/** Erro do PostgREST que sinaliza conflito de versão da preferência do usuário. */
export function isPreferencesVersionConflict(
  error: unknown,
): error is PgLikeError {
  const pg = asPgError(error);
  if (!pg) return false;
  return errorText(pg).includes("preferences_version_conflict");
}

/** Erro do PostgREST que sinaliza conflito de versão das configurações da loja. */
export function isSettingsVersionConflict(error: unknown): error is PgLikeError {
  const pg = asPgError(error);
  if (!pg) return false;
  return errorText(pg).includes("settings_version_conflict");
}

/** Erro do PostgREST que sinaliza tentativa de alterar o país cadastral. */
export function isCountryNotMutable(error: unknown): error is PgLikeError {
  const pg = asPgError(error);
  if (!pg) return false;
  return errorText(pg).includes("country_not_mutable");
}

/** Versão vigente extraída de HINT/DETAIL numérico, ou null. */
export function versionFromPgError(error: unknown): number | null {
  const pg = asPgError(error);
  if (!pg) return null;
  return extractVersion(pg);
}
