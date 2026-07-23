import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { DocumentType, CurrentVersion } from "./types";

export async function getCurrentVersion(
  documentType: DocumentType,
): Promise<CurrentVersion | null> {
  try {
    const { data } = await supabaseAdmin
      .from("legal_document_versions")
      .select("version, effective_at, summary")
      .eq("document_type", documentType)
      .lte("effective_at", new Date().toISOString())
      .order("effective_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    return {
      version: data.version,
      effectiveAt: data.effective_at,
      summary: data.summary,
    };
  } catch {
    return null;
  }
}

export async function getVersionHistory(
  documentType: DocumentType,
): Promise<CurrentVersion[]> {
  const { data } = await supabaseAdmin
    .from("legal_document_versions")
    .select("version, effective_at, summary")
    .eq("document_type", documentType)
    .order("effective_at", { ascending: false });

  return (data ?? []).map((row) => ({
    version: row.version,
    effectiveAt: row.effective_at,
    summary: row.summary,
  }));
}

export async function isVersionCurrent(
  documentType: DocumentType,
  version: string,
): Promise<boolean> {
  const current = await getCurrentVersion(documentType);
  return current?.version === version;
}
