import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_ACCESS_REQUEST_NOTICE_RECIPIENT,
  ADMIN_ACCESS_REQUEST_NOTICE_SUBJECT,
  buildAccessRequestNotice,
  sendAccessRequestNotice,
} from "../access-request-notice";

const INPUT = {
  requestId: "req-1",
  name: "Ana <script>alert(1)</script>",
  storeName: "Loja & Cia",
  createdAt: "2026-10-26T19:00:00.000Z",
  siteUrl: "https://app.vendeo.test/",
};

beforeEach(() => {
  vi.stubEnv("VENDEO_EMAIL_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.vendeo.test");
  vi.stubEnv("RESEND_API_KEY", "resend-key");
  vi.stubEnv("VENDEO_EMAIL_FROM", "noreply@vendeo.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildAccessRequestNotice — conteúdo e segurança", () => {
  it("assunto fixo, destinatário fixo, link admin absoluto e horário brasileiro", () => {
    const content = buildAccessRequestNotice(INPUT);

    expect(content.subject).toBe(ADMIN_ACCESS_REQUEST_NOTICE_SUBJECT);
    expect(ADMIN_ACCESS_REQUEST_NOTICE_RECIPIENT).toBe("comercial@vendeo.tech");
    expect(content.adminUrl).toBe("https://app.vendeo.test/admin/access-requests");
    expect(content.text).toContain("Data/hora: 26/10/2026, 16:00");
    expect(content.text).toContain("https://app.vendeo.test/admin/access-requests");
    expect(content.text).toContain("Nome: Ana <script>alert(1)</script>");
    expect(content.text).toContain("Loja: Loja & Cia");
  });

  it("escapa HTML do visitante e não inclui WhatsApp/token", () => {
    const content = buildAccessRequestNotice(INPUT);

    expect(content.html).not.toContain("<script>alert(1)</script>");
    expect(content.html).toContain("Ana &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(content.html).toContain("Loja &amp; Cia");
    expect(content.html).not.toMatch(/whatsapp|token|convite/i);
    expect(content.text).not.toMatch(/whatsapp|token/i);
  });

  it("campos opcionais ausentes não criam linhas vazias", () => {
    const content = buildAccessRequestNotice({
      ...INPUT,
      name: null,
      storeName: null,
    });

    expect(content.text).not.toContain("Nome:");
    expect(content.text).not.toContain("Loja:");
    expect(content.html).not.toContain("<strong>Nome:</strong>");
    expect(content.html).not.toContain("<strong>Loja:</strong>");
  });
});

describe("sendAccessRequestNotice — Resend mockado", () => {
  it("envia ao destinatário fixo com idempotency key e retorna sent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "email-1" }),
    });

    const result = await sendAccessRequestNotice(INPUT, fetchMock);

    expect(result).toEqual({
      status: "sent",
      providerMessageId: "email-1",
      errorCode: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer resend-key",
          "Idempotency-Key": "access-request-notice:req-1",
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.to).toEqual(["comercial@vendeo.tech"]);
    expect(body.from).toBe("noreply@vendeo.test");
    expect(body.subject).toBe(ADMIN_ACCESS_REQUEST_NOTICE_SUBJECT);
    expect(body.html).toContain("admin/access-requests");
    expect(body.text).toContain("admin/access-requests");
  });

  it("HTTP 5xx → unconfirmed; HTTP 4xx → failed (sem corpo bruto)", async () => {
    const fetch500 = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: "raw provider detail" }),
    });
    await expect(sendAccessRequestNotice(INPUT, fetch500)).resolves.toEqual({
      status: "unconfirmed",
      providerMessageId: null,
      errorCode: "provider_http_503",
    });

    const fetch400 = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "raw provider detail" }),
    });
    await expect(sendAccessRequestNotice(INPUT, fetch400)).resolves.toEqual({
      status: "failed",
      providerMessageId: null,
      errorCode: "provider_http_422",
    });
  });

  it("timeout/rede → unconfirmed com código seguro", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    await expect(
      sendAccessRequestNotice(INPUT, vi.fn().mockRejectedValue(abort)),
    ).resolves.toEqual({
      status: "unconfirmed",
      providerMessageId: null,
      errorCode: "timeout",
    });

    await expect(
      sendAccessRequestNotice(INPUT, vi.fn().mockRejectedValue(new Error("ECONNRESET raw"))),
    ).resolves.toEqual({
      status: "unconfirmed",
      providerMessageId: null,
      errorCode: "network_error",
    });
  });

  it("email desabilitado → suppressed, sem chamar o provider", async () => {
    vi.stubEnv("VENDEO_EMAIL_ENABLED", "false");
    const fetchMock = vi.fn();

    await expect(sendAccessRequestNotice(INPUT, fetchMock)).resolves.toEqual({
      status: "suppressed",
      providerMessageId: null,
      errorCode: "email_disabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("configuração ausente → suppressed (sem nova variável/fallback)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();

    await expect(sendAccessRequestNotice(INPUT, fetchMock)).resolves.toEqual({
      status: "suppressed",
      providerMessageId: null,
      errorCode: "email_not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
