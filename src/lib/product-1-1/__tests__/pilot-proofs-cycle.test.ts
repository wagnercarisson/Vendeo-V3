// @vitest-environment node
import { describe, expect, it } from "vitest";

import { runProofs } from "../../../../supabase/proofs/f56_2b2c_pilot_spend_concurrency.mjs";

/**
 * Cliente `pg` SIMULADO com estado FIEL (auditoria de set_cap, gasto, bloqueio) e
 * que EXECUTA a restauração (UPDATE). Prova que o `finally` verifica/restaura sem
 * ReferenceError e que o estado final volta ao snapshot.
 */
class FakeClient {
  queryLog: string[];
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
    const st = this.state;
    if (s.includes("pg_backend_pid")) return { rows: [{ pid: 1 }] };
    if (s.includes("pg_stat_activity")) return { rows: [{ wait_event_type: "Lock", wait_event: "advisory" }] };
    if (s.includes("product_1_1_pilot_begin_paid_call")) {
      if (st.singleton.cap_usd === null || st.singleton.cap_usd === undefined) throw new Error("pilot_cap_not_configured");
      if (st.unknown) throw new Error("pilot_requires_reconciliation");
      const campaign = params[0];
      if (st.inFlight && st.inFlight !== campaign) throw new Error("pilot_busy");
      st.singleton.spent_usd = Number(st.singleton.spent_usd ?? 0) + Number(params[5] ?? 0);
      st.inFlight = campaign;
      return { rows: [{ r: { success: true, outcome: "acquired" } }] };
    }
    if (s.includes("product_1_1_pilot_set_cap")) {
      const op = params[3];
      const existing = st.audit.get(op);
      if (existing) {
        if (existing.cap === params[1] && existing.reason === params[2] && existing.actor === params[0]) {
          return { rows: [{ r: { success: true, idempotent: true, conflict: false } }] };
        }
        return { rows: [{ r: { success: false, conflict: true, idempotent: false } }] };
      }
      st.setCapCalls += 1;
      if (this.opts.failSetCapOn === st.setCapCalls) throw new Error("db_down_set_cap");
      st.audit.set(op, { cap: params[1], reason: params[2], actor: params[0] });
      st.singleton.cap_usd = params[1];
      st.singleton.cap_set_by = params[0];
      st.singleton.cap_reason = params[2];
      st.singleton.cap_operation_id = op;
      st.singleton.cap_set_at = "2026-10-16T00:00:00.000Z";
      return { rows: [{ r: { success: true, idempotent: false, conflict: false } }] };
    }
    if (s.includes("select cap_usd from public.product_1_1_pilot_spend_state")) return { rows: [{ cap_usd: st.singleton.cap_usd }] };
    if (s.includes("select cap_usd, cap_set_by")) return { rows: [{ ...st.singleton }] };
    if (s.includes("select spent_usd from")) return { rows: [{ spent_usd: st.singleton.spent_usd }] };
    if (s.includes("select * from public.product_1_1_pilot_spend_state")) return { rows: [{ ...st.singleton }] };
    if (s.includes("product_1_1_pilot_mark_unknown")) { st.unknown = true; return { rows: [{ r: { success: true } }] }; }
    if (s.includes("product_1_1_pilot_reconcile_unknown")) { st.unknown = false; return { rows: [{ r: { success: true } }] }; }
    if (s.includes("product_1_1_pilot_end_paid_call")) return { rows: [{ r: { success: true } }] };
    if (s.startsWith("update public.product_1_1_pilot_spend_state set")) {
      // EXECUTA a restauração de fato.
      st.singleton = {
        cap_usd: params[0], spent_usd: params[1], cap_set_by: params[2], cap_reason: params[3],
        cap_operation_id: params[4], cap_set_at: params[5], blocked_reason: params[6],
        blocked_at: params[7], updated_at: params[8],
      };
      return { rows: [] };
    }
    return { rows: [] };
  }
}

function makeState() {
  const singleton = {
    cap_usd: null, spent_usd: 0, cap_set_by: null, cap_reason: null, cap_operation_id: null,
    cap_set_at: null, blocked_reason: null, blocked_at: null, updated_at: "2026-10-16T00:00:00.000Z",
  };
  return {
    queryLog: [] as string[],
    unknown: false,
    inFlight: null as string | null,
    setCapCalls: 0,
    audit: new Map<string, unknown>(),
    singleton,
    initial: JSON.parse(JSON.stringify(singleton)),
  };
}

describe("F56.2b2c — ciclo do script de provas com pg SIMULADO", () => {
  it("sucesso: failures === 0 e o estado final volta EXATAMENTE ao snapshot", async () => {
    const state = makeState();
    const result = await runProofs({ makeClient: () => new FakeClient(state) });
    expect(result.failures).toBe(0);
    expect(state.singleton).toEqual(state.initial);
  });

  it("falha na 2ª chamada de set_cap (após a 1ª alterar o estado): finally restaura ao snapshot", async () => {
    const state = makeState();
    const result = await runProofs({ makeClient: () => new FakeClient(state, { failSetCapOn: 2 }) });
    expect(result.failures).toBeGreaterThan(0);
    // a 1ª alterou o teto; o finally comparou com o esperado (A) e RESTAUROU ao snapshot.
    expect(state.singleton).toEqual(state.initial);
  });
});
