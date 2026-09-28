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
import { createBenchBrandingSignedUrlForStore } from "@/lib/lab/bench/persistence/bench-branding-signer";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.2 (D3/D4/T-48-2-2-31): leitura do branding completo da loja de teste.
// Ordem obrigatória: admin → guarda de ambiente → **`assertBenchTestStore`
// antes de qualquer leitura** de branding/tabela/storage. Os assets (logo e
// assinatura) são servidos **exclusivamente** pelo signer restrito de branding
// (`createBenchBrandingSignedUrlForStore` → `createBenchBrandingSignedUrl`),
// nunca pelo signer de artefatos do laboratório. Sem diagnóstico e sem secrets.

/** Assina um asset de branding pelo signer restrito, degradando para `null`. */
async function signBrandingAsset(params: {
  storeId: string;
  storagePath: string;
}): Promise<string | null> {
  if (!params.storagePath) return null;
  try {
    return await createBenchBrandingSignedUrlForStore({
      client: supabaseAdmin,
      storeId: params.storeId,
      bucket: "store-brand-assets",
      path: params.storagePath,
    });
  } catch {
    return null;
  }
}

/** Normaliza o contrato, re-assinando os assets pelo signer restrito (curta duração). */
async function withSignedAssets(
  branding: BenchBrandingContract,
): Promise<BenchBrandingContract> {
  const assets = [];
  for (const asset of branding.assets) {
    const signedUrl = await signBrandingAsset({
      storeId: branding.storeId,
      storagePath: asset.storagePath,
    });
    assets.push({ ...asset, signedUrl: signedUrl ?? asset.signedUrl });
  }
  return {
    ...branding,
    assets,
    logoUrl: assets.find((asset) => asset.signedUrl !== null)?.signedUrl ?? null,
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
    return NextResponse.json({ branding: await withSignedAssets(branding) });
  } catch {
    return NextResponse.json(
      { error: "Falha ao ler o branding da loja de teste" },
      { status: 503 },
    );
  }
});
