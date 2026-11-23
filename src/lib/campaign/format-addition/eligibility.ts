/**
 * F62 — Derivação PURA da elegibilidade da adição `9:16`.
 *
 * Recebe somente estados já classificados pela autoridade server-side e
 * devolve a decisão tipada. Sem I/O, sem `server-only`, sem Supabase, sem
 * Storage, sem `sharp`, sem provider e sem React.
 *
 * Precedência deliberada:
 * 1. estado durável da adição (delivered/processing/unknown/refunded);
 * 2. leitura do vínculo indisponível;
 * 3. contrato da campanha (status `ready` + formato persistido `1:1`);
 * 4. leitura/identidade da fonte (indisponibilidade NUNCA vira
 *    incompatibilidade definitiva);
 * 5. validação definitiva da fonte (origem, integridade, MIME, dimensão,
 *    path canônico e checksum).
 */

import { FORMAT_ADDITION_CREDITS } from "./types";
import type {
  FormatAdditionEligibility,
  FormatAdditionEligibilityInput,
  FormatAdditionIncompatibleReason,
  FormatAdditionSourceOrigin,
  FormatAdditionSourceRead,
  FormatAdditionUnavailableReason,
} from "./types";

/** Dimensão exata da fonte quadrada compatível com a expansão. */
const SQUARE_DIMENSION = 1024;

const JPEG_MIME = "image/jpeg";

const SUPPORTED_ORIGINS: ReadonlySet<string> =
  new Set<FormatAdditionSourceOrigin>(["new_flow_1_1", "legacy_campaign"]);

function isSupportedOrigin(origin: string): origin is FormatAdditionSourceOrigin {
  return SUPPORTED_ORIGINS.has(origin);
}

function incompatible(
  reason: FormatAdditionIncompatibleReason,
): FormatAdditionEligibility {
  return Object.freeze({ kind: "incompatible" as const, reason });
}

function unavailable(
  reason: FormatAdditionUnavailableReason,
): FormatAdditionEligibility {
  return Object.freeze({ kind: "unavailable" as const, reason });
}

function classifyLoadedSource(
  source: Extract<FormatAdditionSourceRead, { kind: "loaded" }>,
): FormatAdditionEligibility {
  if (!isSupportedOrigin(source.origin)) {
    return incompatible("source_origin_invalid");
  }
  if (source.integrity !== "valid") {
    return incompatible("artifact_invalid");
  }
  if (source.mimeType !== JPEG_MIME) {
    return incompatible("unsupported_mime");
  }
  if (
    source.width !== SQUARE_DIMENSION ||
    source.height !== SQUARE_DIMENSION
  ) {
    return incompatible("unsupported_dimensions");
  }
  if (!source.pathCanonical) {
    return incompatible("path_not_canonical");
  }
  if (source.checksum !== "verified") {
    return incompatible("artifact_invalid");
  }

  return Object.freeze({
    kind: "eligible" as const,
    sourceOrigin: source.origin,
    credits: FORMAT_ADDITION_CREDITS,
  });
}

/**
 * Deriva a elegibilidade de forma total. O vínculo durável é autoridade: se já
 * existe adição `delivered`/`processing`/`unknown`/`refunded`, o resultado é o
 * estado dessa adição, mesmo que a fonte tenha mudado depois.
 */
export function deriveFormatAdditionEligibility(
  input: FormatAdditionEligibilityInput,
): FormatAdditionEligibility {
  switch (input.addition.kind) {
    case "delivered":
      return Object.freeze({ kind: "delivered" as const, state: "delivered" });
    case "processing":
      return Object.freeze({
        kind: "processing" as const,
        state: "processing" as const,
      });
    case "unknown":
      return Object.freeze({
        kind: "processing" as const,
        state: "unknown" as const,
      });
    case "refunded":
      return Object.freeze({
        kind: "absent" as const,
        state: "absent" as const,
        refunded: true,
      });
    case "read_failed":
      return unavailable("read_failed");
    case "none":
      break;
  }

  if (input.campaignStatus !== "ready") {
    return incompatible("campaign_not_ready");
  }

  // Formato ausente/incoerente e vertical persistido não são `1:1` utilizável.
  if (input.formatResolution.kind !== "1:1") {
    return incompatible("format_not_square");
  }

  switch (input.source.kind) {
    case "absent":
      return unavailable("artifact_absent");
    case "indeterminate":
      return unavailable("artifact_indeterminate");
    case "read_failed":
      return unavailable("read_failed");
    case "identity_conflict":
      return unavailable("identity_conflict");
    case "loaded":
      return classifyLoadedSource(input.source);
  }
}
