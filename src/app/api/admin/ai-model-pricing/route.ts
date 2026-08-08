import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  AiModelPricingQuerySchema,
  AiModelPricingUpdateSchema,
} from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Converte NUMERIC do Postgres (string | number) para number no JSON de
 * resposta — evita inconsistência string/number no cliente (contrato 6.7).
 */
function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const parsed = AiModelPricingQuerySchema.safeParse({
    provider: searchParams.get("provider") ?? undefined,
    model: searchParams.get("model") ?? undefined,
    includeHistory: searchParams.get("includeHistory") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { provider, model, includeHistory } = parsed.data;

  let query = supabaseAdmin
    .from("ai_model_pricing")
    .select(
      "id, provider, model, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m, effective_from, effective_until, source_url, source_note, updated_by, updated_at",
    );

  if (provider) query = query.eq("provider", provider);
  if (model) query = query.eq("model", model);

  if (includeHistory === "true") {
    // Vigentes + histórico: todas as versões, mais recente primeiro
    query = query.order("effective_from", { ascending: false });
  } else {
    // Estrutura vigente: 1 linha por provider/model com effective_until IS NULL
    query = query.is("effective_until", null);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const prices = (data ?? []).map((row) => ({
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputTokenUsdPer1M: toNumber(row.input_token_usd_per_1m),
    outputTokenUsdPer1M: toNumber(row.output_token_usd_per_1m),
    cachedInputTokenUsdPer1M: toNumber(row.cached_input_token_usd_per_1m),
    imageUnitUsd: toNumber(row.image_unit_usd),
    imageTokenUsdPer1M: toNumber(row.image_token_usd_per_1m),
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    sourceUrl: row.source_url ?? null,
    sourceNote: row.source_note ?? null,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({ prices });
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body;
  try {
    body = AiModelPricingUpdateSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: err.errors },
        { status: 400 },
      );
    }
    throw err;
  }

  const { data, error } = await supabaseAdmin.rpc("admin_set_ai_model_price", {
    p_actor_id: admin.userId,
    p_provider: body.provider,
    p_model: body.model,
    p_input: body.inputCostUsd ?? null,
    p_output: body.outputCostUsd ?? null,
    p_reason: body.reason,
    p_cached: body.cachedInputCostUsd ?? null,
    p_image_unit: body.imageUnitCostUsd ?? null,
    p_image_token: body.imageTokenCostUsd ?? null,
    p_source_url: body.sourceUrl ?? null,
    p_source_note: body.sourceNote ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (
      msg.includes("ai_model_price_reason_required") ||
      msg.includes("ai_model_price_no_dimension")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const result = data as Record<string, unknown>;
  return NextResponse.json({
    pricing: {
      id: result.id,
      provider: result.provider,
      model: result.model,
      effectiveFrom: result.effective_from,
      previousId: result.previous_id ?? null,
    },
  });
});
