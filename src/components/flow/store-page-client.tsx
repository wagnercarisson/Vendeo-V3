"use client";

import type { Store } from "@/lib/store";
import { StoreIdentityForm } from "./store-identity-form";

export function StorePageClient({ initialStore }: { initialStore: Store | null }) {
  if (!initialStore) {
    return (
      <div className="space-y-8">
        <StoreIdentityForm />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StoreIdentityForm initialStore={initialStore} />
    </div>
  );
}
