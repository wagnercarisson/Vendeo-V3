import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getLaunchConfig } from "@/lib/launch-config/config";
import { CreditService } from "@/lib/credit/credit-service";
import {
  isCampaignFormatAdditionEnabled,
  isProduct9_16TwoStageEnabled,
} from "@/lib/feature-flags/feature-flag-service";
import { requireLegalClearance } from "@/lib/legal/clearance";
import { checkRateLimit } from "@/lib/rate-limit/rate-limit";
import { getStoreReadiness } from "@/lib/store-readiness";
import { prepareSquareForExpansion } from "@/lib/campaign/square-preparation/prepare";
import { runExpansionStep } from "@/lib/product-9-16-two-stage/orchestration/expansion-step";
import { createNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/delivery-deps";
import { CompositionVerticalProbe } from "@/lib/product-9-16-two-stage/orchestration/vertical-probe";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import { supabaseAdmin } from "@/lib/supabase/server";

import { readFormatAdditionByCampaign } from "../delivery-reader";
import { ensureFormatAdditionSourceBridge } from "../source-registration";
import { captureFrozenEconomics } from "../frozen-economics";
import { FormatAdditionFinancialClient } from "../financial-client";
import type {
  FormatAdditionDeps,
  FormatAdditionOpeningGate,
  FormatAdditionOpeningGateInput,
} from "./types";

/**
 * F62/62-04 — Composition root de produção.
 *
 * Os clientes reais são compostos aqui, mas nunca são executados nos testes
 * offline: os testes injetam fakes declarados nas portas. Nenhum gate acessa
 * ambiente sem ser por meio destas portas.
 */
export interface CreateFormatAdditionDepsOptions {
  readonly client?: SupabaseClient;
  /**
   * Resolução server-side de autorização do fluxo de produto (escopo/instância/
   * ambiente). A rota do 62-05 fornece a implementação real; sem ela, a abertura
   * falha fechado.
   */
  readonly authorizeProductFlow?: (
    input: FormatAdditionOpeningGateInput,
  ) => Promise<FormatAdditionOpeningGate>;
}

function gateFailure(code: string, reason: string): FormatAdditionOpeningGate {
  return Object.freeze({ allowed: false as const, code, reason });
}

async function defaultOpeningGate(
  client: SupabaseClient,
  input: FormatAdditionOpeningGateInput,
  options: CreateFormatAdditionDepsOptions,
): Promise<FormatAdditionOpeningGate> {
  try {
    if (!(await isCampaignFormatAdditionEnabled())) {
      return gateFailure(
        "addition_disabled",
        "campaign_format_addition_enabled",
      );
    }
    if (!(await isProduct9_16TwoStageEnabled())) {
      return gateFailure(
        "engine_disabled",
        "product_9_16_two_stage_enabled",
      );
    }

    if (options.authorizeProductFlow === undefined) {
      return gateFailure(
        "authorization_unavailable",
        "authorization_resolver_not_configured",
      );
    }
    const authorization = await options.authorizeProductFlow(input);
    if (!authorization.allowed) {
      return authorization;
    }

    const legal = await requireLegalClearance({
      storeId: input.storeId,
      userId: input.userId ?? "",
      capability: "content_generation",
    });
    if (!legal.ok) {
      return gateFailure("legal_blocked", legal.reason);
    }

    const readiness = await getStoreReadiness(input.storeId);
    if (!readiness.ready) {
      return gateFailure(
        "store_not_ready",
        readiness.missing.map((item) => item.reason).join(",") || "not_ready",
      );
    }

    const config = getLaunchConfig();
    const rateLimit = await checkRateLimit(input.storeId, {
      rateLimitEnabled: config.rateLimitEnabled,
    });
    if (!rateLimit.allowed) {
      return gateFailure(
        "rate_limit_exceeded",
        rateLimit.resetTime ?? "1 hour",
      );
    }

    const balance = await new CreditService(client).getBalance(input.storeId);
    if (balance < 1) {
      return gateFailure("insufficient_credits", "balance_below_one");
    }

    return Object.freeze({ allowed: true as const });
  } catch {
    return gateFailure("gate_read_failed", "opening_gate_unavailable");
  }
}

export function createProductionFormatAdditionDeps(
  options: CreateFormatAdditionDepsOptions = {},
): FormatAdditionDeps {
  const client = options.client ?? (supabaseAdmin as SupabaseClient);
  const financial = new FormatAdditionFinancialClient(client);
  const nineDeps = createNineSixteenDeps({ client });

  const deps: FormatAdditionDeps = {
    readLink: (input) => readFormatAdditionByCampaign(input),
    checkOpeningGate: (input) => defaultOpeningGate(client, input, options),
    registerSource: (input) =>
      ensureFormatAdditionSourceBridge(input, { client }),
    captureFrozenEconomics: (selection) =>
      captureFrozenEconomics(selection, { client }),
    openAddition: (input) => financial.open(input),

    prepare: (input) => prepareSquareForExpansion(input, { client }),
    control: new ProductTwoStageOperationClient(client),
    expansion: runExpansionStep,
    probe: new CompositionVerticalProbe({ client }),
    publication: nineDeps.credit,
    deliver: (input) => financial.deliver(input),
    refund: (input) => financial.refund(input),
    generateThumbnail: nineDeps.generateThumbnail,
    clock: () => Date.now(),
    callId: () => randomUUID(),
  };
  return Object.freeze(deps);
}
