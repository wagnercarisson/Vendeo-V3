import { NextResponse } from "next/server";

import { LabProgramCreateRequestSchema } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { listPrograms } from "@/lib/lab/api/program-queries";
import { LabProgramError, authorizeProgramBudget, createProgram } from "@/lib/lab/domain/program-service";
import { LabEnvironmentError, assertLabEnvironment, labEnvironmentDeniedBody } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.1 (D2/D9/D10): programas de otimização — criação (matriz) e listagem.
// A autorização de orçamento é um passo explícito: quando `budgetUsd` vem no
// corpo da criação, ela é registrada na sequência (mesmo caminho do PUT). Nenhuma
// chamada paga nesta superfície.

function programErrorStatus(code: string): number {
  if (code === "program_not_found") return 404;
  if (code === "program_not_authorized" || code === "budget_exceeded") return 409;
  return 500;
}

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
    const programs = await listPrograms(supabaseAdmin);
    return NextResponse.json({ programs });
  } catch {
    return NextResponse.json({ error: "Falha ao ler os programas" }, { status: 503 });
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

  const parsed = LabProgramCreateRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { programId } = await createProgram(
      { matrixVersion: parsed.data.matrixVersion },
      { actorId: admin.userId, client: supabaseAdmin },
    );

    if (parsed.data.budgetUsd != null) {
      await authorizeProgramBudget({
        programId,
        budgetUsd: parsed.data.budgetUsd,
        actorId: admin.userId,
        client: supabaseAdmin,
      });
    }

    return NextResponse.json({ programId }, { status: 201 });
  } catch (error) {
    if (error instanceof LabProgramError) {
      return NextResponse.json({ error: error.code }, { status: programErrorStatus(error.code) });
    }
    throw error;
  }
});
