// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("CheckEmailPage", () => {
  it("renders signup confirmation text with type=signup", async () => {
    const searchParams = Promise.resolve({ type: "signup" });
    const Page = await import("@/app/(auth)/check-email/page");
    const { container } = render(await Page.default({ searchParams }));

    expect(container.textContent).toContain("link de confirmação");
    expect(container.textContent).toContain("ativar sua conta");
  });

  it("renders recovery text with type=recovery", async () => {
    const searchParams = Promise.resolve({ type: "recovery" });
    const Page = await import("@/app/(auth)/check-email/page");
    const { container } = render(await Page.default({ searchParams }));

    expect(container.textContent).toContain("link de redefinição de senha");
    expect(container.textContent).toContain("criar uma nova senha");
  });

  it("renders generic fallback text without type", async () => {
    const searchParams = Promise.resolve({});
    const Page = await import("@/app/(auth)/check-email/page");
    const { container } = render(await Page.default({ searchParams }));

    expect(container.textContent).toContain("Verifique sua caixa de entrada");
    expect(container.textContent).not.toContain("test@email.com");
  });

  it("never reveals the user email in any variant", async () => {
    const searchParams = Promise.resolve({ type: "signup" });
    const Page = await import("@/app/(auth)/check-email/page");
    const { container } = render(await Page.default({ searchParams }));

    expect(container.textContent).not.toMatch(/[\w.-]+@[\w.-]+\.\w+/);
  });
});
