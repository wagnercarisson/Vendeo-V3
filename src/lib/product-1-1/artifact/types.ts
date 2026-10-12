/**
 * F56.2b1b — Contratos do artefato do Produto 1:1 (Plano 05).
 *
 * A arte real do novo fluxo é 1:1 1024×1024, gravada no bucket privado
 * `campaign-images` sob caminho imutável. O resultado da verificação de
 * integridade por CONTEÚDO é uma união DISCRIMINADA e TIPADA (C2) — nunca um
 * `null` ambíguo. I3: o probe devolve EVIDÊNCIA/metadados e NUNCA assina URL;
 * a assinatura (`getSignedArtifactUrl`) é SEPARADA e consumida apenas pelo portão
 * de download (Plano 06) após `delivered`.
 */

/** Referência persistida/recuperada do artefato do novo fluxo. */
export interface ProductOneToOneArtifactRef {
  readonly storagePath: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
}

/**
 * C2 — resultado TIPADO da sonda de arte. Os quatro casos são DISTINTOS:
 * - `integral`: objeto presente no caminho determinístico, baixado e
 *   DECODIFICADO como imagem 1:1 com as dimensões esperadas; devolve `ref` +
 *   metadados — **SEM `signedUrl`** (I3).
 * - `absent`: ausência CONFIRMADA do objeto no caminho determinístico.
 * - `invalid`: objeto PRESENTE mas não íntegro (não abre como imagem 1:1 /
 *   dimensões divergentes do persistido/esperado).
 * - `indeterminate`: erro/indisponibilidade do Storage — NUNCA confundido com
 *   ausência.
 */
export type ArtifactProbe =
  | {
      readonly kind: "integral";
      readonly ref: ProductOneToOneArtifactRef;
      readonly width: number;
      readonly height: number;
      readonly mimeType: string;
      readonly storagePath: string;
    }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "indeterminate" };

export type ProductOneToOneArtifactErrorCode =
  | "artifact_upload_failed"
  | "artifact_path_conflict"
  | "artifact_dimension_mismatch"
  | "artifact_metadata_persist_failed"
  | "artifact_missing"
  | "artifact_invalid_path"
  | "artifact_sign_failed";

export class ProductOneToOneArtifactUploadError extends Error {
  constructor(
    public readonly code: ProductOneToOneArtifactErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ProductOneToOneArtifactUploadError";
  }
}
