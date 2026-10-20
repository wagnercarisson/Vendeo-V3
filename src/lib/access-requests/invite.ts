import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import {
  getAccessInviteEmailConfig,
  sendAccessInviteEmail,
  type InviteEmailKind,
} from "@/lib/email/access-invite";
import {
  isAlreadyRegisteredError,
  isPendingInvite,
  type AuthUserLike,
} from "@/lib/access-requests/invite-policy";

const LEASE_MS = 2 * 60 * 1000;

export type AccessInviteTrigger = "approve" | "resend";

export type AccessInviteOutcome = {
  status: "sent" | "failed" | "unconfirmed" | "account_active" | "skipped";
  providerMessageId: string | null;
  sentAt: string | null;
  error: string | null;
};

export type AccessInviteServiceResult = {
  ok: boolean;
  reason?: "not_found" | "not_approved" | "locked";
  outcome: AccessInviteOutcome;
};

type AccessRequestRow = {
  id: string;
  email: string;
  status: string;
  invite_attempts: number | null;
  invited_user_id: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function skippedOutcome(): AccessInviteOutcome {
  return { status: "skipped", providerMessageId: null, sentAt: null, error: null };
}

async function findAuthUserByEmail(email: string): Promise<AuthUserLike | null> {
  const target = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return null;

    const users = (data?.users ?? []) as AuthUserLike[];
    const match = users.find((user) => (user.email ?? "").toLowerCase() === target);
    if (match) return match;
    if (users.length < perPage) return null;
  }

  return null;
}

function reasonFor(trigger: AccessInviteTrigger, outcome: AccessInviteOutcome): string {
  const prefix = trigger === "approve" ? "Aprovação" : "Reenvio";
  switch (outcome.status) {
    case "sent":
      return `${prefix}: convite enviado ao provedor`;
    case "account_active":
      return `${prefix}: conta já ativa — orientação enviada`;
    case "unconfirmed":
      return `${prefix}: resultado do envio não confirmado`;
    case "failed":
      return `${prefix}: falha ao enviar convite`;
    default:
      return `${prefix}: convite não enviado`;
  }
}

async function recordAudit(input: {
  actorId: string;
  requestId: string;
  email: string;
  trigger: AccessInviteTrigger;
  outcome: AccessInviteOutcome;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: input.actorId,
    action: "access_request_invite",
    target_type: "access_request",
    target_id: input.requestId,
    reason: reasonFor(input.trigger, input.outcome),
    metadata: {
      trigger: input.trigger,
      result: input.outcome.status,
      email: input.email,
      provider_message_id: input.outcome.providerMessageId,
      error: input.outcome.error,
    },
  });

  if (error) {
    console.error("access_request_invite audit error:", error);
  }
}

async function finalize(input: {
  row: AccessRequestRow;
  actorId: string;
  trigger: AccessInviteTrigger;
  outcome: AccessInviteOutcome;
  invitedUserId: string | null;
}): Promise<void> {
  const sent = input.outcome.status === "sent" || input.outcome.status === "account_active";

  await supabaseAdmin
    .from("access_requests")
    .update({
      invite_status: input.outcome.status,
      invite_sent_at: sent ? input.outcome.sentAt : null,
      invite_error: input.outcome.error,
      invite_provider_message_id: input.outcome.providerMessageId,
      invite_locked_until: null,
      invite_attempts: (input.row.invite_attempts ?? 0) + 1,
      invited_user_id: input.invitedUserId ?? input.row.invited_user_id,
    })
    .eq("id", input.row.id);

  await recordAudit({
    actorId: input.actorId,
    requestId: input.row.id,
    email: input.row.email,
    trigger: input.trigger,
    outcome: input.outcome,
  });
}

type GeneratedLink = {
  tokenHash: string;
  userId: string | null;
};

async function generateInviteLink(email: string, redirectTo: string): Promise<
  { ok: true; link: GeneratedLink } | { ok: false; alreadyRegistered: boolean; message: string }
> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  if (error) {
    return {
      ok: false,
      alreadyRegistered: isAlreadyRegisteredError(error),
      message: error.message ?? "generate_link_failed",
    };
  }

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) {
    return { ok: false, alreadyRegistered: false, message: "missing_hashed_token" };
  }

  return { ok: true, link: { tokenHash, userId: data?.user?.id ?? null } };
}

async function generateMagicLink(email: string, redirectTo: string): Promise<
  { ok: true; link: GeneratedLink } | { ok: false; message: string }
> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) return { ok: false, message: error.message ?? "generate_link_failed" };

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) return { ok: false, message: "missing_hashed_token" };

  return { ok: true, link: { tokenHash, userId: data?.user?.id ?? null } };
}

/**
 * Envia (ou reenvia) o convite de uma solicitação já aprovada.
 *
 * Garantias:
 * - lease atômico (nenhum envio concorrente);
 * - pré-checagem da configuração ANTES de criar usuário no Supabase Auth;
 * - convite pendente continua o acesso; conta ativa recebe apenas orientação;
 * - nenhum reenvio automático em resultado ambíguo;
 * - nenhuma concessão de crédito.
 */
export async function sendAccessInvite(input: {
  requestId: string;
  actorId: string;
  trigger: AccessInviteTrigger;
}): Promise<AccessInviteServiceResult> {
  const { data: rowData, error: readError } = await supabaseAdmin
    .from("access_requests")
    .select("id,email,status,invite_attempts,invited_user_id")
    .eq("id", input.requestId)
    .maybeSingle();

  if (readError || !rowData) {
    return { ok: false, reason: "not_found", outcome: skippedOutcome() };
  }

  const row = rowData as AccessRequestRow;
  if (row.status !== "approved") {
    return { ok: false, reason: "not_approved", outcome: skippedOutcome() };
  }

  // Lease atômico: só um envio por solicitação.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("access_requests")
    .update({
      invite_status: "sending",
      invite_locked_until: new Date(Date.now() + LEASE_MS).toISOString(),
      invite_last_attempt_at: nowIso(),
      invite_error: null,
    })
    .eq("id", row.id)
    .eq("status", "approved")
    .or(`invite_locked_until.is.null,invite_locked_until.lt.${nowIso()}`)
    .select("id,email,status,invite_attempts,invited_user_id")
    .maybeSingle();

  if (claimError) {
    console.error("access_request invite claim error:", claimError);
    return { ok: false, reason: "locked", outcome: skippedOutcome() };
  }

  if (!claimed) {
    return { ok: false, reason: "locked", outcome: skippedOutcome() };
  }

  const claimedRow = claimed as AccessRequestRow;

  // Fail-closed: sem configuração de envio, não cria usuário nem envia.
  const config = getAccessInviteEmailConfig();
  if (!config.ok || !config.siteUrl) {
    const outcome: AccessInviteOutcome = {
      status: "failed",
      providerMessageId: null,
      sentAt: null,
      error: `email_not_configured:${config.missing.join(",")}`,
    };
    await finalize({
      row: claimedRow,
      actorId: input.actorId,
      trigger: input.trigger,
      outcome,
      invitedUserId: null,
    });
    return { ok: false, outcome };
  }

  const redirectTo = `${config.siteUrl.replace(/\/$/, "")}/convite`;

  let invitedUserId = claimedRow.invited_user_id;
  let kind: InviteEmailKind = "invite";
  let tokenHash: string | null = null;

  try {
    // Caminho 1: já sabemos qual usuário o convite criou.
    if (invitedUserId) {
      const { data: existing, error: existingError } = await supabaseAdmin.auth.admin.getUserById(
        invitedUserId,
      );

      if (!existingError && existing?.user) {
        const user = existing.user as AuthUserLike;
        if (isPendingInvite(user)) {
          const magic = await generateMagicLink(claimedRow.email, redirectTo);
          if (!magic.ok) throw new Error(magic.message);
          tokenHash = magic.link.tokenHash;
          invitedUserId = magic.link.userId ?? invitedUserId;
          kind = "continue";
        } else {
          kind = "account_active";
        }
      } else {
        invitedUserId = null;
      }
    }

    // Caminho 2: primeiro convite (ou usuário do convite não existe mais).
    if (!tokenHash && kind === "invite") {
      const invite = await generateInviteLink(claimedRow.email, redirectTo);

      if (invite.ok) {
        tokenHash = invite.link.tokenHash;
        invitedUserId = invite.link.userId ?? invitedUserId;
      } else if (invite.alreadyRegistered) {
        const user = await findAuthUserByEmail(claimedRow.email);
        if (!user) throw new Error("invite_user_lookup_failed");

        invitedUserId = user.id;
        if (isPendingInvite(user)) {
          const magic = await generateMagicLink(claimedRow.email, redirectTo);
          if (!magic.ok) throw new Error(magic.message);
          tokenHash = magic.link.tokenHash;
          kind = "continue";
        } else {
          kind = "account_active";
        }
      } else {
        throw new Error(invite.message);
      }
    }

    const emailResult = await sendAccessInviteEmail({
      to: claimedRow.email,
      kind,
      ...(tokenHash ? { tokenHash } : {}),
    });

    let outcome: AccessInviteOutcome;
    if (emailResult.status === "sent") {
      outcome = {
        status: kind === "account_active" ? "account_active" : "sent",
        providerMessageId: emailResult.providerMessageId,
        sentAt: nowIso(),
        error: null,
      };
    } else if (emailResult.status === "unconfirmed") {
      outcome = {
        status: "unconfirmed",
        providerMessageId: null,
        sentAt: null,
        error: emailResult.error,
      };
    } else {
      outcome = {
        status: "failed",
        providerMessageId: null,
        sentAt: null,
        error: emailResult.error,
      };
    }

    await finalize({
      row: claimedRow,
      actorId: input.actorId,
      trigger: input.trigger,
      outcome,
      invitedUserId,
    });

    return { ok: outcome.status === "sent" || outcome.status === "account_active", outcome };
  } catch (error) {
    const outcome: AccessInviteOutcome = {
      status: "failed",
      providerMessageId: null,
      sentAt: null,
      error: (error instanceof Error ? error.message : String(error)).slice(0, 300),
    };

    await finalize({
      row: claimedRow,
      actorId: input.actorId,
      trigger: input.trigger,
      outcome,
      invitedUserId,
    });

    return { ok: false, outcome };
  }
}
