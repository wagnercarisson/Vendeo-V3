import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ImageModelTarget,
  ImageQuality,
} from "./image-generation-config-snapshot";

export interface RecordImageGenerationOperationInput {
  campaignId: string;
  snapshotOriginalId: string;
  operationId: string;
  attemptNumber: number;
  target: ImageModelTarget;
  model: string;
  quality: ImageQuality;
  runId?: string;
  traceId?: string;
}

export interface RecordImageGenerationOperationResult {
  id: string;
  operationId: string;
}

export interface ImageGenerationOperation {
  id: string;
  campaignId: string;
  snapshotOriginalId: string;
  operationId: string;
  attemptNumber: number;
  target: ImageModelTarget;
  model: string;
  quality: ImageQuality;
  runId?: string;
  traceId?: string;
  createdAt: string;
}

export interface ImageGenerationOperationsRepository {
  recordOperation(
    input: RecordImageGenerationOperationInput,
  ): Promise<RecordImageGenerationOperationResult>;
  listByOperationId(input: {
    campaignId: string;
    operationId: string;
  }): Promise<ImageGenerationOperation[]>;
}

interface ImageGenerationOperationRow {
  id: string;
  campaign_id: string;
  snapshot_original_id: string;
  operation_id: string;
  attempt_number: number;
  target: ImageModelTarget;
  model: string;
  quality: ImageQuality;
  run_id: string | null;
  trace_id: string | null;
  created_at: string;
}

const TABLE = "image_generation_operations";

const SELECT_COLUMNS =
  "id, campaign_id, snapshot_original_id, operation_id, attempt_number, target, model, quality, run_id, trace_id, created_at";

function mapRowToOperation(row: ImageGenerationOperationRow): ImageGenerationOperation {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    snapshotOriginalId: row.snapshot_original_id,
    operationId: row.operation_id,
    attemptNumber: row.attempt_number,
    target: row.target,
    model: row.model,
    quality: row.quality,
    ...(row.run_id !== null ? { runId: row.run_id } : {}),
    ...(row.trace_id !== null ? { traceId: row.trace_id } : {}),
    createdAt: row.created_at,
  };
}

/** Repositório server-only; o client injetável mantém o acesso testável. */
export class SupabaseImageGenerationOperationsRepository
  implements ImageGenerationOperationsRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async recordOperation(
    input: RecordImageGenerationOperationInput,
  ): Promise<RecordImageGenerationOperationResult> {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({
        campaign_id: input.campaignId,
        snapshot_original_id: input.snapshotOriginalId,
        operation_id: input.operationId,
        attempt_number: input.attemptNumber,
        target: input.target,
        model: input.model,
        quality: input.quality,
        run_id: input.runId ?? null,
        trace_id: input.traceId ?? null,
      })
      .select("id, operation_id")
      .single<{ id: string; operation_id: string }>();

    if (error) {
      throw new Error(`image_generation_operations_insert_failed:${error.message}`);
    }
    if (!data) {
      throw new Error("image_generation_operations_insert_failed:missing_insert_result");
    }

    return { id: data.id, operationId: data.operation_id };
  }

  async listByOperationId(input: {
    campaignId: string;
    operationId: string;
  }): Promise<ImageGenerationOperation[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq("campaign_id", input.campaignId)
      .eq("operation_id", input.operationId)
      .order("attempt_number", { ascending: true })
      .returns<ImageGenerationOperationRow[]>();

    if (error) {
      throw new Error(`image_generation_operations_read_failed:${error.message}`);
    }

    return (data ?? []).map(mapRowToOperation);
  }
}
