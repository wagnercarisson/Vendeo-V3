"use client";

import { useSearchParams } from "next/navigation";
import type { Store } from "@/lib/store";
import { StoreIdentityForm } from "./store-identity-form";

export function StorePageClient({ initialStore }: { initialStore: Store | null }) {
  const searchParams = useSearchParams();
  const required = searchParams.get("required");
  const initialStep = required === "visual-direction" ? 2 : undefined;

  if (!initialStore) {
    return (
      <div className="space-y-8">
        <StoreIdentityForm initialStep={initialStep} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StoreIdentityForm initialStore={initialStore} initialStep={initialStep} />
    </div>
  );
}
