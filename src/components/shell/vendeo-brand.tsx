import Link from "next/link";

type VendeoBrandVariant = "logo" | "symbol";

interface VendeoBrandLinkProps {
  variant: VendeoBrandVariant;
  onNavigate?: () => void;
  className?: string;
}

const BRAND_LABEL = "Vendeo — ir para o dashboard";

export function VendeoBrandLink({
  variant,
  onNavigate,
  className = "",
}: VendeoBrandLinkProps) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      aria-label={BRAND_LABEL}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface ${className}`}
    >
      {variant === "logo" ? (
        <img
          src="/landing/vendeo-logo-dark.webp"
          width={384}
          height={82}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-8 w-auto max-w-[168px]"
        />
      ) : (
        <img
          src="/icons/icon-512x512.png"
          width={512}
          height={512}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-9 w-9"
        />
      )}
    </Link>
  );
}
