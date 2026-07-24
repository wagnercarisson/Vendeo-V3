import Link from "next/link";
import { Shield, ExternalLink, AlertTriangle } from "lucide-react";

interface LegalClearanceGateProps {
  returnTo?: string;
}

export function LegalClearanceGate({ returnTo = "/campanhas/nova" }: LegalClearanceGateProps) {
  const acceptUrl = `/legal/reaccept?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-border bg-bg-surface p-8 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-amber/10">
          <Shield className="h-8 w-8 text-accent-amber" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-bold text-text-primary">
            Aceitação necessária
          </h1>
          <p className="text-text-secondary leading-relaxed max-w-md mx-auto">
            Antes de gerar campanhas, você precisa ler e aceitar os Termos de Uso e a Política de Uso Aceitável.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/termos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent-blue underline hover:text-accent-blue/80"
          >
            Ler Termos de Uso <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <span className="hidden sm:inline text-text-muted text-sm">|</span>
          <Link
            href="/uso-aceitavel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent-blue underline hover:text-accent-blue/80"
          >
            Ler Política de Uso Aceitável <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Link
          href={acceptUrl}
          className="inline-block min-h-[44px] px-8 py-2.5 bg-accent-blue text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
        >
          Ler e aceitar termos
        </Link>
      </div>
    </main>
  );
}
