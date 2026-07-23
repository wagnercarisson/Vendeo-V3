import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RecordConsentEventParams } from "./types";

export async function recordConsentEvent(
  params: RecordConsentEventParams,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_consent_events")
    .insert({
      user_id: params.userId,
      consent_type: params.consentType,
      action: params.action,
      occurred_at: new Date().toISOString(),
      policy_version: params.policyVersion,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      source: params.source,
    });

  if (error) throw error;
}

export async function getEffectiveConsent(
  userId: string,
  consentType: "commercial_communications",
): Promise<"granted" | "revoked" | "never_set"> {
  const { data } = await supabaseAdmin
    .from("user_consent_events")
    .select("action")
    .eq("user_id", userId)
    .eq("consent_type", consentType)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return "never_set";
  return data.action as "granted" | "revoked";
}

export async function revokeConsent(
  userId: string,
  consentType: "commercial_communications",
  params: {
    policyVersion: string;
    ipAddress: string;
    userAgent: string;
    source: "signup" | "account_settings";
  },
): Promise<void> {
  await recordConsentEvent({
    userId,
    consentType,
    action: "revoked",
    policyVersion: params.policyVersion,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    source: params.source,
  });
}
