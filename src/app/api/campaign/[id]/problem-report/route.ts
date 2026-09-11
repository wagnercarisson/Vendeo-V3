import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { apiHandler } from "@/lib/auth/api-handler";
import { notFound } from "@/lib/api-error-response";
import { getCampaign } from "@/lib/campaign/persistence";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CorrectionIntentService } from "@/lib/campaign/correction-intent-service";
import {
  completeCorrectionAnalysis,
  generateCorrectionV2,
} from "@/lib/campaign/correction-reports";

export const dynamic = "force-dynamic";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// F37.2 (R1/R2): body estrito — apenas `text`. strict() impede campos extras.
const ProblemReportBodySchema = z
  .object({
    text: z.string(),
  })
  .strict();

// Texto vazio ou somente pontuação/símbolos/espaços → 400 (sem caso, sem IA).
const PUNCTUATION_ONLY_REGEX = /^[\s\p{P}\p{S}]*$/u;

// F37.2 (fix UAT): erros de fluxo legíveis para o lojista. A API devolve
// `{ code, message }` — o código técnico fica no cliente e a `message` em PT-BR
// é o que o modal apresenta (nunca exibir `rate_limit_exceeded` etc.).
const BEGIN_ERROR_MESSAGES: Record<string, string> = {
  rate_limit_exceeded:
    "Você atingiu o limite de análises deste relato. Aguarde alguns minutos para tentar novamente.",
  analysis_in_progress: "Seu relato anterior ainda está sendo analisado.",
  already_consumed: "A correção incluída nesta campanha já foi utilizada.",
  campaign_not_pending:
    "Esta arte não está mais disponível para correção. Atualize a página.",
  no_active_candidate:
    "Esta arte não está mais disponível para correção. Atualize a página.",
  correction_in_progress: "A correção da arte já está em andamento.",
};

const ANALYSIS_ERROR_MESSAGES: Record<string, string> = {
  submission_not_analyzing:
    "A análise deste relato já foi concluída. Atualize a página.",
  analysis_lease_expired: "A análise demorou demais. Envie o relato novamente.",
  submission_stale: "Há uma análise mais recente em andamento.",
};

const GENERIC_SEND_ERROR = "Não foi possível enviar o relato. Tente novamente.";
const GENERIC_ANALYSIS_ERROR =
  "Não foi possível concluir a análise. Tente novamente.";

function matchErrorCode(
  message: string,
  mapping: Record<string, string>
): { code: string; message: string } | null {
  for (const code of Object.keys(mapping)) {
    if (message.includes(code)) {
      return { code, message: mapping[code] };
    }
  }
  return null;
}

// F37.2 (R1/R2/R3): rota do fluxo corretivo. Ordem: CSRF → auth → UUID →
// getCampaign → ownership → flag → status ready → body zod strict → 400 vazio/
// pontuação → begin RPC (caso + tentativa `analyzing` ANTES da IA) → análise
// textual → conclusão via RPC → 200 JSON (blocked/unclear/analysis_failed) ou
// NDJSON stream (eligible → geração da v2 delegada ao orquestrador
// `generateCorrectionV2`, dono único do consumo/upload/complete/fail).
// Fases do stream NDJSON: input_validation (skipped) → image_generation → done/error.
// Sem reserva de crédito; eventos (análise + v2) sob o mesmo operation_run_id.
export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    requireSameOrigin(request);

    const user = await requireApiUser();

    const { id } = await params;
    if (!UUID_V4_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    const campaign = await getCampaign(id);
    if (!campaign) {
      return notFound("Campaign not found");
    }

    await requireOwnership(campaign.store_id, user.userId);

    if (!(await isCampaignApprovalEnabled())) {
      return NextResponse.json(
        { code: "approval_disabled", message: "O fluxo de revisão está desativado." },
        { status: 403 }
      );
    }

    if (campaign.status !== "ready") {
      return NextResponse.json(
        {
          code: "campaign_not_ready",
          message: "Esta campanha ainda não está pronta para revisão.",
        },
        { status: 409 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: "invalid_body", message: "Dados inválidos." },
        { status: 400 }
      );
    }

    const parsed = ProblemReportBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_body", message: "Dados inválidos." },
        { status: 400 }
      );
    }

    const text = parsed.data.text.trim();
    if (text.length === 0 || PUNCTUATION_ONLY_REGEX.test(text)) {
      return NextResponse.json(
        { code: "empty_report", message: "Descreva o problema na arte." },
        { status: 400 }
      );
    }

    // ── begin: cria caso + tentativa `analyzing` na MESMA transação (antes da IA) ──
    const { data: beginData, error: beginError } = await supabaseAdmin.rpc(
      "begin_campaign_correction_submission",
      { p_campaign_id: id, p_text: text }
    );

    if (beginError) {
      const msg = beginError.message ?? "";
      const mapped = matchErrorCode(msg, BEGIN_ERROR_MESSAGES);
      if (mapped) {
        return NextResponse.json(mapped, { status: 409 });
      }
      console.error("[problem-report] begin failed:", msg);
      return NextResponse.json(
        { code: "internal_error", message: GENERIC_SEND_ERROR },
        { status: 500 }
      );
    }

    const reportId = (beginData as { report_id: string }).report_id;
    const submissionId = (beginData as { submission_id: string }).submission_id;
    const attemptNumber = (beginData as { attempt_number: number }).attempt_number;

    // ── análise textual (NÃO lê a imagem; tolera erros de escrita) ──
    const intentService = new CorrectionIntentService();
    const analysis = await intentService.analyzeReport(text, {
      operationRunId: campaign.operation_run_id ?? crypto.randomUUID(),
      campaignId: id,
      storeId: campaign.store_id,
      userId: user.userId,
      attemptNumber,
    });

    // ── conclusão via RPC complete_campaign_correction_analysis (analyzing +
    // lease + submissão mais recente), pelo helper completeCorrectionAnalysis ──
    try {
      await completeCorrectionAnalysis({
        reportId,
        submissionId,
        attemptNumber,
        analysisState: analysis.analysisState,
        category: analysis.category,
        normalizedInstruction: analysis.normalizedInstruction,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const mapped = matchErrorCode(msg, ANALYSIS_ERROR_MESSAGES);
      if (mapped) {
        return NextResponse.json(mapped, { status: 409 });
      }
      console.error("[problem-report] complete analysis failed:", msg);
      return NextResponse.json(
        { code: "internal_error", message: GENERIC_ANALYSIS_ERROR },
        { status: 500 }
      );
    }

    // ── blocked/unclear/analysis_failed: 200 com orientação (sem gerar/consumir) ──
    if (analysis.analysisState !== "eligible") {
      return NextResponse.json(
        { analysisState: analysis.analysisState, guidance: analysis.guidance },
        { status: 200 }
      );
    }

    // ── eligible: NDJSON stream — geração da v2 delegada ao orquestrador ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            // stream closed by client
          }
        };

        try {
          const result = await generateCorrectionV2({
            campaignId: id,
            reportId,
            submissionId,
            userId: user.userId,
            onPhaseChange: (phaseEvent) => emit({ type: "phase", ...phaseEvent }),
          });

          if (result.success) {
            emit({
              type: "result",
              campaignId: id,
              campaignUrl: `/campanhas/${id}`,
            });
          } else {
            emit({
              type: "error",
              campaignId: id,
              phase: result.preProvider ? "pre_provider" : "generation",
              code: result.code,
              message: result.message,
              retryable: false,
            });
          }
        } catch (err) {
          emit({
            type: "error",
            campaignId: id,
            phase: "generation",
            code: "generation_failed",
            message: err instanceof Error ? err.message : String(err),
            retryable: false,
          });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }
);
