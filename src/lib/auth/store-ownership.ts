import { createServerClient } from "@/lib/supabase/server";
import { requireUser, requireApiUser } from "@/lib/auth/require-user";
import type { Store } from "@/lib/store";
import { StoreNotFoundError, UnauthorizedError } from "./errors";

export { StoreNotFoundError };

export type AuthorizedStoreContext = {
  userId: string;
  storeId: string;
  store: Store;
};

export async function getCurrentStore(userId?: string): Promise<Store | null> {
  let effectiveUserId = userId;

  if (!effectiveUserId) {
    const user = await requireUser();
    effectiveUserId = user.userId;
  }

  const supabase = await createServerClient();

  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("user_id", effectiveUserId)
    .maybeSingle();

  return data as Store | null;
}

export async function requireOwnership(storeId: string, userId?: string): Promise<Store> {
  let effectiveUserId = userId;

  if (!effectiveUserId) {
    const user = await requireUser();
    effectiveUserId = user.userId;
  }

  const supabase = await createServerClient();

  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .eq("user_id", effectiveUserId)
    .maybeSingle();

  if (!data) {
    throw new StoreNotFoundError();
  }

  return data as Store;
}

export async function requireAuthorizedStore(storeId: string): Promise<AuthorizedStoreContext> {
  const user = await requireApiUser();
  const store = await requireOwnership(storeId, user.userId);
  return { userId: user.userId, storeId: store.id, store };
}
