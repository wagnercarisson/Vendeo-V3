import type { CnpjLookupProvider, CnpjLookupData, LookupOutcome } from "./lookup-providers/types";
import { normalizeCnpj } from "./normalize";

type SafeLookupResult =
  | { status: "resolved"; data: CnpjLookupData }
  | { status: "not_found" }
  | { status: "unavailable" };

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
      await this.cache.set(normalized, "resolved", primaryResult.data, 24);
      return primaryResult;
    }

    if (primaryResult.status === "not_found") {
      await this.cache.set(normalized, "not_found", null, 24);
      return { status: "not_found" };
    }

    const fallbackResult = await this.safeLookup(this.fallbackProvider, normalized);

    if (fallbackResult.status === "resolved") {
      await this.cache.set(normalized, "resolved", fallbackResult.data, 24);
      return fallbackResult;
    }

    if (fallbackResult.status === "not_found") {
      await this.cache.set(normalized, "not_found", null, 24);
      return { status: "not_found" };
    }

    return { status: "unavailable" };
  }

  private async safeLookup(
    provider: CnpjLookupProvider,
    cnpj: string
  ): Promise<SafeLookupResult> {
    try {
      const result = await provider.lookup(cnpj);
      return result as SafeLookupResult;
    } catch {
      return { status: "unavailable" };
    }
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
