import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { StoreNotFoundError } from "@/lib/auth/store-ownership";
import {
  CountryNotMutableError,
  PreferencesUnavailableError,
  PreferencesValidationError,
  PreferencesVersionConflictError,
  StoredPreferencesInvalidError,
} from "@/lib/market-preferences/errors";
import {
  getStoreMarketSettings,
  updateStoreMarketSettings,
  type StoreMarketSettingsPatch,
} from "@/lib/market-preferences/store-market-settings-service";

const UpdateSettingsSchema = z
  .object({
    defaultCampaignMarket: z.enum(["BR", "PY"]).nullish(),
    defaultContentLocale: z.enum(["pt-BR", "es-PY"]).nullish(),
    defaultCurrency: z.enum(["BRL", "PYG"]).nullish(),
    timeZone: z.enum(["America/Sao_Paulo", "America/Asuncion"]).nullish(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

function errorResponse(error: unknown): NextResponse | null {
  if (error instanceof StoreNotFoundError) {
    return NextResponse.json(
      { error: "Loja não encontrada ou acesso negado" },
      { status: 404 },
    );
  }
  if (error instanceof CountryNotMutableError) {
    return NextResponse.json(
      { error: "País cadastral não é alterável por esta rota", code: "country_not_mutable" },
      { status: 400 },
    );
  }
  if (error instanceof PreferencesValidationError) {
    return NextResponse.json(
      { error: "Dados inválidos", code: "validation_error", fieldErrors: error.fieldErrors },
      { status: 400 },
    );
  }
  if (error instanceof PreferencesVersionConflictError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "settings_version_conflict",
        currentVersion: error.currentVersion,
      },
      { status: 409 },
    );
  }
  if (error instanceof StoredPreferencesInvalidError) {
    return NextResponse.json(
      { error: "Configuração persistida inválida", code: "stored_preferences_invalid" },
      { status: 500 },
    );
  }
  if (error instanceof PreferencesUnavailableError) {
    return NextResponse.json(
      { error: "Preferências indisponíveis", code: "preferences_unavailable" },
      { status: 503 },
    );
  }
  return null;
}

export const GET = apiHandler(async () => {
  const user = await requireApiUser();
  try {
    return NextResponse.json(await getStoreMarketSettings(user.userId));
  } catch (error) {
    const mapped = errorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});

export const PATCH = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);
  const user = await requireApiUser();

  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Dados inválidos", code: "validation_error" },
      { status: 400 },
    );
  }

  const record = body as Record<string, unknown>;
  if ("country" in record || "country_code" in record) {
    return NextResponse.json(
      { error: "País cadastral não é alterável por esta rota", code: "country_not_mutable" },
      { status: 400 },
    );
  }

  const parsed = UpdateSettingsSchema.safeParse(record);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "body"] = issue.message;
    }
    return NextResponse.json(
      { error: "Dados inválidos", code: "validation_error", fieldErrors },
      { status: 400 },
    );
  }

  const patch = parsed.data as StoreMarketSettingsPatch;
  try {
    return NextResponse.json(await updateStoreMarketSettings(user.userId, patch));
  } catch (error) {
    const mapped = errorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});
