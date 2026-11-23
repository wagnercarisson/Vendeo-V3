// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddVerticalDialog } from "../add-vertical-dialog";
import { ptBRCampaignDetailMessages } from "@/lib/i18n/campaign-detail/catalogs/pt-BR";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";
const messages = ptBRCampaignDetailMessages.formatAddition;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("F62-05 — modal de adição vertical", () => {
  it("confirma com token do GET e conclui entregue", async () => {
    const onClose = vi.fn();
    const onDelivered = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-1",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ state: "delivered" }));

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={onClose}
        onDelivered={onDelivered}
      />,
    );

    await screen.findByText(messages.cost);
    fireEvent.click(screen.getByRole("button", { name: messages.confirm }));

    await waitFor(() => expect(onDelivered).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/campaign/${CAMPAIGN}/format-additions`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          format: "9:16",
          confirmationToken: "token-1",
        }),
      }),
    );
  });

  it("fechar não chama POST nem cancela a operação", async () => {
    const onClose = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "processing",
          confirmationToken: "token-1",
        }),
      );

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={onClose}
        onDelivered={vi.fn()}
      />,
    );

    await screen.findByText(messages.processing);
    fireEvent.click(screen.getByRole("button", { name: messages.cancel }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(
      true,
    );
  });

  it("ESC fecha sem mutar o servidor", async () => {
    const onClose = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ state: "eligible" }));

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={onClose}
        onDelivered={vi.fn()}
      />,
    );

    await screen.findByText(messages.cost);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(
      true,
    );
  });

  it("reconsulta processing consecutivos até a entrega e oferece retomada", async () => {
    vi.useFakeTimers();
    const onDelivered = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ state: "processing", confirmationToken: "token-1" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ state: "processing", confirmationToken: "token-1" }),
      )
      .mockResolvedValueOnce(jsonResponse({ state: "delivered" }));

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={onDelivered}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: messages.continue }),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onDelivered).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("POST pendente após fechar não agenda nova consulta", async () => {
    vi.useFakeTimers();
    const post = deferred<Response>();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ state: "processing", confirmationToken: "token-1" }),
      )
      .mockImplementationOnce(() => post.promise);

    const view = render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: messages.continue }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    view.rerender(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open={false}
        onClose={vi.fn()}
        onDelivered={vi.fn()}
      />,
    );
    post.resolve(jsonResponse({ state: "processing" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("GET posterior não deixa o botão de retomada preso após o POST terminar", async () => {
    vi.useFakeTimers();
    const post = deferred<Response>();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ state: "processing", confirmationToken: "token-1" }),
      )
      .mockImplementationOnce(() => post.promise)
      .mockResolvedValueOnce(
        jsonResponse({ state: "processing", confirmationToken: "token-1" }),
      );

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: messages.continue }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    post.resolve(jsonResponse({ state: "processing" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole("button", { name: messages.continue }),
    ).not.toBeDisabled();
    vi.useRealTimers();
  });

  it("POST pendente após desmontar não navega nem chama callback", async () => {
    const post = deferred<Response>();
    const onDelivered = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ state: "processing", confirmationToken: "token-1" }),
      )
      .mockImplementationOnce(() => post.promise);

    const view = render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={onClose}
        onDelivered={onDelivered}
      />,
    );
    await screen.findByRole("button", { name: messages.continue });
    fireEvent.click(screen.getByRole("button", { name: messages.continue }));
    view.unmount();

    post.resolve(jsonResponse({ state: "delivered" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onDelivered).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("fechar e reabrir isola a resposta antiga da nova sessão", async () => {
    const oldGet = deferred<Response>();
    const newGet = deferred<Response>();
    const onDelivered = vi.fn();
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => oldGet.promise)
      .mockImplementationOnce(() => newGet.promise);

    const view = render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={onDelivered}
      />,
    );
    view.rerender(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open={false}
        onClose={vi.fn()}
        onDelivered={onDelivered}
      />,
    );
    view.rerender(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={onDelivered}
      />,
    );

    oldGet.resolve(jsonResponse({ state: "delivered" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onDelivered).not.toHaveBeenCalled();

    newGet.resolve(jsonResponse({ state: "eligible", confirmationToken: "t" }));
    await screen.findByText(messages.cost);
    expect(onDelivered).not.toHaveBeenCalled();
  });

  it("GET entregue antes do POST responder conclui uma única vez", async () => {
    vi.useFakeTimers();
    const post = deferred<Response>();
    const onDelivered = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ state: "processing", confirmationToken: "token-1" }),
      )
      .mockImplementationOnce(() => post.promise)
      .mockResolvedValueOnce(jsonResponse({ state: "delivered" }));

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={onClose}
        onDelivered={onDelivered}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: messages.continue }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onDelivered).toHaveBeenCalledTimes(1);

    post.resolve(jsonResponse({ state: "processing" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onDelivered).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("F62-08: 409 operation_exists preserva o código e mostra conflito específico", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-1",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "operation_exists",
              message: "Já existe uma adição para esta campanha.",
            },
          },
          409,
        ),
      );

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={vi.fn()}
      />,
    );

    await screen.findByText(messages.cost);
    fireEvent.click(screen.getByRole("button", { name: messages.confirm }));

    await screen.findByText(messages.conflict.operationExists);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-state", "unavailable");
    expect(dialog).toHaveAttribute("data-reason", "operation_exists");
    expect(screen.queryByText(messages.failed)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("F62-08: 409 de gate preserva o reason técnico sem prometer estorno", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-1",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { state: "unavailable", reason: "pilot_gate_blocked" },
          409,
        ),
      );

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={vi.fn()}
      />,
    );

    await screen.findByText(messages.cost);
    fireEvent.click(screen.getByRole("button", { name: messages.confirm }));

    await screen.findByText(messages.conflict.confirmationFailed);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-reason", "pilot_gate_blocked");
    expect(screen.queryByText(messages.failed)).toBeNull();
  });

  it("F62-08: falha sem código preserva confirmation_failed e não promete estorno", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-1",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "internal" }, 500));

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={vi.fn()}
      />,
    );

    await screen.findByText(messages.cost);
    fireEvent.click(screen.getByRole("button", { name: messages.confirm }));

    await screen.findByText(messages.conflict.confirmationFailed);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-reason", "confirmation_failed");
    expect(screen.queryByText(messages.failed)).toBeNull();
  });

  it("incompatível mostra explicação sem prometer confirmação", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        state: "incompatible",
        reason: "unsupported_dimensions",
      }),
    );

    render(
      <AddVerticalDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={vi.fn()}
        onDelivered={vi.fn()}
      />,
    );

    await screen.findByText(messages.incompatible.unsupportedDimensions);
    expect(
      screen.queryByRole("button", { name: messages.confirm }),
    ).not.toBeInTheDocument();
  });
});
