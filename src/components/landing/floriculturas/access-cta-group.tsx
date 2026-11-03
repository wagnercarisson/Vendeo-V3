import Link from "next/link";
import { AcquisitionCta } from "@/components/landing/acquisition-cta";

/**
 * Access CTA group for `/floriculturas`.
 *
 * Groups the primary acquisition CTA with the secondary "Conheça o Vendeo" link:
 * side by side on desktop (same height, primary keeps the green surface and the
 * secondary gets a bordered, high-contrast treatment), stacked full-width on
 * mobile. The same group is used at the opening and at the closing.
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

  return (
    <div
      data-access-cta-group
      className={`flex w-full flex-col gap-3 sm:flex-row sm:items-center ${justify} [&_a]:w-full sm:[&_a]:w-auto`}
    >
      <div className="w-full sm:w-auto">
        <AcquisitionCta
          publicSignupEnabled={publicSignupEnabled}
          accessHref="/#acesso"
          align={ctaAlign}
        />
      </div>
      <Link
        href="/"
        className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-border-light px-6 font-heading text-base font-semibold text-text-primary transition-colors hover:border-accent-green focus:ring-2 focus:ring-accent-blue focus:outline-none sm:w-auto"
      >
        Conheça o Vendeo
      </Link>
    </div>
  );
}
