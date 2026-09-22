import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

export type NotificationKind =
  | "demo_granted"
  | "demo_expiring_24h"
  | "demo_expired"
  | "demo_exhausted"
  | "support_ack"
  | "support_notice";

export interface NotificationInput {
  storeId: string;
  userId?: string | null;
  kind: NotificationKind;
  dedupKey: string;
  payload?: Record<string, unknown>;
}

/** Demo notifications are deliberately fail-open; support notifications are not. */
export async function enqueueNotification(input: NotificationInput): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("credit_notifications")
    .upsert({
      store_id: input.storeId,
      user_id: input.userId ?? null,
      kind: input.kind,
      dedup_key: input.dedupKey,
      payload: input.payload ?? {},
    }, { onConflict: "store_id,kind,dedup_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) {
    if (input.kind === "support_ack" || input.kind === "support_notice") throw error;
    console.error("[notifications] best-effort enqueue failed", error);
    return null;
  }
  return (data as { id?: string } | null)?.id ?? null;
}

export function demoExpirationDedupKey(expiresAt: Date): string {
  const hour = new Date(expiresAt);
  hour.setUTCMinutes(0, 0, 0);
  return hour.toISOString();
}
