import { getCurrentVersion } from "@/lib/legal/document-versions";
import { getDocumentFile, getDocumentLabel } from "@/lib/legal/document-content";
import { LegalDocumentViewer } from "@/components/legal/legal-document-viewer";

export default async function UsoAceitavelPage() {
  const version = await getCurrentVersion("acceptable_use");
  const docFile = version ? getDocumentFile("acceptable_use", version.version) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
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

        <blockquote>
          <p>
            <strong>Aviso importante:</strong> Este documento é um draft preparado pelo time do Vendeo para
            revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar.
          </p>
        </blockquote>

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
