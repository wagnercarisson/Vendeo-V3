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
import { resolveStoreIdentity, validateIdentityReference } from "@/lib/store-identity-service";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";

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
      redirect(`/loja?tab=dados&fiscal=pending&returnTo=${encodeURIComponent("/campanhas/nova")}`);
    } else {
      redirect(`/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=${encodeURIComponent("/campanhas/nova")}`);
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

  // F43 (D4/decisão 2026-08-21): snapshot real de identidade resolvido no server
  // page (mesma fonte canônica da rota de geração — precedente route.ts:270/280).
  // Falha na resolução → identity null (StoreIdentityBlock não renderiza; sem
  // fallback visual divergente entre o que o usuário viu e o que a geração usou).
  let identity: StoreIdentitySnapshot | null = null;
  try {
    const snapshot = await resolveStoreIdentity(store);
    identity = await validateIdentityReference(snapshot);
  } catch (err) {
    console.error(`[nova] resolveStoreIdentity error — ${err instanceof Error ? err.message : String(err)}`);
  }

  return (
    <main>
      <CampaignPageClient store={store} balance={balance} supportEmail={supportEmail} generationPaused={generationPaused} identity={identity} />
    </main>
  );
}
