// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: mockRequireUser,
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor() {
      super("Unauthorized");
      this.name = "UnauthorizedError";
    }
  },
}));

vi.mock("@/components/auth/logout-button", () => ({
  LogoutButton: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthHeader", () => {
  it("renders Minhas Campanhas link when authenticated", async () => {
    mockRequireUser.mockResolvedValue({
      userId: "user-123",
      claims: { sub: "user-123" },
    });

    const { AuthHeader } = await import("@/components/auth/auth-header");
    const result = await AuthHeader();

    expect(result).not.toBeNull();

    const children = (
      Array.isArray(result!.props.children)
        ? result!.props.children
        : [result!.props.children]
    ) as any[];

    const linkEl = children.find(
      (child) => child?.props?.href === "/minhas-campanhas",
    );
    expect(linkEl).toBeDefined();
    expect(linkEl.props.href).toBe("/minhas-campanhas");
    expect(linkEl.props.children).toBe("Minhas Campanhas");
  });

  it("returns null when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUser.mockRejectedValue(new UnauthorizedError());

    const { AuthHeader } = await import("@/components/auth/auth-header");
    const result = await AuthHeader();

    expect(result).toBeNull();
  });

  it("rethrows non-UnauthorizedError errors", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unexpected error"));

    const { AuthHeader } = await import("@/components/auth/auth-header");

    await expect(AuthHeader()).rejects.toThrow("Unexpected error");
  });
});
