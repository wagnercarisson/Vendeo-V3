import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const {
  mockRequireAdmin,
  mockAssertLabEnvironment,
  MockLabEnvironmentError,
  mockListScenarioVersions,
  mockListRecentExperiments,
  mockGetExperimentDetail,
  mockGetRunDetail,
  mockListPendingEvaluations,
  mockGetActiveCampaignImageTarget,
  mockEstimateExperimentPlan,
  mockPrepareExperimentRun,
  mockRunPreparedExperimentRun,
  mockCreateEvaluation,
  MockInvalidComparisonRunsError,
  mockCreateExperiment,
  mockComputeReadiness,
  mockTransitionExperiment,
  mockListPrograms,
  mockGetProgramDetail,
  mockCreateProgram,
  mockAuthorizeProgramBudget,
  mockUpdateProgram,
  MockLabProgramError,
} = vi.hoisted(() => {
  class MockLabEnvironmentError extends Error {
    readonly reason: string;
    constructor(reason: string) {
      super(`Laboratório bloqueado: ${reason}`);
      this.name = "LabEnvironmentError";
      this.reason = reason;
    }
  }

  class MockInvalidComparisonRunsError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "InvalidComparisonRunsError";
      this.code = code;
    }
  }

  class MockLabProgramError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "LabProgramError";
      this.code = code;
    }
  }

  return {
    mockRequireAdmin: vi.fn(),
    mockAssertLabEnvironment: vi.fn(),
    MockLabEnvironmentError,
    mockListScenarioVersions: vi.fn(),
    mockListRecentExperiments: vi.fn(),
    mockGetExperimentDetail: vi.fn(),
    mockGetRunDetail: vi.fn(),
    mockListPendingEvaluations: vi.fn(),
    mockGetActiveCampaignImageTarget: vi.fn(),
    mockEstimateExperimentPlan: vi.fn(),
    mockPrepareExperimentRun: vi.fn(),
    mockRunPreparedExperimentRun: vi.fn(),
    mockCreateEvaluation: vi.fn(),
    MockInvalidComparisonRunsError,
    mockCreateExperiment: vi.fn(),
    mockComputeReadiness: vi.fn(),
    mockTransitionExperiment: vi.fn(),
    mockListPrograms: vi.fn(),
    mockGetProgramDetail: vi.fn(),
    mockCreateProgram: vi.fn(),
    mockAuthorizeProgramBudget: vi.fn(),
    mockUpdateProgram: vi.fn(),
    MockLabProgramError,
  };
});

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/lab/environment-guard", () => ({
  LabEnvironmentError: MockLabEnvironmentError,
  assertLabEnvironment: () => mockAssertLabEnvironment(),
  labEnvironmentDeniedBody: (reason: string) => ({ error: "environment_blocked", reason }),
  getLabEnvironment: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/lib/lab/api/experiment-queries", () => ({
  listScenarioVersions: (...args: unknown[]) => mockListScenarioVersions(...args),
  listRecentExperiments: (...args: unknown[]) => mockListRecentExperiments(...args),
  getExperimentDetail: (...args: unknown[]) => mockGetExperimentDetail(...args),
  getRunDetail: (...args: unknown[]) => mockGetRunDetail(...args),
  listPendingEvaluations: (...args: unknown[]) => mockListPendingEvaluations(...args),
  getActiveCampaignImageTarget: (...args: unknown[]) => mockGetActiveCampaignImageTarget(...args),
}));

vi.mock("@/lib/lab/api/estimate", () => ({
  LAB_EXPERIMENT_NOT_FOUND: "experiment_not_found",
  estimateExperimentPlan: (...args: unknown[]) => mockEstimateExperimentPlan(...args),
}));

vi.mock("@/lib/lab/api/run-execution", () => ({
  prepareExperimentRun: (...args: unknown[]) => mockPrepareExperimentRun(...args),
  runPreparedExperimentRun: (...args: unknown[]) => mockRunPreparedExperimentRun(...args),
}));

vi.mock("@/lib/lab/api/evaluation-service", () => ({
  createEvaluation: (...args: unknown[]) => mockCreateEvaluation(...args),
  InvalidComparisonRunsError: MockInvalidComparisonRunsError,
}));

vi.mock("@/lib/lab/domain/experiment-service", () => ({
  createExperiment: (...args: unknown[]) => mockCreateExperiment(...args),
  computeExperimentReadiness: (...args: unknown[]) => mockComputeReadiness(...args),
  transitionExperiment: (...args: unknown[]) => mockTransitionExperiment(...args),
}));

vi.mock("@/lib/lab/api/program-queries", () => ({
  listPrograms: (...args: unknown[]) => mockListPrograms(...args),
  getProgramDetail: (...args: unknown[]) => mockGetProgramDetail(...args),
  remainingUsd: (program: { budget_usd: number | null; budget_consumed_usd: number; budget_reserved_usd: number }) =>
    program.budget_usd === null
      ? null
      : program.budget_usd - program.budget_consumed_usd - program.budget_reserved_usd,
}));

vi.mock("@/lib/lab/domain/program-service", () => ({
  LabProgramError: MockLabProgramError,
  createProgram: (...args: unknown[]) => mockCreateProgram(...args),
  authorizeProgramBudget: (...args: unknown[]) => mockAuthorizeProgramBudget(...args),
  updateProgram: (...args: unknown[]) => mockUpdateProgram(...args),
}));

import { ForbiddenError } from "@/lib/auth/errors";
import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";
import { VALID_RUBRIC } from "@/lib/lab/domain/__tests__/rubric-fixture";

/**
 * F48.1 — suíte de contrato nº 2 (48-1-12, task 12.4): contrato HTTP da API
 * administrativa sob `/api/admin/laboratorio`.
 *
 * Todas as dependências externas (admin, guarda de ambiente, Supabase e serviços)
 * são mockadas e cada rota é importada dinamicamente dentro do teste. Nenhuma
 * chamada de rede e nenhuma chamada paga em nenhum caminho.
 */

const BASE = "http://localhost/api/admin/laboratorio";
const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";
const VARIANT_ID = "77777777-7777-4777-8777-777777777777";
const SCENARIO_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const BASELINE_RUN_ID = "88888888-8888-4888-8888-888888888888";
const CANDIDATE_RUN_ID = "99999999-9999-4999-8999-999999999999";
const OPERATION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const RUN_ID = "cccccccc-dddd-4eee-8fff-000000000000";
const ADMIN_ID = "admin-1";

const VALID_EXPERIMENT = {
  name: "Exp prompt",
  objective: "Comparar prompts",
  hypothesis: "A candidata vende mais",
  changedDimension: "prompt",
  campaignIntent: "offer",
  programId: "77777777-7777-4777-8777-777777777777",
  modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
  params: { size: "1024x1024", quality: "high", skipInputValidation: true },
  repetitions: 1,
  maxRuns: 6,
  scenarioVersionIds: [SCENARIO_VERSION_ID],
  baseline: { promptName: "campaign-image-director-offer" },
  candidate: {
    promptName: "campaign-image-director-offer",
    promptContent: "Prompt candidata",
  },
};

const VALID_RUN_BODY = {
  variantId: VARIANT_ID,
  scenarioVersionId: SCENARIO_VERSION_ID,
  repetitionIndex: 1,
  confirmed: true,
  operationId: OPERATION_ID,
};

const VALID_EVALUATION_BODY = {
  scenarioVersionId: SCENARIO_VERSION_ID,
  baselineRunId: BASELINE_RUN_ID,
  candidateRunId: CANDIDATE_RUN_ID,
  verdict: "candidate",
  blindOrder: "baseline_left",
  observation: "A candidata comunica melhor o preço",
  // Rubrica obrigatória (D7): fixture canônica — sem duplicar os nove critérios.
  rubric: VALID_RUBRIC,
};

const PREPARED = {
  runId: RUN_ID,
  snapshot: { runType: "lab" },
  idempotent: false,
  executionContext: { scenario: {}, experiment: {}, variant: {}, variants: {} },
};

const PROGRAM_ID = "99999999-9999-4999-8999-999999999999";

const PROGRAM_DETAIL = {
  id: PROGRAM_ID,
  matrixVersion: "matrix-v1",
  status: "authorized",
  budgetUsd: 10,
  budgetReservedUsd: 2,
  budgetConsumedUsd: 3,
  remainingUsd: 5,
  budgetAuthorizedBy: ADMIN_ID,
  budgetAuthorizedAt: "2026-09-16T12:00:00.000Z",
  finalReportRef: null,
  finalReportHash: null,
  recommendation: null,
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T12:00:00.000Z",
};

const DETAIL = {
  experiment: {
    id: EXPERIMENT_ID,
    name: "Exp prompt",
    status: "ready",
    campaign_intent: "offer",
    program_id: PROGRAM_ID,
  },
  variants: [{ id: VARIANT_ID, role: "candidate" }],
  scenarios: [{ scenarioVersionId: SCENARIO_VERSION_ID, slug: "produto-oferta-preco", version: 1 }],
  runs: [],
  evaluations: [],
  budget: { maxRuns: 6, used: 1, remaining: 5, programRemainingUsd: 5 },
};

const RUN_DETAIL = {
  run: { id: RUN_ID, status: "succeeded" },
  snapshot: { runType: "lab", capability: "campaign_image" },
  artifacts: [
    {
      id: "artifact-1",
      storagePath: `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`,
      signedUrl: "https://signed.test/art",
    },
  ],
};

const ESTIMATE = {
  perRun: { estimatedCostUsd: 0.04, costSource: "pricing_table" },
  perRunCoverage: "partial",
  plannedRuns: 3,
  remainingRuns: 5,
  totalEstimatedUsd: 0.12,
  coverage: "partial",
};

// ─── Invocação das rotas (import dinâmico) ───────────────────────────────────

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(url, init));
}

function postRequest(url: string, body: unknown): NextRequest {
  return request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function getScenarios(): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/scenarios/route");
  return GET(request(`${BASE}/scenarios`));
}

async function getExperiments(): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/experiments/route");
  return GET(request(`${BASE}/experiments`));
}

async function postExperiment(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/admin/laboratorio/experiments/route");
  return POST(postRequest(`${BASE}/experiments`, body));
}

async function getExperiment(id: string): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/experiments/[id]/route");
  return GET(request(`${BASE}/experiments/${id}`), { params: Promise.resolve({ id }) });
}

async function getEstimate(id: string): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/experiments/[id]/estimate/route");
  return GET(request(`${BASE}/experiments/${id}/estimate`), { params: Promise.resolve({ id }) });
}

async function postRun(id: string, body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/admin/laboratorio/experiments/[id]/runs/route");
  return POST(postRequest(`${BASE}/experiments/${id}/runs`, body), {
    params: Promise.resolve({ id }),
  });
}

async function getRun(id: string): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/runs/[id]/route");
  return GET(request(`${BASE}/runs/${id}`), { params: Promise.resolve({ id }) });
}

async function postEvaluation(id: string, body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/admin/laboratorio/experiments/[id]/evaluations/route");
  return POST(postRequest(`${BASE}/experiments/${id}/evaluations`, body), {
    params: Promise.resolve({ id }),
  });
}

async function getPrograms(): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/programs/route");
  return GET(request(`${BASE}/programs`));
}

async function postProgram(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/admin/laboratorio/programs/route");
  return POST(postRequest(`${BASE}/programs`, body));
}

async function getProgram(id: string): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/programs/[id]/route");
  return GET(request(`${BASE}/programs/${id}`), { params: Promise.resolve({ id }) });
}

async function putProgram(id: string, body: unknown): Promise<Response> {
  const { PUT } = await import("@/app/api/admin/laboratorio/programs/[id]/route");
  return PUT(
    request(`${BASE}/programs/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id }) },
  );
}

interface RouteCall {
  name: string;
  call: () => Promise<Response>;
}

function allRouteCalls(): RouteCall[] {
  return [
    { name: "GET /scenarios", call: getScenarios },
    { name: "GET /experiments", call: getExperiments },
    { name: "POST /experiments", call: () => postExperiment(VALID_EXPERIMENT) },
    { name: "GET /experiments/[id]", call: () => getExperiment(EXPERIMENT_ID) },
    { name: "GET /experiments/[id]/estimate", call: () => getEstimate(EXPERIMENT_ID) },
    { name: "POST /experiments/[id]/runs", call: () => postRun(EXPERIMENT_ID, VALID_RUN_BODY) },
    { name: "GET /runs/[id]", call: () => getRun(RUN_ID) },
    {
      name: "POST /experiments/[id]/evaluations",
      call: () => postEvaluation(EXPERIMENT_ID, VALID_EVALUATION_BODY),
    },
    { name: "GET /programs", call: getPrograms },
    { name: "POST /programs", call: () => postProgram({ matrixVersion: "matrix-v1" }) },
    { name: "GET /programs/[id]", call: () => getProgram(PROGRAM_ID) },
    { name: "PUT /programs/[id]", call: () => putProgram(PROGRAM_ID, { budgetUsd: 10 }) },
  ];
}

/** `true` quando algum serviço do laboratório foi acionado. */
function anyServiceCalled(): boolean {
  return [
    mockListScenarioVersions,
    mockListRecentExperiments,
    mockGetExperimentDetail,
    mockGetRunDetail,
    mockEstimateExperimentPlan,
    mockPrepareExperimentRun,
    mockRunPreparedExperimentRun,
    mockCreateEvaluation,
    mockCreateExperiment,
    mockComputeReadiness,
    mockTransitionExperiment,
    mockListPrograms,
    mockGetProgramDetail,
    mockCreateProgram,
    mockAuthorizeProgramBudget,
    mockUpdateProgram,
  ].some((mock) => mock.mock.calls.length > 0);
}

function reservationError(code: string): Error {
  return Object.assign(new Error(code), { code, name: "LabReservationError" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: ADMIN_ID });
  mockAssertLabEnvironment.mockReturnValue({
    enabled: true,
    supabaseHost: "localhost",
    local: true,
    reason: "ok",
  });
  mockListScenarioVersions.mockResolvedValue([{ id: "sv-1", slug: "produto-oferta-preco" }]);
  mockListRecentExperiments.mockResolvedValue([{ id: EXPERIMENT_ID, name: "Exp prompt" }]);
  mockGetExperimentDetail.mockResolvedValue(DETAIL);
  mockGetRunDetail.mockResolvedValue(RUN_DETAIL);
  mockListPendingEvaluations.mockResolvedValue([]);
  mockEstimateExperimentPlan.mockResolvedValue(ESTIMATE);
  mockPrepareExperimentRun.mockResolvedValue(PREPARED);
  mockRunPreparedExperimentRun.mockImplementation(
    async (params: { onEvent?: (event: unknown) => void }) => {
      params.onEvent?.({ type: "done", runId: RUN_ID, status: "succeeded" });
      return { runId: RUN_ID, status: "succeeded" };
    },
  );
  mockCreateEvaluation.mockResolvedValue({
    evaluationId: "eval-1",
    createdAt: "2026-09-16T12:00:00.000Z",
  });
  mockCreateExperiment.mockResolvedValue({ experimentId: EXPERIMENT_ID });
  mockComputeReadiness.mockResolvedValue({ ready: true, reasons: [] });
  mockTransitionExperiment.mockResolvedValue({ status: "ready" });
  mockListPrograms.mockResolvedValue([PROGRAM_DETAIL]);
  mockGetProgramDetail.mockResolvedValue(PROGRAM_DETAIL);
  mockCreateProgram.mockResolvedValue({ programId: PROGRAM_ID });
  mockAuthorizeProgramBudget.mockResolvedValue(undefined);
  mockUpdateProgram.mockResolvedValue(undefined);
});

// ─── 1. 403 não-admin ────────────────────────────────────────────────────────

describe("contrato da API — 403 para não-admin", () => {
  it.each(allRouteCalls().map((route) => [route.name, route.call] as const))(
    "%s nega não-admin com 403 e não executa nenhuma operação",
    async (_name, call) => {
      mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

      const res = await call();

      expect(res.status).toBe(403);
      expect(anyServiceCalled()).toBe(false);
    },
  );
});

// ─── 2. 403 ambiente bloqueado ───────────────────────────────────────────────

describe("contrato da API — 403 com ambiente bloqueado", () => {
  it.each(allRouteCalls().map((route) => [route.name, route.call] as const))(
    "%s recusa com environment_blocked e nenhum acesso ao laboratório",
    async (_name, call) => {
      mockAssertLabEnvironment.mockImplementation(() => {
        throw new MockLabEnvironmentError("disabled_flag" as LabEnvironmentReason);
      });

      const res = await call();
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ error: "environment_blocked", reason: "disabled_flag" });
      expect(anyServiceCalled()).toBe(false);
    },
  );
});

// ─── 3. 400 payload inválido ─────────────────────────────────────────────────

describe("contrato da API — 400 payload inválido", () => {
  it("POST /experiments inválido ⇒ 400 invalid_payload e nenhuma criação", async () => {
    const res = await postExperiment({ name: "" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockCreateExperiment).not.toHaveBeenCalled();
  });

  it("POST /evaluations inválido ⇒ 400 invalid_payload e nenhum insert", async () => {
    const res = await postEvaluation(EXPERIMENT_ID, { scenarioVersionId: "não-é-uuid" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it("POST /experiments com dimensão não suportada ⇒ 400 unsupported_changed_dimension", async () => {
    const res = await postExperiment({ ...VALID_EXPERIMENT, changedDimension: "model" });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unsupported_changed_dimension");
    expect(mockCreateExperiment).not.toHaveBeenCalled();
  });

  it("POST /experiments com prompt fora do intent ⇒ 400 unsupported_prompt_under_test", async () => {
    const res = await postExperiment({
      ...VALID_EXPERIMENT,
      candidate: {
        promptName: "campaign-image-director-spotlight",
        promptContent: "Prompt candidata",
      },
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unsupported_prompt_under_test");
    expect(mockCreateExperiment).not.toHaveBeenCalled();
  });

  it("POST /experiments com intents mistos ⇒ 400 intent_mismatch", async () => {
    mockCreateExperiment.mockRejectedValue(new Error("intent_mismatch:scenario-1"));

    const res = await postExperiment(VALID_EXPERIMENT);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("intent_mismatch");
  });

  it("POST /experiments sem programa autorizado ⇒ 409 program_not_authorized", async () => {
    mockCreateExperiment.mockRejectedValue(new Error("program_not_authorized"));

    const res = await postExperiment(VALID_EXPERIMENT);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("program_not_authorized");
  });
});

// ─── 4. Criação e leitura ────────────────────────────────────────────────────

describe("contrato da API — criação e leitura", () => {
  it("POST /experiments válido ⇒ 201 com experimentId e status", async () => {
    const res = await postExperiment(VALID_EXPERIMENT);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({
      experimentId: EXPERIMENT_ID,
      status: "ready",
      readiness: { ready: true, reasons: [] },
    });
    expect(mockCreateExperiment).toHaveBeenCalledWith(expect.any(Object), {
      actorId: ADMIN_ID,
      client: expect.anything(),
    });
  });

  it("GET /scenarios ⇒ 200 com a lista de versões", async () => {
    const res = await getScenarios();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.scenarios).toHaveLength(1);
    expect(mockListScenarioVersions).toHaveBeenCalledTimes(1);
  });

  it("GET /experiments ⇒ 200 com a lista de experimentos", async () => {
    const res = await getExperiments();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.experiments).toHaveLength(1);
  });

  it("GET /experiments/[id] ⇒ 200 com budget.remaining, intent/programa e saldo do programa", async () => {
    const res = await getExperiment(EXPERIMENT_ID);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.budget.remaining).toBe(5);
    expect(body.budget.programRemainingUsd).toBe(5);
    expect(body.experiment).toMatchObject({
      campaign_intent: "offer",
      program_id: PROGRAM_ID,
    });
  });

  it("GET /experiments/[id] ausente ⇒ 404 experiment_not_found", async () => {
    mockGetExperimentDetail.mockResolvedValue(null);

    const res = await getExperiment(EXPERIMENT_ID);

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("experiment_not_found");
  });

  it("GET /runs/[id] ⇒ 200 com snapshot e URL assinada", async () => {
    const res = await getRun(RUN_ID);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshot).toMatchObject({ runType: "lab" });
    expect(body.artifacts[0].signedUrl).toBe("https://signed.test/art");
  });

  it("GET /runs/[id] ausente ⇒ 404 run_not_found", async () => {
    mockGetRunDetail.mockResolvedValue(null);

    const res = await getRun(RUN_ID);

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("run_not_found");
  });
});

// ─── 4b. Programas e orçamento ───────────────────────────────────────────────

describe("contrato da API — programas e autorização de orçamento", () => {
  it("GET /programs ⇒ 200 com a lista de programas", async () => {
    const res = await getPrograms();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.programs).toHaveLength(1);
    expect(mockListPrograms).toHaveBeenCalledTimes(1);
  });

  it("POST /programs válido ⇒ 201 com programId", async () => {
    const res = await postProgram({ matrixVersion: "matrix-v1" });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ programId: PROGRAM_ID });
    expect(mockCreateProgram).toHaveBeenCalledWith(
      { matrixVersion: "matrix-v1" },
      { actorId: ADMIN_ID, client: expect.anything() },
    );
  });

  it("POST /programs com budgetUsd ⇒ autoriza o orçamento", async () => {
    const res = await postProgram({ matrixVersion: "matrix-v1", budgetUsd: 10 });

    expect(res.status).toBe(201);
    expect(mockAuthorizeProgramBudget).toHaveBeenCalledWith(
      expect.objectContaining({ programId: PROGRAM_ID, budgetUsd: 10, actorId: ADMIN_ID }),
    );
  });

  it("POST /programs inválido ⇒ 400 invalid_payload", async () => {
    const res = await postProgram({ matrixVersion: "" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockCreateProgram).not.toHaveBeenCalled();
  });

  it("GET /programs/[id] ⇒ 200 com o detalhe e saldo", async () => {
    const res = await getProgram(PROGRAM_ID);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.remainingUsd).toBe(5);
    expect(body.status).toBe("authorized");
  });

  it("GET /programs/[id] ausente ⇒ 404 program_not_found", async () => {
    mockGetProgramDetail.mockResolvedValue(null);

    const res = await getProgram(PROGRAM_ID);

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("program_not_found");
  });

  it("PUT /programs/[id] autoriza orçamento e registra relatório/recomendação", async () => {
    const res = await putProgram(PROGRAM_ID, {
      status: "authorized",
      budgetUsd: 10,
      finalReportRef: "docs/lab/report.md",
      finalReportHash: "a".repeat(64),
      recommendation: { prompt: "offer", winner: "candidate" },
    });

    expect(res.status).toBe(200);
    expect(mockAuthorizeProgramBudget).toHaveBeenCalledWith(
      expect.objectContaining({ programId: PROGRAM_ID, budgetUsd: 10, actorId: ADMIN_ID }),
    );
    expect(mockUpdateProgram).toHaveBeenCalledWith(
      PROGRAM_ID,
      expect.objectContaining({
        status: "authorized",
        finalReportRef: "docs/lab/report.md",
        finalReportHash: "a".repeat(64),
      }),
      expect.anything(),
    );
  });

  it("PUT /programs/[id] inválido ⇒ 400 invalid_payload", async () => {
    const res = await putProgram(PROGRAM_ID, { finalReportHash: "not-a-hash" });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_payload");
    expect(mockUpdateProgram).not.toHaveBeenCalled();
  });

  it("PUT /programs/[id] com budget_exceeded ⇒ 409", async () => {
    mockAuthorizeProgramBudget.mockRejectedValue(new MockLabProgramError("budget_exceeded"));

    const res = await putProgram(PROGRAM_ID, { budgetUsd: 10 });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("budget_exceeded");
  });

  it("PUT /programs/[id] de programa ausente ⇒ 404 program_not_found", async () => {
    mockUpdateProgram.mockRejectedValue(new MockLabProgramError("program_not_found"));

    const res = await putProgram(PROGRAM_ID, { status: "closed" });

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("program_not_found");
  });
});

// ─── 5. Estimativa ───────────────────────────────────────────────────────────

describe("contrato da API — estimativa não bloqueia por pricing incompleto", () => {
  it("GET /estimate ⇒ 200 com coverage e totalEstimatedUsd", async () => {
    const res = await getEstimate(EXPERIMENT_ID);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coverage).toBe("partial");
    expect(body.totalEstimatedUsd).toBe(0.12);
  });

  it("cobertura partial/missing continua 200 (execução permitida com ressalva)", async () => {
    mockEstimateExperimentPlan.mockResolvedValue({
      ...ESTIMATE,
      perRun: null,
      perRunCoverage: "missing",
      coverage: "missing",
      totalEstimatedUsd: null,
    });

    const res = await getEstimate(EXPERIMENT_ID);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coverage).toBe("missing");
    expect(body.totalEstimatedUsd).toBeNull();
  });

  it("experimento ausente ⇒ 404 experiment_not_found", async () => {
    mockEstimateExperimentPlan.mockRejectedValue(new Error("experiment_not_found"));

    const res = await getEstimate(EXPERIMENT_ID);

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("experiment_not_found");
  });
});

// ─── 6. 422 sem confirmação ──────────────────────────────────────────────────

describe("contrato da API — 422 sem confirmação explícita", () => {
  it("POST /runs sem confirmed: true ⇒ 422 antes de preparar o run", async () => {
    const { confirmed, ...withoutConfirmation } = VALID_RUN_BODY;
    void confirmed;

    const res = await postRun(EXPERIMENT_ID, withoutConfirmation);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: "confirmation_required" });
    expect(mockPrepareExperimentRun).not.toHaveBeenCalled();
    expect(mockRunPreparedExperimentRun).not.toHaveBeenCalled();
  });

  it("POST /runs com confirmed: false ⇒ 422", async () => {
    const res = await postRun(EXPERIMENT_ID, { ...VALID_RUN_BODY, confirmed: false });

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("confirmation_required");
  });
});

// ─── 7. 409/400/404 da reserva ───────────────────────────────────────────────

describe("contrato da API — mapeamento dos erros de reserva", () => {
  it.each([
    ["budget_exceeded", 409],
    ["program_not_authorized", 409],
    ["run_already_active", 409],
    ["idempotency_conflict", 409],
    ["experiment_not_ready", 409],
    ["scenario_hash_mismatch", 409],
    ["intent_mismatch", 400],
    ["missing_snapshot", 400],
    ["missing_operation_id", 400],
    ["variant_not_in_experiment", 400],
    ["scenario_not_in_experiment", 400],
    ["repetition_out_of_range", 400],
    ["invalid_supersedes_run", 400],
    ["unsupported_scenario_mode", 400],
    ["experiment_not_found", 404],
  ])("%s ⇒ HTTP %i sem abrir stream nem chamar o provider", async (code, status) => {
    mockPrepareExperimentRun.mockRejectedValue(reservationError(code));

    const res = await postRun(EXPERIMENT_ID, VALID_RUN_BODY);
    const body = await res.json();

    expect(res.status).toBe(status);
    expect(body.error).toBe(code);
    expect(mockRunPreparedExperimentRun).not.toHaveBeenCalled();
  });
});

// ─── 8. Execução confirmada e idempotente ────────────────────────────────────

describe("contrato da API — execução confirmada e idempotência", () => {
  it("execução confirmada ⇒ NDJSON com exatamente 1 evento terminal e o runId", async () => {
    const res = await postRun(EXPERIMENT_ID, VALID_RUN_BODY);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");

    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain(`"runId":"${RUN_ID}"`);
    expect(mockRunPreparedExperimentRun).toHaveBeenCalledTimes(1);
    expect(mockPrepareExperimentRun).toHaveBeenCalledWith(
      expect.objectContaining({ experimentId: EXPERIMENT_ID, actorId: ADMIN_ID }),
    );
  });

  it("operação idempotente ⇒ 200 JSON sem stream e sem nova chamada paga", async () => {
    mockPrepareExperimentRun.mockResolvedValue({ ...PREPARED, idempotent: true });

    const res = await postRun(EXPERIMENT_ID, VALID_RUN_BODY);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).not.toContain("application/x-ndjson");
    expect(body).toEqual({ idempotent: true, runId: RUN_ID });
    // Nenhum identificador de operação (de outro experimento) é devolvido.
    expect(Object.keys(body).sort()).toEqual(["idempotent", "runId"]);
    expect(mockRunPreparedExperimentRun).not.toHaveBeenCalled();
  });
});

// ─── 9. Avaliação ────────────────────────────────────────────────────────────

describe("contrato da API — registro da avaliação humana", () => {
  it("POST /evaluations válido ⇒ 201 com evaluationId e o avaliador do admin", async () => {
    const res = await postEvaluation(EXPERIMENT_ID, VALID_EVALUATION_BODY);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({
      evaluationId: "eval-1",
      createdAt: "2026-09-16T12:00:00.000Z",
    });
    expect(mockCreateEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ experimentId: EXPERIMENT_ID, evaluatorId: ADMIN_ID }),
    );
  });

  it.each(["invalid_comparison_runs", "runs_not_terminal"])(
    "%s ⇒ 400 sem persistir avaliação",
    async (code) => {
      mockCreateEvaluation.mockRejectedValue(new MockInvalidComparisonRunsError(code));

      const res = await postEvaluation(EXPERIMENT_ID, VALID_EVALUATION_BODY);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(code);
    },
  );
});

// ─── 10. Nenhum secret nas respostas ─────────────────────────────────────────

describe("contrato da API — nenhum secret nas respostas", () => {
  it("nenhum corpo devolve token, chave ou operation_id alheio", async () => {
    const bodies: string[] = [];

    for (const route of allRouteCalls()) {
      const res = await route.call();
      bodies.push(await res.text());
    }

    // Caminho de erro do stream: a mensagem é fixa e não vaza o erro do serviço.
    mockRunPreparedExperimentRun.mockRejectedValue(new Error("sk-secret-vazado"));
    const failed = await postRun(EXPERIMENT_ID, VALID_RUN_BODY);
    bodies.push(await failed.text());

    for (const body of bodies) {
      expect(body).not.toMatch(/sk-[A-Za-z0-9]/);
      expect(body).not.toContain("AIza");
      expect(body).not.toContain("Bearer ");
      expect(body).not.toContain("sk-secret-vazado");
      expect(body).not.toContain(OPERATION_ID);
    }
  });
});
