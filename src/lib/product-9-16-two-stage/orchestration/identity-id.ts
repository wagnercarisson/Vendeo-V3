import "server-only";

import { hashImageDataUrl } from "@/lib/campaign/square-base/frozen-state";

/**
 * F60.5 — id da referencia/descriptor de identidade por formato.
 * 9:16 usa o hash EXATO do data URL (contrato do descritor duravel/F60.4);
 * 1:1 preserva o hash de bytes (`contentId`) sem mudanca.
 */
export function identityReferenceId(input: {
  readonly format: "1:1" | "9:16";
  readonly contentId: string;
  readonly dataUrl: string;
}): string {
  return input.format === "9:16"
    ? hashImageDataUrl(input.dataUrl)
    : input.contentId;
}
