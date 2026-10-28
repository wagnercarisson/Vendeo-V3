import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * F57.2 — contrato de schema/RLS/grants/CAS no HOMOLOG EXISTENTE.
 *
 * Alvo único e permitido: vendeo-homolog em 127.0.0.1:57782 (banco postgres).
 * Nenhum ambiente é criado/destruído. A identidade é conferida por fingerprint
 * do ledger (excluindo versões F57.2), capturado antes da aplicação.
 */
const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) {
  throw new Error("TEST_DATABASE_URL obrigatório (homolog 127.0.0.1:57782/postgres)");
}

function parseTarget(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL inválida");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL deve usar postgresql://");
  }
  if (url.hostname !== "127.0.0.1" || url.port !== "57782") {
    throw new Error(`Destino recusado: esperado 127.0.0.1:57782, recebido ${url.host}`);
  }
  if (url.pathname !== "/postgres") {
    throw new Error(`Destino recusado: banco deve ser postgres, recebido ${url.pathname}`);
  }
  return url;
}

const target = parseTarget(rawUrl);
const expectedLedgerCount = Number(process.env.F57_2_EXPECTED_LEDGER_COUNT ?? "");
const expectedLedgerHash = (process.env.F57_2_EXPECTED_LEDGER_SHA256 ?? "").trim();

const pool = new Pool({ connectionString: target.toString(), ssl: false });
const runId = `f572test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUsers: string[] = [];
const createdStores: string[] = [];

type Row = Record<string, unknown>;

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const result = await fn(client);
      await client.query("rollback");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

async function query<T = Row>(text: string, values: unknown[] = []): Promise<T[]> {
  return withClient(async (client) => (await client.query<T>(text, values)).rows);
}

async function rpcCall<T = Row>(fn: string, args: unknown[]): Promise<T> {
  return withClient(async (client) => {
    const placeholders = args.map((_, index) => `$${index + 1}`).join(", ");
    const result = await client.query<{ result: T }>(
      `select public.${fn}(${placeholders}) as result`,
      args,
    );
    return result.rows[0].result;
  });
}

async function expectSqlState(
  client: PoolClient,
  sql: string,
  values: unknown[],
  code: string,
): Promise<void> {
  await client.query("savepoint denied");
  try {
    await client.query(sql, values);
    throw new Error(`esperava SQLSTATE ${code}, mas a operação passou`);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    expect((error as { code?: string }).code).toBe(code);
  } finally {
    await client.query("rollback to savepoint denied");
  }
}

async function actor(label: string): Promise<string> {
  const id = crypto.randomUUID();
  createdUsers.push(id);
  await query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, now(), now())",
    [id, `${label}-${runId}-${id}@f57-2.test`],
  );
  return id;
}

async function storeFor(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  createdStores.push(id);
  await query(
    "insert into public.stores (id, user_id, name, segment) values ($1, $2, $3, 'outros')",
    [id, userId, `Loja ${runId}`],
  );
  return id;
}

async function setJwt(client: PoolClient, userId: string): Promise<void> {
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
}

function ledgerFingerprint(rows: Array<{ version: string; name: string | null }>): {
  count: number;
  sha256: string;
} {
  const stable = rows
    .filter((row) => !String(row.name ?? "").includes("f57_2_"))
    .map((row) => `${row.version}|${row.name ?? ""}`)
    .sort();
  return {
    count: stable.length,
    sha256: createHash("sha256").update(stable.join("\n")).digest("hex"),
  };
}

beforeAll(async () => {
  if (!Number.isInteger(expectedLedgerCount) || expectedLedgerCount < 149) {
    throw new Error("F57_2_EXPECTED_LEDGER_COUNT ausente/inválido; capture o baseline antes de testar");
  }
  if (!/^[0-9a-f]{64}$/.test(expectedLedgerHash)) {
    throw new Error("F57_2_EXPECTED_LEDGER_SHA256 ausente/inválido");
  }

  const identity = await query<{ db: string; auth: boolean }>(
    "select current_database() as db, to_regclass('auth.users') is not null as auth",
  );
  if (identity[0]?.db !== "postgres" || identity[0]?.auth !== true) {
    throw new Error("Alvo não é o homolog esperado (banco/auth divergentes)");
  }

  const ledger = await query<{ version: string; name: string | null }>(
    "select version, name from supabase_migrations.schema_migrations order by version",
  );
  const fingerprint = ledgerFingerprint(ledger);
  if (fingerprint.count !== expectedLedgerCount || fingerprint.sha256 !== expectedLedgerHash) {
    throw new Error(
      `Fingerprint do ledger divergiu do baseline do homolog (count=${fingerprint.count}, sha=${fingerprint.sha256})`,
    );
  }
});

afterAll(async () => {
  await withClient(async (client) => {
    await client.query("begin");
    try {
      for (const storeId of createdStores.splice(0)) {
        await client.query("delete from public.store_market_settings where store_id = $1", [storeId]);
        await client.query("delete from public.stores where id = $1", [storeId]);
      }
      for (const userId of createdUsers.splice(0)) {
        await client.query("delete from public.user_preferences where user_id = $1", [userId]);
        await client.query("delete from auth.users where id = $1", [userId]);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
  await pool.end();
});

describe("F57.2 schema, checks e grants", () => {
  it("1. tabelas, colunas de versão e proveniência existem", async () => {
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

  it("2. CHECKs de valores, fontes e coerência rejeitam o que é inválido", async () => {
    const userId = await actor("checks");
    const storeId = await storeFor(userId);
    const insertStore = (patch: Record<string, string>) =>
      `insert into public.store_market_settings
        (store_id, country_code, country_source, default_campaign_market,
         default_campaign_market_source, default_content_locale,
         default_content_locale_source, default_currency,
         default_currency_source, time_zone, time_zone_source, context_version)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;
    const good = {
      country: "BR",
      countrySource: "assumed_default",
      market: "BR",
      marketSource: "default",
      locale: "pt-BR",
      localeSource: "default",
      currency: "BRL",
      currencySource: "default",
      timeZone: "America/Sao_Paulo",
      timeZoneSource: "default",
      contextVersion: "1",
    };
    const values = (patch: Record<string, string>) => {
      const merged = { ...good, ...patch };
      return [
        storeId, merged.country, merged.countrySource, merged.market, merged.marketSource,
        merged.locale, merged.localeSource, merged.currency, merged.currencySource,
        merged.timeZone, merged.timeZoneSource, Number(merged.contextVersion),
      ];
    };

    await withClient(async (client) => {
      await client.query("begin");
      await expectSqlState(client, insertStore({}), values({ currency: "USD" }), "23514");
      await expectSqlState(client, insertStore({}), values({ locale: "es-AR" }), "23514");
      await expectSqlState(client, insertStore({}), values({ timeZone: "UTC" }), "23514");
      await expectSqlState(client, insertStore({}), values({ country: "AR" }), "23514");
      await expectSqlState(client, insertStore({}), values({ countrySource: "fiscal" }), "23514");
      await expectSqlState(client, insertStore({}), values({ marketSource: "inferido" }), "23514");
      await expectSqlState(client, insertStore({}), values({ contextVersion: "2" }), "23514");
      await client.query("rollback");
    });

    await withClient(async (client) => {
      await client.query("begin");
      await expectSqlState(
        client,
        "insert into public.user_preferences (user_id, ui_locale, ui_locale_source) values ($1,'pt-BR','legacy_br')",
        [userId],
        "23514",
      );
      await expectSqlState(
        client,
        "insert into public.user_preferences (user_id, ui_locale, ui_locale_source) values ($1,NULL,'explicit')",
        [userId],
        "23514",
      );
      await client.query("rollback");
    });
  });

  it("3. EXECUTE é negado a anon/authenticated e permitido a service_role", async () => {
    const signatures = [
      "ensure_store_market_settings(uuid,text,text)",
      "write_store_market_settings(uuid,text,text,text,text,text,text,text,text,text,text,integer,bigint)",
      "write_user_locale_preference(uuid,text,bigint)",
    ];
    for (const signature of signatures) {
      const rows = await query<{ authd: boolean; anonymous: boolean; service: boolean }>(
        `select has_function_privilege('authenticated', $1, 'EXECUTE') as authd,
                has_function_privilege('anon', $1, 'EXECUTE') as anonymous,
                has_function_privilege('service_role', $1, 'EXECUTE') as service`,
        [signature],
      );
      expect(rows[0]).toMatchObject({ authd: false, anonymous: false, service: true });
    }

    await withClient(async (client) => {
      await client.query("begin");
      await client.query("set local role authenticated");
      await setJwt(client, createdUsers[0] ?? crypto.randomUUID());
      await expectSqlState(
        client,
        "select public.ensure_store_market_settings($1,'BR','assumed_default')",
        [createdStores[0] ?? crypto.randomUUID()],
        "42501",
      );
      await client.query("rollback");
    });

    await withClient(async (client) => {
      await client.query("begin");
      await client.query("set local role anon");
      await expectSqlState(
        client,
        "select public.write_user_locale_preference($1::uuid,'pt-BR',0)",
        [crypto.randomUUID()],
        "42501",
      );
      await client.query("rollback");
    });
  });
});

describe("F57.2 RLS e isolamento", () => {
  it("4. authenticated lê apenas o próprio; INSERT/UPDATE/DELETE nas duas tabelas são negados", async () => {
    const userA = await actor("rls-a");
    const userB = await actor("rls-b");
    const storeA = await storeFor(userA);
    const storeB = await storeFor(userB);
    await query(
      "insert into public.user_preferences (user_id, ui_locale, ui_locale_source) values ($1,'pt-BR','explicit'), ($2,'es-PY','explicit')",
      [userA, userB],
    );
    await query("select public.ensure_store_market_settings($1,'BR','assumed_default')", [storeA]);
    await query("select public.ensure_store_market_settings($1,'BR','assumed_default')", [storeB]);

    await inTransaction(async (client) => {
      await client.query("set local role authenticated");
      await setJwt(client, userA);
      const prefs = await client.query<{ user_id: string }>("select user_id from public.user_preferences");
      const settings = await client.query<{ store_id: string }>("select store_id from public.store_market_settings");
      expect(prefs.rows.map((row) => row.user_id)).toEqual([userA]);
      expect(settings.rows.map((row) => row.store_id)).toEqual([storeA]);
    });

    await inTransaction(async (client) => {
      await client.query("set local role authenticated");
      await setJwt(client, userB);
      const prefsB = await client.query<{ user_id: string }>("select user_id from public.user_preferences");
      const settingsB = await client.query<{ store_id: string }>("select store_id from public.store_market_settings");
      expect(prefsB.rows.map((row) => row.user_id)).toEqual([userB]);
      expect(settingsB.rows.map((row) => row.store_id)).toEqual([storeB]);
    });

    await withClient(async (client) => {
      await client.query("begin");
      await client.query("set local role authenticated");
      await setJwt(client, userA);
      await expectSqlState(
        client,
        "insert into public.user_preferences (user_id) values ($1)",
        [userA],
        "42501",
      );
      await expectSqlState(
        client,
        "update public.user_preferences set ui_locale = 'es-PY' where user_id = $1",
        [userA],
        "42501",
      );
      await expectSqlState(
        client,
        "delete from public.user_preferences where user_id = $1",
        [userA],
        "42501",
      );
      await expectSqlState(
        client,
        "insert into public.store_market_settings (store_id, default_campaign_market, default_campaign_market_source, default_content_locale, default_content_locale_source, default_currency, default_currency_source, time_zone, time_zone_source) values ($1,'BR','default','pt-BR','default','BRL','default','America/Sao_Paulo','default')",
        [storeA],
        "42501",
      );
      await expectSqlState(
        client,
        "update public.store_market_settings set default_currency = 'PYG' where store_id = $1",
        [storeA],
        "42501",
      );
      await expectSqlState(
        client,
        "delete from public.store_market_settings where store_id = $1",
        [storeA],
        "42501",
      );
      await client.query("rollback");
    });
  });
});

describe("F57.2 RPCs: idempotência, CAS e proveniência", () => {
  it("5. ensure é idempotente e grava defaults BR em v1", async () => {
    const userId = await actor("ensure");
    const storeId = await storeFor(userId);
    await query("select public.ensure_store_market_settings($1,'BR','assumed_default')", [storeId]);
    await query("select public.ensure_store_market_settings($1,'BR','fiscal_confirmation')", [storeId]);
    const rows = await query<Row>(
      `select country_source, default_campaign_market, default_content_locale,
              default_currency, time_zone, settings_version::int
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

  it("6. preferência de usuário: 3 params, CAS, limpeza e conflito com versão real 0", async () => {
    const userId = await actor("pref");
    const first = await rpcCall<Row>("write_user_locale_preference", [userId, "es-PY", 0]);
    expect(first).toMatchObject({ version: 1, ui_locale: "es-PY", ui_locale_source: "explicit" });

    await expect(rpcCall("write_user_locale_preference", [userId, "pt-BR", 0])).rejects.toThrow(
      /preferences_version_conflict/,
    );

    const cleared = await rpcCall<Row>("write_user_locale_preference", [userId, null, 1]);
    expect(cleared).toMatchObject({ version: 2, ui_locale: null, ui_locale_source: "legacy_br" });

    const noRowUser = await actor("pref-version-zero");
    await expect(
      rpcCall("write_user_locale_preference", [noRowUser, "pt-BR", 3]),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/preferences_version_conflict/),
      hint: "0",
    });
    const residue = await query("select 1 from public.user_preferences where user_id = $1", [noRowUser]);
    expect(residue).toHaveLength(0);
  });

  it("7. loja: país imutável, country_source preservado e inserção só legacy_br", async () => {
    const userId = await actor("store-write");
    const storeId = await storeFor(userId);
    await query("select public.ensure_store_market_settings($1,'BR','legacy_br')", [storeId]);

    const baseArgs = [
      "PY", "explicit", "es-PY", "default", "PYG", "default",
      "America/Asuncion", "default", "BR",
    ] as const;

    const updated = await rpcCall<Row>("write_store_market_settings", [
      storeId, ...baseArgs, "fiscal_confirmation", 1, 1,
    ]);
    expect(updated).toMatchObject({
      country_code: "BR",
      country_source: "legacy_br",
      settings_version: 2,
    });

    const before = await query<Row>(
      "select settings_version::int from public.store_market_settings where store_id = $1",
      [storeId],
    );
    await expect(
      rpcCall("write_store_market_settings", [storeId, ...baseArgs, "legacy_br", 1, 1]),
    ).rejects.toThrow(/settings_version_conflict/);
    const after = await query<Row>(
      "select settings_version::int from public.store_market_settings where store_id = $1",
      [storeId],
    );
    expect(after[0].settings_version).toBe(before[0].settings_version);

    const otherUser = await actor("store-write-other");
    const otherStore = await storeFor(otherUser);
    await expect(
      rpcCall("write_store_market_settings", [otherStore, ...baseArgs, "fiscal_confirmation", 1, 0]),
    ).rejects.toThrow(/country_not_mutable/);
    const none = await query("select 1 from public.store_market_settings where store_id = $1", [otherStore]);
    expect(none).toHaveLength(0);

    const noRowStore = await storeFor(await actor("store-version-zero"));
    await expect(
      rpcCall("write_store_market_settings", [noRowStore, ...baseArgs, "legacy_br", 1, 4]),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/settings_version_conflict/),
      hint: "0",
    });
    const noRow = await query("select 1 from public.store_market_settings where store_id = $1", [noRowStore]);
    expect(noRow).toHaveLength(0);
  });

  it("8. primeira escrita concorrente usa conexões independentes (loja e usuário)", async () => {
    const userId = await actor("race");
    const storeId = await storeFor(userId);
    const args = [
      storeId, "BR", "explicit", "pt-BR", "default", "BRL", "default",
      "America/Sao_Paulo", "default", "BR", "legacy_br", 1, 0,
    ];
    const results = await Promise.allSettled([
      rpcCall("write_store_market_settings", args),
      rpcCall("write_store_market_settings", args),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/settings_version_conflict/);

    const prefUser = await actor("race-pref");
    const prefResults = await Promise.allSettled([
      rpcCall("write_user_locale_preference", [prefUser, "es-PY", 0]),
      rpcCall("write_user_locale_preference", [prefUser, "pt-BR", 0]),
    ]);
    expect(prefResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const prefRejected = prefResults.filter((result) => result.status === "rejected");
    expect(prefRejected).toHaveLength(1);
    expect(String((prefRejected[0] as PromiseRejectedResult).reason)).toMatch(
      /preferences_version_conflict/,
    );
  });

  it("9. rollback de ensure/RPC não deixa resíduo", async () => {
    const userId = await actor("rollback");
    const storeId = await storeFor(userId);
    await inTransaction(async (client) => {
      await client.query("select public.ensure_store_market_settings($1,'BR','assumed_default')", [storeId]);
      await client.query("select public.write_user_locale_preference($1,'es-PY',0)", [userId]);
    });
    expect(await query("select 1 from public.store_market_settings where store_id = $1", [storeId])).toHaveLength(0);
    expect(await query("select 1 from public.user_preferences where user_id = $1", [userId])).toHaveLength(0);
  });
});
