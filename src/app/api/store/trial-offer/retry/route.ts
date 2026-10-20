import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { retryTrialOfferEnrollment } from "@/lib/credit/trial-offer/completion";

export const runtime = "nodejs";

/**
 * Retry dedicado: repete SOMENTE conclusão/inscrição do teste.
 * Não salva onboarding e não chama logo/perfil/assinatura/provider.
 */
export const POST = apiHandler(async (request: Request) => {
  requireSameOrigin(request);

  const user = await requireApiUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const trialOffer = await retryTrialOfferEnrollment(store.id);
  return NextResponse.json({ trialOffer });
});
