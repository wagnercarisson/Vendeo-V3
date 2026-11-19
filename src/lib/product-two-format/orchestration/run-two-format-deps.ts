import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AttemptTarget } from "@/lib/product-9-16-two-stage/types";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import {
  reconstructFirstExecution,
  reconstructForComplete,
  reconstructForRepair,
} from "@/lib/product-9-16-two-stage/orchestration/reconstruction";
import { runPreparationStep } from "@/lib/product-9-16-two-stage/orchestration/preparation-step";
import { runExpansionStep } from "@/lib/product-9-16-two-stage/orchestration/expansion-step";
import { createNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/delivery-deps";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import { supabaseAdmin } from "@/lib/supabase/server";

import { readTwoFormatDelivery } from "../delivery-reader";
import { TwoFormatJointFinancialClient } from "../joint-financial-client";
import { createJointDeps } from "./joint-deps";
import { openJointOperation } from "./joint-operation-service";
import { preflightJointSelection } from "./preflight";
import { deliverJointSquare } from "./deliver-square";
import { deliverTwoFormatVertical } from "./deliver-joint-vertical";
import { repairJointProjection } from "./repair-joint-projection";
import { runJointBase } from "./joint-base";
import { resumeJointOperation } from "./resume-joint-operation";
import type { TwoFormatRunDeps } from "./run-two-format";
import type { TwoFormatStatusSnapshot } from "./two-format-events";
import type { TwoFormatNextStep } from "./two-format-events";

function nextStepFor(action: string): TwoFormatNextStep {
  switch (action) {
    case "acquire_base":
    case "retry_base":
      return "base";
    case "acquire_expansion":
    case "retry_expansion":
      return "expansion";
    case "deliver":
      return "delivery";
    default:
      return null;
  }
}

export interface TwoFormatRunDepsOptions {
  readonly client?: SupabaseClient;
  readonly clock?: () => number;
  readonly callIdFactory?: () => string;
}

/**
 * Composition root REAL do C1. Um único client é compartilhado por leitura,
 * RPCs conjuntas, passos 9:16 e probes — nunca o global quando injetado.
 * Sem chamadas de provider na construção.
 */
export function createTwoFormatRunDeps(
  options: TwoFormatRunDepsOptions = {},
): TwoFormatRunDeps {
  const client = options.client ?? supabaseAdmin;
  const clock = options.clock ?? (() => Date.now());
  const callIdFactory = options.callIdFactory ?? (() => randomUUID());
  const joint = createJointDeps({ client, clock, callIdFactory });
  const nine = createNineSixteenDeps({ client });
  const control = new ProductTwoStageOperationClient(client);
  const credit = new ProductOneToOneCreditOperationClient(client);
  const jointClient = new TwoFormatJointFinancialClient(client);

  const readOperationView: TwoFormatRunDeps["readOperationView"] = (input) =>
    control.getOperationView(input);

  const readStatus: TwoFormatRunDeps["readStatus"] = async (input) => {
    const [delivery, operation, campaign] = await Promise.all([
      readTwoFormatDelivery(
        {
          campaignId: input.campaignId,
          operationId: input.operationId,
          storeId: input.storeId,
        },
        { client },
      ),
      control.getOperationView({
        campaignId: input.campaignId,
        operationId: input.operationId,
      }),
      client
        .from("campaigns")
        .select("status")
        .eq("id", input.campaignId)
        .maybeSingle(),
    ]);
    if (campaign.error) throw new Error(campaign.error.message);
    if (delivery.kind !== "found") {
      throw new Error(`joint_status_${delivery.kind}`);
    }
    if (operation.kind !== "found") {
      throw new Error(`joint_operation_${operation.kind}`);
    }
    const view = delivery.view;
    const formats = {
      "1:1": {
        state: view.square.state,
        deliveryOperationId: view.square.deliveryOperationId,
      },
      "9:16": {
        state: view.vertical.state,
        deliveryOperationId: view.vertical.deliveryOperationId,
      },
    } as const;
    const preferredFormat =
      formats["1:1"].state === "delivered"
        ? ("1:1" as const)
        : formats["9:16"].state === "delivered"
          ? ("9:16" as const)
          : null;
    return {
      campaignStatus: String(campaign.data?.status ?? "generating"),
      formats,
      preferredFormat,
      nextStep: nextStepFor(operation.view.nextAction),
      canContinue: operation.view.canContinue && input.allowNewPaidStep,
      operationTerminal: operation.view.credit.terminal,
    } satisfies TwoFormatStatusSnapshot;
  };

  const reconstruct: Parameters<typeof resumeJointOperation>[1]["reconstruct"] = async (
    input,
  ) => {
    const frozen = await joint.readFrozenState({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    const deps = { ...(nine.reconstruction ?? {}), client };
    if (frozen.kind === "absent") {
      const result = await reconstructFirstExecution(
        { ...input, frozen },
        deps,
      );
      return result.ok
        ? { ok: true, content: result.content, frozenState: frozen }
        : { ok: false, reason: result.reason };
    }
    if (frozen.kind === "complete") {
      const result = await reconstructForComplete({ ...input, frozen }, deps);
      return result.ok
        ? { ok: true, content: result.content, frozenState: frozen }
        : { ok: false, reason: result.reason };
    }
    if (frozen.kind === "repairable") {
      const result = await reconstructForRepair({ ...input, frozen }, deps);
      return result.ok
        ? { ok: true, content: result.content, frozenState: frozen }
        : { ok: false, reason: result.reason };
    }
    return { ok: false, reason: "frozen_state_indeterminate" };
  };

  const baseDeps = {
    control: nine.control,
    base: nine.base,
    clock: nine.clock,
    ...(nine.reconstruction ?? {}),
  };

  const resumeDeps: Parameters<typeof resumeJointOperation>[1] = {
    readDelivery: (input) => readTwoFormatDelivery(input, { client }),
    readOperationView: (input) => control.getOperationView(input),
    probeSquare: (input) => joint.probeSquare.probeSquareOriginal(input),
    reconstruct,
    runBase: (input) => runJointBase(input, baseDeps),
    deliverSquare: (input) =>
      deliverJointSquare(input, {
        probeSquareOriginal: (probe) =>
          joint.probeSquare.probeSquareOriginal(probe),
        beginPublication: (campaignId, operationId) =>
          credit.beginPublication(campaignId, operationId),
        abortPublication: (campaignId, operationId, token, phase) =>
          credit.abortPublication(campaignId, operationId, token, phase),
        deliverFormat: (deliver) => jointClient.deliverFormat(deliver),
        generateThumbnail: (thumb) => joint.generateThumbnail(thumb),
        clock,
      }),
    deliverVertical: (input) =>
      deliverTwoFormatVertical(input, {
        resume: (resume) => control.resume(resume),
        prepare: (prepare) =>
          runPreparationStep(prepare, {
            prepare: nine.prepare,
            client,
          }),
        expand: (expand) =>
          runExpansionStep(expand, {
            control: nine.control,
            expand: (expandInput, expandDeps) =>
              nine.expand(expandInput, expandDeps),
            preflightFrozenExpansion: nine.preflightFrozenExpansion,
            clock,
            client,
          }),
        probeVertical: (probe) => joint.probeVertical.probeVerticalArtifact(probe),
        beginPublication: (campaignId, operationId) =>
          credit.beginPublication(campaignId, operationId),
        abortPublication: (campaignId, operationId, token, phase) =>
          credit.abortPublication(campaignId, operationId, token, phase),
        deliverFormat: (deliver) => jointClient.deliverFormat(deliver),
        clock,
      }),
    repairProjection: (input) =>
      repairJointProjection(input, {
        readDelivery: (read) => readTwoFormatDelivery(read, { client }),
        projectCampaign: (project) => jointClient.projectCampaign(project),
        thumbnailExists: async () => false,
        generateThumbnail: (thumb) => joint.generateThumbnail(thumb),
        clock,
      }),
  };

  return {
    readOperationView,
    readStatus,
    preflightJointSelection: () =>
      preflightJointSelection({
        readConfiguration: joint.preflight.readConfiguration,
        preflightSelection: joint.preflight.preflightSelection,
      }),
    openJointOperation: (input) =>
      openJointOperation(input, {
        openJointDelivery: (open) => jointClient.openJointDelivery(open),
      }),
    resumeJointOperation: (input) => resumeJointOperation(input, resumeDeps),
    runInitialBase: (input) =>
      runJointBase(
        {
          ...input,
          baseStatus: "pending",
          frozenState: { kind: "absent" },
        },
        baseDeps,
      ),
    resolveAttemptTarget: async (input) => {
      const resumed = await control.resume(input);
      if (!resumed.success) return "primary";
      return (resumed.nextTarget ?? "primary") satisfies AttemptTarget;
    },
    clock,
    callIdFactory,
  };
}
