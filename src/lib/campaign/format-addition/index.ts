/**
 * F62 — Superfície pública do módulo puro de adição de formato.
 *
 * Mantém o contrato de elegibilidade independente de banco, Storage, provider
 * e UI. Consumidores importam daqui para não dependerem do layout interno.
 */

export { deriveFormatAdditionEligibility } from "./eligibility";
export { FORMAT_ADDITION_CREDITS } from "./types";
export type {
  FormatAdditionChecksumStatus,
  FormatAdditionCredits,
  FormatAdditionDurableRead,
  FormatAdditionEligibility,
  FormatAdditionEligibilityInput,
  FormatAdditionIncompatibleReason,
  FormatAdditionReason,
  FormatAdditionSourceOrigin,
  FormatAdditionSourceRead,
  FormatAdditionState,
  FormatAdditionUnavailableReason,
} from "./types";
