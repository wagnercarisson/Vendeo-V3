import { NextResponse } from "next/server";

import { LabExperimentArchiveRequestSchema } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { getExperimentDetail } from "@/lib/lab/api/experiment-queries";
import { archiveExperiment } from "@/lib/lab/domain/experiment-service";
import { LabEnvironmentError, assertLabEnvironment, labEnvironmentDeniedBody } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D11/D2): detalhe do experimento — variantes, cenários vinculados, runs,
// avaliações e budget restante. Leitura pura: o único efeito é a reconciliação
// preguiçosa de runs órfãos, feita dentro da camada de leitura.
//
// F48.2.1 (C7): o PATCH expõe o arquivamento administrativo seguro — transição
// terminal `archived` (histórico preservado) validada pela máquina de estados.

export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
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

    const { id } = await params;
    const detail = await getExperimentDetail(supabaseAdmin, id);

    if (!detail) {
      return NextResponse.json({ error: "experiment_not_found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  },
);

export const PATCH = apiHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();

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

    const { id } = await params;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const parsed = LabExperimentArchiveRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    try {
      await archiveExperiment(id, { actorId: admin.userId, client: supabaseAdmin });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("experiment_not_found")) {
        return NextResponse.json({ error: "experiment_not_found" }, { status: 404 });
      }
      // `archived` é terminal: qualquer transição a partir dele é recusada (409).
      if (error instanceof Error && error.message.startsWith("invalid_transition")) {
        return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
      }
      throw error;
    }

    const detail = await getExperimentDetail(supabaseAdmin, id);
    if (!detail) {
      return NextResponse.json({ error: "experiment_not_found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  },
);
