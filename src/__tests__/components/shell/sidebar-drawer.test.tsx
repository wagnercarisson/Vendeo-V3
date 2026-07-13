// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { SidebarDrawer } from "@/components/shell/sidebar-drawer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/campanhas",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

describe("SidebarDrawer", () => {
  it("renders when open with navigation links", () => {
    const { container } = render(<SidebarDrawer isOpen={true} onClose={() => {}} />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Campanhas")).toBeTruthy();
    expect(screen.getByText("Loja")).toBeTruthy();
    expect(screen.getByText("Conta")).toBeTruthy();
    expect(container.innerHTML).toContain("z-50");
  });

  it("renders hidden when closed", () => {
    const { container } = render(<SidebarDrawer isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toContain("-translate-x-full");
  });

  it("closes when a navigation link is clicked", () => {
    const onClose = vi.fn();
    render(<SidebarDrawer isOpen={true} onClose={onClose} />);
    const link = screen.getByText("Campanhas");
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
