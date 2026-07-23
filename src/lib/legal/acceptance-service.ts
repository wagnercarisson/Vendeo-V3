import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  RegisterAcceptanceParams,
  AcceptanceStatus,
  DocumentType,
} from "./types";
import { getCurrentVersion } from "./document-versions";

export async function registerAcceptance(
  params: RegisterAcceptanceParams,
): Promise<void> {
  const current = await getCurrentVersion(params.documentType);
  if (!current) {
    throw new Error(
      `No published version for document type: ${params.documentType}`,
    );
  }

  const { error } = await supabaseAdmin.from("legal_acceptances").insert({
    store_id: params.storeId,
    accepted_by_user_id: params.userId,
    document_type: params.documentType,
    document_version: current.version,
    accepted_at: new Date().toISOString(),
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    acceptance_source: params.source,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export async function registerAllContractAcceptances(
  params: Omit<RegisterAcceptanceParams, "documentType">,
): Promise<void> {
  await registerAcceptance({ ...params, documentType: "terms_of_service" });
  await registerAcceptance({ ...params, documentType: "acceptable_use" });
}

export async function getAcceptanceStatus(
  storeId: string,
  documentType: DocumentType,
): Promise<AcceptanceStatus> {
  const current = await getCurrentVersion(documentType);
  if (!current) return "never";

  const { data } = await supabaseAdmin
    .from("legal_acceptances")
    .select("document_version")
    .eq("store_id", storeId)
    .eq("document_type", documentType)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return "never";
  if (data.document_version === current.version) return "current";
  return "outdated";
}

export async function getStoreAcceptanceHistory(
  storeId: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await supabaseAdmin
    .from("legal_acceptances")
    .select("*")
    .eq("store_id", storeId)
    .order("accepted_at", { ascending: false });

  return (data ?? []) as Record<string, unknown>[];
}
