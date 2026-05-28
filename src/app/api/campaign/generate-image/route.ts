import { NextRequest, NextResponse } from "next/server";
import { GenerateImageRequestSchema } from "@/lib/image-generation/schema";
import { MAX_PRODUCT_IMAGE_BASE64_SIZE } from "@/lib/image-generation/config";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import { OpenAIImageProvider } from "@/lib/image-generation/providers/openai";

export async function POST(request: NextRequest) {
  // ── Step 1: Parse JSON body ─────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Corpo da requisição inválido" } },
      { status: 400 }
    );
  }

  // ── Step 2: Validate productImageDataUrl presence ──────────────
  if (!body.productImageDataUrl || typeof body.productImageDataUrl !== "string") {
    return NextResponse.json(
      { error: { message: "Imagem do produto é obrigatória para gerar a campanha visual." } },
      { status: 400 }
    );
  }

  // ── Step 3: Check payload size limit ───────────────────────────
  if (body.productImageDataUrl.length > MAX_PRODUCT_IMAGE_BASE64_SIZE) {
    return NextResponse.json(
      {
        error: {
          message: `Imagem do produto excede o limite de ${Math.round(MAX_PRODUCT_IMAGE_BASE64_SIZE / (1024 * 1024))}MB. Comprima a imagem e tente novamente.`,
        },
      },
      { status: 413 }
    );
  }

  // ── Step 4: Validate full request schema ────────────────────────
  const parsed = GenerateImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Dados de entrada inválidos para geração de imagem",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  // ── Step 5: Instantiate provider and service ──────────────────
  const provider = new OpenAIImageProvider();
  const service = new ImageGenerationService(provider);

  // ── Step 6: Generate image ──────────────────────────────────────
  const result = await service.generateImage(parsed.data);

  // ── Step 7: Map result to HTTP response ─────────────────────────
  if (!result.success) {
    switch (result.code) {
      case "product_image_conflict":
        return NextResponse.json(
          {
            status: "needs_user_action",
            reason: "product_image_conflict",
            message: result.message,
            suggestedProductName: result.details
              ? (JSON.parse(result.details).suggestedProductName ?? undefined)
              : undefined,
          },
          { status: 409 }
        );

      case "product_image_low_confidence":
        return NextResponse.json(
          {
            status: "needs_user_action",
            reason: "product_image_low_confidence",
            message: result.message,
          },
          { status: 409 }
        );

      case "provider_failure":
        return NextResponse.json(
          { error: { message: result.message } },
          { status: 502 }
        );

      case "review_failed":
        return NextResponse.json(
          { error: { message: result.message } },
          { status: 500 }
        );

      default:
        return NextResponse.json(
          { error: { message: result.message } },
          { status: 500 }
        );
    }
  }

  // ── Step 8: Return success response ───────────────────────────
  const responseBody: Record<string, unknown> = {
    imageDataUrl: result.imageDataUrl,
  };
  if (result.inputCorrections) {
    responseBody.inputCorrections = result.inputCorrections;
  }

  return NextResponse.json(responseBody, { status: 200 });
}
