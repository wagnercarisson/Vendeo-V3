import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { getAllEntries } from "@/lib/changelog/get-changelog";
import { AppShell } from "@/components/shell/app-shell";
import { PrivacyRecovery } from "@/components/legal/privacy-recovery";
import { hasValidPrivacyAcknowledgement } from "@/lib/legal/privacy";
import { getCurrentVersion } from "@/lib/legal/document-versions";
import { buildDocumentInfo } from "@/lib/legal/document-content";
import { PrivacyGate } from "@/components/legal/privacy-gate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();
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
    >
      {children}
      <PrivacyRecovery />
      <PrivacyGate acknowledged={acknowledged} policyDocument={policyDocument} />
    </AppShell>
  );
}
