import "server-only";

import { formatDateTimeBR } from "@/lib/formatters";
import { getAccessInviteEmailConfig } from "./access-invite";

/**
 * Aviso interno ao administrador quando uma NOVA solicitação de acesso é
 * persistida. Reutiliza o mesmo provedor/credencial/remetente Resend do convite
 * de acesso (`RESEND_API_KEY`, `VENDEO_EMAIL_FROM`, `VENDEO_EMAIL_ENABLED` e
 * `NEXT_PUBLIC_SITE_URL`) — nenhuma variável nova.
 *
 * Segurança:
 * - destinatário fixo (não vem do visitante);
 * - nenhum token de aprovação/convite;
 * - HTML escapa nome/loja fornecidos pelo visitante;
 * - não inclui WhatsApp nem outros dados desnecessários;
 * - erros persistidos são apenas códigos seguros (sem corpo cru do provider).
 */

export const ADMIN_ACCESS_REQUEST_NOTICE_RECIPIENT = "comercial@vendeo.tech";
export const ADMIN_ACCESS_REQUEST_NOTICE_SUBJECT =
  "Vendeo — nova solicitação de acesso";

const RESEND_ENDPOINT =
  process.env.RESEND_API_URL?.trim() || "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export interface AccessRequestNoticeEmailConfig {
  ok: boolean;
  siteUrl: string | null;
  apiKey: string | null;
  from: string | null;
  missing: string[];
  disabled: boolean;
}

export function getAccessRequestNoticeEmailConfig(): AccessRequestNoticeEmailConfig {
  const config = getAccessInviteEmailConfig();
  const disabled = process.env.VENDEO_EMAIL_ENABLED !== "true";
  return { ...config, disabled };
}

export interface AccessRequestNoticeContentInput {
  requestId: string;
  name?: string | null;
  storeName?: string | null;
  createdAt: string;
  siteUrl: string;
}

export interface AccessRequestNoticeContent {
  subject: string;
  html: string;
  text: string;
  adminUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Constrói o conteúdo determinístico (exportado para testes offline). */
export function buildAccessRequestNotice(
  input: AccessRequestNoticeContentInput,
): AccessRequestNoticeContent {
  const adminUrl = `${input.siteUrl.replace(/\/$/, "")}/admin/access-requests`;
  const name = input.name?.trim() || null;
  const storeName = input.storeName?.trim() || null;
  const requestedAt = formatDateTimeBR(input.createdAt);

  const textLines = [
    "Nova solicitação de acesso ao Vendeo.",
    ...(name ? [`Nome: ${name}`] : []),
    ...(storeName ? [`Loja: ${storeName}`] : []),
    `Data/hora: ${requestedAt}`,
    `Acesse o painel administrativo: ${adminUrl}`,
  ];

  const htmlLines = [
    "<h2>Nova solicitação de acesso ao Vendeo</h2>",
    ...(name ? [`<p><strong>Nome:</strong> ${escapeHtml(name)}</p>`] : []),
    ...(storeName
      ? [`<p><strong>Loja:</strong> ${escapeHtml(storeName)}</p>`]
      : []),
    `<p><strong>Data/hora:</strong> ${escapeHtml(requestedAt)}</p>`,
    `<p><a href="${escapeHtml(adminUrl)}">Abrir solicitações no admin</a></p>`,
    "<p>O link exige autenticação e autorização administrativa.</p>",
  ];

  return {
    subject: ADMIN_ACCESS_REQUEST_NOTICE_SUBJECT,
    html: htmlLines.join(""),
    text: textLines.join("\n\n"),
    adminUrl,
  };
}

export type AccessRequestNoticeSendResult =
  | { status: "sent"; providerMessageId: string | null; errorCode: null }
  | { status: "failed"; providerMessageId: null; errorCode: string }
  | { status: "unconfirmed"; providerMessageId: null; errorCode: string }
  | { status: "suppressed"; providerMessageId: null; errorCode: string };

export type AccessRequestNoticeFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export async function sendAccessRequestNotice(
  input: AccessRequestNoticeContentInput,
  fetchImpl: AccessRequestNoticeFetch = fetch,
): Promise<AccessRequestNoticeSendResult> {
  const config = getAccessRequestNoticeEmailConfig();
  if (!config.ok || !config.siteUrl || !config.apiKey || !config.from) {
    return {
      status: "suppressed",
      providerMessageId: null,
      errorCode: config.disabled ? "email_disabled" : "email_not_configured",
    };
  }

  const content = buildAccessRequestNotice({
    ...input,
    siteUrl: config.siteUrl,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        // Mesma chave por solicitação: reenvios seguros no provider quando
        // suportado. Não prometemos entrega exatamente uma vez.
        "Idempotency-Key": `access-request-notice:${input.requestId}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [ADMIN_ACCESS_REQUEST_NOTICE_RECIPIENT],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: response.status >= 500 ? "unconfirmed" : "failed",
        providerMessageId: null,
        errorCode: `provider_http_${response.status}`,
      };
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return {
      status: "sent",
      providerMessageId: body.id ?? null,
      errorCode: null,
    };
  } catch (error) {
    const isAbort =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError");
    return {
      status: "unconfirmed",
      providerMessageId: null,
      errorCode: isAbort ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timer);
  }
}
