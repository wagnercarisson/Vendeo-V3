import type { StoreIdentitySnapshot } from "@/components/campaign/types";

/**
 * F50.4 — DTO público allowlisted de loja.
 *
 * As rotas de cadastro/atualização de CNPJ devolvem linhas cruas do banco
 * (`stores`), que contêm identificadores internos (`cnpj_normalized`,
 * `cnpj_root_hash`, `cnpj_lookup_hash`, `cnpj_official_data`,
 * `previous_identity_snapshot`). Este módulo é a única barreira antes da
 * resposta HTTP: o DTO é construído por allowlist explícita de chaves, nunca
 * por spread do objeto cru.
 */

export interface PublicStoreDTO {
  id?: string;
  user_id?: string;
  name?: string;
  segment?: string;
  city?: string | null;
  state?: string | null;
  brand_color?: string | null;
  logo_url?: string | null;
  subsegment?: string | null;
  tone_of_voice?: string | null;
  positioning?: string | null;
  short_description?: string | null;
  slogan?: string | null;
  logo_status?: string | null;
  identity_state?: string | null;
  text_only_origin?: string | null;
  manual_color_override?: boolean;
  visual_signature_attempts?: number;
  created_at?: string;
  updated_at?: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj_validation_score?: Record<string, unknown> | null;
  verification_status?: string;
  verification_reasons?: string[] | null;
  is_test_store?: boolean;
  identity?: StoreIdentitySnapshot;
  visual_signature_url?: string | null;
  has_archived_signatures?: boolean;
  /** Confirmação fiscal derivada server-side; o CNPJ em si nunca sai. */
  cnpjRegistered: boolean;
}

const PUBLIC_STORE_KEYS = [
  "id",
  "user_id",
  "name",
  "segment",
  "city",
  "state",
  "brand_color",
  "logo_url",
  "subsegment",
  "tone_of_voice",
  "positioning",
  "short_description",
  "slogan",
  "logo_status",
  "identity_state",
  "text_only_origin",
  "manual_color_override",
  "visual_signature_attempts",
  "created_at",
  "updated_at",
  "razao_social",
  "nome_fantasia",
  "cnpj_validation_score",
  "verification_status",
  "verification_reasons",
  "is_test_store",
  "visual_signature_url",
  "has_archived_signatures",
] as const;

const IDENTITY_KEYS = [
  "storeName",
  "storeSegment",
  "brandColor",
  "identityState",
  "storeInitials",
  "toneOfVoice",
  "subsegment",
  "positioning",
  "shortDescription",
  "slogan",
] as const;

const SIGNATURE_KEYS = ["url", "type"] as const;

const BRAND_PROFILE_KEYS = [
  "brand_colors_chosen",
  "safe_color_tokens",
  "visual_style",
  "visual_tone",
  "brand_personality",
  "campaign_guidelines",
  "campaign_brief",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

/**
 * `identity` é um snapshot aninhado produzido por `buildStoreResponse`. Ele
 * também é reconstruído por allowlist — nenhum campo bruto da loja é
 * repassado junto.
 */
function toPublicIdentity(value: unknown): StoreIdentitySnapshot | undefined {
  if (!isRecord(value)) return undefined;

  const out = pickKeys(value, IDENTITY_KEYS);

  if (isRecord(value.signature)) {
    out.signature = pickKeys(value.signature, SIGNATURE_KEYS);
  }

  if (value.brandProfile === null) {
    out.brandProfile = null;
  } else if (isRecord(value.brandProfile)) {
    out.brandProfile = pickKeys(value.brandProfile, BRAND_PROFILE_KEYS);
  }

  return out as unknown as StoreIdentitySnapshot;
}

export function toPublicStoreDTO(raw: Record<string, unknown>): PublicStoreDTO {
  const dto: Record<string, unknown> = pickKeys(raw, PUBLIC_STORE_KEYS);

  if ("identity" in raw) {
    const identity = toPublicIdentity(raw.identity);
    if (identity !== undefined) dto.identity = identity;
  }

  dto.cnpjRegistered =
    typeof raw.cnpj_normalized === "string" && raw.cnpj_normalized.length > 0;

  return dto as unknown as PublicStoreDTO;
}

/**
 * Aceita o formato devolvido pelos RPCs (`store` como array ou objeto único),
 * um array direto ou um objeto isolado. Sempre devolve array de DTOs.
 */
export function toPublicStoreList(raw: unknown): PublicStoreDTO[] {
  if (Array.isArray(raw)) {
    return raw.filter(isRecord).map(toPublicStoreDTO);
  }

  if (isRecord(raw)) {
    if ("store" in raw) return toPublicStoreList(raw.store);
    return [toPublicStoreDTO(raw)];
  }

  return [];
}
