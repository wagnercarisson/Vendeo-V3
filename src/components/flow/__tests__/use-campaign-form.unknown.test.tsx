// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import { useCampaignForm } from "../use-campaign-form";
import { UnknownResultPanel } from "../unknown-result-panel";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const mockSaveFormState = vi.fn();
const mockRestoreFormState = vi.fn();
const mockClearFormState = vi.fn();

vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: mockSaveFormState,
    restoreFormState: mockRestoreFormState,
    clearFormState: mockClearFormState,
  }),
}));

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

function createNdjsonResponse(events: Record<string, unknown>[]): Response {
  const body = events.map((e) => JSON.stringify(e) + "\n").join("");
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

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const DRAFT = {
  productName: "Test Product",
  description: "",
  originalPriceCents: 10000,
  discountedPriceCents: 1990,
  badge: "Oferta",
  campaignIntent: "offer",
  preserveImageContext: false,
  productImages: [],
  mandatoryArtworkText: "",
  showIllustrativeNotice: true,
  mandatoryArtworkTextFree: "",
  validityMode: "",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
};

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 06, Task 4: consumidor AO VIVO do terminal `unknown` do NDJSON.
// O terminal desconhecido (e o terminal de corrida perdida / stream sem terminal —
// F8) LIMPA `isSubmitting` e exibe a Superfície 3 — nunca permanece preso sem
// feedback. Nenhuma ação de regeneração é oferecida.
// ---------------------------------------------------------------------------

async function submitWith(events: Record<string, unknown>[]) {
  sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
  mockRestoreFormState.mockReturnValue(DRAFT);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createNdjsonResponse(events)));

  const { result } = renderHook(() => useCampaignForm("store-123"));
  await act(async () => {});
  expect(result.current.isValid).toBe(true);
  await act(async () => {
    await result.current.handleSubmit();
  });
  await waitFor(() => {
    expect(result.current.isSubmitting).toBe(false);
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  mockRestoreFormState.mockReturnValue(null);
});

describe("useCampaignForm — terminal `unknown` (Plano 06 / F8)", () => {
  it("terminal `unknown` limpa `isSubmitting` e popula `unknownResult` (sem travar)", async () => {
    const result = await submitWith([
      { type: "phase", phase: "orchestration", status: "running", operationId: OPERATION_ID, campaignId: CAMPAIGN_ID },
      { type: "unknown", reference: "IMG-001-abc", operationId: OPERATION_ID, campaignId: CAMPAIGN_ID },
    ]);

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.unknownResult).not.toBeNull();
    expect(result.current.unknownResult?.supportReference).toBe("IMG-001-abc");
    expect(result.current.unknownResult?.operationId).toBe(OPERATION_ID);
    expect(result.current.unknownResult?.campaignId).toBe(CAMPAIGN_ID);
    // Terminal desconhecido NÃO navega nem inicia nova geração.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("F8 — stream fechado SEM terminal ⇒ trata como desconhecido (Superfície 3), nunca travado", async () => {
    const result = await submitWith([
      { type: "phase", phase: "orchestration", status: "running", operationId: OPERATION_ID, campaignId: CAMPAIGN_ID },
    ]);

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.unknownResult).not.toBeNull();
    expect(result.current.unknownResult?.operationId).toBe(OPERATION_ID);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("terminal de corrida perdida (tipo desconhecido) ⇒ mesmo tratamento, sem nova geração", async () => {
    const result = await submitWith([
      { type: "phase", phase: "orchestration", status: "running", operationId: OPERATION_ID, campaignId: CAMPAIGN_ID },
      { type: "terminal_race_lost", supportReference: "IMG-001-xyz", operationId: OPERATION_ID, campaignId: CAMPAIGN_ID },
    ]);

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.unknownResult).not.toBeNull();
    expect(result.current.unknownResult?.supportReference).toBe("IMG-001-xyz");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("`resetUnknownResult` limpa o estado dedicado", async () => {
    const result = await submitWith([
      { type: "unknown", reference: "IMG-001-abc", operationId: OPERATION_ID, campaignId: CAMPAIGN_ID },
    ]);
    expect(result.current.unknownResult).not.toBeNull();

    act(() => {
      result.current.resetUnknownResult();
    });
    expect(result.current.unknownResult).toBeNull();
  });

  it("evento `refunded:true` do iniciador ⇒ encaminha ao DETALHE (sem retry da identidade terminal)", async () => {
    const result = await submitWith([
      { type: "phase", phase: "orchestration", status: "running", operationId: OPERATION_ID, campaignId: CAMPAIGN_ID },
      {
        type: "error",
        code: "IMG-001",
        reference: "IMG-001-ref",
        message: "Falha. Crédito estornado.",
        refunded: true,
        campaignId: CAMPAIGN_ID,
      },
    ]);

    // Encaminhamento ao detalhe (reutiliza o `RefundedPanel`) e sem `submitError`
    // (portanto sem "Tentar novamente" da identidade terminal).
    expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`);
    expect(result.current.submitError).toBeNull();
    expect(result.current.unknownResult).toBeNull();
  });
});

describe("UnknownResultPanel — Superfície 3 (render)", () => {
  it("renderiza título/corpo exatos, referência de suporte e NÃO 'Gerar novamente'", () => {
    render(<UnknownResultPanel supportReference="IMG-001-abc" />);

    expect(
      screen.getByText("Não foi possível confirmar a conclusão desta geração"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Você pode verificar novamente ou falar com o suporte. Verificar novamente não inicia outra geração nem cobra outro crédito.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Referência de suporte: IMG-001-abc/)).toBeInTheDocument();
    expect(screen.queryByText(/Gerar novamente/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 06 (correção): "Verificar novamente" CONSOME o estado devolvido
// pela consulta — `refunded` não deixa o usuário preso; `delivered` navega;
// pendente mantém o painel; HTTP não-OK ⇒ feedback seguro (sem terminal falso).
// ---------------------------------------------------------------------------

describe("UnknownResultPanel — reverificação consome o estado devolvido (correção)", () => {
  it("`refunded` ⇒ notifica o pai (`onResolved('refunded')`) e ENCAMINHA ao detalhe (reutiliza `RefundedPanel`)", async () => {
    const onResolved = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ operation: { state: "refunded" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UnknownResultPanel
        campaignId={CAMPAIGN_ID}
        operationId={OPERATION_ID}
        onResolved={onResolved}
      />,
    );

    fireEvent.click(screen.getByText("Verificar novamente"));

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("refunded"));
    // Recorte 2 (Plano 09): o terminal de estorno leva ao DETALHE — sem segunda superfície.
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`),
    );
    expect(screen.queryByText("A geração falhou e o crédito foi devolvido.")).toBeNull();
    // Somente consulta — nunca inicia geração/cobrança.
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/campaign/generation-status");
  });

  it("ação explícita 'Recuperar imagem salva' ⇒ POST na rota de recuperação; em `delivered` navega (sem regenerar)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ recovery: { outcome: "delivered" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<UnknownResultPanel campaignId={CAMPAIGN_ID} operationId={OPERATION_ID} />);
    fireEvent.click(screen.getByText("Recuperar imagem salva"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`),
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `/api/campaign/${CAMPAIGN_ID}/image-recovery`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("`delivered` ⇒ navega para a página da campanha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ operation: { state: "delivered" } })),
    );

    render(<UnknownResultPanel campaignId={CAMPAIGN_ID} operationId={OPERATION_ID} />);
    fireEvent.click(screen.getByText("Verificar novamente"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`),
    );
  });

  it("pendente (`reserved`) ⇒ mantém o painel (sem navegar, sem terminal)", async () => {
    const onResolved = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ operation: { state: "reserved" } })),
    );

    render(
      <UnknownResultPanel
        campaignId={CAMPAIGN_ID}
        operationId={OPERATION_ID}
        onResolved={onResolved}
      />,
    );
    fireEvent.click(screen.getByText("Verificar novamente"));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(onResolved).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      screen.getByText("Não foi possível confirmar a conclusão desta geração"),
    ).toBeInTheDocument();
  });

  it("HTTP não-OK ⇒ feedback seguro, sem terminal falso", async () => {
    const onResolved = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));

    render(
      <UnknownResultPanel
        campaignId={CAMPAIGN_ID}
        operationId={OPERATION_ID}
        onResolved={onResolved}
      />,
    );
    fireEvent.click(screen.getByText("Verificar novamente"));

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível verificar agora. Tente novamente."),
      ).toBeInTheDocument(),
    );
    expect(onResolved).not.toHaveBeenCalled();
    expect(screen.queryByText(/crédito foi devolvido/)).toBeNull();
  });
});
