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
  bucket: "store-brand-assets" | "visual-signatures";
  storagePath: string;
}): Promise<string | null> {
  if (!params.storagePath) return null;
  try {
    return await createBenchBrandingSignedUrlForStore({
      client: supabaseAdmin,
      storeId: params.storeId,
      bucket: params.bucket,
      path: params.storagePath,
    });
  } catch {
    return null;
  }
}

/**
 * Renova a URL assinada do descritor de identidade **já selecionado** por
 * `loadBenchBranding` (ponto único de decisão). A rota **não** re-resolve a
 * identidade: localiza o asset pelo `storagePath` selecionado (logo ou
 * assinatura) e assina exatamente esse path. Em falha, mantém `signedUrl: null`
 * sem fallback para outra variante. As URLs assinadas dos assets são renovadas
 * apenas como metadados de exibição.
 */
async function withSignedAssets(
  branding: BenchBrandingContract,
): Promise<BenchBrandingContract> {
  let identityReference = branding.identityReference;
  if (identityReference) {
    const bucket =
      identityReference.kind === "logo" ? "store-brand-assets" : "visual-signatures";
    const signedUrl = await signBrandingAsset({
      storeId: branding.storeId,
      bucket,
      storagePath: identityReference.storagePath,
    });
    identityReference = { ...identityReference, signedUrl };
  }

  const assets = [];
  for (const asset of branding.assets) {
    const signedUrl = await signBrandingAsset({
      storeId: branding.storeId,
      bucket: "store-brand-assets",
      storagePath: asset.storagePath,
    });
    assets.push({ ...asset, signedUrl: signedUrl ?? asset.signedUrl });
  }

  const logoUrl =
    identityReference?.kind === "logo" && identityReference.signedUrl
      ? identityReference.signedUrl
      : null;
  const signatureUrl =
    identityReference?.kind === "visual_signature" && identityReference.signedUrl
      ? identityReference.signedUrl
      : null;

  return {
    ...branding,
    assets,
    identityReference,
    logoUrl,
    signatureUrl,
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
