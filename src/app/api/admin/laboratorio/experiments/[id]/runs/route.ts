import { NextResponse } from "next/server";

import { LabRunExecuteRequestSchema } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  prepareExperimentRun,
  runPreparedExperimentRun,
} from "@/lib/lab/api/run-execution";
import { LabEnvironmentError, assertLabEnvironment, labEnvironmentDeniedBody } from "@/lib/lab/environment-guard";
import type { LabRunEvent } from "@/lib/lab/run-service";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D11/D14/T-48-1-60/61): execução de **um** run por ação explícita.
// Ordem obrigatória: admin → guarda de ambiente → confirmação explícita →
// validação do payload → **reserva atômica** (antes de qualquer chamada paga) →
// stream NDJSON. Sem loops automáticos: não existe "executar tudo".

/** Recusas de estado/concorrência/budget — a ação não pode ser aceita agora. */
const CONFLICT_CODES: readonly string[] = [
  "budget_exceeded",
  "run_already_active",
  "idempotency_conflict",
  "experiment_not_ready",
  // Integridade experimental: a fixture no disco divergiu da versão registrada.
  "scenario_hash_mismatch",
];

/** Recusas de payload/relações — a requisição é inválida para o experimento. */
const BAD_REQUEST_CODES: readonly string[] = [
  "missing_snapshot",
  "missing_operation_id",
  "variant_not_in_experiment",
  "scenario_not_in_experiment",
  "repetition_out_of_range",
  "invalid_supersedes_run",
  "unsupported_scenario_mode",
];

/** Código determinístico de um erro de preparação/reserva, ou `null`. */
function resolveErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  if (error instanceof Error) {
    const message = error.message;
    if (
      CONFLICT_CODES.includes(message) ||
      BAD_REQUEST_CODES.includes(message) ||
      message === "experiment_not_found" ||
      message === "lab_reservation_failed"
    ) {
      return message;
    }
  }
  return null;
}

export const POST = apiHandler(
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

    let raw: unknown = null;
    try {
      raw = await request.json();
    } catch {
      raw = null;
    }

    // Confirmação explícita **antes** do parse completo: sem ela nenhuma chamada
    // paga é iniciada e a resposta é 422.
    if (
      raw === null ||
      typeof raw !== "object" ||
      (raw as Record<string, unknown>).confirmed !== true
    ) {
      return NextResponse.json({ error: "confirmation_required" }, { status: 422 });
    }

    const parsed = LabRunExecuteRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    let prepared;
    try {
      prepared = await prepareExperimentRun({
        client: supabaseAdmin,
        experimentId: id,
        actorId: admin.userId,
        input: parsed.data,
      });
    } catch (error) {
      const code = resolveErrorCode(error);
      if (code && CONFLICT_CODES.includes(code)) {
        return NextResponse.json({ error: code }, { status: 409 });
      }
      if (code && BAD_REQUEST_CODES.includes(code)) {
        return NextResponse.json({ error: code }, { status: 400 });
      }
      if (code === "experiment_not_found") {
        return NextResponse.json({ error: code }, { status: 404 });
      }
      if (code === "lab_reservation_failed") {
        return NextResponse.json({ error: code }, { status: 500 });
      }
      throw error;
    }

    // Operação idempotente: o run existente é devolvido sem stream e sem nova
    // chamada paga.
    if (prepared.idempotent) {
      return NextResponse.json(
        { idempotent: true, runId: prepared.runId },
        { status: 200 },
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: LabRunEvent): void => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            // Stream fechado pelo cliente: a execução continua dona do run.
          }
        };

        try {
          // O serviço de execução é o **único dono dos eventos terminais**
          // (`done`/`error`): a rota apenas encaminha o progresso e não emite um
          // segundo terminal. O `catch` abaixo cobre somente falhas de setup
          // anteriores ao serviço (o run nem chegou a ser executado).
          await runPreparedExperimentRun({
            client: supabaseAdmin,
            experimentId: id,
            runId: prepared.runId,
            snapshot: prepared.snapshot,
            actorId: admin.userId,
            executionContext: prepared.executionContext,
            onEvent: emit,
          });
        } catch {
          // A mensagem já é sanitizada na origem; o stream não vaza token nem URL.
          emit({ type: "error", code: "run_failed", message: "Execução falhou" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  },
);
