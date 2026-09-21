import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { enqueueNotification, demoExpirationDedupKey } from "@/lib/notifications/outbox";
import { claimEmailNotification, processClaimedEmail } from "@/lib/email/resend";
import { ProductEventService } from "@/lib/product-events/service";

const LOOKAHEAD_HOURS = 48;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { data: balances, error: balanceError } = await supabaseAdmin
    .from("credit_balances")
    .select("store_id, demo_balance, demo_expires_at, demo_cycle_id, origin_demo_grant_tx_id")
    .gt("demo_balance", 0);
  if (balanceError) return NextResponse.json({ error: balanceError.message }, { status: 500 });

  let materialized = 0;
  for (const balance of balances ?? []) {
    if (balance.demo_expires_at && new Date(balance.demo_expires_at) <= now) {
      const { error } = await supabaseAdmin.rpc("materialize_demo_expiration", { p_store_id: balance.store_id });
      if (!error) materialized += 1;
    }
  }

  const eventService = new ProductEventService();
  const { data: transactions } = await supabaseAdmin
    .from("credit_transactions")
    .select("id, store_id, type, amount, metadata, created_at")
    .in("type", ["demo", "expiration", "deduction"])
    .order("created_at", { ascending: true })
    .limit(1000);
  let repaired = 0;
  for (const tx of transactions ?? []) {
    const metadata = (tx.metadata ?? {}) as Record<string, unknown>;
    if (tx.type === "demo") {
      await enqueueNotification({ storeId: tx.store_id, kind: "demo_granted", dedupKey: tx.id, payload: { recipient_email: metadata.recipient_email, grant_tx_id: tx.id, created_at: tx.created_at } });
      await eventService.record("demo_granted", { store_id: tx.store_id, dedup_key: tx.id, properties: { grant_tx_id: tx.id, created_at: tx.created_at } });
      repaired += 1;
    } else if (tx.type === "expiration") {
      await enqueueNotification({ storeId: tx.store_id, kind: "demo_expired", dedupKey: tx.id, payload: { recipient_email: metadata.recipient_email, expiration_tx_id: tx.id, created_at: tx.created_at } });
      await eventService.record("demo_expired", { store_id: tx.store_id, dedup_key: tx.id, properties: { expiration_tx_id: tx.id, created_at: tx.created_at } });
      repaired += 1;
    } else if (metadata.demo_before && metadata.demo_after === 0) {
      await enqueueNotification({ storeId: tx.store_id, kind: "demo_exhausted", dedupKey: tx.id, payload: { recipient_email: metadata.recipient_email, deduction_tx_id: tx.id, created_at: tx.created_at } });
      await eventService.record("demo_exhausted", { store_id: tx.store_id, dedup_key: tx.id, properties: { deduction_tx_id: tx.id, created_at: tx.created_at } });
      repaired += 1;
    }
  }

  const upper = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);
  for (const balance of balances ?? []) {
    if (balance.demo_expires_at && new Date(balance.demo_expires_at) > now && new Date(balance.demo_expires_at) <= upper) {
      await enqueueNotification({ storeId: balance.store_id, kind: "demo_expiring_24h", dedupKey: demoExpirationDedupKey(new Date(balance.demo_expires_at)), payload: { expires_at: balance.demo_expires_at } });
    }
  }

  let emails = 0;
  for (let i = 0; i < 100; i += 1) {
    const claimed = await claimEmailNotification();
    if (!claimed) break;
    await processClaimedEmail(claimed);
    emails += 1;
  }
  return NextResponse.json({ ok: true, materialized, repaired, emails });
}
