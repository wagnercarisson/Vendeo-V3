import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  BENCH_REGISTRY_DIMENSIONS,
  DEFAULT_BENCH_CONFIG,
  listBenchConfigOptions,
} from "@/lib/lab/bench/domain/config-registry";
import { listBenchPresets } from "@/lib/lab/bench/domain/preset-registry";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";

// F48.2.2 (D6/D7/T-48-2-2-31): presets habilitados e desabilitados com motivo,
// além das dimensões do registry em código. Módulo puro — nenhum storage/provider
// é tocado e nenhuma chamada paga ocorre.

export const GET = apiHandler(async () => {
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

  const presets = listBenchPresets().map((preset) => ({
    id: preset.id,
    label: preset.label,
    capability: preset.capability,
    provider: preset.provider,
    model: preset.model,
    protocol: preset.protocol,
    quality: preset.quality,
    size: preset.size,
    enabled: preset.enabled,
    ...(preset.reason ? { reason: preset.reason } : {}),
  }));

  const dimensions = Object.fromEntries(
    BENCH_REGISTRY_DIMENSIONS.map((dimension) => [
      dimension,
      listBenchConfigOptions(dimension).map((entry) => ({
        id: entry.id,
        label: entry.label,
        enabled: entry.enabled,
        ...(entry.reason ? { reason: entry.reason } : {}),
      })),
    ]),
  );

  return NextResponse.json({
    presets,
    config: { dimensions, defaults: DEFAULT_BENCH_CONFIG },
  });
});
