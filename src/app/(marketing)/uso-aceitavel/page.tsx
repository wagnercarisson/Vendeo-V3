import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentVersion } from "@/lib/legal/document-versions";
import { getDocumentFile, getDocumentLabel } from "@/lib/legal/document-content";
import { LegalDocumentViewer } from "@/components/legal/legal-document-viewer";

export default async function UsoAceitavelPage() {
  const version = await getCurrentVersion("acceptable_use");
  const docFile = version ? getDocumentFile("acceptable_use", version.version) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-accent-blue hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para solicitar acesso
      </Link>
      <article className="prose prose-invert max-w-none">
        <h1>{getDocumentLabel("acceptable_use")}</h1>
        {version && (
          <p className="text-sm text-text-muted">
            Versão {version.version}
            {version.effectiveAt && (
              <> &mdash; Efetivo em {new Date(version.effectiveAt).toLocaleDateString("pt-BR")}</>
            )}
            {version.summary && (
              <> &mdash; {version.summary}</>
            )}
          </p>
        )}

        {docFile && version && (
          <LegalDocumentViewer
            url={docFile}
            title={getDocumentLabel("acceptable_use")}
            version={version.version}
          />
        )}
      </article>
    </main>
  );
}
