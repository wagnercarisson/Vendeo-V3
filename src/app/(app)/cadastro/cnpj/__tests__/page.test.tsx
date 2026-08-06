// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectFn = vi.fn();
const NEXT_CONTROL = new Error("NEXT_CONTROL");

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectFn(...args);
    throw NEXT_CONTROL;
  },
}));

describe("CadastroCnpjPage - redirect logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /loja with fiscal pending tab and default returnTo", async () => {
    const { default: Page } = await import("../page");

    await expect(Page({})).rejects.toThrow(NEXT_CONTROL);

    expect(redirectFn).toHaveBeenCalledWith(
      "/loja?tab=dados&fiscal=pending&returnTo=%2Fdashboard",
    );
  });

  it("preserves returnTo when redirecting to /loja", async () => {
    const { default: Page } = await import("../page");

    await expect(
      Page({
        searchParams: Promise.resolve({ returnTo: "/campanhas/nova" }),
      }),
    ).rejects.toThrow(NEXT_CONTROL);

    expect(redirectFn).toHaveBeenCalledWith(
      "/loja?tab=dados&fiscal=pending&returnTo=%2Fcampanhas%2Fnova",
    );
  });
});
