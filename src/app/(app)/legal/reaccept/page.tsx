import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { getCurrentVersion } from "@/lib/legal/document-versions";
import { getAcceptanceStatus } from "@/lib/legal/acceptance-service";
import { getDocumentFile, getDocumentLabel, getDocumentRoute } from "@/lib/legal/document-content";
import type { DocumentType } from "@/lib/legal/types";
import { ReacceptForm } from "./reaccept-form";

export default async function LegalReacceptPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);
  const sp = await searchParams;
  const returnTo = sp.returnTo ?? "/dashboard";

  if (!store) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-heading font-bold text-text-primary mb-4">
          Documentos Legais
        </h1>
        <p className="text-text-secondary">
          Crie uma loja para aceitar os documentos legais.
        </p>
      </main>
    );
  }

  const termsCurrent = await getCurrentVersion("terms_of_service");
  const aupCurrent = await getCurrentVersion("acceptable_use");

  const termsStatus = await getAcceptanceStatus(store.id, "terms_of_service");
  const aupStatus = await getAcceptanceStatus(store.id, "acceptable_use");

  const pendingDocs: Array<{
    documentType: "terms_of_service" | "acceptable_use";
    label: string;
    currentVersion: string;
    summary: string | null;
    isFirstAcceptance: boolean;
    needsAcceptance: boolean;
  }> = [];

  if (termsCurrent) {
    const needsAcceptance = termsStatus === "outdated" || termsStatus === "never";
    pendingDocs.push({
      documentType: "terms_of_service",
      label: getDocumentLabel("terms_of_service"),
      currentVersion: termsCurrent.version,
      summary: termsCurrent.summary,
      isFirstAcceptance: termsStatus === "never",
      needsAcceptance,
    });
  }

  if (aupCurrent) {
    const needsAcceptance = aupStatus === "outdated" || aupStatus === "never";
    pendingDocs.push({
      documentType: "acceptable_use",
      label: getDocumentLabel("acceptable_use"),
      currentVersion: aupCurrent.version,
      summary: aupCurrent.summary,
      isFirstAcceptance: aupStatus === "never",
      needsAcceptance,
    });
  }

  const hasPending = pendingDocs.some((d) => d.needsAcceptance);
  const isFirstTime = pendingDocs.every((d) => d.isFirstAcceptance);

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-heading font-bold text-text-primary mb-4">
        Documentos Legais
      </h1>

      {!hasPending ? (
        <div className="rounded-lg border border-border bg-bg-surface p-6">
          <p className="text-accent-green font-heading font-semibold">
            Tudo em dia! Você está com a versão mais recente dos documentos legais.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-text-secondary">
            {isFirstTime
              ? "Para utilizar os recursos de geração, leia e aceite os documentos abaixo."
              : "Os seguintes documentos foram atualizados. Aceite a nova versão para continuar utilizando os recursos de geração."}
          </p>

          {pendingDocs.map((doc) => (
            <div
              key={doc.documentType}
              className={`rounded-lg border p-6 space-y-3 ${
                doc.needsAcceptance
                  ? "border-border bg-bg-surface"
                  : "border-border-light bg-bg-elevated/50"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-heading font-semibold text-text-primary">
                  {doc.label}
                </h2>
                {!doc.needsAcceptance && (
                  <span className="shrink-0 text-xs text-accent-green font-heading font-semibold">
                    ✓ Vigente
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted">
                {doc.needsAcceptance
                  ? (doc.isFirstAcceptance ? "Versão atual:" : "Nova versão:")
                  : "Versão vigente:"} <strong>{doc.currentVersion}</strong>
              </p>
              {doc.summary && (
                <p className="text-sm text-text-secondary bg-bg-elevated rounded p-3">
                  {doc.summary}
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <a
                  href={getDocumentRoute(doc.documentType)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-accent-blue underline hover:text-accent-blue/80"
                >
                  Revisar {doc.label} completo
                </a>
                {(() => {
                  const file = getDocumentFile(doc.documentType, doc.currentVersion);
                  return file ? (
                    <a
                      href={file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-text-muted underline hover:text-text-secondary"
                    >
                      Documento de referência ({doc.currentVersion})
                    </a>
                  ) : null;
                })()}
              </div>
            </div>
          ))}

          <ReacceptForm storeId={store.id} returnTo={returnTo} isFirstTime={isFirstTime} />
        </div>
      )}
    </main>
  );
}
