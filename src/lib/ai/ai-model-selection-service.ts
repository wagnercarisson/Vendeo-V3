import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AiCapability, AiProtocol, AiProvider } from "./model-resolver";

export interface AiModelSelectionRow {
  id: string;
  capability: AiCapability | string;
  provider: AiProvider | string;
  model: string;
  protocol: AiProtocol | string;
  fallback_provider: AiProvider | string | null;
  fallback_model: string | null;
  fallback_protocol: AiProtocol | string | null;
  reason: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type AiModelSelectionMap = Map<string, AiModelSelectionRow>;

/**
 * Bulk reader for persisted selections. The whole map is cached per server
 * instance for 30 seconds, so resolving several capabilities never becomes an
 * N+1 query. Explicit invalidation is used after an admin mutation; other
 * instances may observe the old map until their local TTL expires.
 */
export class AiModelSelectionService {
  private cache: { expiresAt: number; selections: AiModelSelectionMap } | null = null;
  private inFlight: { epoch: number; promise: Promise<AiModelSelectionMap> } | null = null;
  private invalidationEpoch = 0;

  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
    private readonly ttlMs = 30_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async getSelectionMap(): Promise<AiModelSelectionMap> {
    if (this.cache && this.cache.expiresAt > this.now()) return this.cache.selections;
    const epoch = this.invalidationEpoch;
    if (this.inFlight?.epoch === epoch) return this.inFlight.promise;

    const promise = (async () => {
      const selections = await this.loadSelectionMap();
      if (epoch === this.invalidationEpoch && this.inFlight?.promise === promise) {
        this.cache = { selections, expiresAt: this.now() + this.ttlMs };
        this.inFlight = null;
      }
      return selections;
    })();
    this.inFlight = { epoch, promise };
    return promise;
  }

  async getSelections(): Promise<AiModelSelectionRow[]> {
    return [...(await this.getSelectionMap()).values()];
  }

  invalidateModelSelectionCache(): void {
    this.invalidationEpoch += 1;
    this.cache = null;
    this.inFlight = null;
  }

  private async loadSelectionMap(): Promise<AiModelSelectionMap> {
    try {
      const { data, error } = await this.client
        .from("ai_model_selection")
        .select("*");
      if (error) {
        console.error("[ai-model-selection] bulk read failed (fail-open):", error.message);
        return new Map();
      }
      return new Map(
        ((data ?? []) as AiModelSelectionRow[]).map((row) => [row.capability, row]),
      );
    } catch (error) {
      console.error("[ai-model-selection] bulk read exception (fail-open):", error);
      return new Map();
    }
  }
}

export const aiModelSelectionService = new AiModelSelectionService();

export async function getAiModelSelectionMap(): Promise<AiModelSelectionMap> {
  return aiModelSelectionService.getSelectionMap();
}

export async function getAiModelSelections(): Promise<AiModelSelectionRow[]> {
  return aiModelSelectionService.getSelections();
}

export function invalidateModelSelectionCache(): void {
  aiModelSelectionService.invalidateModelSelectionCache();
}
