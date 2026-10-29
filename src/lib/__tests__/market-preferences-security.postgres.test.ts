import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerFixture } from "./fixture-registry";

/**
 * F57.2 — provas reais de RLS, grants, isolamento A/B e país imutável.
 *
 * Alvo único: homolog 127.0.0.1:57782/postgres. Todas as fixtures rodam em
 * transação com rollback; nada é persistido. As linhas RLS-DENY/PRIV são
 * emitidas para compor evidence/57.2-05-rls-grants.txt.
 */
const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) throw new Error("TEST_DATABASE_URL obrigatório (homolog 127.0.0.1:57782/postgres)");

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
  if (url.hostname !== "127.0.0.1" || url.port !== "57782" || url.pathname !== "/postgres") {
    throw new Error("Destino recusado: esperado 127.0.0.1:57782/postgres");
  }
  return url;
}

const target = parseTarget(rawUrl);
const expectedLedgerCount = Number(process.env.F57_2_EXPECTED_LEDGER_COUNT ?? "");
const expectedLedgerHash = (process.env.F57_2_EXPECTED_LEDGER_SHA256 ?? "").trim();
const pool = new Pool({ connectionString: target.toString(), ssl: false });
const runId = `f572test-security-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
      return await fn(client);
    } finally {
      await client.query("rollback").catch(() => undefined);
    }
  });
}

async function scalar<T = number>(client: PoolClient, sql: string, values: unknown[] = []): Promise<T> {
  const result = await client.query(sql, values);
  return Object.values(result.rows[0] ?? {})[0] as T;
}

async function actor(client: PoolClient, label: string): Promise<string> {
  const id = crypto.randomUUID();
  await client.query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1,'authenticated','authenticated',$2,now(),now())",
    [id, `${label}-${runId}-${id}@f57-2.test`],
  );
  registerFixture("user", id);
  return id;
}

async function storeFor(client: PoolClient, userId: string, label: string): Promise<string> {
  const id = crypto.randomUUID();
  await client.query(
    "insert into public.stores (id, user_id, name, segment) values ($1,$2,$3,'outros')",
    [id, userId, `Loja ${label}-${runId}`],
  );
  await client.query("select public.ensure_store_market_settings($1,'BR','assumed_default')", [id]);
  registerFixture("store", id);
  return id;
}

async function setAuthenticated(client: PoolClient, userId: string): Promise<void> {
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await client.query("set local role authenticated");
}

async function resetRole(client: PoolClient): Promise<void> {
  await client.query("reset role");
}

async function expectDenied(client: PoolClient, sql: string, values: unknown[] = []): Promise<void> {
  await client.query("savepoint denied");
  try {
    await client.query(sql, values);
    throw new Error("esperava negação de privilégio, mas a operação passou");
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    expect((error as { code?: string }).code).toBe("42501");
  } finally {
    await client.query("rollback to savepoint denied");
  }
}

async function expectSqlError(
  client: PoolClient,
  sql: string,
  values: unknown[],
  pattern: RegExp,
): Promise<void> {
  await client.query("savepoint expected_error");
  try {
    await expect(client.query(sql, values)).rejects.toThrow(pattern);
  } finally {
    // Recupera a transação mesmo quando a função esperada abortou o statement.
    await client.query("rollback to savepoint expected_error");
  }
}

function ledgerFingerprint(rows: Array<{ version: string; name: string | null }>): {
  count: number;
  sha256: string;
} {
  const stable = rows
    .filter((row) => !String(row.name ?? "").includes("f57_2_"))
    .map((row) => `${row.version}|${row.name ?? ""}`)
    .sort();
  return { count: stable.length, sha256: createHash("sha256").update(stable.join("\n")).digest("hex") };
}

beforeAll(async () => {
  if (!Number.isInteger(expectedLedgerCount) || expectedLedgerCount < 149) {
    throw new Error("F57_2_EXPECTED_LEDGER_COUNT ausente/inválido");
  }
  if (!/^[0-9a-f]{64}$/.test(expectedLedgerHash)) {
    throw new Error("F57_2_EXPECTED_LEDGER_SHA256 ausente/inválido");
  }
  await withClient(async (client) => {
    const identity = await client.query<{ db: string; auth: boolean }>(
      "select current_database() as db, to_regclass('auth.users') is not null as auth",
    );
    if (identity.rows[0]?.db !== "postgres" || identity.rows[0]?.auth !== true) {
      throw new Error("Alvo não é o homolog esperado");
    }
    const ledger = await client.query<{ version: string; name: string | null }>(
      "select version, name from supabase_migrations.schema_migrations order by version",
    );
    const fingerprint = ledgerFingerprint(ledger.rows);
    if (fingerprint.count !== expectedLedgerCount || fingerprint.sha256 !== expectedLedgerHash) {
      throw new Error(`Fingerprint do ledger divergiu (count=${fingerprint.count}, sha=${fingerprint.sha256})`);
    }
  });
});

afterAll(async () => {
  await pool.end();
});

describe("F57.2 segurança — RLS e isolamento A/B", () => {
  it("1. authenticated lê somente a própria preferência e a própria loja", async () => {
    await inTransaction(async (client) => {
      const userA = await actor(client, "rls-a");
      const userB = await actor(client, "rls-b");
      const storeA = await storeFor(client, userA, "rls-a");
      const storeB = await storeFor(client, userB, "rls-b");
      await client.query("select public.write_user_locale_preference($1,'pt-BR',0)", [userA]);
      await client.query("select public.write_user_locale_preference($1,'es-419',0)", [userB]);

      await setAuthenticated(client, userA);
      const prefsA = await client.query<{ user_id: string }>("select user_id from public.user_preferences");
      const settingsA = await client.query<{ store_id: string }>("select store_id from public.store_market_settings");
      expect(prefsA.rows.map((row) => row.user_id)).toEqual([userA]);
      expect(settingsA.rows.map((row) => row.store_id)).toEqual([storeA]);
      console.log("RLS-READ user_preferences A=1 B=0");
      console.log("RLS-READ store_market_settings A=1 B=0");

      await resetRole(client);
      await setAuthenticated(client, userB);
      const prefsB = await client.query<{ user_id: string }>("select user_id from public.user_preferences");
      const settingsB = await client.query<{ store_id: string }>("select store_id from public.store_market_settings");
      expect(prefsB.rows.map((row) => row.user_id)).toEqual([userB]);
      expect(settingsB.rows.map((row) => row.store_id)).toEqual([storeB]);

      await resetRole(client);
      expect(await scalar<number>(client, "select count(*)::int from public.stores where id in ($1,$2)", [storeA, storeB])).toBe(2);
    });
  });

  it("2. escrita direta de authenticated é negada nas duas tabelas", async () => {
    await inTransaction(async (client) => {
      const user = await actor(client, "rls-write");
      const storeId = await storeFor(client, user, "rls-write");
      await client.query("select public.write_user_locale_preference($1,'pt-BR',0)", [user]);
      const prefsBefore = await scalar<number>(client, "select count(*)::int from public.user_preferences");
      const settingsBefore = await scalar<number>(client, "select count(*)::int from public.store_market_settings");

      await setAuthenticated(client, user);
      await expectDenied(client, "insert into public.user_preferences (user_id) values ($1)", [user]);
      console.log("RLS-DENY user_preferences INSERT");
      await expectDenied(client, "update public.user_preferences set ui_locale='es-419' where user_id=$1", [user]);
      console.log("RLS-DENY user_preferences UPDATE");
      await expectDenied(client, "delete from public.user_preferences where user_id=$1", [user]);
      console.log("RLS-DENY user_preferences DELETE");
      await expectDenied(client, "insert into public.store_market_settings (store_id, country_code, country_source) values ($1,'BR','assumed_default')", [storeId]);
      console.log("RLS-DENY store_market_settings INSERT");
      await expectDenied(client, "update public.store_market_settings set country_code='PY' where store_id=$1", [storeId]);
      console.log("RLS-DENY store_market_settings UPDATE");
      await expectDenied(client, "delete from public.store_market_settings where store_id=$1", [storeId]);
      console.log("RLS-DENY store_market_settings DELETE");

      await resetRole(client);
      expect(await scalar<number>(client, "select count(*)::int from public.user_preferences")).toBe(prefsBefore);
      expect(await scalar<number>(client, "select count(*)::int from public.store_market_settings")).toBe(settingsBefore);
    });
  });

  it("5. duas lojas BR de donos diferentes permanecem isoladas", async () => {
    await inTransaction(async (client) => {
      const userA = await actor(client, "br-a");
      const userB = await actor(client, "br-b");
      const storeA = await storeFor(client, userA, "br-a");
      const storeB = await storeFor(client, userB, "br-b");
      await setAuthenticated(client, userA);
      const rows = await client.query<{ store_id: string; country_code: string }>(
        "select store_id, country_code from public.store_market_settings",
      );
      expect(rows.rows).toEqual([{ store_id: storeA, country_code: "BR" }]);
      expect(rows.rows.some((row) => row.store_id === storeB)).toBe(false);
      console.log("RLS-READ duas lojas BR: A vê A, não vê B");
      await resetRole(client);
    });
  });
});

describe("F57.2 segurança — grants, país imutável e erros", () => {
  it("3. EXECUTE negado a authenticated e permitido a service_role", async () => {
    const signatures = [
      "public.ensure_store_market_settings(uuid,text,text)",
      "public.write_store_market_settings(uuid,text,text,text,text,text,text,text,text,text,text,integer,bigint)",
      "public.write_user_locale_preference(uuid,text,bigint)",
      "public.create_store_draft(uuid,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text)",
      "public.create_store_with_cnpj(text,text,uuid,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,jsonb,jsonb,text[],boolean)",
      "public.update_store_cnpj(uuid,text,text,text,text,jsonb,text,jsonb,jsonb,text[],boolean)",
      "public.create_store_with_initial_grant(text,text,uuid,text,text,text,text,text,text,text,text,text,integer)",
      "public.admin_create_store_for_user(uuid,uuid,text,text)",
    ];
    await withClient(async (client) => {
      for (const signature of signatures) {
        const oid = await scalar<string | null>(client, "select to_regprocedure($1)::text", [signature]);
        expect(oid, `função ausente: ${signature}`).not.toBeNull();
        const authenticated = await scalar<boolean>(
          client,
          "select has_function_privilege('authenticated',$1,'EXECUTE')",
          [oid],
        );
        const service = await scalar<boolean>(
          client,
          "select has_function_privilege('service_role',$1,'EXECUTE')",
          [oid],
        );
        expect(authenticated).toBe(false);
        expect(service).toBe(true);
        console.log(`PRIV authenticated ${signature.split("(")[0]} = false`);
        console.log(`PRIV service_role ${signature.split("(")[0]} = true`);
      }
    });
  });

  it("4. país imutável não altera nenhum campo nem a versão", async () => {
    await inTransaction(async (client) => {
      const user = await actor(client, "immutable");
      const storeId = await storeFor(client, user, "immutable");
      const before = await client.query<Record<string, unknown>>(
        "select * from public.store_market_settings where store_id=$1",
        [storeId],
      );
      await expectSqlError(
        client,
        `select public.write_store_market_settings($1,'PY','explicit','es-PY','explicit','PYG','explicit','America/Asuncion','explicit','PY','assumed_default',1,1)`,
        [storeId],
        /country_not_mutable/,
      );
      const after = await client.query<Record<string, unknown>>(
        "select * from public.store_market_settings where store_id=$1",
        [storeId],
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
      console.log("PRIV country_not_mutable preserva linha completa");
    });
  });

  it("6. nenhuma loja operacional fica com país diferente de BR", async () => {
    await inTransaction(async (client) => {
      const userId = await actor(client, "no-py");
      const storeId = await storeFor(client, userId, "no-py");
      await client.query(
        "insert into public.store_billing_info (store_id, billing_address_country) values ($1,'PY')",
        [storeId],
      );
      await client.query("select public.ensure_store_market_settings($1,'BR','fiscal_confirmation')", [storeId]);
      expect(
        await scalar<number>(
          client,
          "select count(*)::int from public.store_market_settings where store_id=$1 and country_code <> 'BR'",
          [storeId],
        ),
      ).toBe(0);
      expect(await scalar<number>(client, "select billing_address_country from public.store_billing_info where store_id=$1", [storeId])).toBe("PY");
      console.log("NO-PY loja BR com billing PY: country_code=BR");
    });
  });

  it("7. store_not_found não vaza detalhes para loja inexistente", async () => {
    await inTransaction(async (client) => {
      await expectSqlError(
        client,
        "select public.ensure_store_market_settings($1,'BR','assumed_default')",
        ["00000000-0000-0000-0000-000000000000"],
        /store_not_found/,
      );
      console.log("PRIV store_not_found sem detalhes de tenant");
    });
  });
});
