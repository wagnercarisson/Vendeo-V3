import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { ForbiddenError } from "@/lib/auth/errors";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <nav className="flex gap-4 border-b pb-3 text-sm">
        <Link href="/admin" className="font-medium hover:text-primary">
          Dashboard
        </Link>
        <Link href="/admin/users" className="font-medium hover:text-primary">
          Usuários
        </Link>
        <Link href="/admin/campaigns/errors" className="font-medium hover:text-primary">
          Erros
        </Link>
        <Link href="/admin/audit-log" className="font-medium hover:text-primary">
          Audit Log
        </Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
