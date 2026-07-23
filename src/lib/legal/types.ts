export type LegalCapability = "content_generation";

export type DocumentType = "terms_of_service" | "privacy_policy" | "acceptable_use";

export type AcceptanceSource = "onboarding" | "login_reacceptance" | "admin_invite";

export type ConsentType = "commercial_communications";

export type ConsentAction = "granted" | "revoked";

export type AcceptanceStatus = "current" | "outdated" | "never";

export interface RegisterPrivacyAcknowledgementParams {
  userId: string;
  version: string;
  ipAddress: string;
  userAgent: string;
}

export interface RegisterAcceptanceParams {
  storeId: string;
  userId: string;
  documentType: DocumentType;
  ipAddress: string;
  userAgent: string;
  source: AcceptanceSource;
}

export interface RecordConsentEventParams {
  userId: string;
  consentType: ConsentType;
  action: ConsentAction;
  policyVersion: string;
  ipAddress: string;
  userAgent: string;
  source: "signup" | "account_settings";
}

export interface ClearanceParams {
  storeId: string;
  userId: string;
  capability: LegalCapability;
}

export type ClearanceResult =
  | { ok: true }
  | { ok: false; reason: string; requiredDocuments: DocumentType[] };

export interface CurrentVersion {
  version: string;
  effectiveAt: string;
  summary: string | null;
}
