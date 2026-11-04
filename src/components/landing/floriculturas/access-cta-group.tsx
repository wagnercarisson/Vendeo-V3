import Link from "next/link";
import { AcquisitionCta } from "@/components/landing/acquisition-cta";

/**
 * Access CTA group for `/floriculturas`.
 *
 * The composition is explicit per flag state — no broad descendant selectors.
 *
 * - Signup closed (current public state): primary green "Solicitar acesso free"
 *   and the secondary "Conheça o Vendeo" side by side on desktop (same 48px
 *   height), stacked full-width on mobile. This is the already approved layout.
 * - Signup enabled: Google and e-mail side by side on desktop (equal width, 48px
 *   height, comfortable gap), stacked on mobile; the institutional link sits
 *   below the pair, centered.
 *
 * The secondary link points to `/` in the same tab, without an anchor, so it
 * opens the top of the home. It never points to `/#acesso`.
 */
interface AccessCtaGroupProps {
  publicSignupEnabled: boolean;
  align?: "start" | "center";
}

export function AccessCtaGroup({
  publicSignupEnabled,
  align = "start",
}: AccessCtaGroupProps) {
  const justify = align === "center" ? "sm:justify-center" : "sm:justify-start";
  const ctaAlign = align === "center" ? "center" : "responsive";

  const institutionalLink = (
    <Link
      href="/"
      className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-border-light px-6 font-heading text-base font-semibold text-text-primary transition-colors hover:border-accent-green focus:ring-2 focus:ring-accent-blue focus:outline-none sm:w-auto"
    >
      Conheça o Vendeo
    </Link>
  );

  if (publicSignupEnabled) {
    return (
      <div data-access-cta-group data-signup-state="enabled" className="flex w-full flex-col gap-3">
        <AcquisitionCta
          publicSignupEnabled
          accessHref="/#acesso"
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
      data-signup-state="closed"
      className={`flex w-full flex-col gap-3 sm:flex-row sm:items-center ${justify}`}
    >
      <AcquisitionCta
        publicSignupEnabled={false}
        accessHref="/#acesso"
        align={ctaAlign}
        layout="inline"
      />
      {institutionalLink}
    </div>
  );
}
