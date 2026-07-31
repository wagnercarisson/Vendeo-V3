import { getCurrentVersion } from "@/lib/legal/document-versions";
import { getDocumentFile, getDocumentLabel } from "@/lib/legal/document-content";
import { LegalDocumentViewer } from "@/components/legal/legal-document-viewer";

export default async function TermosPage() {
  const version = await getCurrentVersion("terms_of_service");
  const docFile = version ? getDocumentFile("terms_of_service", version.version) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article className="prose prose-invert max-w-none">
        <h1>{getDocumentLabel("terms_of_service")}</h1>
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
            title={getDocumentLabel("terms_of_service")}
            version={version.version}
          />
        )}
      </article>
    </main>
  );
}
