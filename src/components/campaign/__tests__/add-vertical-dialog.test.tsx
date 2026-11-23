// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
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
