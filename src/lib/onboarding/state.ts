import "server-only";

import { getCurrentStore } from "@/lib/auth/store-ownership";
import { countCampaigns } from "@/lib/onboarding/count";
import type { OnboardingState } from "@/lib/onboarding/types";

export async function getUserOnboardingState(
  userId: string,
): Promise<OnboardingState> {
  const store = await getCurrentStore(userId);

  if (!store) return "no_store";

  const total = await countCampaigns(store.id);

  if (total === 0) return "has_store_no_campaigns";

  return "has_store_with_campaigns";
}
