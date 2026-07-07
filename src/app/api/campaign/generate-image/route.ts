import { NextRequest } from "next/server";
import { GenerateImageRequestSchema } from "@/lib/image-generation/schema";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS, MAX_PRODUCT_IMAGE_BASE64_SIZE } from "@/lib/image-generation/config";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import { InputValidationService } from "@/lib/image-generation/services/input-validation-service";
import { createImageProvider } from "@/lib/image-generation/providers/factory";
import { resolveStoreIdentity, validateIdentityReference, buildCampaignBrief } from "@/lib/store-identity-service";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { supabaseAdmin } from '@/lib/supabase/server';
import type { CampaignInput } from "@/components/campaign/types";

export async function POST(request: NextRequest) {
  requireSameOrigin(request);
  // ── Pre-stream: Parse JSON body ──────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Corpo da requisição inválido" } },
      { status: 400 }
    );
  }

  // ── Pre-stream: Check for legacy identity fields (BREAKING) ─────
  const LEGACY_FIELDS = ['storeName', 'storeLogoUrl', 'brandProfile', 'storeSegment', 'storeTone', 'brandColor'];
  const hasLegacyFields = LEGACY_FIELDS.some(f => f in body);
  if (hasLegacyFields) {
    return Response.json(
      { error: { message: "Campos de identidade da loja não são mais aceitos como entrada do cliente. Use storeId para resolução no backend." } },
      { status: 400 }
    );
  }

  // ── Pre-stream: Log received fields (safe, no base64 data) ───────
  const safeLog = {
    keys: Object.keys(body),
    storeId: (body as any).storeId ?? null,
    hasProductName: typeof body.productName === 'string' && body.productName.length > 0,
    hasProductImage: typeof body.productImageDataUrl === 'string' && body.productImageDataUrl.length > 0,
    productImageLength: typeof body.productImageDataUrl === 'string' ? body.productImageDataUrl.length : 0,
    hasPrice: typeof body.discountedPriceCents === 'number',
  };
  console.log(`[generate-image] payload_received`, JSON.stringify(safeLog));

  // ── Pre-stream: Validate productImageDataUrl presence ───────────
  if (!body.productImageDataUrl || typeof body.productImageDataUrl !== "string") {
    return Response.json(
      { error: { message: "Imagem do produto é obrigatória para gerar a campanha visual." } },
      { status: 400 }
    );
  }

  // ── Pre-stream: Check payload size limit ────────────────────────
  if (body.productImageDataUrl.length > MAX_PRODUCT_IMAGE_BASE64_SIZE) {
    return Response.json(
      {
        error: {
          message: `Imagem do produto excede o limite de ${Math.round(MAX_PRODUCT_IMAGE_BASE64_SIZE / (1024 * 1024))}MB. Comprima a imagem e tente novamente.`,
        },
      },
      { status: 413 }
    );
  }

  // ── Pre-stream: Validate full request schema ─────────────────────
  const parsed = GenerateImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => ({
      path: i.path.join('.'),
      code: i.code,
      message: i.message,
    }));
    console.log(`[generate-image] validation_fail — Zod safeParse rejeitou`, { issues });
    return Response.json(
      {
        error: {
          message: "Dados de entrada inválidos para geração de imagem",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  // ── Auth & Ownership: requireSameOrigin já executou acima ─────────
  const user = await requireApiUser();
  await requireOwnership(parsed.data.storeId, user.userId);

  // ── Pre-stream: Resolve store identity (backend-side) ────────────
  const { storeId, ...campaignInput } = parsed.data;

  let storeSnapshot;
  try {
    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, name, logo_url, segment, brand_color, subsegment, tone_of_voice, positioning, short_description, slogan, identity_state")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      console.error(`[generate-image] store not found — ${storeId}`);
      return Response.json(
        { error: { message: "Loja não encontrada." } },
        { status: 404 }
      );
    }

    storeSnapshot = await resolveStoreIdentity(store);
  } catch (err) {
    console.error(`[generate-image] resolveStoreIdentity error — ${err instanceof Error ? err.message : String(err)}`);
    return Response.json(
      { error: { message: "Erro ao resolver identidade da loja." } },
      { status: 500 }
    );
  }

  // Validate identity reference before building brief
  const validatedSnapshot = await validateIdentityReference(storeSnapshot);

  // Build campaign brief
  const brief = await buildCampaignBrief(validatedSnapshot, campaignInput as CampaignInput);

  // ── Pre-stream: Input validation for conflict/confidence ─────────
  if (!parsed.data.inputValidationOverride?.productImageCheck) {
    const inputValidation = new InputValidationService();
    let validationResult: Awaited<ReturnType<typeof inputValidation.validate>>;
    try {
      validationResult = await inputValidation.validate(
        parsed.data.productName,
        parsed.data.productImageDataUrl,
        undefined
      );
    } catch {
      console.error("[generate-image] validation_parse_error — validação quebrou com exceção não tratada");
      return Response.json(
        {
          status: "needs_user_action",
          reason: "product_image_low_confidence",
          message: "Não foi possível confirmar se o nome do produto corresponde à imagem.",
        },
        { status: 409 }
      );
    }

    if (validationResult.classification === "conflict") {
      return Response.json(
        {
          status: "needs_user_action",
          reason: "product_image_conflict",
          message: "O nome do produto digitado não corresponde à imagem enviada.",
          suggestedProductName: validationResult.suggestedProductName,
        },
        { status: 409 }
      );
    }

    if (validationResult.classification === "strong_conflict") {
      return Response.json(
        {
          status: "needs_user_action",
          reason: "product_image_strong_conflict",
          message: "A imagem enviada parece ser de outro produto. Para evitar uma campanha incorreta e consumo desnecessário de geração, corrija o nome do produto ou troque a imagem.",
          suggestedProductName: validationResult.suggestedProductName,
        },
        { status: 409 }
      );
    }

    if (validationResult.classification === "low-confidence") {
      return Response.json(
        {
          status: "needs_user_action",
          reason: "product_image_low_confidence",
          message: "Não foi possível confirmar se o nome do produto corresponde à imagem.",
        },
        { status: 409 }
      );
    }
  }

  // ── Stream: Open NDJSON stream ──────────────────────────────────
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), IMAGE_GENERATION_GLOBAL_TIMEOUT_MS);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const provider = createImageProvider();
      const service = new ImageGenerationService(provider);

      const emit = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // stream closed by client
        }
      };

      try {
        const result = await service.generateImage(brief, (phaseEvent) => {
          emit({ type: "phase", ...phaseEvent });
        }, abortController.signal);

        if (!result.success) {
          emit({
            type: "error",
            phase: "done",
            code: result.code,
            message: result.message,
            httpStatus: result.code === "global_timeout" ? 504 : 502,
            retryable: false,
            requiresUserAction:
              result.code === "product_image_conflict" || result.code === "input_low_confidence",
          });
        } else {
          const resultEvent: Record<string, unknown> = {
            type: "result",
            success: true,
            imageDataUrl: result.imageDataUrl,
            storeIdentity: validatedSnapshot,
          };
          if (result.inputCorrections) {
            resultEvent.inputCorrections = result.inputCorrections;
          }
          emit(resultEvent);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          emit({
            type: "error",
            phase: "image_generation",
            code: "global_timeout",
            message: "O tempo limite de geração foi excedido. Tente novamente.",
            httpStatus: 504,
            retryable: false,
          });
        } else {
          const message = err instanceof Error ? err.message : String(err);
          emit({
            type: "error",
            phase: "image_generation",
            code: "provider_error",
            message: "Falha ao gerar imagem. Tente novamente.",
            httpStatus: 502,
            retryable: true,
          });
          console.error(`[generate-image-stream] error — ${message}`);
        }
      } finally {
        clearTimeout(timeoutId);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
