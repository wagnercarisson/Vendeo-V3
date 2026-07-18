import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { CreditService } from "@/lib/credit/credit-service";
import { createServerClient } from "@/lib/supabase/server";
import { CampaignPageClient } from "@/components/flow/campaign-page-client";

export default async function NovaCampanhaPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/loja");
  }

  const supabase = await createServerClient();
  const creditService = new CreditService(supabase);
  const supportEmail = process.env.SUPPORT_EMAIL;

  let balance: number | null = null;
  try {
    balance = await creditService.getBalance(store.id);
  } catch {
    balance = null;
  }

  return (
    <main>
      <CampaignPageClient store={store} balance={balance} supportEmail={supportEmail} />
    </main>
  );
}
