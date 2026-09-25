import { NextResponse } from "next/server";

import { LabProgramUpdateRequestSchema } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { getProgramDetail } from "@/lib/lab/api/program-queries";
import {
  LabProgramError,
  authorizeProgramBudget,
  updateProgram,
} from "@/lib/lab/domain/program-service";
import { LabEnvironmentError, assertLabEnvironment, labEnvironmentDeniedBody } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.1 (D2/D10): detalhe e atualização do programa. O PUT registra a
// autorização de orçamento (`budgetUsd` → `budget_usd`/`budget_authorized_by`/
// `budget_authorized_at`/`status='authorized'`), a referência/hash do relatório
// final e a recomendação. Nenhuma promoção automática de variante; nenhuma
// chamada paga.

function programErrorStatus(code: string): number {
  if (code === "program_not_found") return 404;
  if (code === "program_not_authorized" || code === "budget_exceeded") return 409;
  return 500;
}

export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();

    try {
      assertLabEnvironment();
    } catch (error) {
      if (error instanceof LabEnvironmentError) {
        return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
      }
      throw error;
    }

    const { id } = await params;
    const detail = await getProgramDetail(supabaseAdmin, id);

    if (!detail) {
      return NextResponse.json({ error: "program_not_found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  },
);

export const PUT = apiHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();

    try {
      assertLabEnvironment();
    } catch (error) {
      if (error instanceof LabEnvironmentError) {
        return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
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

    const parsed = LabProgramUpdateRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      // A autorização de orçamento é um passo dedicado (grava autor/timestamp e
      // promove o status). Os demais campos são aplicados em seguida.
      if (parsed.data.budgetUsd != null) {
        await authorizeProgramBudget({
          programId: id,
          budgetUsd: parsed.data.budgetUsd,
          actorId: admin.userId,
          client: supabaseAdmin,
        });
      }

      await updateProgram(
        id,
        {
          status: parsed.data.status,
          finalReportRef: parsed.data.finalReportRef,
          finalReportHash: parsed.data.finalReportHash,
          recommendation: parsed.data.recommendation,
        },
        supabaseAdmin,
      );

      const detail = await getProgramDetail(supabaseAdmin, id);
      return NextResponse.json(detail, { status: 200 });
    } catch (error) {
      if (error instanceof LabProgramError) {
        return NextResponse.json({ error: error.code }, { status: programErrorStatus(error.code) });
      }
      throw error;
    }
  },
);
