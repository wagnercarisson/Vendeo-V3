export interface PipelineEvent {
  event: string;
  traceId: string;
  campaignId?: string;
  storeId?: string;
  userId?: string;
  phase?: string;
  status: string;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

const BASE64_RE = /^[A-Za-z0-9+/=]{100,}$/;

function sanitizeValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (/prompt/i.test(key)) return "[REDACTED]";
    if (BASE64_RE.test(value)) return "[REDACTED]";
  }
  return value;
}

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitize(value as Record<string, unknown>);
    } else {
      result[key] = sanitizeValue(key, value);
    }
  }
  return result;
}

export function logPipelineEvent(event: PipelineEvent): void {
  try {
    const sanitized = sanitize(event as unknown as Record<string, unknown>);
    console.log(JSON.stringify(sanitized));
  } catch {
    // fire-and-forget — never propagates
  }
}
