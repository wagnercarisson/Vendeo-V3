import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

const LEASE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

type Notification = {
  id: string; store_id: string; kind: string; payload: Record<string, unknown>;
  email_status: string; attempt_count: number; next_attempt_at: string | null;
};

function emailEnabled() { return process.env.VENDEO_EMAIL_ENABLED === "true"; }
function isSupport(kind: string) { return kind === "support_ack" || kind === "support_notice"; }
function recipient(row: Notification) { return String(row.payload.recipient_email ?? ""); }

export async function claimEmailNotification(): Promise<Notification | null> {
  const now = new Date().toISOString();
  const lease = new Date(Date.now() + LEASE_MS).toISOString();
  const { data, error } = await supabaseAdmin.rpc("claim_credit_notification", {
    p_now: now, p_lease_expires_at: lease,
  });
  if (error || !data) return null;
  const claimed = Array.isArray(data) ? data[0] : data;
  return (claimed as Notification | undefined) ?? null;
}

export async function processClaimedEmail(row: Notification): Promise<void> {
  if (!emailEnabled() && !isSupport(row.kind)) {
    await finish(row.id, "suppressed", { lease_expires_at: null });
    return;
  }
  const expiresAt = row.payload.expires_at ? new Date(String(row.payload.expires_at)) : null;
  if (!isSupport(row.kind) && expiresAt && expiresAt <= new Date()) {
    await finish(row.id, "suppressed", { lease_expires_at: null });
    return;
  }
  if (!process.env.RESEND_API_KEY || !recipient(row)) return retry(row, "Email ou RESEND_API_KEY ausente", false);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.VENDEO_EMAIL_FROM ?? "noreply@vendeo.tech",
        to: [recipient(row)], subject: String(row.payload.subject ?? "Atualização da sua conta Vendeo"),
        text: String(row.payload.text ?? "Você recebeu uma atualização da sua conta Vendeo."),
      }),
    });
    const body = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) return retry(row, body.message ?? `Resend HTTP ${response.status}`, response.status >= 500);
    await finish(row.id, "sent", { provider_message_id: body.id ?? null, email_sent_at: new Date().toISOString(), lease_expires_at: null });
  } catch (error) {
    await retry(row, error instanceof Error ? error.message : "Falha no Resend", true);
  }
}

async function retry(row: Notification, message: string, retryable: boolean) {
  // The claim RPC owns the increment. Do not increment again on delivery failure.
  const attempts = row.attempt_count;
  if (!retryable || attempts >= MAX_ATTEMPTS) return finish(row.id, "failed", { attempt_count: attempts, last_error: message, lease_expires_at: null });
  await finish(row.id, "pending", { attempt_count: attempts, last_error: message, next_attempt_at: new Date(Date.now() + 2 ** attempts * 60_000).toISOString(), lease_expires_at: null });
}

async function finish(id: string, status: string, values: Record<string, unknown>) {
  await supabaseAdmin.from("credit_notifications").update({ email_status: status, ...values }).eq("id", id).eq("email_status", "processing");
}
