import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentVersion } from "@/lib/legal/document-versions";
import { getDocumentFile, getDocumentLabel } from "@/lib/legal/document-content";
import { LegalDocumentViewer } from "@/components/legal/legal-document-viewer";

export default async function PrivacidadePage() {
  const version = await getCurrentVersion("privacy_policy");
  const docFile = version ? getDocumentFile("privacy_policy", version.version) : null;

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
        <h1>{getDocumentLabel("privacy_policy")}</h1>
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
            title={getDocumentLabel("privacy_policy")}
            version={version.version}
          />
        )}
      </article>
    </main>
  );
}
