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
import {
  createNineSixteenDeps,
} from "@/lib/product-9-16-two-stage/orchestration/delivery-deps";
import type { RunNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/types";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
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
import { finalizeJointFailure } from "./finalize-joint-failure";
import type { TwoFormatRunDeps } from "./run-two-format";
import type {
  TwoFormatFormatStatus,
  TwoFormatNextStep,
  TwoFormatStatusSnapshot,
} from "./two-format-events";
import type { TwoFormatFormat } from "../types";

function nextStepFor(
  action: string,
  formats: Readonly<Record<TwoFormatFormat, TwoFormatFormatStatus>>,
): TwoFormatNextStep {
  switch (action) {
    case "acquire_base":
    case "retry_base":
      return "base";
    case "acquire_expansion":
    case "retry_expansion":
      return "expansion";
    case "deliver":
      if (
        formats["1:1"].state === "processing" &&
        formats["9:16"].state === "delivered"
      ) {
        return "square_delivery";
      }
      return "delivery";
    default:
      return null;
  }
}

function terminalFormatState(state: TwoFormatFormatStatus["state"]): boolean {
  return state === "delivered" || state === "absent";
}

/** Etapas GRATUITAS (entrega/reparo) podem continuar mesmo com a flag OFF. */
function isFreeStep(step: TwoFormatNextStep): boolean {
  return step === "delivery" || step === "square_delivery";
}

export interface TwoFormatRunDepsOptions {
  readonly client?: SupabaseClient;
  readonly clock?: () => number;
  readonly callIdFactory?: () => string;
  /**
   * Costura de PROVIDER/etapas já compostas. Em produção é omitida; testes de
   * composição real injetam apenas os seams de provider/DB/Storage.
   */
  readonly nineDeps?: RunNineSixteenDeps;
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
  const nine = options.nineDeps ?? createNineSixteenDeps({ client, clock });
  const control = new ProductTwoStageOperationClient(client);
  const credit = new ProductOneToOneCreditOperationClient(client);
  const attempt = new ProductOneToOneAttemptStartClient(client);
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
    const formats: Record<TwoFormatFormat, TwoFormatFormatStatus> = {
      "1:1": {
        state: view.square.state,
        deliveryOperationId: view.square.deliveryOperationId,
      },
      "9:16": {
        state: view.vertical.state,
        deliveryOperationId: view.vertical.deliveryOperationId,
      },
    };
    const preferredFormat =
      formats["1:1"].state === "delivered"
        ? ("1:1" as const)
        : formats["9:16"].state === "delivered"
          ? ("9:16" as const)
          : null;
    const nextStep = nextStepFor(operation.view.nextAction, formats);
    // Terminal dos DOIS formatos. Cada estado terminal do read model só existe
    // com crédito terminal (entregue ou estornado). Um único formato NÃO declara
    // a operação terminal.
    const operationTerminal =
      terminalFormatState(formats["1:1"].state) &&
      terminalFormatState(formats["9:16"].state);
    const canContinue =
      !operationTerminal &&
      operation.view.canContinue &&
      (input.allowNewPaidStep ||
        !(nextStep === "base" || nextStep === "expansion") ||
        isFreeStep(nextStep));
    return {
      campaignStatus: String(campaign.data?.status ?? "generating"),
      formats,
      preferredFormat,
      nextStep,
      canContinue,
      operationTerminal,
    } satisfies TwoFormatStatusSnapshot;
  };

  const reconstruct: Parameters<typeof resumeJointOperation>[1]["reconstruct"] = async (
    input,
  ) => {
    const frozen = await nine.readFrozenState({
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
    resolveAttemptTarget: async (input) => {
      const resumed = await control.resume(input);
      if (!resumed.success) return null;
      return (resumed.nextTarget ?? null) satisfies AttemptTarget | null;
    },
    finalizeJointFailure: (input) =>
      finalizeJointFailure(input, {
        finish: (finish) => control.finish(finish),
        recordOutcome: (record) => control.recordOutcome(record),
        recordFormatOutcome: async (record) => {
          await attempt.recordOperationOutcome({
            campaignId: record.campaignId,
            operationId: record.operationId,
            outcome: record.outcome,
            supportReference: record.supportReference ?? null,
          });
        },
        probeSquare: (probe) => joint.probeSquare.probeSquareOriginal(probe),
        probeVertical: (probe) =>
          joint.probeVertical.probeVerticalArtifact(probe),
        getPublicationEpoch: (campaignId, operationId) =>
          credit.getPublicationEpoch(campaignId, operationId),
        refundFormat: (refund) => jointClient.refundFormat(refund),
        readFormatStatuses: (read) => readTwoFormatDelivery(read, { client }),
      }),
    clock,
    callIdFactory,
  };
}
