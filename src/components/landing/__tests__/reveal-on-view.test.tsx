// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RevealOnView } from "../reveal-on-view";

type IOCallback = (
  entries: Partial<IntersectionObserverEntry>[],
  observer: unknown,
) => void;

interface FakeObserver {
  callback: IOCallback;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function installIntersectionObserver(): FakeObserver[] {
  const observers: FakeObserver[] = [];

  class FakeIntersectionObserver implements FakeObserver {
    callback: IOCallback;
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(callback: IOCallback) {
      this.callback = callback;
      observers.push(this);
    }
  }

  (globalThis as Record<string, unknown>).IntersectionObserver =
    FakeIntersectionObserver;
  return observers;
}

function setReducedMotion(reduce: boolean) {
  (window as unknown as Record<string, unknown>).matchMedia = vi
    .fn()
    .mockImplementation((query: string) => ({
      matches: reduce && String(query).includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
}

function renderSet() {
  render(
    <RevealOnView>
      <span data-testid="content">conteúdo</span>
    </RevealOnView>,
  );
  return screen.getByTestId("content").closest("[data-reveal]") as HTMLElement;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).IntersectionObserver;
  vi.restoreAllMocks();
});

describe("RevealOnView", () => {
  it("keeps the content present and not revealed by default", () => {
    installIntersectionObserver();
    setReducedMotion(false);

    const wrapper = renderSet();

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(wrapper).toHaveAttribute("data-reveal", "off");
  });

  it("reveals once when the set enters the viewport and then unobserves it", () => {
    const observers = installIntersectionObserver();
    setReducedMotion(false);

    const wrapper = renderSet();
    expect(wrapper).toHaveAttribute("data-reveal", "off");

    act(() => {
      observers[0].callback([{ isIntersecting: true, target: wrapper }], null);
    });

    expect(wrapper).toHaveAttribute("data-reveal", "on");
    expect(observers[0].unobserve).toHaveBeenCalledTimes(1);

    // Firing again is a no-op (single reveal, never a cascade).
    act(() => {
      observers[0].callback([{ isIntersecting: true, target: wrapper }], null);
    });
    expect(wrapper).toHaveAttribute("data-reveal", "on");
  });

  it("stays static under prefers-reduced-motion (no observer created)", () => {
    const observers = installIntersectionObserver();
    setReducedMotion(true);

    const wrapper = renderSet();

    expect(observers).toHaveLength(0);
    expect(wrapper).toHaveAttribute("data-reveal", "off");
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("stays static and visible when IntersectionObserver is unavailable", () => {
    delete (globalThis as Record<string, unknown>).IntersectionObserver;
    setReducedMotion(false);

    const wrapper = renderSet();

    expect(wrapper).toHaveAttribute("data-reveal", "off");
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
