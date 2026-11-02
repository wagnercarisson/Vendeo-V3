import "server-only";

import { CreditService } from "@/lib/credit/credit-service";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Estado de crédito da composição do dashboard.
 *
 * `unavailable` representa falha de leitura e NUNCA carrega o valor zero: o
 * dashboard distingue explicitamente saldo zero de saldo indisponível (D-04).
 */
export type DashboardCreditState =
  | { state: "available"; availableBalance: number }
  | { state: "zero"; availableBalance: 0 }
  | { state: "unavailable" };

/**
 * Lê o saldo disponível usando a regra canônica do `CreditService`, com
 * `throwOnError` para tornar a falha detectável. Qualquer rejeição vira
 * `{ state: "unavailable" }`, sem logar valores ou detalhes internos (T-58-03).
 */
export async function loadDashboardCreditState(
  storeId: string,
): Promise<DashboardCreditState> {
  try {
    const supabase = await createServerClient();
    const breakdown = await new CreditService(supabase).getBalanceBreakdown(
      storeId,
      { throwOnError: true },
    );

    if (breakdown.availableBalance > 0) {
      return { state: "available", availableBalance: breakdown.availableBalance };
    }

    return { state: "zero", availableBalance: 0 };
  } catch {
    return { state: "unavailable" };
  }
}
