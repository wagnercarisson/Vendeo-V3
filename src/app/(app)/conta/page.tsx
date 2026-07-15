import Link from "next/link";
import { requirePageUser } from "@/lib/auth/require-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
import { User, Key, LogOut } from "lucide-react";

export default async function ContaPage() {
  const user = await requirePageUser();
  const email = user.claims.email || user.claims.sub?.slice(0, 8) || "—";

  return (
    <div>
      <PageHeader
        title="Conta"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Conta" },
        ]}
      />

      <div className="space-y-6 max-w-lg">
        <Card>
          <div className="p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary font-heading">
              <User className="h-5 w-5 text-accent-green" />
              Informações da Conta
            </h2>
            <div>
              <p className="text-sm text-text-muted font-body">Email</p>
              <p className="text-text-primary font-body">{email}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary font-heading">
              <Key className="h-5 w-5 text-accent-green" />
              Segurança
            </h2>
            <Link
              href="/update-password"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary font-body hover:bg-bg-elevated hover:text-text-primary transition-all duration-200"
            >
              Alterar senha
            </Link>
          </div>
        </Card>

        <Card>
          <div className="p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary font-heading">
              <LogOut className="h-5 w-5 text-accent-red" />
              Sessão
            </h2>
            <LogoutButton />
          </div>
        </Card>
      </div>
    </div>
  );
}
