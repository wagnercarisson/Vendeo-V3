import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

export type ProductEventType =
  | "demo_granted"
  | "first_generation"
  | "demo_exhausted"
  | "demo_expired"
  | "support_credit_request";

export interface ProductEventInput {
  store_id?: string | null;
  user_id?: string | null;
  dedup_key: string;
  properties?: Record<string, unknown>;
}

export class ProductEventService {
  constructor(private readonly client = supabaseAdmin) {}

  async record(eventType: ProductEventType, input: ProductEventInput): Promise<void> {
    try {
      const { error } = await this.client.from("product_events").upsert(
        {
          event_type: eventType,
          store_id: input.store_id ?? null,
          user_id: input.user_id ?? null,
          dedup_key: input.dedup_key,
          properties: input.properties ?? {},
        },
        { onConflict: "event_type,dedup_key", ignoreDuplicates: true },
      );
      if (error) {
        console.warn("[product-events] best-effort write failed", error);
      }
    } catch (error) {
      console.warn("[product-events] best-effort write failed", error);
    }
  }
}
