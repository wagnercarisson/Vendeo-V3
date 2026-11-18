import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import { classifyTwoFormatCampaign } from "./contracts";
import {
  deriveTwoFormatDeliveryView,
  type TwoFormatArtifactState,
  type TwoFormatCreditState,
  type TwoFormatCreditStatus,
  type TwoFormatDeliverySource,
  type TwoFormatDeliveryView,
  type TwoFormatLinkState,
} from "./read-model";
import type {
  TwoFormatArtifactRole,
  TwoFormatDeliveryLink,
  TwoFormatFormat,
} from "./types";

/**
 * Leitor server-only da entrega conjunta (F60.7 / Subfatia A).
 *
 * Monta a entrada do modelo puro a partir de TRÊS fontes explícitas por formato
 * — vínculo de entrega, crédito e linha de artefato — e nunca infere estado por
 * caminho persistido, presença de objeto ou nome de arquivo.
 *
 * Regras de falha:
 * - erro ao ler campanha ou vínculos (ou exceção inesperada) ⇒ `read_failed`;
 * - erro de crédito/artefato de UM formato ⇒ `unknown` naquele formato,
 *   preservando o outro comprovadamente entregue;
 * - vínculo ausente ⇒ `unavailable` no modelo (nunca `absent`);
 * - par conjunto corrompido ⇒ `inconsistent` (nunca legado/`not_found`).
 *
 * Módulo somente leitura: nenhuma RPC, escrita, assinatura de URL ou sonda de
 * objeto é executada aqui.
 */

export type TwoFormatReadResult =
  | { readonly kind: "found"; readonly view: TwoFormatDeliveryView }
  | { readonly kind: "inconsistent"; readonly reason: string }
  | { readonly kind: "not_two_format" }
  | { readonly kind: "not_found" }
  | { readonly kind: "read_failed"; readonly reason: string };

export interface TwoFormatReadInput {
  readonly campaignId: string;
  /** Identidade de controle esperada; vínculo divergente é incoerência. */
  readonly operationId: string;
  readonly storeId?: string;
}

export interface TwoFormatReadDependencies {
  readonly client?: SupabaseClient;
}

const CAMPAIGN_COLUMNS = "id, store_id, input_snapshot";
const LINK_COLUMNS =
  "campaign_id, operation_id, store_id, format, delivery_operation_id, artifact_role, created_at";
const CREDIT_COLUMNS = "status";
/**
 * O caminho é projetado com alias (`artifact_path`) apenas para evitar inferir
 * estado a partir do path: o leitor nunca compara nem deriva nada dele.
 */
const ARTIFACT_COLUMNS = "role, format, width, height, mime_type, artifact_path:storage_path";

const CREDIT_STATUSES: readonly TwoFormatCreditStatus[] = [
  "reserved",
  "art_uploaded",
  "delivered",
  "refunded",
];

const ROLE_BY_FORMAT: Readonly<Record<TwoFormatFormat, TwoFormatArtifactRole>> = Object.freeze({
  "1:1": "square_original",
  "9:16": "vertical",
});

const ARTIFACT_ROLES: readonly TwoFormatArtifactRole[] = ["square_original", "vertical"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

interface ParsedLinks {
  readonly square: TwoFormatLinkState;
  readonly vertical: TwoFormatLinkState;
}

function invalidLink(reason: string): TwoFormatLinkState {
  return { kind: "invalid", reason };
}

/**
 * Mapeia as linhas de vínculo por formato. Formato/papel desconhecido,
 * duplicata e identidade incoerente jamais são lidos como outro formato.
 */
function parseLinks(
  rows: readonly unknown[],
  input: TwoFormatReadInput,
): { readonly kind: "ok"; readonly links: ParsedLinks } | {
  readonly kind: "read_failed";
  readonly reason: string;
} {
  const slots: { square: TwoFormatLinkState; vertical: TwoFormatLinkState } = {
    square: { kind: "missing" },
    vertical: { kind: "missing" },
  };
  let strayInvalid: string | null = null;

  for (const row of rows) {
    const record = asRecord(row);
    if (record === null) {
      strayInvalid = "malformed_link_row";
      continue;
    }
    if (record.campaign_id !== input.campaignId) {
      return { kind: "read_failed", reason: "link_campaign_mismatch" };
    }
    if (record.operation_id !== input.operationId) {
      return { kind: "read_failed", reason: "link_operation_mismatch" };
    }

    const format = record.format;
    if (format !== "1:1" && format !== "9:16") {
      strayInvalid = "unknown_format";
      continue;
    }
    const slot = format === "1:1" ? "square" : "vertical";

    if (slots[slot].kind !== "missing") {
      slots[slot] = invalidLink("duplicate_format");
      continue;
    }

    const artifactRole = record.artifact_role;
    if (
      typeof artifactRole !== "string" ||
      !(ARTIFACT_ROLES as readonly string[]).includes(artifactRole)
    ) {
      slots[slot] = invalidLink("unknown_artifact_role");
      continue;
    }
    const expectedRole = ROLE_BY_FORMAT[format];
    if (artifactRole !== expectedRole) {
      slots[slot] = invalidLink("role_format_mismatch");
      continue;
    }

    const deliveryOperationId = record.delivery_operation_id;
    const storeId = record.store_id;
    const createdAt = record.created_at;
    if (
      typeof deliveryOperationId !== "string" ||
      deliveryOperationId.trim() === "" ||
      typeof storeId !== "string" ||
      typeof createdAt !== "string"
    ) {
      slots[slot] = invalidLink("malformed_link_row");
      continue;
    }

    const usesControlIdentity = deliveryOperationId === input.operationId;
    if (format === "9:16" && !usesControlIdentity) {
      slots[slot] = invalidLink("delivery_identity_mismatch");
      continue;
    }
    if (format === "1:1" && usesControlIdentity) {
      slots[slot] = invalidLink("delivery_identity_mismatch");
      continue;
    }

    const link: TwoFormatDeliveryLink = Object.freeze({
      campaignId: input.campaignId,
      operationId: input.operationId,
      storeId,
      format,
      deliveryOperationId,
      artifactRole: expectedRole,
      createdAt,
    });
    slots[slot] = { kind: "found", link };
  }

  if (strayInvalid !== null) {
    if (slots.square.kind === "missing") slots.square = invalidLink(strayInvalid);
    if (slots.vertical.kind === "missing") slots.vertical = invalidLink(strayInvalid);
  }

  return { kind: "ok", links: { square: slots.square, vertical: slots.vertical } };
}

async function readCredit(
  client: SupabaseClient,
  campaignId: string,
  operationId: string,
): Promise<TwoFormatCreditState> {
  const result = await client
    .from("product_1_1_campaign_credit_operations")
    .select(CREDIT_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("operation_id", operationId)
    .maybeSingle();
  if (result.error) {
    return { kind: "read_failed", reason: result.error.message };
  }
  const record = asRecord(result.data);
  if (record === null) return { kind: "missing" };
  const status = record.status;
  if (
    typeof status !== "string" ||
    !(CREDIT_STATUSES as readonly string[]).includes(status)
  ) {
    return { kind: "read_failed", reason: "invalid_credit_status" };
  }
  return { kind: "found", status: status as TwoFormatCreditStatus };
}

async function readArtifact(
  client: SupabaseClient,
  campaignId: string,
  operationId: string,
  role: TwoFormatArtifactRole,
): Promise<TwoFormatArtifactState> {
  const result = await client
    .from("campaign_composition_artifacts")
    .select(ARTIFACT_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("operation_id", operationId)
    .eq("role", role)
    .maybeSingle();
  if (result.error) return { kind: "read_failed" };
  const record = asRecord(result.data);
  if (record === null) return { kind: "missing" };

  const artifactRole = record.role;
  const artifactFormat = record.format;
  const width = record.width;
  const height = record.height;
  const mimeType = record.mime_type;
  const artifactPath = record.artifact_path;
  if (
    typeof artifactRole !== "string" ||
    typeof artifactFormat !== "string" ||
    typeof mimeType !== "string" ||
    typeof artifactPath !== "string" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return { kind: "read_failed" };
  }

  return {
    kind: "found",
    role: artifactRole,
    format: artifactFormat,
    width,
    height,
    mimeType,
    storagePath: artifactPath,
  };
}

async function readSource(
  client: SupabaseClient,
  input: TwoFormatReadInput,
  format: TwoFormatFormat,
  link: TwoFormatLinkState,
): Promise<TwoFormatDeliverySource> {
  if (link.kind !== "found") {
    return {
      format,
      link,
      credit: { kind: "missing" },
      artifact: { kind: "missing" },
    };
  }

  const [credit, artifact] = await Promise.all([
    readCredit(client, input.campaignId, link.link.deliveryOperationId),
    readArtifact(client, input.campaignId, input.operationId, link.link.artifactRole),
  ]);

  return { format, link, credit, artifact };
}

/**
 * Lê o estado da campanha conjunta por formato. Nunca lança: exceções
 * inesperadas de campanha/vínculo viram `read_failed`.
 */
export async function readTwoFormatDelivery(
  input: TwoFormatReadInput,
  deps: TwoFormatReadDependencies = {},
): Promise<TwoFormatReadResult> {
  const client = deps.client ?? supabaseAdmin;

  try {
    const campaignResult = await client
      .from("campaigns")
      .select(CAMPAIGN_COLUMNS)
      .eq("id", input.campaignId)
      .maybeSingle();
    if (campaignResult.error) {
      return { kind: "read_failed", reason: campaignResult.error.message };
    }
    const campaign = asRecord(campaignResult.data);
    if (campaign === null) return { kind: "not_found" };

    const storeId = campaign.store_id;
    if (typeof storeId !== "string") {
      return { kind: "read_failed", reason: "malformed_campaign_row" };
    }
    if (input.storeId !== undefined && input.storeId !== storeId) {
      return { kind: "not_found" };
    }

    const classification = classifyTwoFormatCampaign(campaign.input_snapshot);
    if (classification.kind === "not_two_format") return { kind: "not_two_format" };
    if (classification.kind === "inconsistent") {
      return { kind: "inconsistent", reason: classification.reason };
    }

    const linksResult = await client
      .from("product_two_format_deliveries")
      .select(LINK_COLUMNS)
      .eq("campaign_id", input.campaignId);
    if (linksResult.error) {
      return { kind: "read_failed", reason: linksResult.error.message };
    }
    const rows = Array.isArray(linksResult.data) ? linksResult.data : [];

    const parsed = parseLinks(rows, input);
    if (parsed.kind === "read_failed") return parsed;

    const [square, vertical] = await Promise.all([
      readSource(client, input, "1:1", parsed.links.square),
      readSource(client, input, "9:16", parsed.links.vertical),
    ]);

    return {
      kind: "found",
      view: deriveTwoFormatDeliveryView({
        campaignId: input.campaignId,
        operationId: input.operationId,
        square,
        vertical,
      }),
    };
  } catch (error) {
    return {
      kind: "read_failed",
      reason: error instanceof Error ? error.message : "read_failed",
    };
  }
}
