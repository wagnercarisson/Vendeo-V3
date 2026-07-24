import type { DocumentType } from "./types";

export interface DocumentContentEntry {
  filePath: string;
}

export interface LegalDocumentInfo {
  documentType: DocumentType;
  label: string;
  version: string;
  url: string;
}

const DOCUMENT_CATALOG: Record<DocumentType, Record<string, DocumentContentEntry>> = {
  terms_of_service: {
    "v1.0": { filePath: "/docs/legal/terms-of-service-v1.md" },
    "v1.1": { filePath: "/docs/legal/terms-of-service-v1-1.md" },
  },
  acceptable_use: {
    "v1.0": { filePath: "/docs/legal/acceptable-use-v1.md" },
  },
  privacy_policy: {
    "v1.0": { filePath: "/docs/legal/privacy-policy-v1.md" },
  },
};

export function getDocumentFile(documentType: DocumentType, version: string): string | null {
  return DOCUMENT_CATALOG[documentType]?.[version]?.filePath ?? null;
}

export function getDocumentLabel(documentType: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    terms_of_service: "Termos de Uso",
    privacy_policy: "Política de Privacidade",
    acceptable_use: "Política de Uso Aceitável",
  };
  return labels[documentType];
}

export function getDocumentRoute(documentType: DocumentType): string {
  const routes: Record<DocumentType, string> = {
    terms_of_service: "/termos",
    privacy_policy: "/privacidade",
    acceptable_use: "/uso-aceitavel",
  };
  return routes[documentType];
}

export function buildDocumentInfo(
  documentType: DocumentType,
  version: string,
): LegalDocumentInfo | null {
  const url = getDocumentFile(documentType, version);
  if (!url) return null;
  return {
    documentType,
    label: getDocumentLabel(documentType),
    version,
    url,
  };
}
