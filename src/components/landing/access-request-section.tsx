"use client";

import { useState } from "react";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { AccessRequestForm } from "./access-request-form";
import { NovidadesLink } from "./novidades-link";
import type { ChangelogEntry } from "@/lib/changelog/types";

export function AccessRequestSection({
  entries,
  publicSignupEnabled = false,
}: {
  entries: ChangelogEntry[];
  publicSignupEnabled?: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      {/* Hero */}
      <section
        className="mx-auto w-full max-w-5xl flex-1 px-6 pt-16 pb-12 text-center sm:pt-24"
        data-public-signup-enabled={String(publicSignupEnabled)}
      >
        <h1 className="mx-auto max-w-2xl font-heading text-3xl font-bold leading-tight sm:text-5xl">
          Vendeo
        </h1>
        <p className="mx-auto mt-3 font-heading text-base italic text-accent-green sm:text-lg">
          Postou, vendeo!
        </p>
        <p className="mx-auto mt-5 max-w-xl text-base text-text-secondary sm:text-lg">
          O Vendeo é uma plataforma de marketing para pequenos e médios lojistas.
          Com{" "}
          <span className="text-accent-green">
            inteligência artificial comercial
          </span>
          , transformamos a oferta da sua loja em campanhas profissionais para
          redes sociais — sem precisar de design, copywriting ou marketing.
        </p>

        {publicSignupEnabled ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-3">
            <div className="w-full max-w-sm">
              <GoogleButton variant="solid" fullWidth />
            </div>
            <Link
              href="/signup"
              className="inline-flex min-h-[44px] w-full max-w-sm items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
            >
              Continuar com email
            </Link>
            <p className="mt-1 text-xs text-text-muted">Leva 2 minutos</p>
          </div>
        ) : (
          <>
            <p className="mx-auto mt-3 max-w-md rounded-full border border-border-light bg-bg-surface px-4 py-1.5 text-xs font-medium text-accent-amber">
              Beta fechado — acesso liberado por convite. Solicite seu acesso free.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {!submitted && (
                <a
                  href="#acesso"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent-green px-6 py-3 font-heading text-base font-semibold text-white transition-all hover:brightness-110 focus:ring-2 focus:ring-accent-green focus:outline-none"
                >
                  Solicitar acesso free
                </a>
              )}
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
              >
                Entrar
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Form section — apenas flag off (lista de espera). Flag on → sem form. */}
      {!publicSignupEnabled ? (
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
          <div className="mt-4 flex justify-center">
            <NovidadesLink variant="prominent" entries={entries} />
          </div>
        </section>
      ) : (
        <div className="mx-auto w-full max-w-5xl px-6 pb-20">
          <div className="flex justify-center">
            <NovidadesLink variant="prominent" entries={entries} />
          </div>
        </div>
      )}
    </>
  );
}
