import "server-only";

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  getAccessRequestNoticeEmailConfig,
  sendAccessRequestNotice,
  type AccessRequestNoticeContentInput,
  type AccessRequestNoticeSendResult,
} from "@/lib/email/access-request-notice";

/**
 * Notificação interna de NOVA solicitação de acesso.
 *
 * Estado durável em `access_requests.admin_notice_*` (mesmo padrão do convite):
 * pending → sending → sent | failed | unconfirmed | suppressed.
 *
 * - lease atômico com token de tentativa (finalização de tentativa antiga não
 *   sobrescreve a atual);
 * - até 3 tentativas finalizadas por solicitação;
 * - o primeiro envio é aguardado logo após o insert (não é fire-and-forget);
 * - duplicata pode REENVIAR o MESMO aviso pendente/falho, nunca criar outro;
 * - `sent` = aceito pelo provider; não é entrega confirmada;
 * - falha de envio não apaga nem invalida a solicitação.
 */

const LEASE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const CLAIMABLE_STATUSES = [
  "pending",
  "failed",
  "unconfirmed",
  "suppressed",
  "sending",
] as const;

export type AccessRequestAdminNoticeStatus =
  | "sent"
  | "failed"
  | "unconfirmed"
  | "suppressed"
  | "skipped"
  | "stale"
  | "sent_unrecorded";

/** Uma duplicata só tenta o MESMO aviso se ele ainda for retomável. */
export function isRetryableAdminNoticeStatus(
  status: string | null | undefined,
): boolean {
  return (
    typeof status === "string" &&
    (CLAIMABLE_STATUSES as readonly string[]).includes(status)
  );
}

export interface AccessRequestAdminNoticeResult {
  status: AccessRequestAdminNoticeStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  persisted: boolean;
}

interface ClaimedRow {
  id: string;
  created_at: string;
  name: string | null;
  store_name: string | null;
  admin_notice_attempts: number | null;
  admin_notice_attempt_token: string | null;
  admin_notice_status: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function skipped(errorCode: string | null = null): AccessRequestAdminNoticeResult {
  return { status: "skipped", providerMessageId: null, errorCode, persisted: false };
}

function safeConfigCode(disabled: boolean): string {
  return disabled ? "email_disabled" : "email_not_configured";
}

async function markSuppressed(
  client: SupabaseClient,
  requestId: string,
  code: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("access_requests")
    .update({
      admin_notice_status: "suppressed",
      admin_notice_error: code,
      admin_notice_locked_until: null,
      admin_notice_attempt_token: null,
    })
    .eq("id", requestId)
    .eq("admin_notice_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[access-request-notice] suppress persistence failed", { code });
    return false;
  }
  return data !== null;
}

export async function notifyAdminOfAccessRequest(
  requestId: string,
  deps: {
    client?: SupabaseClient;
    sender?: (
      input: AccessRequestNoticeContentInput,
    ) => Promise<AccessRequestNoticeSendResult>;
  } = {},
): Promise<AccessRequestAdminNoticeResult> {
  const client = deps.client ?? supabaseAdmin;
  const sender = deps.sender ?? sendAccessRequestNotice;

  try {
    const config = getAccessRequestNoticeEmailConfig();
    if (!config.ok || !config.siteUrl) {
      const code = safeConfigCode(config.disabled);
      const persisted = await markSuppressed(client, requestId, code);
      return {
        status: "suppressed",
        providerMessageId: null,
        errorCode: code,
        persisted,
      };
    }

    const attemptToken = crypto.randomUUID();
    const claimedAt = nowIso();
    const lease = new Date(Date.now() + LEASE_MS).toISOString();
    const claimColumns =
      "id, created_at, name, store_name, admin_notice_attempts, admin_notice_attempt_token, admin_notice_status";
    const claimPatch = {
      admin_notice_status: "sending",
      admin_notice_locked_until: lease,
      admin_notice_last_attempt_at: claimedAt,
      admin_notice_error: null,
      admin_notice_attempt_token: attemptToken,
    };

    // Duas condições separadas (null ou lease expirado) evitam o filtro `or`
    // problemático neste PostgREST; cada UPDATE é atômico.
    let claim = await client
      .from("access_requests")
      .update(claimPatch)
      .eq("id", requestId)
      .in("admin_notice_status", [...CLAIMABLE_STATUSES])
      .is("admin_notice_locked_until", null)
      .lt("admin_notice_attempts", MAX_ATTEMPTS)
      .select(claimColumns)
      .maybeSingle();

    if (!claim.error && !claim.data) {
      claim = await client
        .from("access_requests")
        .update(claimPatch)
        .eq("id", requestId)
        .in("admin_notice_status", [...CLAIMABLE_STATUSES])
        .lt("admin_notice_locked_until", claimedAt)
        .lt("admin_notice_attempts", MAX_ATTEMPTS)
        .select(claimColumns)
        .maybeSingle();
    }

    if (claim.error) {
      console.error("[access-request-notice] claim failed", { code: "claim_failed" });
      return skipped("claim_failed");
    }
    if (!claim.data) {
      return skipped(null);
    }

    const claimed = claim.data as unknown as ClaimedRow;

    let result: AccessRequestNoticeSendResult;
    try {
      result = await sender({
        requestId: claimed.id,
        name: claimed.name,
        storeName: claimed.store_name,
        createdAt: claimed.created_at,
        siteUrl: config.siteUrl,
      });
    } catch {
      result = {
        status: "failed",
        providerMessageId: null,
        errorCode: "send_exception",
      };
    }

    const sent = result.status === "sent";
    const nextAttempts = (claimed.admin_notice_attempts ?? 0) + 1;

    const { data, error } = await client
      .from("access_requests")
      .update({
        admin_notice_status: result.status,
        admin_notice_sent_at: sent ? nowIso() : null,
        admin_notice_error: result.errorCode,
        admin_notice_provider_message_id: result.providerMessageId,
        admin_notice_locked_until: null,
        admin_notice_attempt_token: null,
        admin_notice_attempts: nextAttempts,
      })
      .eq("id", claimed.id)
      .eq("admin_notice_attempt_token", attemptToken)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[access-request-notice] persistence failed", {
        code: "persistence_failed",
      });
      return {
        status: sent ? "sent_unrecorded" : result.status,
        providerMessageId: result.providerMessageId,
        errorCode: result.errorCode ?? "persistence_failed",
        persisted: false,
      };
    }

    if (!data) {
      // Outra tentativa assumiu o lease; não sobrescreve o estado atual.
      return {
        status: "stale",
        providerMessageId: result.providerMessageId,
        errorCode: "stale_attempt",
        persisted: false,
      };
    }

    return {
      status: result.status,
      providerMessageId: result.providerMessageId,
      errorCode: result.errorCode,
      persisted: true,
    };
  } catch {
    console.error("[access-request-notice] unexpected failure", {
      code: "unexpected_failure",
    });
    return skipped("unexpected_failure");
  }
}
