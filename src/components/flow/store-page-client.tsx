"use client";

import { useSearchParams } from "next/navigation";
import type { Store } from "@/lib/store";
import { isOnboardingTab } from "@/lib/store-onboarding/tabs";
import type { OnboardingTab } from "@/lib/store-onboarding/tabs";
import { StoreIdentityForm } from "./store-identity-form";

export function StorePageClient({ initialStore, userId }: { initialStore: Store | null; userId: string }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const required = searchParams.get("required");
  const message = searchParams.get("message");
  const fiscal = searchParams.get("fiscal");

  // initialTab é resolvido APENAS na montagem (deep-link). A sincronização de
  // back/forward (?tab= → aba) é responsabilidade do hook useOnboardingTabs
  // (36-03, via popstate) — NÃO re-implementar parsing de URL aqui (D6).
  //
  // Compat `required=` — mantido apenas na F36 como transição (D6/D12).
  const initialTab: OnboardingTab = tab && isOnboardingTab(tab)
    ? tab
    : required === "visual-direction"
      ? "direcao-visual"
      : required === "cadastro-fiscal"
        ? "dados"
        : "dados";

  // fiscal=pending → banner de fiscal pendente na aba Dados (D12).
  const fiscalPending = fiscal === "pending";

  // storeId NUNCA vem de localStorage("store_id") (F36-IDENTITY-UI-05) —
  // vem de initialStore/estado local.
  return (
    <div className="space-y-8">
      <StoreIdentityForm
        initialStore={initialStore}
        userId={userId}
        initialTab={initialTab}
        redirectMessage={message ?? undefined}
        fiscalPending={fiscalPending}
      />
    </div>
  );
}
