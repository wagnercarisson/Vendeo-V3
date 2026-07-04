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
  it("removes known keys on submit", () => {
    sessionStorage.setItem("campaign_draft", "test");
    sessionStorage.setItem("campaign_draft_image", "test");
    sessionStorage.setItem("campaign_preview", "test");
    localStorage.setItem("store_id", "test-store");

    render(<LogoutButton />);

    const form = screen.getByRole("button").closest("form");
    expect(form).toBeInTheDocument();

    fireEvent.submit(form!);

    expect(sessionStorage.getItem("campaign_draft")).toBeNull();
    expect(sessionStorage.getItem("campaign_draft_image")).toBeNull();
    expect(sessionStorage.getItem("campaign_preview")).toBeNull();
    expect(localStorage.getItem("store_id")).toBeNull();
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
