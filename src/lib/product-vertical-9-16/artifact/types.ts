import type { ArtifactProbe } from "@/lib/product-1-1/artifact/types";

/**
 * F59 — Contratos do artefato vertical 9:16.
 *
 * A sonda reutiliza ESTRUTURALMENTE a união discriminada do Produto 1:1
 * (`integral | absent | invalid | indeterminate`) para ser compatível com a
 * recuperação; nenhuma segunda união é criada.
 */

export interface VerticalArtifactRef {
  readonly storagePath: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly sourceWidth?: 1152;
  readonly sourceHeight?: 2048;
}

export type VerticalArtifactErrorCode =
  | "artifact_upload_failed"
  | "artifact_path_conflict"
  | "artifact_metadata_persist_failed"
  | "artifact_missing"
  | "artifact_invalid_path"
  | "artifact_sign_failed"
  | "artifact_download_failed";

export class VerticalArtifactError extends Error {
  constructor(
    public readonly code: VerticalArtifactErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VerticalArtifactError";
  }
}

/** Interface mínima usada pela recuperação/pendências (plano 59-06). */
export interface ArtifactProber {
  probeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ArtifactProbe>;
}

export type { ArtifactProbe };
