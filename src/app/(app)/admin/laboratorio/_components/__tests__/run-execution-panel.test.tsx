// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunExecutionPanel } from "../run-execution-panel";

/**
 * F48.1 (48-1-09, task 9.4) — painel de execução de um run.
 *
 * Prova a barreira financeira (estimativa exibida + confirmação explícita antes de
 * qualquer `POST`), a idempotência por `operationId` reutilizado em retry, a leitura
 * do stream NDJSON até o `runId` final, o mapeamento dos erros HTTP e o bloqueio do
 * botão com o budget esgotado ou o experimento não pronto.
 */

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const EXPERIMENT_ID = "exp-1";

const VARIANTS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    role: "baseline",
    label: "Baseline oficial",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    role: "candidate",
    label: "Candidata",
  },
];

const SCENARIOS = [
  { id: "33333333-3333-4333-8333-333333333333", label: "produto-oferta-preco v1" },
];

const ESTIMATE = {
  perRun: { estimatedCostUsd: 0.04, costSource: "manual", pricingVersion: "v1" },
  perRunCoverage: "complete",
  plannedRuns: 3,
  remainingRuns: 5,
  totalEstimatedUsd: 0.12,
  coverage: "complete",
};

const mockFetch = vi.fn();

function renderPanel(overrides: {
  budget?: { maxRuns: number; used: number; remaining: number };
  experimentStatus?: string;
} = {}) {
  render(
    <RunExecutionPanel
      experimentId={EXPERIMENT_ID}
      variants={VARIANTS}
      scenarios={SCENARIOS}
      repetitions={3}
      budget={overrides.budget ?? { maxRuns: 6, used: 1, remaining: 5 }}
      experimentStatus={overrides.experimentStatus ?? "ready"}
    />,
  );
}

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => payload,
  };
}

function errorResponse(status: number, code: string) {
  return jsonResponse({ error: code }, status);
}

function ndjsonResponse() {
  const encoder = new TextEncoder();
  const events = [
    { type: "phase", phase: "running", runId: "run-123" },
    { type: "phase", phase: "prompt", runId: "run-123" },
    { type: "phase", phase: "generation", runId: "run-123" },
    { type: "phase", phase: "artifact", runId: "run-123" },
    { type: "done", status: "succeeded", runId: "run-123" },
  ];

  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

function runCalls() {
  return mockFetch.mock.calls.filter(([url]) => String(url).endsWith("/runs"));
}

async function openConfirmation() {
  fireEvent.click(screen.getByTestId("lab-run-button"));
  await screen.findByTestId("lab-run-estimate");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn().mockReturnValue("00000000-0000-4000-8000-0000000000aa"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RunExecutionPanel", () => {
  it("mostra o budget restante", () => {
    renderPanel();

    expect(
      screen.getByText("5 de 6 execuções restantes"),
    ).toBeInTheDocument();
  });

  it("busca a estimativa ao acionar Executar run e não envia nada antes da confirmação", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(ESTIMATE));
    renderPanel();

    fireEvent.click(screen.getByTestId("lab-run-button"));

    const estimateCard = await screen.findByTestId("lab-run-estimate");
    expect(String(mockFetch.mock.calls[0][0])).toContain(
      `/api/admin/laboratorio/experiments/${EXPERIMENT_ID}/estimate`,
    );
    expect(within(estimateCard).getByText("US$ 0.0400")).toBeInTheDocument();
    expect(within(estimateCard).getByText("US$ 0.1200")).toBeInTheDocument();
    expect(within(estimateCard).getByText("complete")).toBeInTheDocument();

    expect(runCalls()).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Confirmar execução" }),
    ).toBeInTheDocument();
  });

  it("avisa em âmbar com cobertura partial sem bloquear a confirmação", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...ESTIMATE, perRunCoverage: "partial", coverage: "partial" }),
    );
    renderPanel();

    await openConfirmation();

    expect(await screen.findByText(/faixa\/aviso/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar execução" }),
    ).toBeEnabled();
  });

  it("confirma com confirmed true, lê o NDJSON e exibe o runId final", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(ndjsonResponse());
    renderPanel();

    await openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar execução" }));

    await waitFor(() => expect(runCalls()).toHaveLength(1));
    const [url, init] = runCalls()[0];
    expect(String(url)).toBe(
      `/api/admin/laboratorio/experiments/${EXPERIMENT_ID}/runs`,
    );
    const body = JSON.parse(String(init.body));
    expect(body.confirmed).toBe(true);
    expect(body.variantId).toBe(VARIANTS[0].id);
    expect(body.scenarioVersionId).toBe(SCENARIOS[0].id);
    expect(body.repetitionIndex).toBe(1);
    expect(body.operationId).toBe("00000000-0000-4000-8000-0000000000aa");

    expect(await screen.findByTestId("lab-run-id")).toHaveTextContent(
      "Run run-123 concluído",
    );
    expect(screen.getByTestId("lab-run-phases")).toHaveTextContent(
      "Gerando a arte",
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("reutiliza o operationId no retry e o renova quando o payload muda", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("op-1")
        .mockReturnValue("op-2"),
    });

    mockFetch
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(errorResponse(409, "run_already_active"))
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(errorResponse(409, "run_already_active"))
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(errorResponse(409, "run_already_active"));

    renderPanel();

    await openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar execução" }));
    await waitFor(() => expect(runCalls()).toHaveLength(1));

    // Retry da mesma ação: mesmo operationId.
    await openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar execução" }));
    await waitFor(() => expect(runCalls()).toHaveLength(2));

    const first = JSON.parse(String(runCalls()[0][1].body));
    const retry = JSON.parse(String(runCalls()[1][1].body));
    expect(retry.operationId).toBe(first.operationId);
    expect(first.operationId).toBe("op-1");

    // Payload diferente (outra variante): novo operationId.
    fireEvent.change(screen.getByLabelText("Variante"), {
      target: { value: VARIANTS[1].id },
    });
    await openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar execução" }));
    await waitFor(() => expect(runCalls()).toHaveLength(3));

    const changed = JSON.parse(String(runCalls()[2][1].body));
    expect(changed.operationId).toBe("op-2");
    expect(changed.variantId).toBe(VARIANTS[1].id);
  });

  it("mapeia o 409 budget_exceeded", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(errorResponse(409, "budget_exceeded"));
    renderPanel();

    await openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar execução" }));

    expect(
      await screen.findByText(/teto de execuções do experimento foi atingido/),
    ).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("desabilita o botão quando o budget acabou", () => {
    renderPanel({ budget: { maxRuns: 6, used: 6, remaining: 0 } });

    expect(screen.getByTestId("lab-run-button")).toBeDisabled();
    expect(
      screen.getByText(/teto de execuções deste experimento foi atingido/),
    ).toBeInTheDocument();
  });

  it("desabilita o botão com o experimento em rascunho", () => {
    renderPanel({ experimentStatus: "draft" });

    expect(screen.getByTestId("lab-run-button")).toBeDisabled();
    expect(
      screen.getByText(/precisa estar pronto para executar/),
    ).toBeInTheDocument();
  });

  it("mostra as opções de repetição conforme o experimento", () => {
    renderPanel();

    const repetitions = screen.getByLabelText("Repetição");
    expect(
      within(repetitions)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["1", "2", "3"]);
  });
});
