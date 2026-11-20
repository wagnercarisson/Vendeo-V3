// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignInputForm } from "../campaign-input-form";
import { CAMPAIGN_FORMAT_HELPER } from "../campaign-format-selector";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockRestoreFormState = vi.fn();
vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: vi.fn(),
    restoreFormState: mockRestoreFormState,
    clearFormState: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/credit/credit-cta", () => ({
  CreditCta: () => null,
}));

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const DRAFT = {
  productName: "Produto conjunto",
  description: "",
  originalPriceCents: 10000,
  discountedPriceCents: 1990,
  badge: "Oferta",
  campaignIntent: "offer" as const,
  preserveImageContext: false,
  productImages: [
    {
      id: "img-1",
      role: "primary",
      source: "upload",
      mimeType: "image/jpeg",
      dataUrl: DATA_URL,
    },
  ],
  mandatoryArtworkText: "",
  showIllustrativeNotice: true,
  mandatoryArtworkTextFree: "",
  validityMode: "",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
  backgroundDirection: "studio",
  campaignFormat: "1:1+9:16" as const,
};

function formats(square: string, vertical: string) {
  return {
    "1:1": { state: square, deliveryOperationId: "sq" },
    "9:16": { state: vertical, deliveryOperationId: OPERATION_ID },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function processingBody(
  partial: boolean,
  canContinue = true,
  state: "processing" | "finalization_pending" = partial
    ? "finalization_pending"
    : "processing",
) {
  return `${JSON.stringify({
    type: "processing",
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    canContinue,
    nextStep: state === "finalization_pending" ? "finalize" : "vertical_delivery",
    formats:
      state === "finalization_pending"
        ? formats("delivered", "processing")
        : formats("processing", "processing"),
  })}\n`;
}

function resultBody() {
  return `${JSON.stringify({
    type: "result",
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
    operationTerminal: true,
    formats: formats("delivered", "delivered"),
  })}\n`;
}

function gatedStream(first: string, gate: Promise<void>, last: string): Response {
  return new Response(
    new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(first));
        await gate;
        controller.enqueue(new TextEncoder().encode(last));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
  );
}

function immediateStream(body: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
  );
}

async function openReviewAndConfirm() {
  fireEvent.click(screen.getByText("Revisar e gerar"));
  await screen.findByRole("button", { name: "Confirmar e gerar campanha" });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e gerar campanha" }));
}

function expectGenerationSummary() {
  expect(
    screen.getByRole("heading", { level: 1, name: "Geração da campanha" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Informe os dados do produto e da oferta"),
  ).not.toBeInTheDocument();
  const summary = screen.getByTestId("flow-campaign-format-summary");
  expect(summary).toBeInTheDocument();
  const square = screen.getByRole("checkbox", { name: "Quadrado 1:1 - feed" });
  const vertical = screen.getByRole("checkbox", {
    name: "Vertical 9:16 - Stories e Reels (imagem estática)",
  });
  expect(square).toBeChecked();
  expect(vertical).toBeChecked();
  expect(square).toBeDisabled();
  expect(vertical).toBeDisabled();
  expect(square).toHaveAttribute("aria-readonly", "true");
  expect(screen.queryByText(CAMPAIGN_FORMAT_HELPER)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Dois formatos usam dois créditos/),
  ).not.toBeInTheDocument();
  expect(screen.queryByTestId("flow-campaign-format-selector")).not.toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(DRAFT);
});

describe("F60.7 C2/C6 — tela de geração montada", () => {
  it("processamento normal: cabeçalho/resumo estáveis, sem alertas ou botões redundantes", async () => {
    let releaseInitial: () => void = () => {};
    const initialGate = new Promise<void>((resolve) => {
      releaseInitial = resolve;
    });
    let releaseContinue: () => void = () => {};
    const continueGate = new Promise<void>((resolve) => {
      releaseContinue = resolve;
    });
    let continueCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return gatedStream(
          `${JSON.stringify({
            type: "phase",
            phase: "square_base",
            status: "running",
          })}\n`,
          initialGate,
          processingBody(false),
        );
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        continueCalls += 1;
        return gatedStream("", continueGate, resultBody());
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CampaignInputForm
        storeId="store-1"
        balance={2}
        eligible
        verticalEnabled
      />,
    );
    await openReviewAndConfirm();

    await waitFor(() =>
      expect(screen.getByText("A geração está em processamento. Aguarde.")).toBeInTheDocument(),
    );
    expectGenerationSummary();
    expect(
      screen.queryByRole("button", { name: "Verificar novamente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continuar geração" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);

    releaseInitial();
    await waitFor(() => expect(continueCalls).toBe(1));

    // Entre requisições, o resumo continua estável e não há ação redundante.
    expectGenerationSummary();
    expect(
      screen.queryByRole("button", { name: "Verificar novamente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continuar geração" }),
    ).not.toBeInTheDocument();

    releaseContinue();
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`),
    );
  });

  it("finalização automática mostra 'Quase pronto!' sem ação", async () => {
    let releaseContinue: () => void = () => {};
    const continueGate = new Promise<void>((resolve) => {
      releaseContinue = resolve;
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return immediateStream(
          `${JSON.stringify({
            type: "processing",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            canContinue: true,
            nextStep: "finalize",
            formats: formats("absent", "processing"),
          })}\n`,
        );
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        return gatedStream("", continueGate, resultBody());
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CampaignInputForm
        storeId="store-1"
        balance={2}
        eligible
        verticalEnabled
      />,
    );
    await openReviewAndConfirm();

    await waitFor(() =>
      expect(screen.getByText("Quase pronto!")).toBeInTheDocument(),
    );
    expectGenerationSummary();
    expect(
      screen.queryByRole("button", { name: "Continuar geração" }),
    ).not.toBeInTheDocument();

    releaseContinue();
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`),
    );
  });

  it("atualização indisponível: mensagem honesta + Verificar novamente, sem falsa falha", async () => {
    let statusCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return immediateStream(
          `${JSON.stringify({
            type: "phase",
            phase: "square_base",
            status: "running",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
          })}\n`,
        );
      }
      if (url === "/api/campaign/generation-status") {
        statusCalls += 1;
        return json({ error: { code: "status_unavailable" } }, 503);
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CampaignInputForm
        storeId="store-1"
        balance={2}
        eligible
        verticalEnabled
      />,
    );
    await openReviewAndConfirm();

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível atualizar o andamento."),
      ).toBeInTheDocument(),
    );
    expectGenerationSummary();
    expect(
      screen.getByRole("button", { name: "Verificar novamente" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continuar geração" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
    await waitFor(() => expect(statusCalls).toBe(2));
  });

  it("finalização manual: orientação, botão desabilitado na requisição e conclusão", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-1",
      JSON.stringify({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        flowKind: "two_format_two_stage",
      }),
    );
    let releaseContinue: () => void = () => {};
    const continueGate = new Promise<void>((resolve) => {
      releaseContinue = resolve;
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generation-status") {
        return json({
          operation: {
            origin: "two_format_two_stage",
            formats: formats("absent", "processing"),
            canContinue: true,
            operationTerminal: false,
            nextStep: "finalize",
          },
        });
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        return gatedStream("", continueGate, resultBody());
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CampaignInputForm
        storeId="store-1"
        balance={2}
        eligible
        verticalEnabled
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText("Clique em ‘Continuar geração’ para concluir."),
      ).toBeInTheDocument(),
    );
    expectGenerationSummary();
    const continueButton = screen.getByRole("button", {
      name: "Continuar geração",
    });

    fireEvent.click(continueButton);
    await waitFor(() => expect(continueButton).toBeDisabled());

    releaseContinue();
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`),
    );
  });
});
