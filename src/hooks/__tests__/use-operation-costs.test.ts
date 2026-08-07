// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const okBody = {
  campaign_generation: { costCredits: 1, enabled: true },
  visual_signature_generation: { costCredits: 1, enabled: true },
};

describe("useOperationCosts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sucesso → loaded com 2 chaves", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => okBody,
    });

    const { useOperationCosts } = await import("../use-operation-costs");
    const { result } = renderHook(() => useOperationCosts());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.costs).toEqual(okBody);
  });

  it("503 → unavailable", async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "operation_cost_unavailable" }),
    });

    const { useOperationCosts } = await import("../use-operation-costs");
    const { result } = renderHook(() => useOperationCosts());

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.costs).toBeNull();
  });

  it("erro de rede → unavailable", async () => {
    (fetch as any).mockRejectedValue(new Error("network"));

    const { useOperationCosts } = await import("../use-operation-costs");
    const { result } = renderHook(() => useOperationCosts());

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("cache module-level — fetch uma vez para dois hooks", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => okBody,
    });

    const { useOperationCosts } = await import("../use-operation-costs");
    const a = renderHook(() => useOperationCosts());
    const b = renderHook(() => useOperationCosts());

    await waitFor(() => expect(a.result.current.status).toBe("loaded"));
    await waitFor(() => expect(b.result.current.status).toBe("loaded"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refetch limpa cache e busca de novo", async () => {
    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => okBody,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...okBody,
          campaign_generation: { costCredits: 2, enabled: true },
        }),
      });

    const { useOperationCosts } = await import("../use-operation-costs");
    const { result } = renderHook(() => useOperationCosts());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.costs?.campaign_generation.costCredits).toBe(1);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() =>
      expect(result.current.costs?.campaign_generation.costCredits).toBe(2),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
