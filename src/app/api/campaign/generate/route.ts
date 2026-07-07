import { NextRequest, NextResponse } from "next/server";
import { CampaignGenerationInputSchema } from "@/lib/campaign-intelligence/schema";
import {
  CampaignIntelligenceService,
  createDefaultProvider,
} from "@/lib/campaign-intelligence/service";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { notFound } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  requireSameOrigin(request);
  const user = await requireApiUser();
  const store = await getCurrentStore(user.userId);
  if (!store) {
    return notFound("Store not found");
  }

  // ── Step 1: Parse JSON body ─────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Corpo da requisição inválido" } },
      { status: 400 }
    );
  }

  // ── Step 2: Validate input ──────────────────────────────────────────
  const parsed = CampaignGenerationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Dados de entrada inválidos para geração de campanha",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  // ── Step 3: Select provider ─────────────────────────────────────────
  const provider = await createDefaultProvider();

  // ── Step 4: Instantiate service ─────────────────────────────────────
  const service = new CampaignIntelligenceService(provider);

  // ── Step 5: Generate campaign ───────────────────────────────────────
  const result = await service.generate(parsed.data);

  // ── Step 6: Map result to HTTP response ─────────────────────────────
  if (!result.success) {
    if (result.code === "provider_failure") {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.data, { status: 200 });
}
