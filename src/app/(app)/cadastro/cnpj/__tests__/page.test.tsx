// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockGetCurrentStore = vi.fn();
const redirectFn = vi.fn();
const NEXT_CONTROL = new Error("NEXT_CONTROL");

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => { redirectFn(...args); throw NEXT_CONTROL; },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

function createStore(overrides: Record<string, unknown> = {}) {
  return {
    id: "store-1",
    user_id: "user-123",
    name: "Minha Loja",
    segment: "moda-calcados-acessorios",
    cnpj_normalized: null,
    razao_social: null,
    nome_fantasia: null,
    ...overrides,
  };
}

describe("CadastroCnpjPage — redirect logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ userId: "user-123" });
    redirectFn.mockClear();
  });

  it("redirects to / if store is null", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: Page } = await import("../page");
    await expect(Page({})).rejects.toThrow(NEXT_CONTROL);
    expect(redirectFn).toHaveBeenCalledWith("/");
  });

  it("redirects to / if fiscal data is complete", async () => {
    mockGetCurrentStore.mockResolvedValue(
      createStore({ cnpj_normalized: "12345678000195", razao_social: "Razao Social", nome_fantasia: "Nome Fantasia" })
    );

    const { default: Page } = await import("../page");
    await expect(Page({})).rejects.toThrow(NEXT_CONTROL);
    expect(redirectFn).toHaveBeenCalledWith("/");
  });

  it("allows access if CNPJ exists but razao_social is missing", async () => {
    mockGetCurrentStore.mockResolvedValue(
      createStore({ cnpj_normalized: "12345678000195", razao_social: null, nome_fantasia: null })
    );

    const { default: Page } = await import("../page");
    const result = await Page({});
    expect(result).toBeDefined();
    expect(redirectFn).not.toHaveBeenCalled();
  });

  it("allows access if CNPJ exists but nome_fantasia is missing", async () => {
    mockGetCurrentStore.mockResolvedValue(
      createStore({ cnpj_normalized: "12345678000195", razao_social: "Razao Social", nome_fantasia: null })
    );

    const { default: Page } = await import("../page");
    const result = await Page({});
    expect(result).toBeDefined();
    expect(redirectFn).not.toHaveBeenCalled();
  });

  it("allows access if store has no CNPJ at all", async () => {
    mockGetCurrentStore.mockResolvedValue(createStore({}));

    const { default: Page } = await import("../page");
    const result = await Page({});
    expect(result).toBeDefined();
    expect(redirectFn).not.toHaveBeenCalled();
  });
});
