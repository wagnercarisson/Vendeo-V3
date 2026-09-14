import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AiCapability, AiProtocol, AiProvider, AiSegment } from "./model-resolver";

export interface AiModelCatalogRow {
  id: string;
  capability: AiCapability | string;
  segment: AiSegment | string;
  provider: AiProvider | string;
  model: string;
  protocol: AiProtocol | string;
  label: string | null;
  status: "active" | "deprecated" | string;
  source_note: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AiModelCatalogMap = Map<string, AiModelCatalogRow>;

export function catalogTupleKey(
  capability: string,
  provider: string,
  model: string,
  protocol: string,
): string {
  return [capability, provider, model, protocol].join("|");
}

/**
 * Server-only bulk reader for the persisted model allowlist.
 *
 * The complete catalog is read once per local cache window. Keeping deprecated
 * rows in the map lets the resolver execute an already-selected model while
 * the UI can still mark it deprecated. Cross-instance invalidation remains
 * bounded by this instance's TTL because no shared cache is introduced here.
 */
export class AiModelCatalogService {
  private cache: { expiresAt: number; rows: AiModelCatalogRow[] } | null = null;
  private inFlight: Promise<AiModelCatalogRow[]> | null = null;

  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
    private readonly ttlMs = 30_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async getCatalogRows(): Promise<AiModelCatalogRow[]> {
    if (this.cache && this.cache.expiresAt > this.now()) return this.cache.rows;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.loadCatalogRows();
    try {
      const rows = await this.inFlight;
      this.cache = { rows, expiresAt: this.now() + this.ttlMs };
      return rows;
    } finally {
      this.inFlight = null;
    }
  }

  async getCatalogMap(): Promise<AiModelCatalogMap> {
    const rows = await this.getCatalogRows();
    return new Map(
      rows.map((row) => [
        catalogTupleKey(row.capability, row.provider, row.model, row.protocol),
        row,
      ]),
    );
  }

  async getActiveCatalogRows(): Promise<AiModelCatalogRow[]> {
    const rows = await this.getCatalogRows();
    return rows.filter((row) => row.status === "active");
  }

  invalidateModelCatalogCache(): void {
    this.cache = null;
    this.inFlight = null;
  }

  private async loadCatalogRows(): Promise<AiModelCatalogRow[]> {
    try {
      const { data, error } = await this.client
        .from("ai_model_catalog")
        .select("*");
      if (error) {
        console.error("[ai-model-catalog] bulk read failed (best-effort):", error.message);
        return [];
      }
      return (data ?? []) as AiModelCatalogRow[];
    } catch (error) {
      console.error("[ai-model-catalog] bulk read exception (best-effort):", error);
      return [];
    }
  }
}

export const aiModelCatalogService = new AiModelCatalogService();

export async function getAiModelCatalogRows(): Promise<AiModelCatalogRow[]> {
  return aiModelCatalogService.getCatalogRows();
}

export async function getAiModelCatalogMap(): Promise<AiModelCatalogMap> {
  return aiModelCatalogService.getCatalogMap();
}

export async function getActiveAiModelCatalogRows(): Promise<AiModelCatalogRow[]> {
  return aiModelCatalogService.getActiveCatalogRows();
}

export function invalidateModelCatalogCache(): void {
  aiModelCatalogService.invalidateModelCatalogCache();
}
