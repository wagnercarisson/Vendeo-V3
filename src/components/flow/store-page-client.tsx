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

  // O banner de "Fiscal pendente" é derivado do readiness vivo dentro do
  // StoreIdentityForm (cadastro_fiscal em missing) — não do param fiscal=.
  return (
    <div className="space-y-8">
      <StoreIdentityForm
        initialStore={initialStore}
        userId={userId}
        initialTab={initialTab}
        redirectMessage={message ?? undefined}
      />
    </div>
  );
}
