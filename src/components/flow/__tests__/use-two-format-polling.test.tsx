// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { twoFormatStatesSignature } from "@/lib/product-two-format/format-signature";
import { useTwoFormatPolling } from "../use-two-format-polling";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function input(
  fetchFn: typeof fetch,
  onTransition = vi.fn(),
  formatsSignature = twoFormatStatesSignature({
    "1:1": "processing",
    "9:16": "processing",
  }),
) {
  return {
    campaignId: "campaign-1",
    operationId: "operation-1",
    enabled: true,
    formatsSignature,
    onTransition,
    fetchFn,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("F60.7 C3 — polling conjunto com relógio controlado", () => {
  it("não sobrepõe requisições", async () => {
    let resolve!: (response: Response) => void;
    const fetchFn = vi.fn(
      () => new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    renderHook(() => useTwoFormatPolling(input(fetchFn as typeof fetch)));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve(
        json({
          operation: {
            formats: {
              "1:1": { state: "processing" },
              "9:16": { state: "processing" },
            },
          },
        }),
      );
      await Promise.resolve();
    });
  });

  it("aplica backoff 5/10/20 em falhas", async () => {
    const fetchFn = vi.fn(async () =>
      json({ error: { code: "status_unavailable" } }, 503),
    );
    renderHook(() => useTwoFormatPolling(input(fetchFn as typeof fetch)));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // Primeiro retry após 5 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    // Segundo retry após 10 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    // Terceiro retry após 20 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("compara estados canônicos e não reage a formato de objeto diferente", async () => {
    const onTransition = vi.fn();
    const fetchFn = vi.fn(async () =>
      json({
        operation: {
          formats: {
            "1:1": { state: "delivered", deliveryOperationId: "op-1" },
            "9:16": { state: "delivered", deliveryOperationId: "op-2" },
          },
        },
      }),
    );
    renderHook(() =>
      useTwoFormatPolling(
        input(
          fetchFn as typeof fetch,
          onTransition,
          twoFormatStatesSignature({
            "1:1": "delivered",
            "9:16": "delivered",
          }),
        ),
      ),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(onTransition).not.toHaveBeenCalled();
    // Ambos estáveis ⇒ para.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("dispara uma transição e CONTINUA acompanhando o formato pendente", async () => {
    const onTransition = vi.fn();
    const fetchFn = vi.fn(async () =>
      json({
        operation: {
          formats: {
            "1:1": { state: "delivered" },
            "9:16": { state: "processing" },
          },
        },
      }),
    );
    renderHook(() =>
      useTwoFormatPolling(input(fetchFn as typeof fetch, onTransition)),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(onTransition).toHaveBeenCalledTimes(1);
    // Continua: nova consulta após 5 s, sem repetir a transição.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(onTransition).toHaveBeenCalledTimes(1);
  });

  it("aplica estorno/unknown sem nova entrega e para quando ambos estabilizam", async () => {
    const onTransition = vi.fn();
    const fetchFn = vi.fn(async () =>
      json({
        operation: {
          formats: {
            "1:1": { state: "absent" },
            "9:16": { state: "unknown" },
          },
        },
      }),
    );
    renderHook(() =>
      useTwoFormatPolling(input(fetchFn as typeof fetch, onTransition)),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(onTransition).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("cancela timers no unmount", async () => {
    const fetchFn = vi.fn(async () =>
      json({
        operation: {
          formats: {
            "1:1": { state: "processing" },
            "9:16": { state: "processing" },
          },
        },
      }),
    );
    const { unmount } = renderHook(() =>
      useTwoFormatPolling(input(fetchFn as typeof fetch)),
    );
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
