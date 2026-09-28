import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertLabEnvironment } from "@/lib/lab/environment-guard";
import {
  assertBenchTestStore,
  type BenchManifestStore,
} from "@/lib/lab/bench/domain/store-manifest";

/**
 * Signer local **restrito** de assets de branding da bancada (F48.2.2, D3).
 *
 * Logo/assinatura e demais assets do branding são servidos por este signer
 * dedicado, que:
 *  - aceita **somente** os buckets locais `store-logos`, `store-brand-assets` e
 *    `visual-signatures` (allowlist estrita de bucket e de path);
 *  - é aplicado **somente após** `assertLabEnvironment()` (recusa fora do
 *    ambiente local);
 *  - **nunca** aceita bucket/path informado livremente pelo cliente: o loader/API
 *    resolve o path a partir do registro persistido da loja (já validada por
 *    `assertBenchTestStore`, via `createBenchBrandingSignedUrlForStore`);
 *  - **não** reutiliza o signer de artefatos do laboratório, que permanece
 *    exclusivo para as entradas/resultados da bancada;
 *  - assina com TTL de curta duração decidido no servidor.
 */

// ─── Allowlist de buckets (D3) ───────────────────────────────────────────────

/** Buckets locais aceitos para assets de branding — allowlist estrita. */
export const BENCH_BRANDING_BUCKETS = [
  "store-logos",
  "store-brand-assets",
  "visual-signatures",
] as const;

export type BenchBrandingBucket = (typeof BENCH_BRANDING_BUCKETS)[number];

/** TTL da URL assinada (curta duração, decidido no servidor). */
export const BENCH_BRANDING_SIGNED_URL_TTL_SECONDS = 3600;

// ─── Erros determinísticos ───────────────────────────────────────────────────

export type BenchBrandingSignerErrorCode =
  | "bench_branding_bucket_not_allowed"
  | "bench_branding_path_invalid";

/** Erro determinístico do signer de branding (bucket fora da allowlist / path inválido). */
export class BenchBrandingSignerError extends Error {
  readonly code: BenchBrandingSignerErrorCode;

  constructor(code: BenchBrandingSignerErrorCode, detail: string) {
    super(`${code}:${detail}`);
    this.name = "BenchBrandingSignerError";
    this.code = code;
  }
}

function assertAllowedBucket(bucket: unknown): BenchBrandingBucket {
  if (typeof bucket !== "string" || !(BENCH_BRANDING_BUCKETS as readonly string[]).includes(bucket)) {
    throw new BenchBrandingSignerError("bench_branding_bucket_not_allowed", String(bucket));
  }
  return bucket as BenchBrandingBucket;
}

/** Recusa path vazio, traversal (`..`, `\`), esquema de URL (`://`) e absoluto. */
function assertAllowedPath(storagePath: unknown): string {
  if (typeof storagePath !== "string" || storagePath.length === 0) {
    throw new BenchBrandingSignerError("bench_branding_path_invalid", "empty");
  }
  if (
    storagePath.includes("..") ||
    storagePath.startsWith("/") ||
    storagePath.includes("\\") ||
    storagePath.includes("://") ||
    storagePath.includes("//")
  ) {
    throw new BenchBrandingSignerError("bench_branding_path_invalid", storagePath);
  }
  return storagePath;
}

// ─── Assinatura ──────────────────────────────────────────────────────────────

/**
 * Assina um path de branding server-side. A guarda de ambiente é aplicada na
 * entrada; o bucket é validado contra a allowlist estrita e o path é validado
 * contra traversal. O TTL é a constante do servidor (o cliente nunca escolhe).
 */
export async function createBenchBrandingSignedUrl(params: {
  client: SupabaseClient;
  bucket: string;
  path: string;
}): Promise<string> {
  assertLabEnvironment();

  const bucket = assertAllowedBucket(params.bucket);
  const storagePath = assertAllowedPath(params.path);

  const { data, error } = await params.client.storage
    .from(bucket)
    .createSignedUrl(storagePath, BENCH_BRANDING_SIGNED_URL_TTL_SECONDS);

  if (error || !data || !data.signedUrl) {
    throw new Error("bench_branding_signed_url_failed");
  }

  return data.signedUrl;
}

/**
 * Assinatura **escopada à loja**: exige primeiro que `storeId` seja uma loja de
 * teste elegível (presente no manifesto **E** materializada no Supabase local,
 * via `assertBenchTestStore`) **antes** de assinar qualquer asset. É este o ponto
 * de entrada usado pelo loader de branding/API — o cliente nunca informa
 * bucket/path livremente.
 */
export async function createBenchBrandingSignedUrlForStore(params: {
  client: SupabaseClient;
  storeId: string;
  bucket: string;
  path: string;
  manifest?: readonly BenchManifestStore[];
}): Promise<string> {
  await assertBenchTestStore({
    client: params.client,
    storeId: params.storeId,
    manifest: params.manifest,
  });
  return createBenchBrandingSignedUrl({
    client: params.client,
    bucket: params.bucket,
    path: params.path,
  });
}
