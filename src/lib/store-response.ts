import type { Store } from "@/lib/store";
import { resolveStoreIdentity } from "@/lib/actions/store";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";

export interface EnrichedStoreResponse extends Store {
  identity: StoreIdentitySnapshot;
  visual_signature_url: string | null;
  logo_url: string | null;
  has_archived_signatures: boolean;
}

export async function buildStoreResponse(store: Store): Promise<EnrichedStoreResponse> {
  const identity = await resolveStoreIdentity(store);

  const { count: archivedCount } = await supabaseAdmin
    .from("store_visual_signatures")
    .select("*", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("status", "archived");

  return {
    ...store,
    identity,
    visual_signature_url: identity.signature.type === 'visual_signature' ? identity.signature.url : null,
    logo_url: identity.signature.type === 'logo' ? identity.signature.url : store.logo_url,
    has_archived_signatures: (archivedCount ?? 0) > 0,
  };
}
