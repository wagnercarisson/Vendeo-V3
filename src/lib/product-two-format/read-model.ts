/**
 * F60.7 — Modelo de leitura PURO por formato.
 *
 * Deriva `delivered | processing | absent | unknown | unavailable` de três
 * fontes explícitas por formato — vínculo, crédito e linha de artefato — e
 * NUNCA do caminho persistido, da presença de objeto ou do nome de arquivo.
 *
 * Regras de segurança:
 * - indeterminação nunca vira `absent` (não autoriza estorno presumido);
 * - falha de um formato preserva o outro comprovadamente entregue;
 * - `square_prepared` nunca é papel entregue nem fonte de miniatura;
 * - nenhum path/URL é exposto fora do estado `delivered`.
 *
 * Módulo puro: sem I/O e sem dependência de runtime de servidor.
 */

import { checkRolePolicy } from "@/lib/campaign/composition-artifacts/role-policy";

import type {
  TwoFormatArtifactRole,
  TwoFormatDeliveryLink,
  TwoFormatDeliveryState,
  TwoFormatFormat,
} from "./types";

export type TwoFormatLinkState =
  | { readonly kind: "found"; readonly link: TwoFormatDeliveryLink }
  | { readonly kind: "missing" }
  | { readonly kind: "invalid"; readonly reason: string };

export type TwoFormatCreditStatus =
  | "reserved"
  | "art_uploaded"
  | "delivered"
  | "refunded";

export type TwoFormatCreditState =
  | { readonly kind: "found"; readonly status: TwoFormatCreditStatus }
  | { readonly kind: "missing" }
  | { readonly kind: "read_failed"; readonly reason: string };

export type TwoFormatArtifactState =
  | {
      readonly kind: "found";
      readonly role: string;
      readonly format: string;
      readonly width: number;
      readonly height: number;
      readonly mimeType: string;
      readonly storagePath: string;
    }
  | { readonly kind: "missing" }
  | { readonly kind: "read_failed" };

/** Fontes explícitas de um formato. Nenhum campo é inferido. */
export interface TwoFormatDeliverySource {
  readonly format: TwoFormatFormat;
  readonly link: TwoFormatLinkState;
  readonly credit: TwoFormatCreditState;
  readonly artifact: TwoFormatArtifactState;
}

export interface TwoFormatDeliveryViewInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly square: TwoFormatDeliverySource;
  readonly vertical: TwoFormatDeliverySource;
}

export interface TwoFormatFormatView {
  readonly format: TwoFormatFormat;
  readonly state: TwoFormatDeliveryState;
  readonly creditRefunded: boolean;
  readonly deliveryOperationId: string | null;
  readonly artifactRole: TwoFormatArtifactRole | null;
  readonly artifactPath: string | null;
  readonly supportReference: string | null;
}

export interface TwoFormatDeliveryView {
  readonly origin: "two_format_two_stage";
  readonly campaignId: string;
  readonly operationId: string;
  readonly square: TwoFormatFormatView;
  readonly vertical: TwoFormatFormatView;
  readonly preferredThumbnail: "square" | "vertical" | null;
}

const EXPECTED_ROLE: Readonly<Record<TwoFormatFormat, TwoFormatArtifactRole>> =
  Object.freeze({
    "1:1": "square_original",
    "9:16": "vertical",
  });

/**
 * Referência de suporte estável e não técnica: identifica campanha e formato
 * sem expor motivo de erro, path, checksum ou detalhe de provedor.
 */
function supportReference(
  campaignId: string,
  format: TwoFormatFormat,
): string {
  return `two_format:${campaignId}:${format}`;
}

interface ViewFields {
  readonly format: TwoFormatFormat;
  readonly state: TwoFormatDeliveryState;
  readonly creditRefunded: boolean;
  readonly deliveryOperationId: string | null;
  readonly artifactRole: TwoFormatArtifactRole | null;
  readonly artifactPath: string | null;
  readonly supportReference: string | null;
}

function view(fields: ViewFields): TwoFormatFormatView {
  return Object.freeze(fields);
}

function deriveFormatView(
  source: TwoFormatDeliverySource,
  expectedFormat: TwoFormatFormat,
  input: TwoFormatDeliveryViewInput,
): TwoFormatFormatView {
  const format = expectedFormat;
  const expectedRole = EXPECTED_ROLE[expectedFormat];

  const unavailable = (deliveryOperationId: string | null): TwoFormatFormatView =>
    view({
      format,
      state: "unavailable",
      creditRefunded: false,
      deliveryOperationId,
      artifactRole: null,
      artifactPath: null,
      supportReference: null,
    });

  const unknown = (deliveryOperationId: string | null): TwoFormatFormatView =>
    view({
      format,
      state: "unknown",
      creditRefunded: false,
      deliveryOperationId,
      artifactRole: null,
      artifactPath: null,
      supportReference: supportReference(input.campaignId, format),
    });

  // 1. Vínculo explícito: ausente/inválido ou incoerente ⇒ indisponível.
  if (source.format !== expectedFormat) return unavailable(null);
  if (source.link.kind === "missing") return unavailable(null);
  if (source.link.kind === "invalid") return unavailable(null);

  const link = source.link.link;
  const deliveryOperationId = link.deliveryOperationId;

  if (link.format !== expectedFormat) return unavailable(deliveryOperationId);
  if (link.artifactRole !== expectedRole) return unavailable(deliveryOperationId);
  if (
    link.campaignId !== input.campaignId ||
    link.operationId !== input.operationId
  ) {
    return unavailable(deliveryOperationId);
  }
  // O vertical reutiliza a identidade de controle; o quadrado tem identidade
  // financeira própria e distinta (D5).
  if (expectedFormat === "9:16" && link.deliveryOperationId !== link.operationId) {
    return unavailable(deliveryOperationId);
  }
  if (expectedFormat === "1:1" && link.deliveryOperationId === link.operationId) {
    return unavailable(deliveryOperationId);
  }

  // 2. Crédito: indeterminação nunca vira ausência.
  if (source.credit.kind === "read_failed") return unknown(deliveryOperationId);
  if (source.credit.kind === "missing") return unavailable(deliveryOperationId);

  const status: TwoFormatCreditStatus = source.credit.status;
  if (status === "refunded") {
    return view({
      format,
      state: "absent",
      creditRefunded: true,
      deliveryOperationId,
      artifactRole: null,
      artifactPath: null,
      supportReference: null,
    });
  }
  if (status === "reserved" || status === "art_uploaded") {
    return view({
      format,
      state: "processing",
      creditRefunded: false,
      deliveryOperationId,
      artifactRole: null,
      artifactPath: null,
      supportReference: null,
    });
  }
  if (status !== "delivered") return unknown(deliveryOperationId);

  // 3. Linha de artefato: precisa existir e ser compatível com papel/formato/
  // dimensão/MIME. Ausência de linha ou incompatibilidade é `unknown`.
  if (source.artifact.kind !== "found") return unknown(deliveryOperationId);

  const artifact = source.artifact;
  if (artifact.role !== expectedRole) return unknown(deliveryOperationId);
  if (artifact.format !== expectedFormat) return unknown(deliveryOperationId);

  const policy = checkRolePolicy(
    artifact.role,
    artifact.width,
    artifact.height,
    artifact.mimeType,
  );
  if (!policy.ok || policy.format !== expectedFormat) {
    return unknown(deliveryOperationId);
  }

  return view({
    format,
    state: "delivered",
    creditRefunded: false,
    deliveryOperationId,
    artifactRole: expectedRole,
    artifactPath: artifact.storagePath,
    supportReference: null,
  });
}

/**
 * Deriva o modelo de leitura da campanha conjunta a partir das duas fontes.
 * Nunca lança e nunca infere estado por path/objeto.
 */
export function deriveTwoFormatDeliveryView(
  input: TwoFormatDeliveryViewInput,
): TwoFormatDeliveryView {
  const square = deriveFormatView(input.square, "1:1", input);
  const vertical = deriveFormatView(input.vertical, "9:16", input);

  const preferredThumbnail: "square" | "vertical" | null =
    square.state === "delivered"
      ? "square"
      : vertical.state === "delivered"
        ? "vertical"
        : null;

  return Object.freeze({
    origin: "two_format_two_stage" as const,
    campaignId: input.campaignId,
    operationId: input.operationId,
    square,
    vertical,
    preferredThumbnail,
  });
}
