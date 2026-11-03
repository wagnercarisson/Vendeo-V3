import Link from "next/link";

/**
 * Minimal public header for `/floriculturas`.
 *
 * Local on purpose: the home header is not extracted into a shared component in
 * this delivery (that refactor would touch the approved home). Same classes and
 * behaviour as the home header: logo link-free image plus the secondary "Entrar"
 * action.
 */
export function FloriculturasHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/vendeo-logo-dark.webp"
        alt="Vendeo"
        width={384}
        height={82}
        className="h-9 w-auto sm:h-11"
      />
      <Link
        href="/login"
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent-green hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
      >
        Entrar
      </Link>
    </header>
  );
}
