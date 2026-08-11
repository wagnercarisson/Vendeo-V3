import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  EconomicParameterService,
  EconomicParameterUnavailableError,
} from "@/lib/economic/economic-parameter-service";

/**
 * GET /api/admin/economic-parameters (D2) — lista resolvida dos parâmetros
 * econômicos via EconomicParameterService.getAll() (source table/fallback).
 * Somente admin (requireAdmin); NENHUM parâmetro de query — leitura pura.
 * Fail-closed: erro real de leitura → 503 economic_parameters_unavailable.
 */
export const GET = apiHandler(async () => {
  await requireAdmin();

  let parameters;
  try {
    parameters = await new EconomicParameterService().getAll();
  } catch (err) {
    if (err instanceof EconomicParameterUnavailableError) {
      return NextResponse.json(
        { error: "economic_parameters_unavailable" },
        { status: 503 },
      );
    }
    throw err;
  }

  return NextResponse.json({ parameters });
});
