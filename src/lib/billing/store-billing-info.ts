import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { StoreNotFoundError } from "@/lib/auth/store-ownership";

export interface StoreBillingInfo {
  id: string;
  store_id: string;
  billing_email: string | null;
  billing_phone: string | null;
  billing_address_country: string | null;
  billing_address_street: string | null;
  billing_address_number: string | null;
  billing_address_complement: string | null;
  billing_address_neighborhood: string | null;
  billing_address_city: string | null;
  billing_address_state: string | null;
  billing_address_zipcode: string | null;
  billing_city_ibge_code: string | null;
  billing_data_source: string | null;
  billing_data_last_prefilled_from: string | null;
  billing_data_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type StoreWithBillingInfo = import("@/lib/store").Store & {
  billing_info: StoreBillingInfo | null;
};

async function assertOwnership(storeId: string, userId: string): Promise<void> {
  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("user_id", userId)
    .single();

  if (!store) {
    throw new StoreNotFoundError();
  }
}

export async function getStoreBillingInfo(
  storeId: string,
  userId: string,
): Promise<StoreBillingInfo | null> {
  await assertOwnership(storeId, userId);

  const { data, error } = await supabaseAdmin
    .from("store_billing_info")
    .select("*")
    .eq("store_id", storeId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data as StoreBillingInfo | null;
}

export async function upsertStoreBillingInfo(
  storeId: string,
  userId: string,
  data: Partial<StoreBillingInfo>,
): Promise<StoreBillingInfo> {
  await assertOwnership(storeId, userId);

  const existing = await getStoreBillingInfo(storeId, userId);
  const hasExistingConfirmation = existing?.billing_data_confirmed_at != null;

  const upsertData: Record<string, unknown> = {
    store_id: storeId,
    ...data,
  };

  if (hasExistingConfirmation) {
    upsertData.billing_data_confirmed_at = null;
  }

  const { data: result, error } = await supabaseAdmin
    .from("store_billing_info")
    .upsert(upsertData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return result as StoreBillingInfo;
}
