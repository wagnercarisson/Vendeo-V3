import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAdmin } from "@/lib/admin/require-admin";
import { ProductTwoFormatPendingResolutionSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { getCampaign } from "@/lib/campaign/persistence";
import { createJointAdminDeps } from "@/lib/product-two-format/admin/joint-admin-deps";
import { classifyTwoFormatCampaign } from "@/lib/product-two-format/contracts";
import {
  resolveJointPending,
  type JointResolutionOutcome,
} from "@/lib/product-two-format/orchestration/resolve-joint-pending";

/**
 * F60.7 C4 — resolução administrativa CONJUNTA por formato.
 *
 * Rota DEDICADA: não altera o schema/rota legados de 1:1 e nunca cai em
 * `resolvePendingOperation`. O corpo é estrito; ator vem de `requireAdmin` e o
 * efeito é executado exclusivamente por `resolveJointPending`.
 */

export const runtime = "nodejs";

function invalidBody(error: ZodError): Response {
  return NextResponse.json(
    {
      error: {
        code: "invalid_body",
        message: "Dados inválidos",
        details: error.errors,
      },
    },
    { status: 400 },
  );
}

function outcomeResponse(outcome: JointResolutionOutcome): Response {
  switch (outcome.kind) {
    case "resolved":
    case "reconciled":
      return NextResponse.json({ resolution: outcome }, { status: 200 });
    case "invalid_request":
      return NextResponse.json(
        { error: { code: outcome.reason, message: "Requisição inválida." } },
        { status: 400 },
      );
    case "blocked":
      return NextResponse.json(
        { error: { code: outcome.block, message: "Resolução bloqueada." } },
        { status: 409 },
      );
    case "publication_pending":
      return NextResponse.json(
        {
          error: {
            code: "publication_pending",
            message: "Publicação em andamento.",
          },
        },
        { status: 409 },
      );
    case "audit_conflict":
      return NextResponse.json(
        {
          error: {
            code: "audit_conflict",
            message: "Auditoria divergente para esta operação.",
          },
        },
        { status: 409 },
      );
    case "audit_pending":
    case "audit_unavailable":
      return NextResponse.json(
        { error: { code: outcome.code, message: "Auditoria indisponível." } },
        { status: 503 },
      );
    case "unavailable":
      return NextResponse.json(
        { error: { code: outcome.reason, message: "Resolução indisponível." } },
        { status: 503 },
      );
    case "failed":
      return NextResponse.json(
        {
          error: {
            code: outcome.code,
            message: "Falha técnica ao resolver. Tente novamente.",
          },
        },
        { status: 502 },
      );
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

export const POST = apiHandler(async (request: NextRequest) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  let body;
  try {
    body = ProductTwoFormatPendingResolutionSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return invalidBody(error);
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Corpo da requisição inválido" } },
      { status: 400 },
    );
  }

  const campaign = await getCampaign(body.campaignId);
  if (!campaign) {
    return NextResponse.json(
      { error: { code: "campaign_not_found", message: "Campanha não encontrada." } },
      { status: 404 },
    );
  }

  const classification = classifyTwoFormatCampaign(campaign.input_snapshot);
  if (classification.kind === "inconsistent") {
    return NextResponse.json(
      {
        error: {
          code: "joint_contract_inconsistent",
          message: "Contrato conjunto inconsistente.",
        },
      },
      { status: 409 },
    );
  }
  if (classification.kind !== "two_format") {
    return NextResponse.json(
      {
        error: {
          code: "not_two_format",
          message: "Campanha não pertence ao fluxo conjunto.",
        },
      },
      { status: 409 },
    );
  }

  let outcome: JointResolutionOutcome;
  try {
    outcome = await resolveJointPending(
      {
        actorId: admin.userId,
        campaignId: body.campaignId,
        operationId: body.operationId,
        format: body.format,
        action: body.action,
        reason: body.reason,
      },
      createJointAdminDeps(),
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "resolution_unavailable",
          message: "Falha técnica ao resolver. Tente novamente.",
        },
      },
      { status: 502 },
    );
  }
  return outcomeResponse(outcome);
});
