import "server-only";
import type {
  LegalCapability,
  DocumentType,
  ClearanceParams,
  ClearanceResult,
} from "./types";
import { getAcceptanceStatus } from "./acceptance-service";
import { getCurrentVersion } from "./document-versions";

export const CAPABILITY_DOCUMENTS: Record<LegalCapability, DocumentType[]> = {
  content_generation: ["terms_of_service", "acceptable_use"],
};

export const CAPABILITY_TREE: Record<string, string[]> = {
  content_generation: [
    "campaigns.create",
    "visual_signatures.create",
    "exports.create",
  ],
};

async function hasValidAcceptance(
  storeId: string,
  docType: DocumentType,
): Promise<boolean> {
  const status = await getAcceptanceStatus(storeId, docType);
  return status === "current";
}

export async function requireLegalClearance(
  params: ClearanceParams,
): Promise<ClearanceResult> {
  const requiredDocuments = CAPABILITY_DOCUMENTS[params.capability];

  if (!requiredDocuments) {
    return { ok: true };
  }

  // If legal system is not set up, block generation.
  // Previously this short-circuited to allow through, which was unsafe:
  // permission errors or missing versions silently bypassed the guard.
  const termsVersion = await getCurrentVersion("terms_of_service");
  const aupVersion = await getCurrentVersion("acceptable_use");
  if (!termsVersion || !aupVersion) {
    console.warn(`[legal] requireLegalClearance: no published versions — blocking. terms=${!!termsVersion} aup=${!!aupVersion}`);
    return {
      ok: false,
      reason: "Sistema legal indisponível.",
      requiredDocuments: ["terms_of_service", "acceptable_use"],
    };
  }

  const pending: DocumentType[] = [];

  for (const docType of requiredDocuments) {
    const accepted = await hasValidAcceptance(params.storeId, docType);
    if (!accepted) {
      pending.push(docType);
    }
  }

  if (pending.length > 0) {
    return {
      ok: false,
      reason: "Documentos pendentes de aceitação.",
      requiredDocuments: pending,
    };
  }

  return { ok: true };
}
