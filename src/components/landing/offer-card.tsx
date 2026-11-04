import type { ReactNode } from "react";
import { PUBLIC_ACCESS_COPY, PUBLIC_OFFER_COPY } from "./public-offer-copy";

/**
 * Card compartilhado de oferta e acesso.
 *
 * A mesma fonte de textos (`public-offer-copy.ts`) alimenta as duas variantes:
 * - `full`: home, com título próprio e o conjunto de acesso empilhado atual;
 * - `compact`: único card de `/floriculturas`, no encerramento, com o conjunto
 *   de acesso real e ID estável de âncora.
 *
 * O card não lê flag, env ou rede: recebe `publicSignupEnabled` do consumidor,
 * que já leu `getLaunchConfig()` server-side. O conjunto de acesso entra por
 * `children` para não duplicar botões nem composições.
 *
 * Sem IDs no expansível: `<details>/<summary>` nativo não precisa de ID. O único
 * ID opcional é o `headingId` do card completo ou o `id` de destino de âncora.
 */
interface OfferCardProps {
  variant?: "full" | "compact";
  publicSignupEnabled: boolean;
  /** Só a variante completa usa título e, portanto, um ID de heading. */
  headingId?: string;
  /** ID estável do card, usado como destino de âncora na página. */
  id?: string;
  /** Alinhamento interno da variante compacta. */
  align?: "start" | "center";
  /** Conjunto de acesso (AcquisitionCta ou AccessCtaGroup). */
  children: ReactNode;
}

export function OfferCard({
  variant = "full",
  publicSignupEnabled,
  headingId,
  id,
  align = "start",
  children,
}: OfferCardProps) {
  const isFull = variant === "full";
  const centered = align === "center";
  const cardClass = isFull
    ? "rounded-2xl border border-border bg-bg-deep p-6 sm:p-8"
    : "rounded-2xl border border-border bg-bg-deep p-5 sm:p-6";
  const centeredClass = centered ? "text-center" : "";
  const anchorClass = id
    ? "scroll-mt-24 focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:outline-none"
    : "";

  return (
    <div
      id={id}
      tabIndex={id ? -1 : undefined}
      data-offer-card={variant}
      data-offer-state={publicSignupEnabled ? "enabled" : "closed"}
      className={`${cardClass} ${centeredClass} ${anchorClass}`}
    >
      {isFull ? (
        <h2
          id={headingId}
          className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
        >
          {PUBLIC_OFFER_COPY.heading}
        </h2>
      ) : null}

      <p
        className={
          isFull
            ? `mt-3 max-w-xl font-heading text-lg font-semibold text-text-secondary sm:text-xl ${centered ? "mx-auto" : ""}`
            : "font-heading text-lg font-semibold text-text-primary"
        }
      >
        {PUBLIC_OFFER_COPY.summary}
      </p>

      <p
        className={`mt-2 max-w-xl text-sm text-text-secondary ${
          centered ? "mx-auto" : ""
        }`}
      >
        {PUBLIC_OFFER_COPY.complement}
      </p>

      <div className={isFull ? "mt-6" : "mt-5"}>{children}</div>

      {!publicSignupEnabled ? (
        <p
          data-offer-closed-support
          className={`mt-3 max-w-xl text-sm text-text-secondary ${
            isFull || centered ? "mx-auto text-center" : ""
          }`}
        >
          {PUBLIC_ACCESS_COPY.closedSupport}
        </p>
      ) : null}

      <details
        data-offer-mechanics
        className={`mt-6 rounded-lg border border-border bg-bg-surface/40 p-4 text-sm text-text-secondary ${
          centered ? "text-left" : ""
        }`}
      >
        <summary className="flex min-h-[44px] cursor-pointer items-center rounded font-medium text-text-secondary focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:outline-none">
          {PUBLIC_OFFER_COPY.detailsLabel}
        </summary>
        <div className="mt-3 space-y-2">
          <p>{PUBLIC_OFFER_COPY.conditions.start}</p>
          <p>{PUBLIC_OFFER_COPY.conditions.installments}</p>
          <p>{PUBLIC_OFFER_COPY.conditions.accumulation}</p>
          {!publicSignupEnabled ? (
            <p>{PUBLIC_OFFER_COPY.closedDetailsNote}</p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
