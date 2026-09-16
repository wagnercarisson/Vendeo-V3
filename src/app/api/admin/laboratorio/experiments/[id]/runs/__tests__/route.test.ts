import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const {
  mockRequireAdmin,
  mockAssertLabEnvironment,
  mockPrepareExperimentRun,
  mockRunPreparedExperimentRun,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockAssertLabEnvironment: vi.fn(),
  mockPrepareExperimentRun: vi.fn(),
  mockRunPreparedExperimentRun: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/lab/environment-guard", () => {
  class LabEnvironmentError extends Error {
    readonly reason: string;
    constructor(reason: string) {
      super(`Laboratório bloqueado: ${reason}`);
      this.name = "LabEnvironmentError";
      this.reason = reason;
    }
  }
  return {
    LabEnvironmentError,
    assertLabEnvironment: () => mockAssertLabEnvironment(),
    labEnvironmentDeniedBody: (reason: string) => ({ error: "environment_blocked", reason }),
    getLabEnvironment: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/lib/lab/api/run-execution", () => ({
  prepareExperimentRun: (...args: unknown[]) => mockPrepareExperimentRun(...args),
  runPreparedExperimentRun: (...args: unknown[]) => mockRunPreparedExperimentRun(...args),
}));

import { ForbiddenError } from "@/lib/auth/errors";
import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";

/**
 * F48.1 (D11/D14/T-48-1-60/61) — rota NDJSON de execução de um run.
 * `run-execution` é mockado: nenhuma chamada paga e nenhuma rede.
 */

const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";
const VARIANT_ID = "77777777-7777-4777-8777-777777777777";
const SCENARIO_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const VALID_BODY = {
  variantId: VARIANT_ID,
  scenarioVersionId: SCENARIO_VERSION_ID,
  repetitionIndex: 1,
  confirmed: true,
  operationId: OPERATION_ID,
};

const PREPARED = {
  runId: "run-1",
  snapshot: { runType: "lab" },
  idempotent: false,
  executionContext: { scenario: {}, experiment: {}, variant: {}, variants: {} },
};

function postRuns(body: unknown) {
  return import("../route").then(({ POST }) =>
    POST(
      new NextRequest(
        new Request("http://localhost/api/admin/laboratorio/experiments/x/runs", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
      ),
      { params: Promise.resolve({ id: EXPERIMENT_ID }) },
    ),
  );
}

function reservationError(code: string): Error {
  return Object.assign(new Error(code), { code, name: "LabReservationError" });
}

/** Conta os eventos terminais (`done`/`error`) do corpo NDJSON. */
function countTerminals(body: string): number {
  return body
    .split("\n")
    .filter((line) => line.includes('"type":"done"') || line.includes('"type":"error"')).length;
}

async function blockEnvironment(reason: LabEnvironmentReason = "disabled_flag") {
  const { LabEnvironmentError } = await import("@/lib/lab/environment-guard");
  mockAssertLabEnvironment.mockImplementation(() => {
    throw new LabEnvironmentError(reason);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockAssertLabEnvironment.mockReturnValue({
    enabled: true,
    supabaseHost: "localhost",
    local: true,
    reason: "ok",
  });
  mockPrepareExperimentRun.mockResolvedValue(PREPARED);
  // O serviço real é o **único dono dos eventos terminais**: o mock reproduz isso
  // emitindo o terminal via `onEvent` (a rota não adiciona um segundo).
  mockRunPreparedExperimentRun.mockImplementation(
    async (params: { onEvent?: (event: unknown) => void }) => {
      params.onEvent?.({ type: "done", runId: "run-1", status: "succeeded" });
      return { runId: "run-1", status: "succeeded" };
    },
  );
});

describe("POST /api/admin/laboratorio/experiments/[id]/runs", () => {
  it("nega não-admin com 403 e não prepara o run", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await postRuns(VALID_BODY);

    expect(res.status).toBe(403);
    expect(mockPrepareExperimentRun).not.toHaveBeenCalled();
  });

  it("ambiente bloqueado ⇒ 403 environment_blocked sem preparar o run", async () => {
    await blockEnvironment("non_local_supabase");

    const res = await postRuns(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: "environment_blocked", reason: "non_local_supabase" });
    expect(mockPrepareExperimentRun).not.toHaveBeenCalled();
  });

  it("corpo sem confirmação explícita ⇒ 422 confirmation_required sem preparar o run", async () => {
    const { confirmed, ...withoutConfirmation } = VALID_BODY;
    void confirmed;

    const res = await postRuns(withoutConfirmation);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe("confirmation_required");
    expect(mockPrepareExperimentRun).not.toHaveBeenCalled();
    expect(mockRunPreparedExperimentRun).not.toHaveBeenCalled();
  });

  it("payload inválido ⇒ 400 invalid_payload", async () => {
    const res = await postRuns({ confirmed: true, variantId: "não-é-uuid" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockPrepareExperimentRun).not.toHaveBeenCalled();
  });

  it.each([
    ["budget_exceeded", 409],
    ["run_already_active", 409],
    ["idempotency_conflict", 409],
    ["experiment_not_ready", 409],
    ["missing_snapshot", 400],
    ["missing_operation_id", 400],
    ["variant_not_in_experiment", 400],
    ["scenario_not_in_experiment", 400],
    ["repetition_out_of_range", 400],
    ["invalid_supersedes_run", 400],
    ["unsupported_scenario_mode", 400],
    ["scenario_hash_mismatch", 409],
    ["experiment_not_found", 404],
  ])("mapeia %s para HTTP %i antes de abrir o stream", async (code, status) => {
    mockPrepareExperimentRun.mockRejectedValue(reservationError(code));

    const res = await postRuns(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(status);
    expect(body.error).toBe(code);
    expect(mockRunPreparedExperimentRun).not.toHaveBeenCalled();
  });

  it("operação idempotente ⇒ 200 { idempotent: true, runId } sem stream e sem nova chamada", async () => {
    mockPrepareExperimentRun.mockResolvedValue({ ...PREPARED, idempotent: true });

    const res = await postRuns(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ idempotent: true, runId: "run-1" });
    expect(res.headers.get("content-type")).not.toContain("application/x-ndjson");
    expect(mockRunPreparedExperimentRun).not.toHaveBeenCalled();
  });

  it("execução confirmada ⇒ NDJSON com exatamente 1 terminal e o runId", async () => {
    const res = await postRuns(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");

    const text = await res.text();
    expect(countTerminals(text)).toBe(1);
    expect(text).toContain('"type":"done"');
    expect(text).toContain('"runId":"run-1"');
    expect(mockRunPreparedExperimentRun).toHaveBeenCalledTimes(1);
  });

  it("falha de execução: o serviço emite o único terminal (sem `done` duplicado)", async () => {
    mockRunPreparedExperimentRun.mockImplementation(
      async (params: { onEvent?: (event: unknown) => void }) => {
        params.onEvent?.({ type: "error", code: "provider_error", message: "falha sanitizada" });
        return { runId: "run-1", status: "failed" };
      },
    );

    const res = await postRuns(VALID_BODY);
    const text = await res.text();

    expect(countTerminals(text)).toBe(1);
    expect(text).toContain('"type":"error"');
    expect(text).not.toContain('"type":"done"');
  });

  it("falha de setup antes do serviço emite exatamente 1 terminal de erro sanitizado", async () => {
    mockRunPreparedExperimentRun.mockRejectedValue(new Error("sk-secret-vazado"));

    const res = await postRuns(VALID_BODY);
    const text = await res.text();

    expect(countTerminals(text)).toBe(1);
    expect(text).toContain('"type":"error"');
    expect(text).not.toContain("sk-secret-vazado");
  });
});
