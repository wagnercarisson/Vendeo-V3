import { NextRequest, NextResponse } from "next/server";
import { runOpenAiPricingSync } from "@/lib/ai-cost/openai-pricing-sync";

export const maxDuration = 30;

/**
 * Cron diário de tarifas OpenAI. Autenticação pelo CRON_SECRET existente.
 * Não compartilha execução/estado com os crons de créditos.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "cron_secret_not_configured" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await runOpenAiPricingSync();

  if (result.status === "success") {
    return NextResponse.json({
      ok: true,
      status: "success",
      attemptId: result.attemptId,
      modelsChecked: result.modelsChecked,
      pricesChecked: result.pricesChecked,
      pricesChanged: result.pricesChanged,
    });
  }

  if (result.status === "skipped") {
    return NextResponse.json(
      { ok: false, status: "skipped", error: "pricing_sync_in_progress" },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      status: "failed",
      error: "pricing_sync_failed",
      stage: result.stage,
      code: result.code,
    },
    { status: 500 },
  );
}
