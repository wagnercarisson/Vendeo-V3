// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { SidebarBadge } from "../sidebar-badge";
import { CHANGELOG_SEEN_KEY } from "@/hooks/use-changelog-state";
import { es419Messages, ptBRMessages } from "@/lib/i18n";

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
      <SidebarBadge
        latestEntryId="fase-34-store-readiness"
        messages={ptBRMessages.shell.badge}
      />,
    );
    const badge = container.querySelector('[role="status"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("aria-label")).toBe(
      ptBRMessages.shell.badge.available,
    );
    expect(badge?.getAttribute("title")).toBe(ptBRMessages.shell.badge.view);
  });

  it("não renderiza nada e não lança quando latestEntryId é null/undefined", () => {
    const { container } = render(
      <SidebarBadge latestEntryId={null} messages={ptBRMessages.shell.badge} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza quando lastSeenId === latestEntryId (já visto)", () => {
    localStorage.setItem(CHANGELOG_SEEN_KEY, "fase-34-store-readiness");
    const { container } = render(
      <SidebarBadge
        latestEntryId="fase-34-store-readiness"
        messages={ptBRMessages.shell.badge}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza rótulos em es-419 mantendo role=status", () => {
    localStorage.setItem(CHANGELOG_SEEN_KEY, "fase-32-freemium-cnpj");
    const { container } = render(
      <SidebarBadge
        latestEntryId="fase-34-store-readiness"
        messages={es419Messages.shell.badge}
      />,
    );
    const badge = container.querySelector('[role="status"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("aria-label")).toBe("Novedades disponibles");
    expect(badge?.getAttribute("title")).toBe("Ver novedades");
  });
});
