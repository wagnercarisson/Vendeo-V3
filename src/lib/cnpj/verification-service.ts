import type { CnpjLookupProvider, CnpjLookupData, LookupOutcome } from "./lookup-providers/types";
import { normalizeCnpj } from "./normalize";

type SafeLookupResult =
  | { status: "resolved"; data: CnpjLookupData }
  | { status: "not_found" }
  | { status: "unsupported_format" }
  | { status: "unavailable" };

const CACHE_TTL_HOURS = 24;

function hasAlphanumericChars(cnpj: string): boolean {
  return /[A-Z]/.test(cnpj);
}

export interface CnpjLookupCache {
  get(cnpjNormalized: string): Promise<{ outcome: string; data: unknown; expiresAt: Date } | null>;
  set(cnpjNormalized: string, outcome: string, data: unknown, ttlHours: number): Promise<void>;
}

export class CnpjVerificationService {
  constructor(
    private primaryProvider: CnpjLookupProvider,
    private fallbackProvider: CnpjLookupProvider,
    private cache: CnpjLookupCache
  ) {}

  async resolve(cnpj: string): Promise<LookupOutcome> {
    const normalized = normalizeCnpj(cnpj);

    const cached = await this.cache.get(normalized);
    if (cached) {
      const expiresAt =
        cached.expiresAt instanceof Date
          ? cached.expiresAt
          : new Date((cached.expiresAt as unknown as string));
      if (expiresAt > new Date()) {
        if (cached.outcome === "resolved") {
          return { status: "resolved", data: cached.data as CnpjLookupData };
        }
        if (cached.outcome === "not_found") {
          return { status: "not_found" };
        }
      }
    }

    const primaryResult = await this.safeLookup(this.primaryProvider, normalized);

    if (primaryResult.status === "resolved") {
      await this.cache.set(normalized, "resolved", primaryResult.data, CACHE_TTL_HOURS);
      return primaryResult;
    }

    if (primaryResult.status === "not_found") {
      // safeLookup only lets conclusive not_found through (numeric or declared capability).
      await this.cache.set(normalized, "not_found", null, CACHE_TTL_HOURS);
      return { status: "not_found" };
    }

    // unavailable | unsupported_format | ambiguous alphanumeric 404 → fallback.
    const fallbackResult = await this.safeLookup(this.fallbackProvider, normalized);

    if (fallbackResult.status === "resolved") {
      await this.cache.set(normalized, "resolved", fallbackResult.data, CACHE_TTL_HOURS);
      return fallbackResult;
    }

    if (fallbackResult.status === "not_found") {
      await this.cache.set(normalized, "not_found", null, CACHE_TTL_HOURS);
      return { status: "not_found" };
    }

    // Definitive format rejection only when every attempted provider rejected it explicitly.
    if (
      primaryResult.status === "unsupported_format" &&
      fallbackResult.status === "unsupported_format"
    ) {
      return { status: "unsupported_format" };
    }

    // unavailable | unsupported_format + unavailable | both unavailable → not cacheable.
    return { status: "unavailable" };
  }

  private async safeLookup(
    provider: CnpjLookupProvider,
    cnpj: string
  ): Promise<SafeLookupResult> {
    let result: SafeLookupResult;
    try {
      result = (await provider.lookup(cnpj)) as SafeLookupResult;
    } catch {
      return { status: "unavailable" };
    }

    // Defense in depth: an alphanumeric 404 from a provider that does not
    // declare support is ambiguous and must never become not_found.
    if (
      result.status === "not_found" &&
      hasAlphanumericChars(cnpj) &&
      provider.supportsAlphanumeric !== true
    ) {
      return { status: "unavailable" };
    }

    return result;
  }
}

export function createSupabaseLookupCache(supabase: {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
    upsert: (data: Record<string, unknown>, options?: { onConflict?: string }) => {
      select: () => Promise<{ error: unknown }>;
    };
  };
}): CnpjLookupCache {
  return {
    async get(cnpjNormalized: string) {
      const { data, error } = await supabase
        .from("cnpj_lookup_cache")
        .select("outcome, result_data, expires_at")
        .eq("cnpj_normalized", cnpjNormalized)
        .maybeSingle();

      if (error || !data) return null;

      return {
        outcome: data.outcome as string,
        data: data.result_data,
        expiresAt: new Date(data.expires_at as string),
      };
    },

    async set(cnpjNormalized: string, outcome: string, data: unknown, ttlHours: number) {
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

      await supabase
        .from("cnpj_lookup_cache")
        .upsert(
          {
            cnpj_normalized: cnpjNormalized,
            outcome,
            result_data: data,
            expires_at: expiresAt,
          },
          { onConflict: "cnpj_normalized" }
        )
        .select();
    },
  };
}
