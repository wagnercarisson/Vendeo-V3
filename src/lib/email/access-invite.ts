import "server-only";

/**
 * Envio do e-mail de convite/continuação de acesso ao beta.
 *
 * Decisões de segurança:
 * - O token NUNCA é persistido nem logado; só existe no link do e-mail.
 * - O e-mail não contém pixel de abertura nem parâmetros de rastreamento.
 *   O link aponta para /convite, que NÃO consome o token no GET — o consumo
 *   só acontece no clique humano (POST em /auth/confirm). Assim, mesmo que um
 *   verificador automático abra o link, o convite permanece válido.
 * - O rastreamento de cliques do domínio remetente deve permanecer desligado
 *   no painel do provedor (defesa em profundidade).
 * - "sent" significa que o provedor ACEITOU a mensagem, não que ela foi
 *   entregue. Resultado ambíguo (timeout/5xx/rede) vira "unconfirmed".
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export type InviteEmailKind = "invite" | "continue" | "account_active";

export type InviteEmailResult =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "failed"; error: string }
  | { status: "unconfirmed"; error: string };

export interface AccessInviteEmailConfig {
  ok: boolean;
  siteUrl: string | null;
  apiKey: string | null;
  from: string | null;
  missing: string[];
}

export function getAccessInviteEmailConfig(): AccessInviteEmailConfig {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || null;
  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const from = process.env.VENDEO_EMAIL_FROM?.trim() || null;
  const missing: string[] = [];

  if (!siteUrl) missing.push("NEXT_PUBLIC_SITE_URL");
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!from) missing.push("VENDEO_EMAIL_FROM");
  if (process.env.VENDEO_EMAIL_ENABLED !== "true") missing.push("VENDEO_EMAIL_ENABLED");

  return { ok: missing.length === 0, siteUrl, apiKey, from, missing };
}

export function buildAccessInviteLink(
  siteUrl: string,
  tokenHash: string,
  kind: Exclude<InviteEmailKind, "account_active">,
): string {
  const type = kind === "invite" ? "invite" : "magiclink";
  return `${siteUrl.replace(/\/$/, "")}/convite?token_hash=${encodeURIComponent(
    tokenHash,
  )}&type=${type}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "erro desconhecido");
  return message.replace(/\s+/g, " ").trim().slice(0, 300);
}

function buildContent(input: {
  kind: InviteEmailKind;
  siteUrl: string;
  tokenHash?: string;
}): { subject: string; html: string; text: string } {
  if (input.kind === "account_active") {
    const loginUrl = `${input.siteUrl.replace(/\/$/, "")}/login`;
    return {
      subject: "Seu acesso ao Vendeo já está ativo",
      html: [
        "<h2>Seu acesso ao Vendeo já está ativo</h2>",
        "<p>Este e-mail já possui uma conta ativa no Vendeo.</p>",
        `<p><a href="${escapeHtml(loginUrl)}">Entrar na sua conta</a></p>`,
        "<p>Se você esqueceu a senha, use a opção de recuperação na tela de login.</p>",
      ].join(""),
      text: [
        "Seu acesso ao Vendeo já está ativo.",
        "Este e-mail já possui uma conta ativa no Vendeo.",
        `Entre em: ${loginUrl}`,
        "Se você esqueceu a senha, use a opção de recuperação na tela de login.",
      ].join("\n\n"),
    };
  }

  if (!input.tokenHash) {
    throw new Error("missing_token_hash");
  }

  const link = buildAccessInviteLink(input.siteUrl, input.tokenHash, input.kind);
  const subject =
    input.kind === "invite"
      ? "Seu convite de acesso ao Vendeo"
      : "Continue seu acesso ao Vendeo";

  return {
    subject,
    html: [
      "<h2>Seu acesso ao Vendeo foi aprovado</h2>",
      "<p>Clique no botão abaixo para aceitar o convite e definir sua senha de acesso.</p>",
      `<p><a href="${escapeHtml(link)}">Aceitar convite</a></p>`,
      "<p>Este link é pessoal, de uso único e expira em alguns dias.</p>",
      "<p>Se você não solicitou acesso ao Vendeo, ignore este e-mail.</p>",
    ].join(""),
    text: [
      "Seu acesso ao Vendeo foi aprovado.",
      "Acesse o link abaixo para aceitar o convite e definir sua senha:",
      link,
      "Este link é pessoal, de uso único e expira em alguns dias.",
      "Se você não solicitou acesso ao Vendeo, ignore este e-mail.",
    ].join("\n\n"),
  };
}

export async function sendAccessInviteEmail(input: {
  to: string;
  kind: InviteEmailKind;
  tokenHash?: string;
}): Promise<InviteEmailResult> {
  const config = getAccessInviteEmailConfig();
  if (!config.ok || !config.siteUrl || !config.apiKey || !config.from) {
    return { status: "failed", error: `email_not_configured:${config.missing.join(",")}` };
  }

  let content: { subject: string; html: string; text: string };
  try {
    content = buildContent({ kind: input.kind, siteUrl: config.siteUrl, tokenHash: input.tokenHash });
  } catch (error) {
    return { status: "failed", error: safeError(error) };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!response.ok) {
      // 5xx pode significar aceite parcial: nunca reenviar automaticamente.
      if (response.status >= 500) {
        return {
          status: "unconfirmed",
          error: safeError(`provider_http_${response.status}:${body.message ?? ""}`),
        };
      }
      return {
        status: "failed",
        error: safeError(`provider_http_${response.status}:${body.message ?? ""}`),
      };
    }

    return { status: "sent", providerMessageId: body.id ?? null };
  } catch (error) {
    // Timeout ou falha de rede deixam o resultado indefinido.
    return { status: "unconfirmed", error: safeError(error) };
  } finally {
    clearTimeout(timer);
  }
}
