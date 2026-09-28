import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BrandAssetRecord, BrandProfileRecord } from "@/lib/brand-assets/types";
import {
  assertBenchTestStore,
  type BenchManifestStore,
} from "./store-manifest";
import {
  createBenchBrandingSignedUrlForStore,
} from "../persistence/bench-branding-signer";
import { BenchBrandingSnapshotSchema, type BenchBrandingSnapshot } from "./schemas";

/**
 * Contrato local **completo** de branding da loja de teste (F48.2.2, D3).
 *
 * Carrega, em **somente leitura** no Supabase local:
 *  1. `stores` — nome, segmento, subsegmento, tom de voz, posicionamento,
 *     descrição curta e slogan (via `assertBenchTestStore`, exigido **antes** de
 *     qualquer leitura);
 *  2. `store_brand_profiles` com `status = 'synced'` e fallback
 *     `source = 'without_logo'` — incluindo `typography_direction` lida
 *     **diretamente da coluna persistida** (nunca do snapshot de campanha);
 *  3. `store_brand_assets` com `status = 'active'` — logo/assinatura, cada asset
 *     resolvido por URL assinada de curta duração server-side pelo **signer local
 *     restrito** (`createBenchBrandingSignedUrl`), com bucket/path vindos do
 *     registro persistido (nunca do cliente);
 *  4. `store_visual_signatures` com `status = 'active'`.
 *
 * Garantias (D3):
 *  - todas as consultas são `.select(...)` **somente leitura** com erro prefixado
 *    (padrão `experiment-queries.ts`);
 *  - **não** reutiliza nem altera o pipeline produtivo de campanha (o contrato de
 *    snapshot de campanha, o mapper de identidade e a montagem do prompt do
 *    diretor permanecem intocados);
 *  - **não** reutiliza o signer/bucket de artefatos do laboratório para branding;
 *  - **não** concatena o branding ao prompt nem envia logo/assinatura ao modelo —
 *    o branding é apenas exibido e registrado como evidência nesta fase.
 */

// ─── Contrato exposto ────────────────────────────────────────────────────────

export interface BenchBrandingAssetContract {
  assetType: string;
  variantType: string;
  storagePath: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  checksum: string;
  signedUrl: string | null;
}

export interface BenchBrandingContract {
  storeId: string;
  storeName: string;
  segment: string;
  subsegment: string | null;
  toneOfVoice: string | null;
  positioning: string | null;
  shortDescription: string | null;
  slogan: string | null;
  /** Direção tipográfica — lida da fonte persistida (a lacuna que o snapshot produtivo omite). */
  typographyDirection: string | null;
  safeColorTokens: Record<string, string>;
  brandColorsChosen: Array<string | null>;
  logoColorsDetected: string[];
  visualStyle: string | null;
  visualTone: string | null;
  brandPersonality: string | null;
  campaignGuidelines: string | null;
  campaignBrief: string | null;
  profileSource: string | null;
  profileStatus: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  assets: BenchBrandingAssetContract[];
}

// ─── Tipagem da fonte persistida (reuso do contrato produtivo, sem alterá-lo) ─

type BrandProfileFields = Pick<
  BrandProfileRecord,
  | "source"
  | "status"
  | "typography_direction"
  | "safe_color_tokens"
  | "brand_colors_chosen"
  | "logo_colors_detected"
  | "visual_style"
  | "visual_tone"
  | "brand_personality"
  | "campaign_guidelines"
  | "campaign_brief"
>;

type BrandAssetFields = Pick<
  BrandAssetRecord,
  | "asset_type"
  | "variant_type"
  | "storage_path"
  | "mime_type"
  | "width"
  | "height"
  | "size_bytes"
  | "checksum"
  | "status"
>;

type VisualSignatureFields = {
  storage_path: string;
  asset_url: string;
  type: string;
  status: string;
};

// ─── Helpers de narrowing ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function asRow(data: unknown): Row | null {
  return data && typeof data === "object" ? (data as Row) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function nullableStringArray(value: unknown): Array<string | null> {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === "string" ? entry : null));
}

// ─── Colunas lidas (somente leitura) ─────────────────────────────────────────

const PROFILE_COLUMNS =
  "source, status, typography_direction, safe_color_tokens, brand_colors_chosen, logo_colors_detected, visual_style, visual_tone, brand_personality, campaign_guidelines, campaign_brief";

const ASSET_COLUMNS =
  "id, asset_type, variant_type, storage_path, mime_type, width, height, size_bytes, checksum, status";

const SIGNATURE_COLUMNS = "id, storage_path, asset_url, type, status";

// ─── Leituras read-only ──────────────────────────────────────────────────────

function mapProfile(row: BrandProfileFields): BrandProfileFields {
  return row;
}

/**
 * Lê o perfil de branding: primeiro `status = 'synced'`; quando ausente, faz
 * fallback para `source = 'without_logo'` (mais recente). Somente leitura.
 */
async function readBrandProfile(params: {
  client: SupabaseClient;
  storeId: string;
}): Promise<BrandProfileFields | null> {
  const { client, storeId } = params;

  const synced = await client
    .from("store_brand_profiles")
    .select(PROFILE_COLUMNS)
    .eq("store_id", storeId)
    .eq("status", "synced")
    .maybeSingle();

  if (synced.error) {
    throw new Error(`bench_branding_profile_read_failed:${synced.error.message}`);
  }
  const syncedRow = asRow(synced.data);
  if (syncedRow) return mapProfile(syncedRow as unknown as BrandProfileFields);

  const fallback = await client
    .from("store_brand_profiles")
    .select(PROFILE_COLUMNS)
    .eq("store_id", storeId)
    .eq("source", "without_logo")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallback.error) {
    throw new Error(`bench_branding_profile_read_failed:${fallback.error.message}`);
  }
  const fallbackRow = asRow(fallback.data);
  return fallbackRow ? mapProfile(fallbackRow as unknown as BrandProfileFields) : null;
}

/** Lista os assets ativos de branding (`status = 'active'`). Somente leitura. */
async function readActiveBrandAssets(params: {
  client: SupabaseClient;
  storeId: string;
}): Promise<BrandAssetFields[]> {
  const { data, error } = await params.client
    .from("store_brand_assets")
    .select(ASSET_COLUMNS)
    .eq("store_id", params.storeId)
    .eq("status", "active");

  if (error) {
    throw new Error(`bench_branding_assets_read_failed:${error.message}`);
  }
  return Array.isArray(data) ? (data as unknown as BrandAssetFields[]) : [];
}

/** Lê a assinatura visual ativa (`status = 'active'`). Somente leitura. */
async function readActiveVisualSignature(params: {
  client: SupabaseClient;
  storeId: string;
}): Promise<VisualSignatureFields | null> {
  const { data, error } = await params.client
    .from("store_visual_signatures")
    .select(SIGNATURE_COLUMNS)
    .eq("store_id", params.storeId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`bench_branding_signature_read_failed:${error.message}`);
  }
  const row = asRow(data);
  return row ? (row as unknown as VisualSignatureFields) : null;
}

// ─── Assinatura restrita dos assets ──────────────────────────────────────────

/**
 * Assina um asset pelo **signer restrito** escopado à loja. Uma falha de
 * assinatura não derruba o contrato: o asset fica com `signedUrl: null`.
 */
async function signBrandingPath(params: {
  client: SupabaseClient;
  storeId: string;
  bucket: string;
  path: string;
  manifest?: readonly BenchManifestStore[];
}): Promise<string | null> {
  if (!params.path) return null;
  try {
    return await createBenchBrandingSignedUrlForStore({
      client: params.client,
      storeId: params.storeId,
      bucket: params.bucket,
      path: params.path,
      manifest: params.manifest,
    });
  } catch {
    return null;
  }
}

// ─── Loader principal ────────────────────────────────────────────────────────

/**
 * Carrega o contrato completo de branding de uma loja de teste. A **primeira**
 * operação é `assertBenchTestStore` — loja fora do manifesto (ou ausente do
 * Supabase local) é recusada **antes** de qualquer leitura de branding, tabela
 * de loja ou storage.
 */
export async function loadBenchBranding(params: {
  client: SupabaseClient;
  storeId: string;
  manifest?: readonly BenchManifestStore[];
}): Promise<BenchBrandingContract> {
  const { client, storeId, manifest } = params;

  const store = await assertBenchTestStore({ client, storeId, manifest });

  const profile = await readBrandProfile({ client, storeId });
  const assetRows = await readActiveBrandAssets({ client, storeId });

  const assets: BenchBrandingAssetContract[] = [];
  for (const row of assetRows) {
    const storagePath = text(row.storage_path);
    const signedUrl = await signBrandingPath({
      client,
      storeId,
      bucket: "store-brand-assets",
      path: storagePath,
      manifest,
    });
    assets.push({
      assetType: text(row.asset_type),
      variantType: text(row.variant_type),
      storagePath,
      mimeType: text(row.mime_type),
      width: num(row.width),
      height: num(row.height),
      sizeBytes: num(row.size_bytes),
      checksum: text(row.checksum),
      signedUrl,
    });
  }

  const signature = await readActiveVisualSignature({ client, storeId });
  const signatureUrl = signature
    ? await signBrandingPath({
        client,
        storeId,
        bucket: "visual-signatures",
        path: text(signature.storage_path),
        manifest,
      })
    : null;

  const logoUrl = assets.find((asset) => asset.signedUrl !== null)?.signedUrl ?? null;

  return {
    storeId,
    storeName: store.name,
    segment: store.segment,
    subsegment: store.subsegment,
    toneOfVoice: store.toneOfVoice,
    positioning: store.positioning,
    shortDescription: store.shortDescription,
    slogan: store.slogan,
    typographyDirection: nullableText(profile?.typography_direction),
    safeColorTokens: stringRecord(profile?.safe_color_tokens),
    brandColorsChosen: nullableStringArray(profile?.brand_colors_chosen),
    logoColorsDetected: stringArray(profile?.logo_colors_detected),
    visualStyle: nullableText(profile?.visual_style),
    visualTone: nullableText(profile?.visual_tone),
    brandPersonality: nullableText(profile?.brand_personality),
    campaignGuidelines: nullableText(profile?.campaign_guidelines),
    campaignBrief: nullableText(profile?.campaign_brief),
    profileSource: nullableText(profile?.source),
    profileStatus: nullableText(profile?.status),
    logoUrl,
    signatureUrl,
    assets,
  };
}

/**
 * Converte o contrato no snapshot de branding registrado como evidência,
 * validando-o contra o schema da bancada (inclui a direção tipográfica). O
 * branding é **apenas registrado** — nunca concatenado ao prompt nem enviado ao
 * modelo nesta fase.
 */
export function toBenchBrandingSnapshot(contract: BenchBrandingContract): BenchBrandingSnapshot {
  return BenchBrandingSnapshotSchema.parse(contract);
}
