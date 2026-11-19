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
import {
  classifyJointFormat,
  planJointResume,
  type JointArtifactObservation,
} from "./classify-joint-resume";
import type { TwoFormatFormatView } from "../read-model";
import type { TwoFormatRunDeps } from "./run-two-format";
import type {
  TwoFormatFormatStatus,
  TwoFormatNextStep,
  TwoFormatStatusSnapshot,
} from "./two-format-events";
import type { TwoFormatFormat } from "../types";

function terminalFormatState(state: TwoFormatFormatStatus["state"]): boolean {
  return state === "delivered" || state === "absent";
}

/**
 * Próxima ação CONJUNTA derivada dos dois formatos e da autoridade durável.
 * Nunca usa `view.nextAction`/`view.canContinue` do 9:16 como se fosse a
 * decisão conjunta: entrega/liquidação/finalização gratuitas continuam
 * anunciáveis mesmo com a flag OFF ou com o crédito vertical terminal.
 */
function jointProgress(input: {
  readonly square: TwoFormatFormatView;
  readonly vertical: TwoFormatFormatView;
  readonly baseStatus: string;
  readonly expansionStatus: string;
  readonly nextAction: string;
  readonly allowNewPaidStep: boolean;
  readonly failedOutcome: boolean;
  readonly operationTerminal: boolean;
}): { readonly nextStep: TwoFormatNextStep; readonly canContinue: boolean } {
  const square = classifyJointFormat(input.square);
  const vertical = classifyJointFormat(input.vertical);
  // Base concluída ⇒ a arte do quadrado foi persistida (o step só conclui após
  // a persistência). Isso permite planejar a liquidação GRATUITA do quadrado
  // mesmo antes de a expansão ser aberta.
  const squareArtifact: JointArtifactObservation =
    square === "reserved" && input.baseStatus === "done" ? "integral" : "absent";
  const plan = planJointResume({ square, vertical, squareArtifact });
  const busy =
    input.baseStatus === "in_progress" ||
    input.expansionStatus === "in_progress" ||
    input.nextAction === "wait";

  let nextStep: TwoFormatNextStep;
  let canContinue: boolean;
  switch (plan.action) {
    case "run_base":
      nextStep = "base";
      canContinue = input.allowNewPaidStep && !busy;
      break;
    case "run_vertical_only":
      nextStep = "expansion";
      canContinue = input.allowNewPaidStep && !busy;
      break;
    case "settle_square":
      nextStep = "square_delivery";
      canContinue = true;
      break;
    case "pending_finalization":
      nextStep = "delivery";
      canContinue = true;
      break;
    case "repair_only":
      nextStep = "delivery";
      canContinue = true;
      break;
    case "partial_terminal":
    case "terminal_error":
    case "blocked_unknown":
    case "blocked_partial_read":
    case "fail_closed":
      nextStep = null;
      canContinue = false;
      break;
  }

  // Outcome durável `failed` ainda pendente de estorno/entrega: anuncia a
  // finalização gratuita, sem liberar nova etapa paga. Indeterminação de leitura
  // nunca vira promessa de ação.
  const indeterminate =
    square === "unknown" ||
    square === "unavailable" ||
    vertical === "unknown" ||
    vertical === "unavailable";
  if (input.failedOutcome && !input.operationTerminal && !indeterminate) {
    return { nextStep: "delivery", canContinue: true };
  }
  return { nextStep, canContinue };
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
    // Outcome durável `unknown`: o crédito pode continuar `reserved`, mas o
    // estado do formato NÃO pode voltar a `processing` no replay/status.
    const durableUnknown = operation.view.unknown;
    const squareView: TwoFormatFormatView =
      durableUnknown && view.square.state === "processing"
        ? { ...view.square, state: "unknown" }
        : view.square;
    const verticalView: TwoFormatFormatView =
      durableUnknown && view.vertical.state === "processing"
        ? { ...view.vertical, state: "unknown" }
        : view.vertical;

    const formats: Record<TwoFormatFormat, TwoFormatFormatStatus> = {
      "1:1": {
        state: squareView.state,
        deliveryOperationId: squareView.deliveryOperationId,
      },
      "9:16": {
        state: verticalView.state,
        deliveryOperationId: verticalView.deliveryOperationId,
      },
    };
    const preferredFormat =
      formats["1:1"].state === "delivered"
        ? ("1:1" as const)
        : formats["9:16"].state === "delivered"
          ? ("9:16" as const)
          : null;
    // Terminal dos DOIS formatos. Cada estado terminal do read model só existe
    // com crédito terminal (entregue ou estornado). Um único formato NÃO declara
    // a operação terminal.
    const operationTerminal =
      terminalFormatState(formats["1:1"].state) &&
      terminalFormatState(formats["9:16"].state);
    const progress = jointProgress({
      square: squareView,
      vertical: verticalView,
      baseStatus: operation.view.base.status,
      expansionStatus: operation.view.expansion.status,
      nextAction: operation.view.nextAction,
      allowNewPaidStep: input.allowNewPaidStep,
      failedOutcome: operation.view.failedOutcome,
      operationTerminal,
    });
    return {
      campaignStatus: String(campaign.data?.status ?? "generating"),
      formats,
      preferredFormat,
      nextStep: progress.nextStep,
      canContinue: progress.canContinue,
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
