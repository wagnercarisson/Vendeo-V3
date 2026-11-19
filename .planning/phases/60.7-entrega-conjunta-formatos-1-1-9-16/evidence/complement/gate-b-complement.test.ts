import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CompositionVerticalProbe } from "@/lib/product-9-16-two-stage/orchestration/vertical-probe";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import { CompositionArtifactStorage } from "@/lib/campaign/composition-artifacts/storage";
import { TwoFormatJointFinancialClient } from "@/lib/product-two-format/joint-financial-client";
import { readTwoFormatDelivery } from "@/lib/product-two-format/delivery-reader";
import {
  CompositionSquareOriginalProbe,
} from "@/lib/product-two-format/orchestration/square-probe";
import {
  resolveJointPending,
  type JointResolutionDeps,
  type JointResolutionStateResult,
} from "@/lib/product-two-format/orchestration/resolve-joint-pending";

/**
 * F60.7 — complemento base do Gate de banco (sem Storage de arte).
 *
 * Executa SOMENTE a camada base autorizada em 2026-11-19:
 * - resolveJointPending com dependências reais/test-only;
 * - refunds com arte ausente (a sonda consulta o path canônico e comprova
 *   ausência, sem upload/leitura de bytes de arte real);
 * - PostgREST real com chamadas não mutantes/negadas.
 *
 * NÃO executa J3 (arte integral/Storage sintético), restore/database
 * descartável, migration, provider, produção, C ou publicação.
 *
 * Fixtures: prefixo f60721..., preservadas e inventariadas.
 */

const REPO_ROOT = process.cwd();
const EVIDENCE_DIR = resolve(
  REPO_ROOT,
  ".planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/evidence",
);
const CONFIG_ID = "f6072100-0000-4000-8000-000000000008";
const MODEL = "gpt-image-2.5-flare";
const QUALITY = "low";
const SNAPSHOT = {
  campaignFormat: "1:1+9:16",
  formatContractVersion: "f60.7-two-format-v1",
  generationOrigin: "two_format_two_stage",
  generationContractVersion: "f60.7-two-format-v1",
};

function loadLocalEnv(): void {
  const path = resolve(REPO_ROOT, ".env.local");
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of content.split(/\r?\n/)) {
    if (line === "" || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index);
    if (process.env[key] === undefined) {
      process.env[key] = line.slice(index + 1);
    }
  }
}
loadLocalEnv();

const AUTHORIZED =
  process.env.F607_COMPLEMENT_AUTHORIZED === "1" &&
  process.env.F607_HOMOLOG_AUTHORIZED === "1" &&
  (process.env.F607_AUTHORIZATION_REF ?? "").trim() !== "";
const DB_URL = process.env.TEST_DATABASE_URL ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const results: Array<Record<string, unknown>> = [];
const storageChecks: Array<Record<string, unknown>> = [];
const postgrestChecks: Array<Record<string, unknown>> = [];
let baseline: Record<string, number> = {};
let pg: Client;
let sb: SupabaseClient;

function ids(code: string) {
  if (!/^[0-9a-f]{4}$/.test(code)) throw new Error(`código inválido: ${code}`);
  const suffix = (n: number) =>
    `f607${code}-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return {
    user: suffix(1),
    store: suffix(2),
    campaign: suffix(3),
    shared: suffix(4),
    square: suffix(5),
    artifact: suffix(6),
    resolution: suffix(7),
    extra: suffix(8),
  };
}

interface Fixture {
  code: string;
  label: string;
  user: string;
  store: string;
  campaign: string;
  shared: string;
  square: string;
}

function assertTarget(): void {
  if (!AUTHORIZED) return;
  let url: URL;
  try {
    url = new URL(DB_URL);
  } catch {
    throw new Error("TEST_DATABASE_URL inválida");
  }
  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "57782" ||
    url.pathname !== "/postgres"
  ) {
    throw new Error("alvo recusado: esperado 127.0.0.1:57782/postgres");
  }
  if (SUPABASE_URL !== "http://127.0.0.1:57781") {
    throw new Error("PostgREST recusado: esperado http://127.0.0.1:57781");
  }
  if (!SERVICE_KEY || !ANON_KEY) {
    throw new Error("chaves locais ausentes");
  }
}

async function runCase(
  id: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<void> {
  try {
    const result = await fn();
    results.push({ id, status: "PASS", result });
  } catch (error) {
    results.push({
      id,
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function createFixture(code: string, label: string): Promise<Fixture> {
  const f = { code, label, ...ids(code) };
  await pg.query("BEGIN");
  try {
    await pg.query(
      `insert into auth.users (id, aud, role, email, created_at, updated_at)
       values ($1, 'authenticated', 'authenticated', $2, now(), now())`,
      [f.user, `f607-complement-${code}@f607.test`],
    );
    await pg.query(
      `insert into public.stores (id, user_id, name, segment, is_test_store)
       values ($1, $2, $3, 'variedades-utilidades', true)`,
      [f.store, f.user, `[F60.7 Gate B] J${label}`.slice(0, 60)],
    );
    await pg.query(
      `insert into public.campaigns
         (id, store_id, status, product_name, input_snapshot, storage_path)
       values ($1, $2, 'generating', $3, $4::jsonb, $5)`,
      [
        f.campaign,
        f.store,
        `[F60.7 Gate B] J${label}`,
        JSON.stringify(SNAPSHOT),
        `f607/${f.campaign}`,
      ],
    );
    await pg.query(
      `select public.grant_credits($1, 10, '[F60.7 Gate B] complement', $2, '{}'::jsonb)`,
      [f.store, `f607-complement-grant-${f.store}`],
    );
    await pg.query("COMMIT");
  } catch (error) {
    await pg.query("ROLLBACK").catch(() => {});
    throw error;
  }
  return f;
}

async function openJoint(f: Fixture): Promise<void> {
  const { rows } = await pg.query(
    `select public.product_two_format_open_delivery($1,$2,$3,$4,$5,$6,$7) as result`,
    [f.store, f.campaign, f.shared, f.square, MODEL, QUALITY, CONFIG_ID],
  );
  const result = rows[0]?.result as { success?: boolean } | null;
  expect(result?.success).toBe(true);
}

async function recordSharedFailed(f: Fixture, support: string): Promise<void> {
  const { rows } = await pg.query(
    `select public.product_9_16_record_outcome($1,$2,'base','failed',$3) as result`,
    [f.campaign, f.shared, support],
  );
  expect((rows[0]?.result as { success?: boolean } | null)?.success).toBe(true);
}

async function preseedAudit(
  f: Fixture,
  operationId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await pg.query(
    `insert into public.admin_audit_log
       (actor_id, action, target_type, target_id, reason, operation_id, metadata)
     values ($1, 'product_1_1_pending_resolution', 'campaign', $2, $3, $4, $5::jsonb)`,
    [
      f.user,
      f.campaign,
      `[F60.7 Gate B] J${f.label} divergent audit`,
      operationId,
      JSON.stringify(metadata),
    ],
  );
}

async function createIncompleteFixture(code: string, label: string): Promise<Fixture> {
  const f = await createFixture(code, label);
  const { rows } = await pg.query(
    `select public.product_9_16_open_operation_v2($1,$2,$3,$4,$5,$6) as result`,
    [f.store, f.campaign, f.shared, MODEL, QUALITY, CONFIG_ID],
  );
  expect((rows[0]?.result as { success?: boolean } | null)?.success).toBe(true);
  await pg.query(
    `insert into public.product_two_format_deliveries
       (campaign_id, operation_id, store_id, format, delivery_operation_id, artifact_role)
     values ($1, $2, $3, '9:16', $2, 'vertical')`,
    [f.campaign, f.shared, f.store],
  );
  return f;
}

function outcomeKind(row: { outcome?: string } | null): "none" | "failed" | "unknown" | "indeterminate" {
  if (row === null) return "none";
  if (row.outcome === "failed") return "failed";
  if (row.outcome === "unknown") return "unknown";
  return "indeterminate";
}

async function makeDeps(): Promise<JointResolutionDeps> {
  const credit = new ProductOneToOneCreditOperationClient(sb);
  const joint = new TwoFormatJointFinancialClient(sb);
  const attempts = new ProductOneToOneAttemptStartClient(sb);
  const squareProbe = new CompositionSquareOriginalProbe({ client: sb });
  const verticalProbe = new CompositionVerticalProbe({ client: sb });

  const readResolutionState = async (input: {
    campaignId: string;
    operationId: string;
    deliveryOperationId: string;
  }): Promise<JointResolutionStateResult> => {
    const campaign = await sb
      .from("campaigns")
      .select("store_id")
      .eq("id", input.campaignId)
      .maybeSingle();
    if (campaign.error) return { kind: "read_failed", reason: campaign.error.message };
    if (!campaign.data || typeof campaign.data.store_id !== "string") {
      return { kind: "absent" };
    }
    const storeId = campaign.data.store_id;

    const [own, shared] = await Promise.all([
      sb
        .from("product_1_1_campaign_credit_operations")
        .select("status, store_id")
        .eq("campaign_id", input.campaignId)
        .eq("operation_id", input.deliveryOperationId)
        .maybeSingle(),
      sb
        .from("product_1_1_campaign_credit_operations")
        .select("status, store_id")
        .eq("campaign_id", input.campaignId)
        .eq("operation_id", input.operationId)
        .maybeSingle(),
    ]);
    if (own.error || shared.error) {
      return { kind: "read_failed", reason: (own.error ?? shared.error)?.message ?? "credit" };
    }
    if (!own.data || !shared.data) return { kind: "absent" };

    const linksResult = await sb
      .from("product_two_format_deliveries")
      .select("format, operation_id, store_id, delivery_operation_id, artifact_role")
      .eq("campaign_id", input.campaignId)
      .eq("operation_id", input.operationId);
    if (linksResult.error) {
      return { kind: "read_failed", reason: linksResult.error.message };
    }
    const links = linksResult.data ?? [];
    const square = links.find((row) => row.format === "1:1");
    const vertical = links.find((row) => row.format === "9:16");
    const linkComplete =
      links.length === 2 &&
      square !== undefined &&
      vertical !== undefined &&
      square.operation_id === input.operationId &&
      vertical.operation_id === input.operationId &&
      square.delivery_operation_id !== input.operationId &&
      vertical.delivery_operation_id === input.operationId &&
      square.store_id === storeId &&
      vertical.store_id === storeId &&
      own.data.store_id === storeId &&
      shared.data.store_id === storeId &&
      square.artifact_role === "square_original" &&
      vertical.artifact_role === "vertical";

    const [ownOutcome, sharedOutcome] = await Promise.all([
      sb
        .from("product_1_1_generation_outcomes")
        .select("outcome")
        .eq("campaign_id", input.campaignId)
        .eq("operation_id", input.deliveryOperationId)
        .maybeSingle(),
      sb
        .from("product_9_16_two_stage_outcomes")
        .select("outcome")
        .eq("campaign_id", input.campaignId)
        .eq("operation_id", input.operationId)
        .maybeSingle(),
    ]);
    if (ownOutcome.error || sharedOutcome.error) {
      return {
        kind: "read_failed",
        reason: (ownOutcome.error ?? sharedOutcome.error)?.message ?? "outcome",
      };
    }
    const claim = await sb
      .from("product_generation_active_claims_v")
      .select("status")
      .eq("campaign_id", input.campaignId)
      .eq("operation_id", input.operationId)
      .eq("status", "in_progress");
    if (claim.error) return { kind: "read_failed", reason: claim.error.message };

    return {
      kind: "found",
      state: {
        storeId,
        creditStatus: own.data.status,
        outcomeKind: outcomeKind(ownOutcome.data),
        sharedOutcomeKind: outcomeKind(sharedOutcome.data),
        sharedCreditStatus: shared.data.status,
        activeClaim: (claim.data ?? []).length > 0,
        linkComplete,
      },
    };
  };

  return {
    readDelivery: (input) => readTwoFormatDelivery(input, { client: sb }),
    readResolutionState,
    probeSquare: squareProbe.probeSquareOriginal.bind(squareProbe),
    probeVertical: verticalProbe.probeVerticalArtifact.bind(verticalProbe),
    beginPublication: credit.beginPublication.bind(credit),
    abortPublication: credit.abortPublication.bind(credit),
    getPublicationEpoch: credit.getPublicationEpoch.bind(credit),
    recordFormatOutcome: async (input) => {
      await attempts.recordOperationOutcome(input);
    },
    deliverFormat: joint.deliverFormat.bind(joint),
    refundFormat: joint.refundFormat.bind(joint),
    writeAudit: async (entry) => {
      const { error } = await sb.from("admin_audit_log").insert({
        actor_id: entry.actorId,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId,
        reason: entry.reason,
        operation_id: entry.operationId,
        metadata: entry.metadata,
      });
      if (error) {
        throw Object.assign(new Error(error.message), { code: error.code });
      }
    },
    readAuditByOperationId: async (operationId) => {
      const { data, error } = await sb
        .from("admin_audit_log")
        .select("action, target_type, target_id, operation_id, metadata")
        .eq("operation_id", operationId)
        .limit(1)
        .maybeSingle();
      if (error) return { kind: "read_failed", reason: error.message };
      if (!data) return { kind: "absent" };
      return {
        kind: "found",
        record: {
          action: data.action,
          targetType: data.target_type,
          targetId: data.target_id,
          operationId: data.operation_id,
          metadata: data.metadata,
        },
      };
    },
  };
}

async function counts(): Promise<Record<string, number>> {
  const { rows } = await pg.query(
    `select
       (select count(*) from public.stores)::int as stores,
       (select count(*) from public.campaigns)::int as campaigns,
       (select count(*) from public.product_1_1_campaign_credit_operations)::int as credit_ops,
       (select count(*) from public.credit_transactions)::int as tx,
       (select count(*) from public.credit_balances)::int as balances,
       (select count(*) from public.campaign_composition_artifacts)::int as artifacts,
       (select count(*) from public.product_1_1_generation_outcomes)::int as outcomes11,
       (select count(*) from public.product_9_16_two_stage_outcomes)::int as outcomes916,
       (select count(*) from public.admin_audit_log)::int as audit,
       (select count(*) from public.product_two_format_deliveries)::int as deliveries,
       (select count(*) from storage.objects)::int as storage`,
  );
  return rows[0] as Record<string, number>;
}

async function creditStatus(f: Fixture, operationId: string): Promise<string> {
  const { rows } = await pg.query(
    `select status from public.product_1_1_campaign_credit_operations
      where campaign_id = $1 and operation_id = $2`,
    [f.campaign, operationId],
  );
  return String(rows[0]?.status ?? "missing");
}

async function refundCount(f: Fixture): Promise<number> {
  const { rows } = await pg.query(
    `select count(*)::int as n
       from public.credit_transactions t
      where t.store_id = $1 and t.type = 'refund'
        and exists (
          select 1 from public.product_1_1_campaign_credit_operations o
           where o.campaign_id = $2 and o.credit_tx_id::text = t.reference
        )`,
    [f.store, f.campaign],
  );
  return Number(rows[0]?.n ?? 0);
}

async function audits(f: Fixture, operationId?: string): Promise<Array<Record<string, unknown>>> {
  const { rows } = await pg.query(
    `select operation_id, metadata
       from public.admin_audit_log
      where target_id = $1
        and ($2::text is null or operation_id = $2::uuid)
      order by created_at`,
    [f.campaign, operationId ?? null],
  );
  return rows;
}

async function postgrest(
  path: string,
  options: {
    method?: string;
    key: string;
    body?: unknown;
  },
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: options.key,
      Authorization: `Bearer ${options.key}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  return { status: response.status, body };
}

describe.skipIf(!AUTHORIZED)("F60.7 complemento base — resolução conjunta e PostgREST", () => {
  beforeAll(async () => {
    assertTarget();
    pg = new Client({ connectionString: DB_URL });
    await pg.connect();
    sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const existing = await pg.query(
      `select count(*)::int as n from public.stores where id::text like 'f60721%'`,
    );
    if (Number(existing.rows[0]?.n ?? 0) > 0) {
      throw new Error(
        "fixtures f60721… já existem; nova execução exige nova autorização",
      );
    }
    baseline = await counts();
  }, 60000);

  afterAll(async () => {
    if (!pg) return;
    try {
      const final = await counts();
      const stores = await pg.query(
        `select id from public.stores where id::text like 'f60721%' order by id`,
      );
      const storeIds = stores.rows.map((row) => row.id);
      const campaigns = await pg.query(
        `select id from public.campaigns where id::text like 'f60721%' order by id`,
      );
      const campaignIds = campaigns.rows.map((row) => row.id);
      const inventory = {
        kind: "f60.7-gate-b-complement-fixtures",
        generated_at: new Date().toISOString(),
        preserved_in_homolog: true,
        prefix: "f60721",
        baseline,
        final,
        stores: storeIds,
        campaigns: campaignIds,
        counts: {
          "public.credit_transactions": (
            await pg.query(
              `select count(*)::int as n from public.credit_transactions where store_id = any($1::uuid[])`,
              [storeIds],
            )
          ).rows[0].n,
          "public.product_1_1_generation_outcomes": (
            await pg.query(
              `select count(*)::int as n from public.product_1_1_generation_outcomes where campaign_id = any($1::uuid[])`,
              [campaignIds],
            )
          ).rows[0].n,
          "public.product_9_16_two_stage_outcomes": (
            await pg.query(
              `select count(*)::int as n from public.product_9_16_two_stage_outcomes where campaign_id = any($1::uuid[])`,
              [campaignIds],
            )
          ).rows[0].n,
          "public.admin_audit_log": (
            await pg.query(
              `select count(*)::int as n from public.admin_audit_log where target_id = any($1::uuid[])`,
              [campaignIds],
            )
          ).rows[0].n,
          "public.product_two_format_deliveries": (
            await pg.query(
              `select count(*)::int as n from public.product_two_format_deliveries where campaign_id = any($1::uuid[])`,
              [campaignIds],
            )
          ).rows[0].n,
          "storage.objects": 0,
        },
        note:
          "Fixtures do complemento base; nenhum objeto de Storage foi criado. Preservadas conforme autorização.",
      };
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      writeFileSync(
        resolve(EVIDENCE_DIR, "gate-b-complement-fixtures.json"),
        `${JSON.stringify(inventory, null, 2)}\n`,
        "utf8",
      );
      writeFileSync(
        resolve(EVIDENCE_DIR, "gate-b-complement-evidence.json"),
        `${JSON.stringify(
          {
            kind: "f60.7-gate-b-complement-base",
            executed_at: new Date().toISOString(),
            authorization_ref: process.env.F607_AUTHORIZATION_REF,
            target: {
              database: "127.0.0.1:57782/postgres",
              postgrest: "http://127.0.0.1:57781",
            },
            scope: "base sem Storage; J3/restore não executados",
            baseline,
            final,
            results,
            storage_checks: storageChecks,
            postgrest_checks: postgrestChecks,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    } catch (error) {
      results.push({
        id: "INVENTORY",
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await pg.end().catch(() => {});
    }
  }, 60000);

  it("J1 — refund vertical sem Storage", async () => {
    await runCase("J1", async () => {
      const f = await createFixture("2101", "J1");
      await openJoint(f);
      await recordSharedFailed(f, "[F60.7 Gate B] J1 shared failed");

      const storage = new CompositionArtifactStorage(sb);
      const verticalPath = `${f.store}/${f.campaign}/${f.shared}/vertical.jpg`;
      const squarePath = `${f.store}/${f.campaign}/${f.shared}/square_original.jpg`;
      for (const path of [verticalPath, squarePath]) {
        const info = await storage.readObjectInfo(path);
        storageChecks.push({ fixture: "J1", path, kind: info.kind });
        expect(info.kind).toBe("absent");
      }
      const deps = await makeDeps();
      const outcome = await resolveJointPending(
        {
          actorId: f.user,
          campaignId: f.campaign,
          operationId: f.shared,
          format: "9:16",
          action: "refund",
          reason: "[F60.7 Gate B] J1 refund",
        },
        deps,
      );
      expect(outcome).toMatchObject({
        kind: "resolved",
        action: "refund",
        format: "9:16",
        idempotent: false,
        auditRecorded: true,
      });
      expect(await creditStatus(f, f.shared)).toBe("refunded");
      expect(await creditStatus(f, f.square)).toBe("reserved");
      expect(await refundCount(f)).toBe(1);
      const rows = await audits(f, f.shared);
      expect(rows).toHaveLength(1);
      expect((rows[0].metadata as Record<string, unknown>).flow).toBe("two_format");
      expect((rows[0].metadata as Record<string, unknown>).kind).toBe("resolution");
      return { outcome, audit: rows[0] };
    });
  }, 120000);

  it("J2 — refund do quadrado com outcome próprio inicialmente ausente", async () => {
    await runCase("J2", async () => {
      const f = await createFixture("2102", "J2");
      await openJoint(f);
      await recordSharedFailed(f, "[F60.7 Gate B] J2 shared failed");

      const before = await pg.query(
        `select count(*)::int as n from public.product_1_1_generation_outcomes
          where campaign_id = $1 and operation_id = $2`,
        [f.campaign, f.square],
      );
      expect(before.rows[0].n).toBe(0);

      const storage = new CompositionArtifactStorage(sb);
      const squarePath = `${f.store}/${f.campaign}/${f.shared}/square_original.jpg`;
      const info = await storage.readObjectInfo(squarePath);
      storageChecks.push({ fixture: "J2", path: squarePath, kind: info.kind });
      expect(info.kind).toBe("absent");

      const deps = await makeDeps();
      const outcome = await resolveJointPending(
        {
          actorId: f.user,
          campaignId: f.campaign,
          operationId: f.shared,
          format: "1:1",
          action: "refund",
          reason: "[F60.7 Gate B] J2 refund",
        },
        deps,
      );
      expect(outcome).toMatchObject({
        kind: "resolved",
        action: "refund",
        format: "1:1",
        idempotent: false,
      });
      const own = await pg.query(
        `select outcome from public.product_1_1_generation_outcomes
          where campaign_id = $1 and operation_id = $2`,
        [f.campaign, f.square],
      );
      expect(own.rows).toHaveLength(1);
      expect(own.rows[0].outcome).toBe("failed");
      expect(await creditStatus(f, f.square)).toBe("refunded");
      expect(await creditStatus(f, f.shared)).toBe("reserved");
      expect(await refundCount(f)).toBe(1);
      const rows = await audits(f, f.square);
      expect(rows).toHaveLength(1);
      const metadata = rows[0].metadata as Record<string, unknown>;
      expect(metadata.flow).toBe("two_format");
      expect(metadata.control_operation_id).toBe(f.shared);
      expect(metadata.delivery_operation_id).toBe(f.square);
      return { outcome, own: own.rows[0], audit: metadata };
    });
  }, 120000);

  it("J4 — replay idempotente sem novo efeito/auditoria", async () => {
    await runCase("J4", async () => {
      const { rows } = await pg.query(
        `select id from public.campaigns where id::text like 'f6072101%' limit 1`,
      );
      expect(rows).toHaveLength(1);
      const campaignId = rows[0].id as string;
      const store = await pg.query(
        `select id from public.stores where id::text like 'f6072101%' limit 1`,
      );
      const f: Fixture = {
        code: "2101",
        label: "J1",
        ...ids("2101"),
        store: store.rows[0].id,
        campaign: campaignId,
      };
      const deps = await makeDeps();
      const outcome = await resolveJointPending(
        {
          actorId: f.user,
          campaignId: f.campaign,
          operationId: f.shared,
          format: "9:16",
          action: "refund",
          reason: "[F60.7 Gate B] J1 refund",
        },
        deps,
      );
      expect(outcome).toMatchObject({
        kind: "resolved",
        action: "refund",
        format: "9:16",
        idempotent: true,
        alreadyAudited: true,
      });
      expect(await refundCount(f)).toBe(1);
      expect(await audits(f, f.shared)).toHaveLength(1);
      return { outcome };
    });
  }, 120000);

  it("J5 — auditoria divergente bloqueia sem efeito", async () => {
    await runCase("J5", async () => {
      const f = await createFixture("2104", "J5");
      await openJoint(f);
      await preseedAudit(f, f.square, {
        flow: "legacy",
        kind: "resolution",
        action: "refund",
        format: "1:1",
        campaign_id: f.campaign,
        control_operation_id: f.shared,
        delivery_operation_id: f.square,
      });
      const deps = await makeDeps();
      const outcome = await resolveJointPending(
        {
          actorId: f.user,
          campaignId: f.campaign,
          operationId: f.shared,
          format: "1:1",
          action: "refund",
          reason: "[F60.7 Gate B] J5 divergent",
        },
        deps,
      );
      expect(outcome.kind).toBe("audit_conflict");
      expect(await creditStatus(f, f.square)).toBe("reserved");
      expect(await refundCount(f)).toBe(0);
      expect(await audits(f, f.square)).toHaveLength(1);
      return { outcome };
    });
  }, 120000);

  it("J6a — concorrência idêntica: 1 efeito, 1 auditoria", async () => {
    await runCase("J6a", async () => {
      const f = await createFixture("2105", "J6a");
      await openJoint(f);
      await recordSharedFailed(f, "[F60.7 Gate B] J6a shared failed");
      const deps = await makeDeps();
      const request = {
        actorId: f.user,
        campaignId: f.campaign,
        operationId: f.shared,
        format: "9:16" as const,
        action: "refund" as const,
        reason: "[F60.7 Gate B] J6a concurrent",
      };
      const [a, b] = await Promise.all([
        resolveJointPending(request, deps),
        resolveJointPending(request, deps),
      ]);
      for (const outcome of [a, b]) {
        expect(["resolved", "reconciled"]).toContain(outcome.kind);
        expect(["audit_conflict", "audit_pending", "audit_unavailable"]).not.toContain(
          outcome.kind,
        );
      }
      const idempotent = [a, b].filter(
        (outcome) =>
          outcome.kind === "reconciled" ||
          (outcome.kind === "resolved" && outcome.idempotent === true),
      );
      expect(idempotent.length).toBeGreaterThanOrEqual(1);
      expect(await creditStatus(f, f.shared)).toBe("refunded");
      expect(await refundCount(f)).toBe(1);
      expect(await audits(f, f.shared)).toHaveLength(1);
      return { first: a, second: b };
    });
  }, 120000);

  it("J6b — divergência concorrente: conflito real, 0 efeito", async () => {
    await runCase("J6b", async () => {
      const f = await createFixture("2106", "J6b");
      await openJoint(f);
      await recordSharedFailed(f, "[F60.7 Gate B] J6b shared failed");
      await preseedAudit(f, f.shared, {
        flow: "legacy",
        kind: "resolution",
        action: "refund",
        format: "9:16",
        campaign_id: f.campaign,
        control_operation_id: f.shared,
        delivery_operation_id: f.shared,
      });
      const deps = await makeDeps();
      const request = {
        actorId: f.user,
        campaignId: f.campaign,
        operationId: f.shared,
        format: "9:16" as const,
        action: "refund" as const,
        reason: "[F60.7 Gate B] J6b divergent concurrent",
      };
      const [a, b] = await Promise.all([
        resolveJointPending(request, deps),
        resolveJointPending(request, deps),
      ]);
      expect(a.kind).toBe("audit_conflict");
      expect(b.kind).toBe("audit_conflict");
      expect(await creditStatus(f, f.shared)).toBe("reserved");
      expect(await refundCount(f)).toBe(0);
      expect(await audits(f, f.shared)).toHaveLength(1);
      return { first: a, second: b };
    });
  }, 120000);

  it("J7 — vínculo incompleto bloqueia", async () => {
    await runCase("J7", async () => {
      const f = await createIncompleteFixture("2107", "J7");
      const deps = await makeDeps();
      const outcome = await resolveJointPending(
        {
          actorId: f.user,
          campaignId: f.campaign,
          operationId: f.shared,
          format: "9:16",
          action: "refund",
          reason: "[F60.7 Gate B] J7 incomplete",
        },
        deps,
      );
      expect(outcome.kind).toBe("blocked");
      if (outcome.kind === "blocked") {
        expect(outcome.block).toBe("delivery_link_incomplete");
      }
      expect(await creditStatus(f, f.shared)).toBe("reserved");
      expect(await refundCount(f)).toBe(0);
      return { outcome };
    });
  }, 120000);

  it("J8 — regressão legada não vira cobertura conjunta", async () => {
    await runCase("J8", async () => {
      const { rows } = await pg.query(
        `select metadata->>'flow' as flow
           from public.admin_audit_log
          where operation_id = 'f6071301-0000-4000-8000-000000000007'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].flow).toBe("legacy");
      return { flow: rows[0].flow, note: "S13 legado; fora da cobertura conjunta" };
    });
  }, 60000);

  it("P1/P2/P3 — permissões PostgREST reais", async () => {
    await runCase("P1-P3", async () => {
      const anonSelect = await postgrest(
        "/rest/v1/product_two_format_deliveries?select=id&limit=1",
        { key: ANON_KEY },
      );
      expect([401, 403]).toContain(anonSelect.status);
      const serviceSelect = await postgrest(
        "/rest/v1/product_two_format_deliveries?select=id&limit=1",
        { key: SERVICE_KEY },
      );
      expect(serviceSelect.status).toBe(200);
      const anonRpc = await postgrest(
        "/rest/v1/rpc/product_two_format_refund_format",
        {
          method: "POST",
          key: ANON_KEY,
          body: {
            p_store_id: ids("2104").store,
            p_campaign_id: ids("2104").campaign,
            p_operation_id: ids("2104").shared,
            p_format: "9:16",
            p_art_kind: "absent",
            p_observed_epoch: 0,
            p_reason: "[F60.7 Gate B] anon",
          },
        },
      );
      expect([401, 403]).toContain(anonRpc.status);
      postgrestChecks.push({
        id: "P1-P3",
        anonSelect: anonSelect.status,
        serviceSelect: serviceSelect.status,
        anonRpc: anonRpc.status,
      });
      return { anonSelect: anonSelect.status, serviceSelect: serviceSelect.status, anonRpc: anonRpc.status };
    });
  }, 120000);

  it("P4/P5 — erros reais PostgREST sem mutação", async () => {
    await runCase("P4-P5", async () => {
      const wrongStore = await postgrest(
        "/rest/v1/rpc/product_two_format_refund_format",
        {
          method: "POST",
          key: SERVICE_KEY,
          body: {
            p_store_id: ids("2101").store,
            p_campaign_id: ids("2104").campaign,
            p_operation_id: ids("2104").shared,
            p_format: "9:16",
            p_art_kind: "absent",
            p_observed_epoch: 0,
            p_reason: "[F60.7 Gate B] wrong store",
          },
        },
      );
      expect(wrongStore.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(wrongStore.body)).toContain("campaign_store_mismatch");

      const notFinal = await postgrest(
        "/rest/v1/rpc/product_two_format_refund_format",
        {
          method: "POST",
          key: SERVICE_KEY,
          body: {
            p_store_id: ids("2104").store,
            p_campaign_id: ids("2104").campaign,
            p_operation_id: ids("2104").shared,
            p_format: "9:16",
            p_art_kind: "absent",
            p_observed_epoch: 0,
            p_reason: "[F60.7 Gate B] not final",
          },
        },
      );
      expect(notFinal.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(notFinal.body)).toContain("shared_operation_not_final");

      const f: Fixture = { code: "2104", label: "J5", ...ids("2104") };
      expect(await creditStatus(f, f.shared)).toBe("reserved");
      expect(await creditStatus(f, f.square)).toBe("reserved");
      expect(await refundCount(f)).toBe(0);
      postgrestChecks.push({
        id: "P4-P5",
        wrongStore: wrongStore.status,
        notFinal: notFinal.status,
      });
      return { wrongStore: wrongStore.status, notFinal: notFinal.status };
    });
  }, 120000);
});
