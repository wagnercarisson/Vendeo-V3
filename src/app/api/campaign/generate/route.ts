import { NextRequest, NextResponse } from "next/server";
import { CampaignGenerationInputSchema } from "@/lib/campaign-intelligence/schema";
import {
  CampaignIntelligenceService,
  createDefaultProvider,
} from "@/lib/campaign-intelligence/service";

export async function POST(request: NextRequest) {
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
  const provider = createDefaultProvider();

  // ── Step 4: Instantiate service ─────────────────────────────────────
  const service = new CampaignIntelligenceService(provider);

  // ── Step 5: Generate campaign ───────────────────────────────────────
  const result = await service.generate(parsed.data);

  // ── Step 6: Map result to HTTP response ─────────────────────────────
  if (!result.success) {
    if (result.code === "provider_failure") {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    // invalid_output (and any unexpected error codes)
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.data, { status: 200 });
}
