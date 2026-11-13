// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCampaignForm } from "../use-campaign-form";
import type { CampaignFormRestore } from "@/lib/campaign/display";

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
  campaignFormat: "9:16" as const,
};

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

function gatedNdjsonResponse(
  events: Record<string, unknown>[],
  gate: Promise<void>,
): Response {
  const body = events.map((e) => JSON.stringify(e) + "\n").join("");
  return new Response(
    new ReadableStream({
      async start(controller) {
        await gate;
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

function processingEvent(
  state = "between_steps",
  canContinue = true,
): Record<string, unknown> {
  return {
    type: "processing",
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    state,
    nextStep: "expansion",
    canContinue,
  };
}

function urlOf(input: unknown): string {
  return String(input);
}

function bodyOf(init: unknown): Record<string, unknown> {
  const raw = (init as { body?: string } | undefined)?.body;
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

type Routes = {
  generate?: () => Response;
  continue?: (callIndex: number) => Response;
  status?: () => Response;
};

function installFetch(routes: Routes) {
  let continueCalls = 0;
  let statusCalls = 0;
  const fetchMock = vi.fn(async (input: unknown, init?: unknown) => {
    const url = urlOf(input);
    if (url === "/api/campaign/generate-image") {
      return routes.generate ? routes.generate() : createNdjsonResponse([]);
    }
    if (url.includes("/continue")) {
      continueCalls += 1;
      return routes.continue
        ? routes.continue(continueCalls)
        : createNdjsonResponse([processingEvent()]);
    }
    if (url === "/api/campaign/generation-status") {
      statusCalls += 1;
      return routes.status
        ? routes.status()
        : jsonResponse({
            operation: { state: "processing", canContinue: true },
          });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    fetchMock,
    continueCalls: () => continueCalls,
    statusCalls: () => statusCalls,
    continueBodies: () =>
      fetchMock.mock.calls
        .filter(([url]) => String(url).includes("/continue"))
        .map(([, init]) => bodyOf(init)),
  };
}

async function submitEligible() {
  sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
  mockRestoreFormState.mockReturnValue(DRAFT);
  const { result } = renderHook(() => useCampaignForm("store-123", { eligible: true }));
  await act(async () => {});
  await act(async () => {
    await result.current.handleSubmit();
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

describe("useCampaignForm — processing (F60.5)", () => {
  it("agenda a continuacao apos liberar inFlight e limita a tres chamadas efetivamente iniciadas", async () => {
    const routes = installFetch({
      generate: () => createNdjsonResponse([processingEvent()]),
      continue: () => createNdjsonResponse([processingEvent()]),
    });

    const result = await submitEligible();

    await waitFor(() => expect(routes.continueCalls()).toBe(3));
    // Deixa o microtask/finally drenar: nunca dispara uma quarta chamada.
    await act(async () => {});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(routes.continueCalls()).toBe(3);

    // Nunca declara sucesso nem navega; permanece em processamento.
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.unknownResult).toBeNull();
    expect(result.current.processingResult).not.toBeNull();
    expect(result.current.processingResult?.canContinue).toBe(true);
    expect(result.current.processingResult?.continuationsExhausted).toBe(true);

    // Cada invocacao usa um NOVO par de requestIds distintos.
    const bodies = routes.continueBodies();
    const pairs = bodies.map((body) => body.requestIds as { base: string; expansion: string });
    for (const pair of pairs) {
      expect(pair.base).not.toBe(pair.expansion);
      expect(pair.base.length).toBeGreaterThan(0);
    }
    expect(new Set(pairs.map((pair) => `${pair.base}:${pair.expansion}`)).size).toBe(3);
  });

  it("stream sem terminal dois estagios faz UMA consulta de status e mantem processing", async () => {
    const routes = installFetch({
      generate: () =>
        createNdjsonResponse([
          {
            type: "phase",
            phase: "campaign_base",
            status: "running",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
          },
        ]),
      status: () =>
        jsonResponse({
          operation: {
            state: "processing",
            canContinue: true,
            processingPhase: "between_steps",
          },
        }),
    });

    const result = await submitEligible();

    await waitFor(() => expect(routes.statusCalls()).toBe(1));
    expect(routes.continueCalls()).toBe(0);
    expect(result.current.unknownResult).toBeNull();
    expect(result.current.processingResult?.campaignId).toBe(CAMPAIGN_ID);
    expect(result.current.processingResult?.operationId).toBe(OPERATION_ID);
    expect(result.current.isSubmitting).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("step_in_progress nao dispara continuacao automatica", async () => {
    const routes = installFetch({
      generate: () => createNdjsonResponse([processingEvent("step_in_progress", false)]),
    });

    const result = await submitEligible();

    await waitFor(() => expect(result.current.processingResult).not.toBeNull());
    expect(result.current.processingResult?.stepInProgress).toBe(true);
    expect(routes.continueCalls()).toBe(0);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("nao chama /continue em paralelo quando ja existe uma chamada em voo", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const routes = installFetch({
      generate: () => createNdjsonResponse([processingEvent()]),
      continue: () => gatedNdjsonResponse([processingEvent()], gate),
    });

    const result = await submitEligible();
    await waitFor(() => expect(routes.continueCalls()).toBe(1));

    // Clique manual durante a chamada em voo: recusado pelo `inFlight`.
    await act(async () => {
      await result.current.continueGeneration();
      await result.current.continueGeneration();
    });
    expect(routes.continueCalls()).toBe(1);

    release();
    await waitFor(() => expect(routes.continueCalls()).toBeGreaterThan(1));
  });

  it("reidrata no reload com UMA consulta read-only e nunca inicia geracao", async () => {
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
    sessionStorage.setItem(
      `campaign_draft_identity:${CAMPAIGN_ID}`,
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    mockRestoreFormState.mockReturnValue(DRAFT);

    const routes = installFetch({
      status: () =>
        jsonResponse({
          operation: {
            state: "processing",
            canContinue: true,
            processingPhase: "between_steps",
          },
        }),
    });

    const restoredForm = {
      campaignId: CAMPAIGN_ID,
      productName: DRAFT.productName,
      description: DRAFT.description,
      originalPriceCents: DRAFT.originalPriceCents,
      discountedPriceCents: DRAFT.discountedPriceCents,
      badge: DRAFT.badge,
      campaignIntent: DRAFT.campaignIntent,
      preserveImageContext: DRAFT.preserveImageContext,
      mandatoryArtworkTextFree: "",
      referenceSelections: [],
      imageRestoreLimited: true,
      campaignFormat: "9:16",
    } as unknown as CampaignFormRestore;

    const { result } = renderHook(() =>
      useCampaignForm("store-123", { eligible: true, restoredForm }),
    );

    await waitFor(() => expect(routes.statusCalls()).toBe(1));
    await act(async () => {});
    expect(routes.statusCalls()).toBe(1);
    expect(routes.fetchMock.mock.calls.every(([url]) => !String(url).includes("generate-image"))).toBe(
      true,
    );
    expect(result.current.processingResult?.operationId).toBe(OPERATION_ID);
    expect(result.current.flowKind).toBe("two_stage_9_16");
    expect(result.current.unknownResult).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
