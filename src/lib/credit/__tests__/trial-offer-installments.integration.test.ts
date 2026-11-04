/**
 * F50.2 — Integração real das parcelas do teste gratuito de 28 dias.
 *
 * Prova, em PostgreSQL descartável:
 *  - recuperação tardia: uma execução em ~dia 21 concede as parcelas 1/2/3
 *    (seq 1, 2 e 3) na mesma chamada, totalizando 20 créditos;
 *  - expiração única compartilhada entre as quatro concessões;
 *  - idempotência real: repetir a execução não cria novas transações.
 *
 * Regras de segurança (espelham f50-4-concurrency.test.ts):
 *  - Opt-in explícito por F50_4_RUN_CONCURRENCY=1. Sem opt-in, a suíte é
 *    skipped e nenhuma conexão é aberta.
 *  - Alvo fail-closed: 127.0.0.1|localhost, porta F50_4_DB_PORT (default
 *    54422), database /postgres.
 *  - Exige a sentinela public.f50_4_harness_identity com purpose='disposable'.
 *  - Nenhuma evidência é escrita em `.planning`.
 *
 * Este teste apenas consome as RPCs existentes; nenhuma migration ou concessão
 * manual é executada.
 */
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.F50_4_RUN_CONCURRENCY === "1";

if (!RUN) {
  console.info(
    "[trial-offer-installments] suite skipped: set F50_4_RUN_CONCURRENCY=1 and F50_4_DB_URL to run against the disposable database.",
  );
}

const DB_URL = process.env.F50_4_DB_URL ?? process.env.TEST_DATABASE_URL ?? "";
const EXPECTED_PORT = process.env.F50_4_DB_PORT ?? "54422";

function assertDisposableTarget(): string {
  if (!DB_URL) {
    throw new Error(
      "F50_4_DB_URL/TEST_DATABASE_URL ausente: a suíte de integração exige o PostgreSQL descartável (fail-closed).",
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
  if (parsed.pathname !== "/postgres") {
    throw new Error(`Database recusado: ${parsed.pathname}. Esperado /postgres.`);
  }
  return DB_URL;
}

const CONNECTION_STRING = RUN ? assertDisposableTarget() : "";

const FALLBACK_LAUNCH_AT = "2026-10-20T21:25:31.344856Z";

let client: Client;
let launchAt = FALLBACK_LAUNCH_AT;
let startedAt = "";
let runAt = "";
let originalSettings: { enabled: boolean; launch_at: string | null } | null = null;

const createdUserIds: string[] = [];
const createdStoreIds: string[] = [];

let cnpjCounter = 0;

function nextCnpj(): string {
  cnpjCounter += 1;
  // 8 dígitos de raiz + 4 de filial + 2 de DV => 14 caracteres [A-Z0-9]{12}[0-9]{2}
  const root = String(91000000 + cnpjCounter).padStart(8, "0");
  return `${root}000195`;
}

async function rpcOn<T>(name: string, args: unknown[]): Promise<T> {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(", ");
  const result = await client.query<{ value: T }>(
    `select public.${name}(${placeholders}) as value`,
    args,
  );
  return result.rows[0].value;
}

async function createStore(): Promise<string> {
  const userId = crypto.randomUUID();
  const storeId = crypto.randomUUID();
  createdUserIds.push(userId);
  createdStoreIds.push(storeId);

  await client.query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, $3, $3)",
    [userId, `trial-installments-${userId}@test.local`, startedAt],
  );
  await client.query(
    `insert into public.stores
       (id, name, segment, user_id, cnpj_normalized, cnpj_root_hash, created_at, onboarding_completed_at, is_test_store)
     values ($1, $2, 'outros', $3, $4, $5, $6, $6, false)`,
    [
      storeId,
      "trial installments fixture",
      userId,
      nextCnpj(),
      `root_trial_installments_${crypto.randomUUID()}`,
      startedAt,
    ],
  );
  return storeId;
}

beforeAll(async () => {
  if (!RUN) return;
  client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  await client.query("SET application_name = 'f50_2_trial_installments'");

  const sentinel = await client.query<{ sentinels: number }>(
    "select count(*)::int as sentinels from public.f50_4_harness_identity where purpose = 'disposable'",
  );
  if ((sentinel.rows[0]?.sentinels ?? 0) < 1) {
    throw new Error("Sentinela f50_4_harness_identity ausente: alvo não é o descartável.");
  }

  const settings = await client.query<{ enabled: boolean; launch_at: string | null }>(
    "select enabled, launch_at from public.trial_offer_settings where offer_key = 'trial_28d_v1'",
  );
  if (settings.rows.length !== 1) {
    throw new Error("trial_offer_settings ausente: alvo não é o banco descartável esperado.");
  }
  originalSettings = settings.rows[0];
  launchAt = originalSettings.launch_at
    ? new Date(originalSettings.launch_at).toISOString()
    : FALLBACK_LAUNCH_AT;

  // Ativação CONTROLADA e exclusiva do descartável para que a inscrição seja
  // elegível. Revertida em afterAll; produção nunca é tocada.
  await client.query(
    `update public.trial_offer_settings
        set enabled = true, launch_at = coalesce(launch_at, $1)
      where offer_key = 'trial_28d_v1'`,
    [launchAt],
  );

  // Início do enrollment: dia 0, dentro da janela de 28 dias em relação a run_at.
  startedAt = new Date(new Date(launchAt).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  runAt = new Date(new Date(startedAt).getTime() + 21 * 24 * 60 * 60 * 1000).toISOString();
}, 60000);

afterEach(async () => {
  if (!RUN) return;
  const stores = createdStoreIds.splice(0);
  const users = createdUserIds.splice(0);
  if (stores.length === 0 && users.length === 0) return;

  await client.query("SET session_replication_role = replica");
  try {
    if (stores.length > 0) {
      await client.query("delete from public.product_events where store_id = any($1::uuid[])", [stores]);
      await client.query("delete from public.credit_notifications where store_id = any($1::uuid[])", [stores]);
      await client.query("delete from public.admin_audit_log where target_id = any($1::uuid[])", [stores]);
      await client.query("delete from public.freemium_entitlements where store_id = any($1::uuid[])", [stores]);
      await client.query("delete from public.credit_transactions where store_id = any($1::uuid[])", [stores]);
      await client.query("delete from public.credit_balances where store_id = any($1::uuid[])", [stores]);
      await client.query("delete from public.trial_offer_enrollments where store_id = any($1::uuid[])", [stores]);
      await client.query("delete from public.stores where id = any($1::uuid[])", [stores]);
    }
    if (users.length > 0) {
      await client.query("delete from public.admin_audit_log where actor_id = any($1::uuid[])", [users]);
      await client.query("delete from public.freemium_entitlements where granted_by = any($1::uuid[])", [users]);
      await client.query("delete from auth.users where id = any($1::uuid[])", [users]);
    }
  } finally {
    await client.query("SET session_replication_role = origin");
  }
}, 60000);

afterAll(async () => {
  if (!RUN) return;
  if (client && originalSettings) {
    await client.query(
      "update public.trial_offer_settings set enabled = $1, launch_at = $2 where offer_key = 'trial_28d_v1'",
      [originalSettings.enabled, originalSettings.launch_at],
    );
  }
  if (client) await client.end().catch(() => undefined);
}, 60000);

describe.skipIf(!RUN)(
  "F50.2 parcelas do teste gratuito em PostgreSQL real (descartável, opt-in F50_4_RUN_CONCURRENCY=1)",
  () => {
    it("recupera as parcelas 1/2/3 em uma execução tardia e é idempotente na repetição", async () => {
      const storeId = await createStore();

      const enrollment = await rpcOn<{
        status: string;
        enrollment_id: string;
        expires_at: string;
        grant: { granted: boolean; granted_total: number };
      }>("start_trial_offer_enrollment", [storeId, startedAt]);

      expect(enrollment.status).toBe("started");
      expect(enrollment.grant.granted).toBe(true);
      expect(enrollment.grant.granted_total).toBe(5);

      const seeded = await client.query<{
        granted_total: number;
        last_granted_seq: number;
        expires_at: string;
      }>(
        "select granted_total, last_granted_seq, expires_at from public.trial_offer_enrollments where store_id = $1",
        [storeId],
      );
      expect(seeded.rows[0].granted_total).toBe(5);
      expect(seeded.rows[0].last_granted_seq).toBe(0);

      const firstRun = await rpcOn<{ granted: number; skipped: number; errors: number }>(
        "process_trial_offer_installments",
        [runAt],
      );
      expect(firstRun.errors).toBe(0);
      // O RPC processa todos os enrollments do banco descartável; a prova
      // desta fixture vem das asserções por store_id abaixo.
      expect(firstRun.granted).toBeGreaterThanOrEqual(3);

      const afterRun = await client.query<{
        granted_total: number;
        last_granted_seq: number;
        expires_at: string;
      }>(
        "select granted_total, last_granted_seq, expires_at from public.trial_offer_enrollments where store_id = $1",
        [storeId],
      );
      expect(afterRun.rows[0].last_granted_seq).toBe(3);
      expect(afterRun.rows[0].granted_total).toBe(20);

      const transactions = await client.query<{ seq: number; expires_at: string }>(
        `select (metadata->>'installment_seq')::int as seq,
                metadata->>'expires_at' as expires_at
           from public.credit_transactions
          where store_id = $1
            and type = 'demo'
            and metadata->>'credit_program' = 'trial_28d'
          order by (metadata->>'installment_seq')::int`,
        [storeId],
      );
      expect(transactions.rows.map((row) => row.seq)).toEqual([0, 1, 2, 3]);
      const distinctExpiries = new Set(transactions.rows.map((row) => row.expires_at));
      expect(distinctExpiries.size).toBe(1);
      expect(new Date(transactions.rows[0].expires_at).toISOString()).toBe(
        new Date(afterRun.rows[0].expires_at).toISOString(),
      );

      const balance = await client.query<{ demo_balance: number; demo_expires_at: string }>(
        "select demo_balance, demo_expires_at from public.credit_balances where store_id = $1",
        [storeId],
      );
      expect(balance.rows[0].demo_balance).toBe(20);
      expect(new Date(balance.rows[0].demo_expires_at).toISOString()).toBe(
        new Date(afterRun.rows[0].expires_at).toISOString(),
      );

      const secondRun = await rpcOn<{ granted: number; skipped: number; errors: number }>(
        "process_trial_offer_installments",
        [runAt],
      );
      expect(secondRun.errors).toBe(0);

      const counts = await client.query<{ transactions: number }>(
        `select count(*)::int as transactions
           from public.credit_transactions
          where store_id = $1 and type = 'demo'`,
        [storeId],
      );
      expect(counts.rows[0].transactions).toBe(4);

      const afterRepeat = await client.query<{
        granted_total: number;
        last_granted_seq: number;
      }>(
        "select granted_total, last_granted_seq from public.trial_offer_enrollments where store_id = $1",
        [storeId],
      );
      expect(afterRepeat.rows[0].granted_total).toBe(20);
      expect(afterRepeat.rows[0].last_granted_seq).toBe(3);

      const balanceAfterRepeat = await client.query<{ demo_balance: number }>(
        "select demo_balance from public.credit_balances where store_id = $1",
        [storeId],
      );
      expect(balanceAfterRepeat.rows[0].demo_balance).toBe(20);
    });
  },
);
