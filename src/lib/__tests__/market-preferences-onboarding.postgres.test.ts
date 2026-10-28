import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * F57.2 — regressão de onboarding/confirmação fiscal no HOMOLOG existente.
 *
 * Cenários que concedem crédito real rodam em transação com ROLLBACK
 * (credit_transactions é append-only). Apenas cenários sem crédito podem
 * commitar; nesses casos o cleanup é feito por IDs f572test-.
 */
const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) throw new Error("TEST_DATABASE_URL obrigatório (homolog 127.0.0.1:57782/postgres)");

let target: URL;
try {
  target = new URL(rawUrl);
} catch {
  throw new Error("TEST_DATABASE_URL inválida");
}
if (target.hostname !== "127.0.0.1" || target.port !== "57782" || target.pathname !== "/postgres") {
  throw new Error("Alvo recusado: esperado 127.0.0.1:57782/postgres");
}

const expectedLedgerCount = Number(process.env.F57_2_EXPECTED_LEDGER_COUNT ?? "");
const expectedLedgerHash = (process.env.F57_2_EXPECTED_LEDGER_SHA256 ?? "").trim();
const pool = new Pool({ connectionString: target.toString(), ssl: false });
const runId = `f572test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdStores: string[] = [];
const createdUsers: string[] = [];

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function withRollback<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      return await fn(client);
    } finally {
      await client.query("rollback").catch(() => undefined);
    }
  });
}

async function withCommitted<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

async function scalar<T = number>(client: PoolClient, sql: string, values: unknown[] = []): Promise<T> {
  const result = await client.query(sql, values);
  return Object.values(result.rows[0] ?? {})[0] as T;
}

async function expectReject(
  client: PoolClient,
  sql: string,
  values: unknown[],
  pattern: RegExp,
): Promise<void> {
  await client.query("savepoint expected_error");
  try {
    await expect(client.query(sql, values)).rejects.toThrow(pattern);
  } finally {
    await client.query("rollback to savepoint expected_error");
  }
}

async function waitForBlocked(
  observer: PoolClient,
  marker: "write_store_market_settings" | "update_store_cnpj",
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const waiting = await scalar<number>(
      observer,
      `select count(*)::int
         from pg_stat_activity
        where datname = current_database()
          and wait_event_type = 'Lock'
          and query ilike $1`,
      [`%${marker}%`],
    );
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timeout aguardando bloqueio de ${marker}`);
}

async function readTrialOfferRow(): Promise<Record<string, unknown>> {
  return withClient(async (client) => {
    const result = await client.query<{ row: Record<string, unknown> }>(
      "select to_jsonb(t) as row from public.trial_offer_settings t where offer_key='trial_28d_v1'",
    );
    if (!result.rows[0]) throw new Error("trial_offer_settings.trial_28d_v1 ausente");
    return result.rows[0].row;
  });
}

async function withTrialLaunchFixture<T>(
  launchAt: string | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const before = await readTrialOfferRow();
  try {
    return await withRollback(async (client) => {
      const updated = await client.query<{ offer_key: string }>(
        "update public.trial_offer_settings set launch_at=$2 where offer_key=$1 returning offer_key",
        ["trial_28d_v1", launchAt],
      );
      if (updated.rows.length !== 1) {
        throw new Error(`fixture: update de launch_at afetou ${updated.rows.length} linhas`);
      }
      return fn(client);
    });
  } finally {
    // Executa mesmo se o fixture falhar; o ROLLBACK já restaurou a linha.
    const after = await readTrialOfferRow();
    expect(after).toEqual(before);
  }
}

async function actor(client: PoolClient, label: string, createdAt?: string): Promise<string> {
  const id = crypto.randomUUID();
  const stamp = createdAt ?? new Date().toISOString();
  await client.query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1,'authenticated','authenticated',$2,$3,$3)",
    [id, `${label}-${runId}-${id}@f57-2.test`, stamp],
  );
  createdUsers.push(id);
  return id;
}

function cnpjHash(label: string): string {
  return createHash("sha256").update(`${runId}-${label}`).digest("hex");
}

function cnpjNormalized(label: string): string {
  // Formato canônico F50.3: 12 alfanuméricos + 2 dígitos, sem flexibilizar CHECK.
  const hex = createHash("sha256").update(`${runId}-cnpj-${label}`).digest("hex").toUpperCase();
  return `${hex.slice(0, 12)}90`;
}

async function createDraft(client: PoolClient, userId: string) {
  const result = await client.query<{ value: { store: Array<{ id: string }>; onboardingGranted: boolean } }>(
    `select public.create_store_draft(
       $1,$2,'outros','Cidade','SP',$1,'v1','v1','127.0.0.1','test','#22C55E',null,null,null,null,null,null
     ) as value`,
    [userId, `Loja ${runId}`],
  );
  return result.rows[0].value as { store: Array<{ id: string }>; onboardingGranted: boolean };
}

async function createWithCnpj(
  client: PoolClient,
  userId: string,
  options: { status?: string; demo?: boolean; rootHash?: string; cnpj?: string } = {},
) {
  const rootHash = options.rootHash ?? cnpjHash(`cnpj-${crypto.randomUUID()}`);
  const normalized = options.cnpj ?? cnpjNormalized(`cnpj-${crypto.randomUUID()}`);
  const result = await client.query<{ value: { store: Array<{ id: string }>; onboardingGranted: boolean } }>(
    `select public.create_store_with_cnpj(
       $1,$2,$3,$4,'outros',$3,'v1','v1','127.0.0.1','test',
       'Cidade','SP','#22C55E',null,null,null,null,null,null,
       null,'Empresa','Fantasia',$5,null,null,null,$6
     ) as value`,
    [
      normalized,
      rootHash,
      userId,
      `Loja ${runId}`,
      options.status ?? "unverified",
      options.demo ?? false,
    ],
  );
  return { rootHash, normalized, value: result.rows[0].value as { store: Array<{ id: string }>; onboardingGranted: boolean } };
}

async function storeIdOf(value: { store: Array<{ id: string }> }): Promise<string> {
  const id = value.store?.[0]?.id;
  if (!id) throw new Error("store id ausente");
  createdStores.push(id);
  return id;
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
    const rows = await client.query<{ version: string; name: string | null }>("select version, name from supabase_migrations.schema_migrations order by version");
    const stable = rows.rows
      .filter((row) => !String(row.name ?? "").includes("f57_2_"))
      .map((row) => `${row.version}|${row.name ?? ""}`)
      .sort();
    const sha = createHash("sha256").update(stable.join("\n")).digest("hex");
    if (stable.length !== expectedLedgerCount || sha !== expectedLedgerHash) {
      throw new Error(`Fingerprint do ledger divergiu (count=${stable.length}, sha=${sha})`);
    }
  });
});

afterAll(async () => {
  try {
    await withClient(async (client) => {
      await client.query("begin");
      try {
        for (const storeId of createdStores) {
          await client.query("delete from public.store_market_settings where store_id = $1", [storeId]);
          await client.query("delete from public.store_billing_info where store_id = $1", [storeId]);
          await client.query("delete from public.legal_acceptances where store_id = $1", [storeId]);
          await client.query("delete from public.stores where id = $1", [storeId]);
        }
        for (const userId of createdUsers) {
          await client.query("delete from public.user_preferences where user_id = $1", [userId]);
          await client.query("delete from public.admin_audit_log where target_id = $1", [userId]);
          await client.query("delete from auth.users where id = $1", [userId]);
        }
        await client.query("commit");
        createdStores.length = 0;
        createdUsers.length = 0;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    });
  } finally {
    await pool.end();
  }
});

describe("F57.2 onboarding — crédito e configurações", () => {
  it("A. draft: 2 aceites, sem grant, settings BR assumed_default v1", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "draft");
      const result = await createDraft(client, userId);
      const storeId = await storeIdOf(result);
      expect(result.onboardingGranted).toBe(false);
      expect(await scalar(client, "select count(*)::int from public.legal_acceptances where store_id=$1", [storeId])).toBe(2);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId])).toBe(0);
      expect(await scalar(client, "select count(*)::int from public.freemium_entitlements where store_id=$1", [storeId])).toBe(0);
      const settings = await client.query(
        "select country_code, country_source, default_content_locale, default_currency, time_zone, settings_version::int from public.store_market_settings where store_id=$1",
        [storeId],
      );
      expect(settings.rows[0]).toMatchObject({
        country_code: "BR",
        country_source: "assumed_default",
        default_content_locale: "pt-BR",
        default_currency: "BRL",
        time_zone: "America/Sao_Paulo",
        settings_version: 1,
      });
    });
  });

  it("B. cnpj unverified: sem grant", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "cnpj-b");
      const { value } = await createWithCnpj(client, userId, { status: "unverified", demo: true });
      const storeId = await storeIdOf(value);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId])).toBe(0);
      expect(await scalar(client, "select coalesce(max(balance),0)::int from public.credit_balances where store_id=$1", [storeId])).toBe(0);
    });
  });

  it("D. cnpj approved sem flag: sem grant", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "cnpj-d");
      const { value } = await createWithCnpj(client, userId, { status: "approved", demo: false });
      const storeId = await storeIdOf(value);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId])).toBe(0);
      expect(await scalar(client, "select coalesce(max(balance),0)::int from public.credit_balances where store_id=$1", [storeId])).toBe(0);
    });
  });

  it("C0. configuração atual (launch_at NULL): demo concedida antes da ativação", async () => {
    await withTrialLaunchFixture(null, async (client) => {
      const userId = await actor(client, "demo-current-config");
      const { value } = await createWithCnpj(client, userId, { status: "approved", demo: true });
      const storeId = await storeIdOf(value);
      expect(value.onboardingGranted).toBe(true);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1 and type='demo'", [storeId])).toBe(1);
      expect(await scalar(client, "select balance::int from public.credit_balances where store_id=$1", [storeId])).toBe(10);
      expect(await scalar(client, "select count(*)::int from public.freemium_entitlements where store_id=$1 and benefit_type='demo'", [storeId])).toBe(1);
    });
  });

  it("C. coorte legada + approved/flag: demo real (entitlement demo, 10 créditos)", async () => {
    const launchAt = "2026-01-15T00:00:00.000Z";
    await withTrialLaunchFixture(launchAt, async (client) => {
      const legacyCreatedAt = new Date(new Date(launchAt).getTime() - 86_400_000).toISOString();
      const userId = await actor(client, "demo-legacy", legacyCreatedAt);
      const { value } = await createWithCnpj(client, userId, { status: "approved", demo: true });
      const storeId = await storeIdOf(value);
      expect(value.onboardingGranted).toBe(true);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1 and type='demo'", [storeId])).toBe(1);
      expect(await scalar(client, "select balance::int from public.credit_balances where store_id=$1", [storeId])).toBe(10);
      expect(await scalar(client, "select count(*)::int from public.freemium_entitlements where store_id=$1 and benefit_type='demo'", [storeId])).toBe(1);
      expect(await scalar(client, "select count(*)::int from public.freemium_entitlements where store_id=$1 and benefit_type='onboarding'", [storeId])).toBe(0);
    });
  });

  it("C2. coorte pós-launch + approved/flag: demo bloqueada pela oferta 28d", async () => {
    const launchAt = "2026-01-15T00:00:00.000Z";
    await withTrialLaunchFixture(launchAt, async (client) => {
      const postLaunchCreatedAt = new Date(new Date(launchAt).getTime() + 86_400_000).toISOString();
      const userId = await actor(client, "demo-post-launch", postLaunchCreatedAt);
      const { value } = await createWithCnpj(client, userId, { status: "approved", demo: true });
      const storeId = await storeIdOf(value);
      expect(value.onboardingGranted).toBe(false);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId])).toBe(0);
      expect(await scalar(client, "select count(*)::int from public.freemium_entitlements where store_id=$1", [storeId])).toBe(0);
      expect(await scalar(client, "select coalesce(max(balance),0)::int from public.credit_balances where store_id=$1", [storeId])).toBe(0);
    });
  });

  it("E. create_store_with_initial_grant direto: balance 0 e settings presentes", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "initial");
      const result = await client.query<{ value: { id: string; balance: number } }>(
        `select public.create_store_with_initial_grant($1,'outros',$2) as value`,
        [`Loja ${runId}`, userId],
      );
      const storeId = result.rows[0].value.id as string;
      createdStores.push(storeId);
      expect(result.rows[0].value.balance).toBe(0);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId])).toBe(0);
      expect(await scalar(client, "select count(*)::int from public.store_market_settings where store_id=$1 and country_source='assumed_default'", [storeId])).toBe(1);
    });
  });

  it("F. criação administrativa por delegação: settings, balance 0, auditoria", async () => {
    await withRollback(async (client) => {
      const adminId = crypto.randomUUID();
      await client.query(
        "insert into auth.users (id,aud,role,email) values ($1,'authenticated','authenticated',$2)",
        [adminId, `admin-${runId}@f57-2.test`],
      );
      const targetUser = await actor(client, "admin-target");
      const result = await client.query<{ value: { id: string; balance: number } }>(
        "select public.admin_create_store_for_user($1,$2,$3,'outros') as value",
        [adminId, targetUser, `Loja ${runId}`],
      );
      const storeId = result.rows[0].value.id as string;
      createdStores.push(storeId);
      expect(result.rows[0].value.balance).toBe(0);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId])).toBe(0);
      expect(await scalar(client, "select count(*)::int from public.store_market_settings where store_id=$1", [storeId])).toBe(1);
      expect(await scalar(client, "select count(*)::int from public.admin_audit_log where action='store_create_invite' and target_id=$1", [targetUser])).toBe(1);
      expect(
        await scalar(
          client,
          "select count(*)::int from public.admin_audit_log where action='store_create_invite' and target_id=$1 and metadata->>'storeName'=$2",
          [targetUser, `Loja ${runId}`],
        ),
      ).toBe(1);
      await expectReject(
        client,
        "select public.admin_create_store_for_user($1,$2,$3,'outros')",
        [adminId, targetUser, `Loja ${runId}`],
        /usuario_ja_possui_loja/,
      );
      expect(await scalar(client, "select count(*)::int from public.stores where user_id=$1", [targetUser])).toBe(1);
      expect(await scalar(client, "select count(*)::int from public.store_market_settings where store_id=$1", [storeId])).toBe(1);
    });
  });
});

describe("F57.2 confirmação fiscal", () => {
  it("G. currency PYG explícita é preservada na confirmação", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "fiscal-g");
      const draft = await createDraft(client, userId);
      const storeId = await storeIdOf(draft);
      await client.query(
        "update public.store_market_settings set default_currency='PYG', default_currency_source='explicit' where store_id=$1",
        [storeId],
      );
      const rootHash = cnpjHash("fiscal-g");
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'approved',null,null,null,false)`,
        [storeId, cnpjNormalized("fiscal-g"), rootHash],
      );
      const row = await client.query<Record<string, unknown>>(
        "select country_code,country_source,default_currency,default_currency_source,settings_version::int from public.store_market_settings where store_id=$1",
        [storeId],
      );
      expect(row.rows[0]).toMatchObject({
        country_code: "BR",
        country_source: "fiscal_confirmation",
        default_currency: "PYG",
        default_currency_source: "explicit",
      });
      expect(row.rows[0].settings_version).toBeGreaterThan(1);
    });
  });

  it("H. loja legada sem linha cria configurações fiscais", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "fiscal-h");
      const storeId = crypto.randomUUID();
      await client.query(
        "insert into public.stores (id,user_id,name,segment) values ($1,$2,$3,'outros')",
        [storeId, userId, `Loja ${runId}`],
      );
      createdStores.push(storeId);
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
        [storeId, cnpjNormalized("fiscal-h"), cnpjHash("fiscal-h")],
      );
      expect(await scalar(client, "select count(*)::int from public.store_market_settings where store_id=$1 and country_source='fiscal_confirmation'", [storeId])).toBe(1);
    });
  });

  it("I. BR + mercado PY explícito mantém es-PY/PYG e fuso BR", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "fiscal-i");
      const draft = await createDraft(client, userId);
      const storeId = await storeIdOf(draft);
      await client.query(
        `update public.store_market_settings set default_campaign_market='PY', default_campaign_market_source='explicit',
           default_content_locale='es-PY', default_content_locale_source='default',
           default_currency='PYG', default_currency_source='default', time_zone='America/Sao_Paulo', time_zone_source='default'
         where store_id=$1`,
        [storeId],
      );
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'approved',null,null,null,false)`,
        [storeId, cnpjNormalized("fiscal-i"), cnpjHash("fiscal-i")],
      );
      const row = await client.query(
        "select country_code,country_source,default_campaign_market,default_content_locale,default_currency,time_zone from public.store_market_settings where store_id=$1",
        [storeId],
      );
      expect(row.rows[0]).toMatchObject({
        country_code: "BR",
        country_source: "fiscal_confirmation",
        default_campaign_market: "PY",
        default_content_locale: "es-PY",
        default_currency: "PYG",
        time_zone: "America/Sao_Paulo",
      });
    });
  });

  it("J. benefício anterior grava marcador legado sem novo grant", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "fiscal-j");
      const draft = await createDraft(client, userId);
      const storeId = await storeIdOf(draft);
      const rootHash = cnpjHash("fiscal-j");
      await client.query(
        "insert into public.credit_transactions (store_id, amount, type, balance_before, balance_after) values ($1, 5, 'bonus_onboarding', 0, 5)",
        [storeId],
      );
      const before = await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId]);
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'approved',null,null,null,true)`,
        [storeId, cnpjNormalized("fiscal-j"), rootHash],
      );
      const marker = await client.query<{ reason: string }>(
        "select reason from public.freemium_entitlements where store_id=$1 and benefit_type='onboarding'",
        [storeId],
      );
      expect(marker.rows[0]?.reason).toBe("legacy_pre_f32_onboarding_consumed");
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId])).toBe(before);
    });
  });

  it("K. país divergente falha sem alterar versão", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "fiscal-k");
      const storeId = crypto.randomUUID();
      await client.query("insert into public.stores (id,user_id,name,segment) values ($1,$2,$3,'outros')", [storeId, userId, `Loja ${runId}`]);
      createdStores.push(storeId);
      await client.query("select public.ensure_store_market_settings($1,'PY','legacy_br')", [storeId]);
      const before = await scalar(client, "select settings_version::int from public.store_market_settings where store_id=$1", [storeId]);
      await expectReject(
        client,
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'approved',null,null,null,false)`,
        [storeId, cnpjNormalized("fiscal-k"), cnpjHash("fiscal-k")],
        /country_not_mutable/,
      );
      const after = await client.query<{ country_code: string; settings_version: number }>(
        "select country_code,settings_version::int from public.store_market_settings where store_id=$1",
        [storeId],
      );
      expect(after.rows[0].country_code).toBe("PY");
      expect(after.rows[0].settings_version).toBe(before);
    });
  });
});

describe("F57.2 idempotência, atomicidade e contrato", () => {
  it("N. confirmação fiscal e PATCH concorrem nas duas ordens (CAS)", async () => {
    // (i) PATCH commitado antes do fiscal.
    const first = await withCommitted(async (client) => {
      const userId = await actor(client, "concurrent-i");
      const draft = await createDraft(client, userId);
      const storeId = await storeIdOf(draft);
      return { storeId, userId };
    });
    await withCommitted(async (client) => {
      await client.query(
        `select public.write_store_market_settings($1,'BR','explicit','pt-BR','explicit','BRL','explicit','America/Sao_Paulo','explicit','BR','assumed_default',1,1)`,
        [first.storeId],
      );
    });
    await withCommitted(async (client) => {
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
        [first.storeId, cnpjNormalized("fiscal-ni"), cnpjHash("fiscal-ni")],
      );
    });
    {
      const row = await withClient(async (client) =>
        client.query<Record<string, unknown>>(
          "select country_code,country_source,default_campaign_market,default_campaign_market_source,settings_version::int from public.store_market_settings where store_id=$1",
          [first.storeId],
        ),
      );
      expect(row.rows[0]).toMatchObject({
        country_code: "BR",
        country_source: "fiscal_confirmation",
        default_campaign_market: "BR",
        default_campaign_market_source: "explicit",
        settings_version: 3,
      });
    }

    // (ii) Fiscal primeiro; PATCH com versão antiga falha e não altera nada.
    const second = await withCommitted(async (client) => {
      const userId = await actor(client, "concurrent-ii");
      const draft = await createDraft(client, userId);
      const storeId = await storeIdOf(draft);
      return { storeId, userId };
    });
    await withCommitted(async (client) => {
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
        [second.storeId, cnpjNormalized("fiscal-nii"), cnpjHash("fiscal-nii")],
      );
    });
    await withCommitted(async (client) => {
      await expectReject(
        client,
        `select public.write_store_market_settings($1,'PY','explicit','es-PY','explicit','PYG','explicit','America/Asuncion','explicit','BR','assumed_default',1,1)`,
        [second.storeId],
        /settings_version_conflict/,
      );
    });
    await withCommitted(async (client) => {
      // Versão real é 2: a escrita correta deve observar exatamente essa versão.
      await client.query(
        `select public.write_store_market_settings($1,'PY','explicit','es-PY','explicit','PYG','explicit','America/Asuncion','explicit','BR','assumed_default',1,2)`,
        [second.storeId],
      );
    });
    {
      const row = await withClient(async (client) =>
        client.query<Record<string, unknown>>(
          "select country_code,country_source,default_campaign_market,settings_version::int from public.store_market_settings where store_id=$1",
          [second.storeId],
        ),
      );
      expect(row.rows[0]).toMatchObject({
        country_code: "BR",
        country_source: "fiscal_confirmation",
        default_campaign_market: "PY",
        settings_version: 3,
      });
    }

    // Linha ausente: PATCH legado antes do fiscal.
    const missingA = await withCommitted(async (client) => {
      const userId = await actor(client, "concurrent-missing-a");
      const storeId = crypto.randomUUID();
      await client.query("insert into public.stores (id,user_id,name,segment) values ($1,$2,$3,'outros')", [
        storeId,
        userId,
        `Loja ${runId} missing-a`,
      ]);
      createdStores.push(storeId);
      return storeId;
    });
    await withCommitted(async (client) => {
      await client.query(
        `select public.write_store_market_settings($1,'BR','legacy_br','pt-BR','legacy_br','BRL','legacy_br','America/Sao_Paulo','legacy_br','BR','legacy_br',1,0)`,
        [missingA],
      );
    });
    await withCommitted(async (client) => {
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
        [missingA, cnpjNormalized("fiscal-nma"), cnpjHash("fiscal-nma")],
      );
    });
    {
      const row = await withClient(async (client) =>
        client.query<Record<string, unknown>>(
          "select country_code,country_source,settings_version::int from public.store_market_settings where store_id=$1",
          [missingA],
        ),
      );
      expect(row.rows[0]).toMatchObject({ country_code: "BR", country_source: "fiscal_confirmation", settings_version: 2 });
    }

    // Linha ausente: fiscal antes; PATCH com expected 0 conflita.
    const missingB = await withCommitted(async (client) => {
      const userId = await actor(client, "concurrent-missing-b");
      const storeId = crypto.randomUUID();
      await client.query("insert into public.stores (id,user_id,name,segment) values ($1,$2,$3,'outros')", [
        storeId,
        userId,
        `Loja ${runId} missing-b`,
      ]);
      createdStores.push(storeId);
      return storeId;
    });
    await withCommitted(async (client) => {
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
        [missingB, cnpjNormalized("fiscal-nmb"), cnpjHash("fiscal-nmb")],
      );
    });
    await withCommitted(async (client) => {
      await expectReject(
        client,
        `select public.write_store_market_settings($1,'PY','explicit','es-PY','explicit','PYG','explicit','America/Asuncion','explicit','BR','legacy_br',1,0)`,
        [missingB],
        /settings_version_conflict/,
      );
    });
    {
      const row = await withClient(async (client) =>
        client.query<Record<string, unknown>>(
          "select country_code,country_source,settings_version::int from public.store_market_settings where store_id=$1",
          [missingB],
        ),
      );
      expect(row.rows[0]).toMatchObject({ country_code: "BR", country_source: "fiscal_confirmation", settings_version: 2 });
    }
  });

  it("N2. disputa realmente sobreposta entre confirmação fiscal e PATCH", async () => {
    const first = await withCommitted(async (client) => {
      const userId = await actor(client, "overlap-write-first");
      const draft = await createDraft(client, userId);
      return storeIdOf(draft);
    });
    const second = await withCommitted(async (client) => {
      const userId = await actor(client, "overlap-fiscal-first");
      const draft = await createDraft(client, userId);
      return storeIdOf(draft);
    });

    // Ordem 1: fiscal segura a tabela; PATCH bloqueia e depois conflita.
    {
      const fiscal = await pool.connect();
      const writer = await pool.connect();
      const observer = await pool.connect();
      let blockedWrite: Promise<void> | undefined;
      try {
        await fiscal.query("set statement_timeout = '10000'");
        await writer.query("set statement_timeout = '10000'");
        await observer.query("set statement_timeout = '10000'");
        await fiscal.query("begin");
        await fiscal.query("lock table public.store_market_settings in access exclusive mode");
        await fiscal.query(
          `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
          [first, cnpjNormalized("fiscal-overlap-a"), cnpjHash("fiscal-overlap-a")],
        );
        blockedWrite = (async () => {
          await writer.query("begin");
          try {
            await writer.query(
              `select public.write_store_market_settings($1,'BR','explicit','pt-BR','explicit','BRL','explicit','America/Sao_Paulo','explicit','BR','assumed_default',1,1)`,
              [first],
            );
            await writer.query("commit");
          } catch (error) {
            await writer.query("rollback").catch(() => undefined);
            throw error;
          }
        })();
        void blockedWrite.catch(() => undefined);
        await waitForBlocked(observer, "write_store_market_settings");
        await fiscal.query("commit");
        await expect(blockedWrite).rejects.toThrow(/settings_version_conflict/);
      } finally {
        // O detentor do lock (fiscal) é liberado primeiro; só então a escrita
        // pendente pode terminar. statement_timeout impede espera indefinida.
        await fiscal.query("rollback").catch(() => undefined);
        if (blockedWrite) await blockedWrite.catch(() => undefined);
        await writer.query("rollback").catch(() => undefined);
        await fiscal.query("set statement_timeout = 0").catch(() => undefined);
        await writer.query("set statement_timeout = 0").catch(() => undefined);
        await observer.query("set statement_timeout = 0").catch(() => undefined);
        fiscal.release();
        writer.release();
        observer.release();
      }
    }
    const afterFirst = await withClient(async (client) =>
      client.query<{ settings_version: number }>(
        "select settings_version::int from public.store_market_settings where store_id=$1",
        [first],
      ),
    );
    expect(afterFirst.rows[0].settings_version).toBe(2);

    // Ordem 2: PATCH segura a linha; fiscal bloqueia e depois incrementa.
    {
      const writer = await pool.connect();
      const fiscal = await pool.connect();
      const observer = await pool.connect();
      let blockedFiscal: Promise<void> | undefined;
      try {
        await writer.query("set statement_timeout = '10000'");
        await fiscal.query("set statement_timeout = '10000'");
        await observer.query("set statement_timeout = '10000'");
        await writer.query("begin");
        await writer.query(
          `select public.write_store_market_settings($1,'PY','explicit','es-PY','explicit','PYG','explicit','America/Sao_Paulo','explicit','BR','assumed_default',1,1)`,
          [second],
        );
        blockedFiscal = (async () => {
          await fiscal.query("begin");
          try {
            await fiscal.query(
              `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
              [second, cnpjNormalized("fiscal-overlap-b"), cnpjHash("fiscal-overlap-b")],
            );
            await fiscal.query("commit");
          } catch (error) {
            await fiscal.query("rollback").catch(() => undefined);
            throw error;
          }
        })();
        void blockedFiscal.catch(() => undefined);
        await waitForBlocked(observer, "update_store_cnpj");
        await writer.query("commit");
        await blockedFiscal;
      } finally {
        // O PATCH detém a linha; ele é liberado primeiro. Se a espera falhar,
        // o fiscal termina (ou estoura o timeout) antes do rollback final.
        await writer.query("rollback").catch(() => undefined);
        if (blockedFiscal) await blockedFiscal.catch(() => undefined);
        await fiscal.query("rollback").catch(() => undefined);
        await writer.query("set statement_timeout = 0").catch(() => undefined);
        await fiscal.query("set statement_timeout = 0").catch(() => undefined);
        await observer.query("set statement_timeout = 0").catch(() => undefined);
        writer.release();
        fiscal.release();
        observer.release();
      }
    }
    const row = await withClient(async (client) =>
      client.query<Record<string, unknown>>(
        "select country_code,country_source,default_campaign_market,default_campaign_market_source,settings_version::int from public.store_market_settings where store_id=$1",
        [second],
      ),
    );
    expect(row.rows[0]).toMatchObject({
      country_code: "BR",
      country_source: "fiscal_confirmation",
      default_campaign_market: "PY",
      default_campaign_market_source: "explicit",
      settings_version: 3,
    });
  });

  it("L. ensure repetido mantém uma linha e escolha explícita", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "ensure");
      const draft = await createDraft(client, userId);
      const storeId = await storeIdOf(draft);
      await client.query(
        "update public.store_market_settings set default_currency='PYG', default_currency_source='explicit' where store_id=$1",
        [storeId],
      );
      await client.query("select public.ensure_store_market_settings($1,'BR','assumed_default')", [storeId]);
      expect(await scalar(client, "select count(*)::int from public.store_market_settings where store_id=$1", [storeId])).toBe(1);
      expect(await scalar(client, "select default_currency from public.store_market_settings where store_id=$1", [storeId])).toBe("PYG");
    });
  });

  it("M. rollback da criação não deixa loja/legal/settings/crédito/auditoria", async () => {
    const draftName = `Loja ${runId} atomic-draft`;
    await withRollback(async (client) => {
      const userId = await actor(client, "atomic");
      const result = await client.query<{ value: { store: Array<{ id: string }>; onboardingGranted: boolean } }>(
        `select public.create_store_draft(
           $1,$2,'outros','Cidade','SP',$1,'v1','v1','127.0.0.1','test','#22C55E',null,null,null,null,null,null
         ) as value`,
        [userId, draftName],
      );
      const storeId = await storeIdOf(result.rows[0].value);
      expect(await scalar(client, "select count(*)::int from public.legal_acceptances where store_id=$1", [storeId])).toBe(2);
      expect(await scalar(client, "select count(*)::int from public.store_market_settings where store_id=$1", [storeId])).toBe(1);
      expect(await scalar(client, "select count(*)::int from public.credit_transactions where store_id=$1", [storeId])).toBe(0);
    });
    const adminStoreName = `Loja ${runId} atomic-admin`;
    await withRollback(async (client) => {
      const adminId = await actor(client, "atomic-admin");
      const targetUser = await actor(client, "atomic-target");
      await client.query(
        "select public.admin_create_store_for_user($1,$2,$3,'outros')",
        [adminId, targetUser, adminStoreName],
      );
      expect(
        await scalar(
          client,
          "select count(*)::int from public.admin_audit_log where action='store_create_invite' and metadata->>'storeName'=$1",
          [adminStoreName],
        ),
      ).toBe(1);
    });
    await withClient(async (client) => {
      expect(await scalar(client, "select count(*)::int from public.stores where name = any($1::text[])", [[draftName, adminStoreName]])).toBe(0);
      expect(
        await scalar(
          client,
          "select count(*)::int from public.legal_acceptances la join public.stores s on s.id=la.store_id where s.name = any($1::text[])",
          [[draftName, adminStoreName]],
        ),
      ).toBe(0);
      expect(
        await scalar(
          client,
          "select count(*)::int from public.store_market_settings ms join public.stores s on s.id=ms.store_id where s.name = any($1::text[])",
          [[draftName, adminStoreName]],
        ),
      ).toBe(0);
      expect(
        await scalar(
          client,
          "select count(*)::int from public.credit_transactions ct join public.stores s on s.id=ct.store_id where s.name = any($1::text[])",
          [[draftName, adminStoreName]],
        ),
      ).toBe(0);
      expect(
        await scalar(
          client,
          "select count(*)::int from public.admin_audit_log where action='store_create_invite' and metadata->>'storeName'=$1",
          [adminStoreName],
        ),
      ).toBe(0);
    });
  });

  it("O. nenhuma loja criada nesta suíte usa país diferente de BR", async () => {
    await withClient(async (client) => {
      const rows = await client.query<{ n: number }>(
        "select count(*)::int as n from public.store_market_settings where country_code <> 'BR' and store_id = any($1::uuid[])",
        [createdStores],
      );
      expect(rows.rows[0].n).toBe(0);
    });
  });

  it("P. billing PY não define país cadastral em nenhum fixture", async () => {
    await withRollback(async (client) => {
      const userA = await actor(client, "billing-a");
      const created = await createWithCnpj(client, userA, { status: "unverified" });
      const storeA = await storeIdOf(created.value);
      await client.query(
        "insert into public.store_billing_info (store_id, billing_address_country, billing_address_city) values ($1,'PY','Asunción')",
        [storeA],
      );
      await client.query("delete from public.store_market_settings where store_id=$1", [storeA]);
      await client.query("select public.ensure_store_market_settings($1,'BR','fiscal_confirmation')", [storeA]);

      const userB = await actor(client, "billing-b");
      const draft = await createDraft(client, userB);
      const storeB = await storeIdOf(draft);
      await client.query(
        "insert into public.store_billing_info (store_id, billing_address_country, billing_address_city) values ($1,'PY','Asunción')",
        [storeB],
      );
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
        [storeB, cnpjNormalized("fiscal-pb"), cnpjHash("fiscal-pb")],
      );

      for (const storeId of [storeA, storeB]) {
        const settings = await client.query<Record<string, unknown>>(
          "select country_code,country_source,time_zone from public.store_market_settings where store_id=$1",
          [storeId],
        );
        expect(settings.rows[0]).toMatchObject({
          country_code: "BR",
          country_source: "fiscal_confirmation",
          time_zone: "America/Sao_Paulo",
        });
        expect(await scalar(client, "select billing_address_country from public.store_billing_info where store_id=$1", [storeId])).toBe("PY");
      }

      await client.query(
        `select public.write_store_market_settings($1,'BR','explicit','pt-BR','explicit','BRL','explicit','America/Sao_Paulo','explicit','BR','fiscal_confirmation',1,1)`,
        [storeA],
      );
      await client.query(
        `select public.write_store_market_settings($1,'BR','explicit','pt-BR','explicit','BRL','explicit','America/Sao_Paulo','explicit','BR','fiscal_confirmation',1,2)`,
        [storeB],
      );
      for (const storeId of [storeA, storeB]) {
        expect(await scalar(client, "select country_code from public.store_market_settings where store_id=$1", [storeId])).toBe("BR");
        expect(await scalar(client, "select country_source from public.store_market_settings where store_id=$1", [storeId])).toBe("fiscal_confirmation");
        expect(await scalar(client, "select billing_address_country from public.store_billing_info where store_id=$1", [storeId])).toBe("PY");
      }
    });
  });

  it("Q. idioma do app e configurações da loja permanecem independentes", async () => {
    await withRollback(async (client) => {
      const userId = await actor(client, "independent");
      const draft = await createDraft(client, userId);
      const storeId = await storeIdOf(draft);
      await client.query("select public.write_user_locale_preference($1,'es-PY',0)", [userId]);

      const settingsBefore = await client.query<{ value: Record<string, unknown> }>(
        "select to_jsonb(s) as value from public.store_market_settings s where store_id=$1",
        [storeId],
      );
      await client.query("select public.write_user_locale_preference($1,'pt-BR',1)", [userId]);
      await client.query("select public.write_user_locale_preference($1,'es-PY',2)", [userId]);
      const settingsAfter = await client.query<{ value: Record<string, unknown> }>(
        "select to_jsonb(s) as value from public.store_market_settings s where store_id=$1",
        [storeId],
      );
      expect(settingsAfter.rows[0].value).toEqual(settingsBefore.rows[0].value);
      expect(await scalar(client, "select ui_locale from public.user_preferences where user_id=$1", [userId])).toBe("es-PY");
      expect(
        await scalar(client, "select ui_locale_source from public.user_preferences where user_id=$1", [userId]),
      ).toBe("explicit");

      const prefsBefore = await client.query<{ value: Record<string, unknown> }>(
        "select to_jsonb(p) as value from public.user_preferences p where user_id=$1",
        [userId],
      );
      await client.query(
        `select public.write_store_market_settings($1,'PY','explicit','es-PY','explicit','PYG','explicit','America/Sao_Paulo','explicit','BR','assumed_default',1,1)`,
        [storeId],
      );
      expect(await scalar(client, "select default_campaign_market from public.store_market_settings where store_id=$1", [storeId])).toBe("PY");
      const prefsAfter = await client.query<{ value: Record<string, unknown> }>(
        "select to_jsonb(p) as value from public.user_preferences p where user_id=$1",
        [userId],
      );
      expect(prefsAfter.rows[0].value).toEqual(prefsBefore.rows[0].value);
    });
  });

  it("contrato: create_store_with_cnpj mantém 2 overloads; demais nomes 1", async () => {
    await withClient(async (client) => {
      const rows = await client.query<{ proname: string; n: number; secdef: boolean }>(
        "select proname, count(*)::int as n, bool_and(prosecdef) as secdef from pg_proc where proname = any($1::text[]) group by proname",
        [[
          "create_store_draft",
          "create_store_with_cnpj",
          "create_store_with_initial_grant",
          "update_store_cnpj",
          "admin_create_store_for_user",
        ]],
      );
      const byName = Object.fromEntries(rows.rows.map((row) => [row.proname, row]));
      expect(byName.create_store_with_cnpj.n).toBe(2);
      for (const name of ["create_store_draft", "create_store_with_initial_grant", "update_store_cnpj", "admin_create_store_for_user"]) {
        expect(byName[name].n).toBe(1);
      }
      for (const row of rows.rows) expect(row.secdef).toBe(true);
      const overloads = await client.query<{ pronargs: number }>(
        "select pronargs from pg_proc where proname='create_store_with_cnpj' order by pronargs",
      );
      expect(overloads.rows.map((row) => Number(row.pronargs))).toEqual([20, 27]);
      expect(
        await scalar<boolean>(client, "select to_regprocedure('public.create_store_with_cnpj(text,text,uuid,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,jsonb,jsonb,text[],boolean)') is not null"),
      ).toBe(true);
    });
  });
});
