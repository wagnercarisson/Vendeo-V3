// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { AccountMenu } from "@/components/shell/account-menu";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

describe("AccountMenu", () => {
  it("shows user email", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    expect(screen.getByText("user@vendeo.tech")).toBeTruthy();
  });

  it("shows fallback when email unavailable", () => {
    render(<AccountMenu user={{ claims: { sub: "abc-123-def" } }} />);
    expect(screen.getByText("abc-123-")).toBeTruthy();
  });

  it("shows Configurações and Sair when dropdown is open", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByText("Configurações")).toBeTruthy();
    expect(screen.getByText("Sair")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Configurações/ });
    expect(link.getAttribute("href")).toBe("/conta");
  });
});
