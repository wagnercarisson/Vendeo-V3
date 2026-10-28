import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * F57.2 — contrato de schema/RLS/grants/CAS das configurações multimercado.
 * Executa SOMENTE contra o stack Supabase descartável autorizado, identificado
 * por TEST_DATABASE_URL. Nunca cai em 127.0.0.1:54322 compartilhado.
 */
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "TEST_DATABASE_URL obrigatório: a suíte de banco só roda no stack descartável autorizado.",
  );
}

const pool = new Pool({ connectionString });
const users: string[] = [];
const stores: string[] = [];

const query = async <T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> => (await pool.query<T>(text, values)).rows;

const rpc = async <T = Record<string, unknown>>(
  fn: string,
  args: unknown[],
): Promise<T> => {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await query<{ result: T }>(
    `select public.${fn}(${placeholders}) as result`,
    args,
  );
  return rows[0].result;
};

async function actor(label: string): Promise<string> {
  const id = crypto.randomUUID();
  users.push(id);
  await query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, now(), now())",
    [id, `${label}-${id}@f57-2.test`],
  );
  return id;
}

async function storeFor(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  stores.push(id);
  await query(
    "insert into public.stores (id, user_id, name, segment) values ($1, $2, 'Loja 57.2', 'outros')",
    [id, userId],
  );
  return id;
}

async function tokenFor(userId: string): Promise<void> {
  await query(
    "select set_config('request.jwt.claims', $1, true)",
    [JSON.stringify({ sub: userId, role: "authenticated" })],
  );
}

beforeAll(async () => {
  const rows = await query<{ ok: boolean }>(
    "select to_regclass('auth.users') is not null as ok",
  );
  if (!rows[0]?.ok) {
    throw new Error("TEST_DATABASE_URL não aponta para um Supabase real (auth.users ausente).");
  }
});

afterEach(async () => {
  await query("rollback").catch(() => undefined);
});

afterAll(async () => {
  await query("begin");
  await query("set local session_replication_role = replica");
  for (const storeId of stores.splice(0)) {
    await query("delete from public.store_market_settings where store_id = $1", [storeId]);
    await query("delete from public.stores where id = $1", [storeId]);
  }
  for (const userId of users.splice(0)) {
    await query("delete from public.user_preferences where user_id = $1", [userId]);
    await query("delete from auth.users where id = $1", [userId]);
  }
  await query("commit");
  await pool.end();
});

describe("F57.2 schema e constraints", () => {
  it("1. tabelas, colunas de versão e colunas de proveniência existem", async () => {
    const cols = await query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and table_name in ('user_preferences', 'store_market_settings')`,
    );
    const keys = new Set(cols.map((row) => `${row.table_name}.${row.column_name}`));
    for (const expected of [
      "user_preferences.ui_locale",
      "user_preferences.ui_locale_source",
      "user_preferences.version",
      "store_market_settings.country_code",
      "store_market_settings.country_source",
      "store_market_settings.default_campaign_market_source",
      "store_market_settings.default_content_locale_source",
      "store_market_settings.default_currency_source",
      "store_market_settings.time_zone_source",
      "store_market_settings.context_version",
      "store_market_settings.settings_version",
    ]) {
      expect(keys.has(expected)).toBe(true);
    }
  });

  it("2. CHECKs rejeitam valores fora do contrato", async () => {
    const userId = await actor("checks");
    const storeId = await storeFor(userId);
    const insert = (patch: Record<string, string>) =>
      query(
        `insert into public.store_market_settings
          (store_id, country_code, default_campaign_market, default_campaign_market_source,
           default_content_locale, default_content_locale_source,
           default_currency, default_currency_source, time_zone, time_zone_source)
         values ($1, $2, 'BR', 'default', $3, 'default', $4, 'default', $5, 'default')`,
        [storeId, patch.country ?? "BR", patch.locale ?? "pt-BR", patch.currency ?? "BRL", patch.timeZone ?? "America/Sao_Paulo"],
      );

    await expect(insert({ currency: "USD" })).rejects.toThrow();
    await expect(insert({ locale: "es-AR" })).rejects.toThrow();
    await expect(insert({ timeZone: "UTC" })).rejects.toThrow();
    await expect(insert({ country: "AR" })).rejects.toThrow();
    await expect(
      query(
        "insert into public.store_market_settings (store_id, country_code, country_source, default_campaign_market, default_campaign_market_source, default_content_locale, default_content_locale_source, default_currency, default_currency_source, time_zone, time_zone_source, context_version) values ($1,'BR','assumed_default','BR','default','pt-BR','default','BRL','default','America/Sao_Paulo','default',2)",
        [storeId],
      ),
    ).rejects.toThrow();
  });
});

describe("F57.2 grants e RLS", () => {
  it("3. EXECUTE das três funções é negado a authenticated e permitido a service_role", async () => {
    for (const fn of [
      "ensure_store_market_settings(uuid,text,text)",
      "write_store_market_settings(uuid,text,text,text,text,text,text,text,text,text,text,integer,bigint)",
      "write_user_locale_preference(uuid,text,bigint)",
    ]) {
      const rows = await query<{ authenticated: boolean; service: boolean }>(
        `select has_function_privilege('authenticated', $1, 'EXECUTE') as authenticated,
                has_function_privilege('service_role', $1, 'EXECUTE') as service`,
        [fn],
      );
      expect(rows[0].authenticated).toBe(false);
      expect(rows[0].service).toBe(true);
    }
  });

  it("4. authenticated lê apenas o próprio e não escreve diretamente", async () => {
    const userA = await actor("rls-a");
    const userB = await actor("rls-b");
    const storeA = await storeFor(userA);
    const storeB = await storeFor(userB);
    await query(
      "insert into public.user_preferences (user_id, ui_locale, ui_locale_source) values ($1, 'pt-BR', 'explicit'), ($2, 'es-PY', 'explicit')",
      [userA, userB],
    );
    await query(
      "select public.ensure_store_market_settings($1, 'BR', 'assumed_default')",
      [storeA],
    );
    await query(
      "select public.ensure_store_market_settings($1, 'BR', 'assumed_default')",
      [storeB],
    );

    await query("begin");
    await query("set local role authenticated");
    await tokenFor(userA);
    const prefs = await query<{ user_id: string }>(
      "select user_id from public.user_preferences",
    );
    const settings = await query<{ store_id: string }>(
      "select store_id from public.store_market_settings",
    );
    expect(prefs.map((row) => row.user_id)).toEqual([userA]);
    expect(settings.map((row) => row.store_id)).toEqual([storeA]);

    await expect(
      query("insert into public.user_preferences (user_id) values ($1)", [userA]),
    ).rejects.toThrow();
    await expect(
      query("update public.user_preferences set ui_locale = 'es-PY' where user_id = $1", [userA]),
    ).rejects.toThrow();
    await expect(
      query("delete from public.user_preferences where user_id = $1", [userA]),
    ).rejects.toThrow();
    await expect(
      query("update public.store_market_settings set default_currency = 'PYG' where store_id = $1", [storeA]),
    ).rejects.toThrow();
    await query("rollback");
  });
});

describe("F57.2 RPCs base", () => {
  it("5. ensure é idempotente, grava v1 e defaults BR", async () => {
    const userId = await actor("ensure");
    const storeId = await storeFor(userId);
    await query("select public.ensure_store_market_settings($1, 'BR', 'assumed_default')", [storeId]);
    await query("select public.ensure_store_market_settings($1, 'BR', 'fiscal_confirmation')", [storeId]);

    const rows = await query<{
      country_source: string;
      default_campaign_market: string;
      default_content_locale: string;
      default_currency: string;
      time_zone: string;
      settings_version: number;
      total: number;
    }>(
      `select country_source, default_campaign_market, default_content_locale,
              default_currency, time_zone, settings_version::int,
              count(*) over ()::int as total
         from public.store_market_settings where store_id = $1`,
      [storeId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      country_source: "assumed_default",
      default_campaign_market: "BR",
      default_content_locale: "pt-BR",
      default_currency: "BRL",
      time_zone: "America/Sao_Paulo",
      settings_version: 1,
    });
  });

  it("6. write_user_locale_preference tem 3 parâmetros, CAS e fonte derivada", async () => {
    const userId = await actor("pref");
    const first = await rpc<{ version: number; ui_locale: string | null; ui_locale_source: string }>(
      "write_user_locale_preference",
      [userId, "es-PY", 0],
    );
    expect(first).toMatchObject({ version: 1, ui_locale: "es-PY", ui_locale_source: "explicit" });

    await expect(
      rpc("write_user_locale_preference", [userId, "pt-BR", 0]),
    ).rejects.toThrow(/preferences_version_conflict/);

    const cleared = await rpc<{ version: number; ui_locale: string | null; ui_locale_source: string }>(
      "write_user_locale_preference",
      [userId, null, 1],
    );
    expect(cleared).toMatchObject({ version: 2, ui_locale: null, ui_locale_source: "legacy_br" });
  });

  it("7. write_store_market_settings preserva país/proveniência e exige legacy_br na inserção", async () => {
    const userId = await actor("store-write");
    const storeId = await storeFor(userId);
    await query("select public.ensure_store_market_settings($1, 'BR', 'legacy_br')", [storeId]);

    const baseArgs = [
      "PY", "explicit", "es-PY", "default", "PYG", "default",
      "America/Asuncion", "default", "BR",
    ] as const;

    await expect(
      rpc("write_store_market_settings", [
        storeId, ...baseArgs, "fiscal_confirmation", 1, 1,
      ]),
    ).resolves.toMatchObject({ country_code: "BR", country_source: "legacy_br", settings_version: 2 });

    const otherStore = await storeFor(userId);
    await expect(
      rpc("write_store_market_settings", [
        otherStore, ...baseArgs, "fiscal_confirmation", 1, 0,
      ]),
    ).rejects.toThrow(/country_not_mutable/);
  });

  it("8. primeira escrita concorrente: uma cria v1, a outra conflita", async () => {
    const userId = await actor("race");
    const storeId = await storeFor(userId);
    const args = [
      storeId, "BR", "explicit", "pt-BR", "default", "BRL", "default",
      "America/Sao_Paulo", "default", "BR", "legacy_br", 1, 0,
    ];
    const results = await Promise.allSettled([
      rpc("write_store_market_settings", args),
      rpc("write_store_market_settings", args),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/settings_version_conflict/);

    const prefUser = await actor("race-pref");
    const prefResults = await Promise.allSettled([
      rpc("write_user_locale_preference", [prefUser, "es-PY", 0]),
      rpc("write_user_locale_preference", [prefUser, "pt-BR", 0]),
    ]);
    expect(prefResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const prefRejected = prefResults.filter((result) => result.status === "rejected");
    expect(prefRejected).toHaveLength(1);
    expect(String((prefRejected[0] as PromiseRejectedResult).reason)).toMatch(
      /preferences_version_conflict/,
    );
  });

  it("9. ensure revertido não deixa linha", async () => {
    const userId = await actor("rollback");
    const storeId = await storeFor(userId);
    await query("begin");
    await query("select public.ensure_store_market_settings($1, 'BR', 'assumed_default')", [storeId]);
    await query("rollback");
    const rows = await query("select 1 from public.store_market_settings where store_id = $1", [storeId]);
    expect(rows).toHaveLength(0);
  });
});
