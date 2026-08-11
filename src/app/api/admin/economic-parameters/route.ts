import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { UpdateEconomicParameterRequestSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";
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

/**
 * PUT /api/admin/economic-parameters (D2) — atualiza um parâmetro econômico
 * via RPC `admin_set_economic_parameter` (SECURITY DEFINER, única via de
 * escrita — padrão financeiro F38). zod (UpdateEconomicParameterRequestSchema):
 * key enum, value > 0, reason obrigatório, operationId opcional (idempotência).
 * Sem endpoint público — somente admin (requireAdmin).
 */
export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = UpdateEconomicParameterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_set_economic_parameter",
    {
      p_actor_id: admin.userId,
      p_key: parsed.data.key,
      p_value: parsed.data.value,
      p_reason: parsed.data.reason,
      p_operation_id: parsed.data.operationId ?? null,
    },
  );

  if (error) {
    console.error("[economic] admin_set_economic_parameter error", error.message);
    return NextResponse.json(
      { error: "economic_parameter_update_failed" },
      { status: 500 },
    );
  }

  const result = data as Record<string, unknown>;
  return NextResponse.json({
    parameter: { key: result.key, value: result.value },
    auditId: result.audit_id,
    updatedAt: result.updated_at,
    idempotent: result.idempotent,
  });
});
