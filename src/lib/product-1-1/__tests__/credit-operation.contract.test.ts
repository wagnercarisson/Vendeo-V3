// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { rpc: m.rpc } }));

import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import { CreditOperationError } from "../credit-operation/types";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const migrationFile = readdirSync(MIGRATIONS_DIR).find((name) =>
  name.endsWith("product_1_1_campaign_credit.sql"),
);

if (!migrationFile) {
  throw new Error("migration *product_1_1_campaign_credit.sql não encontrada");
}

const sql = readFileSync(path.join(MIGRATIONS_DIR, migrationFile), "utf8");
const activeLines = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
const activeSql = activeLines.join("\n");

describe("F56.2b1a — migration product_1_1_campaign_credit (contrato estático)", () => {
  it("é local-only, sem comando mutável remoto e com bloco REVERT", () => {
    expect(activeLines.filter((l) => /db push/i.test(l))).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
  });

  it("cria a tabela com identidade única campaign_id + operation_id e estados fechados", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.product_1_1_campaign_credit_operations/,
    );
    expect(activeSql).toMatch(/UNIQUE \(campaign_id, operation_id\)/);
    expect(activeSql).toMatch(
      /status IN \('reserved', 'art_uploaded', 'delivered', 'refunded'\)/,
    );
    expect(activeSql).toMatch(/CHECK \(amount > 0\)/);
  });

  it("define RPCs SECURITY DEFINER com search_path vazio e privilégios mínimos", () => {
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.product_1_1_reserve_credit_operation/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.product_1_1_reserve_credit_operation\([^)]*\)\s+TO service_role/,
    );
    expect(
      activeSql.match(
        /REVOKE ALL ON FUNCTION public\.product_1_1_[a-z_]+\([^)]*\) FROM PUBLIC, anon, authenticated/g,
      )?.length,
    ).toBe(6);
  });

  it("reserva executa reserve_credit e insere `reserved` na MESMA função (atomicidade)", () => {
    expect(activeSql).toMatch(/v_tx_id := public\.reserve_credit\(/);
    expect(activeSql).toMatch(/INSERT INTO public\.product_1_1_campaign_credit_operations/);
    expect(activeSql).toMatch(/'reserved', v_tx_id/);
  });

  it("transições fazem CAS no banco e o estorno usa refund_credit", () => {
    expect(activeSql).toMatch(/FOR UPDATE/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'invalid_transition'/);
    expect(activeSql).toMatch(/v_refund_id := public\.refund_credit\(/);
    expect(activeSql).toMatch(/status NOT IN \('reserved', 'art_uploaded'\)/);
  });

  it("delivered é terminal e não pode ser estornado", () => {
    expect(activeSql).toMatch(/RAISE EXCEPTION 'delivered_not_refundable'/);
    expect(activeSql).toMatch(/status = 'delivered' THEN[\s\S]*idempotent', true, 'status', 'delivered'/);
  });

  it("reconciliação é restrita a estados incompletos antigos", () => {
    expect(activeSql).toMatch(
      /WHERE status IN \('reserved', 'art_uploaded'\)[\s\S]*make_interval\(mins => p_timeout_minutes\)/,
    );
  });

  it("leitura distingue reserved (temporário) de delivered (definitivo)", () => {
    expect(activeSql).toMatch(/'consumed_definitive', \(v_row\.status = 'delivered'\)/);
  });
});

function state(over: Record<string, unknown> = {}) {
  return {
    success: true,
    idempotent: false,
    status: "reserved",
    campaign_id: "camp-1",
    operation_id: "op-1",
    amount: 3,
    credit_tx_id: "tx-1",
    refund_tx_id: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F56.2b1a — cliente fino de operação de crédito (simulado)", () => {
  it("reserve invoca a RPC correta e mapeia o estado temporário", async () => {
    m.rpc.mockResolvedValue({ data: state(), error: null });

    const result = await new ProductOneToOneCreditOperationClient().reserve({
      storeId: "store-1",
      campaignId: "camp-1",
      operationId: "op-1",
      amount: 3,
    });

    expect(m.rpc).toHaveBeenCalledWith("product_1_1_reserve_credit_operation", {
      p_store_id: "store-1",
      p_campaign_id: "camp-1",
      p_operation_id: "op-1",
      p_amount: 3,
      p_metadata: {},
    });
    expect(result).toMatchObject({
      status: "reserved",
      amount: 3,
      creditTxId: "tx-1",
      consumedDefinitive: false,
    });
  });

  it("delivered marca consumo definitivo; refunded restaura", async () => {
    m.rpc.mockResolvedValueOnce({ data: state({ status: "delivered" }), error: null });
    const delivered = await new ProductOneToOneCreditOperationClient().deliver("camp-1", "op-1");
    expect(delivered.consumedDefinitive).toBe(true);

    m.rpc.mockResolvedValueOnce({
      data: state({ status: "refunded", refund_tx_id: "rf-1" }),
      error: null,
    });
    const refunded = await new ProductOneToOneCreditOperationClient().refund(
      "camp-1",
      "op-1",
      "falha",
    );
    expect(refunded.status).toBe("refunded");
    expect(refunded.refundTxId).toBe("rf-1");
    expect(m.rpc).toHaveBeenLastCalledWith("product_1_1_refund_campaign_credit_operation", {
      p_campaign_id: "camp-1",
      p_operation_id: "op-1",
      p_reason: "falha",
    });
  });

  it("estorno terminal após delivered é mapeado para erro identificável", async () => {
    m.rpc.mockResolvedValue({
      data: null,
      error: { message: "delivered_not_refundable" },
    });

    await expect(
      new ProductOneToOneCreditOperationClient().refund("camp-1", "op-1"),
    ).rejects.toMatchObject({ code: "delivered_not_refundable" });
  });

  it("falha do ledger de crédito vira credit_reservation_failed", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "saldo_insuficiente" } });

    await expect(
      new ProductOneToOneCreditOperationClient().reserve({
        storeId: "store-1",
        campaignId: "camp-1",
        operationId: "op-1",
        amount: 3,
      }),
    ).rejects.toMatchObject({ code: "credit_reservation_failed" });
  });

  it("resposta vazia/ inválida lança erro (nunca sucesso enganoso)", async () => {
    m.rpc.mockResolvedValue({ data: null, error: null });
    await expect(
      new ProductOneToOneCreditOperationClient().deliver("camp-1", "op-1"),
    ).rejects.toBeInstanceOf(CreditOperationError);
  });

  it("get retorna null quando a operação não existe; reconcile retorna contagem", async () => {
    m.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await new ProductOneToOneCreditOperationClient().get("camp-1", "op-1")).toBeNull();

    m.rpc.mockResolvedValueOnce({ data: { success: true, reconciled: 2 }, error: null });
    expect(await new ProductOneToOneCreditOperationClient().reconcile(15)).toBe(2);
  });
});
