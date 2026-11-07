// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeExpandGeometry } from "@/lib/lab/bench/domain/expand-geometry";
import { DEFAULT_EXPAND_9_16_PROMPT, EXPAND_9_16_PROMPT_VERSION } from "@/lib/lab/bench/domain/expand-prompt";
import { BenchSingleImageUpload } from "../bench-single-image-upload";
import { BenchExpandPromptPanel } from "../bench-expand-prompt-panel";
import { BenchExpandGeometryPanel } from "../bench-expand-geometry-panel";
import { BenchExpandResultPanel } from "../bench-expand-result-panel";
import { BenchExpandHistoryPanel } from "../bench-expand-history-panel";

const RUN_ID = "11111111-1111-4111-8111-111111111111";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("expand UI — upload único e sem identidade", () => {
  it("envia operation=expand e exatamente uma imagem", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        runId: RUN_ID,
        operation: "expand",
        inputs: [
          {
            path: `bench/${RUN_ID}/inputs/0.jpg`,
            mimeType: "image/jpeg",
            width: 1152,
            height: 1440,
            bytes: 3038,
            checksum: "a".repeat(64),
          },
        ],
      }),
    });
    const onUploaded = vi.fn();
    render(
      <BenchSingleImageUpload
        storeId="33333333-3333-4333-8333-333333333333"
        getOperationId={() => "22222222-2222-4222-8222-222222222222"}
        onUploaded={onUploaded}
      />,
    );

    const file = new File([new Uint8Array([1, 2, 3])], "campanha.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByTestId("bench-expand-image-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("bench-expand-upload-button"));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [, init] = mockFetch.mock.calls[0];
    const form = init.body as FormData;
    expect(form.get("operation")).toBe("expand");
    expect(form.getAll("files")).toHaveLength(1);
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(onUploaded.mock.calls[0][0].inputs[0]).toMatchObject({
      width: 1152,
      height: 1440,
    });
    expect(screen.getByText(/1152×1440/)).toBeInTheDocument();
  });
});

describe("expand UI — prompt próprio", () => {
  it("mostra versão, permite editar e aprovar", () => {
    const onChange = vi.fn();
    const onApprove = vi.fn();
    const onReset = vi.fn();
    render(
      <BenchExpandPromptPanel
        value={DEFAULT_EXPAND_9_16_PROMPT}
        promptVersion={EXPAND_9_16_PROMPT_VERSION}
        status="edited"
        onChange={onChange}
        onApprove={onApprove}
        onReset={onReset}
      />,
    );

    expect(screen.getByText(`Versão · ${EXPAND_9_16_PROMPT_VERSION}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("bench-expand-approve-button"));
    expect(onApprove).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("bench-expand-reset-prompt"));
    expect(onReset).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt de expansão (editável)" }), {
      target: { value: "novo prompt" },
    });
    expect(onChange).toHaveBeenCalledWith("novo prompt");
  });
});

describe("expand UI — geometria solicitada e recusas", () => {
  it("mostra 304/304 como geometria solicitada", () => {
    render(<BenchExpandGeometryPanel geometry={computeExpandGeometry({ width: 1152, height: 1440 })} />);
    expect(screen.getByText("Geometria solicitada")).toBeInTheDocument();
    expect(screen.getAllByText("304 px")).toHaveLength(2);
    expect(screen.getByText(/não comprova que o conteúdo central/i)).toBeInTheDocument();
  });

  it("recusa 1024×1024 com motivo explícito", () => {
    render(<BenchExpandGeometryPanel geometry={computeExpandGeometry({ width: 1024, height: 1024 })} />);
    const alert = screen.getByTestId("bench-expand-geometry-unsupported");
    expect(within(alert).getByText(/width_mismatch/)).toBeInTheDocument();
    expect(within(alert).getByText(/não está habilitado/)).toBeInTheDocument();
  });
});

describe("expand UI — resultado e histórico", () => {
  it("mostra original e resultado com download e ressalva técnica", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        run: {
          id: RUN_ID,
          status: "succeeded",
          operation: "expand",
          promptVersion: EXPAND_9_16_PROMPT_VERSION,
          promptSent: DEFAULT_EXPAND_9_16_PROMPT,
          model: "gpt-image-2.5-sunburst",
          quality: "medium",
          size: "1152x2048",
          usage: { completionTokens: 100 },
          estimatedCostUsd: 0.03,
          reportedCostUsd: null,
          costSource: "bench_local_pricing",
          costRuleVersion: "2026-11-bench-4",
          technicalValidation: {},
          sourceDimensions: null,
          targetDimensions: null,
          geometry: null,
        },
        artifacts: [
          {
            id: "input",
            kind: "input",
            mimeType: "image/jpeg",
            width: 1152,
            height: 1440,
            bytes: 3038,
            checksum: "a".repeat(64),
            signedUrl: "https://signed.test/original",
          },
          {
            id: "output",
            kind: "output",
            mimeType: "image/png",
            width: 1152,
            height: 2048,
            bytes: 4000,
            checksum: "b".repeat(64),
            signedUrl: "https://signed.test/result",
          },
        ],
      }),
    });

    render(<BenchExpandResultPanel runId={RUN_ID} />);
    expect(await screen.findByText(/Sucesso técnico/)).toBeInTheDocument();
    expect(screen.getByAltText("Campanha original")).toHaveAttribute(
      "src",
      "https://signed.test/original",
    );
    expect(screen.getByAltText("Resultado da expansão")).toHaveAttribute(
      "src",
      "https://signed.test/result",
    );
    expect(screen.getByTestId("bench-expand-download-original")).toBeInTheDocument();
    expect(screen.getByTestId("bench-expand-download-result")).toBeInTheDocument();
  });

  it("filtra somente expansões no histórico", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        lineages: [
          {
            rootId: "root",
            runs: [
              {
                id: "campaign-run",
                status: "succeeded",
                attemptOfRunId: null,
                createdAt: "2026-11-07T10:00:00.000Z",
                finishedAt: null,
                operation: "campaign",
                promptVersion: null,
                size: "1024x1024",
                estimatedCostUsd: null,
              },
              {
                id: "expand-run",
                status: "succeeded",
                attemptOfRunId: null,
                createdAt: "2026-11-07T11:00:00.000Z",
                finishedAt: null,
                operation: "expand",
                promptVersion: EXPAND_9_16_PROMPT_VERSION,
                size: "1152x2048",
                estimatedCostUsd: 0.03,
              },
            ],
          },
        ],
      }),
    });

    render(
      <BenchExpandHistoryPanel
        storeId="33333333-3333-4333-8333-333333333333"
        refreshKey={0}
        onOpen={() => {}}
      />,
    );
    expect(await screen.findByText(EXPAND_9_16_PROMPT_VERSION)).toBeInTheDocument();
    expect(screen.queryByText("campaign")).toBeNull();
    expect(screen.getByTestId("bench-expand-open-expand-run")).toBeInTheDocument();
  });
});
