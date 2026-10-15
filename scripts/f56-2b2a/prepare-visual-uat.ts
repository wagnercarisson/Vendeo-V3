/** Local-only fixtures for GSD 56.2.3-05 human UAT. No provider or app bypass. */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  createIsolatedContext, closeIsolatedContext, createCampaign,
  reserveCredit, markArtUploaded, deliverCredit, pgCallJson,
} from "../../src/lib/product-1-1/__tests__/integration-harness";

const labels: Record<string, string> = {
  completed: "01 - Textos prontos", definitive: "02 - Falha definitiva",
  exhausted: "03 - Automaticas esgotadas", interrupted: "04 - Interrompida",
  "manual-limit": "05 - Limite manual", "wait-elapsed": "06 - Espera vencida",
  "manual-failed": "07 - Falha manual", active: "08 - Tentativa ativa",
  waiting: "09 - Contagem de espera",
};

async function main() {
  if (process.env.B21_VISUAL_PREFLIGHT !== "vendeo-f562a-isolated:56321:56322") {
    throw new Error("Run isolated preflight and supply its local environment first");
  }
  const requested = process.argv[2] ?? "static";
  // Human UAT may use a longer observation window in this fixture only.
  // This does not change runtime COPY_RECOVERY_WAITS_MS (5s/10s).
  const visualWaitMs = requested === "waiting" && process.argv[3] === "30" ? 30000 : 5000;
  const cases = requested === "static"
    ? ["completed", "definitive", "exhausted", "interrupted", "manual-limit", "wait-elapsed", "manual-failed"]
    : [requested];
  if (cases.some((key) => !labels[key])) throw new Error("Unknown UAT scenario");
  const ctx = await createIsolatedContext();
  try {
    const owners = await ctx.pg.query<{ id: string; user_id: string; is_test_store: boolean }>(
      "SELECT s.id,s.user_id,s.is_test_store FROM public.stores s JOIN auth.users u ON u.id=s.user_id WHERE u.email=$1 AND s.name=$2",
      ["uat.b21@vendeo.local", "UAT B2.1 Loja"],
    );
    if (owners.rows.length !== 1 || owners.rows[0].is_test_store !== true) {
      throw new Error("Expected exactly one dedicated local UAT test store");
    }
    const storeId = owners.rows[0].id;
    const flags = await ctx.pg.query<{ key: string; enabled: boolean }>(
      "SELECT key,enabled FROM public.feature_flags WHERE key IN ('product_1_1_test_stores_enabled','product_1_1_all_stores_enabled') ORDER BY key",
    );
    if (flags.rows.length !== 2 || flags.rows.some((r) => r.enabled !== false)) {
      throw new Error("Product must remain OFF");
    }
    const bucket = await ctx.supabase.storage.getBucket("campaign-images");
    if (bucket.error || !bucket.data || bucket.data.public) throw new Error("Private local bucket required");
    // Synthetic credits ONLY for this dedicated UAT store. Do not replace balances.
    const balance = await ctx.pg.query<{ balance: number }>(
      "SELECT balance FROM public.credit_balances WHERE store_id=$1", [storeId],
    );
    const initialBalance = Number(balance.rows[0]?.balance ?? 0);
    if (initialBalance < cases.length) {
      const topUp = cases.length - initialBalance;
      await ctx.pg.query(
        `INSERT INTO public.credit_balances(store_id,balance,bonus_balance,purchased_balance)
         VALUES($1,$2,$2,0) ON CONFLICT(store_id) DO UPDATE
         SET balance=credit_balances.balance+EXCLUDED.balance,
             bonus_balance=credit_balances.bonus_balance+EXCLUDED.bonus_balance`,
        [storeId, topUp],
      );
    }
    const image = await sharp(Buffer.from(
      '<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="#0b1d14"/><rect x="70" y="70" width="884" height="884" rx="32" fill="#163c28" stroke="#72efab" stroke-width="5"/><text x="512" y="420" text-anchor="middle" font-family="sans-serif" font-size="76" fill="white">CAMPANHA TESTE</text><text x="512" y="535" text-anchor="middle" font-family="sans-serif" font-size="46" fill="#72efab">UAT B2.1 - SOMENTE LOCAL</text><text x="512" y="640" text-anchor="middle" font-family="sans-serif" font-size="38" fill="white">Imagem simulada - nao publicar</text></svg>',
    )).jpeg({ quality: 90 }).toBuffer();
    const results = [];
    for (const key of cases) {
      const campaignId = await createCampaign(ctx.supabase, storeId, `UAT B2.1 ${labels[key]}`);
      const operationId = randomUUID();
      await ctx.pg.query("UPDATE public.campaigns SET input_snapshot=$2::jsonb WHERE id=$1 AND store_id=$3", [
        campaignId, JSON.stringify({ frozenContentReferences: [], product: { name: "Produto de teste UAT" }, commercial: { intent: "offer" } }), storeId,
      ]);
      const reservation = await reserveCredit(ctx.pg, storeId, campaignId, operationId);
      if (reservation.success !== true) throw new Error("Fixture reserve failed");
      const path = `${storeId}/${campaignId}/product-1-1/${operationId}/art-1024.jpg`;
      const upload = await ctx.supabase.storage.from("campaign-images").upload(path, image, { contentType: "image/jpeg", upsert: false });
      if (upload.error) throw new Error("Fixture artifact upload failed");
      for (const result of [await markArtUploaded(ctx.pg, campaignId, operationId), await deliverCredit(ctx.pg, campaignId, operationId)]) {
        if (result.success !== true) throw new Error("Fixture credit transition failed");
      }
      const modes = key === "manual-limit" ? ["auto", "auto", "auto", "manual", "manual", "manual"]
        : key === "manual-failed" ? ["auto", "manual"] : key === "exhausted" ? ["auto", "auto", "auto"] : ["auto"];
      for (let i = 0; i < modes.length; i++) {
        const acquired = await pgCallJson(ctx.pg,
          "SELECT public.product_1_1_acquire_copy_attempt($1::uuid,$2::uuid,$3::text,$4::uuid) AS r",
          [campaignId, operationId, modes[i], randomUUID()],
        );
        if (acquired.acquired !== true) throw new Error(`Fixture acquisition failed: ${String(acquired.reason)}`);
        if (key === "active") continue;
        if (key === "interrupted") {
          await ctx.pg.query("UPDATE public.product_1_1_copy_state SET lease_at=now()-interval '2 minutes' WHERE campaign_id=$1 AND operation_id=$2 AND state='pending'", [campaignId, operationId]);
          continue;
        }
        const done = key === "completed";
        const payload = {
          ...(done ? { title: "Oferta de teste", caption: "Legenda pronta para publicar. Exemplo local de validacao dos textos da campanha.", hashtags: ["#TesteLocal", "#Vendeo"], cta_post: "Confira a oferta na nossa loja!" } : {}),
          recovery: { kind: modes[i], failureClass: key === "definitive" ? "definitive" : "transient", nextWaitMs: key === "waiting" ? visualWaitMs : 0 },
        };
        const applied = await pgCallJson(ctx.pg,
          "SELECT public.product_1_1_apply_copy_state($1::uuid,$2::uuid,$3::text,$4::integer,$5::uuid,$6::text,$7::jsonb) AS r",
          [campaignId, operationId, done ? "completed" : "failed", acquired.attempt_seq, acquired.attempt_token, done ? payload.caption : null, JSON.stringify(payload)],
        );
        if (applied.applied !== true) throw new Error("Fixture state persistence failed");
      }
      results.push({ scenario: key, campaignId, operationId, ...(key === "waiting" ? { visualWaitMs } : {}), url: `http://localhost:3000/campanhas/${campaignId}` });
    }
    const flagsAfter = await ctx.pg.query("SELECT key,enabled FROM public.feature_flags WHERE key IN ('product_1_1_test_stores_enabled','product_1_1_all_stores_enabled') ORDER BY key");
    if (JSON.stringify(flagsAfter.rows) !== JSON.stringify(flags.rows)) throw new Error("Flag drift detected");
    console.log(JSON.stringify({ localOnly: true, storeId, initialSyntheticBalance: initialBalance, providerCalls: 0, scenarios: results }, null, 2));
  } finally { await closeIsolatedContext(ctx); }
}
main().catch(() => { console.error("visual_uat_fixture_failed; no rollback or cleanup performed; inspect dedicated local UAT fixtures before retry"); process.exitCode = 1; });
