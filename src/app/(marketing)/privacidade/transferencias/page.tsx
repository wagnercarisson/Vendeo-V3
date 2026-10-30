import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LegalDocumentViewer } from "@/components/legal/legal-document-viewer";
import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo/indexation-policy";

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

export default function TransferenciasPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/privacidade"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-accent-blue hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para a Política de Privacidade
      </Link>
      <article className="prose prose-invert max-w-none">
        <h1>Anexo de Transferências Internacionais</h1>
        <p className="text-sm text-text-muted">
          Anexo da Política de Privacidade v1.4
        </p>
        <LegalDocumentViewer
          url="/docs/legal/international-transfers-annex.md"
          title="Anexo de Transferências Internacionais"
          version="Anexo da Política de Privacidade v1.4"
        />
      </article>
    </main>
  );
}
