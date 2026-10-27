"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";

export const SIGNATURE_MIN_VIEWPORT_HEIGHT = 560;
export const SIGNATURE_MIN_GAP = 16;
export const SIGNATURE_WIDTH_PX = 118;
export const SIGNATURE_HEIGHT_PX = (SIGNATURE_WIDTH_PX * 923) / 1256;
export const SIGNATURE_BLOCK_HEIGHT =
  16 + SIGNATURE_HEIGHT_PX + 20;

interface SignatureFitInput {
  asideHeight: number;
  headerHeight: number;
  navHeight: number;
}

export function shouldShowSignature({
  asideHeight,
  headerHeight,
  navHeight,
}: SignatureFitInput): boolean {
  if (asideHeight < SIGNATURE_MIN_VIEWPORT_HEIGHT) return false;

  const available = asideHeight - headerHeight - navHeight;
  return available >= SIGNATURE_BLOCK_HEIGHT + SIGNATURE_MIN_GAP;
}

interface VendeoSignatureProps {
  asideRef: RefObject<HTMLElement | null>;
  headerRef: RefObject<HTMLElement | null>;
  navRef: RefObject<HTMLElement | null>;
}

export function VendeoSignature({
  asideRef,
  headerRef,
  navRef,
}: VendeoSignatureProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      setVisible(false);
      return;
    }

    const aside = asideRef.current;
    const header = headerRef.current;
    const nav = navRef.current;
    if (!aside || !header || !nav) return;

    const measure = () => {
      setVisible(
        shouldShowSignature({
          asideHeight: aside.clientHeight,
          headerHeight: header.offsetHeight,
          navHeight: nav.offsetHeight,
        }),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    observer.observe(header);
    observer.observe(nav);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [asideRef, headerRef, navRef]);

  return (
    <div
      data-signature-visible={visible ? "true" : "false"}
      aria-hidden="true"
      className={
        visible
          ? "mt-auto flex shrink-0 flex-col items-center px-4 pb-[20px] pt-[16px]"
          : "hidden"
      }
    >
      <img
        src="/brand/vendeo-signature.png"
        width={1256}
        height={923}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-auto select-none"
        style={{ width: SIGNATURE_WIDTH_PX }}
      />
    </div>
  );
}
