import { NextResponse } from "next/server";

import { LabEvaluationRequestSchema } from "@/lib/admin/schemas";
import * as adminGuard from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  InvalidComparisonRunsError,
  createEvaluation,
} from "@/lib/lab/api/evaluation-service";
import * as labEnvironment from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D11/D13/T-48-1-62): registro da avaliação humana com os **runs
// efetivamente comparados**. O serviço valida mesmo experimento, mesma versão de
// cenário, estado terminal e papéis baseline/candidate; a tabela é append-only.

export const POST = apiHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await adminGuard.requireAdmin();

    try {
      labEnvironment.assertLabEnvironment();
    } catch (error) {
      if (error instanceof labEnvironment.LabEnvironmentError) {
        return NextResponse.json(labEnvironment.labEnvironmentDeniedBody(error.reason), {
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

    const parsed = LabEvaluationRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const evaluation = await createEvaluation({
        client: supabaseAdmin,
        experimentId: id,
        evaluatorId: admin.userId,
        input: parsed.data,
      });
      return NextResponse.json(evaluation, { status: 201 });
    } catch (error) {
      if (error instanceof InvalidComparisonRunsError) {
        return NextResponse.json({ error: error.code }, { status: 400 });
      }
      throw error;
    }
  },
);
