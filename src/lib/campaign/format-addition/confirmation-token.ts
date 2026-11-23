import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * F62/62-05 — Token opaco de confirmação da adição vertical.
 *
 * HMAC-SHA256 sobre payload canônico `{v:1, campaignId, format:"9:16",
 * sourceChecksum, costCredits:1, requestId, intent, expiresAt}`. O segredo é
 * server-only e o token NÃO carrega operação, path, URL, modelo ou economia.
 * Segredo ausente ⇒ fail-closed (nem emite nem aceita).
 */

export const FORMAT_ADDITION_CONFIRMATION_TTL_MS = 10 * 60 * 1000;
export const FORMAT_ADDITION_CONFIRMATION_FORMAT = "9:16" as const;
export const FORMAT_ADDITION_CONFIRMATION_COST = 1 as const;

export type FormatAdditionIntent = "start" | "retry";

export interface FormatAdditionConfirmationPayload {
  readonly v: 1;
  readonly campaignId: string;
  readonly format: typeof FORMAT_ADDITION_CONFIRMATION_FORMAT;
  readonly sourceChecksum: string;
  readonly costCredits: typeof FORMAT_ADDITION_CONFIRMATION_COST;
  readonly requestId: string;
  readonly intent: FormatAdditionIntent;
  readonly expiresAt: string;
}

export type CreateFormatAdditionTokenResult =
  | {
      readonly ok: true;
      readonly token: string;
      readonly payload: FormatAdditionConfirmationPayload;
    }
  | { readonly ok: false; readonly reason: "secret_missing" | "invalid_payload" };

export type VerifyFormatAdditionTokenResult =
  | { readonly ok: true; readonly payload: FormatAdditionConfirmationPayload }
  | {
      readonly ok: false;
      readonly reason: "secret_missing" | "invalid" | "expired";
    };

interface TokenDeps {
  readonly secret?: string | null;
  readonly now?: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKSUM_RE = /^[0-9a-f]{64}$/i;

function readSecret(deps: TokenDeps): string | null {
  const secret = deps.secret ?? process.env.FORMAT_ADDITION_CONFIRMATION_SECRET;
  return typeof secret === "string" && secret.trim().length > 0
    ? secret
    : null;
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function encode(payload: FormatAdditionConfirmationPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function isPayload(value: unknown): value is FormatAdditionConfirmationPayload {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    typeof record.campaignId === "string" &&
    UUID_RE.test(record.campaignId) &&
    record.format === FORMAT_ADDITION_CONFIRMATION_FORMAT &&
    typeof record.sourceChecksum === "string" &&
    CHECKSUM_RE.test(record.sourceChecksum) &&
    record.costCredits === FORMAT_ADDITION_CONFIRMATION_COST &&
    typeof record.requestId === "string" &&
    UUID_RE.test(record.requestId) &&
    (record.intent === "start" || record.intent === "retry") &&
    typeof record.expiresAt === "string" &&
    Number.isFinite(Date.parse(record.expiresAt))
  );
}

export function createFormatAdditionConfirmationToken(
  input: {
    readonly campaignId: string;
    readonly sourceChecksum: string;
    readonly requestId: string;
    readonly intent: FormatAdditionIntent;
  },
  deps: TokenDeps = {},
): CreateFormatAdditionTokenResult {
  const secret = readSecret(deps);
  if (secret === null) return { ok: false, reason: "secret_missing" };
  const now = deps.now ?? Date.now();
  const payload: FormatAdditionConfirmationPayload = {
    v: 1,
    campaignId: input.campaignId,
    format: FORMAT_ADDITION_CONFIRMATION_FORMAT,
    sourceChecksum: input.sourceChecksum.toLowerCase(),
    costCredits: FORMAT_ADDITION_CONFIRMATION_COST,
    requestId: input.requestId,
    intent: input.intent,
    expiresAt: new Date(now + FORMAT_ADDITION_CONFIRMATION_TTL_MS).toISOString(),
  };
  if (!isPayload(payload)) return { ok: false, reason: "invalid_payload" };
  const body = encode(payload);
  return {
    ok: true,
    token: `${body}.${sign(secret, body)}`,
    payload,
  };
}

export function verifyFormatAdditionConfirmationToken(
  token: string,
  deps: TokenDeps = {},
): VerifyFormatAdditionTokenResult {
  const secret = readSecret(deps);
  if (secret === null) return { ok: false, reason: "secret_missing" };
  const [body, signature, extra] = token.split(".");
  if (body === undefined || signature === undefined || extra !== undefined) {
    return { ok: false, reason: "invalid" };
  }

  const expected = sign(secret, body);
  const provided = Buffer.from(signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (
    provided.length !== wanted.length ||
    !timingSafeEqual(provided, wanted)
  ) {
    return { ok: false, reason: "invalid" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!isPayload(parsed)) return { ok: false, reason: "invalid" };

  const now = deps.now ?? Date.now();
  if (Date.parse(parsed.expiresAt) <= now) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload: parsed };
}
