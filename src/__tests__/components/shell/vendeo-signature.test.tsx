// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import {
  SIGNATURE_BLOCK_HEIGHT,
  SIGNATURE_MIN_GAP,
  VendeoSignature,
  shouldShowSignature,
} from "@/components/shell/vendeo-signature";

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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the signature when the measured space fits", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );

    const { container } = render(
      <VendeoSignature
        asideRef={{ current: { clientHeight: 560 } as HTMLElement }}
        headerRef={{ current: { offsetHeight: 56 } as HTMLElement }}
        navRef={{ current: { offsetHeight: 248 } as HTMLElement }}
      />,
    );

    const wrapper = container.querySelector("[data-signature-visible]");
    expect(wrapper?.getAttribute("data-signature-visible")).toBe("true");
    expect(wrapper?.className).toContain("mt-auto");
  });

  it("stays hidden when there is no ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    const { container } = render(
      <VendeoSignature
        asideRef={{ current: { clientHeight: 900 } as HTMLElement }}
        headerRef={{ current: { offsetHeight: 56 } as HTMLElement }}
        navRef={{ current: { offsetHeight: 248 } as HTMLElement }}
      />,
    );

    const wrapper = container.querySelector("[data-signature-visible]");
    expect(wrapper?.getAttribute("data-signature-visible")).toBe("false");
    expect(wrapper?.className).toContain("hidden");
  });

  it("stays hidden when the measured navigation leaves too little space", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );

    const { container } = render(
      <VendeoSignature
        asideRef={{ current: { clientHeight: 560 } as HTMLElement }}
        headerRef={{ current: { offsetHeight: 56 } as HTMLElement }}
        navRef={{ current: { offsetHeight: 366 } as HTMLElement }}
      />,
    );

    const wrapper = container.querySelector("[data-signature-visible]");
    expect(wrapper?.getAttribute("data-signature-visible")).toBe("false");
  });
});
