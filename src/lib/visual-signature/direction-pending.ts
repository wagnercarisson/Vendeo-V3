import "server-only";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import {
  deriveVisualDirectionSupportCode,
} from "@/lib/visual-signature/support-codes";
import type {
  VisualDirectionFailureRoutine,
  VisualDirectionSupportCode,
} from "@/lib/visual-signature/support-codes";

/**
 * Estado server-side da direção visual (quick 261025-svt).
 *
 * NÃO cria tabela/coluna/status/migration: usa `store_brand_profiles.status`
 * existente e o JSONB `store_visual_signatures.metadata` existente.
 */

type SupabaseLike = { from: (table: string) => any };

export interface VisualDirectionState {
  pending: boolean;
  active_signature_id: string | null;
  synced_profile_id: string | null;
  reference: string | null;
  failure_at: string | null;
  support_code: VisualDirectionSupportCode | null;
}

const LOG_PREFIX = "[direction-pending]";

function cleanupFailure(): { ok: false; error: string } {
  return { ok: false, error: "cleanup_failed" };
}

/**
 * Lê o estado atual da direção visual. Erro de leitura LANÇA (nunca vira
 * ausência/legado) para que a rota responda 500 seguro.
 */
export async function loadVisualDirectionState(
  storeId: string,
  client: SupabaseLike = supabase,
): Promise<VisualDirectionState> {
  const activeResult = await client
    .from("store_visual_signatures")
    .select("id, metadata")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeResult?.error) {
    throw new Error("direction_state_read_failed");
  }

  const active = activeResult?.data ?? null;

  const syncedResult = await client
    .from("store_brand_profiles")
    .select("id, visual_signature_id")
    .eq("store_id", storeId)
    .eq("status", "synced")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (syncedResult?.error) {
    throw new Error("direction_state_read_failed");
  }

  const synced = syncedResult?.data ?? null;

  if (!active) {
    return {
      pending: false,
      active_signature_id: null,
      synced_profile_id: null,
      reference: null,
      failure_at: null,
      support_code: null,
    };
  }

  const metadata = (active.metadata ?? {}) as Record<string, unknown>;
  const reference =
    typeof metadata.brand_profile_failure_reference === "string"
      ? metadata.brand_profile_failure_reference
      : active.id;
  const failureAt =
    typeof metadata.brand_profile_failure_at === "string"
      ? metadata.brand_profile_failure_at
      : null;

  const pending = !synced || synced.visual_signature_id !== active.id;

  return {
    pending,
    active_signature_id: active.id,
    synced_profile_id: synced?.id ?? null,
    reference: reference ?? null,
    failure_at: failureAt,
    support_code: pending ? deriveVisualDirectionSupportCode(metadata) : null,
  };
}

/**
 * Invalida perfis `synced` que não pertencem a uma assinatura mais nova.
 *
 * - `options.signatureId` é a assinatura que falhou. Se ela ainda for a ativa,
 *   TODOS os perfis synced da loja são invalidados (inclusive um perfil synced
 *   antigo da própria assinatura, que não pode continuar liberando campanhas).
 * - Se outra assinatura já assumiu como ativa, o perfil dela é preservado;
 *   somente perfis legados/antigos são invalidados.
 *
 * Preserva conteúdo/histórico. NUNCA grava `synced` (fail-closed).
 */
export async function markSyncedProfilesOutdatedExceptActive(
  storeId: string,
  options: { signatureId?: string; client?: SupabaseLike } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = options.client ?? supabase;
  const now = new Date().toISOString();

  const activeResult = await client
    .from("store_visual_signatures")
    .select("id")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (activeResult?.error) {
    console.error(`${LOG_PREFIX} cleanup_failed`, { code: "cleanup_failed" });
    return cleanupFailure();
  }

  const activeId: string | null = activeResult?.data?.[0]?.id ?? null;
  // Só preserva o perfil ativo quando ele pertence a OUTRA assinatura (resposta
  // atrasada). Se a assinatura ativa é a que falhou, ela deve ser invalidada.
  const preserveActiveId =
    activeId && options.signatureId !== activeId ? activeId : null;

  if (preserveActiveId) {
    const legacy = await client
      .from("store_brand_profiles")
      .update({ status: "outdated", updated_at: now })
      .eq("store_id", storeId)
      .eq("status", "synced")
      .is("visual_signature_id", null);

    if (legacy?.error) {
      console.error(`${LOG_PREFIX} cleanup_failed`, { code: "cleanup_failed" });
      return cleanupFailure();
    }

    const other = await client
      .from("store_brand_profiles")
      .update({ status: "outdated", updated_at: now })
      .eq("store_id", storeId)
      .eq("status", "synced")
      .neq("visual_signature_id", preserveActiveId);

    if (other?.error) {
      console.error(`${LOG_PREFIX} cleanup_failed`, { code: "cleanup_failed" });
      return cleanupFailure();
    }

    return { ok: true };
  }

  const all = await client
    .from("store_brand_profiles")
    .update({ status: "outdated", updated_at: now })
    .eq("store_id", storeId)
    .eq("status", "synced");

  if (all?.error) {
    console.error(`${LOG_PREFIX} cleanup_failed`, { code: "cleanup_failed" });
    return cleanupFailure();
  }

  return { ok: true };
}

/**
 * Grava a referência de falha na metadata da assinatura ativa. Condicional a
 * `status='active'`; ausência de linha ⇒ `superseded`.
 */
export async function recordVisualDirectionFailure(args: {
  storeId: string;
  signatureId: string;
  reference: string | null;
  failureCode: string;
  supportCode: VisualDirectionSupportCode;
  routine: VisualDirectionFailureRoutine;
  client?: SupabaseLike;
}): Promise<
  { status: "ok" } | { status: "superseded" } | { status: "error"; error: string }
> {
  const client = args.client ?? supabase;

  const readResult = await client
    .from("store_visual_signatures")
    .select("metadata")
    .eq("id", args.signatureId)
    .eq("store_id", args.storeId)
    .eq("status", "active")
    .maybeSingle();

  if (readResult?.error) {
    console.error(`${LOG_PREFIX} reference_failed`, { code: "reference_failed" });
    return { status: "error", error: "reference_failed" };
  }

  if (!readResult?.data) {
    return { status: "superseded" };
  }

  const existing = (readResult.data.metadata ?? {}) as Record<string, unknown>;
  const merged = {
    ...existing,
    brand_profile_status: "failed",
    brand_profile_failure_reference: args.reference,
    brand_profile_failure_at: new Date().toISOString(),
    brand_profile_failure_code: args.failureCode,
    brand_profile_support_code: args.supportCode,
    brand_profile_failure_routine: args.routine,
  };

  const updateResult = await client
    .from("store_visual_signatures")
    .update({ metadata: merged })
    .eq("id", args.signatureId)
    .eq("store_id", args.storeId)
    .eq("status", "active")
    .select("id");

  if (updateResult?.error) {
    console.error(`${LOG_PREFIX} reference_failed`, { code: "reference_failed" });
    return { status: "error", error: "reference_failed" };
  }

  const rows = updateResult?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "superseded" };
  }

  return { status: "ok" };
}

/**
 * Limpa a marcação de falha (após recuperação bem-sucedida). Condicional a
 * `status='active'`; ausência de linha ⇒ `superseded`.
 */
export async function clearVisualDirectionFailure(args: {
  storeId: string;
  signatureId: string;
  client?: SupabaseLike;
}): Promise<
  { status: "ok" } | { status: "superseded" } | { status: "error"; error: string }
> {
  const client = args.client ?? supabase;

  const readResult = await client
    .from("store_visual_signatures")
    .select("metadata")
    .eq("id", args.signatureId)
    .eq("store_id", args.storeId)
    .eq("status", "active")
    .maybeSingle();

  if (readResult?.error) {
    console.error(`${LOG_PREFIX} reference_failed`, { code: "reference_failed" });
    return { status: "error", error: "reference_failed" };
  }

  if (!readResult?.data) {
    return { status: "superseded" };
  }

  const existing = (readResult.data.metadata ?? {}) as Record<string, unknown>;
  const merged = {
    ...existing,
    brand_profile_status: "synced",
    brand_profile_failure_reference: null,
    brand_profile_failure_at: null,
    brand_profile_failure_code: null,
    brand_profile_support_code: null,
    brand_profile_failure_routine: null,
  };

  const updateResult = await client
    .from("store_visual_signatures")
    .update({ metadata: merged })
    .eq("id", args.signatureId)
    .eq("store_id", args.storeId)
    .eq("status", "active")
    .select("id");

  if (updateResult?.error) {
    console.error(`${LOG_PREFIX} reference_failed`, { code: "reference_failed" });
    return { status: "error", error: "reference_failed" };
  }

  const rows = updateResult?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "superseded" };
  }

  return { status: "ok" };
}

/**
 * Guard de persistência: true apenas se existe assinatura `active` com este id.
 * Erro de leitura ⇒ `false` (fail-closed).
 */
export async function isVisualSignatureActive(
  storeId: string,
  signatureId: string,
  client: SupabaseLike = supabase,
): Promise<boolean> {
  const result = await client
    .from("store_visual_signatures")
    .select("id")
    .eq("id", signatureId)
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();

  if (result?.error) {
    console.error(`${LOG_PREFIX} active_check_failed`, { code: "active_check_failed" });
    return false;
  }

  return !!result?.data;
}

/**
 * Sanitiza um diagnóstico externo: remove chaves, Bearer tokens e URLs.
 * Colapsa espaços e trunca em 160 chars.
 */
export function sanitizeDirectionDiagnostic(message: string): string {
  if (typeof message !== "string") return "";
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}
