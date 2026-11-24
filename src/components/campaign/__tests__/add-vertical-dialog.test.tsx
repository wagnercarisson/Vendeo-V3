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
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
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

    await screen.findByText(messages.cost);
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

  it("F62-08: 403 confirmation_expired orienta reabrir e preserva o código", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-1",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "confirmation_expired",
              message: "Confirmação inválida ou expirada.",
            },
          },
          403,
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

    await screen.findByText(messages.conflict.confirmationExpired);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-state", "unavailable");
    expect(dialog).toHaveAttribute("data-reason", "confirmation_expired");
    expect(
      screen.queryByRole("button", { name: messages.confirm }),
    ).not.toBeInTheDocument();
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

  it("F62-08: confirmação vencida não oferece Confirmar e permite novo GET read-only", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-old",
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-new",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText(messages.conflict.confirmationExpired),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: messages.confirm }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: messages.retry }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "GET" });
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method !== "POST"),
    ).toBe(true);
    expect(screen.getByText(messages.cost)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.confirm }),
    ).toBeEnabled();
  });

  it("F62-08: fechar a modal não aborta o POST em andamento", async () => {
    const post = deferred<Response>();
    let postSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-1",
        }),
      )
      .mockImplementationOnce((_input, init) => {
        postSignal = init?.signal ?? undefined;
        return post.promise;
      });

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

    await screen.findByText(messages.cost);
    fireEvent.click(screen.getByRole("button", { name: messages.confirm }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(postSignal?.aborted).toBe(false);

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
    await act(async () => {
      await Promise.resolve();
    });
    expect(postSignal?.aborted).toBe(false);

    post.resolve(jsonResponse({ state: "processing" }));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("F62-08: descrição aprovada no estado inicial", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        state: "eligible",
        sourceOrigin: "new_flow_1_1",
        costCredits: 1,
        confirmationToken: "token-1",
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

    expect(await screen.findByText(messages.description)).toBeInTheDocument();
    expect(screen.getByText(messages.description).textContent).toBe(
      "Você pode gerar o formato vertical 9:16 para essa campanha.",
    );
  });

  it("F62-08: processing bloqueia Cancelar, Escape e clique fora", async () => {
    const onClose = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
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

    await screen.findByRole("status", { name: messages.processing });
    const cancel = screen.getByRole("button", { name: messages.cancel });
    expect(cancel).toBeDisabled();

    fireEvent.click(cancel);
    fireEvent.keyDown(document, { key: "Escape" });
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("F62-08: unknown oferece continuar e permite fechar", async () => {
    const onClose = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        state: "unknown",
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

    await screen.findByText(messages.unknown);
    expect(
      screen.getByRole("button", { name: messages.continue }),
    ).toBeEnabled();
    const cancel = screen.getByRole("button", { name: messages.cancel });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("F62-08: falha oferece nova consulta read-only, sem POST", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "unavailable",
          reason: "confirmation_failed",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-new",
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

    await screen.findByText(messages.conflict.confirmationFailed);
    fireEvent.click(screen.getByRole("button", { name: messages.retry }));
    await screen.findByText(messages.cost);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "GET" });
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method !== "POST"),
    ).toBe(true);
  });

  it("F62-08: POST anterior não é abortado ao retomar; resposta A não altera B", async () => {
    const postA = deferred<Response>();
    const postB = deferred<Response>();
    let signalA: AbortSignal | undefined;
    let signalB: AbortSignal | undefined;
    const onDelivered = vi.fn();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          state: "eligible",
          sourceOrigin: "new_flow_1_1",
          costCredits: 1,
          confirmationToken: "token-a",
        }),
      )
      .mockImplementationOnce((_input, init) => {
        signalA = init?.signal ?? undefined;
        return postA.promise;
      })
      .mockResolvedValueOnce(
        jsonResponse({
          state: "processing",
          confirmationToken: "token-b",
        }),
      )
      .mockImplementationOnce((_input, init) => {
        signalB = init?.signal ?? undefined;
        return postB.promise;
      });

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

    await screen.findByText(messages.cost);
    fireEvent.click(screen.getByRole("button", { name: messages.confirm }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(signalA?.aborted).toBe(false);

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
    await act(async () => {
      await Promise.resolve();
    });
    expect(signalA?.aborted).toBe(false);

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
    await screen.findByRole("button", { name: messages.continue });
    fireEvent.click(screen.getByRole("button", { name: messages.continue }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(signalA?.aborted).toBe(false);
    expect(signalB?.aborted).toBe(false);

    postA.resolve(jsonResponse({ state: "delivered" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onDelivered).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-submitting",
      "true",
    );
    expect(
      screen.getByRole("status", { name: messages.processing }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.cancel }),
    ).toBeDisabled();

    postB.resolve(jsonResponse({ state: "delivered" }));
    await waitFor(() => expect(onDelivered).toHaveBeenCalledTimes(1));
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
