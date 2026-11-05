import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { ProductOneToOnePendingResolutionSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createPendingFormatAdapter } from "@/lib/product-vertical-9-16/recovery/pending-adapter";
import { SupabasePendingOperationsRepository } from "@/lib/product-1-1/pending/pending-operations-repository";
import {
  listPendingOperations,
  PendingOperationResolutionError,
  resolvePendingOperation,
  resolutionErrorStatus,
} from "@/lib/product-1-1/pending/resolve-pending-operation";

/**
 * F56.2b1b (Plano 07, B1B-D5 / REQ-56.2.2-08) — superfície administrativa das
 * pendências do Produto 1:1.
 *
 * - `GET`: protegido por `requireAdmin`, devolve a lista SOMENTE-LEITURA das
 *   pendências (estado persistido + evidência de arte derivada server-side). A
 *   "fila de atendimento" é apenas uma lista — NUNCA re-enfileira, gera
 *   novamente ou chama o provider.
 * - `POST`: protegido por `requireAdmin` + `requireSameOrigin` (CSRF), valida o
 *   corpo com Zod `.strict()` (a EVIDÊNCIA não pode vir do cliente — é derivada
 *   server-side, F5) e resolve pela RPC auditada `admin_resolve_product_1_1_pending`
 *   (via serviço `resolvePendingOperation`). NUNCA muta pela query builder.
 *
 * O gate de evidência é fail-closed no cliente E no servidor: a RPC recusa
 * evidência insuficiente e o serviço recusa antes de invocá-la.
 */

export const runtime = "nodejs";

function invalidBody(error: ZodError): Response {
  return NextResponse.json(
    { error: { code: "invalid_body", message: "Dados inválidos", details: error.errors } },
    { status: 400 },
  );
}

function resolutionError(error: unknown): Response {
  const status = resolutionErrorStatus(error);
  const code =
    error instanceof PendingOperationResolutionError ? error.code : "unknown_error";
  const message =
    status === 500
      ? "Não foi possível registrar a resolução. Confira o motivo e as evidências; tente novamente."
      : code;
  return NextResponse.json({ error: { code, message } }, { status });
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  try {
    const adapter = createPendingFormatAdapter();
    const repository = new SupabasePendingOperationsRepository(
      supabaseAdmin,
      undefined,
      {
        resolveFormat: adapter.resolveFormat,
        verticalArtifacts: adapter.verticalArtifacts,
      },
    );
    const operations = await listPendingOperations({ repository });
    return NextResponse.json({ operations });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "pending_list_failed",
          message: "Não foi possível carregar as pendências. Recarregue a página.",
        },
      },
      { status: 500 },
    );
  }
});

export const POST = apiHandler(async (request: NextRequest) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  let body;
  try {
    body = ProductOneToOnePendingResolutionSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return invalidBody(error);
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Corpo da requisição inválido" } },
      { status: 400 },
    );
  }

  try {
    const adapter = createPendingFormatAdapter();
    const format = await adapter.resolveFormat(body.campaignId);
    if (format.kind === "unavailable") {
      return NextResponse.json(
        { error: { code: "format_unavailable", message: "Formato da campanha indisponível." } },
        { status: 503 },
      );
    }
    const repository = new SupabasePendingOperationsRepository(
      supabaseAdmin,
      undefined,
      {
        resolveFormat: adapter.resolveFormat,
        verticalArtifacts: adapter.verticalArtifacts,
      },
    );
    let projection: ReturnType<typeof adapter.projectionFor> | undefined;
    if (format.kind === "9:16") {
      const state = await repository.findPendingOperation(
        body.campaignId,
        body.operationId,
      );
      if (state) {
        projection = adapter.projectionFor(
          state.storeId,
          body.campaignId,
          body.operationId,
        );
      }
    }

    const resolution = await resolvePendingOperation(
      {
        actorId: admin.userId,
        campaignId: body.campaignId,
        operationId: body.operationId,
        action: body.action,
        reason: body.reason,
        resolutionOperationId: body.resolutionOperationId,
        // C1 (B2B-D4) — caminho AUTORIZADO/auditado: o operador admin autenticado
        // (após `requireAdmin` + `requireSameOrigin`) AUTORIZA explicitamente o
        // abandono do claim `in_progress` residual. Este é o ÚNICO invocador que
        // fornece o sinal; qualquer outro omite-o (default `false`).
        authorizeAbandon: true,
        // Recorte 1 — exceção RESTRITA ao inconclusivo: o operador admin autoriza
        // encerrar `in_flight`/`result_unknown` (nunca `published`; não desabilita o
        // frescor). Marcado na evidência e auditado.
        authorizePublicationClosure: true,
      },
      {
        repository,
        ...(projection ? { projectDeliveredCampaign: projection } : {}),
      },
    );
    return NextResponse.json({ resolution });
  } catch (error) {
    return resolutionError(error);
  }
});
