"use client";

import { useState } from "react";
import { AccessRequestForm } from "./access-request-form";

/**
 * Flag-gated `#acesso` form section (reduced to ONLY the form card).
 *
 * - Flag off: renders the waitlist form card with `AccessRequestForm` and the
 *   preserved success state ("Solicitação enviada").
 * - Flag on: returns `null` — the acquisition paths live in the hero/offer/
 *   final CTA blocks (shared `AcquisitionCta`).
 *
 * The "Novidades" modal is owned by the footer in `page.tsx`; this section no
 * longer receives or renders changelog data. The `POST /api/access-requests`
 * contract and the form behavior are preserved.
 */
export function AccessRequestSection({
  publicSignupEnabled = false,
}: {
  publicSignupEnabled?: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);

  if (publicSignupEnabled) {
    return null;
  }

  return (
    <section id="acesso" className="mx-auto w-full max-w-5xl px-6 pb-20">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-bg-surface p-8">
        {submitted ? (
          <div role="status" className="text-center">
            <h2 className="font-heading text-xl font-semibold">
              Solicitação enviada
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Recebemos sua solicitação. A liberação é por convite — vamos
              analisar seu pedido. Em breve entraremos em contato.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-center font-heading text-xl font-semibold">
              Solicite seu acesso free
            </h2>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Deixe seu email e conte um pouco sobre sua loja. A liberação é por
              convite.
            </p>
            <div className="mt-6">
              <AccessRequestForm onSuccess={() => setSubmitted(true)} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
