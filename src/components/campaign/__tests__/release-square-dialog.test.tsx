// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReleaseSquareDialog } from "../release-square-dialog";
import { ptBRCampaignDetailMessages } from "@/lib/i18n/campaign-detail/catalogs/pt-BR";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";
const messages = ptBRCampaignDetailMessages.squareRelease;

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
});

describe("liberação do quadrado — modal", () => {
  it("GET pendente mostra verificação, não geração, e permite cancelar", async () => {
    const get = deferred<Response>();
    const onClose = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => get.promise);

    render(
      <ReleaseSquareDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={onClose}
        onReleased={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(messages.description)).toBeInTheDocument();
    expect(screen.getByText(messages.checking)).toBeInTheDocument();
    expect(screen.getByRole("status", { name: messages.checking })).toBeInTheDocument();
    expect(screen.queryByText(messages.processing)).toBeNull();
    expect(screen.queryByText(messages.cost)).toBeNull();
    expect(
      screen.queryByRole("button", { name: messages.confirm }),
    ).not.toBeInTheDocument();

    const cancel = screen.getByRole("button", { name: messages.cancel });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET" });
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method !== "POST"),
    ).toBe(true);

    get.resolve(jsonResponse({ state: "eligible", costCredits: 1 }));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("GET elegível mostra custo, confirmação e POST pendente com processamento", async () => {
    const post = deferred<Response>();
    const onReleased = vi.fn();
    const onClose = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ state: "eligible", costCredits: 1 }))
      .mockImplementationOnce(() => post.promise);

    render(
      <ReleaseSquareDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={onClose}
        onReleased={onReleased}
      />,
    );

    await screen.findByText(messages.cost);
    fireEvent.click(screen.getByRole("button", { name: messages.confirm }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
    expect(screen.getAllByText(messages.processing)).toHaveLength(1);
    expect(
      screen.getByRole("status", { name: messages.processing }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.cancel }),
    ).toBeDisabled();
    expect(screen.queryByText(messages.cost)).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    post.resolve(jsonResponse({ state: "delivered" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onReleased).toHaveBeenCalledTimes(1);
  });

  it("fechar durante GET ignora a resposta posterior", async () => {
    const get = deferred<Response>();
    const onReleased = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => get.promise);

    const view = render(
      <ReleaseSquareDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open
        onClose={onClose}
        onReleased={onReleased}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    view.rerender(
      <ReleaseSquareDialog
        campaignId={CAMPAIGN}
        messages={messages}
        locale="pt-BR"
        open={false}
        onClose={onClose}
        onReleased={onReleased}
      />,
    );
    get.resolve(jsonResponse({ state: "eligible", costCredits: 1 }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onReleased).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("refunded/unknown não mostram confirmação", async () => {
    for (const state of ["refunded", "unknown", "unavailable"] as const) {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        jsonResponse({ state }),
      );
      const view = render(
        <ReleaseSquareDialog
          campaignId={CAMPAIGN}
          messages={messages}
          locale="pt-BR"
          open
          onClose={vi.fn()}
          onReleased={vi.fn()}
        />,
      );
      await screen.findByText(
        state === "refunded"
          ? messages.refunded
          : state === "unknown"
            ? messages.unknown
            : messages.unavailable,
      );
      expect(
        screen.queryByRole("button", { name: messages.confirm }),
      ).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
