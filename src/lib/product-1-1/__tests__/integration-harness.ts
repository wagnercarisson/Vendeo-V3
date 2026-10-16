import { randomUUID } from "node:crypto";
import { Client as PgClient } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

/**
 * F56.2b1b — Plano 09: harness compartilhado das suítes de integração REAIS.
 *
 * Provider SEMPRE simulado (zero chamada paga); Postgres/Storage LOCAIS reais na
 * instância descartável isolada. Nenhuma suíte faz `db push`/reset/deploy nem
 * habilita loja/provider. O harness NÃO é um arquivo de teste (não casa com o
 * padrão de coleta do vitest).
 */

export const LOCAL_API_URL = "http://127.0.0.1:56321";
export const LOCAL_DB_PORT = 56322;
export const CREDIT_BUCKET = "campaign-images";

export interface IsolatedEnv {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly databaseUrl: string;
}

export interface IsolatedContext {
  readonly env: IsolatedEnv;
  readonly supabase: SupabaseClient;
  readonly pg: PgClient;
  readonly pg2: PgClient;
}

export function requireIsolatedEnv(): IsolatedEnv {
  const url = process.env.F562A_ISOLATED_SUPABASE_URL;
  const serviceRoleKey = process.env.F562A_ISOLATED_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.F562A_ISOLATED_DATABASE_URL;

  if (!url || !serviceRoleKey || !databaseUrl) {
    throw new Error("isolated_integration_requires_runner_and_redacted_preflight");
  }
  if (url !== LOCAL_API_URL) throw new Error("isolated_integration_api_url_mismatch");
  const parsed = new URL(databaseUrl);
  if (
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.port !== String(LOCAL_DB_PORT)
  ) {
    throw new Error("isolated_integration_database_url_mismatch");
  }
  return { url, serviceRoleKey, databaseUrl };
}

export async function createIsolatedContext(): Promise<IsolatedContext> {
  const env = requireIsolatedEnv();
  const supabase = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pg = new PgClient({ connectionString: env.databaseUrl, ssl: false });
  await pg.connect();
  const pg2 = new PgClient({ connectionString: env.databaseUrl, ssl: false });
  await pg2.connect();
  return { env, supabase, pg, pg2 };
}

export async function closeIsolatedContext(ctx: Partial<IsolatedContext>): Promise<void> {
  if (ctx.pg) await ctx.pg.end().catch(() => undefined);
  if (ctx.pg2) await ctx.pg2.end().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export async function createAuthUser(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: `f56-2b1b-${randomUUID()}@example.invalid`,
    password: randomUUID(),
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`fixture_auth_failed:${error?.message}`);
  return data.user.id;
}

export interface FixtureStore {
  readonly storeId: string;
  readonly userId: string;
}

export async function createTestStore(
  supabase: SupabaseClient,
  name = `F56.2b1b ${randomUUID().slice(0, 8)}`,
): Promise<FixtureStore> {
  const userId = await createAuthUser(supabase);
  const { data, error } = await supabase
    .from("stores")
    .insert({ user_id: userId, name, segment: "outros", is_test_store: true })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`fixture_store_failed:${error?.message}`);
  return { storeId: data.id, userId };
}

export async function createCampaign(
  supabase: SupabaseClient,
  storeId: string,
  productName = `F56.2b1b campaign ${randomUUID().slice(0, 8)}`,
): Promise<string> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      store_id: storeId,
      status: "ready",
      product_name: productName,
      storage_path: `f56-2b1b-isolated/${randomUUID()}.png`,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`fixture_campaign_failed:${error?.message}`);
  return data.id;
}

export async function setCredits(pg: PgClient, storeId: string, bonus: number): Promise<void> {
  await pg.query(
    `INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
     VALUES ($1, $2, $2, 0)
     ON CONFLICT (store_id) DO UPDATE SET bonus_balance = EXCLUDED.bonus_balance, balance = EXCLUDED.balance`,
    [storeId, bonus],
  );
}

export async function availableCredits(pg: PgClient, storeId: string): Promise<number> {
  const { rows } = await pg.query<{ bonus_balance: number; purchased_balance: number }>(
    "SELECT bonus_balance, purchased_balance FROM public.credit_balances WHERE store_id = $1",
    [storeId],
  );
  const row = rows[0];
  return (row?.bonus_balance ?? 0) + (row?.purchased_balance ?? 0);
}

export async function deductionCount(pg: PgClient, storeId: string): Promise<number> {
  const { rows } = await pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.credit_transactions WHERE store_id = $1 AND type = 'deduction'",
    [storeId],
  );
  return rows[0].n;
}

// ---------------------------------------------------------------------------
// Raw RPC/fixture helpers (pg connects as the migration owner; bypasses RLS)
// ---------------------------------------------------------------------------

export async function pgCallJson<T = Record<string, unknown>>(
  client: PgClient,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const result = (await client.query(sql, params as never[])) as { rows: Array<{ r: T }> };
  return result.rows[0].r;
}

export async function pgRows<T>(
  client: PgClient,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = (await client.query(sql, params as never[])) as { rows: T[] };
  return result.rows;
}

export function reserveCredit(
  pg: PgClient,
  store: string,
  campaign: string,
  operation: string,
  amount = 1,
): Promise<Record<string, unknown>> {
  return pgCallJson(
    pg,
    "SELECT public.product_1_1_reserve_credit_operation($1, $2, $3, $4, '{}'::jsonb) AS r",
    [store, campaign, operation, amount],
  );
}

export async function markArtUploaded(
  pg: PgClient,
  campaign: string,
  operation: string,
): Promise<Record<string, unknown>> {
  // Recorte 1 (Plano 08): `mark` agora exige o TOKEN do dono. Anuncia a
  // publicação ANTES (fence) e usa o token resultante — assinatura preservada.
  await pgCallJson(pg, "SELECT public.product_1_1_begin_publication($1, $2) AS r", [
    campaign,
    operation,
  ]);
  const { rows } = await pg.query<{ publication_token: string | null }>(
    "SELECT publication_token FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1 AND operation_id = $2",
    [campaign, operation],
  );
  const token = rows[0]?.publication_token ?? null;
  if (!token) throw new Error("fixture_publication_token_missing");
  return pgCallJson(
    pg,
    "SELECT public.product_1_1_mark_campaign_credit_art_uploaded($1, $2, $3) AS r",
    [campaign, operation, token],
  );
}

export async function deliverCredit(
  pg: PgClient,
  campaign: string,
  operation: string,
): Promise<Record<string, unknown>> {
  const { rows } = await pg.query<{ publication_token: string | null }>(
    "SELECT publication_token FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1 AND operation_id = $2",
    [campaign, operation],
  );
  const token = rows[0]?.publication_token ?? null;
  return pgCallJson(
    pg,
    "SELECT public.product_1_1_deliver_campaign_credit_operation($1, $2, $3) AS r",
    [campaign, operation, token],
  );
}

export function refundCredit(
  pg: PgClient,
  campaign: string,
  operation: string,
  reason = "test",
): Promise<Record<string, unknown>> {
  return pgCallJson(
    pg,
    "SELECT public.product_1_1_refund_campaign_credit_operation($1, $2, $3) AS r",
    [campaign, operation, reason],
  );
}

export async function creditOperationRow(
  pg: PgClient,
  campaign: string,
  operation: string,
): Promise<{ status: string; amount: number; credit_tx_id: string | null; refund_tx_id: string | null } | null> {
  const rows = await pgRows<{
    status: string;
    amount: number;
    credit_tx_id: string | null;
    refund_tx_id: string | null;
  }>(
    pg,
    "SELECT status, amount, credit_tx_id, refund_tx_id FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1 AND operation_id = $2",
    [campaign, operation],
  );
  return rows[0] ?? null;
}

export async function attemptClaimRows(
  pg: PgClient,
  campaign: string,
  operation: string,
): Promise<Array<{ attempt_number: number; target: string; status: string }>> {
  return pgRows<{ attempt_number: number; target: string; status: string }>(
    pg,
    "SELECT attempt_number, target, status FROM public.product_1_1_generation_attempt_claims WHERE campaign_id = $1 AND operation_id = $2 ORDER BY attempt_number",
    [campaign, operation],
  );
}

export async function expectRejects(promise: Promise<unknown>, code: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  if (!(caught instanceof Error)) {
    throw new Error(`expected_rejection_missing:${code}`);
  }
  if (!caught.message.includes(code)) {
    throw new Error(`expected_rejection_code_${code}_got_${caught.message}`);
  }
}

// ---------------------------------------------------------------------------
// Images / NDJSON
// ---------------------------------------------------------------------------

/** PNG real (data URL) — entrada aceita por `dataUrlToCampaignImage`. */
export async function pngDataUrl(width = 1024, height = 1024): Promise<string> {
  const png = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 24, g: 160, b: 72 },
    },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export function jpegDataUrl(buffer: Buffer): string {
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

/** JPEG real 1:1 1024×1024 (via sharp) em data URL. */
export async function jpeg1024DataUrl(): Promise<string> {
  const jpeg = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 200, g: 60, b: 60 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  return jpegDataUrl(jpeg);
}

export async function readNdjson(response: Response): Promise<Record<string, unknown>[]> {
  const text = await response.text();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** Evento terminal de uma resposta NDJSON (o ÚLTIMO evento). */
export function terminalEvent(events: Record<string, unknown>[]): Record<string, unknown> {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "result" || event.type === "error" || event.type === "unknown") {
      return event;
    }
  }
  throw new Error("no_terminal_event");
}
