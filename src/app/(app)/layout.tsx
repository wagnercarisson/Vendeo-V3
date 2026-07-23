import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { AppShell } from "@/components/shell/app-shell";
import { PrivacyRecovery } from "@/components/legal/privacy-recovery";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  return (
    <AppShell user={user} storeName={store?.name ?? null}>
      {children}
      <PrivacyRecovery />
    </AppShell>
  );
}
