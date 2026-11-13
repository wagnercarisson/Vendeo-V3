import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getLaunchConfig } from "@/lib/launch-config/config";
import {
  readSquareBaseFrozenState,
} from "@/lib/campaign/square-base/frozen-state";
import type { FrozenContentPayload } from "@/lib/campaign/square-base/types";
import type { DefaultProductOneToOneCopyRunnerInput } from "@/lib/product-1-1/copy/default-copy-runner";
import { parseResumeContext } from "./durable-input";
import {
  reconstructForRepair,
  type ReconstructionDeps,
} from "./reconstruction";

export type TwoStageCopyRunnerResult =
  | { readonly ok: true; readonly runner: DefaultProductOneToOneCopyRunnerInput }
  | {
      readonly ok: false;
      readonly reason: "frozen_state_unrepairable" | "copy_context_missing";
    };

export interface TwoStageCopyRunnerInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly client?: SupabaseClient;
  readonly now?: () => number;
  readonly deadlineMs?: number;
}

async function economicSnapshot(
  client: SupabaseClient,
  campaignId: string,
): Promise<{
  readonly usdBrlRateAtGeneration: number | null;
  readonly creditValueBrlAtGeneration: number | null;
}> {
  try {
    const { data, error } = await client
      .from("campaigns")
      .select("input_snapshot")
      .eq("id", campaignId)
      .maybeSingle();
    if (error || !data) {
      return { usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null };
    }
    const snapshot = (data as { input_snapshot?: unknown }).input_snapshot;
    const record =
      snapshot !== null && typeof snapshot === "object"
        ? (snapshot as Record<string, unknown>)
        : {};
    const parsed = parseResumeContext(record.resumeContext);
    if (!parsed.ok) {
      return { usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null };
    }
    return parsed.context.economicSnapshot;
  } catch {
    return { usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null };
  }
}

/**
 * Recuperação de copy a partir do conteúdo CONGELADO (F60.4). `repairable` é
 * reparado pelo MESMO caminho da base (reconstrução durável + binding) e só
 * prossegue com estado final `complete`. Nunca lê a loja atual, nunca gera
 * imagem e nunca cobra crédito.
 */
export async function buildTwoStageCopyRunner(
  input: TwoStageCopyRunnerInput,
  deps: ReconstructionDeps = {},
): Promise<TwoStageCopyRunnerResult> {
  const client = input.client ?? supabaseAdmin;
  const readFrozen = deps.readFrozenState ?? readSquareBaseFrozenState;

  let frozen;
  try {
    frozen = await readFrozen(
      { campaignId: input.campaignId, operationId: input.operationId },
      { client },
    );
  } catch {
    return Object.freeze({ ok: false as const, reason: "frozen_state_unrepairable" as const });
  }

  let payload: FrozenContentPayload;
  if (frozen.kind === "complete") {
    payload = frozen.payload;
  } else if (frozen.kind === "repairable") {
    const repaired = await reconstructForRepair(
      {
        campaignId: input.campaignId,
        operationId: input.operationId,
        storeId: input.storeId,
        frozen,
      },
      {
        ...deps,
        client,
        ...(input.deadlineMs === undefined ? {} : { deadlineMs: input.deadlineMs }),
      },
    );
    if (!repaired.ok || repaired.frozenState !== "complete" || !repaired.payload) {
      return Object.freeze({
        ok: false as const,
        reason: "frozen_state_unrepairable" as const,
      });
    }
    payload = repaired.payload;
  } else {
    return Object.freeze({
      ok: false as const,
      reason: "frozen_state_unrepairable" as const,
    });
  }

  if (!payload.copyContext) {
    return Object.freeze({ ok: false as const, reason: "copy_context_missing" as const });
  }

  const economic = await economicSnapshot(client, input.campaignId);

  return Object.freeze({
    ok: true as const,
    runner: Object.freeze({
      campaignId: input.campaignId,
      operationId: input.operationId,
      storeId: input.storeId,
      briefing: {
        product: payload.briefing.product,
        commercial: payload.briefing.commercial,
      },
      copyContext: payload.copyContext,
      copyDirectorEnabled: getLaunchConfig().copyDirectorEnabled,
      usdBrlRateAtGeneration: economic.usdBrlRateAtGeneration,
      creditValueBrlAtGeneration: economic.creditValueBrlAtGeneration,
    }),
  });
}
