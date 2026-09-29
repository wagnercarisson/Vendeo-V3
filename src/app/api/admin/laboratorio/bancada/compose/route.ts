import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { buildBenchCampaignSnapshot } from "@/lib/lab/bench/domain/campaign-snapshot";
import {
  DEFAULT_BENCH_CONFIG,
  resolveBenchConfig,
} from "@/lib/lab/bench/domain/config-registry";
import { buildBenchExperimentalBriefing } from "@/lib/lab/bench/domain/experimental-briefing";
import { BenchPresetError, resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";
import {
  COMPOSER_VERSION,
  composePromptBlocks,
} from "@/lib/lab/bench/domain/prompt-composer";
import { BenchOfferSchema, BenchProductSchema } from "@/lib/lab/bench/domain/schemas";
import {
  BenchStoreManifestError,
  assertBenchTestStore,
} from "@/lib/lab/bench/domain/store-manifest";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { loadBenchBranding } from "@/lib/lab/bench/domain/branding-service";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.3 (D17/D19; spec lab-admin-api / lab-bench-prompt-preflight): composição e
// **preview** do prompt compilado + **aprovação explícita**.
//
// O compositor (`prompt-composer.ts`) é **puro e sem IA**: apenas serializa dados
// estruturados e o prompt-base manual em blocos canônicos. Nenhuma chamada de IA,
// provider, secrets ou escrita ocorre aqui — a estimativa/confirmação e a geração
// são passos separados (`POST /runs`), que exigem o preflight aprovado.
//
// Ordem obrigatória: admin → guarda de ambiente → `storeId` (400) →
// **`assertBenchTestStore` ANTES de qualquer leitura** → composição pura.

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = apiHandler(async (request: Request) => {
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

  let raw: Record<string, unknown> | null = null;
  try {
    const parsedBody = (await request.json()) as unknown;
    raw =
      parsedBody && typeof parsedBody === "object"
        ? (parsedBody as Record<string, unknown>)
        : null;
  } catch {
    raw = null;
  }
  if (raw === null) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const storeId = typeof raw.storeId === "string" ? raw.storeId : "";
  if (!UUID_REGEX.test(storeId)) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["storeId"] },
      { status: 400 },
    );
  }

  // Manifesto ANTES de qualquer leitura com `storeId` (branding/tabela/storage).
  try {
    await assertBenchTestStore({ client: supabaseAdmin, storeId });
  } catch (error) {
    if (error instanceof BenchStoreManifestError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  const product = BenchProductSchema.safeParse(raw.product);
  const offer = BenchOfferSchema.safeParse(raw.offer);
  if (!product.success || !offer.success) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        details: [
          ...(product.success ? [] : product.error.issues),
          ...(offer.success ? [] : offer.error.issues),
        ],
      },
      { status: 400 },
    );
  }

  const promptBase = typeof raw.promptBase === "string" ? raw.promptBase : "";
  const references = Array.isArray(raw.references)
    ? raw.references.filter((entry): entry is string => typeof entry === "string")
    : [];

  // Config resolvida (dimensões travadas + preset habilitado). As dimensões
  // `modelo`/`qualidade` não entram no texto do prompt — o registry permanece a
  // autoridade.
  const presetId = typeof raw.presetId === "string" ? raw.presetId : "";
  if (!presetId) {
    return NextResponse.json(
      { error: "invalid_payload", details: ["presetId"] },
      { status: 400 },
    );
  }
  let preset;
  try {
    preset = resolveBenchPreset(presetId);
  } catch (error) {
    if (error instanceof BenchPresetError) {
      return NextResponse.json(
        { error: "preset_not_enabled", reason: error.reason },
        { status: 400 },
      );
    }
    throw error;
  }
  const config = resolveBenchConfig({
    ...DEFAULT_BENCH_CONFIG,
    modelo: preset.model,
    qualidade: preset.quality,
  });

  const branding = await loadBenchBranding({ client: supabaseAdmin, storeId });
  const snapshot = buildBenchCampaignSnapshot({
    product: product.data,
    offer: offer.data,
    config,
  });
  const briefing = buildBenchExperimentalBriefing({ branding, snapshot, config });
  const composition = composePromptBlocks({
    briefing,
    snapshot,
    promptBase,
    references,
  });

  return NextResponse.json({
    compiledPrompt: composition.text,
    blocks: composition.blocks,
    composerVersion: COMPOSER_VERSION,
    briefing,
    // A aprovação é explícita: o cliente devolve `approved: true` apenas quando o
    // operador aprovou o texto final. O servidor não inventa aprovação.
    approved: raw.approved === true,
  });
});
