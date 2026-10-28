import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import {
  PreferencesUnavailableError,
  PreferencesValidationError,
  PreferencesVersionConflictError,
  StoredPreferencesInvalidError,
} from "@/lib/market-preferences/errors";
import {
  getUserLocalePreference,
  updateUserLocalePreference,
} from "@/lib/market-preferences/user-preferences-service";

const UpdatePreferenceSchema = z
  .object({
    uiLocale: z.enum(["pt-BR", "es-PY"]).nullish(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

function errorResponse(error: unknown): NextResponse | null {
  if (error instanceof PreferencesValidationError) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        code: "validation_error",
        fieldErrors: error.fieldErrors,
      },
      { status: 400 },
    );
  }
  if (error instanceof PreferencesVersionConflictError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "preferences_version_conflict",
        currentVersion: error.currentVersion,
      },
      { status: 409 },
    );
  }
  if (error instanceof StoredPreferencesInvalidError) {
    return NextResponse.json(
      {
        error: "Preferência persistida inválida",
        code: "stored_preferences_invalid",
      },
      { status: 500 },
    );
  }
  if (error instanceof PreferencesUnavailableError) {
    return NextResponse.json(
      {
        error: "Preferências indisponíveis",
        code: "preferences_unavailable",
      },
      { status: 503 },
    );
  }
  return null;
}

export const GET = apiHandler(async () => {
  const user = await requireApiUser();
  try {
    const dto = await getUserLocalePreference(user.userId);
    return NextResponse.json(dto);
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
  if (body === null) {
    return NextResponse.json(
      { error: "Dados inválidos", code: "validation_error" },
      { status: 400 },
    );
  }

  const parsed = UpdatePreferenceSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "body";
      fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { error: "Dados inválidos", code: "validation_error", fieldErrors },
      { status: 400 },
    );
  }

  try {
    const dto = await updateUserLocalePreference(user.userId, {
      uiLocale: parsed.data.uiLocale,
      expectedVersion: parsed.data.expectedVersion,
    });
    return NextResponse.json(dto);
  } catch (error) {
    const mapped = errorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});
