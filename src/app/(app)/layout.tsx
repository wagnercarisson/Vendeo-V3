import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { AppShell } from "@/components/shell/app-shell";
import { PrivacyRecovery } from "@/components/legal/privacy-recovery";
import { hasValidPrivacyAcknowledgement } from "@/lib/legal/privacy";
import { PrivacyGate } from "@/components/legal/privacy-gate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);
  const acknowledged = await hasValidPrivacyAcknowledgement(user.userId);

  return (
    <AppShell user={user} storeName={store?.name ?? null}>
      {children}
      <PrivacyRecovery />
      <PrivacyGate acknowledged={acknowledged} />
    </AppShell>
  );
}
