import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getDocumentLabel, getDocumentFile } from "@/lib/legal/document-content";
import type { DocumentType } from "@/lib/legal/types";

const ALL_DOCUMENT_TYPES: DocumentType[] = ["terms_of_service", "privacy_policy", "acceptable_use"];

export async function GET() {
  try {
    const now = new Date().toISOString();
    const versions: Record<string, { version: string; label: string; url: string | null } | null> = {};

    for (const docType of ALL_DOCUMENT_TYPES) {
      const { data } = await supabaseAdmin
        .from("legal_document_versions")
        .select("version, effective_at, summary")
        .eq("document_type", docType)
        .lte("effective_at", now)
        .order("effective_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        versions[docType] = {
          version: data.version,
          label: getDocumentLabel(docType),
          url: getDocumentFile(docType, data.version),
        };
      } else {
        versions[docType] = null;
      }
    }

    return NextResponse.json({ versions }, { status: 200 });
  } catch (error) {
    console.error("[current-versions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch current versions" },
      { status: 500 },
    );
  }
}
