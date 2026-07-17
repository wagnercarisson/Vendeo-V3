export interface RateLimitConfig {
  maxHourly: number;
  maxDaily: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining?: { hourly: number; daily: number };
  resetTime?: string;
  reason?: "hourly_limit_exceeded" | "daily_limit_exceeded";
}

export interface GenerationRateEvent {
  id: string;
  storeId: string;
  userId: string;
  campaignId: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
