import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import {
  resolveUiLocale,
  type SupportedContentLocale,
} from "@/lib/market-context";
import {
  PreferencesUnavailableError,
  PreferencesValidationError,
  PreferencesVersionConflictError,
  StoredPreferencesInvalidError,
  isPreferencesVersionConflict,
  versionFromPgError,
} from "./errors";
import type { UserLocalePreferenceDTO } from "./dtos";
import { parseStoredInteger } from "./dtos";

/**
 * F57.2 — serviço da preferência de idioma do aplicativo.
 *
 * Cliente `service_role` é obrigatório porque:
 * - a escrita só existe pela RPC `write_user_locale_preference`;
 * - a leitura precisa distinguir "sem linha" (legado) de falha do banco.
 * O `userId` sempre vem do servidor autenticado; nunca do corpo.
 */

type RawPreferenceRow = {
  ui_locale: unknown;
  ui_locale_source: unknown;
  version: unknown;
};

function asRow(value: unknown): RawPreferenceRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StoredPreferencesInvalidError();
  }
  const record = value as Record<string, unknown>;
  return {
    ui_locale: record.ui_locale,
    ui_locale_source: record.ui_locale_source,
    version: record.version,
  };
}

function versionOf(row: RawPreferenceRow): number {
  const parsed = parseStoredInteger(row.version);
  if (parsed === null) {
    throw new StoredPreferencesInvalidError();
  }
  return parsed;
}

/**
 * ÚNICO caminho de tradução linha persistida -> DTO.
 * Usado por GET, PATCH omitido e validação pós-escrita.
 */
export function mapStoredUserLocalePreference(
  raw: Record<string, unknown>,
): UserLocalePreferenceDTO {
  const row = asRow(raw);
  const version = versionOf(row);

  if (row.ui_locale === null && row.ui_locale_source === "legacy_br") {
    const resolution = resolveUiLocale({ kind: "legacy" });
    if (!resolution.ok) throw new StoredPreferencesInvalidError(resolution.error);
    return {
      uiLocale: resolution.uiLocale,
      source: "legacy_br",
      version,
    };
  }

  if (row.ui_locale !== null && row.ui_locale_source === "explicit") {
    const resolution = resolveUiLocale({
      kind: "explicit",
      uiLocale: row.ui_locale,
    });
    if (!resolution.ok) throw new StoredPreferencesInvalidError(resolution.error);
    return {
      uiLocale: resolution.uiLocale,
      source: "explicit",
      version,
    };
  }

  throw new StoredPreferencesInvalidError();
}

async function readPreferenceRow(userId: string): Promise<RawPreferenceRow | null> {
  const { data, error } = await supabaseAdmin
    .from("user_preferences")
    .select("ui_locale, ui_locale_source, version")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new PreferencesUnavailableError();
  }
  if (!data) return null;
  return asRow(data);
}

export async function getUserLocalePreference(
  userId: string,
): Promise<UserLocalePreferenceDTO> {
  const row = await readPreferenceRow(userId);
  if (!row) {
    return { uiLocale: "pt-BR", source: "legacy_br", version: 0 };
  }
  return mapStoredUserLocalePreference(row as unknown as Record<string, unknown>);
}

export interface UpdateUserLocalePreferenceInput {
  uiLocale?: SupportedContentLocale | null;
  expectedVersion: number;
}

export async function updateUserLocalePreference(
  userId: string,
  input: UpdateUserLocalePreferenceInput,
): Promise<UserLocalePreferenceDTO> {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new PreferencesValidationError({
      expectedVersion: "expectedVersion deve ser inteiro >= 0",
    });
  }

  // Omitido: apenas valida a versão; NÃO materializa linha nem chama a RPC.
  if (input.uiLocale === undefined) {
    const row = await readPreferenceRow(userId);
    const current = row
      ? mapStoredUserLocalePreference(row as unknown as Record<string, unknown>)
      : { uiLocale: "pt-BR" as const, source: "legacy_br" as const, version: 0 };
    if (current.version !== input.expectedVersion) {
      throw new PreferencesVersionConflictError(current.version);
    }
    return current;
  }

  let uiLocale: SupportedContentLocale | null;
  if (input.uiLocale === null) {
    uiLocale = null;
  } else {
    const resolution = resolveUiLocale({
      kind: "explicit",
      uiLocale: input.uiLocale,
    });
    if (!resolution.ok) {
      throw new PreferencesValidationError({ uiLocale: "Locale não suportado" });
    }
    uiLocale = resolution.uiLocale;
  }

  const { data, error } = await supabaseAdmin.rpc(
    "write_user_locale_preference",
    {
      p_user_id: userId,
      p_ui_locale: uiLocale,
      p_expected_version: input.expectedVersion,
    },
  );

  if (error) {
    if (isPreferencesVersionConflict(error)) {
      const hinted = versionFromPgError(error);
      if (hinted !== null) {
        throw new PreferencesVersionConflictError(hinted);
      }
      const current = await readPreferenceRow(userId);
      const version = current ? versionOf(current) : 0;
      throw new PreferencesVersionConflictError(version);
    }
    throw new PreferencesUnavailableError();
  }

  const raw = Array.isArray(data) ? data[0] : data;
  if (typeof raw !== "object" || raw === null) {
    throw new StoredPreferencesInvalidError();
  }
  return mapStoredUserLocalePreference(raw as Record<string, unknown>);
}
