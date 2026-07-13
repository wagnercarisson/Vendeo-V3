import { requirePageUser } from "@/lib/auth/require-user";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();

  return <AppShell user={user}>{children}</AppShell>;
}
