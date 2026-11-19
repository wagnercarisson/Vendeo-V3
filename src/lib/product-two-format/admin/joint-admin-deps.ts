import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CompositionVerticalProbe } from "@/lib/product-9-16-two-stage/orchestration/vertical-probe";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { supabaseAdmin } from "@/lib/supabase/server";

import { readTwoFormatDelivery } from "../delivery-reader";
import { TwoFormatJointFinancialClient } from "../joint-financial-client";
import {
  CompositionSquareOriginalProbe,
  type JointSquareProbe,
} from "../orchestration/square-probe";
import type {
  JointAuditEntry,
  JointAuditLookup,
  JointAuditRecord,
  JointResolutionDeps,
  JointResolutionState,
  JointResolutionStateResult,
} from "../orchestration/resolve-joint-pending";
import type {
  JointCreditStatus,
  JointOutcomeKind,
} from "../orchestration/pending-guards";

/**
 * F60.7 C4 — composição de PRODUÇÃO das portas de `resolveJointPending`.
 *
 * Todas as leituras/efeitos usam o MESMO client injetado (nunca o global quando
 * um client é fornecido). Nenhuma RPC é executada na construção. O módulo não
 * contém rota/UI e não altera o caminho legado de 1:1.
 */

const CREDIT_STATUSES: ReadonlySet<JointCreditStatus> = new Set([
  "reserved",
  "art_uploaded",
  "delivered",
  "refunded",
]);

const LINK_COLUMNS =
  "campaign_id, operation_id, store_id, format, delivery_operation_id, artifact_role";

interface LinkRow {
  readonly campaign_id?: unknown;
  readonly operation_id?: unknown;
  readonly store_id?: unknown;
  readonly format?: unknown;
  readonly delivery_operation_id?: unknown;
  readonly artifact_role?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function creditStatusOf(
  rows: readonly { operation_id?: unknown; status?: unknown }[],
  operationId: string,
): JointCreditStatus | null {
  const row = rows.find((candidate) => candidate.operation_id === operationId);
  if (!row || typeof row.status !== "string") return null;
  return CREDIT_STATUSES.has(row.status as JointCreditStatus)
    ? (row.status as JointCreditStatus)
    : null;
}

function outcomeKindOf(
  rows: readonly { operation_id?: unknown; outcome?: unknown }[],
  operationId: string,
): JointOutcomeKind {
  const row = rows.find((candidate) => candidate.operation_id === operationId);
  if (!row) return "none";
  if (row.outcome === "failed") return "failed";
  if (row.outcome === "unknown") return "unknown";
  return "indeterminate";
}

/**
 * Leitura DIRETA do estado de resolução (não usa a lista de pendências).
 * Terminais `delivered`/`refunded` são representáveis e chegam ao replay do
 * serviço. Falha de campanha/links/crédito/outcome/claim ⇒ fail-closed.
 */
export async function readJointResolutionState(
  client: SupabaseClient,
  input: {
    readonly campaignId: string;
    readonly operationId: string;
    readonly deliveryOperationId: string;
  },
): Promise<JointResolutionStateResult> {
  const campaignResult = await client
    .from("campaigns")
    .select("store_id")
    .eq("id", input.campaignId)
    .maybeSingle();
  if (campaignResult.error) {
    return { kind: "read_failed", reason: campaignResult.error.message };
  }
  const campaign = asRecord(campaignResult.data);
  if (!campaign || typeof campaign.store_id !== "string") {
    return { kind: "absent" };
  }
  const storeId = campaign.store_id;

  const linksResult = await client
    .from("product_two_format_deliveries")
    .select(LINK_COLUMNS)
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId);
  if (linksResult.error) {
    return { kind: "read_failed", reason: linksResult.error.message };
  }
  const links = (linksResult.data ?? []) as LinkRow[];
  const squareLink = links.find((row) => row.format === "1:1");
  const verticalLink = links.find((row) => row.format === "9:16");

  const identityOk = (row: LinkRow | undefined): boolean =>
    row !== undefined &&
    row.campaign_id === input.campaignId &&
    row.operation_id === input.operationId &&
    row.store_id === storeId &&
    typeof row.delivery_operation_id === "string";

  const linkComplete =
    links.length === 2 &&
    identityOk(squareLink) &&
    identityOk(verticalLink) &&
    squareLink?.artifact_role === "square_original" &&
    verticalLink?.artifact_role === "vertical" &&
    squareLink?.delivery_operation_id !== input.operationId &&
    verticalLink?.delivery_operation_id === input.operationId &&
    (squareLink?.delivery_operation_id === input.deliveryOperationId ||
      verticalLink?.delivery_operation_id === input.deliveryOperationId);

  const operationIds = [
    ...new Set(
      [
        input.operationId,
        input.deliveryOperationId,
        typeof squareLink?.delivery_operation_id === "string"
          ? squareLink.delivery_operation_id
          : null,
        typeof verticalLink?.delivery_operation_id === "string"
          ? verticalLink.delivery_operation_id
          : null,
      ].filter((value): value is string => typeof value === "string"),
    ),
  ];

  const [creditsResult, outcomesResult, claimsResult] = await Promise.all([
    client
      .from("product_1_1_campaign_credit_operations")
      .select("operation_id, status")
      .eq("campaign_id", input.campaignId)
      .in("operation_id", operationIds),
    client
      .from("product_generation_operation_outcomes_v")
      .select("operation_id, outcome")
      .eq("campaign_id", input.campaignId)
      .in("operation_id", operationIds),
    client
      .from("product_generation_active_claims_v")
      .select("operation_id")
      .eq("campaign_id", input.campaignId)
      .in("operation_id", operationIds),
  ]);

  if (creditsResult.error) {
    return { kind: "read_failed", reason: creditsResult.error.message };
  }
  if (outcomesResult.error) {
    return { kind: "read_failed", reason: outcomesResult.error.message };
  }
  if (claimsResult.error) {
    return { kind: "read_failed", reason: claimsResult.error.message };
  }

  const credits = (creditsResult.data ?? []) as Array<{
    operation_id?: unknown;
    status?: unknown;
  }>;
  const creditStatus = creditStatusOf(credits, input.deliveryOperationId);
  const sharedCreditStatus = creditStatusOf(credits, input.operationId);
  if (linkComplete && (creditStatus === null || sharedCreditStatus === null)) {
    return { kind: "read_failed", reason: "credit_operation_missing" };
  }

  const outcomes = (outcomesResult.data ?? []) as Array<{
    operation_id?: unknown;
    outcome?: unknown;
  }>;

  const state: JointResolutionState = Object.freeze({
    storeId,
    creditStatus: creditStatus ?? "reserved",
    outcomeKind: outcomeKindOf(outcomes, input.deliveryOperationId),
    sharedOutcomeKind: outcomeKindOf(outcomes, input.operationId),
    sharedCreditStatus: sharedCreditStatus ?? "reserved",
    activeClaim: (claimsResult.data ?? []).length > 0,
    linkComplete,
  });
  return { kind: "found", state };
}

async function writeAudit(
  client: SupabaseClient,
  entry: JointAuditEntry,
): Promise<void> {
  const { error } = await client.from("admin_audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    reason: entry.reason,
    operation_id: entry.operationId,
    metadata: entry.metadata,
  });
  if (error) throw new Error(error.message);
}

async function readAuditByOperationId(
  client: SupabaseClient,
  operationId: string,
): Promise<JointAuditLookup> {
  const { data, error } = await client
    .from("admin_audit_log")
    .select("action, target_type, target_id, operation_id, metadata")
    .eq("operation_id", operationId)
    .maybeSingle();
  if (error) {
    return { kind: "read_failed", reason: error.message };
  }
  const row = asRecord(data);
  if (!row) return { kind: "absent" };
  const metadata = asRecord(row.metadata);
  const record: JointAuditRecord = Object.freeze({
    action: typeof row.action === "string" ? row.action : "",
    targetType: typeof row.target_type === "string" ? row.target_type : "",
    targetId: typeof row.target_id === "string" ? row.target_id : "",
    operationId: typeof row.operation_id === "string" ? row.operation_id : null,
    metadata,
  });
  return { kind: "found", record };
}

export interface JointAdminDepsOptions {
  readonly client?: SupabaseClient;
}

/** Composition root de produção; testável por injeção do client. */
export function createJointAdminDeps(
  options: JointAdminDepsOptions = {},
): JointResolutionDeps {
  const client = options.client ?? supabaseAdmin;
  const credit = new ProductOneToOneCreditOperationClient(client);
  const attempt = new ProductOneToOneAttemptStartClient(client);
  const financial = new TwoFormatJointFinancialClient(client);
  const squareProbe: JointSquareProbe = new CompositionSquareOriginalProbe({
    client,
  });
  const verticalProbe = new CompositionVerticalProbe({ client });

  return {
    readDelivery: (input) => readTwoFormatDelivery(input, { client }),
    readResolutionState: (input) =>
      readJointResolutionState(client, {
        campaignId: input.campaignId,
        operationId: input.operationId,
        deliveryOperationId: input.deliveryOperationId,
      }),
    probeSquare: (input) => squareProbe.probeSquareOriginal(input),
    probeVertical: (input) => verticalProbe.probeVerticalArtifact(input),
    beginPublication: (campaignId, operationId) =>
      credit.beginPublication(campaignId, operationId),
    abortPublication: (campaignId, operationId, token, phase) =>
      credit.abortPublication(campaignId, operationId, token, phase),
    getPublicationEpoch: (campaignId, deliveryOperationId) =>
      credit.getPublicationEpoch(campaignId, deliveryOperationId),
    recordFormatOutcome: async (input) => {
      await attempt.recordOperationOutcome({
        campaignId: input.campaignId,
        operationId: input.operationId,
        outcome: "failed",
      });
    },
    deliverFormat: (input) => financial.deliverFormat(input),
    refundFormat: (input) => financial.refundFormat(input),
    writeAudit: (entry) => writeAudit(client, entry),
    readAuditByOperationId: (operationId) =>
      readAuditByOperationId(client, operationId),
  };
}
