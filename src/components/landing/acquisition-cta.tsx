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
   * Destination of the closed-beta "Solicitar acesso free" action. Defaults to
   * the home anchor `#acesso`, preserving every existing consumer. Standalone
   * public pages (e.g. `/floriculturas`) pass `/#acesso`, since the anchor only
   * exists on the home.
   */
  accessHref?: string;
  /**
   * Explicit per-instance alignment (no fragile selectors):
   * - "responsive" (default): centered on mobile, start/left on desktop.
   * - "center": centered on both mobile and desktop.
   */
  align?: "responsive" | "center";
  /**
   * Composition of the acquisition actions:
   * - "stacked" (default): current behaviour — actions stacked vertically with
   *   `max-w-sm` wrappers. Preserved for every existing consumer (home included).
   * - "inline": Google and e-mail side by side on desktop with equal width and
   *   48px height, stacked with full width on mobile. Used by the `/floriculturas`
   *   access group, which composes the secondary institutional link explicitly.
   */
  layout?: "stacked" | "inline";
}

export function AcquisitionCta({
  publicSignupEnabled,
  accessHref = "#acesso",
  align = "responsive",
  layout = "stacked",
}: AcquisitionCtaProps) {
  const alignment =
    align === "center"
      ? "items-center justify-center"
      : "items-center justify-center sm:items-start sm:justify-start";

  const inline = layout === "inline";
  const containerClass = !inline
    ? `flex flex-col gap-3 ${alignment}`
    : publicSignupEnabled
      ? "grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
      : `flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center ${
          align === "center" ? "sm:justify-center" : "sm:justify-start"
        }`;

  return (
    <div
      data-public-signup-enabled={String(publicSignupEnabled)}
      data-acquisition-layout={layout}
      className={containerClass}
    >
      {publicSignupEnabled ? (
        <>
          <div
            className={
              inline
                ? "w-full [&_button]:!min-h-[48px]"
                : "w-full max-w-sm [&_button]:!min-h-[48px]"
            }
          >
            <GoogleButton variant="solid" fullWidth />
          </div>
          <Link
            href="/signup"
            className={
              inline
                ? "inline-flex h-12 w-full items-center justify-center rounded-lg border border-border px-6 text-sm font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
                : "inline-flex min-h-[48px] w-full max-w-sm items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
            }
          >
            Continuar com email
          </Link>
        </>
      ) : (
        <a
          href={accessHref}
          className={`inline-flex min-h-[48px] items-center justify-center rounded-lg bg-accent-green px-6 py-3 font-heading text-base font-semibold text-bg-deep transition-all hover:brightness-110 focus:ring-2 focus:ring-accent-green focus:outline-none ${
            inline ? "w-full sm:w-auto" : ""
          }`}
        >
          Solicitar acesso free
        </a>
      )}
    </div>
  );
}
