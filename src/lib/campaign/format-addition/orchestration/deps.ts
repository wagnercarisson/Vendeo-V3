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
import { expandVerticalToNineSixteen } from "@/lib/campaign/vertical-expansion/expand";
import { probeExpansionTarget } from "@/lib/campaign/vertical-expansion/probe";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { reconcileExpansionArtifact } from "@/lib/product-9-16-two-stage/orchestration/reconciliation";
import { runExpansionStep } from "@/lib/product-9-16-two-stage/orchestration/expansion-step";
import { createNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/delivery-deps";
import { CompositionVerticalProbe } from "@/lib/product-9-16-two-stage/orchestration/vertical-probe";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import { supabaseAdmin } from "@/lib/supabase/server";

import { readFormatAdditionByCampaign, readFormatAdditionByIdentity } from "../delivery-reader";
import { ensureFormatAdditionSourceBridge } from "../source-registration";
import { captureFrozenEconomics, createFrozenExpansionReaders } from "../frozen-economics";
import { FormatAdditionFinancialClient } from "../financial-client";
import { deliverFormatAdditionVertical } from "./deliver-vertical";
import { finalizeFormatAdditionFailure } from "./finalize-failure";
import type {
  FormatAdditionDeps,
  FormatAdditionExpansionInput,
  FormatAdditionOpeningGate,
  FormatAdditionOpeningGateInput,
  FormatAdditionPilotSpendResolution,
} from "./types";
import type { StepExecutionOutcome } from "@/lib/product-9-16-two-stage/orchestration/types";

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
  /**
   * Resolução server-side do pilot gate (Produto 1:1), injetada pela rota. Sem
   * ela, o root falha fechado e NÃO presume piloto inativo. Injetável em testes.
   */
  readonly pilotSpendResolver?: (input: {
    readonly storeId: string;
  }) => Promise<FormatAdditionPilotSpendResolution>;
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

function defaultResolvePilotSpend(): Promise<FormatAdditionPilotSpendResolution> {
  // Sem resolvedor injetado pela rota, o caminho NÃO presume piloto inativo:
  // falha fechado e não chama provider. A ativação injeta o resolver real.
  return Promise.resolve({
    kind: "blocked" as const,
    reason: "pilot_gate_resolver_not_configured",
  });
}

export function createProductionFormatAdditionDeps(
  options: CreateFormatAdditionDepsOptions = {},
): FormatAdditionDeps {
  const client = options.client ?? (supabaseAdmin as SupabaseClient);
  const financial = new FormatAdditionFinancialClient(client);
  const nineDeps = createNineSixteenDeps({ client });
  const control = new ProductTwoStageOperationClient(client);
  const probe = new CompositionVerticalProbe({ client });

  async function readDurableContext(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) {
    try {
      const { data, error } = await client
        .from("campaign_format_additions")
        .select(
          "operation_id, request_id, source_origin, source_registration_operation_id, source_artifact_id, source_checksum_sha256, selection, frozen_economics",
        )
        .eq("store_id", input.storeId.toLowerCase())
        .eq("campaign_id", input.campaignId.toLowerCase())
        .eq("operation_id", input.operationId.toLowerCase())
        .maybeSingle();
      if (error) {
        return { kind: "read_failed" as const, reason: error.message };
      }
      if (data === null || typeof data !== "object") {
        return { kind: "missing" as const };
      }
      const record = data as Record<string, unknown>;
      if (
        typeof record.operation_id !== "string" ||
        typeof record.request_id !== "string" ||
        (record.source_origin !== "new_flow_1_1" &&
          record.source_origin !== "legacy_campaign") ||
        typeof record.source_registration_operation_id !== "string" ||
        typeof record.source_artifact_id !== "string" ||
        typeof record.source_checksum_sha256 !== "string" ||
        record.selection === undefined ||
        record.frozen_economics === undefined
      ) {
        return { kind: "read_failed" as const, reason: "invalid_durable_context" };
      }
      return {
        kind: "found" as const,
        context: {
          operationId: record.operation_id,
          requestId: record.request_id,
          sourceOrigin: record.source_origin as
            | "new_flow_1_1"
            | "legacy_campaign",
          sourceRegistrationOperationId: record.source_registration_operation_id,
          sourceArtifactId: record.source_artifact_id,
          sourceChecksumSha256: record.source_checksum_sha256,
          selection: record.selection,
          frozenEconomics: record.frozen_economics,
        },
      };
    } catch {
      return { kind: "read_failed" as const, reason: "read_exception" };
    }
  }

  const deps: FormatAdditionDeps = {
    readLink: (input) =>
      readFormatAdditionByCampaign(input, { client }),
    readLinkByRequest: (input) =>
      readFormatAdditionByIdentity(
        {
          storeId: input.storeId,
          campaignId: input.campaignId,
          requestId: input.requestId,
        },
        { client },
      ),
    checkOpeningGate: (input) => defaultOpeningGate(client, input, options),
    registerSource: (input) =>
      ensureFormatAdditionSourceBridge(input, { client }),
    captureFrozenEconomics: (selection) =>
      captureFrozenEconomics(selection, { client }),
    openAddition: (input) => financial.open(input),

    prepare: (input) => prepareSquareForExpansion(input, { client }),
    readDurableContext,
    runExpansion: createFormatAdditionExpansionRunner({ client, control }),
    resolvePilotSpend: (input) =>
      options.pilotSpendResolver
        ? options.pilotSpendResolver(input)
        : defaultResolvePilotSpend(),
    control,
    deliverVertical: (input) =>
      deliverFormatAdditionVertical(input, {
        probe,
        publication: nineDeps.credit,
        deliver: (deliverInput) => financial.deliver(deliverInput),
        generateThumbnail: nineDeps.generateThumbnail,
      }),
    finalizeFailure: (input) =>
      finalizeFormatAdditionFailure(input, {
        probe,
        publication: nineDeps.credit,
        control,
        refund: (refundInput) => financial.refund(refundInput),
      }),
    clock: () => Date.now(),
    callId: () => randomUUID(),
  };
  return Object.freeze(deps);
}

export interface FormatAdditionExpansionRunnerDeps {
  readonly client?: SupabaseClient;
  readonly control: FormatAdditionDeps["control"];
  /** Costura de teste: expansor real por padrão. */
  readonly expand?: typeof expandVerticalToNineSixteen;
  readonly retrieve?: typeof retrieveCompositionArtifact;
  readonly probe?: typeof probeExpansionTarget;
  readonly reconcile?: typeof reconcileExpansionArtifact;
  readonly clock?: () => number;
}

/**
 * Adaptador de expansão do composition root (C2). Encaminha SEMPRE os leitores
 * congelados ao expansor real; `catalog`/`pricing` de seams aninhados não podem
 * substituí-los. O pilot gate (C1) é repassado ao limite da chamada paga.
 */
export function createFormatAdditionExpansionRunner(
  deps: FormatAdditionExpansionRunnerDeps,
): FormatAdditionDeps["runExpansion"] {
  const expand = deps.expand ?? expandVerticalToNineSixteen;
  const clock = deps.clock ?? (() => Date.now());
  const client = deps.client;

  return async function runExpansionWithFrozen(
    input: FormatAdditionExpansionInput,
  ): Promise<StepExecutionOutcome> {
    const readers = createFrozenExpansionReaders(input.frozen);
    return runExpansionStep(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        authorization: input.authorization,
        acquisitionId: input.acquisitionId,
        attemptReference: input.attemptReference,
        attemptTarget: input.attemptTarget,
        deadlineAtMs: input.deadlineAtMs,
        expansionStatus: input.expansionStatus,
        allowNewPaidStep: input.allowNewPaidStep,
        selection: input.selection,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      },
      {
        control: {
          acquire: (request) => deps.control.acquire(request),
          finish: (request) => deps.control.finish(request),
          getOperationView: (request) => deps.control.getOperationView(request),
        },
        expand: (expandInput, nestedDeps) =>
          expand(expandInput, {
            ...(client === undefined ? {} : { client }),
            ...(nestedDeps ?? {}),
            catalog: readers.catalog,
            pricing: readers.pricing,
            ...(input.pilotSpend === undefined
              ? {}
              : { pilotSpend: input.pilotSpend }),
          }),
        preflightFrozenExpansion: async (selection) => {
          const preflight = await readers.preflightFrozenExpansion(selection);
          if (preflight.ok) {
            return { ok: true as const, selection };
          }
          return {
            ok: false as const,
            failure: preflight.failure,
            reason: preflight.reason,
            missing:
              preflight.failure === "pricing_unavailable"
                ? preflight.missing
                : [],
          };
        },
        retrieve: (retrieveInput, nestedDeps) =>
          (deps.retrieve ?? retrieveCompositionArtifact)(retrieveInput, {
            ...(client === undefined ? {} : { client }),
            ...(nestedDeps ?? {}),
          }),
        probe: (probeInput, nestedDeps) =>
          (deps.probe ?? probeExpansionTarget)(probeInput, {
            ...(client === undefined ? {} : { client }),
            ...(nestedDeps ?? {}),
          }),
        clock,
        ...(client === undefined ? {} : { client }),
        readEconomicSnapshot: readers.readEconomicSnapshot,
        reconcile: (reconcileInput, nestedDeps) =>
          (deps.reconcile ?? reconcileExpansionArtifact)(reconcileInput, {
            ...(client === undefined ? {} : { client }),
            ...(nestedDeps ?? {}),
          }),
      },
    );
  };
}
