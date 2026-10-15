// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import { queryProductOneToOneOperation } from "../orchestration/resend-query";
import { SupabasePendingOperationsRepository } from "../pending/pending-operations-repository";
import type { CampaignOperationState } from "../orchestration/attempt-start-types";

// ---------------------------------------------------------------------------
// F56.2b2b — Plano 03 / correção complementar (Gap 1): leitura persistida de
// `failed` NÃO terminal como PENDÊNCIA de resolução (B2B-D3/D6).
// Contract test ESTÁTICO (migration LOCAL-ONLY `20261015000003`) + SIMULADO
// (consulta e repositório, sem banco/provider). Camada 1 ≠ Camada 2.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261015000003_f56_2b2b_pending_read.sql";
const migrationSql = readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), "utf8");
const activeSql = migrationSql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";

describe("F56.2b2b — migration 20261015000003 pending_read (contrato estático, SEM comentários)", () => {
  it("é LOCAL-ONLY, sem comando mutável remoto, com aviso e grants RPC-only", () => {
    expect(activeSql.split(/\r?\n/).filter((l) => /db push/i.test(l))).toEqual([]);
    expect(migrationSql).toMatch(/LOCAL-ONLY/);
    expect(migrationSql).toMatch(/migration up --local/);
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.product_1_1_get_campaign_operation_by_campaign\(/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
    expect(activeSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.product_1_1_get_campaign_operation_by_campaign\([^)]*\) FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.product_1_1_get_campaign_operation_by_campaign\([^)]*\) TO service_role/,
    );
  });

  it("expõe `outcome`/`support_reference` PERSISTIDOS para operação NÃO terminal, preservando `unknown` e a precedência terminal", () => {
    expect(activeSql).toMatch(/v_terminal := v_credit\.status IN \('delivered','refunded'\)/);
    expect(activeSql).toMatch(/'terminal', v_terminal/);
    // `unknown` MANTÉM o significado (só `outcome='unknown'`).
    expect(activeSql).toMatch(/'unknown', \(v_unknown AND NOT v_terminal\)/);
    // `outcome`/`support_reference` do marcador persistido enquanto NÃO terminal.
    expect(activeSql).toMatch(/'outcome',\s*CASE WHEN v_has_outcome AND NOT v_terminal THEN v_outcome\.outcome/);
    expect(activeSql).toMatch(
      /'support_reference',\s*CASE WHEN v_has_outcome AND NOT v_terminal THEN v_outcome\.support_reference/,
    );
    // NÃO cria/sobrescreve marcador nem tabelas.
    expect(activeSql).not.toMatch(/INSERT INTO public\.product_1_1_generation_outcomes/);
    expect(activeSql).not.toMatch(/UPDATE public\.product_1_1_generation_outcomes/);
  });
});

function operationState(over: Partial<CampaignOperationState> = {}): CampaignOperationState {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    status: "reserved",
    amount: 1,
    creditTxId: "tx-1",
    refundTxId: null,
    consumedDefinitive: false,
    terminal: false,
    unknown: false,
    outcome: null,
    supportReference: null,
    ...over,
  };
}

function resendDeps(operation: CampaignOperationState | (() => Promise<never>)) {
  return {
    getCampaignOperation: async (): Promise<CampaignOperationState | null> => {
      if (typeof operation === "function") return operation();
      return operation;
    },
    listAttempts: async () => [],
    probeArtifact: async () => ({ kind: "absent" as const }),
    getSignedArtifactUrl: async () => "signed://x",
  };
}

describe("F56.2b2b — consulta (`resend-query`) apresenta `failed` NÃO terminal como pendência", () => {
  it("`failed` persistido + não terminal ⇒ estado `unknown` (pendência) com a referência de suporte", async () => {
    const view = await queryProductOneToOneOperation(
      { storeId: STORE_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      resendDeps(operationState({ outcome: "failed", supportReference: "IMG-FAIL" })),
    );
    expect(view).toMatchObject({
      state: "unknown",
      unknown: true,
      terminal: false,
      supportReference: "IMG-FAIL",
    });
  });

  it("`delivered`/`refunded` PREVALECEM (mesmo com `failed`/`unknown` persistido)", async () => {
    for (const status of ["delivered", "refunded"] as const) {
      const view = await queryProductOneToOneOperation(
        { storeId: STORE_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
        resendDeps(
          operationState({ status, terminal: true, outcome: "failed", supportReference: "IMG-FAIL" }),
        ),
      );
      expect(view).toMatchObject({ state: status, terminal: true });
    }
  });

  it("`unknown` persistido é PRESERVADO (pendência)", async () => {
    const view = await queryProductOneToOneOperation(
      { storeId: STORE_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      resendDeps(operationState({ unknown: true, outcome: "unknown", supportReference: "IMG-U" })),
    );
    expect(view).toMatchObject({ state: "unknown", unknown: true });
  });

  it("falha de LEITURA continua fail-closed (propaga)", async () => {
    await expect(
      queryProductOneToOneOperation(
        { storeId: STORE_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
        resendDeps(async () => {
          throw new Error("operation_read_failed");
        }),
      ),
    ).rejects.toThrow(/operation_read_failed/);
  });
});

// Fake Supabase mínimo para o repositório de pendências.
function createRepoClient(input: {
  credit?: Record<string, unknown> | null;
  outcome?: Record<string, unknown> | null;
  creditError?: boolean;
}): SupabaseClient {
  const from = vi.fn((table: string) => {
    const rows = () => {
      if (table === "product_1_1_campaign_credit_operations") {
        return input.credit ? [input.credit] : [];
      }
      if (table === "product_1_1_generation_outcomes") {
        return input.outcome ? [input.outcome] : [];
      }
      return [];
    };
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = vi.fn(self);
    chain.eq = vi.fn(self);
    chain.order = vi.fn(self);
    chain.maybeSingle = vi.fn(async () => {
      if (input.creditError && table === "product_1_1_campaign_credit_operations") {
        return { data: null, error: { message: "read_failed" } };
      }
      return { data: rows()[0] ?? null, error: null };
    });
    chain.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(resolve);
    return chain;
  });
  return { from } as unknown as SupabaseClient;
}

function creditRow(status: string) {
  return {
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    store_id: STORE_ID,
    amount: 1,
    status,
    created_at: "2026-10-15T00:00:00.000Z",
    updated_at: "2026-10-15T00:00:00.000Z",
  };
}

describe("F56.2b2b — repositório de pendências expõe a referência de `failed` (sem mudar `unknown`)", () => {
  it("`failed` NÃO terminal ⇒ `unknown:false` + `supportReference` PERSISTIDO", async () => {
    const repo = new SupabasePendingOperationsRepository(
      createRepoClient({
        credit: creditRow("reserved"),
        outcome: { outcome: "failed", support_reference: "IMG-FAIL" },
      }),
    );
    const state = await repo.findPendingOperation(CAMPAIGN_ID, OPERATION_ID);
    expect(state).toMatchObject({
      status: "reserved",
      terminal: false,
      unknown: false,
      supportReference: "IMG-FAIL",
    });
  });

  it("`unknown` persistido ⇒ `unknown:true` + referência (significado preservado)", async () => {
    const repo = new SupabasePendingOperationsRepository(
      createRepoClient({
        credit: creditRow("reserved"),
        outcome: { outcome: "unknown", support_reference: "IMG-U" },
      }),
    );
    const state = await repo.findPendingOperation(CAMPAIGN_ID, OPERATION_ID);
    expect(state).toMatchObject({ unknown: true, supportReference: "IMG-U" });
  });

  it("terminal PREVALECE ⇒ `supportReference` nulo", async () => {
    const repo = new SupabasePendingOperationsRepository(
      createRepoClient({
        credit: creditRow("delivered"),
        outcome: { outcome: "failed", support_reference: "IMG-FAIL" },
      }),
    );
    const state = await repo.findPendingOperation(CAMPAIGN_ID, OPERATION_ID);
    expect(state).toMatchObject({ terminal: true, unknown: false, supportReference: null });
  });

  it("falha de LEITURA continua fail-closed (propaga)", async () => {
    const repo = new SupabasePendingOperationsRepository(
      createRepoClient({ creditError: true }),
    );
    await expect(repo.findPendingOperation(CAMPAIGN_ID, OPERATION_ID)).rejects.toThrow(
      /pending_operation_read_failed/,
    );
  });
});
