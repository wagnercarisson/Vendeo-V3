import "server-only";

import {
  loadEligibleCampaignOverview,
  type EligibleCampaignOverview,
} from "./campaigns";
import { loadDashboardCreditState, type DashboardCreditState } from "./credits";

/**
 * Resultado discriminado por seção. Falhas são contidas na seção e nunca
 * propagam para a página (D-10 / RESEARCH Pattern 1).
 */
export type SectionResult<T> = { ok: true; data: T } | { ok: false };

export async function loadCampaignSection(
  storeId: string,
): Promise<SectionResult<EligibleCampaignOverview>> {
  try {
    const data = await loadEligibleCampaignOverview(storeId);
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function loadCreditSection(
  storeId: string,
): Promise<SectionResult<DashboardCreditState>> {
  try {
    const data = await loadDashboardCreditState(storeId);
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}
