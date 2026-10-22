/**
 * F50.4 — Prova REAL de concorrência cruzada em PostgreSQL descartável.
 *
 * Regras de segurança:
 *  - Só executa contra 127.0.0.1 na porta dedicada (F50_4_DB_PORT) e exige a
 *    sentinela `public.f50_4_harness_identity` com purpose='disposable'.
 *  - Falha fechada se a URL não for informada ou apontar para outro alvo.
 *  - Nunca registra CNPJ completo, root_hash, senha ou connection string.
 *
 * Método: duas conexões `pg` independentes, BEGIN explícito, lock_timeout e
 * observação de `pg_stat_activity.wait_event_type/wait_event` para provar a
 * espera real. `Promise.all` sozinho NÃO é usado como prova de serialização.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const EVIDENCE_JSON = path.resolve(
  process.cwd(),
  ".planning/phases/50.4-f50-4-oferta-de-onboarding-individualizada-por-cnpj-completo/50.4-10-EVIDENCE.json",
);
const TEST_FILE = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------
// Alvo fail-closed
// ---------------------------------------------------------------------------
const DB_URL = process.env.F50_4_DB_URL ?? process.env.TEST_DATABASE_URL ?? "";
const EXPECTED_PORT = process.env.F50_4_DB_PORT ?? "54422";

function assertDisposableTarget(): string {
  if (!DB_URL) {
    throw new Error(
      "F50_4_DB_URL/TEST_DATABASE_URL ausente: a suíte de concorrência exige o PostgreSQL descartável (fail-closed).",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(DB_URL);
  } catch {
    throw new Error("F50_4_DB_URL inválida (esperado postgresql://127.0.0.1:<porta>/postgres).");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`Protocolo recusado: ${parsed.protocol}.`);
  }
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error(`Host recusado: ${parsed.hostname}. Allowlist 127.0.0.1|localhost.`);
  }
  if (parsed.port !== EXPECTED_PORT) {
    throw new Error(
      `Porta recusada: ${parsed.port || "(default)"}. Esperado ${EXPECTED_PORT} (F50_4_DB_PORT).`,
    );
  }
  return DB_URL;
}

const CONNECTION_STRING = assertDisposableTarget();

// ---------------------------------------------------------------------------
// Constantes temporais (UTC) — nenhuma derivada de CNPJ real
// ---------------------------------------------------------------------------
const LAUNCH_AT = "2026-10-20T21:25:31.344856Z";
const INDIVIDUAL_LAUNCH_AT = "2026-10-21T12:00:00Z";
const PRE_LAUNCH = "2026-10-19T12:00:00Z"; // demo legada (antes do launch)
const POST_LAUNCH_ROOT = "2026-10-21T00:00:00Z"; // root_legacy, depois do launch
const POST_INDIVIDUAL = "2026-10-22T00:00:00Z"; // per_cnpj_f50_4
const MONTHLY_REFERENCE_DATE = "2026-10-20";
const MONTHLY_CYCLE = "2026-10";
const MONTHLY_STORE_CREATED_AT = "2026-08-20T12:00:00Z";

// ---------------------------------------------------------------------------
// Estado de fixtures e evidência
// ---------------------------------------------------------------------------
const createdUserIds: string[] = [];
const createdStoreIds: string[] = [];
let monitor: Client;
let originalIndividualLaunchAt: string | null = null;
let deadlocks = 0;

const SCENARIO_IDS = [
  "trial_x_demo_trial_first",
  "trial_x_demo_demo_first",
  "trial_x_monthly_trial_first",
  "trial_x_monthly_monthly_first",
  "trial_x_exception_exception_first",
  "trial_x_exception_trial_first",
  "demo_x_exception",
  "per_cnpj_x_root_legacy",
  "two_branches_same_root",
  "same_store_concurrent",
  "monthly_multiple_roots",
  "monthly_x_admin_grant_cap",
  "installment_vs_root_decision",
] as const;

type ScenarioId = (typeof SCENARIO_IDS)[number];

type ScenarioResult = {
  id: ScenarioId;
  status: "PASS" | "FAIL";
  observed_wait_event: string;
  detail: string;
};

const scenarioResults = new Map<string, ScenarioResult>(
  SCENARIO_IDS.map((id) => [
    id,
    { id, status: "FAIL", observed_wait_event: "not-observed", detail: "not executed" },
  ]),
);

function pass(id: ScenarioId, observedWait: string, detail: string) {
  scenarioResults.set(id, { id, status: "PASS", observed_wait_event: observedWait, detail });
}

function lineFor(id: ScenarioId): number {
  const lines = readFileSync(TEST_FILE, "utf8").split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(`it("${id}"`));
  return index >= 0 ? index + 1 : 1;
}

// ---------------------------------------------------------------------------
// Helpers de conexão / transação / RPC
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function newClient(label: string): Promise<Client> {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    application_name: `f50_4_conc_${label}_${crypto.randomUUID().slice(0, 8)}`,
  });
  await client.connect();
  return client;
}

async function beginTx(client: Client) {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '20s'");
}

async function rpcOn<T>(client: Client, name: string, args: unknown[]): Promise<T> {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(", ");
  const result = await client.query<{ value: T }>(
    `select public.${name}(${placeholders}) as value`,
    args,
  );
  return result.rows[0].value;
}

async function pidOf(client: Client): Promise<number> {
  const { rows } = await client.query<{ pid: number }>("select pg_backend_pid() as pid");
  return rows[0].pid;
}

/** Observa a espera real de um backend (não usa Promise.all como prova). */
async function waitForLock(
  pid: number,
  timeoutMs = 3000,
): Promise<{ type: string; event: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await monitor.query<{
      wait_event_type: string | null;
      wait_event: string | null;
      state: string;
    }>("select wait_event_type, wait_event, state from pg_stat_activity where pid = $1", [pid]);
    const row = rows[0];
    if (row?.wait_event_type) {
      return { type: row.wait_event_type, event: row.wait_event ?? "unknown" };
    }
    await sleep(50);
  }
  return null;
}

/**
 * Executa a operação A em uma transação (segurando locks) e a operação B em
 * outra conexão. Observa a espera de B, commita A e coleta o resultado de B.
 */
async function runOrdered<TFirst, TSecond>(
  first: (client: Client) => Promise<TFirst>,
  second: (client: Client) => Promise<TSecond>,
): Promise<{ first: TFirst; second: TSecond; observed: string; blocked: boolean }> {
  const clientA = await newClient("a");
  const clientB = await newClient("b");
  let observed = "none";
  let blocked = false;
  try {
    await beginTx(clientA);
    const firstResult = await first(clientA);

    await beginTx(clientB);
    const bPid = await pidOf(clientB);

    let secondResult!: TSecond;
    let secondError: unknown = null;
    const secondPromise = second(clientB).then(
      (value) => {
        secondResult = value;
      },
      (error) => {
        secondError = error;
      },
    );

    const wait = await waitForLock(bPid);
    if (wait) {
      observed = `${wait.type}/${wait.event}`;
      blocked = true;
    }

    await clientA.query("COMMIT");
    await secondPromise;
    await clientB.query("COMMIT");
    if (secondError) throw secondError;
    return { first: firstResult, second: secondResult, observed, blocked };
  } catch (error) {
    if ((error as { code?: string }).code === "40P01") deadlocks += 1;
    await clientA.query("ROLLBACK").catch(() => undefined);
    await clientB.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await clientA.end().catch(() => undefined);
    await clientB.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
let cnpjCounter = 0;

function nextCnpj(branch = "0001"): string {
  cnpjCounter += 1;
  const root = String(90000000 + cnpjCounter).padStart(8, "0");
  return `${root}${branch}95`;
}

async function createStore(options: {
  label: string;
  rootHash: string;
  userCreatedAt: string;
  branch?: string;
  createdAt?: string;
  onboardingAt?: string | null;
}): Promise<{ storeId: string; userId: string; cnpj: string }> {
  const userId = crypto.randomUUID();
  const cnpj = nextCnpj(options.branch ?? "0001");
  const storeId = crypto.randomUUID();
  createdUserIds.push(userId);
  createdStoreIds.push(storeId);

  await monitor.query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, $3, $3)",
    [userId, `f50-4-conc-${userId}@test.local`, options.userCreatedAt],
  );
  await monitor.query(
    `insert into public.stores
       (id, name, segment, user_id, cnpj_normalized, cnpj_root_hash, created_at, onboarding_completed_at, is_test_store)
     values ($1, $2, 'outros', $3, $4, $5, $6, $7, false)`,
    [
      storeId,
      options.label.slice(0, 60),
      userId,
      cnpj,
      options.rootHash,
      options.createdAt ?? options.onboardingAt ?? "2026-10-20T12:00:00Z",
      options.onboardingAt === undefined ? "2026-10-20T12:00:00Z" : options.onboardingAt,
    ],
  );
  return { storeId, userId, cnpj };
}

async function createActor(): Promise<string> {
  const userId = crypto.randomUUID();
  createdUserIds.push(userId);
  await monitor.query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, $3, $3)",
    [userId, `f50-4-conc-actor-${userId}@test.local`, PRE_LAUNCH],
  );
  return userId;
}

/** Fixture da coorte mensal: histórico bonus_monthly + saldo, sem enrollment. */
async function createMonthlyRecipient(rootHash: string, label: string, initialBonus = 5) {
  const store = await createStore({
    label,
    rootHash,
    userCreatedAt: PRE_LAUNCH,
    branch: "0001",
    createdAt: MONTHLY_STORE_CREATED_AT,
    onboardingAt: null,
  });
  await monitor.query(
    "insert into public.credit_balances (store_id, balance, bonus_balance) values ($1, $2, $2)",
    [store.storeId, initialBonus],
  );
  await monitor.query(
    `insert into public.credit_transactions
       (store_id, type, amount, balance_before, balance_after, reason, idempotency_key, metadata)
     values ($1, 'bonus_monthly', $2, 0, $2, 'historical monthly', $3, '{}'::jsonb)`,
    [store.storeId, initialBonus, `seed_monthly_${crypto.randomUUID()}`],
  );
  return store;
}

const startTrial = (client: Client, storeId: string) =>
  rpcOn<{ status: string; reason?: string; enrollment_id?: string; policy_cohort?: string }>(
    client,
    "start_trial_offer_enrollment",
    [storeId],
  );

const grantDemo = (client: Client, storeId: string, rootHash: string) =>
  rpcOn<{ granted: boolean; reason?: string }>(client, "grant_demo_credits", [
    storeId,
    rootHash,
    10,
    true,
    168,
    `demo_${crypto.randomUUID()}`,
    null,
  ]);

const grantMonthly = (client: Client) =>
  rpcOn<{ granted: number; details: Record<string, number> }>(client, "grant_monthly_credits", [
    5,
    20,
    30,
    MONTHLY_REFERENCE_DATE,
  ]);

const grantMonthlyCapped = (client: Client) =>
  rpcOn<{ granted: number; details: Record<string, number> }>(client, "grant_monthly_credits", [
    5,
    5,
    30,
    MONTHLY_REFERENCE_DATE,
  ]);

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeAll(async () => {
  monitor = new Client({
    connectionString: CONNECTION_STRING,
    application_name: "f50_4_conc_monitor",
  });
  await monitor.connect();

  const { rows } = await monitor.query<{ sentinels: number; settings: number }>(`
    select
      (select count(*)::int from public.f50_4_harness_identity where purpose = 'disposable') as sentinels,
      (select count(*)::int from public.trial_offer_settings where offer_key = 'trial_28d_v1') as settings
  `);
  if ((rows[0]?.sentinels ?? 0) < 1) {
    throw new Error("Sentinela f50_4_harness_identity ausente: alvo não é o descartável.");
  }
  if ((rows[0]?.settings ?? 0) !== 1) {
    throw new Error("trial_offer_settings ausente: alvo não é o banco descartável esperado.");
  }

  const launch = await monitor.query<{ launch_at: string }>(
    "select launch_at from public.trial_offer_settings where offer_key = 'trial_28d_v1'",
  );
  expect(new Date(launch.rows[0].launch_at).toISOString()).toBe(
    new Date(LAUNCH_AT).toISOString(),
  );

  const individual = await monitor.query<{ individual_launch_at: string | null }>(
    "select individual_launch_at from public.trial_offer_settings where offer_key = 'trial_28d_v1'",
  );
  originalIndividualLaunchAt = individual.rows[0]?.individual_launch_at
    ? new Date(individual.rows[0].individual_launch_at).toISOString()
    : null;

  // Ativação CONTROLADA e exclusiva do descartável para exercitar per_cnpj_f50_4.
  // Revertida em afterAll; produção nunca é tocada.
  await monitor.query(
    "update public.trial_offer_settings set individual_launch_at = $1 where offer_key = 'trial_28d_v1'",
    [INDIVIDUAL_LAUNCH_AT],
  );
});

afterEach(async () => {
  const stores = createdStoreIds.splice(0);
  const users = createdUserIds.splice(0);
  if (stores.length === 0 && users.length === 0) return;

  await monitor.query("SET session_replication_role = replica");
  try {
    if (stores.length > 0) {
      await monitor.query("delete from public.product_events where store_id = any($1::uuid[])", [stores]);
      await monitor.query("delete from public.credit_notifications where store_id = any($1::uuid[])", [stores]);
      await monitor.query("delete from public.admin_audit_log where target_id = any($1::uuid[])", [stores]);
      await monitor.query("delete from public.freemium_entitlements where store_id = any($1::uuid[])", [stores]);
      await monitor.query("delete from public.credit_transactions where store_id = any($1::uuid[])", [stores]);
      await monitor.query("delete from public.credit_balances where store_id = any($1::uuid[])", [stores]);
      await monitor.query("delete from public.trial_offer_enrollments where store_id = any($1::uuid[])", [stores]);
      await monitor.query("delete from public.stores where id = any($1::uuid[])", [stores]);
    }
    if (users.length > 0) {
      await monitor.query("delete from public.admin_audit_log where actor_id = any($1::uuid[])", [users]);
      await monitor.query("delete from public.freemium_entitlements where granted_by = any($1::uuid[])", [users]);
      await monitor.query("delete from auth.users where id = any($1::uuid[])", [users]);
    }
  } finally {
    await monitor.query("SET session_replication_role = origin");
  }
});

afterAll(async () => {
  await monitor.query(
    "update public.trial_offer_settings set individual_launch_at = $1 where offer_key = 'trial_28d_v1'",
    [originalIndividualLaunchAt],
  );

  const scenarios = SCENARIO_IDS.map((id) => {
    const result = scenarioResults.get(id)!;
    return {
      ...result,
      evidence: `${path.relative(process.cwd(), TEST_FILE).replace(/\\/g, "/")}#L${lineFor(id)}`,
    };
  });

  const failed = scenarios.filter((scenario) => scenario.status !== "PASS").length;
  const payload = {
    phase: "50.4",
    concurrency: {
      exit_code: failed === 0 ? 0 : 1,
      deadlocks,
      scenarios,
    },
  };
  writeFileSync(EVIDENCE_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  await monitor.end().catch(() => undefined);
});

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------
describe("F50.4 concorrência cruzada em PostgreSQL real (descartável)", () => {
  it("trial_x_demo_trial_first", async () => {
    const root = `root_conc_trial_first_${crypto.randomUUID()}`;
    const trialStore = await createStore({
      label: "trial-first-trial",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0002",
      onboardingAt: "2026-10-21T00:00:00Z",
    });
    const demoStore = await createStore({
      label: "trial-first-demo",
      rootHash: root,
      userCreatedAt: PRE_LAUNCH,
      branch: "0003",
    });

    const out = await runOrdered(
      (client) => startTrial(client, trialStore.storeId),
      (client) => grantDemo(client, demoStore.storeId, root),
    );

    expect(out.first.status).toBe("started");
    expect(out.second.granted).toBe(false);
    expect(out.second.reason).toBe("trial_offer_consumed");
    const counts = await monitor.query<{ enrollments: number; demos: number }>(
      `select
         (select count(*)::int from public.trial_offer_enrollments where root_hash = $1) as enrollments,
         (select count(*)::int from public.credit_transactions where store_id = $2 and type = 'demo') as demos`,
      [root, demoStore.storeId],
    );
    expect(counts.rows[0].enrollments).toBe(1);
    expect(counts.rows[0].demos).toBe(0);
    expect(out.blocked).toBe(true);
    pass("trial_x_demo_trial_first", out.observed, "demo bloqueada por enrollment root_legacy");
  });

  it("trial_x_demo_demo_first", async () => {
    const root = `root_conc_demo_first_${crypto.randomUUID()}`;
    const trialStore = await createStore({
      label: "demo-first-trial",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0002",
      onboardingAt: "2026-10-21T00:00:00Z",
    });
    const demoStore = await createStore({
      label: "demo-first-demo",
      rootHash: root,
      userCreatedAt: PRE_LAUNCH,
      branch: "0003",
    });

    const out = await runOrdered(
      (client) => grantDemo(client, demoStore.storeId, root),
      (client) => startTrial(client, trialStore.storeId),
    );

    expect(out.first.granted).toBe(true);
    expect(out.second.status).toBe("not_eligible");
    expect(out.second.reason).toBe("prior_benefit");
    const counts = await monitor.query<{ enrollments: number }>(
      "select count(*)::int as enrollments from public.trial_offer_enrollments where root_hash = $1",
      [root],
    );
    expect(counts.rows[0].enrollments).toBe(0);
    expect(out.blocked).toBe(true);
    pass("trial_x_demo_demo_first", out.observed, "trial bloqueado por benefício demo anterior");
  });

  it("trial_x_monthly_trial_first", async () => {
    const root = `root_conc_monthly_trial_first_${crypto.randomUUID()}`;
    const trialStore = await createStore({
      label: "monthly-trial-first",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0002",
      onboardingAt: "2026-10-21T00:00:00Z",
    });
    await createMonthlyRecipient(root, "monthly-recipient-first");

    const out = await runOrdered(
      (client) => startTrial(client, trialStore.storeId),
      (client) => grantMonthly(client),
    );

    expect(out.first.status).toBe("started");
    expect(out.second.granted).toBe(0);
    expect(out.second.details.skipped_trial_offer_cohort).toBeGreaterThanOrEqual(1);
    const monthly = await monitor.query<{ count: number }>(
      `select count(*)::int as count from public.credit_transactions
        where type = 'bonus_monthly' and idempotency_key like $1`,
      [`mensal_${MONTHLY_CYCLE}_${root}`],
    );
    expect(monthly.rows[0].count).toBe(0);
    expect(out.blocked).toBe(true);
    pass("trial_x_monthly_trial_first", out.observed, "mensal pulou a raiz com enrollment root_legacy");
  });

  it("trial_x_monthly_monthly_first", async () => {
    const root = `root_conc_monthly_first_${crypto.randomUUID()}`;
    const trialStore = await createStore({
      label: "monthly-first-trial",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0002",
      onboardingAt: "2026-10-21T00:00:00Z",
    });
    await createMonthlyRecipient(root, "monthly-recipient-second");

    const out = await runOrdered(
      (client) => grantMonthly(client),
      (client) => startTrial(client, trialStore.storeId),
    );

    expect(out.first.granted).toBe(1);
    expect(out.second.status).toBe("started");
    const counts = await monitor.query<{ enrollments: number; monthly: number }>(
      `select
         (select count(*)::int from public.trial_offer_enrollments where root_hash = $1) as enrollments,
         (select count(*)::int from public.credit_transactions
           where type = 'bonus_monthly' and idempotency_key = $2) as monthly`,
      [root, `mensal_${MONTHLY_CYCLE}_${root}`],
    );
    expect(counts.rows[0].enrollments).toBe(1);
    expect(counts.rows[0].monthly).toBe(1);
    expect(out.blocked).toBe(true);
    pass("trial_x_monthly_monthly_first", out.observed, "mensal concedido antes; trial inscreveu depois");
  });

  it("trial_x_exception_exception_first", async () => {
    const root = `root_conc_exception_first_${crypto.randomUUID()}`;
    const actor = await createActor();
    const trialStore = await createStore({
      label: "exception-first-trial",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0002",
      onboardingAt: "2026-10-21T00:00:00Z",
    });
    const exceptionStore = await createStore({
      label: "exception-first-store",
      rootHash: root,
      userCreatedAt: PRE_LAUNCH,
      branch: "0003",
    });

    const out = await runOrdered(
      (client) =>
        rpcOn<{ success: boolean }>(client, "admin_grant_freemium_exception", [
          exceptionStore.storeId,
          "concurrency probe exception",
          actor,
        ]),
      (client) => startTrial(client, trialStore.storeId),
    );

    expect(out.first.success).toBe(true);
    expect(out.second.status).toBe("not_eligible");
    expect(out.second.reason).toBe("prior_benefit");
    expect(out.blocked).toBe(true);
    pass("trial_x_exception_exception_first", out.observed, "exceção concedida; trial viu prior_benefit");
  });

  it("trial_x_exception_trial_first", async () => {
    const root = `root_conc_trial_exception_${crypto.randomUUID()}`;
    const actor = await createActor();
    const trialStore = await createStore({
      label: "trial-first-exception",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0002",
      onboardingAt: "2026-10-21T00:00:00Z",
    });
    const exceptionStore = await createStore({
      label: "trial-first-exception-store",
      rootHash: root,
      userCreatedAt: PRE_LAUNCH,
      branch: "0003",
    });

    const out = await runOrdered(
      (client) => startTrial(client, trialStore.storeId),
      (client) =>
        rpcOn<{ success: boolean }>(client, "admin_grant_freemium_exception", [
          exceptionStore.storeId,
          "concurrency probe exception",
          actor,
        ]),
    );

    expect(out.first.status).toBe("started");
    expect(out.second.success).toBe(true);
    const counts = await monitor.query<{ enrollments: number; exceptions: number }>(
      `select
         (select count(*)::int from public.trial_offer_enrollments where root_hash = $1) as enrollments,
         (select count(*)::int from public.freemium_entitlements
           where root_hash = $1 and benefit_type = 'admin_exception') as exceptions`,
      [root],
    );
    expect(counts.rows[0].enrollments).toBe(1);
    expect(counts.rows[0].exceptions).toBe(1);
    expect(out.blocked).toBe(true);
    pass("trial_x_exception_trial_first", out.observed, "enrollment preservado; exceção manual ainda concedida");
  });

  it("demo_x_exception", async () => {
    const root = `root_conc_demo_exception_${crypto.randomUUID()}`;
    const actor = await createActor();
    const demoStore = await createStore({
      label: "demo-exception-demo",
      rootHash: root,
      userCreatedAt: PRE_LAUNCH,
      branch: "0002",
    });
    const exceptionStore = await createStore({
      label: "demo-exception-store",
      rootHash: root,
      userCreatedAt: PRE_LAUNCH,
      branch: "0003",
    });

    const out = await runOrdered(
      (client) =>
        rpcOn<{ success: boolean }>(client, "admin_grant_freemium_exception", [
          exceptionStore.storeId,
          "concurrency probe exception",
          actor,
        ]),
      (client) => grantDemo(client, demoStore.storeId, root),
    );

    expect(out.first.success).toBe(true);
    expect(out.second.granted).toBe(false);
    expect(out.second.reason).toBe("admin_exception_consumed");
    expect(out.blocked).toBe(true);
    pass("demo_x_exception", out.observed, "demo bloqueada pela exceção administrativa da raiz");
  });

  it("per_cnpj_x_root_legacy", async () => {
    const root = `root_conc_coexist_${crypto.randomUUID()}`;
    const perCnpjStore = await createStore({
      label: "coexist-per-cnpj",
      rootHash: root,
      userCreatedAt: POST_INDIVIDUAL,
      branch: "0002",
      onboardingAt: "2026-10-22T01:00:00Z",
    });
    const rootLegacyStore = await createStore({
      label: "coexist-root-legacy",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0003",
      onboardingAt: "2026-10-21T00:00:00Z",
    });

    const out = await runOrdered(
      (client) => startTrial(client, perCnpjStore.storeId),
      (client) => startTrial(client, rootLegacyStore.storeId),
    );

    expect(out.first.status).toBe("started");
    expect(out.first.policy_cohort).toBe("per_cnpj_f50_4");
    expect(out.second.status).toBe("started");
    expect(out.second.policy_cohort).toBe("root_legacy");
    const counts = await monitor.query<{ enrollments: number }>(
      "select count(*)::int as enrollments from public.trial_offer_enrollments where root_hash = $1",
      [root],
    );
    expect(counts.rows[0].enrollments).toBe(2);
    pass("per_cnpj_x_root_legacy", out.observed, "filial per_cnpj e conta root_legacy coexistiram");
  });

  it("two_branches_same_root", async () => {
    const root = `root_conc_two_branches_${crypto.randomUUID()}`;
    const branchA = await createStore({
      label: "two-branches-a",
      rootHash: root,
      userCreatedAt: POST_INDIVIDUAL,
      branch: "0002",
      onboardingAt: "2026-10-22T01:00:00Z",
    });
    const branchB = await createStore({
      label: "two-branches-b",
      rootHash: root,
      userCreatedAt: POST_INDIVIDUAL,
      branch: "0003",
      onboardingAt: "2026-10-22T01:00:00Z",
    });

    const out = await runOrdered(
      (client) => startTrial(client, branchA.storeId),
      (client) => startTrial(client, branchB.storeId),
    );

    expect(out.first.status).toBe("started");
    expect(out.second.status).toBe("started");
    const counts = await monitor.query<{ enrollments: number; grants: number }>(
      `select
         (select count(*)::int from public.trial_offer_enrollments where root_hash = $1) as enrollments,
         (select count(*)::int from public.credit_transactions
           where metadata->>'credit_program' = 'trial_28d' and store_id = any($2::uuid[])) as grants`,
      [root, [branchA.storeId, branchB.storeId]],
    );
    expect(counts.rows[0].enrollments).toBe(2);
    expect(counts.rows[0].grants).toBe(2);
    expect(out.blocked).toBe(true);
    pass("two_branches_same_root", out.observed, "duas filiais per_cnpj criaram enrollment e grant");
  });

  it("same_store_concurrent", async () => {
    const root = `root_conc_same_store_${crypto.randomUUID()}`;
    const store = await createStore({
      label: "same-store",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0002",
      onboardingAt: "2026-10-21T00:00:00Z",
    });

    const out = await runOrdered(
      (client) => startTrial(client, store.storeId),
      (client) => startTrial(client, store.storeId),
    );

    expect(out.first.status).toBe("started");
    expect(out.second.status).toBe("existing");
    const counts = await monitor.query<{ enrollments: number; grants: number }>(
      `select
         (select count(*)::int from public.trial_offer_enrollments where store_id = $1) as enrollments,
         (select count(*)::int from public.credit_transactions
           where store_id = $1 and metadata->>'credit_program' = 'trial_28d') as grants`,
      [store.storeId],
    );
    expect(counts.rows[0].enrollments).toBe(1);
    expect(counts.rows[0].grants).toBe(1);
    expect(out.blocked).toBe(true);
    pass("same_store_concurrent", out.observed, "um enrollment e um grant para o mesmo store_id");
  });

  it("monthly_multiple_roots", async () => {
    const roots = [
      `root_conc_multi_a_${crypto.randomUUID()}`,
      `root_conc_multi_b_${crypto.randomUUID()}`,
      `root_conc_multi_c_${crypto.randomUUID()}`,
    ];
    for (const [index, root] of roots.entries()) {
      await createMonthlyRecipient(root, `multi-root-${index}`);
    }

    const out = await runOrdered(
      (client) => grantMonthly(client),
      (client) => grantMonthly(client),
    );

    expect(out.first.granted).toBe(roots.length);
    expect(out.second.granted).toBe(0);
    const counts = await monitor.query<{ monthly: number }>(
      `select count(*)::int as monthly from public.credit_transactions
        where type = 'bonus_monthly' and idempotency_key like $1`,
      [`mensal_${MONTHLY_CYCLE}_root_conc_multi_%`],
    );
    expect(counts.rows[0].monthly).toBe(roots.length);
    expect(out.blocked).toBe(true);
    expect(deadlocks).toBe(0);
    pass("monthly_multiple_roots", out.observed, "múltiplas raízes sem deadlock; cada uma concedida uma vez");
  });

  it("monthly_x_admin_grant_cap", async () => {
    const root = `root_conc_cap_${crypto.randomUUID()}`;
    const actor = await createActor();
    const recipient = await createMonthlyRecipient(root, "cap-recipient", 4);

    const out = await runOrdered(
      (client) =>
        rpcOn<{ transaction_id: string }>(client, "admin_grant_credits", [
          actor,
          recipient.storeId,
          5,
          "concurrency cap probe",
          crypto.randomUUID(),
          "{}",
        ]),
      (client) => grantMonthlyCapped(client),
    );

    expect(out.first.transaction_id).toBeTruthy();
    expect(out.second.granted).toBe(0);
    expect(out.second.details.skipped_bonus_threshold).toBeGreaterThanOrEqual(1);

    const state = await monitor.query<{ bonus: number; entitlements: number }>(
      `select
         (select bonus_balance from public.credit_balances where store_id = $1) as bonus,
         (select count(*)::int from public.freemium_entitlements
           where root_hash = $2 and benefit_type = 'monthly' and cycle = $3) as entitlements`,
      [recipient.storeId, root, MONTHLY_CYCLE],
    );
    expect(state.rows[0].bonus).toBe(9);
    expect(state.rows[0].entitlements).toBe(0);
    expect(out.blocked).toBe(true);
    pass(
      "monthly_x_admin_grant_cap",
      out.observed,
      "mensal observou saldo commitado acima do cap e não criou entitlement",
    );
  });

  it("installment_vs_root_decision", async () => {
    const root = `root_conc_installment_${crypto.randomUUID()}`;
    const store = await createStore({
      label: "installment-store",
      rootHash: root,
      userCreatedAt: POST_LAUNCH_ROOT,
      branch: "0002",
      onboardingAt: "2026-10-21T00:00:00Z",
    });

    const clientA = await newClient("advisory-holder");
    const clientB = await newClient("installment");
    try {
      const enrollment = await startTrial(clientA, store.storeId);
      expect(enrollment.status).toBe("started");
      expect(enrollment.enrollment_id).toBeTruthy();

      await beginTx(clientA);
      await clientA.query(
        "select pg_advisory_xact_lock(hashtextextended('vendeo:benefit:' || $1, 0))",
        [root],
      );

      await beginTx(clientB);
      const bPid = await pidOf(clientB);
      let settled = false;
      const work = (async () => {
        const grant = await rpcOn<{ granted: boolean; grant_tx_id: string }>(
          clientB,
          "grant_trial_offer_installment",
          [enrollment.enrollment_id, 1, "2026-10-29T00:00:00Z"],
        );
        const deduction = await rpcOn<string>(clientB, "reserve_credit", [
          store.storeId,
          1,
          null,
          `reserve_${crypto.randomUUID()}`,
          "{}",
        ]);
        const refund = await rpcOn<string>(clientB, "refund_credit", [
          deduction,
          "concurrency refund probe",
          `refund_${crypto.randomUUID()}`,
          "{}",
        ]);
        return { grant, refund };
      })().then((value) => {
        settled = true;
        return value;
      });

      await sleep(600);
      const observedWait = settled ? "none" : JSON.stringify(await waitForLock(bPid, 1000));
      expect(settled).toBe(true);
      const result = await work;
      expect(result.grant.granted).toBe(true);
      expect(result.refund).toBeTruthy();

      await clientA.query("COMMIT");
      await clientB.query("COMMIT");
      pass("installment_vs_root_decision", "none", `parcela/estorno sem advisory de raiz (${observedWait})`);
    } finally {
      await clientA.query("ROLLBACK").catch(() => undefined);
      await clientB.query("ROLLBACK").catch(() => undefined);
      await clientA.end().catch(() => undefined);
      await clientB.end().catch(() => undefined);
    }
  });

  it("matriz completa sem deadlock 40P01", () => {
    const failed = SCENARIO_IDS.filter((id) => scenarioResults.get(id)?.status !== "PASS");
    expect(failed).toEqual([]);
    expect(deadlocks).toBe(0);
  });
});
