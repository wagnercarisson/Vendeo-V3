import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireApiUser } from "@/lib/auth/require-user";
import {
  OperationCostService,
  OperationCostUnavailableError,
} from "@/lib/credit/operation-cost-service";
import { OPERATION_KEYS } from "@/lib/credit/types";

export const GET = apiHandler(async () => {
  await requireApiUser();

  try {
    const service = new OperationCostService();
    const entries = await Promise.all(
      OPERATION_KEYS.map(async (key) => {
        const r = await service.getCost(key);
        return [key, { costCredits: r.costCredits, enabled: r.enabled }] as const;
      }),
    );
    return NextResponse.json(Object.fromEntries(entries));
  } catch (err) {
    if (err instanceof OperationCostUnavailableError) {
      return NextResponse.json(
        {
          error: "operation_cost_unavailable",
          message:
            "Serviço indisponível no momento. Tente novamente em alguns instantes.",
        },
        { status: 503 },
      );
    }
    throw err;
  }
});
