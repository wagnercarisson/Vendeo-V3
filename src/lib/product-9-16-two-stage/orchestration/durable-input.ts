import "server-only";

import { hashImageDataUrl } from "@/lib/campaign/square-base/frozen-state";
import type {
  CampaignResumeContext,
  DurableInputDescriptor,
} from "./types";

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export type DescribeDurableInputInput = {
  readonly kind: "product" | "identity";
  readonly role: DurableInputDescriptor["role"];
  readonly index: number;
  readonly storagePath: string;
  readonly mimeType: string;
  readonly dataUrl: string;
};

export type DescribeDurableInputResult =
  | { readonly ok: true; readonly descriptor: DurableInputDescriptor }
  | { readonly ok: false; readonly reason: "not_reconstructible" };

export type ParseResumeContextResult =
  | { readonly ok: true; readonly context: CampaignResumeContext }
  | { readonly ok: false; readonly reason: "missing" | "malformed" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseDataUrlExact(
  dataUrl: unknown,
): { readonly ok: true; readonly mimeType: string; readonly prefix: string; readonly base64: string } | { readonly ok: false } {
  if (typeof dataUrl !== "string") return { ok: false };
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return { ok: false };
  const [, mimeType, base64] = match;
  try {
    const decoded = Buffer.from(base64, "base64");
    if (decoded.toString("base64") !== base64) return { ok: false };
    return {
      ok: true,
      mimeType,
      prefix: `data:${mimeType};base64,`,
      base64,
    };
  } catch {
    return { ok: false };
  }
}

export function reconstructDataUrl(prefix: string, bytes: Buffer): string {
  return `${prefix}${bytes.toString("base64")}`;
}

export function isReconstructibleDataUrl(dataUrl: unknown): boolean {
  const parsed = parseDataUrlExact(dataUrl);
  if (!parsed.ok) return false;
  const bytes = Buffer.from(parsed.base64, "base64");
  return reconstructDataUrl(parsed.prefix, bytes) === dataUrl;
}

export function describeDurableInput(
  input: DescribeDurableInputInput,
): DescribeDurableInputResult {
  const parsed = parseDataUrlExact(input.dataUrl);
  if (!parsed.ok) return { ok: false, reason: "not_reconstructible" };
  if (input.mimeType !== parsed.mimeType) {
    return { ok: false, reason: "not_reconstructible" };
  }
  const bytes = Buffer.from(parsed.base64, "base64");
  if (reconstructDataUrl(parsed.prefix, bytes) !== input.dataUrl) {
    return { ok: false, reason: "not_reconstructible" };
  }
  return {
    ok: true,
    descriptor: Object.freeze({
      kind: input.kind,
      role: input.role,
      index: input.index,
      contentId: hashImageDataUrl(input.dataUrl),
      storagePath: input.storagePath,
      mimeType: parsed.mimeType,
      dataUrlPrefix: parsed.prefix,
      byteSize: bytes.byteLength,
    }),
  };
}

export function verifyReconstructedInput(
  descriptor: DurableInputDescriptor,
  bytes: Buffer,
): { readonly ok: true; readonly dataUrl: string } | { readonly ok: false; readonly reason: "hash_mismatch" | "size_mismatch" } {
  if (bytes.byteLength !== descriptor.byteSize) {
    return { ok: false, reason: "size_mismatch" };
  }
  const dataUrl = reconstructDataUrl(descriptor.dataUrlPrefix, bytes);
  if (hashImageDataUrl(dataUrl) !== descriptor.contentId) {
    return { ok: false, reason: "hash_mismatch" };
  }
  return { ok: true, dataUrl };
}

function isDurableInputDescriptor(value: unknown): value is DurableInputDescriptor {
  if (!isRecord(value)) return false;
  return (
    (value.kind === "product" || value.kind === "identity") &&
    typeof value.role === "string" &&
    typeof value.index === "number" &&
    Number.isInteger(value.index) &&
    typeof value.contentId === "string" &&
    typeof value.storagePath === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.dataUrlPrefix === "string" &&
    typeof value.byteSize === "number" &&
    Number.isInteger(value.byteSize)
  );
}

export function parseResumeContext(raw: unknown): ParseResumeContextResult {
  if (raw === undefined || raw === null) return { ok: false, reason: "missing" };
  if (!isRecord(raw)) return { ok: false, reason: "malformed" };
  if (!isRecord(raw.briefing) || typeof raw.briefingText !== "string") {
    return { ok: false, reason: "malformed" };
  }
  if (
    typeof raw.campaignIntent !== "string" ||
    typeof raw.backgroundDirection !== "string" ||
    !Array.isArray(raw.inputFiles) ||
    !raw.inputFiles.every(isDurableInputDescriptor)
  ) {
    return { ok: false, reason: "malformed" };
  }
  const economicSnapshot = raw.economicSnapshot;
  if (!isRecord(economicSnapshot)) return { ok: false, reason: "malformed" };
  return {
    ok: true,
    context: Object.freeze({
      briefing: raw.briefing as unknown as CampaignResumeContext["briefing"],
      briefingText: raw.briefingText,
      campaignIntent: raw.campaignIntent as CampaignResumeContext["campaignIntent"],
      backgroundDirection: raw.backgroundDirection as CampaignResumeContext["backgroundDirection"],
      identityDirective:
        raw.identityDirective === null || typeof raw.identityDirective === "string"
          ? raw.identityDirective
          : null,
      identityContext: raw.identityContext ?? null,
      copyContext:
        raw.copyContext === null || raw.copyContext === undefined
          ? null
          : (raw.copyContext as CampaignResumeContext["copyContext"]),
      economicSnapshot: Object.freeze({
        usdBrlRateAtGeneration:
          typeof economicSnapshot.usdBrlRateAtGeneration === "number"
            ? economicSnapshot.usdBrlRateAtGeneration
            : null,
        creditValueBrlAtGeneration:
          typeof economicSnapshot.creditValueBrlAtGeneration === "number"
            ? economicSnapshot.creditValueBrlAtGeneration
            : null,
      }),
      inputFiles: Object.freeze([...raw.inputFiles]),
    }),
  };
}
