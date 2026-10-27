// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import {
  SIGNATURE_BLOCK_HEIGHT,
  SIGNATURE_MIN_GAP,
  VendeoSignature,
  shouldShowSignature,
} from "@/components/shell/vendeo-signature";

interface MockObserver {
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function installResizeObserver(): MockObserver[] {
  const observers: MockObserver[] = [];

  class MockResizeObserver {
    callback: ResizeObserverCallback;
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      observers.push(this);
    }
  }

  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  return observers;
}

function renderSignature(
  initial: { asideHeight?: number; headerHeight?: number; navHeight?: number } = {},
) {
  const aside = { clientHeight: initial.asideHeight ?? 560 };
  const header = { offsetHeight: initial.headerHeight ?? 56 };
  const nav = { offsetHeight: initial.navHeight ?? 248 };

  const result = render(
    <VendeoSignature
      asideRef={{ current: aside as unknown as HTMLElement }}
      headerRef={{ current: header as unknown as HTMLElement }}
      navRef={{ current: nav as unknown as HTMLElement }}
    />,
  );

  return {
    ...result,
    aside,
    header,
    nav,
    wrapper: () =>
      result.container.querySelector("[data-signature-visible]"),
  };
}

describe("shouldShowSignature", () => {
  const fit = (asideHeight: number, headerHeight: number, navHeight: number) =>
    shouldShowSignature({ asideHeight, headerHeight, navHeight });

  it("keeps the signature hidden below the 560px floor", () => {
    expect(fit(559, 56, 248)).toBe(false);
  });

  it("shows the signature at 560px when the measured content fits", () => {
    expect(fit(560, 56, 248)).toBe(true);
  });

  it("uses the measured available space, not just the nominal viewport height", () => {
    expect(fit(560, 56, 365)).toBe(true);
    expect(fit(560, 56, 366)).toBe(false);
  });

  it("hides the signature when enlarged text makes the nav too tall", () => {
    expect(fit(560, 112, 496)).toBe(false);
  });

  it("still shows the signature on tall viewports with enlarged text", () => {
    expect(fit(900, 112, 496)).toBe(true);
  });

  it("documents the block height with the 118px asset", () => {
    expect(SIGNATURE_MIN_GAP).toBe(16);
    expect(SIGNATURE_BLOCK_HEIGHT).toBeGreaterThan(122);
    expect(SIGNATURE_BLOCK_HEIGHT).toBeLessThan(123);
  });
});

describe("VendeoSignature", () => {
  it("renders hidden by default during server rendering", () => {
    const asideRef = createRef<HTMLElement>();
    const headerRef = createRef<HTMLElement>();
    const navRef = createRef<HTMLElement>();

    const html = renderToString(
      <VendeoSignature
        asideRef={asideRef}
        headerRef={headerRef}
        navRef={navRef}
      />,
    );

    expect(html).toContain('data-signature-visible="false"');
    expect(html).toContain("hidden");
    expect(html).toContain('src="/brand/vendeo-signature.png"');
    expect(html).toContain('width="1256"');
    expect(html).toContain('height="923"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("mt-auto");
  });

  it("shows the signature when the measured space fits", () => {
    installResizeObserver();
    const { wrapper } = renderSignature();

    expect(wrapper()?.getAttribute("data-signature-visible")).toBe("true");
    expect(wrapper()?.className).toContain("mt-auto");
  });

  it("hides when the nav grows and reappears when space returns", () => {
    const observers = installResizeObserver();
    const { nav, wrapper } = renderSignature();

    expect(wrapper()?.getAttribute("data-signature-visible")).toBe("true");

    nav.offsetHeight = 366;
    act(() => {
      observers[0]?.callback([], observers[0] as unknown as ResizeObserver);
    });
    expect(wrapper()?.getAttribute("data-signature-visible")).toBe("false");

    nav.offsetHeight = 248;
    act(() => {
      observers[0]?.callback([], observers[0] as unknown as ResizeObserver);
    });
    expect(wrapper()?.getAttribute("data-signature-visible")).toBe("true");
  });

  it("stays hidden when the measured navigation leaves too little space", () => {
    installResizeObserver();
    const { wrapper } = renderSignature({ navHeight: 366 });

    expect(wrapper()?.getAttribute("data-signature-visible")).toBe("false");
  });

  it("stays hidden when there is no ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { wrapper } = renderSignature({ asideHeight: 900 });

    expect(wrapper()?.getAttribute("data-signature-visible")).toBe("false");
    expect(wrapper()?.className).toContain("hidden");
  });

  it("disconnects the observer and removes the resize listener on unmount", () => {
    const observers = installResizeObserver();
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderSignature();

    const resizeCall = addSpy.mock.calls.find(([event]) => event === "resize");
    expect(resizeCall).toBeDefined();
    const resizeHandler = resizeCall?.[1];

    unmount();

    expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith("resize", resizeHandler);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
