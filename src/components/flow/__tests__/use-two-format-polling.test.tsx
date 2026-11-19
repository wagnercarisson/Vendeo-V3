// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTwoFormatPolling } from "../use-two-format-polling";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function input(fetchFn: typeof fetch, onDelivered = vi.fn()) {
  return {
    campaignId: "campaign-1",
    operationId: "operation-1",
    enabled: true,
    formatsSignature: JSON.stringify({
      "1:1": { state: "processing" },
      "9:16": { state: "processing" },
    }),
    onDelivered,
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
      resolve(json({ operation: { formats: {} } }));
      await Promise.resolve();
    });
  });

  it("aplica backoff 5/10/20/30 em falhas", async () => {
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
  });

  it("dispara onDelivered quando um formato passa a delivered e para", async () => {
    const onDelivered = vi.fn();
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
      useTwoFormatPolling(input(fetchFn as typeof fetch, onDelivered)),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(onDelivered).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("cancela timers no unmount", async () => {
    const fetchFn = vi.fn(async () => json({ operation: { formats: {} } }));
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
