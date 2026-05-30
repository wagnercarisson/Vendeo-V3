/**
 * Metrics types for generation telemetry.
 *
 * Stored as JSONL (one JSON object per line), no Zod schema needed.
 * Metrics are best-effort, local-only, never block generation.
 */

export interface GenerationMetrics {
  runId: string;
  timestamp: string;
  environment: "development" | "production" | "benchmark";
  provider: string;
  model: string;
  promptVersion?: string;
  totalDurationMs: number;
  phaseDurationsMs?: Record<string, number>;
  estimatedCostUsd?: number;
  costEstimationSource?: "static_table" | "provider_usage" | "unavailable";
  retryCount: number;
  validationResult?: string;
  inferredCategory?: string;
  conflictsDetected: string[];
  hadOverride: boolean;
  reviewPassed?: boolean;
  reviewFailureType?: string | null;
  rejectionReason?: string;
  technicalError?: string;
  imageIdentifier?: string;
  sanitizedInputs: {
    productName: string;
    storeName: string;
    storeSegment: string;
  };
}

export interface GenerationMetricsEvent {
  runId: string;
  phase: string;
  provider: string;
  model: string;
  elapsedMs: number;
  attempt: number;
  estimatedCostUsd?: number;
}
