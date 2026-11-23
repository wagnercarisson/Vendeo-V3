import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import type { FormatAdditionSourceOrigin } from "./types";

/**
 * F62/62-03 — Leitor canônico e sanitizado da adição de formato.
 *
 * Server-only. Lê o vínculo durável; a prioridade é `open`/`delivered` mais
 * recente e, somente se não houver, `refunded` mais recente. O DTO nunca contém
 * path, URL, snapshot, bytes ou credencial. `operationId`/`requestId` são
 * internos ao servidor e não devem ser enviados ao cliente.
 */

export type FormatAdditionReadState =
  | "delivered"
  | "processing"
  | "unknown"
  | "refunded";

export type FormatAdditionLinkStatus = "open" | "delivered" | "refunded";

export interface FormatAdditionRow {
  readonly operationId: string;
  readonly storeId: string;
  readonly campaignId: string;
  readonly sourceOrigin: FormatAdditionSourceOrigin;
  readonly sourceArtifactId: string;
  readonly sourceRegistrationOperationId: string;
  readonly status: FormatAdditionLinkStatus;
  readonly requestId: string;
  readonly createdAt: string;
}

export interface FormatAdditionReadDto {
  readonly state: FormatAdditionReadState;
  readonly sourceOrigin: FormatAdditionSourceOrigin | null;
  readonly refunded: boolean;
  /** Identidade interna; nunca enviar ao cliente. */
  readonly operationId: string | null;
  /** Identidade interna de suporte; nunca enviar ao cliente. */
  readonly requestId: string | null;
  readonly sourceArtifactId: string | null;
  readonly sourceRegistrationOperationId: string | null;
  readonly createdAt: string | null;
}

export type FormatAdditionReadResult =
  | { readonly kind: "found"; readonly addition: FormatAdditionReadDto }
  | { readonly kind: "none" }
  | { readonly kind: "read_failed" };

export interface FormatAdditionReadFilter {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId?: string;
  readonly requestId?: string;
  readonly sourceArtifactId?: string;
}

export type FormatAdditionRowsRead =
  | { readonly kind: "ok"; readonly rows: readonly FormatAdditionRow[] }
  | { readonly kind: "read_failed" };

export type FormatAdditionCreditRead =
  | { readonly kind: "found"; readonly status: string }
  | { readonly kind: "missing" }
  | { readonly kind: "read_failed" };

export type FormatAdditionOutcomeRead =
  | { readonly kind: "found"; readonly outcome: string }
  | { readonly kind: "missing" }
  | { readonly kind: "read_failed" };

export interface FormatAdditionReaderDeps {
  readonly client?: SupabaseClient;
  readonly readRows?: (filter: FormatAdditionReadFilter) => Promise<FormatAdditionRowsRead>;
  readonly readCredit?: (input: {
    readonly campaignId: string;
    readonly operationId: string;
  }) => Promise<FormatAdditionCreditRead>;
  readonly readOutcome?: (input: {
    readonly campaignId: string;
    readonly operationId: string;
  }) => Promise<FormatAdditionOutcomeRead>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_COLUMNS =
  "operation_id, store_id, campaign_id, source_origin, source_artifact_id, source_registration_operation_id, status, request_id, created_at";

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapRow(row: unknown): FormatAdditionRow | null {
  if (!isRecord(row)) return null;
  const status = row.status;
  const origin = row.source_origin;
  if (
    typeof row.operation_id !== "string" ||
    typeof row.store_id !== "string" ||
    typeof row.campaign_id !== "string" ||
    typeof origin !== "string" ||
    (origin !== "new_flow_1_1" && origin !== "legacy_campaign") ||
    typeof row.source_artifact_id !== "string" ||
    typeof row.source_registration_operation_id !== "string" ||
    typeof status !== "string" ||
    (status !== "open" && status !== "delivered" && status !== "refunded") ||
    typeof row.request_id !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }
  return Object.freeze({
    operationId: row.operation_id,
    storeId: row.store_id,
    campaignId: row.campaign_id,
    sourceOrigin: origin,
    sourceArtifactId: row.source_artifact_id,
    sourceRegistrationOperationId: row.source_registration_operation_id,
    status,
    requestId: row.request_id,
    createdAt: row.created_at,
  });
}

async function defaultReadRows(
  client: SupabaseClient,
  filter: FormatAdditionReadFilter,
): Promise<FormatAdditionRowsRead> {
  try {
    let query = client
      .from("campaign_format_additions")
      .select(SELECT_COLUMNS)
      .eq("store_id", filter.storeId.toLowerCase())
      .eq("campaign_id", filter.campaignId.toLowerCase());

    if (filter.operationId !== undefined) {
      query = query.eq("operation_id", filter.operationId.toLowerCase());
    }
    if (filter.requestId !== undefined) {
      query = query.eq("request_id", filter.requestId.toLowerCase());
    }
    if (filter.sourceArtifactId !== undefined) {
      query = query.eq("source_artifact_id", filter.sourceArtifactId.toLowerCase());
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error || !Array.isArray(data)) return { kind: "read_failed" };

    const rows: FormatAdditionRow[] = [];
    for (const entry of data) {
      const mapped = mapRow(entry);
      if (mapped === null) return { kind: "read_failed" };
      rows.push(mapped);
    }
    return { kind: "ok", rows };
  } catch {
    return { kind: "read_failed" };
  }
}

async function defaultReadCredit(
  client: SupabaseClient,
  input: { campaignId: string; operationId: string },
): Promise<FormatAdditionCreditRead> {
  try {
    const { data, error } = await client
      .from("product_1_1_campaign_credit_operations")
      .select("status")
      .eq("campaign_id", input.campaignId.toLowerCase())
      .eq("operation_id", input.operationId.toLowerCase())
      .maybeSingle();
    if (error) return { kind: "read_failed" };
    if (!isRecord(data) || typeof data.status !== "string") {
      return { kind: "missing" };
    }
    return { kind: "found", status: data.status };
  } catch {
    return { kind: "read_failed" };
  }
}

async function defaultReadOutcome(
  client: SupabaseClient,
  input: { campaignId: string; operationId: string },
): Promise<FormatAdditionOutcomeRead> {
  try {
    const { data, error } = await client
      .from("product_generation_operation_outcomes_v")
      .select("outcome")
      .eq("campaign_id", input.campaignId.toLowerCase())
      .eq("operation_id", input.operationId.toLowerCase())
      .maybeSingle();
    if (error) return { kind: "read_failed" };
    if (!isRecord(data) || typeof data.outcome !== "string") {
      return { kind: "missing" };
    }
    return { kind: "found", outcome: data.outcome };
  } catch {
    return { kind: "read_failed" };
  }
}

function isValidRow(row: FormatAdditionRow): boolean {
  return (
    isUuid(row.operationId) &&
    isUuid(row.storeId) &&
    isUuid(row.campaignId) &&
    (row.sourceOrigin === "new_flow_1_1" ||
      row.sourceOrigin === "legacy_campaign") &&
    isUuid(row.sourceArtifactId) &&
    isUuid(row.sourceRegistrationOperationId) &&
    (row.status === "open" ||
      row.status === "delivered" ||
      row.status === "refunded") &&
    isUuid(row.requestId) &&
    typeof row.createdAt === "string" &&
    Number.isFinite(Date.parse(row.createdAt))
  );
}

function pickPreferred(rows: readonly FormatAdditionRow[]): FormatAdditionRow | null {
  const sorted = [...rows].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const active = sorted.find(
    (row) => row.status === "open" || row.status === "delivered",
  );
  if (active !== undefined) return active;
  return sorted.find((row) => row.status === "refunded") ?? null;
}

function dtoFor(
  row: FormatAdditionRow,
  state: FormatAdditionReadState,
): FormatAdditionReadDto {
  return Object.freeze({
    state,
    sourceOrigin: row.sourceOrigin,
    refunded: state === "refunded",
    operationId: row.operationId,
    requestId: row.requestId,
    sourceArtifactId: row.sourceArtifactId,
    sourceRegistrationOperationId: row.sourceRegistrationOperationId,
    createdAt: row.createdAt,
  });
}

async function resolveState(
  row: FormatAdditionRow,
  deps: {
    readonly readCredit: (input: {
      readonly campaignId: string;
      readonly operationId: string;
    }) => Promise<FormatAdditionCreditRead>;
    readonly readOutcome: (input: {
      readonly campaignId: string;
      readonly operationId: string;
    }) => Promise<FormatAdditionOutcomeRead>;
  },
): Promise<FormatAdditionReadState | "read_failed"> {
  if (row.status === "delivered") return "delivered";
  if (row.status === "refunded") return "refunded";

  const [credit, outcome] = await Promise.all([
    deps.readCredit({ campaignId: row.campaignId, operationId: row.operationId }),
    deps.readOutcome({ campaignId: row.campaignId, operationId: row.operationId }),
  ]);
  if (credit.kind === "read_failed" || outcome.kind === "read_failed") {
    return "read_failed";
  }
  if (credit.kind === "found") {
    if (credit.status === "delivered") return "delivered";
    if (credit.status === "refunded") return "refunded";
    if (
      credit.status !== "reserved" &&
      credit.status !== "art_uploaded"
    ) {
      return "unknown";
    }
  }
  if (credit.kind === "missing") return "unknown";
  if (outcome.kind === "found" && outcome.outcome === "unknown") return "unknown";
  return "processing";
}

function validateBase(filter: {
  readonly storeId: string;
  readonly campaignId: string;
}): boolean {
  return isUuid(filter.storeId) && isUuid(filter.campaignId);
}

function depsOrDefaults(deps: FormatAdditionReaderDeps) {
  const client = deps.client ?? supabaseAdmin;
  return {
    readRows:
      deps.readRows ?? ((filter: FormatAdditionReadFilter) => defaultReadRows(client, filter)),
    readCredit:
      deps.readCredit ?? ((input: { campaignId: string; operationId: string }) => defaultReadCredit(client, input)),
    readOutcome:
      deps.readOutcome ?? ((input: { campaignId: string; operationId: string }) => defaultReadOutcome(client, input)),
  };
}

export async function readFormatAdditionByCampaign(
  input: { readonly storeId: string; readonly campaignId: string },
  deps: FormatAdditionReaderDeps = {},
): Promise<FormatAdditionReadResult> {
  if (!validateBase(input)) return { kind: "read_failed" };
  const resolved = depsOrDefaults(deps);
  const rows = await resolved.readRows({
    storeId: input.storeId,
    campaignId: input.campaignId,
  });
  if (rows.kind === "read_failed") return { kind: "read_failed" };
  if (!rows.rows.every(isValidRow)) return { kind: "read_failed" };
  const row = pickPreferred(rows.rows);
  if (row === null) return { kind: "none" };
  const state = await resolveState(row, resolved);
  if (state === "read_failed") return { kind: "read_failed" };
  return { kind: "found", addition: dtoFor(row, state) };
}

export type FormatAdditionIdentityReadInput =
  | { readonly storeId: string; readonly campaignId: string; readonly operationId: string }
  | { readonly storeId: string; readonly campaignId: string; readonly requestId: string }
  | { readonly storeId: string; readonly campaignId: string; readonly sourceArtifactId: string };

export async function readFormatAdditionByIdentity(
  input: FormatAdditionIdentityReadInput,
  deps: FormatAdditionReaderDeps = {},
): Promise<FormatAdditionReadResult> {
  if (!validateBase(input)) return { kind: "read_failed" };

  const keys = ["operationId", "requestId", "sourceArtifactId"] as const;
  const present = keys.filter((key) => key in input);
  if (present.length !== 1) return { kind: "read_failed" };

  const selected = present[0];
  const value = (input as Record<string, unknown>)[selected];
  if (!isUuid(value)) return { kind: "read_failed" };

  const resolved = depsOrDefaults(deps);
  const rows = await resolved.readRows({
    storeId: input.storeId,
    campaignId: input.campaignId,
    [selected]: value,
  });
  if (rows.kind === "read_failed") return { kind: "read_failed" };
  if (!rows.rows.every(isValidRow)) return { kind: "read_failed" };
  const row = pickPreferred(rows.rows);
  if (row === null) return { kind: "none" };
  const state = await resolveState(row, resolved);
  if (state === "read_failed") return { kind: "read_failed" };
  return { kind: "found", addition: dtoFor(row, state) };
}
