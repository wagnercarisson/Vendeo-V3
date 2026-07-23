import Link from "next/link";
import { requirePageUser } from "@/lib/auth/require-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
import { BalanceCard } from "@/components/credit/balance-card";
import { TransactionHistory } from "@/components/credit/transaction-history";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { CreditService } from "@/lib/credit/credit-service";
import { createServerClient } from "@/lib/supabase/server";
import { LegalStatusSection } from "@/components/legal/legal-status-section";
import { User, Coins, Key, LogOut, MessageCircle, Shield } from "lucide-react";

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requirePageUser();
  const email = user.claims.email || user.claims.sub?.slice(0, 8) || "—";
  const sp = await searchParams;

  const supabase = await createServerClient();
  const creditService = new CreditService(supabase);
  const store = await getCurrentStore(user.userId);
  const supportEmail = process.env.SUPPORT_EMAIL;

  const LIMIT = 10;
  const page = Number(sp.page) || 1;
  const offset = (page - 1) * LIMIT;

  let balance = 0;
  let history: import("@/lib/credit/types").CreditTransaction[] = [];
  let totalItems = 0;
  let creditError = false;

  if (store) {
    try {
      [balance, history, totalItems] = await Promise.all([
        creditService.getBalance(store.id),
        creditService.getHistory(store.id, LIMIT, offset),
        creditService.countCreditTransactions(store.id),
      ]);
    } catch {
      creditError = true;
    }
  }

  const totalPages = Math.ceil(totalItems / LIMIT);

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
              <Coins className="h-5 w-5 text-accent-green" />
              Créditos
            </h2>
            {!store ? (
              <BalanceCard hasStore={false} />
            ) : creditError ? (
              <BalanceCard variant="error" />
            ) : (
              <>
                <BalanceCard
                  balance={balance}
                  hasStore={true}
                  supportEmail={supportEmail}
                />
                <TransactionHistory
                  transactions={history}
                  totalPages={totalPages}
                  currentPage={page}
                />
              </>
            )}
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

        <LegalStatusSection storeId={store?.id ?? null} />

        <Card>
          <div className="p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary font-heading">
              <MessageCircle className="h-5 w-5 text-accent-blue" />
              Suporte
            </h2>
            <p className="text-sm text-text-muted font-body">
              Em caso de dúvidas ou problemas, fale com o time do Vendeo.
            </p>
            <a
              href={`mailto:${supportEmail ?? "suporte@vendeo.tech"}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary font-body hover:bg-bg-elevated hover:text-text-primary transition-all duration-200"
            >
              Fale com o time
            </a>
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
