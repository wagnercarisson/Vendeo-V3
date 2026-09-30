import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  BenchStoreManifestError,
  assertBenchTestStore,
} from "@/lib/lab/bench/domain/store-manifest";
import {
  BenchDuplicateError,
  duplicateBenchRunInputs,
} from "@/lib/lab/bench/persistence/duplicate-bench-run-inputs";
import {
  BenchRunError,
  getBenchRun,
  reserveBenchRun,
} from "@/lib/lab/bench/persistence/bench-run-service";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.4 (D12/D13/D15; spec lab-admin-api / lab-bench-run-history): **nova
// tentativa** a partir de um run anterior.
//
// Cria um **novo run `draft`** (novo `operationId`) com linhagem explícita
// (`attempt_of_run_id`) e **copia** as entradas do run de origem para o prefixo do
// novo run (`duplicateBenchRunInputs`), devolvendo `runId` + `references` + os
// dados da campanha/branding para prefill. O run anterior permanece **imutável**.
//
// Ordem obrigatória: admin → guarda de ambiente → leitura do run de origem →
// `assertBenchTestStore` com o `storeId` do run ANTES de qualquer leitura com
// `storeId` → estado terminal → reserva `draft` → cópia das entradas. **Nenhuma
// chamada paga ocorre aqui** e nenhum secret/URL assinada é exposto.
//
// Máquina de estados (idempotência por `operationId`, em `duplicateBenchRunInputs`):
// draft **completo** ⇒ devolvido sem nova cópia; draft **incompleto** ⇒ 409
// `attempt_preparing`; `operationId` anterior já `failed` ⇒ exige **novo**
// `operationId`; falha parcial compensa apenas os artefatos daquela tentativa.

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Estados terminais do run de origem (o histórico é imutável a partir deles). */
const TERMINAL_SOURCE_STATUSES = new Set<string>([
  "succeeded",
  "failed",
  "cancelled",
  "timeout",
]);

/**
 * `storeId` real derivado do branding snapshot do run de origem (o
 * `campaign_snapshot` usa um `storeId` sintético). `null` quando ausente.
 */
function storeIdFromBrandingSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const candidate = (snapshot as { storeId?: unknown }).storeId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
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
    const operationId =
      raw && typeof raw === "object"
        ? (raw as Record<string, unknown>).operationId
        : undefined;
    if (typeof operationId !== "string" || !UUID_REGEX.test(operationId)) {
      return NextResponse.json(
        { error: "invalid_payload", details: ["operationId"] },
        { status: 400 },
      );
    }

    // Run de origem — 404 quando ausente.
    const source = await getBenchRun({ client: supabaseAdmin, runId: id });
    if (!source) {
      return NextResponse.json({ error: "run_not_found" }, { status: 404 });
    }

    // Manifesto ANTES de qualquer leitura com `storeId` (derivado do branding
    // snapshot do run de origem).
    const storeId = storeIdFromBrandingSnapshot(source.brandingSnapshot);
    if (storeId) {
      try {
        await assertBenchTestStore({ client: supabaseAdmin, storeId });
      } catch (error) {
        if (error instanceof BenchStoreManifestError) {
          return NextResponse.json({ error: error.code }, { status: 400 });
        }
        throw error;
      }
    }

    // A tentativa só parte de um run **terminal** (histórico imutável).
    if (!TERMINAL_SOURCE_STATUSES.has(source.status)) {
      return NextResponse.json(
        { error: "attempt_source_not_terminal" },
        { status: 409 },
      );
    }

    // Novo `draft` (idempotente por `operationId`) com linhagem explícita.
    let reserved: { runId: string; idempotent: boolean };
    try {
      reserved = await reserveBenchRun({
        client: supabaseAdmin,
        operationId,
        createdBy: admin.userId,
        attemptOfRunId: id,
      });
    } catch (error) {
      if (error instanceof BenchRunError) {
        if (error.code === "missing_operation_id") {
          return NextResponse.json(
            { error: "invalid_payload", details: ["operationId"] },
            { status: 400 },
          );
        }
        if (error.code === "idempotency_conflict") {
          return NextResponse.json(
            { error: "idempotency_conflict" },
            { status: 409 },
          );
        }
      }
      throw error;
    }

    // Cópia segura das entradas (download + persist) com máquina de estados por
    // `operationId` e compensação de falha parcial.
    let duplicated;
    try {
      duplicated = await duplicateBenchRunInputs({
        client: supabaseAdmin,
        fromRunId: id,
        toRunId: reserved.runId,
        attemptOperationId: operationId,
      });
    } catch (error) {
      if (error instanceof BenchDuplicateError) {
        if (error.code === "bench_source_run_not_found") {
          return NextResponse.json({ error: "run_not_found" }, { status: 404 });
        }
        if (error.code === "bench_source_not_terminal") {
          return NextResponse.json(
            { error: "attempt_source_not_terminal" },
            { status: 409 },
          );
        }
        if (error.code === "attempt_preparing") {
          return NextResponse.json({ error: "attempt_preparing" }, { status: 409 });
        }
        if (error.code === "attempt_retry_requires_new_operation_id") {
          return NextResponse.json(
            { error: "attempt_requires_new_operation_id" },
            { status: 409 },
          );
        }
        if (error.code === "attempt_duplicate_failed") {
          return NextResponse.json(
            { error: "attempt_duplicate_failed" },
            { status: 400 },
          );
        }
      }
      throw error;
    }

    // Prefill: dados da campanha/branding do run de origem (o novo run ainda não
    // possui `campaign_snapshot`). Nenhum secret é exposto.
    return NextResponse.json(
      {
        runId: duplicated.runId,
        references: duplicated.references,
        campaignSnapshot: source.campaignSnapshot,
        brandingSnapshot: source.brandingSnapshot,
      },
      { status: 201 },
    );
  },
);
