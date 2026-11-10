import Link from "next/link";
import { AcquisitionCta } from "@/components/landing/acquisition-cta";
import { PUBLIC_ACCESS_COPY } from "@/components/landing/public-offer-copy";

/**
 * Access CTA group for `/ofertas-para-mercados`.
 *
 * Mirrors the approved public-page composition without importing another
 * segment's group:
 *
 * - Signup closed: primary green "Solicitar acesso gratuito" and the secondary
 *   "Conheça o Vendeo" side by side on desktop, stacked full-width on mobile.
 * - Signup enabled: Google and e-mail side by side on desktop (equal width,
 *   48px height), stacked on mobile; the institutional link sits below the pair,
 *   centered.
 *
 * The opening preview turns every acquisition action into a local anchor to the
 * closing card. The closing card omits `anchorHref`, so the real actions apply.
 */
interface AccessCtaGroupProps {
  publicSignupEnabled: boolean;
  align?: "start" | "center";
  /** Opening preview on the page: acquisition actions become local anchors. */
  anchorHref?: string;
}

export function AccessCtaGroup({
  publicSignupEnabled,
  align = "start",
  anchorHref,
}: AccessCtaGroupProps) {
  const justify = align === "center" ? "sm:justify-center" : "sm:justify-start";
  const ctaAlign = align === "center" ? "center" : "responsive";
  const mode = anchorHref ? "anchor" : "real";

  const institutionalLink = (
    <Link
      href="/"
      className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-border-light px-6 font-heading text-base font-semibold text-text-primary transition-colors hover:border-accent-green focus:ring-2 focus:ring-accent-blue focus:outline-none sm:w-auto"
    >
      {PUBLIC_ACCESS_COPY.institutional}
    </Link>
  );

  if (publicSignupEnabled) {
    return (
      <div
        data-access-cta-group
        data-access-mode={mode}
        data-signup-state="enabled"
        className="flex w-full flex-col gap-3"
      >
        <AcquisitionCta
          publicSignupEnabled
          accessHref="/#acesso"
          localHref={anchorHref}
          align={ctaAlign}
          layout="inline"
        />
        <div className="flex w-full justify-center">{institutionalLink}</div>
      </div>
    );
  }

  return (
    <div
      data-access-cta-group
      data-access-mode={mode}
      data-signup-state="closed"
      className={`flex w-full flex-col gap-3 sm:flex-row sm:items-center ${justify}`}
    >
      <AcquisitionCta
        publicSignupEnabled={false}
        accessHref="/#acesso"
        localHref={anchorHref}
        align={ctaAlign}
        layout="inline"
      />
      {institutionalLink}
    </div>
  );
}
