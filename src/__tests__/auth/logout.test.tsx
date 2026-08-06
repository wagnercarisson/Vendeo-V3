// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogoutButton } from "@/components/auth/logout-button";

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("LogoutButton", () => {
  it("removes known sessionStorage keys on submit", () => {
    sessionStorage.setItem("campaign_draft", "test");
    sessionStorage.setItem("campaign_draft_image", "test");
    sessionStorage.setItem("campaign_preview", "test");

    render(<LogoutButton />);

    const form = screen.getByRole("button").closest("form");
    expect(form).toBeInTheDocument();

    fireEvent.submit(form!);

    expect(sessionStorage.getItem("campaign_draft")).toBeNull();
    expect(sessionStorage.getItem("campaign_draft_image")).toBeNull();
    expect(sessionStorage.getItem("campaign_preview")).toBeNull();
  });

  it("does not call localStorage.removeItem for store_id", () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");

    render(<LogoutButton />);

    const form = screen.getByRole("button").closest("form");
    fireEvent.submit(form!);

    const storeIdCalls = removeItemSpy.mock.calls.filter(
      ([key]) => key === "store_id"
    );
    expect(storeIdCalls.length).toBe(0);

    removeItemSpy.mockRestore();
  });

  it("preserves unknown keys during cleanup", () => {
    localStorage.setItem("third-party-key", "should-stay");
    sessionStorage.setItem("other-key", "should-stay");

    render(<LogoutButton />);

    const form = screen.getByRole("button").closest("form");
    fireEvent.submit(form!);

    expect(localStorage.getItem("third-party-key")).toBe("should-stay");
    expect(sessionStorage.getItem("other-key")).toBe("should-stay");
  });

  it("clears onboarding draft keys (F36-DRAFT-04) but preserves non-draft keys", () => {
    localStorage.setItem(
      "vendeo:store_draft:user-1:new",
      JSON.stringify({ userId: "user-1", storeId: null, fields: {}, updatedAt: Date.now() }),
    );
    localStorage.setItem(
      "vendeo:store_draft:user-2:store-abc",
      JSON.stringify({ userId: "user-2", storeId: "store-abc", fields: {}, updatedAt: Date.now() }),
    );
    localStorage.setItem("vendeo:changelog-read", "keep");

    render(<LogoutButton />);

    const form = screen.getByRole("button").closest("form");
    fireEvent.submit(form!);

    expect(localStorage.getItem("vendeo:store_draft:user-1:new")).toBeNull();
    expect(localStorage.getItem("vendeo:store_draft:user-2:store-abc")).toBeNull();
    expect(localStorage.getItem("vendeo:changelog-read")).toBe("keep");
  });

  it("submits even if storage cleanup throws", () => {
    const orig = sessionStorage.removeItem;
    sessionStorage.removeItem = vi.fn(() => {
      throw new Error("Storage error");
    });

    render(<LogoutButton />);

    const form = screen.getByRole("button").closest("form");
    expect(() => fireEvent.submit(form!)).not.toThrow();

    sessionStorage.removeItem = orig;
  });

  it("renders logout button with Sair text", () => {
    render(<LogoutButton />);

    expect(screen.getByText("Sair")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("form action is /auth/signout with POST method", () => {
    render(<LogoutButton />);

    const form = screen.getByRole("button").closest("form");
    expect(form).toHaveAttribute("action", "/auth/signout");
    expect(form).toHaveAttribute("method", "POST");
  });
});
