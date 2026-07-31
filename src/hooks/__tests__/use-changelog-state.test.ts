// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChangelogState } from "../use-changelog-state";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useChangelogState", () => {
  it("inicia com null e NÃO lê localStorage durante o render (SSR-safe)", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    const { result } = renderHook(() => useChangelogState());

    expect(result.current.lastSeenId).toBeNull();
    expect(result.current.dismissedId).toBeNull();

    // Nenhuma leitura de localStorage durante o render inicial
    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it("markChangelogAsViewed atualiza lastSeenId, limpa hasUnseen e escreve SEEN_KEY", () => {
    const { result } = renderHook(() => useChangelogState());

    act(() => {
      result.current.markChangelogAsViewed("fase-32-freemium-cnpj");
    });

    expect(result.current.lastSeenId).toBe("fase-32-freemium-cnpj");
    expect(result.current.hasUnseen("fase-32-freemium-cnpj")).toBe(false);
    expect(localStorage.getItem("vendeo:last_seen_changelog_id")).toBe(
      "fase-32-freemium-cnpj",
    );
  });

  it("markChangelogAsViewed com announcementId também dispensa o anúncio (ambas as chaves)", () => {
    const { result } = renderHook(() => useChangelogState());

    act(() => {
      result.current.markChangelogAsViewed(
        "fase-34-store-readiness",
        "fase-32-freemium-cnpj",
      );
    });

    expect(result.current.lastSeenId).toBe("fase-34-store-readiness");
    expect(result.current.dismissedId).toBe("fase-32-freemium-cnpj");
    expect(localStorage.getItem("vendeo:last_seen_changelog_id")).toBe(
      "fase-34-store-readiness",
    );
    expect(
      localStorage.getItem("vendeo:dismissed_changelog_announcement_id"),
    ).toBe("fase-32-freemium-cnpj");
  });

  it("dismissAnnouncement dispensa o anúncio sem afetar hasUnseen nem escrever SEEN_KEY", () => {
    const { result } = renderHook(() => useChangelogState());

    act(() => {
      result.current.dismissAnnouncement("fase-32-freemium-cnpj");
    });

    expect(result.current.isAnnouncementVisible("fase-32-freemium-cnpj")).toBe(
      false,
    );
    expect(result.current.hasUnseen("fase-32-freemium-cnpj")).toBe(true);
    expect(localStorage.getItem("vendeo:last_seen_changelog_id")).toBeNull();
    expect(
      localStorage.getItem("vendeo:dismissed_changelog_announcement_id"),
    ).toBe("fase-32-freemium-cnpj");
  });

  it("hasUnseen e isAnnouncementVisible retornam false para id vazio", () => {
    const { result } = renderHook(() => useChangelogState());

    expect(result.current.hasUnseen("")).toBe(false);
    expect(result.current.isAnnouncementVisible("")).toBe(false);
  });

  it("hasUnseen reaparece quando uma nova entry é adicionada", () => {
    const { result } = renderHook(() => useChangelogState());

    act(() => {
      result.current.markChangelogAsViewed("fase-32-freemium-cnpj");
    });
    expect(result.current.hasUnseen("fase-32-freemium-cnpj")).toBe(false);

    expect(result.current.hasUnseen("fase-35-nova-entry")).toBe(true);
  });
});
