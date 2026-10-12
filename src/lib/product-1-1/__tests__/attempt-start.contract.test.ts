// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { AttemptStartError } from "../orchestration/attempt-start-types";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 03: início de tentativa atômico no Postgres (B1B-D12 /
// REQ-56.2.2-05) e seu cliente fino server-only. Contract test estático +
// simulado, sem banco, sem provider, sem crédito (a migration é apenas
// AUTORADA aqui — LOCAL-ONLY; aplicação só no Plano 09 / O2).
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261009000001_f56_2b1b_atomic_attempt_start.sql";
const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);

const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const activeLines = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
const activeSql = activeLines.join("\n");

describe("F56.2b1b — migration 20261009000001 atomic_attempt_start (contrato estático)", () => {
  it("é LOCAL-ONLY, sem comando mutável remoto e com bloco REVERT", () => {
    expect(activeLines.filter((l) => /db push/i.test(l))).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
  });

  it("cria a tabela de claims com identidade (campaign_id, operation_id, attempt_number) e alvos/estados fechados", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.product_1_1_generation_attempt_claims/,
    );
    expect(activeSql).toMatch(
      /CONSTRAINT uq_p1_1_attempt_claim_seq UNIQUE \(campaign_id, operation_id, attempt_number\)/,
    );
    expect(activeSql).toMatch(/target IN \('primary','fallback'\)/);
    expect(activeSql).toMatch(/status IN \('in_progress','done','failed'\)/);
  });

  it("garante UM único início por vez via índice único parcial `in_progress`", () => {
    expect(activeSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_p1_1_attempt_claim_in_progress/,
    );
    expect(activeSql).toMatch(/WHERE status = 'in_progress'/);
  });

  it("C1: cria a relação PERSISTIDA do resultado desconhecido (product_1_1_generation_outcomes) imutável", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.product_1_1_generation_outcomes/,
    );
    expect(activeSql).toMatch(/outcome IN \('unknown','failed'\)/);
    expect(activeSql).toMatch(
      /CONSTRAINT uq_p1_1_generation_outcome_op UNIQUE \(campaign_id, operation_id\)/,
    );
    expect(activeSql).toMatch(/RAISE EXCEPTION 'product_1_1_generation_outcome_immutable'/);
    expect(activeSql).toMatch(/BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(
      /DROP TRIGGER IF EXISTS trg_p1_1_generation_outcome_immutable ON public\.product_1_1_generation_outcomes/,
    );
  });

  it("C4: acquire e record tomam a MESMA trava `FOR UPDATE` na linha de crédito", () => {
    const acquireIdx = activeSql.indexOf("product_1_1_acquire_attempt_start");
    const recordIdx = activeSql.indexOf("product_1_1_record_generation_outcome");
    expect(acquireIdx).toBeGreaterThan(-1);
    expect(recordIdx).toBeGreaterThan(acquireIdx);

    const acquireBlock = activeSql.slice(acquireIdx, recordIdx);
    const recordBlock = activeSql.slice(recordIdx);
    for (const block of [acquireBlock, recordBlock]) {
      expect(block).toMatch(
        /FROM public\.product_1_1_campaign_credit_operations[\s\S]*FOR UPDATE/,
      );
    }
  });

  it("F1: valida contadores POR ALVO (primary<=2, fallback<=1, total<=3) e transições permitidas", () => {
    expect(activeSql).toMatch(/COUNT\(\*\) FILTER \(WHERE target = 'primary'\)/);
    expect(activeSql).toMatch(/COUNT\(\*\) FILTER \(WHERE target = 'fallback'\)/);
    expect(activeSql).toMatch(/v_primary_count >= 2/);
    expect(activeSql).toMatch(/v_fallback_count >= 1/);
    expect(activeSql).toMatch(/v_total_count >= 3/);
    // O fallback é aceito já na 2ª chamada — nunca por posição fixa.
    expect(activeSql).not.toMatch(/attempt_seq BETWEEN 1 AND 3/);
  });

  it("F1: exige sequência (`out_of_sequence`) e transições de estado prévio (`fallback_before_primary`/`primary_after_fallback`/`attempt_already_completed`/`operation_art_uploaded`)", () => {
    // Sequência: attempt_number = nº de claims + 1.
    expect(activeSql).toMatch(/v_expected_number := v_total_count \+ 1/);
    expect(activeSql).toMatch(/p_attempt_number <> v_expected_number/);
    expect(activeSql).toMatch(/reason', 'out_of_sequence'/);
    // Primeira tentativa DEVE ser `primary`; fallback exige primary anterior.
    expect(activeSql).toMatch(/v_primary_count < 1/);
    expect(activeSql).toMatch(/reason', 'fallback_before_primary'/);
    // Nenhum `primary` depois de um `fallback`.
    expect(activeSql).toMatch(/v_fallback_count > 0/);
    expect(activeSql).toMatch(/reason', 'primary_after_fallback'/);
    // Estado prévio: claim `done` ou operação `art_uploaded` recusam nova tentativa.
    expect(activeSql).toMatch(/status = 'done'[\s\S]*?reason', 'attempt_already_completed'/);
    expect(activeSql).toMatch(/v_credit\.status = 'art_uploaded'[\s\S]*?reason', 'operation_art_uploaded'/);
  });

  it("F2: replay DIVERGENTE do outcome recusa `operation_identity_conflict` (compara o outcome persistido)", () => {
    expect(activeSql).toMatch(/v_row\.outcome = p_outcome/);
    expect(activeSql).toMatch(/reason', 'operation_identity_conflict'/);
  });

  it("F6/C1: recusa `operation_terminal` (prevalece, I2) antes de `operation_unknown`", () => {
    expect(activeSql).toMatch(/reason', 'operation_terminal'/);
    expect(activeSql).toMatch(/reason', 'operation_unknown'/);
    const terminalIdx = activeSql.indexOf("'operation_terminal'");
    const unknownIdx = activeSql.indexOf("'operation_unknown'");
    expect(terminalIdx).toBeGreaterThan(-1);
    expect(unknownIdx).toBeGreaterThan(terminalIdx);
  });

  it("escrita direta NÃO é concedida à service_role (apenas SELECT) nas tabelas novas", () => {
    expect(activeSql).toMatch(
      /REVOKE ALL ON TABLE public\.product_1_1_generation_attempt_claims FROM service_role/,
    );
    expect(activeSql).toMatch(
      /GRANT SELECT ON TABLE public\.product_1_1_generation_attempt_claims TO service_role/,
    );
    expect(activeSql).toMatch(
      /GRANT SELECT ON TABLE public\.product_1_1_generation_outcomes TO service_role/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]*\b(INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.product_1_1_generation_attempt_claims/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]*\b(INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.product_1_1_generation_outcomes/,
    );
  });

  it("define as 4 RPCs SECURITY DEFINER com search_path vazio e privilégios mínimos", () => {
    for (const fn of [
      "product_1_1_acquire_attempt_start",
      "product_1_1_finish_attempt",
      "product_1_1_get_campaign_operation_by_campaign",
      "product_1_1_record_generation_outcome",
    ]) {
      expect(activeSql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`));
    }
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
    expect(
      activeSql.match(
        /REVOKE ALL ON FUNCTION public\.product_1_1_[a-z_]+\([^)]*\) FROM PUBLIC, anon, authenticated/g,
      )?.length,
    ).toBe(4);
    expect(
      activeSql.match(
        /GRANT EXECUTE ON FUNCTION public\.product_1_1_[a-z_]+\([^)]*\) TO service_role/g,
      )?.length,
    ).toBe(4);
    // `acquire` faz INSERT ... ON CONFLICT do claim (sem erro incidental de unicidade).
    expect(activeSql).toMatch(
      /ON CONFLICT \(campaign_id, operation_id, attempt_number\) DO NOTHING/,
    );
  });

  it("I2: leitura por campanha dá PRECEDÊNCIA TERMINAL sobre o marcador histórico `unknown`", () => {
    expect(activeSql).toMatch(/product_1_1_get_campaign_operation_by_campaign/);
    expect(activeSql).toMatch(/v_terminal := v_credit\.status IN \('delivered','refunded'\)/);
    expect(activeSql).toMatch(/'terminal', v_terminal/);
    expect(activeSql).toMatch(/'unknown', \(v_unknown AND NOT v_terminal\)/);
  });
});

// ---------------------------------------------------------------------------
// Cliente fino de início de tentativa — fake RPC que espelha a semântica SQL
// (trava comum C4, contadores por alvo F1, recusa terminal/unknown C1/F6 e
// precedência terminal I2), sem banco e sem provider.
// ---------------------------------------------------------------------------

type FakeCreditStatus = "reserved" | "art_uploaded" | "delivered" | "refunded";
type FakeAttemptStatus = "in_progress" | "done" | "failed";
type FakeOutcome = "unknown" | "failed";

interface FakeCreditRow {
  campaign_id: string;
  operation_id: string;
  status: FakeCreditStatus;
  amount: number;
  credit_tx_id: string | null;
  refund_tx_id: string | null;
  created_at: string;
}

interface FakeClaimRow {
  campaign_id: string;
  operation_id: string;
  attempt_number: number;
  target: "primary" | "fallback";
  status: FakeAttemptStatus;
}

interface FakeOutcomeRow {
  campaign_id: string;
  operation_id: string;
  outcome: FakeOutcome;
  support_reference: string | null;
}

function creditSeed(over: Partial<FakeCreditRow> = {}): FakeCreditRow {
  return {
    campaign_id: "camp-1",
    operation_id: "op-1",
    status: "reserved",
    amount: 1,
    credit_tx_id: "tx-1",
    refund_tx_id: null,
    created_at: "2026-10-12T00:00:00.000Z",
    ...over,
  };
}

function createFakeRpcClient(
  seed: {
    credits?: FakeCreditRow[];
    claims?: FakeClaimRow[];
    outcomes?: FakeOutcomeRow[];
  } = {},
) {
  const credits = [...(seed.credits ?? [])];
  const claims = [...(seed.claims ?? [])];
  const outcomes = [...(seed.outcomes ?? [])];
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];

  function rpc(name: string, params: Record<string, unknown> = {}) {
    rpcCalls.push({ name, params });
    const campaignId = params.p_campaign_id as string;
    const operationId = params.p_operation_id as string;

    if (name === "product_1_1_acquire_attempt_start") {
      const target = params.p_target as "primary" | "fallback";
      const attemptNumber = params.p_attempt_number as number;
      const credit = credits.find(
        (c) => c.campaign_id === campaignId && c.operation_id === operationId,
      );
      if (!credit) {
        return Promise.resolve({ data: { acquired: false, reason: "operation_terminal" }, error: null });
      }
      if (credit.status === "delivered" || credit.status === "refunded") {
        return Promise.resolve({ data: { acquired: false, reason: "operation_terminal" }, error: null });
      }
      const hasUnknown = outcomes.some(
        (o) => o.campaign_id === campaignId && o.operation_id === operationId && o.outcome === "unknown",
      );
      if (hasUnknown) {
        return Promise.resolve({ data: { acquired: false, reason: "operation_unknown" }, error: null });
      }
      if (credit.status === "art_uploaded") {
        return Promise.resolve({ data: { acquired: false, reason: "operation_art_uploaded" }, error: null });
      }
      const rel = claims.filter(
        (c) => c.campaign_id === campaignId && c.operation_id === operationId,
      );
      if (rel.some((c) => c.status === "done")) {
        return Promise.resolve({ data: { acquired: false, reason: "attempt_already_completed" }, error: null });
      }
      const primary = rel.filter((c) => c.target === "primary").length;
      const fallback = rel.filter((c) => c.target === "fallback").length;
      // F1 — numeração SEQUENCIAL: attempt_number = nº de claims + 1.
      if (attemptNumber !== rel.length + 1) {
        return Promise.resolve({ data: { acquired: false, reason: "out_of_sequence" }, error: null });
      }
      if (rel.length >= 3) {
        return Promise.resolve({ data: { acquired: false, reason: "attempt_limit_reached" }, error: null });
      }
      if (target === "primary") {
        if (fallback > 0) {
          return Promise.resolve({ data: { acquired: false, reason: "primary_after_fallback" }, error: null });
        }
        if (primary >= 2) {
          return Promise.resolve({ data: { acquired: false, reason: "attempt_limit_reached" }, error: null });
        }
      } else if (target === "fallback") {
        if (primary < 1) {
          return Promise.resolve({ data: { acquired: false, reason: "fallback_before_primary" }, error: null });
        }
        if (fallback >= 1) {
          return Promise.resolve({ data: { acquired: false, reason: "attempt_limit_reached" }, error: null });
        }
      }
      if (rel.some((c) => c.attempt_number === attemptNumber)) {
        return Promise.resolve({ data: { acquired: false, reason: "already_started" }, error: null });
      }
      if (rel.some((c) => c.status === "in_progress")) {
        return Promise.resolve({ data: { acquired: false, reason: "in_progress" }, error: null });
      }
      claims.push({ campaign_id: campaignId, operation_id: operationId, attempt_number: attemptNumber, target, status: "in_progress" });
      return Promise.resolve({
        data: {
          acquired: true,
          reason: null,
          campaign_id: campaignId,
          operation_id: operationId,
          attempt_number: attemptNumber,
          target,
        },
        error: null,
      });
    }

    if (name === "product_1_1_finish_attempt") {
      const attemptNumber = params.p_attempt_number as number;
      const status = params.p_status as "done" | "failed";
      const claim = claims.find(
        (c) =>
          c.campaign_id === campaignId &&
          c.operation_id === operationId &&
          c.attempt_number === attemptNumber,
      );
      if (!claim) {
        return Promise.resolve({ data: null, error: { message: "attempt_claim_not_found" } });
      }
      const idempotent = claim.status === status;
      claim.status = status;
      return Promise.resolve({
        data: {
          success: true,
          idempotent,
          status,
          campaign_id: claim.campaign_id,
          operation_id: claim.operation_id,
          attempt_number: claim.attempt_number,
          target: claim.target,
        },
        error: null,
      });
    }

    if (name === "product_1_1_record_generation_outcome") {
      const credit = credits.find(
        (c) => c.campaign_id === campaignId && c.operation_id === operationId,
      );
      if (!credit) {
        return Promise.resolve({ data: null, error: { message: "operation_not_found" } });
      }
      if (credit.status === "delivered" || credit.status === "refunded") {
        return Promise.resolve({ data: { success: false, reason: "operation_terminal" }, error: null });
      }
      const existing = outcomes.find(
        (o) => o.campaign_id === campaignId && o.operation_id === operationId,
      );
      if (existing) {
        const requested = params.p_outcome as FakeOutcome;
        // F2 — equivalente ⇒ reuso idempotente; DIVERGENTE ⇒ conflito (nunca sucesso).
        if (existing.outcome === requested) {
          return Promise.resolve({
            data: {
              success: true,
              idempotent: true,
              campaign_id: campaignId,
              operation_id: operationId,
              outcome: existing.outcome,
              support_reference: existing.support_reference,
            },
            error: null,
          });
        }
        return Promise.resolve({
          data: { success: false, reason: "operation_identity_conflict" },
          error: null,
        });
      }
      const outcome = params.p_outcome as FakeOutcome;
      const support = (params.p_support_reference as string | null | undefined) ?? null;
      outcomes.push({ campaign_id: campaignId, operation_id: operationId, outcome, support_reference: support });
      return Promise.resolve({
        data: {
          success: true,
          idempotent: false,
          campaign_id: campaignId,
          operation_id: operationId,
          outcome,
          support_reference: support,
        },
        error: null,
      });
    }

    if (name === "product_1_1_get_campaign_operation_by_campaign") {
      const credit = credits
        .filter((c) => c.campaign_id === campaignId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (!credit) return Promise.resolve({ data: null, error: null });
      const terminal = credit.status === "delivered" || credit.status === "refunded";
      const oc = outcomes.find(
        (o) => o.campaign_id === credit.campaign_id && o.operation_id === credit.operation_id,
      );
      const unknownRaw = oc?.outcome === "unknown";
      return Promise.resolve({
        data: {
          success: true,
          status: credit.status,
          campaign_id: credit.campaign_id,
          operation_id: credit.operation_id,
          amount: credit.amount,
          credit_tx_id: credit.credit_tx_id,
          refund_tx_id: credit.refund_tx_id,
          consumed_definitive: credit.status === "delivered",
          terminal,
          unknown: unknownRaw && !terminal,
          outcome: unknownRaw && !terminal ? "unknown" : null,
          support_reference: unknownRaw && !terminal ? (oc?.support_reference ?? null) : null,
        },
        error: null,
      });
    }

    return Promise.resolve({ data: null, error: { message: `unknown_rpc:${name}` } });
  }

  return {
    rpc,
    credits,
    claims,
    outcomes,
    rpcCalls,
    client: { rpc } as unknown as SupabaseClient,
  };
}

const ATTEMPT_CLIENT_SRC = existsSync(
  path.resolve(process.cwd(), "src/lib/product-1-1/orchestration/attempt-start-client.ts"),
)
  ? readFileSync(
      path.resolve(process.cwd(), "src/lib/product-1-1/orchestration/attempt-start-client.ts"),
      "utf8",
    )
  : "";

describe("F56.2b1b — cliente fino de início de tentativa (simulado)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acquire: o vencedor recebe {acquired:true} e registra exatamente um claim", async () => {
    const fake = createFakeRpcClient({ credits: [creditSeed()] });
    const client = new ProductOneToOneAttemptStartClient(fake.client);

    const result = await client.acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 1,
    });

    expect(result).toEqual({
      acquired: true,
      reason: null,
      campaignId: "camp-1",
      operationId: "op-1",
      attemptNumber: 1,
      target: "primary",
    });
    expect(fake.rpcCalls[0]).toEqual({
      name: "product_1_1_acquire_attempt_start",
      params: {
        p_campaign_id: "camp-1",
        p_operation_id: "op-1",
        p_target: "primary",
        p_attempt_number: 1,
      },
    });
    expect(fake.claims).toHaveLength(1);
  });

  it("acquire: perdedor `in_progress` NÃO lança e NÃO prossegue para o provider", async () => {
    const fake = createFakeRpcClient({
      credits: [creditSeed()],
      claims: [
        { campaign_id: "camp-1", operation_id: "op-1", attempt_number: 1, target: "primary", status: "in_progress" },
      ],
    });
    const client = new ProductOneToOneAttemptStartClient(fake.client);
    const providerCall = vi.fn();
    const result = await client.acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 2,
    });
    if (result.acquired) providerCall();

    expect(result).toMatchObject({ acquired: false, reason: "in_progress" });
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("F1: attempt_number NÃO sequencial ⇒ `out_of_sequence` (não lança)", async () => {
    const fake = createFakeRpcClient({ credits: [creditSeed()] });
    const result = await new ProductOneToOneAttemptStartClient(fake.client).acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 2,
    });
    expect(result).toMatchObject({ acquired: false, reason: "out_of_sequence" });
    expect(fake.claims).toHaveLength(0);
  });

  it("F1: `fallback` como PRIMEIRA chamada ⇒ `fallback_before_primary`", async () => {
    const fake = createFakeRpcClient({ credits: [creditSeed()] });
    const result = await new ProductOneToOneAttemptStartClient(fake.client).acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "fallback",
      attemptNumber: 1,
    });
    expect(result).toMatchObject({ acquired: false, reason: "fallback_before_primary" });
    expect(fake.claims).toHaveLength(0);
  });

  it("F1: `primary` DEPOIS de um `fallback` ⇒ `primary_after_fallback`", async () => {
    const fake = createFakeRpcClient({
      credits: [creditSeed()],
      claims: [
        { campaign_id: "camp-1", operation_id: "op-1", attempt_number: 1, target: "primary", status: "failed" },
        { campaign_id: "camp-1", operation_id: "op-1", attempt_number: 2, target: "fallback", status: "failed" },
      ],
    });
    const result = await new ProductOneToOneAttemptStartClient(fake.client).acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 3,
    });
    expect(result).toMatchObject({ acquired: false, reason: "primary_after_fallback" });
  });

  it("F1: nova tentativa após uma tentativa `done` ⇒ `attempt_already_completed`", async () => {
    const fake = createFakeRpcClient({
      credits: [creditSeed()],
      claims: [
        { campaign_id: "camp-1", operation_id: "op-1", attempt_number: 1, target: "primary", status: "done" },
      ],
    });
    const result = await new ProductOneToOneAttemptStartClient(fake.client).acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 2,
    });
    expect(result).toMatchObject({ acquired: false, reason: "attempt_already_completed" });
  });

  it("F1: operação de crédito `art_uploaded` ⇒ `operation_art_uploaded`", async () => {
    const fake = createFakeRpcClient({ credits: [creditSeed({ status: "art_uploaded" })] });
    const result = await new ProductOneToOneAttemptStartClient(fake.client).acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 1,
    });
    expect(result).toMatchObject({ acquired: false, reason: "operation_art_uploaded" });
    expect(fake.claims).toHaveLength(0);
  });

  it("F1: fallback aceito JÁ na 2ª chamada e teto por alvo respeitado", async () => {
    const fallbackFake = createFakeRpcClient({
      credits: [creditSeed()],
      claims: [
        { campaign_id: "camp-1", operation_id: "op-1", attempt_number: 1, target: "primary", status: "failed" },
      ],
    });
    const fallbackClient = new ProductOneToOneAttemptStartClient(fallbackFake.client);
    const fallbackFirst = await fallbackClient.acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "fallback",
      attemptNumber: 2,
    });
    expect(fallbackFirst.acquired).toBe(true);

    // Teto por ALVO (sem claim `done`): 2 primaries ⇒ 3ª `primary` recusada.
    const primaryFake = createFakeRpcClient({
      credits: [creditSeed()],
      claims: [
        { campaign_id: "camp-1", operation_id: "op-1", attempt_number: 1, target: "primary", status: "failed" },
        { campaign_id: "camp-1", operation_id: "op-1", attempt_number: 2, target: "primary", status: "failed" },
      ],
    });
    const thirdPrimary = await new ProductOneToOneAttemptStartClient(primaryFake.client).acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 3,
    });
    expect(thirdPrimary).toMatchObject({ acquired: false, reason: "attempt_limit_reached" });
  });

  it("F6: acquire recusa `operation_terminal` em delivered/refunded", async () => {
    for (const status of ["delivered", "refunded"] as const) {
      const fake = createFakeRpcClient({ credits: [creditSeed({ status })] });
      const result = await new ProductOneToOneAttemptStartClient(fake.client).acquire({
        campaignId: "camp-1",
        operationId: "op-1",
        target: "primary",
        attemptNumber: 1,
      });
      expect(result).toMatchObject({ acquired: false, reason: "operation_terminal" });
      expect(fake.claims).toHaveLength(0);
    }
  });

  it("C1: após recordOperationOutcome('unknown'), acquire recusa `operation_unknown` (idempotente)", async () => {
    const fake = createFakeRpcClient({ credits: [creditSeed()] });
    const client = new ProductOneToOneAttemptStartClient(fake.client);

    const recorded = await client.recordOperationOutcome({
      campaignId: "camp-1",
      operationId: "op-1",
      outcome: "unknown",
      supportReference: "IMG-001",
    });
    expect(recorded).toMatchObject({
      outcome: "unknown",
      supportReference: "IMG-001",
      idempotent: false,
    });
    expect(fake.rpcCalls[0].name).toBe("product_1_1_record_generation_outcome");

    const acquire = await client.acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 1,
    });
    expect(acquire).toMatchObject({ acquired: false, reason: "operation_unknown" });

    const again = await client.recordOperationOutcome({
      campaignId: "camp-1",
      operationId: "op-1",
      outcome: "unknown",
      supportReference: "IMG-001",
    });
    expect(again.idempotent).toBe(true);
    expect(fake.outcomes).toHaveLength(1);
  });

  it("I2: operação terminal + `unknown` persistido ⇒ leitura TERMINAL e acquire `operation_terminal`", async () => {
    const fake = createFakeRpcClient({
      credits: [creditSeed({ status: "delivered" })],
      outcomes: [
        { campaign_id: "camp-1", operation_id: "op-1", outcome: "unknown", support_reference: "IMG-777" },
      ],
    });
    const client = new ProductOneToOneAttemptStartClient(fake.client);

    const state = await client.getCampaignOperation("camp-1");
    expect(state).toMatchObject({
      status: "delivered",
      terminal: true,
      unknown: false,
      outcome: null,
      supportReference: null,
    });

    const acquire = await client.acquire({
      campaignId: "camp-1",
      operationId: "op-1",
      target: "primary",
      attemptNumber: 1,
    });
    expect(acquire).toMatchObject({ acquired: false, reason: "operation_terminal" });
  });

  it("getCampaignOperation expõe o `unknown` PERSISTIDO quando a operação NÃO é terminal", async () => {
    const fake = createFakeRpcClient({
      credits: [creditSeed()],
      outcomes: [
        { campaign_id: "camp-1", operation_id: "op-1", outcome: "unknown", support_reference: "IMG-123" },
      ],
    });
    const state = await new ProductOneToOneAttemptStartClient(fake.client).getCampaignOperation("camp-1");
    expect(state).toMatchObject({
      status: "reserved",
      terminal: false,
      unknown: true,
      outcome: "unknown",
      supportReference: "IMG-123",
    });
  });

  it("getCampaignOperation retorna null para legado (sem operação nova)", async () => {
    const fake = createFakeRpcClient();
    expect(
      await new ProductOneToOneAttemptStartClient(fake.client).getCampaignOperation("camp-legacy"),
    ).toBeNull();
  });

  it("finish mapeia done/failed e é idempotente", async () => {
    const fake = createFakeRpcClient({
      credits: [creditSeed()],
      claims: [
        { campaign_id: "camp-1", operation_id: "op-1", attempt_number: 1, target: "primary", status: "in_progress" },
      ],
    });
    const client = new ProductOneToOneAttemptStartClient(fake.client);
    const first = await client.finish({
      campaignId: "camp-1",
      operationId: "op-1",
      attemptNumber: 1,
      status: "done",
    });
    expect(first).toMatchObject({ status: "done", idempotent: false });
    const second = await client.finish({
      campaignId: "camp-1",
      operationId: "op-1",
      attemptNumber: 1,
      status: "done",
    });
    expect(second.idempotent).toBe(true);
  });

  it("payload/RPC malformado ⇒ erro tipado `unknown` (nunca sucesso silencioso)", async () => {
    const fake = createFakeRpcClient({ credits: [creditSeed()] });
    const client = new ProductOneToOneAttemptStartClient(fake.client);
    await expect(
      client.finish({ campaignId: "camp-1", operationId: "op-1", attemptNumber: 9, status: "done" }),
    ).rejects.toBeInstanceOf(AttemptStartError);

    const bad = new ProductOneToOneAttemptStartClient({
      rpc: async () => ({ data: { reason: "nonsense" }, error: null }),
    } as unknown as SupabaseClient);
    await expect(
      bad.acquire({ campaignId: "camp-1", operationId: "op-1", target: "primary", attemptNumber: 1 }),
    ).rejects.toMatchObject({ code: "unknown" });
  });

  it("F2: replay DIVERGENTE do outcome ⇒ erro tipado `operation_identity_conflict` (nunca sucesso)", async () => {
    const fake = createFakeRpcClient({
      credits: [creditSeed()],
      outcomes: [
        { campaign_id: "camp-1", operation_id: "op-1", outcome: "failed", support_reference: null },
      ],
    });
    const client = new ProductOneToOneAttemptStartClient(fake.client);
    await expect(
      client.recordOperationOutcome({ campaignId: "camp-1", operationId: "op-1", outcome: "unknown" }),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
    expect(fake.outcomes).toHaveLength(1);
    expect(fake.outcomes[0].outcome).toBe("failed");
  });

  it("F2: replay EQUIVALENTE do outcome ⇒ sucesso idempotente (uma linha)", async () => {
    const fake = createFakeRpcClient({ credits: [creditSeed()] });
    const client = new ProductOneToOneAttemptStartClient(fake.client);
    const first = await client.recordOperationOutcome({
      campaignId: "camp-1",
      operationId: "op-1",
      outcome: "unknown",
      supportReference: "IMG-1",
    });
    expect(first.idempotent).toBe(false);
    const again = await client.recordOperationOutcome({
      campaignId: "camp-1",
      operationId: "op-1",
      outcome: "unknown",
      supportReference: "IMG-1",
    });
    expect(again.idempotent).toBe(true);
    expect(fake.outcomes).toHaveLength(1);
  });

  it("F3: `{acquired:true}` sem identidade/alvo/tentativa ⇒ lança `incomplete_acquire_envelope`", async () => {
    const client = new ProductOneToOneAttemptStartClient({
      rpc: async () => ({ data: { acquired: true, reason: null }, error: null }),
    } as unknown as SupabaseClient);
    await expect(
      client.acquire({ campaignId: "camp-1", operationId: "op-1", target: "primary", attemptNumber: 1 }),
    ).rejects.toMatchObject({ code: "unknown", message: "incomplete_acquire_envelope" });
  });

  it("F3: `{acquired:true}` com identidade/alvo DIVERGENTES ⇒ lança", async () => {
    const client = new ProductOneToOneAttemptStartClient({
      rpc: async () => ({
        data: {
          acquired: true,
          reason: null,
          campaign_id: "camp-1",
          operation_id: "op-1",
          attempt_number: 1,
          target: "fallback",
        },
        error: null,
      }),
    } as unknown as SupabaseClient);
    await expect(
      client.acquire({ campaignId: "camp-1", operationId: "op-1", target: "primary", attemptNumber: 1 }),
    ).rejects.toMatchObject({ code: "unknown", message: "incomplete_acquire_envelope" });
  });

  it("F3: finish sem `success:true` explícito ⇒ lança `incomplete_finish_envelope`", async () => {
    const client = new ProductOneToOneAttemptStartClient({
      rpc: async () => ({
        data: {
          status: "done",
          campaign_id: "camp-1",
          operation_id: "op-1",
          attempt_number: 1,
          target: "primary",
        },
        error: null,
      }),
    } as unknown as SupabaseClient);
    await expect(
      client.finish({ campaignId: "camp-1", operationId: "op-1", attemptNumber: 1, status: "done" }),
    ).rejects.toMatchObject({ code: "unknown", message: "incomplete_finish_envelope" });
  });

  it("F3: recordOperationOutcome sem `success:true` explícito ou com outcome divergente ⇒ lança", async () => {
    const noSuccess = new ProductOneToOneAttemptStartClient({
      rpc: async () => ({
        data: { outcome: "unknown", campaign_id: "camp-1", operation_id: "op-1" },
        error: null,
      }),
    } as unknown as SupabaseClient);
    await expect(
      noSuccess.recordOperationOutcome({ campaignId: "camp-1", operationId: "op-1", outcome: "unknown" }),
    ).rejects.toMatchObject({ code: "unknown", message: "incomplete_outcome_envelope" });

    const mismatched = new ProductOneToOneAttemptStartClient({
      rpc: async () => ({
        data: { success: true, outcome: "failed", campaign_id: "camp-1", operation_id: "op-1" },
        error: null,
      }),
    } as unknown as SupabaseClient);
    await expect(
      mismatched.recordOperationOutcome({ campaignId: "camp-1", operationId: "op-1", outcome: "unknown" }),
    ).rejects.toMatchObject({ code: "unknown", message: "incomplete_outcome_envelope" });
  });

  it("é RPC-only: sem query builder direto nem provider; tipado por (target, attemptNumber)", () => {
    expect(ATTEMPT_CLIENT_SRC).not.toMatch(/\.from\(/);
    expect(ATTEMPT_CLIENT_SRC).not.toMatch(/createNewFlowImageGateway|provider/);
    expect(ATTEMPT_CLIENT_SRC).not.toMatch(/attempt_seq|attemptSeq/);
  });
});
