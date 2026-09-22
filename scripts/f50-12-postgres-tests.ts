import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
async function main() {
 await client.connect();
 try {
  const store = "00000000-0000-0000-0000-000000000051";
  const user = "00000000-0000-0000-0000-000000000052";
  await client.query("INSERT INTO auth.users (id, email, encrypted_password, aud, role) VALUES ($1, 'f50-pg-test@example.com', '', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING", [user]);
  await client.query("INSERT INTO public.stores (id, user_id, name, segment) VALUES ($1, $2, 'PG Test', 'outros') ON CONFLICT (id) DO NOTHING", [store, user]);
  await client.query("DELETE FROM public.credit_notifications WHERE store_id = $1", [store]);
  const inserted = await client.query(`INSERT INTO public.credit_notifications (store_id, kind, dedup_key, payload) VALUES ($1, 'support_ack', 'pg-test', '{"recipient_email":"test@example.com"}') RETURNING id`, [store]);
  const id = inserted.rows[0].id;
  const [one, two] = await Promise.all([
    client.query("SELECT * FROM public.claim_credit_notification(now(), now() + interval '5 minutes')"),
    client.query("SELECT * FROM public.claim_credit_notification(now(), now() + interval '5 minutes')"),
  ]);
  if (one.rows.length + two.rows.length !== 1) throw new Error("claim RPC allowed two workers to claim one row");
  await client.query("UPDATE public.credit_notifications SET email_status='processing', lease_expires_at=now()-interval '1 minute' WHERE id=$1", [id]);
  if ((await client.query("SELECT * FROM public.claim_credit_notification(now(), now() + interval '5 minutes')")).rows.length !== 1) throw new Error("expired lease was not reclaimed");
  await client.query("UPDATE public.credit_notifications SET email_status='pending', lease_expires_at=null, attempt_count=3 WHERE id=$1", [id]);
  if ((await client.query("SELECT * FROM public.claim_credit_notification(now(), now() + interval '5 minutes')")).rows.length !== 0) throw new Error("max-attempt row was claimable");
  await client.query("SET ROLE authenticated");
  await client.query("SELECT public.claim_credit_notification(now(), now())").then(() => { throw new Error("authenticated can execute claim RPC"); }).catch((error: { code?: string }) => { if (error.code !== "42501") throw error; });
  await client.query("RESET ROLE");
  console.log("F50-12 PostgreSQL claim tests: PASS");
 } finally { await client.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
