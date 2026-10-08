import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  StageAuthorizationEvent,
  ProductFlowScope,
  ProductFlowStage,
  StageAuthorizationEventType,
} from "./types";

const SELECT_COLUMNS =
  "event_type, stage, scope, instance_identity, granted_by, reason, operation_id, expires_at, created_at, seq";

export interface StageAuthorizationQuery {
  readonly scope: ProductFlowScope;
  readonly instanceIdentity: string;
}

export interface StageAuthorizationRepository {
  listEvents(query: StageAuthorizationQuery): Promise<StageAuthorizationEvent[]>;
}

interface StageAuthorizationRow {
  event_type: string;
  stage: string;
  scope: string;
  instance_identity: string;
  granted_by: string | null;
  reason: string;
  operation_id: string;
  expires_at: string | null;
  created_at: string;
  seq: number;
}

function parseTimestamp(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function mapRow(row: StageAuthorizationRow): StageAuthorizationEvent {
  return Object.freeze({
    eventType: row.event_type as StageAuthorizationEventType,
    stage: row.stage as ProductFlowStage,
    scope: row.scope as ProductFlowScope,
    instanceIdentity: row.instance_identity,
    grantedBy: row.granted_by,
    reason: row.reason,
    operationId: row.operation_id,
    expiresAtMs: parseTimestamp(row.expires_at),
    createdAtMs: parseTimestamp(row.created_at) ?? 0,
    seq: Number(row.seq),
  });
}

/** Repositório server-only de leitura do histórico append-only. */
export class SupabaseStageAuthorizationRepository
  implements StageAuthorizationRepository
{
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async listEvents(
    query: StageAuthorizationQuery,
  ): Promise<StageAuthorizationEvent[]> {
    const { data, error } = await this.client
      .from("product_flow_stage_authorizations")
      .select(SELECT_COLUMNS)
      .eq("scope", query.scope)
      .eq("instance_identity", query.instanceIdentity)
      .order("created_at", { ascending: true })
      .order("seq", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapRow(row as StageAuthorizationRow));
  }
}
