import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { assertF60Target } from "../../../../scripts/testing/f60-window.mjs";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import {
  SupabasePendingOperationsRepository,
  type PendingOperationState,
} from "@/lib/product-1-1/pending/pending-operations-repository";
import { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import { asSupabaseClient, createPgSupabase } from "./pg-supabase";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => {
  const proxy = new Proxy({}, { get: () => undefined });
  return { supabaseAdmin: proxy, createServerClient: vi.fn(async () => proxy) };
});

const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) throw new Error("TEST_DATABASE_URL obrigatório (perfil f60)");
const pool = new Pool({ connectionString: assertF60Target(rawUrl, process.env)!.toString(), ssl: false });

const CREDIT = "product_1_1_campaign_credit_operations";
const LEGACY_CLAIMS = "product_1_1_generation_attempt_claims";
const LEGACY_OUTCOMES = "product_1_1_generation_outcomes";

type LegacyFields = Pick<
  PendingOperationState,
  | "processing"
  | "terminal"
  | "unknown"
  | "failed"
  | "supportReference"
  | "latestAttemptAt"
  | "format"
>;

/**
 * Leitor ANTERIOR (pré-F60): consulta DIRETA das tabelas legadas e ordenação
 * exclusiva por `attempt_number DESC`. É a referência de compatibilidade.
 */
class LegacyPendingReader {
  constructor(private readonly client: PoolClient) {}

  async read(
    campaignId: string,
    operationId: string,
    format: LegacyFields["format"],
  ): Promise<LegacyFields | null> {
    const credit = await this.client.query<{ status: string }>(
      `select status from public.${CREDIT} where campaign_id=$1 and operation_id=$2`,
      [campaignId, operationId],
    );
    if (credit.rows.length === 0) return null;
    const status = credit.rows[0].status;
    const terminal = status === "delivered" || status === "refunded";
    const claims = await this.client.query<{ status: string; updated_at: Date }>(
      `select status, updated_at from public.${LEGACY_CLAIMS}
        where campaign_id=$1 and operation_id=$2
        order by attempt_number desc`,
      [campaignId, operationId],
    );
    const outcome = await this.client.query<{ outcome: string; support_reference: string | null }>(
      `select outcome, support_reference from public.${LEGACY_OUTCOMES}
        where campaign_id=$1 and operation_id=$2`,
      [campaignId, operationId],
    );
    const marker = outcome.rows[0];
    return {
      processing: claims.rows.some((claim) => claim.status === "in_progress"),
      terminal,
      unknown: marker?.outcome === "unknown" && !terminal,
      failed: marker?.outcome === "failed" && !terminal,
      supportReference: terminal ? null : (marker?.support_reference ?? null),
      latestAttemptAt: claims.rows[0]?.updated_at
        ? claims.rows[0].updated_at.toISOString()
        : null,
      format,
    };
  }
}

async function withRollback<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

async function fixture(client: PoolClient) {
  const userId = randomUUID();
  const storeId = randomUUID();
  const campaignId = randomUUID();
  const operationId = randomUUID();
  const suffix = randomUUID();
  await client.query(
    `insert into auth.users (id,aud,role,email,created_at,updated_at)
     values ($1,'authenticated','authenticated',$2,now(),now())`,
    [userId, `p916compat-${suffix}@f60.test`],
  );
  await client.query(
    `insert into public.stores (id,user_id,name,segment) values ($1,$2,$3,'variedades-utilidades')`,
    [storeId, userId, `p916compat-${suffix}`.slice(0, 60)],
  );
  await client.query(
    `insert into public.campaigns (id,store_id,status,product_name,storage_path)
     values ($1,$2,'generating',$3,$4)`,
    [campaignId, storeId, `p916compat-${suffix}`, `f60/${campaignId}`],
  );
  await client.query("select public.grant_credits($1,5,'f60-pg-test',$2,'{}'::jsonb)", [
    storeId,
    `f60-compat-grant-${suffix}`,
  ]);
  return { userId, storeId, campaignId, operationId };
}

function repositoryFor(client: PoolClient, format: "1:1" | "9:16") {
  const supabase = asSupabaseClient(createPgSupabase(client));
  const vertical = {
    probeArtifact: vi.fn(async () => ({
      kind: "integral" as const,
      ref: { storagePath: "vertical.jpg", width: 1080, height: 1920, mimeType: "image/jpeg" },
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      storagePath: "vertical.jpg",
    })),
  };
  const repository = new SupabasePendingOperationsRepository(supabase, undefined, {
    resolveFormat: async () => ({ kind: format }),
    verticalArtifacts: vertical,
  });
  return { repository, vertical, supabase };
}

async function reserve(client: PoolClient, f: Awaited<ReturnType<typeof fixture>>) {
  const supabase = asSupabaseClient(createPgSupabase(client));
  return new ProductOneToOneCreditOperationClient(supabase).reserve({
    storeId: f.storeId,
    campaignId: f.campaignId,
    operationId: f.operationId,
  });
}

async function insertLegacyClaim(
  client: PoolClient,
  f: Awaited<ReturnType<typeof fixture>>,
  attemptNumber: number,
  status: "in_progress" | "done" | "failed" | "abandoned",
) {
  await client.query(
    `insert into public.${LEGACY_CLAIMS}
       (campaign_id, operation_id, attempt_number, target, status)
     values ($1,$2,$3,'primary',$4)`,
    [f.campaignId, f.operationId, attemptNumber, status],
  );
}

async function insertLegacyOutcome(
  client: PoolClient,
  f: Awaited<ReturnType<typeof fixture>>,
  outcome: "unknown" | "failed",
  support: string,
) {
  await client.query(
    `insert into public.${LEGACY_OUTCOMES}
       (campaign_id, operation_id, outcome, support_reference)
     values ($1,$2,$3,$4)`,
    [f.campaignId, f.operationId, outcome, support],
  );
}

describe("F60 compatibilidade 1:1 e 9:16 direto (leitor anterior x repositório real)", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("1:1 entregue preserva campo legado a campo legado", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      await reserve(client, f);
      await insertLegacyClaim(client, f, 1, "done");
      const supabase = asSupabaseClient(createPgSupabase(client));
      const credit = new ProductOneToOneCreditOperationClient(supabase);
      const begin = await credit.beginPublication(f.campaignId, f.operationId);
      await credit.markArtUploaded(f.campaignId, f.operationId, begin.token as string);
      await credit.deliver(f.campaignId, f.operationId, begin.token as string);

      const { repository } = repositoryFor(client, "1:1");
      const state = await repository.findPendingOperation(f.campaignId, f.operationId);
      expect(state).not.toBeNull();
      const legacy = await new LegacyPendingReader(client).read(
        f.campaignId,
        f.operationId,
        "1:1",
      );
      expect(pickLegacy(state as PendingOperationState)).toEqual(legacy);
      expect(state).toMatchObject({ origin: "legacy", stage: null });
    });
  });

  it("9:16 direto estornado NÃO é tratado como duas etapas e preserva campos legados", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      await reserve(client, f);
      await insertLegacyClaim(client, f, 1, "failed");
      await insertLegacyOutcome(client, f, "failed", "f60-compat");
      const supabase = asSupabaseClient(createPgSupabase(client));
      const credit = new ProductOneToOneCreditOperationClient(supabase);
      const epoch = await credit.getPublicationEpoch(f.campaignId, f.operationId);
      await credit.closeFailedOperation({
        campaignId: f.campaignId,
        operationId: f.operationId,
        artKind: "absent",
        observedEpoch: epoch,
        reason: "f60-compat",
      });

      const { repository } = repositoryFor(client, "9:16");
      const state = await repository.findPendingOperation(f.campaignId, f.operationId);
      const legacy = await new LegacyPendingReader(client).read(
        f.campaignId,
        f.operationId,
        "9:16",
      );
      expect(pickLegacy(state as PendingOperationState)).toEqual(legacy);
      expect(state).toMatchObject({ origin: "legacy", stage: null, terminal: true });
      const canonical = await client.query(
        `select 1 from public.product_9_16_two_stage_operations
          where campaign_id=$1 and operation_id=$2`,
        [f.campaignId, f.operationId],
      );
      expect(canonical.rows).toHaveLength(0);
    });
  });

  it("unknown legado mantém processing/failed/unknown/supportReference", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      await reserve(client, f);
      await insertLegacyClaim(client, f, 1, "in_progress");
      await insertLegacyOutcome(client, f, "unknown", "f60-unknown");

      const { repository } = repositoryFor(client, "1:1");
      const state = await repository.findPendingOperation(f.campaignId, f.operationId);
      const legacy = await new LegacyPendingReader(client).read(
        f.campaignId,
        f.operationId,
        "1:1",
      );
      expect(pickLegacy(state as PendingOperationState)).toEqual(legacy);
      expect(state).toMatchObject({
        processing: true,
        unknown: true,
        failed: false,
        supportReference: "f60-unknown",
      });
    });
  });

  it("histórico legado mantém ordem por attempt_number DESC", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      await reserve(client, f);
      await insertLegacyClaim(client, f, 1, "failed");
      await insertLegacyClaim(client, f, 2, "in_progress");

      const { repository } = repositoryFor(client, "1:1");
      const state = await repository.findPendingOperation(f.campaignId, f.operationId);
      const claims = await client.query<{ attempt_number: number }>(
        `select attempt_number from public.${LEGACY_CLAIMS}
          where campaign_id=$1 and operation_id=$2 order by attempt_number desc`,
        [f.campaignId, f.operationId],
      );
      const expectedLatest = (
        await client.query<{ updated_at: Date }>(
          `select updated_at from public.${LEGACY_CLAIMS} where campaign_id=$1 and operation_id=$2 order by attempt_number desc limit 1`,
          [f.campaignId, f.operationId],
        )
      ).rows[0].updated_at;
      // O adaptador normaliza timestamptz para ISO; comparar o MESMO instante.
      expect(state?.latestAttemptAt).toEqual(expectedLatest.toISOString());
      expect(claims.rows.map((row) => row.attempt_number)).toEqual([2, 1]);
    });
  });

  it("views por origem: ORDER BY source devolve 9_16_two_stage antes de legacy", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const legacyOperation = randomUUID();
      const newOperation = randomUUID();
      await new ProductOneToOneCreditOperationClient(
        asSupabaseClient(createPgSupabase(client)),
      ).reserve({
        storeId: f.storeId,
        campaignId: f.campaignId,
        operationId: legacyOperation,
      });
      await client.query(
        `insert into public.${LEGACY_CLAIMS}
           (campaign_id, operation_id, attempt_number, target, status)
         values ($1,$2,1,'primary','in_progress')`,
        [f.campaignId, legacyOperation],
      );

      const supabase = asSupabaseClient(createPgSupabase(client));
      const control = new ProductTwoStageOperationClient(supabase);
      await control.open({
        storeId: f.storeId,
        campaignId: f.campaignId,
        operationId: newOperation,
      });
      await control.acquire({
        campaignId: f.campaignId,
        operationId: newOperation,
        stage: "base",
        requestId: randomUUID(),
        target: "primary",
      });

      const { rows } = await client.query<{ source: string }>(
        `select source from public.product_generation_claim_history_v
          where campaign_id=$1 order by source`,
        [f.campaignId],
      );
      // Ordem LEXICOGRÁFICA do SQL: '9_16_two_stage' < 'legacy'.
      expect(rows.map((row) => row.source)).toEqual(["9_16_two_stage", "legacy"]);

      const duplicated = await client.query<{ n: number }>(
        `select count(*)::int as n from (
           select operation_id from public.product_generation_claim_history_v
            where campaign_id=$1 group by operation_id having count(distinct source) > 1
         ) d`,
        [f.campaignId],
      );
      expect(duplicated.rows[0].n).toBe(0);
    });
  });

  it("entre etapas: base done + expansão pending expõe origin/stage e entra na listagem", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const supabase = asSupabaseClient(createPgSupabase(client));
      const control = new ProductTwoStageOperationClient(supabase);
      await control.open({ storeId: f.storeId, campaignId: f.campaignId, operationId: f.operationId });
      const base = await control.acquire({
        campaignId: f.campaignId,
        operationId: f.operationId,
        stage: "base",
        requestId: randomUUID(),
        target: "primary",
      });
      await control.finish({
        campaignId: f.campaignId,
        operationId: f.operationId,
        attemptToken: base.attemptToken as string,
        expectedStatus: "in_progress",
        status: "completed",
      });

      const { repository } = repositoryFor(client, "9:16");
      const state = await repository.findPendingOperation(f.campaignId, f.operationId);
      expect(state).toMatchObject({
        origin: "9_16_two_stage",
        stage: "expansion",
        processing: false,
        terminal: false,
      });
      expect(state?.latestAttemptAt).not.toBeNull();

      const listing = await repository.listPendingOperations();
      const entry = listing.find((item) => item.operationId === f.operationId);
      expect(entry).toMatchObject({
        origin: "9_16_two_stage",
        stage: "expansion",
        format: "9:16",
        artifactKind: "integral",
      });
    });
  });

  it("listagem legada mantém origin='legacy' e sem segunda fila", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      await reserve(client, f);
      const { repository } = repositoryFor(client, "1:1");
      const listing = await repository.listPendingOperations();
      const entry = listing.find((item) => item.operationId === f.operationId);
      expect(entry).toMatchObject({ origin: "legacy", stage: null, format: "1:1" });
    });
  });

  it("origem nova sem sonda vertical fica inconclusiva na listagem (nunca quadrada)", async () => {
    await withRollback(async (client) => {
      const f = await fixture(client);
      const supabase = asSupabaseClient(createPgSupabase(client));
      const control = new ProductTwoStageOperationClient(supabase);
      await control.open({ storeId: f.storeId, campaignId: f.campaignId, operationId: f.operationId });

      const square = vi.fn(async () => ({
        kind: "integral" as const,
        ref: { storagePath: "square", width: 1024, height: 1024, mimeType: "image/jpeg" },
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
        storagePath: "square",
      }));
      const repository = new SupabasePendingOperationsRepository(
        supabase,
        { probeArtifact: square },
        { resolveFormat: async () => ({ kind: "1:1" }) },
      );
      const listing = await repository.listPendingOperations();
      const entry = listing.find((item) => item.operationId === f.operationId);
      expect(entry).toMatchObject({
        origin: "9_16_two_stage",
        artifactKind: "indeterminate",
        formatUnavailable: true,
      });
      await expect(
        repository.probeArtifact(f.storeId, f.campaignId, f.operationId),
      ).rejects.toMatchObject({ code: "format_unavailable" });
      // A listagem é global no alvo compartilhado: chamadas legítimas para
      // pendências legadas são permitidas. A sonda quadrada NUNCA pode ser
      // chamada para a campanha/operação NOVA deste teste.
      const calls = square.mock.calls as unknown as Array<
        [{ campaignId: string; operationId: string }]
      >;
      expect(
        calls.filter(
          ([input]) =>
            input.campaignId === f.campaignId && input.operationId === f.operationId,
        ),
      ).toEqual([]);
    });
  });
});

function pickLegacy(state: PendingOperationState): LegacyFields {
  return {
    processing: state.processing,
    terminal: state.terminal,
    unknown: state.unknown,
    failed: state.failed,
    supportReference: state.supportReference,
    latestAttemptAt: state.latestAttemptAt,
    format: state.format ?? null,
  };
}
