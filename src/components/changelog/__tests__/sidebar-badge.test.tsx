// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { SidebarBadge } from "../sidebar-badge";
import { CHANGELOG_SEEN_KEY } from "@/hooks/use-changelog-state";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("SidebarBadge", () => {
  it("renderiza ponto visual quando hasUnseen(latestEntryId) é true", () => {
    localStorage.setItem(CHANGELOG_SEEN_KEY, "fase-32-freemium-cnpj");
    const { container } = render(
      <SidebarBadge latestEntryId="fase-34-store-readiness" />,
    );
    const badge = container.querySelector('[role="status"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("aria-label")).toBe("Novidades disponíveis");
  });

  it("não renderiza nada e não lança quando latestEntryId é null/undefined", () => {
    const { container } = render(<SidebarBadge latestEntryId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza quando lastSeenId === latestEntryId (já visto)", () => {
    localStorage.setItem(CHANGELOG_SEEN_KEY, "fase-34-store-readiness");
    const { container } = render(
      <SidebarBadge latestEntryId="fase-34-store-readiness" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
