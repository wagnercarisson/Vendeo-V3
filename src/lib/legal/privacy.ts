import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RegisterPrivacyAcknowledgementParams } from "./types";
import { getCurrentVersion } from "./document-versions";

export async function registerPrivacyAcknowledgement(
  params: RegisterPrivacyAcknowledgementParams,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("privacy_acknowledgements")
    .upsert(
      {
        user_id: params.userId,
        privacy_policy_version: params.version,
        acknowledged_at: new Date().toISOString(),
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

export async function hasValidPrivacyAcknowledgement(
  userId: string,
): Promise<boolean> {
  const current = await getCurrentVersion("privacy_policy");
  if (!current) return false;

  const { data } = await supabaseAdmin
    .from("privacy_acknowledgements")
    .select("privacy_policy_version")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.privacy_policy_version === current.version;
}
