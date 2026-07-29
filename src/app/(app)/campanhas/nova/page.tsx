import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { requireLegalClearance } from "@/lib/legal/clearance";
import { CreditService } from "@/lib/credit/credit-service";
import { createServerClient } from "@/lib/supabase/server";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { CampaignPageClient } from "@/components/flow/campaign-page-client";
import { LegalClearanceGate } from "@/components/legal/legal-clearance-gate";
import { getStoreReadiness } from "@/lib/store-readiness";

export default async function NovaCampanhaPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/loja");
  }

  const readiness = await getStoreReadiness(store.id);
  if (!readiness.ready) {
    const firstMissing = readiness.missing[0].item;
    if (firstMissing === "cadastro_fiscal") {
      redirect(`/cadastro/cnpj?returnTo=/campanhas/nova`);
    } else {
      redirect(`/loja?required=visual-direction&message=needs-visual-direction`);
    }
  }

  const clearance = await requireLegalClearance({
    storeId: store.id,
    userId: user.userId,
    capability: "content_generation",
  });

  if (!clearance.ok) {
    return <LegalClearanceGate returnTo="/campanhas/nova" />;
  }

  const supabase = await createServerClient();
  const creditService = new CreditService(supabase);
  const supportEmail = process.env.SUPPORT_EMAIL;
  const { generationPaused } = getLaunchConfig();

  let balance: number | null = null;
  try {
    balance = await creditService.getBalance(store.id);
  } catch {
    balance = null;
  }

  return (
    <main>
      <CampaignPageClient store={store} balance={balance} supportEmail={supportEmail} generationPaused={generationPaused} />
    </main>
  );
}
