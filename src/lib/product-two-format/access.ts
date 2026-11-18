/**
 * F60.7 — Contrato PURO de acesso por formato (preview/download/miniatura).
 *
 * Decide se um formato entregue possui artefato compatível e qual caminho de
 * miniatura derivar. NÃO monta URL, NÃO assina, NÃO lê bytes e NÃO faz I/O: a
 * assinatura real de preview/download é responsabilidade das rotas (Subfatia C).
 *
 * Só libera o formato `delivered` com artefato do papel esperado e caminho
 * canônico de composição da MESMA campanha/operação. `square_prepared` nunca é
 * aceito como entrega, e quando não há miniatura elegível o resultado é
 * `thumbnailPath: null` — nunca os bytes do artefato como substituto.
 */

import { parseCompositionArtifactPath } from "@/lib/campaign/composition-artifacts/artifact-path";
import { deriveThumbnailPath } from "@/lib/campaign/thumbnail/thumbnail-path";

import type { TwoFormatDeliveryView } from "./read-model";
import type { TwoFormatArtifactRole, TwoFormatFormat } from "./types";

/** Política fechada de papel/dimensão/MIME por formato entregável. */
export const TWO_FORMAT_ARTIFACT_POLICY = Object.freeze({
  "1:1": Object.freeze({
    role: "square_original" as const,
    format: "1:1" as const,
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg" as const,
  }),
  "9:16": Object.freeze({
    role: "vertical" as const,
    format: "9:16" as const,
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg" as const,
  }),
});

export type TwoFormatAccessDeniedReason =
  | "unsupported_format"
  | "not_delivered"
  | "indeterminate"
  | "artifact_missing"
  | "artifact_incompatible";

export type TwoFormatAccessResult =
  | {
      readonly allowed: true;
      readonly artifactRole: TwoFormatArtifactRole;
      readonly artifactPath: string;
      readonly thumbnailPath: string | null;
      readonly thumbnailPlaceholder: boolean;
    }
  | { readonly allowed: false; readonly reason: TwoFormatAccessDeniedReason };

export interface TwoFormatAccessInput {
  readonly view: TwoFormatDeliveryView;
  readonly format: string;
}

export interface TwoFormatAccessDeps {
  /** Injetável para testes; o padrão é a derivação determinística pura. */
  readonly deriveThumbnailPath?: (path: string) => string | null;
}

function denied(reason: TwoFormatAccessDeniedReason): TwoFormatAccessResult {
  return Object.freeze({ allowed: false as const, reason });
}

/**
 * Resolve o acesso de um formato. Fail-closed: formato reservado, desconhecido,
 * ausente ou indisponível não produz caminho, URL nem miniatura.
 */
export function resolveTwoFormatAccess(
  input: TwoFormatAccessInput,
  deps: TwoFormatAccessDeps = {},
): TwoFormatAccessResult {
  const expectedFormat: TwoFormatFormat | null =
    input.format === "1:1" ? "1:1" : input.format === "9:16" ? "9:16" : null;

  if (expectedFormat === null) return denied("unsupported_format");

  const formatView =
    expectedFormat === "1:1" ? input.view.square : input.view.vertical;

  if (formatView.state === "processing") return denied("not_delivered");
  if (formatView.state === "absent") return denied("not_delivered");
  if (formatView.state === "unknown" || formatView.state === "unavailable") {
    return denied("indeterminate");
  }

  const policy = TWO_FORMAT_ARTIFACT_POLICY[expectedFormat];

  if (formatView.format !== policy.format) return denied("artifact_incompatible");
  if (formatView.artifactPath === null) return denied("artifact_missing");
  if (formatView.artifactRole !== policy.role) {
    return denied("artifact_incompatible");
  }

  const artifactPath = formatView.artifactPath;
  const parsed = parseCompositionArtifactPath(artifactPath);
  if (parsed === null) return denied("artifact_incompatible");
  if (parsed.role !== policy.role) return denied("artifact_incompatible");
  if (
    parsed.campaignId !== input.view.campaignId ||
    parsed.operationId !== input.view.operationId
  ) {
    return denied("artifact_incompatible");
  }

  const derive = deps.deriveThumbnailPath ?? deriveThumbnailPath;
  const derived = derive(artifactPath);
  const thumbnailPath = derived === artifactPath ? null : derived;

  return Object.freeze({
    allowed: true as const,
    artifactRole: policy.role,
    artifactPath,
    thumbnailPath,
    thumbnailPlaceholder: thumbnailPath === null,
  });
}
