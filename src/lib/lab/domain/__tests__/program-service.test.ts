// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LabProgramError,
  authorizeProgramBudget,
  closeProgram,
  remainingUsd,
  updateProgram,
} from "../program-service";

/**
 * F48.2.1 (C1/C2/C3) — terminalidade e fail-closed do serviço de programa.
 *
 * Client Supabase **fake em memória** (mesmo estilo `from(table)`/
 * `update().eq().select()` dos contract tests do laboratório): nenhuma chamada de
 * rede e nenhuma chamada paga. Prova que `closed` é terminal, que a reautorização
 * é recusada ANTES de escrever e que o histórico financeiro é preservado.
 */

type Row = Record<string, unknown>;

interface FakeState {
  tables: Record<string, Row[]>;
  updateCalls: Array<{ table: string; values: Row }>;
}

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private mode: "select" | "update" = "select";
  private payload: Row | null = null;

  constructor(
    private readonly state: FakeState,
    private readonly table: string,
  ) {}

  select(_columns?: string): this {
    return this;
  }

  update(payload: Row): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  private matched(): Row[] {
    return (this.state.tables[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
  }

  private execute(): { data: unknown; error: unknown } {
    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.payload ?? {});
      this.state.updateCalls.push({ table: this.table, values: this.payload as Row });
      return { data: matched, error: null };
    }
    return { data: this.matched(), error: null };
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    const result = this.execute();
    return { data: (result.data as Row[])[0] ?? null, error: result.error };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function fakeClient(state: FakeState): SupabaseClient {
  return {
    from(table: string) {
      return new FakeQuery(state, table);
    },
  } as unknown as SupabaseClient;
}

const PROGRAM_ID = "88888888-8888-4888-8888-888888888888";
const ACTOR_ID = "66666666-6666-4666-8666-666666666666";

function authorizedProgram(overrides: Partial<Row> = {}): Row {
  return {
    id: PROGRAM_ID,
    status: "authorized",
    budget_usd: 100,
    budget_reserved_usd: 20,
    budget_consumed_usd: 30,
    budget_authorized_by: ACTOR_ID,
    budget_authorized_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function newState(program: Row | null = authorizedProgram()): FakeState {
  return {
    tables: program ? { lab_prompt_programs: [program] } : { lab_prompt_programs: [] },
    updateCalls: [],
  };
}

function programOf(state: FakeState): Row {
  return state.tables.lab_prompt_programs[0];
}

// ─── closeProgram — terminal e com histórico preservado ──────────────────────

describe("closeProgram — encerra preservando o histórico financeiro", () => {
  it("authorized → closed sem tocar nos valores financeiros", async () => {
    const state = newState();

    await closeProgram({ programId: PROGRAM_ID, actorId: ACTOR_ID, client: fakeClient(state) });

    const program = programOf(state);
    expect(program.status).toBe("closed");
    expect(program.budget_usd).toBe(100);
    expect(program.budget_reserved_usd).toBe(20);
    expect(program.budget_consumed_usd).toBe(30);
    expect(program.budget_authorized_by).toBe(ACTOR_ID);
    expect(program.budget_authorized_at).toBe("2026-01-01T00:00:00.000Z");
    // O patch de encerramento nunca zera nem apaga os campos financeiros.
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0].values).toEqual({
      status: "closed",
      updated_at: expect.any(String),
    });
  });

  it("em programa já `closed` é idempotente (não escreve)", async () => {
    const state = newState(authorizedProgram({ status: "closed" }));

    await closeProgram({ programId: PROGRAM_ID, actorId: ACTOR_ID, client: fakeClient(state) });

    expect(programOf(state).status).toBe("closed");
    expect(state.updateCalls).toHaveLength(0);
  });

  it("programa ausente → program_not_found", async () => {
    const state = newState(null);

    await expect(
      closeProgram({ programId: PROGRAM_ID, actorId: ACTOR_ID, client: fakeClient(state) }),
    ).rejects.toMatchObject({ name: "LabProgramError", code: "program_not_found" });
    expect(state.updateCalls).toHaveLength(0);
  });
});

// ─── authorizeProgramBudget — recusa de reautorização ────────────────────────

describe("authorizeProgramBudget — reautorização de `closed` é recusada", () => {
  it("programa `closed` → program_closed sem executar update", async () => {
    const state = newState(authorizedProgram({ status: "closed" }));

    const rejection = await authorizeProgramBudget({
      programId: PROGRAM_ID,
      budgetUsd: 50,
      actorId: ACTOR_ID,
      client: fakeClient(state),
    }).catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(LabProgramError);
    expect((rejection as LabProgramError).code).toBe("program_closed");
    expect(state.updateCalls).toHaveLength(0);
    // O orçamento original permanece intacto.
    expect(programOf(state).budget_usd).toBe(100);
    expect(programOf(state).status).toBe("closed");
  });

  it("programa ausente → program_not_found sem escrever", async () => {
    const state = newState(null);

    await expect(
      authorizeProgramBudget({
        programId: PROGRAM_ID,
        budgetUsd: 50,
        actorId: ACTOR_ID,
        client: fakeClient(state),
      }),
    ).rejects.toMatchObject({ name: "LabProgramError", code: "program_not_found" });
    expect(state.updateCalls).toHaveLength(0);
  });

  it("programa `authorized` continua autorizando normalmente", async () => {
    const state = newState(authorizedProgram({ status: "authorized" }));

    await authorizeProgramBudget({
      programId: PROGRAM_ID,
      budgetUsd: 250,
      actorId: ACTOR_ID,
      client: fakeClient(state),
    });

    expect(programOf(state).budget_usd).toBe(250);
    expect(programOf(state).status).toBe("authorized");
  });
});

// ─── updateProgram — guarda de terminalidade ─────────────────────────────────

describe("updateProgram — `closed` não retorna a draft/authorized", () => {
  it("recusa closed → authorized com program_closed sem escrever", async () => {
    const state = newState(authorizedProgram({ status: "closed" }));

    const rejection = await updateProgram(
      PROGRAM_ID,
      { status: "authorized" },
      fakeClient(state),
    ).catch((error: unknown) => error);

    expect((rejection as LabProgramError).code).toBe("program_closed");
    expect(state.updateCalls).toHaveLength(0);
    expect(programOf(state).status).toBe("closed");
  });

  it("recusa closed → draft com program_closed sem escrever", async () => {
    const state = newState(authorizedProgram({ status: "closed" }));

    await expect(
      updateProgram(PROGRAM_ID, { status: "draft" }, fakeClient(state)),
    ).rejects.toMatchObject({ name: "LabProgramError", code: "program_closed" });
    expect(state.updateCalls).toHaveLength(0);
  });

  it("permite registrar recomendação de programa `closed` sem mudar o status", async () => {
    const state = newState(authorizedProgram({ status: "closed" }));

    await updateProgram(
      PROGRAM_ID,
      { recommendation: { prompt: "offer", winner: "candidate" } },
      fakeClient(state),
    );

    expect(programOf(state).status).toBe("closed");
    expect(programOf(state).recommendation).toEqual({ prompt: "offer", winner: "candidate" });
    expect(state.updateCalls).toHaveLength(1);
  });

  it("permite registrar relatório de programa `closed` sem mudar o status", async () => {
    const state = newState(authorizedProgram({ status: "closed" }));

    await updateProgram(
      PROGRAM_ID,
      { finalReportRef: "docs/lab/report.md", finalReportHash: "a".repeat(64) },
      fakeClient(state),
    );

    expect(programOf(state).status).toBe("closed");
    expect(programOf(state).final_report_ref).toBe("docs/lab/report.md");
  });
});

// ─── Saldo permanece derivável após o encerramento ───────────────────────────

describe("remainingUsd — inalterado pelo encerramento", () => {
  it("saldo continua budget_usd - consumed - reserved", () => {
    expect(
      remainingUsd({ budget_usd: 100, budget_consumed_usd: 30, budget_reserved_usd: 20 }),
    ).toBe(50);
  });
});
