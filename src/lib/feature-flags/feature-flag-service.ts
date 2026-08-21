import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

// F43 (D5): flag administrativa mínima de reativação da validação IA
// produto×imagem (InputValidationService) mesmo com a revisão humana do brief
// confirmada. Persistência na tabela feature_flags (NÃO env var como decisão
// principal). Leitura server-only com fallback seguro.
export const FORCE_BRIEF_VISION_CHECK_KEY = "force_brief_vision_check";

// Env var emergencial opcional: pode forçar `true` quando presente (fail-safe
// de infra) — nunca é a decisão principal. A decisão principal é a tabela.
const FORCE_ENV = "VENDEO_FORCE_BRIEF_VISION_CHECK";

export class FeatureFlagService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  /**
   * Lê o `enabled` da flag `force_brief_vision_check` (D5).
   *
   * Fallback seguro: falha na leitura → `false` (fluxo padrão: revisão humana +
   * pular vision) — NUNCA bloqueia a geração; loga warning operacional.
   * Env var emergencial `VENDEO_FORCE_BRIEF_VISION_CHECK=true` pode forçar
   * `true` quando presente (fail-safe de infra).
   */
  async isForceBriefVisionCheckEnabled(): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from("feature_flags")
        .select("enabled")
        .eq("key", FORCE_BRIEF_VISION_CHECK_KEY)
        .maybeSingle();

      if (error) {
        console.warn(
          `[feature-flag] ${FORCE_BRIEF_VISION_CHECK_KEY} read error — falling back to false: ${error.message}`
        );
      } else if (data === null) {
        console.warn(
          `[feature-flag] ${FORCE_BRIEF_VISION_CHECK_KEY} not found — falling back to false`
        );
      } else {
        return data.enabled === true;
      }
    } catch (err) {
      console.warn(
        `[feature-flag] ${FORCE_BRIEF_VISION_CHECK_KEY} read exception — falling back to false: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Fail-safe emergencial (infra): nunca a decisão principal.
    if (process.env[FORCE_ENV] === "true") {
      return true;
    }

    return false;
  }
}

export async function isForceBriefVisionCheckEnabled(): Promise<boolean> {
  return new FeatureFlagService().isForceBriefVisionCheckEnabled();
}