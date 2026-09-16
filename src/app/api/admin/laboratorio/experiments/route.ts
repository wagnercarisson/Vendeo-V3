import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { listRecentExperiments } from "@/lib/lab/api/experiment-queries";
import {
  computeExperimentReadiness,
  createExperiment,
  transitionExperiment,
} from "@/lib/lab/domain/experiment-service";
import { ModelTargetNotInCatalogError } from "@/lib/lab/domain/model-target";
import {
  UnsupportedChangedDimensionError,
  parseCreateLabExperimentInput,
} from "@/lib/lab/domain/schemas";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D11/D5/D14): listagem e criação de experimentos prompt-only.
// A superfície oferece apenas criação e leitura — atualização/arquivamento não
// existem na F48.1 (alterar a configuração exige criar outro experimento).

export const GET = apiHandler(async () => {
  await requireAdmin();

  try {
    assertLabEnvironment();
  } catch (error) {
    if (error instanceof LabEnvironmentError) {
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    }
    throw error;
  }

  try {
    const experiments = await listRecentExperiments(supabaseAdmin);
    return NextResponse.json({ experiments });
  } catch {
    return NextResponse.json({ error: "Falha ao ler os experimentos" }, { status: 503 });
  }
});

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  try {
    assertLabEnvironment();
  } catch (error) {
    if (error instanceof LabEnvironmentError) {
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    }
    throw error;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  let input;
  try {
    input = parseCreateLabExperimentInput(raw);
  } catch (error) {
    if (error instanceof UnsupportedChangedDimensionError) {
      return NextResponse.json({ error: "unsupported_changed_dimension" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "invalid_payload", details: error instanceof Error ? error.message : "invalid" },
      { status: 400 },
    );
  }

  try {
    const { experimentId } = await createExperiment(input, {
      actorId: admin.userId,
      client: supabaseAdmin,
    });

    const readiness = await computeExperimentReadiness(experimentId, supabaseAdmin);
    let status: "draft" | "ready" = "draft";
    if (readiness.ready) {
      await transitionExperiment(experimentId, "ready", {
        actorId: admin.userId,
        client: supabaseAdmin,
      });
      status = "ready";
    }

    return NextResponse.json({ experimentId, status, readiness }, { status: 201 });
  } catch (error) {
    if (error instanceof ModelTargetNotInCatalogError) {
      return NextResponse.json({ error: "model_target_not_in_catalog" }, { status: 400 });
    }
    throw error;
  }
});
