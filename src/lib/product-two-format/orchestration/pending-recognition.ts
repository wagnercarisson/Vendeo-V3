import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { VerticalArtifactProbe } from "@/lib/product-9-16-two-stage/two-stage-financial-service";

import type { JointSquareProbe } from "./square-probe";
import type {
  JointArtifactKind,
  JointCreditStatus,
  JointOutcomeKind,
} from "./pending-guards";

/**
 * F60.7-08 — reconhecimento server-side das pendências conjuntas por formato.
 *
 * Somente LEITURA: vínculos (`product_two_format_deliveries`), crédito próprio e
 * compartilhado, claims ativos e desfechos. A sonda é por PAPEL — o quadrado usa
 * a sonda de composição `square_original` (1024×1024); a sonda 1:1 LEGADA é
 * proibida para a entrega conjunta. Nenhuma escrita, resolução ou assinatura.
 *
 * Lista legitimamente vazia é `ok`: ausência de vínculos ou créditos já
 * terminais não é falha de leitura. `read_failed` só quando a leitura impede
 * reconhecer pendências; vínculos malformados são inconsistência.
 */

const LINKS_TABLE = "product_two_format_deliveries";
const CREDIT_TABLE = "product_1_1_campaign_credit_operations";
const CLAIMS_VIEW = "product_generation_active_claims_v";
const CONTROL_OUTCOMES_TABLE = "product_9_16_two_stage_outcomes";
const SQUARE_OUTCOMES_TABLE = "product_1_1_generation_outcomes";

export interface JointPendingItem {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly format: "1:1" | "9:16";
  readonly deliveryOperationId: string;
  readonly artifactRole: "square_original" | "vertical";
  readonly creditStatus: JointCreditStatus;
  readonly outcomeKind: JointOutcomeKind;
  readonly sharedOutcomeKind: JointOutcomeKind;
  readonly sharedCreditStatus: JointCreditStatus;
  readonly artifactKind: JointArtifactKind;
  readonly activeClaim: boolean;
  readonly linkComplete: boolean;
  readonly supportReference: null;
}

export type JointPendingRecognitionResult =
  | {
      readonly kind: "ok";
      readonly items: readonly JointPendingItem[];
      readonly reasons: readonly string[];
    }
  | { readonly kind: "read_failed"; readonly reason: string }
  | { readonly kind: "inconsistent"; readonly reasons: readonly string[] };

export interface JointPendingRecognitionDeps {
  readonly client: SupabaseClient;
  readonly probeSquare: JointSquareProbe;
  readonly probeVertical: VerticalArtifactProbe;
}

interface LinkRow {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly format: "1:1" | "9:16";
  readonly deliveryOperationId: string;
  readonly artifactRole: "square_original" | "vertical";
}

interface Group {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly rows: LinkRow[];
}

type RowsRead =
  | { readonly ok: true; readonly rows: readonly Record<string, unknown>[] }
  | { readonly ok: false; readonly reason: string };

function toRows(data: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(data)) return null;
  const rows: Record<string, unknown>[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    rows.push({ ...(item as Record<string, unknown>) });
  }
  return rows;
}

function stringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function parseCreditStatus(value: unknown): JointCreditStatus | null {
  if (
    value === "reserved" ||
    value === "art_uploaded" ||
    value === "delivered" ||
    value === "refunded"
  ) {
    return value;
  }
  return null;
}

function parseOutcomeRows(
  rows: readonly Record<string, unknown>[],
): JointOutcomeKind | null {
  if (rows.length === 0) return "none";
  const value = rows[0].outcome;
  if (value === "failed" || value === "unknown") return value;
  return null;
}

function parseLink(row: Record<string, unknown>): LinkRow | string {
  const campaignId = stringField(row, "campaign_id");
  const operationId = stringField(row, "operation_id");
  const storeId = stringField(row, "store_id");
  const deliveryOperationId = stringField(row, "delivery_operation_id");
  const format = row.format;
  const artifactRole = row.artifact_role;
  if (
    campaignId === null ||
    operationId === null ||
    storeId === null ||
    deliveryOperationId === null
  ) {
    return "link_missing_identity";
  }
  if (format !== "1:1" && format !== "9:16") return "link_unknown_format";
  const expectedRole = format === "1:1" ? "square_original" : "vertical";
  if (artifactRole !== expectedRole) return "link_role_mismatch";
  return {
    campaignId,
    operationId,
    storeId,
    format,
    deliveryOperationId,
    artifactRole: expectedRole,
  };
}

async function readLinks(client: SupabaseClient): Promise<RowsRead> {
  const { data, error } = await client
    .from(LINKS_TABLE)
    .select(
      "campaign_id, operation_id, store_id, format, delivery_operation_id, artifact_role",
    );
  if (error) return { ok: false, reason: error.message };
  const rows = toRows(data);
  return rows === null
    ? { ok: false, reason: "invalid_links_rows" }
    : { ok: true, rows };
}

async function readCredit(
  client: SupabaseClient,
  campaignId: string,
  operationId: string,
): Promise<RowsRead> {
  const { data, error } = await client
    .from(CREDIT_TABLE)
    .select("status, store_id")
    .eq("campaign_id", campaignId)
    .eq("operation_id", operationId);
  if (error) return { ok: false, reason: error.message };
  const rows = toRows(data);
  return rows === null
    ? { ok: false, reason: "invalid_credit_rows" }
    : { ok: true, rows };
}

async function readOutcome(
  client: SupabaseClient,
  table: string,
  campaignId: string,
  operationId: string,
): Promise<RowsRead> {
  const { data, error } = await client
    .from(table)
    .select("outcome")
    .eq("campaign_id", campaignId)
    .eq("operation_id", operationId);
  if (error) return { ok: false, reason: error.message };
  const rows = toRows(data);
  return rows === null
    ? { ok: false, reason: "invalid_outcome_rows" }
    : { ok: true, rows };
}

async function readActiveClaim(
  client: SupabaseClient,
  campaignId: string,
  operationId: string,
): Promise<RowsRead> {
  const { data, error } = await client
    .from(CLAIMS_VIEW)
    .select("operation_id")
    .eq("campaign_id", campaignId)
    .eq("operation_id", operationId)
    .eq("status", "in_progress");
  if (error) return { ok: false, reason: error.message };
  const rows = toRows(data);
  return rows === null
    ? { ok: false, reason: "invalid_claim_rows" }
    : { ok: true, rows };
}

async function runArtifactProbe(
  deps: JointPendingRecognitionDeps,
  link: LinkRow,
): Promise<JointArtifactKind> {
  try {
    if (link.format === "1:1") {
      const probe = await deps.probeSquare.probeSquareOriginal({
        storeId: link.storeId,
        campaignId: link.campaignId,
        operationId: link.operationId,
      });
      return probe.kind;
    }
    const probe = await deps.probeVertical.probeVerticalArtifact({
      storeId: link.storeId,
      campaignId: link.campaignId,
      operationId: link.operationId,
    });
    return probe.kind;
  } catch {
    return "indeterminate";
  }
}

function pairComplete(group: Group): boolean {
  const squares = group.rows.filter(
    (row) => row.format === "1:1" && row.artifactRole === "square_original",
  );
  const verticals = group.rows.filter(
    (row) => row.format === "9:16" && row.artifactRole === "vertical",
  );
  if (group.rows.length !== 2 || squares.length !== 1 || verticals.length !== 1) {
    return false;
  }
  const square = squares[0];
  const vertical = verticals[0];
  return (
    square.deliveryOperationId !== group.operationId &&
    vertical.deliveryOperationId === group.operationId &&
    group.rows.every(
      (row) =>
        row.campaignId === group.campaignId &&
        row.operationId === group.operationId &&
        row.storeId === group.storeId,
    )
  );
}

async function buildGroup(
  deps: JointPendingRecognitionDeps,
  group: Group,
  reasons: string[],
  state: { readErrors: number },
): Promise<JointPendingItem[]> {
  const sharedCredit = await readCredit(
    deps.client,
    group.campaignId,
    group.operationId,
  );
  if (!sharedCredit.ok) {
    state.readErrors += 1;
    reasons.push(`shared_credit_read_failed:${sharedCredit.reason}`);
    return [];
  }
  const sharedCreditStatus = parseCreditStatus(sharedCredit.rows[0]?.status);
  if (sharedCreditStatus === null) {
    state.readErrors += 1;
    reasons.push("shared_credit_invalid_status");
    return [];
  }

  const claims = await readActiveClaim(
    deps.client,
    group.campaignId,
    group.operationId,
  );
  if (!claims.ok) {
    state.readErrors += 1;
    reasons.push(`active_claim_read_failed:${claims.reason}`);
    return [];
  }
  const activeClaim = claims.rows.length > 0;

  const sharedOutcomeRead = await readOutcome(
    deps.client,
    CONTROL_OUTCOMES_TABLE,
    group.campaignId,
    group.operationId,
  );
  const sharedOutcomeKind: JointOutcomeKind = !sharedOutcomeRead.ok
    ? "indeterminate"
    : (parseOutcomeRows(sharedOutcomeRead.rows) ?? "indeterminate");
  if (!sharedOutcomeRead.ok || parseOutcomeRows(sharedOutcomeRead.rows) === null) {
    reasons.push("shared_outcome_indeterminate");
  }

  const linkComplete = pairComplete(group);
  if (!linkComplete) {
    reasons.push(`pair_incomplete:${group.campaignId}:${group.operationId}`);
  }

  const items: JointPendingItem[] = [];
  for (const link of group.rows) {
    const credit = await readCredit(
      deps.client,
      group.campaignId,
      link.deliveryOperationId,
    );
    if (!credit.ok) {
      state.readErrors += 1;
      reasons.push(`credit_read_failed:${link.format}:${credit.reason}`);
      continue;
    }
    const creditStatus = parseCreditStatus(credit.rows[0]?.status);
    if (creditStatus === null) {
      reasons.push(`credit_invalid_status:${link.format}`);
      continue;
    }
    if (creditStatus !== "reserved" && creditStatus !== "art_uploaded") {
      continue;
    }
    const creditStore = stringField(credit.rows[0] ?? {}, "store_id");
    if (creditStore !== null && creditStore !== group.storeId) {
      reasons.push(`credit_store_mismatch:${link.format}`);
    }

    let outcomeKind: JointOutcomeKind;
    if (link.format === "9:16") {
      outcomeKind = sharedOutcomeKind;
    } else {
      const own = await readOutcome(
        deps.client,
        SQUARE_OUTCOMES_TABLE,
        group.campaignId,
        link.deliveryOperationId,
      );
      outcomeKind = !own.ok
        ? "indeterminate"
        : (parseOutcomeRows(own.rows) ?? "indeterminate");
      if (!own.ok || parseOutcomeRows(own.rows) === null) {
        reasons.push("square_outcome_indeterminate");
      }
    }

    const artifactKind = await runArtifactProbe(deps, link);
    if (artifactKind === "indeterminate") {
      reasons.push(`probe_indeterminate:${link.format}`);
    }

    items.push(
      Object.freeze({
        campaignId: group.campaignId,
        operationId: group.operationId,
        storeId: group.storeId,
        format: link.format,
        deliveryOperationId: link.deliveryOperationId,
        artifactRole: link.artifactRole,
        creditStatus,
        outcomeKind,
        sharedOutcomeKind,
        sharedCreditStatus,
        artifactKind,
        activeClaim,
        linkComplete,
        supportReference: null,
      }),
    );
  }
  return items;
}

function sortItems(items: JointPendingItem[]): JointPendingItem[] {
  const order: Record<"1:1" | "9:16", number> = { "1:1": 0, "9:16": 1 };
  return [...items].sort((left, right) => order[left.format] - order[right.format]);
}

export async function listJointPendingOperations(
  deps: JointPendingRecognitionDeps,
): Promise<JointPendingRecognitionResult> {
  const links = await readLinks(deps.client);
  if (!links.ok) return { kind: "read_failed", reason: links.reason };
  if (links.rows.length === 0) {
    return { kind: "ok", items: [], reasons: [] };
  }

  const reasons: string[] = [];
  const groups = new Map<string, Group>();
  for (const raw of links.rows) {
    const parsed = parseLink(raw);
    if (typeof parsed === "string") {
      reasons.push(parsed);
      continue;
    }
    const key = `${parsed.campaignId}|${parsed.operationId}`;
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.rows.push(parsed);
      continue;
    }
    groups.set(key, {
      campaignId: parsed.campaignId,
      operationId: parsed.operationId,
      storeId: parsed.storeId,
      rows: [parsed],
    });
  }

  const state = { readErrors: 0 };
  const items: JointPendingItem[] = [];
  for (const group of groups.values()) {
    const built = await buildGroup(deps, group, reasons, state);
    items.push(...built);
  }

  if (items.length === 0) {
    if (state.readErrors > 0) {
      return { kind: "read_failed", reason: reasons[0] ?? "read_failed" };
    }
    if (reasons.length > 0) return { kind: "inconsistent", reasons };
    return { kind: "ok", items: [], reasons: [] };
  }
  return { kind: "ok", items: sortItems(items), reasons };
}
