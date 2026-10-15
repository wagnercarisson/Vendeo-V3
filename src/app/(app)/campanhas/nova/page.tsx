import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { requireLegalClearance } from "@/lib/legal/clearance";
import { CreditService } from "@/lib/credit/credit-service";
import { createServerClient, supabaseAdmin } from "@/lib/supabase/server";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { CampaignPageClient } from "@/components/flow/campaign-page-client";
import { LegalClearanceGate } from "@/components/legal/legal-clearance-gate";
import { getStoreReadiness } from "@/lib/store-readiness";
import { resolveStoreIdentity, validateIdentityReference } from "@/lib/store-identity-service";
import { resolveProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-service";
import { resolveEligibilityContext } from "@/lib/product-1-1/submission/eligibility-context";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { readProductOneToOneBackgroundDirection } from "@/lib/product-1-1/snapshot/persist-snapshot";
import { getCampaignForDisplay, mapRestoredForm } from "@/lib/campaign/display";
import type { CampaignFormRestore } from "@/lib/campaign/display";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";

interface NovaCampanhaPageProps {
  searchParams?: Promise<{ restoreFrom?: string | string[] }>;
}

export default async function NovaCampanhaPage({ searchParams }: NovaCampanhaPageProps = {}) {
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

  // F56.2b1b (B1B-D1): a elegibilidade do novo fluxo Produto 1:1 é decidida
  // SOMENTE no servidor (flags válidas + flag aplicável + autorização vigente),
  // fail-closed: qualquer exceção de leitura ⇒ `eligible=false`. O cliente
  // recebe apenas o booleano e nunca declara elegibilidade.
  let eligible = false;
  try {
    const decision = await resolveProductFlowAuthorization(resolveEligibilityContext(store));
    eligible = decision.allowed === true;
  } catch (err) {
    console.error(`[nova] resolveProductFlowAuthorization error — ${err instanceof Error ? err.message : String(err)}`);
    eligible = false;
  }

  // F56.2b2b (C4 / B2B-D9) — TRANSPORTE AUTENTICADO COM OWNERSHIP da origem. A
  // CTA do `RefundedPanel` navega para `/campanhas/nova?restoreFrom=<campaignId>`.
  // O snapshot é resolvido SERVER-SIDE REUSANDO os helpers já usados por
  // `campanhas/[id]/page.tsx` (`requirePageUser` + `getCurrentStore` +
  // `getCampaignForDisplay`) com ownership verificado (`campaign.store_id ===
  // store.id`) — SEM módulo novo. FAIL-CLOSED: origem ausente/não-possuída/
  // indisponível ⇒ `null` (sem promessa falsa). O CLIENTE NUNCA fornece o snapshot;
  // NUNCA inicia geração/cobrança.
  let restoredForm: CampaignFormRestore | null = null;
  if (searchParams) {
    const resolved = await searchParams;
    const restoreFrom =
      typeof resolved?.restoreFrom === "string" ? resolved.restoreFrom : null;
    if (restoreFrom) {
      try {
        const campaign = await getCampaignForDisplay(restoreFrom);
        if (campaign && campaign.store_id === store.id) {
          // P1 — a direção de fundo vive na EVIDÊNCIA CONGELADA. O `operationId` é
          // resolvido SERVER-SIDE a partir da operação PERSISTIDA da campanha-origem
          // (`getCampaignOperation`) — NUNCA aceito do cliente. Ausência/erro ⇒
          // `null` (fail-closed ⇒ o formulário exige escolha explícita; NUNCA
          // `studio` silencioso).
          let backgroundDirection: Awaited<
            ReturnType<typeof readProductOneToOneBackgroundDirection>
          > = null;
          try {
            const operation = await new ProductOneToOneAttemptStartClient().getCampaignOperation(
              restoreFrom,
            );
            if (operation) {
              backgroundDirection = await readProductOneToOneBackgroundDirection(supabaseAdmin, {
                campaignId: restoreFrom,
                operationId: operation.operationId,
              });
            }
          } catch {
            backgroundDirection = null;
          }
          restoredForm = mapRestoredForm({
            campaignId: campaign.id,
            inputSnapshot: campaign.input_snapshot,
            identitySnapshot: campaign.identity_snapshot,
            backgroundDirection,
          });
        }
      } catch (err) {
        console.error(`[nova] restoredForm resolve error — ${err instanceof Error ? err.message : String(err)}`);
        restoredForm = null;
      }
    }
  }

  return (
    <main>
      <CampaignPageClient store={store} balance={balance} supportEmail={supportEmail} generationPaused={generationPaused} identity={identity} eligible={eligible} restoredForm={restoredForm} />
    </main>
  );
}
