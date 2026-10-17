// @vitest-environment node
import { describe, expect, it } from "vitest";

import { runProofs } from "../../../../supabase/proofs/f56_2b2c_pilot_spend_concurrency.mjs";

/**
 * Cliente `pg` SIMULADO — cobre o CICLO do script (sucesso e falha intermediária)
 * para provar que o `finally` verifica/restaura SEM `ReferenceError` (o estado
 * esperado é compartilhado entre `try` e `finally`).
 */
class FakeClient {
  queryLog: string[];
  setCapCalls = 0;
  private state: any;
  private opts: any;
  constructor(state: any, opts: any = {}) {
    this.state = state;
    this.opts = opts;
    this.queryLog = state.queryLog;
  }
  async connect(): Promise<void> {}
  async end(): Promise<void> {}
  async query(sql: string, params: any[] = []): Promise<{ rows: Array<Record<string, unknown>> }> {
    this.queryLog.push(sql);
    const s = String(sql);
    if (s.includes("pg_backend_pid")) return { rows: [{ pid: 1 }] };
    if (s.includes("pg_stat_activity")) return { rows: [{ wait_event_type: "Lock", wait_event: "advisory" }] };
    if (s.includes("product_1_1_pilot_begin_paid_call")) {
      const cap = this.state.singleton.cap_usd;
      if (cap === null || cap === undefined) throw new Error("pilot_cap_not_configured");
      if (this.state.unknown) throw new Error("pilot_requires_reconciliation");
      const campaign = params[0];
      if (this.state.inFlight && this.state.inFlight !== campaign) throw new Error("pilot_busy");
      this.state.singleton.spent_usd = Number(this.state.singleton.spent_usd ?? 0) + Number(params[5] ?? 0);
      this.state.inFlight = campaign;
      return { rows: [{ r: { success: true, outcome: "acquired" } }] };
    }
    if (s.includes("product_1_1_pilot_set_cap")) {
      this.setCapCalls += 1;
      if (this.opts.failSetCapOn === this.setCapCalls) throw new Error("db_down_set_cap");
      // espelha o teto no singleton
      this.state.singleton.cap_usd = params[1];
      this.state.singleton.cap_set_by = params[0];
      this.state.singleton.cap_reason = params[2];
      this.state.singleton.cap_operation_id = params[3];
      this.state.singleton.cap_set_at = "2026-10-16T00:00:00.000Z";
      return { rows: [{ r: { success: true, idempotent: false, conflict: false } }] };
    }
    if (s.includes("select cap_usd, cap_set_by")) {
      return { rows: [{ ...this.state.singleton }] };
    }
    if (s.includes("select cap_usd from public.product_1_1_pilot_spend_state")) {
      return { rows: [{ cap_usd: this.state.singleton.cap_usd }] };
    }
    if (s.includes("product_1_1_pilot_mark_unknown")) { this.state.unknown = true; return { rows: [{ r: { success: true } }] }; }
    if (s.includes("product_1_1_pilot_reconcile_unknown")) { this.state.unknown = false; return { rows: [{ r: { success: true } }] }; }
    if (s.includes("product_1_1_pilot_end_paid_call")) return { rows: [{ r: { success: true } }] };
    if (s.includes("select spent_usd from")) return { rows: [{ spent_usd: this.state.singleton.spent_usd }] };
    if (s.includes("select * from public.product_1_1_pilot_spend_state")) {
      return { rows: [{ ...this.state.singleton }] };
    }
    // begin/commit/rollback/advisory/delete/update → sem linhas
    return { rows: [] };
  }
}

function makeState() {
  return {
    queryLog: [] as string[],
    unknown: false,
    inFlight: null as string | null,
    singleton: {
      cap_usd: null,
      spent_usd: 0,
      cap_set_by: null,
      cap_reason: null,
      cap_operation_id: null,
      cap_set_at: null,
      blocked_reason: null,
      blocked_at: null,
      updated_at: "2026-10-16T00:00:00.000Z",
    },
  };
}

describe("F56.2b2c — ciclo do script de provas com pg SIMULADO", () => {
  it("sucesso: finally VERIFICA/RESTAURA sem ReferenceError", async () => {
    const state = makeState();
    const result = await runProofs({ makeClient: () => new FakeClient(state) });
    expect(typeof result.failures).toBe("number");
    // o finally executou a limpeza (delete das fixtures) sem lançar
    expect((state.queryLog as string[]).some((q) => q.includes("delete from public.product_1_1_pilot_paid_calls"))).toBe(true);
  });

  it("falha intermediária de set_cap: finally ainda executa a restauração (sem ReferenceError)", async () => {
    const state = makeState();
    const result = await runProofs({
      makeClient: () => new FakeClient(state, { failSetCapOn: 1 }),
    });
    expect(result.failures).toBeGreaterThan(0); // a etapa falhou e foi registrada
    // o finally rodou: verificação + restauração/limpeza
    expect((state.queryLog as string[]).some((q) => q.includes("update public.product_1_1_pilot_spend_state"))).toBe(true);
  });
});
