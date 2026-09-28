import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { resolveBenchCost } from "@/lib/lab/bench/execution/bench-cost-resolver";
import { BenchPresetError, resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";
import {
  BenchStoreManifestError,
  assertBenchTestStore,
} from "@/lib/lab/bench/domain/store-manifest";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.2 (D4/D11/D12/T-48-2-2-31): estimativa antes da execução, pelo resolvedor
// **local da bancada** chaveado pelo preset completo (`provider + model + protocol
// + quality + size`). Ordem: admin → guarda de ambiente → **`assertBenchTestStore`
// antes de resolver** → preset habilitado → custo. Cobertura `partial`/`missing`
// **não** bloqueia: a resposta continua 200 e sinaliza a ressalva.

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  try {
    assertLabEnvironment();
  } catch (error) {
    if (error instanceof LabEnvironmentError) {
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), {
        status: 403,
      });
    }
    throw error;
  }

  const searchParams = new URL(request.url).searchParams;
  const storeId = searchParams.get("storeId") ?? "";
  const presetId = searchParams.get("presetId") ?? "";
  if (!storeId || !presetId) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["storeId", "presetId"] },
      { status: 400 },
    );
  }

  // Manifesto ANTES de qualquer leitura com `storeId`.
  try {
    await assertBenchTestStore({ client: supabaseAdmin, storeId });
  } catch (error) {
    if (error instanceof BenchStoreManifestError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  let preset;
  try {
    preset = resolveBenchPreset(presetId);
  } catch (error) {
    if (error instanceof BenchPresetError) {
      return NextResponse.json(
        { error: "preset_not_enabled", reason: error.reason },
        { status: 400 },
      );
    }
    throw error;
  }

  const cost = resolveBenchCost({ preset });

  return NextResponse.json({
    presetId: preset.id,
    estimatedUsd: cost.estimatedCostUsd,
    coverage: cost.coverage,
    mode: cost.mode,
    isEstimate: cost.isEstimate,
    costSource: cost.costSource,
    costRuleVersion: cost.costRuleVersion,
  });
});
