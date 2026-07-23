import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { getCurrentVersion, getVersionHistory } from "@/lib/legal/document-versions";
import { getAcceptanceStatus } from "@/lib/legal/acceptance-service";
import { ReacceptForm } from "./reaccept-form";

export default async function LegalReacceptPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

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

  const termsHistory = await getVersionHistory("terms_of_service");
  const aupHistory = await getVersionHistory("acceptable_use");

  const termsStatus = await getAcceptanceStatus(store.id, "terms_of_service");
  const aupStatus = await getAcceptanceStatus(store.id, "acceptable_use");

  const pendingDocs: Array<{
    documentType: "terms_of_service" | "acceptable_use";
    label: string;
    currentVersion: string;
    summary: string | null;
  }> = [];

  if (termsStatus === "outdated" && termsCurrent) {
    pendingDocs.push({
      documentType: "terms_of_service",
      label: "Termos de Uso",
      currentVersion: termsCurrent.version,
      summary: termsCurrent.summary,
    });
  }

  if (aupStatus === "outdated" && aupCurrent) {
    pendingDocs.push({
      documentType: "acceptable_use",
      label: "Política de Uso Aceitável",
      currentVersion: aupCurrent.version,
      summary: aupCurrent.summary,
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-heading font-bold text-text-primary mb-4">
        Documentos Legais
      </h1>

      {pendingDocs.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-surface p-6">
          <p className="text-accent-green font-heading font-semibold">
            Tudo em dia! Você está com a versão mais recente dos documentos legais.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-text-secondary">
            Os seguintes documentos foram atualizados. Aceite a nova versão para continuar utilizando os recursos de geração.
          </p>

          {pendingDocs.map((doc) => (
            <div
              key={doc.documentType}
              className="rounded-lg border border-border bg-bg-surface p-6 space-y-3"
            >
              <h2 className="font-heading font-semibold text-text-primary">
                {doc.label}
              </h2>
              <p className="text-sm text-text-muted">
                Nova versão: <strong>{doc.currentVersion}</strong>
              </p>
              {doc.summary && (
                <p className="text-sm text-text-secondary bg-bg-elevated rounded p-3">
                  {doc.summary}
                </p>
              )}
              <a
                href={`/${doc.documentType === "terms_of_service" ? "termos" : "uso-aceitavel"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-accent-blue underline hover:text-accent-blue/80"
              >
                Revisar documento completo
              </a>
            </div>
          ))}

          <ReacceptForm storeId={store.id} />
        </div>
      )}
    </main>
  );
}
