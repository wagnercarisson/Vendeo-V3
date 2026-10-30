import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { getAllEntries } from "@/lib/changelog/get-changelog";
import { AppShell } from "@/components/shell/app-shell";
import { PrivacyRecovery } from "@/components/legal/privacy-recovery";
import { hasValidPrivacyAcknowledgement } from "@/lib/legal/privacy";
import { getCurrentVersion } from "@/lib/legal/document-versions";
import { buildDocumentInfo } from "@/lib/legal/document-content";
import { PrivacyGate } from "@/components/legal/privacy-gate";
import { es419Messages, ptBRMessages } from "@/lib/i18n";
import { getUiRenderContext } from "@/lib/i18n/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();
  const ui = await getUiRenderContext(user.userId);
  const locale = ui.ok ? ui.locale : "pt-BR";
  const store = await getCurrentStore(user.userId);
  const entries = await getAllEntries();
  const latestEntryId = entries[0]?.frontmatter.id ?? null;
  const acknowledged = await hasValidPrivacyAcknowledgement(user.userId);

  const privacyVersion = await getCurrentVersion("privacy_policy");
  const policyDocument = privacyVersion
    ? buildDocumentInfo("privacy_policy", privacyVersion.version)
    : null;

  return (
    <AppShell
      user={user}
      storeName={store?.name ?? null}
      latestChangelogEntryId={latestEntryId}
      locale={locale}
      commonMessages={ptBRMessages.common}
      shellMessages={ptBRMessages.shell}
      commonMessagesEs={locale === "es-419" ? es419Messages.common : undefined}
      shellMessagesEs={locale === "es-419" ? es419Messages.shell : undefined}
    >
      {children}
      <PrivacyRecovery />
      <PrivacyGate acknowledged={acknowledged} policyDocument={policyDocument} />
    </AppShell>
  );
}
