// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COPY_CANCELLATION_REASON,
  drainCopyTask,
  readCopyDelivery,
  recordCancellation,
  recordCopyState,
  type CopyState,
  type CopyStateStore,
  type CopyStateTransitionResult,
} from "../copy/copy-state";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 08 / P2 (opção aprovada): ordenação/transição da copy
// garantida NO BANCO. Contract test ESTÁTICO (SQL da migration) + SIMULADO
// (sem banco, sem provider). As RPCs reais são provadas na instância isolada do
// Plano 09; aqui provamos (a) que o SQL contém a mecânica aprovada e (b) o
// comportamento do CLIENTE/drenador sobre envelopes condicionais.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261009000005_f56_2b1b_copy_state.sql";
const migrationSql = readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), "utf8");
// SQL ATIVO (sem linhas de comentário) — o bloco REVERT é comentado.
const ACTIVE_SQL = migrationSql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";

// ---------------------------------------------------------------------------
// 1. Asserções ESTÁTICAS do SQL (RPCs + grants + zero colunas novas)
// ---------------------------------------------------------------------------

describe("P2 — migration: RPCs condicionais + grants RPC-only (SQL estático)", () => {
  it("define as DUAS RPCs condicionais SECURITY DEFINER com search_path vazio", () => {
    expect(migrationSql).toContain("FUNCTION public.product_1_1_apply_copy_state(");
    expect(migrationSql).toContain("FUNCTION public.product_1_1_cancel_copy(");
    expect(migrationSql).toContain("SECURITY DEFINER");
    expect(migrationSql).toContain("SET search_path = ''");
  });

  it("apply_copy_state: trava por operação + corrida resolvida por RE-LEITURA (C1)", () => {
    expect(migrationSql).toContain("FOR UPDATE");
    expect(migrationSql).toContain("ON CONFLICT (campaign_id, operation_id) DO NOTHING");
    // C1 — uma SEGUNDA re-leitura sob trava após perder a corrida (nunca `rejected`
    // com `state: null`). O corpo tem DOIS `FOR UPDATE`.
    expect(migrationSql.match(/FOR UPDATE/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(migrationSql).toContain("copy_state_race_unresolved");
    expect(migrationSql).not.toContain("'rejected', 'state', NULL");
  });

  it("apply_copy_state: terminal PROTEGIDO derivado + replay por CONTEÚDO NULL-safe", () => {
    // `terminal` DERIVADO do state (nenhuma coluna dedicada).
    expect(migrationSql).toContain("v_terminal := v_row.state IN ('completed','failed');");
    // Comparação de conteúdo NULL-safe (`IS NOT DISTINCT FROM`).
    expect(migrationSql).toContain("IS NOT DISTINCT FROM");
    // Desfechos do contrato.
    expect(migrationSql).toContain("'conflict'");
    expect(migrationSql).toContain("'idempotent'");
    expect(migrationSql).toContain("'rejected'");
    expect(migrationSql).toContain("'invalid_content'");
  });

  it("C2 — `completed` exige conteúdo entregável (invalid_content)", () => {
    expect(migrationSql).toContain("p_state = 'completed'");
    expect(migrationSql).toContain("btrim(p_copy_text) = ''");
    expect(migrationSql).toContain("'invalid_content'");
  });

  it("cancel_copy: aplica `failed` + registra o motivo (atomicidade) e recusa sobre `completed`", () => {
    expect(migrationSql).toContain("public.product_1_1_apply_copy_state(");
    expect(migrationSql).toContain("INSERT INTO public.product_1_1_copy_cancellations");
    expect(migrationSql).toContain("ON CONFLICT (campaign_id, operation_id) DO NOTHING");
    // Só registra o cancelamento quando o estado OBSERVADO é `failed`.
    expect(migrationSql).toContain("IF v_state = 'failed' THEN");
    expect(migrationSql).toContain("'canceled'");
  });

  it("A2 — RPC-only writes: `service_role` fica com SELECT only (INSERT/UPDATE/DELETE revogados)", () => {
    expect(ACTIVE_SQL).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_state FROM service_role;",
    );
    expect(ACTIVE_SQL).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_cancellations FROM service_role;",
    );
    expect(ACTIVE_SQL).toContain(
      "GRANT SELECT ON TABLE public.product_1_1_copy_state TO service_role;",
    );
    expect(ACTIVE_SQL).toContain(
      "GRANT SELECT ON TABLE public.product_1_1_copy_cancellations TO service_role;",
    );
    expect(ACTIVE_SQL).not.toContain("GRANT SELECT, INSERT");
    expect(ACTIVE_SQL).not.toContain("GRANT SELECT, INSERT, UPDATE");
  });

  it("A2 — as policies de `service_role` são FOR SELECT (nunca FOR ALL)", () => {
    expect(ACTIVE_SQL).toContain("FOR SELECT TO service_role");
    expect(ACTIVE_SQL).not.toMatch(/FOR ALL TO service_role/);
  });

  it("A2 — EXECUTE concedido SOMENTE a `service_role` (negado a PUBLIC/anon/authenticated)", () => {
    expect(ACTIVE_SQL).toContain(
      "REVOKE ALL ON FUNCTION public.product_1_1_apply_copy_state(UUID, UUID, TEXT, TEXT, JSONB)",
    );
    expect(ACTIVE_SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.product_1_1_apply_copy_state(UUID, UUID, TEXT, TEXT, JSONB)",
    );
    expect(ACTIVE_SQL).toContain(
      "REVOKE ALL ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT)",
    );
    expect(ACTIVE_SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT)",
    );
    expect(ACTIVE_SQL).toContain("FROM PUBLIC, anon, authenticated");
    expect(ACTIVE_SQL).toContain("TO service_role;");
  });

  it("ZERO colunas novas — `terminal` é derivado, nunca armazenado", () => {
    expect(migrationSql).not.toMatch(/ADD COLUMN/i);
    for (const forbidden of ["confirmation", "confirmed_at", "revision", "last_write_source"]) {
      expect(
        migrationSql.split(/\r?\n/).filter((l) => !l.trimStart().startsWith("--")).join("\n"),
      ).not.toContain(`${forbidden} `);
    }
    // `terminal` é DERIVADO (não há coluna `terminal`).
    const createBlock = ACTIVE_SQL.slice(
      ACTIVE_SQL.indexOf("CREATE TABLE IF NOT EXISTS public.product_1_1_copy_state"),
      ACTIVE_SQL.indexOf("CREATE INDEX IF NOT EXISTS idx_p1_1_copy_state"),
    );
    expect(createBlock).not.toMatch(/\bterminal\b/);
  });

  it("REVERT estendido — drop das funções + restauração dos grants originais", () => {
    expect(migrationSql).toContain(
      "DROP FUNCTION IF EXISTS public.product_1_1_cancel_copy(UUID, UUID, TEXT)",
    );
    expect(migrationSql).toContain(
      "DROP FUNCTION IF EXISTS public.product_1_1_apply_copy_state(UUID, UUID, TEXT, TEXT, JSONB)",
    );
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT, UPDATE ON TABLE public.product_1_1_copy_state TO service_role;",
    );
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT ON TABLE public.product_1_1_copy_cancellations TO service_role;",
    );
  });

  it("permanece LOCAL-ONLY/autorada e NÃO aplica remoto", () => {
    expect(migrationSql).toContain("LOCAL-ONLY");
    expect(migrationSql).toContain("apenas AUTORADA");
    expect(ACTIVE_SQL).not.toMatch(/db push/i);
  });
});

// ---------------------------------------------------------------------------
// 2. Simulador FIEL do CAS do banco (transições + terminal + replay + C1/C2)
// ---------------------------------------------------------------------------

interface SimRow {
  state: CopyState;
  copyText: string | null;
  copyPayload: Record<string, unknown> | null;
}

/**
 * Espelha `product_1_1_apply_copy_state`: cria a linha (first write), e nas
 * escritas seguintes aplica transição CONDICIONAL com terminal PROTEGIDO e
 * replay por CONTEÚDO. `firstWriteLoser` modela a corrida: o `INSERT … DO
 * NOTHING` devolve NULL e a RPC RE-LÊ a linha vencedora e aplica a MESMA regra
 * (C1) — nunca devolve `rejected` com `state: null`.
 */
class CopyStateCasDb {
  row: SimRow | null = null;
  rows = 0;
  cancellations = 0;

  #invalidContent(state: CopyState, copyText: string | null): boolean {
    return state === "completed" && (copyText === null || copyText.trim() === "");
  }

  #applyToExisting(
    state: CopyState,
    copyText: string | null,
    copyPayload: Record<string, unknown> | null,
  ): CopyStateTransitionResult {
    const row = this.row as SimRow;
    const terminal = row.state === "completed" || row.state === "failed";
    if (terminal) {
      if (row.state === state) {
        const equivalent =
          row.copyText === copyText &&
          JSON.stringify(row.copyPayload) === JSON.stringify(copyPayload);
        return equivalent
          ? { applied: false, outcome: "idempotent", state }
          : { applied: false, outcome: "conflict", state };
      }
      return { applied: false, outcome: "rejected", state: row.state };
    }
    if (row.state === state) {
      return { applied: false, outcome: "idempotent", state };
    }
    this.row = { state, copyText, copyPayload };
    return { applied: true, outcome: "applied", state };
  }

  /** RPC `apply_copy_state` (winner da corrida ou escrita subsequente). */
  apply(
    state: CopyState,
    copyText: string | null = null,
    copyPayload: Record<string, unknown> | null = null,
  ): CopyStateTransitionResult {
    if (this.#invalidContent(state, copyText)) {
      return { applied: false, outcome: "invalid_content", state: null };
    }
    if (this.row === null) {
      this.row = { state, copyText, copyPayload };
      this.rows += 1;
      return { applied: true, outcome: "applied", state };
    }
    return this.#applyToExisting(state, copyText, copyPayload);
  }

  /**
   * C1 — PRIMEIRA escrita que PERDE a corrida: o `INSERT … ON CONFLICT DO
   * NOTHING` não cria linha (o vencedor já criou) e a RPC RE-LÊ sob trava,
   * aplicando a MESMA regra contra o estado PERSISTIDO.
   */
  firstWriteLoser(
    state: CopyState,
    copyText: string | null = null,
    copyPayload: Record<string, unknown> | null = null,
  ): CopyStateTransitionResult {
    if (this.#invalidContent(state, copyText)) {
      return { applied: false, outcome: "invalid_content", state: null };
    }
    // Perdeu a corrida ⇒ a linha vencedora já existe; re-lê e aplica a regra.
    return this.#applyToExisting(state, copyText, copyPayload);
  }

  /** RPC `cancel_copy`: aplica `failed` + registra o motivo (atômico). */
  cancel(reason: string): { applied: boolean; state: CopyState | null; canceled: boolean } {
    const res = this.apply("failed");
    if (res.state === "failed") {
      this.cancellations += 1;
      return { applied: res.applied, state: "failed", canceled: true };
    }
    return { applied: res.applied, state: res.state, canceled: false };
  }
}

describe("P2 — transições condicionais no BANCO (simulador fiel)", () => {
  it("C1 — a primeira escrita PERDEDORA re-lê e aplica a regra: equivalente ⇒ idempotent", () => {
    const db = new CopyStateCasDb();
    const winner = db.apply("completed", "legenda", { caption: "legenda" });
    expect(winner).toEqual({ applied: true, outcome: "applied", state: "completed" });

    const loserEquivalent = db.firstWriteLoser("completed", "legenda", { caption: "legenda" });
    expect(loserEquivalent).toEqual({ applied: false, outcome: "idempotent", state: "completed" });
    expect(db.rows).toBe(1);
  });

  it("C1 — a primeira escrita PERDEDORA com conteúdo DIVERGENTE ⇒ conflict (persistido inalterado)", () => {
    const db = new CopyStateCasDb();
    db.apply("completed", "legenda", { caption: "legenda" });

    const loserDivergentText = db.firstWriteLoser("completed", "OUTRA", { caption: "legenda" });
    expect(loserDivergentText).toEqual({ applied: false, outcome: "conflict", state: "completed" });
    expect(db.row?.copyText).toBe("legenda");

    const loserDivergentPayload = db.firstWriteLoser("completed", "legenda", { caption: "X" });
    expect(loserDivergentPayload).toEqual({ applied: false, outcome: "conflict", state: "completed" });
    expect(db.row?.copyPayload).toEqual({ caption: "legenda" });
    expect(db.rows).toBe(1);
    // NUNCA `rejected` com `state: null` (a linha vencedora guia a decisão).
    expect(loserDivergentText.state).not.toBeNull();
  });

  it("terminal PROTEGIDO — escrita atrasada NÃO sobrescreve o terminal persistido", () => {
    const db = new CopyStateCasDb();
    expect(db.apply("pending")).toEqual({ applied: true, outcome: "applied", state: "pending" });
    expect(db.apply("failed")).toEqual({ applied: true, outcome: "applied", state: "failed" });
    expect(db.apply("pending")).toEqual({ applied: false, outcome: "rejected", state: "failed" });
    expect(db.apply("completed", "texto", {})).toEqual({
      applied: false,
      outcome: "rejected",
      state: "failed",
    });
    expect(db.row?.state).toBe("failed");
  });

  it("DIVERGENTE replay ⇒ conflict (variação copy_text E copy_payload)", () => {
    const db = new CopyStateCasDb();
    db.apply("completed", "texto A", { caption: "A" });
    expect(db.apply("completed", "texto B", { caption: "A" })).toEqual({
      applied: false,
      outcome: "conflict",
      state: "completed",
    });
    expect(db.apply("completed", "texto A", { caption: "B" })).toEqual({
      applied: false,
      outcome: "conflict",
      state: "completed",
    });
    expect(db.apply("completed", "texto A", { caption: "A" })).toEqual({
      applied: false,
      outcome: "idempotent",
      state: "completed",
    });
    expect(db.rows).toBe(1);
  });

  it("idempotente replay ⇒ UMA única linha", () => {
    const db = new CopyStateCasDb();
    db.apply("pending");
    db.apply("pending");
    db.apply("pending");
    expect(db.rows).toBe(1);
    expect(db.row?.state).toBe("pending");
  });

  it("completion × cancellation — `cancel_copy` RECUSA sobre um `completed` persistido", () => {
    const db = new CopyStateCasDb();
    db.apply("completed", "legenda", { caption: "legenda" });
    const res = db.cancel(COPY_CANCELLATION_REASON);
    expect(res).toEqual({ applied: false, state: "completed", canceled: false });
    expect(db.cancellations).toBe(0);
    expect(db.row?.state).toBe("completed");
  });

  it("falha COMUM sem cancelamento — `failed` NÃO exige cancelamento", () => {
    const db = new CopyStateCasDb();
    db.apply("failed");
    expect(db.row?.state).toBe("failed");
    expect(db.cancellations).toBe(0);
  });

  it("cancelamento ATÔMICO — `failed` + motivo numa SÓ ação", () => {
    const db = new CopyStateCasDb();
    db.apply("pending");
    const res = db.cancel(COPY_CANCELLATION_REASON);
    expect(res).toEqual({ applied: true, state: "failed", canceled: true });
    expect(db.row?.state).toBe("failed");
    expect(db.cancellations).toBe(1);
  });

  it("C2 — `completed` sem conteúdo entregável ⇒ invalid_content (nunca persistido)", () => {
    const db = new CopyStateCasDb();
    expect(db.apply("completed", null, null)).toEqual({
      applied: false,
      outcome: "invalid_content",
      state: null,
    });
    expect(db.apply("completed", "   ", null)).toEqual({
      applied: false,
      outcome: "invalid_content",
      state: null,
    });
    expect(db.rows).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Cliente — VALIDA o envelope da RPC e FALHA FECHADO (C2)
// ---------------------------------------------------------------------------

function clientWithRpcResponse(response: { data: unknown; error: unknown }): SupabaseClient {
  return {
    rpc: () => Promise.resolve(response),
  } as unknown as SupabaseClient;
}

const VALID_TRANSITION: CopyStateTransitionResult = {
  applied: false,
  outcome: "idempotent",
  state: "completed",
};

describe("P2 — o cliente valida o envelope e falha fechado", () => {
  it("aceita um envelope COERENTE de apply_copy_state", async () => {
    const client = clientWithRpcResponse({ data: VALID_TRANSITION, error: null });
    await expect(
      recordCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, state: "completed", copyText: "t" }),
    ).resolves.toEqual(VALID_TRANSITION);
  });

  it("INCOMPLETA/CONTRADITÓRIA ⇒ lança (NUNCA trata como persistência confirmada)", async () => {
    const invalid: unknown[] = [
      null,
      {},
      { outcome: "applied", state: "completed" },
      { applied: true, outcome: "applied", state: null },
      { applied: true, outcome: "idempotent", state: "completed" },
      { applied: false, outcome: "applied", state: "completed" },
      { applied: true, outcome: "bogus", state: "completed" },
      { applied: "yes", outcome: "applied", state: "completed" },
      { applied: false, outcome: "idempotent", state: "not-a-state" },
    ];
    for (const data of invalid) {
      const client = clientWithRpcResponse({ data, error: null });
      await expect(
        recordCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, state: "completed", copyText: "t" }),
      ).rejects.toThrow(/product_1_1_apply_copy_state/);
    }
  });

  it("erro de RPC ⇒ lança (fail-closed)", async () => {
    const client = clientWithRpcResponse({ data: null, error: { message: "boom" } });
    await expect(
      recordCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, state: "pending" }),
    ).rejects.toThrow(/product_1_1_apply_copy_state_rpc_failed/);
  });

  it("cancel_copy: envelope coerente aceito; contraditório (canceled:true sem failed) ⇒ lança", async () => {
    const ok = clientWithRpcResponse({
      data: { applied: true, state: "failed", canceled: true },
      error: null,
    });
    await expect(
      recordCancellation(ok, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, reason: "r" }),
    ).resolves.toEqual({ applied: true, state: "failed", canceled: true });

    for (const data of [null, { applied: true, state: "pending", canceled: true }, { applied: true, canceled: true }]) {
      const client = clientWithRpcResponse({ data, error: null });
      await expect(
        recordCancellation(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, reason: "r" }),
      ).rejects.toThrow(/product_1_1_cancel_copy/);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. TIMEOUT LOCAL ⇒ RE-LEITURA (A1): sem segundo write; estado persistido
// ---------------------------------------------------------------------------

function readClientWith(row: SimRow | null): SupabaseClient {
  const chain = {
    eq() {
      return chain;
    },
    maybeSingle() {
      return Promise.resolve({
        data:
          row === null
            ? null
            : { state: row.state, copy_text: row.copyText, copy_payload: row.copyPayload },
        error: null,
      });
    },
  };
  return {
    from() {
      return {
        select() {
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("P2 — timeout LOCAL (A1): incerteza resolvida por RE-LEITURA, sem 2º write", () => {
  it("a RPC de escrita responde APÓS o orçamento ⇒ `unconfirmed`; a persistência real é revelada pela re-leitura", async () => {
    let persisted: SimRow | null = null;
    const stateCalls: CopyState[] = [];
    const store: CopyStateStore = {
      async recordCopyState(input) {
        stateCalls.push(input.state);
        if (input.state === "completed") {
          // A escrita CHEGA ao banco (persiste) mas a RESPOSTA se perde (pendura
          // além do orçamento do chamador).
          persisted = {
            state: "completed",
            copyText: input.copyText ?? null,
            copyPayload: input.copyPayload ?? null,
          };
          await new Promise<void>(() => {});
        }
        persisted = {
          state: input.state,
          copyText: input.copyText ?? null,
          copyPayload: input.copyPayload ?? null,
        };
        return { applied: true, outcome: "applied", state: input.state };
      },
      async recordCancellation() {
        return { applied: true, state: "failed", canceled: true };
      },
    };

    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          await commit({ copyText: "texto real", payload: { caption: "texto real" } });
        },
      },
      store,
      { persistenceBudgetMs: 5 },
    );

    // Incerteza LOCAL do chamador (timeout) — NADA é afirmado nem renderizado.
    expect(result).toEqual({ state: "unconfirmed", canceled: false });
    // NENHUM segundo write de confirmação foi emitido (apenas pending + completed).
    expect(stateCalls).toEqual(["pending", "completed"]);

    // A RE-LEITURA revela o estado REALMENTE persistido (`completed` + texto).
    const delivery = await readCopyDelivery(readClientWith(persisted), {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(delivery).toEqual({
      state: "completed",
      copyText: "texto real",
      copyPayload: { caption: "texto real" },
    });
    // NENHUM campo `confirmation` existe no registro lido.
    expect(Object.keys(delivery ?? {})).toEqual(["state", "copyText", "copyPayload"]);
  });

  it("re-leitura quando a escrita NÃO chegou ⇒ `pending` (sem promessa de sucesso)", async () => {
    const delivery = await readCopyDelivery(
      readClientWith({ state: "pending", copyText: null, copyPayload: null }),
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
    );
    expect(delivery).toEqual({ state: "pending", copyText: null, copyPayload: null });
  });
});
