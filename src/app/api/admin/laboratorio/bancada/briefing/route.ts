import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  loadBenchBranding,
  type BenchBrandingContract,
} from "@/lib/lab/bench/domain/branding-service";
import {
  BenchStoreManifestError,
  assertBenchTestStore,
} from "@/lib/lab/bench/domain/store-manifest";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.3 (D15/D16; spec lab-admin-api / lab-bench-experimental-briefing): exposição
// do **briefing experimental estruturado** — direção visual consolidada, direção
// tipográfica importada do perfil atual e `brandColor` resolvido pela precedência
// produtiva exata.
//
// Ordem obrigatória: admin → guarda de ambiente → validação do `storeId` →
// **`assertBenchTestStore` ANTES de qualquer leitura** de branding/tabela/storage.
// A resposta **não** expõe secrets (nenhuma URL assinada, chave ou token): apenas
// os campos de direção visual relevantes ao compositor (D15). Nenhuma escrita.

/** Direção visual consolidada — subset relevante, sem dados brutos da loja (D15). */
export interface BenchBriefingVisualDirection {
  campaignBrief: string | null;
  campaignGuidelines: string | null;
  visualStyle: string | null;
  visualTone: string | null;
  brandPersonality: string | null;
}

/** Briefing experimental estruturado exposto por `GET /briefing` (sem secrets). */
export interface BenchBriefingResponse {
  storeId: string;
  storeName: string;
  segment: string;
  visualDirection: BenchBriefingVisualDirection;
  typographyDirection: string | null;
  brandColor: string;
  profileSource: string | null;
  profileStatus: string | null;
}

function toBriefingResponse(branding: BenchBrandingContract): BenchBriefingResponse {
  return {
    storeId: branding.storeId,
    storeName: branding.storeName,
    segment: branding.segment,
    visualDirection: {
      campaignBrief: branding.campaignBrief,
      campaignGuidelines: branding.campaignGuidelines,
      visualStyle: branding.visualStyle,
      visualTone: branding.visualTone,
      brandPersonality: branding.brandPersonality,
    },
    typographyDirection: branding.typographyDirection,
    // `brandColor` já resolvido pela precedência produtiva exata (D16).
    brandColor: branding.brandColor,
    profileSource: branding.profileSource,
    profileStatus: branding.profileStatus,
  };
}

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

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

  const storeId = new URL(request.url).searchParams.get("storeId") ?? "";
  if (!storeId) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["storeId"] },
      { status: 400 },
    );
  }

  // Manifesto ANTES de qualquer leitura de branding/tabela/storage.
  try {
    await assertBenchTestStore({ client: supabaseAdmin, storeId });
  } catch (error) {
    if (error instanceof BenchStoreManifestError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  try {
    const branding = await loadBenchBranding({ client: supabaseAdmin, storeId });
    return NextResponse.json({ briefing: toBriefingResponse(branding) });
  } catch {
    return NextResponse.json(
      { error: "Falha ao ler o briefing da loja de teste" },
      { status: 503 },
    );
  }
});
