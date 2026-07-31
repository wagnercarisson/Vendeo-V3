// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChangelogState, type UseChangelogStateReturn } from "../use-changelog-state";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useChangelogState", () => {
  it("render inicial devolve null sem ler localStorage (SSR-safe); efeito lê só as chaves contratuais", () => {
    localStorage.setItem("vendeo:last_seen_changelog_id", "fase-34-store-readiness");
    localStorage.setItem(
      "vendeo:dismissed_changelog_announcement_id",
      "fase-32-freemium-cnpj",
    );

    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    // Captura o retorno do hook durante o PRIMEIRO render (antes dos efeitos).
    // Se o render lesse localStorage, o estado inicial já viria populado.
    const firstRender: { state: UseChangelogStateReturn | null } = { state: null };
    let firstRenderDone = false;

    const { result } = renderHook(() => {
      const state = useChangelogState();
      if (!firstRenderDone) {
        firstRender.state = state;
        firstRenderDone = true;
      }
      return state;
    });

    // Primeiro render: estado inicial null — o render NÃO leu localStorage
    expect(firstRender.state?.lastSeenId).toBeNull();
    expect(firstRender.state?.dismissedId).toBeNull();

    // O efeito de montagem leu exatamente as duas chaves contratuais
    expect(getItemSpy).toHaveBeenCalledWith("vendeo:last_seen_changelog_id");
    expect(getItemSpy).toHaveBeenCalledWith(
      "vendeo:dismissed_changelog_announcement_id",
    );
    expect(getItemSpy.mock.calls.length).toBe(2);

    // Após o efeito, o estado reflete os valores do localStorage
    expect(result.current.lastSeenId).toBe("fase-34-store-readiness");
    expect(result.current.dismissedId).toBe("fase-32-freemium-cnpj");
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
