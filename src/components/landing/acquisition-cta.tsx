"use client";

import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";

/**
 * Shared, flag-aware acquisition CTA consumed by the hero, transformação,
 * identidade and oferta blocks.
 *
 * The caller (a server component) reads `getLaunchConfig().publicSignupEnabled`
 * ONCE and passes it down. This component never reads env vars or flags itself,
 * and it never renders the secondary "Entrar" action (that belongs to the
 * header only — never duplicated here). Acquisition buttons use a consistent
 * min-height (48px, enforced locally with `!important` to override
 * GoogleButton's inline 44px), centered content and spacing; alignment is
 * explicit per instance via the `align` prop.
 *
 * D-19 contrast correction: the green primary surface uses DARK text
 * (`text-bg-deep` / `#020617`, ≈8.8:1). White-on-green would be ≈2.1:1 and is
 * forbidden. This is a LOCAL override; the shared `Button` (`variant="primary"`
 * hard-codes white text) and `openspec/design-system/MASTER.md §6.1` keep the
 * white-on-green guidance — recorded as a follow-up, NOT changed silently here.
 */
interface AcquisitionCtaProps {
  publicSignupEnabled: boolean;
  /**
   * Explicit per-instance alignment (no fragile selectors):
   * - "responsive" (default): centered on mobile, start/left on desktop.
   * - "center": centered on both mobile and desktop.
   */
  align?: "responsive" | "center";
}

export function AcquisitionCta({
  publicSignupEnabled,
  align = "responsive",
}: AcquisitionCtaProps) {
  const alignment =
    align === "center"
      ? "items-center justify-center"
      : "items-center justify-center sm:items-start sm:justify-start";

  return (
    <div
      data-public-signup-enabled={String(publicSignupEnabled)}
      className={`flex flex-col gap-3 ${alignment}`}
    >
      {publicSignupEnabled ? (
        <>
          <div className="w-full max-w-sm [&_button]:!min-h-[48px]">
            <GoogleButton variant="solid" fullWidth />
          </div>
          <Link
            href="/signup"
            className="inline-flex min-h-[48px] w-full max-w-sm items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
          >
            Continuar com email
          </Link>
        </>
      ) : (
        <a
          href="#acesso"
          className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-accent-green px-6 py-3 font-heading text-base font-semibold text-bg-deep transition-all hover:brightness-110 focus:ring-2 focus:ring-accent-green focus:outline-none"
        >
          Solicitar acesso free
        </a>
      )}
    </div>
  );
}
