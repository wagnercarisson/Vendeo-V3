import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCandidatePayload,
  type SquareBaseDeps,
} from "@/lib/campaign/square-base/run-square-base";
import type {
  FrozenContentPayload,
  FrozenStateReadResult,
  SquareBaseInput,
} from "@/lib/campaign/square-base/types";
import {
  compareFrozenContent,
  frozenFingerprint,
  parseFrozenPayload,
  readSquareBaseFrozenState,
  serializeFrozenPayload,
} from "@/lib/campaign/square-base/frozen-state";
import { repairFrozenEvidence } from "@/lib/campaign/square-base/config";
import { downloadCampaignInputFile } from "@/lib/campaign/persistence";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseResumeContext, verifyReconstructedInput } from "./durable-input";
import type { DurableInputDescriptor } from "./types";

export type ReconstructionReason =
  | "frozen_state_not_absent"
  | "snapshot_missing"
  | "snapshot_malformed"
  | "snapshot_indeterminate"
  | "resume_context_missing"
  | "resume_context_malformed"
  | "copy_context_missing"
  | "input_file_missing"
  | "input_hash_mismatch"
  | "input_role_mismatch"
  | "identity_snapshot_mismatch"
  | "storage_indeterminate"
  | "frozen_repair_divergence"
  | "frozen_repair_failed"
  | "frozen_repair_indeterminate";

export type ReconstructedContent = {
  readonly briefing: NonNullable<SquareBaseInput["briefing"]>;
  readonly briefingText: string;
  readonly campaignIntent: SquareBaseInput["campaignIntent"];
  readonly backgroundDirection: SquareBaseInput["backgroundDirection"];
  readonly productImagesDataUrls: readonly string[];
  readonly identityImageUrl?: string;
  readonly identityDirective?: string;
  readonly references?: readonly string[];
  readonly referenceSelections: SquareBaseInput["referenceSelections"];
  readonly copyContext?: SquareBaseInput["copyContext"];
  readonly usdBrlRateAtGeneration: number | null;
  readonly creditValueBrlAtGeneration: number | null;
};

export type ReconstructResult =
  | {
      readonly ok: true;
      readonly content: ReconstructedContent;
      readonly frozenState: "absent" | "complete";
      readonly repaired?: boolean;
      readonly payload?: FrozenContentPayload;
    }
  | { readonly ok: false; readonly reason: ReconstructionReason; readonly definitive: boolean };

export interface ReconstructionDeps {
  readonly client?: SupabaseClient;
  readonly readInputBytes?: typeof downloadCampaignInputFile;
  readonly readFrozenState?: typeof readSquareBaseFrozenState;
  readonly repairEvidence?: typeof repairFrozenEvidence;
  readonly composePrompt?: SquareBaseDeps["composePrompt"];
  readonly promptBase?: string;
  readonly deadlineMs?: number;
}

type CampaignRow = {
  input_snapshot?: unknown;
  identity_snapshot?: unknown;
};

function failed(reason: ReconstructionReason, definitive = true): ReconstructResult {
  return Object.freeze({ ok: false as const, reason, definitive });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function referenceEntry(
  descriptor: DurableInputDescriptor,
  index: number,
): { kind: "product" | "reference" | "identity"; id: string; role: string; index: number } {
  if (descriptor.kind === "identity") {
    return {
      kind: "identity",
      id: descriptor.contentId,
      role: "identity",
      index,
    };
  }
  return {
    kind: index === 0 ? "product" : "reference",
    id: descriptor.contentId,
    role: descriptor.role,
    index,
  };
}

function referencesMatch(
  expected: readonly { kind: string; id: string; role: string; index: number }[],
  raw: unknown,
): boolean {
  if (!Array.isArray(raw) || raw.length !== expected.length) return false;
  return expected.every((item, index) => {
    const candidate = raw[index];
    return (
      isRecord(candidate) &&
      candidate.kind === item.kind &&
      candidate.id === item.id &&
      candidate.role === item.role &&
      candidate.index === item.index
    );
  });
}

async function reconstructContent(
  input: { campaignId: string; operationId: string; storeId: string; frozen: FrozenStateReadResult },
  deps: ReconstructionDeps,
  options: { allowRepairable: boolean; allowComplete?: boolean },
): Promise<ReconstructResult> {
  const frozen = input.frozen;
  const acceptedState =
    frozen.kind === "absent" ||
    (options.allowRepairable && frozen.kind === "repairable") ||
    (options.allowComplete === true && frozen.kind === "complete");
  if (!acceptedState) return failed("frozen_state_not_absent");

  const client = deps.client ?? (supabaseAdmin as unknown as SupabaseClient);
  let row: CampaignRow | null;
  try {
    const result = await client
      .from("campaigns")
      .select("input_snapshot, identity_snapshot")
      .eq("id", input.campaignId)
      .maybeSingle<CampaignRow>();
    // Erro de leitura NAO e corrupcao comprovada: indisponibilidade permite
    // recuperacao segura (nao definitiva, sem estorno).
    if (result.error) return failed("snapshot_indeterminate", false);
    row = result.data ?? null;
  } catch {
    return failed("snapshot_indeterminate", false);
  }
  if (!row) return failed("snapshot_missing");
  if (!isRecord(row.input_snapshot)) return failed("snapshot_malformed");
  const snapshot = row.input_snapshot;
  const parsedContext = parseResumeContext(snapshot.resumeContext);
  if (!parsedContext.ok) {
    return failed(
      parsedContext.reason === "missing" ? "resume_context_missing" : "resume_context_malformed",
    );
  }
  const context = parsedContext.context;
  if (!context.copyContext) return failed("copy_context_missing");
  if (context.briefingText !== JSON.stringify(context.briefing)) {
    return failed("resume_context_malformed");
  }

  const frozenReferences = snapshot.frozenContentReferences;
  if (!Array.isArray(frozenReferences)) return failed("snapshot_malformed");

  const productDescriptors = context.inputFiles
    .filter((file) => file.kind === "product")
    .sort((a, b) => a.index - b.index);
  const identityDescriptor = context.inputFiles.find((file) => file.kind === "identity");
  const expectedReferences = [
    ...productDescriptors.map((descriptor, index) => referenceEntry(descriptor, index)),
    ...(identityDescriptor
      ? [referenceEntry(identityDescriptor, productDescriptors.length)]
      : []),
  ];
  if (!referencesMatch(expectedReferences, frozenReferences)) {
    return failed("input_role_mismatch");
  }

  const readInputBytes = deps.readInputBytes ?? downloadCampaignInputFile;
  const productImagesDataUrls: string[] = [];
  for (const descriptor of productDescriptors) {
    const read = await readInputBytes(descriptor.storagePath);
    if (read.kind === "absent") return failed("input_file_missing");
    if (read.kind === "indeterminate") return failed("storage_indeterminate", false);
    const verified = verifyReconstructedInput(descriptor, read.bytes);
    if (!verified.ok) {
      return failed(
        verified.reason === "hash_mismatch" ? "input_hash_mismatch" : "input_hash_mismatch",
      );
    }
    productImagesDataUrls.push(verified.dataUrl);
  }

  let identityImageUrl: string | undefined;
  if (identityDescriptor) {
    const identitySnapshot = row.identity_snapshot;
    if (identitySnapshot === null || identitySnapshot === undefined) {
      return failed("identity_snapshot_mismatch");
    }
    const read = await readInputBytes(identityDescriptor.storagePath);
    if (read.kind === "absent") return failed("input_file_missing");
    if (read.kind === "indeterminate") return failed("storage_indeterminate", false);
    const verified = verifyReconstructedInput(identityDescriptor, read.bytes);
    if (!verified.ok) return failed("input_hash_mismatch");
    identityImageUrl = verified.dataUrl;
  }

  const content: ReconstructedContent = Object.freeze({
    briefing: context.briefing,
    briefingText: context.briefingText,
    campaignIntent: context.campaignIntent,
    backgroundDirection: context.backgroundDirection,
    productImagesDataUrls: Object.freeze(productImagesDataUrls),
    ...(identityImageUrl === undefined ? {} : { identityImageUrl }),
    ...(context.identityDirective === null
      ? {}
      : { identityDirective: context.identityDirective }),
    ...(snapshot.references === undefined
      ? {}
      : { references: snapshot.references as readonly string[] }),
    referenceSelections: Object.freeze(
      frozenReferences as NonNullable<SquareBaseInput["referenceSelections"]>,
    ),
    ...(context.copyContext === null ? {} : { copyContext: context.copyContext }),
    usdBrlRateAtGeneration: context.economicSnapshot.usdBrlRateAtGeneration,
    creditValueBrlAtGeneration: context.economicSnapshot.creditValueBrlAtGeneration,
  });

  if (frozen.kind === "absent") {
    return Object.freeze({ ok: true as const, content, frozenState: "absent" as const });
  }

  // `complete`: o conteudo vem do estado duravel (a rota `/continue` nao envia
  // briefing/imagens). Nao ha reparo a fazer.
  if (frozen.kind === "complete") {
    return Object.freeze({ ok: true as const, content, frozenState: "complete" as const });
  }

  const candidateInput: SquareBaseInput = {
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: { kind: "system" },
    briefing: content.briefing,
    briefingText: content.briefingText,
    campaignIntent: content.campaignIntent,
    backgroundDirection: content.backgroundDirection,
    productImagesDataUrls: content.productImagesDataUrls,
    ...(content.identityImageUrl === undefined
      ? {}
      : { identityImageUrl: content.identityImageUrl }),
    ...(content.identityDirective === undefined
      ? {}
      : { identityDirective: content.identityDirective }),
    ...(content.references === undefined ? {} : { references: content.references }),
    ...(content.referenceSelections === undefined
      ? {}
      : { referenceSelections: content.referenceSelections }),
    ...(content.copyContext === undefined ? {} : { copyContext: content.copyContext }),
    attempt: { number: 1, target: "primary", reference: "repair" },
    usdBrlRateAtGeneration: content.usdBrlRateAtGeneration,
    creditValueBrlAtGeneration: content.creditValueBrlAtGeneration,
  };
  const candidate = buildCandidatePayload(candidateInput, {
    ...(deps.composePrompt === undefined ? {} : { composePrompt: deps.composePrompt }),
    ...(deps.promptBase === undefined ? {} : { promptBase: deps.promptBase }),
  });
  if (!candidate) return failed("frozen_repair_divergence");
  const fingerprint = frozenFingerprint(candidate, serializeFrozenPayload(candidate));
  if (fingerprint !== frozen.fingerprint) return failed("frozen_repair_divergence");

  const repair = deps.repairEvidence ?? repairFrozenEvidence;
  let repaired: Awaited<ReturnType<typeof repairFrozenEvidence>>;
  try {
    repaired = await repair(
      {
        frozen,
        comparison: { ok: true, fingerprint, payload: candidate },
      },
      {
        client,
        ...(deps.deadlineMs === undefined ? {} : { deadlineMs: deps.deadlineMs }),
      },
    );
  } catch {
    return failed("frozen_repair_indeterminate", false);
  }
  if (!repaired.ok) {
    if (repaired.reason === "content_divergence") return failed("frozen_repair_divergence");
    return failed("frozen_repair_failed");
  }

  const readFrozenState = deps.readFrozenState ?? readSquareBaseFrozenState;
  let reread: FrozenStateReadResult;
  try {
    reread = await readFrozenState(
      { campaignId: input.campaignId, operationId: input.operationId },
      { client },
    );
  } catch {
    return failed("frozen_repair_indeterminate", false);
  }
  if (reread.kind !== "complete") return failed("frozen_repair_failed");
  const parsedPayload = parseFrozenPayload(reread.evidence.briefing);
  if (!parsedPayload.ok) return failed("frozen_repair_failed");
  const comparison = compareFrozenContent({
    frozen: parsedPayload.payload,
    received: {
      briefing: content.briefing,
      copyContext: content.copyContext ?? null,
      identityDirective: content.identityDirective ?? null,
      campaignIntent: content.campaignIntent,
      backgroundDirection: content.backgroundDirection,
      productImagesDataUrls: content.productImagesDataUrls,
      ...(content.identityImageUrl === undefined
        ? {}
        : { identityImageUrl: content.identityImageUrl }),
      references: content.references,
      referenceSelections: content.referenceSelections,
    },
    receivedBriefingText: content.briefingText,
  });
  if (!comparison.ok) return failed("frozen_repair_divergence");
  return Object.freeze({
    ok: true as const,
    content,
    frozenState: "complete" as const,
    repaired: true,
    payload: parsedPayload.payload,
  });
}

export async function reconstructFirstExecution(
  input: { campaignId: string; operationId: string; storeId: string; frozen: FrozenStateReadResult },
  deps: ReconstructionDeps = {},
  options: { allowRepairable?: boolean } = {},
): Promise<ReconstructResult> {
  return reconstructContent(input, deps, {
    allowRepairable: options.allowRepairable === true,
  });
}

/**
 * Reconstrucao do conteudo duravel para retomada com congelado `complete`.
 * A rota `/continue` nao envia briefing/imagens; tudo sai do snapshot + arquivos
 * verificados, sem reparo e sem chamada paga.
 */
export async function reconstructForComplete(
  input: { campaignId: string; operationId: string; storeId: string; frozen: FrozenStateReadResult },
  deps: ReconstructionDeps = {},
): Promise<ReconstructResult> {
  if (input.frozen.kind !== "complete") return failed("frozen_state_not_absent");
  return reconstructContent(input, deps, { allowRepairable: false, allowComplete: true });
}

export async function reconstructForRepair(
  input: { campaignId: string; operationId: string; storeId: string; frozen: FrozenStateReadResult },
  deps: ReconstructionDeps = {},
): Promise<ReconstructResult> {
  if (input.frozen.kind !== "repairable") return failed("frozen_state_not_absent");
  return reconstructContent(input, deps, { allowRepairable: true });
}
