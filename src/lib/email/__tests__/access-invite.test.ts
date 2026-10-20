import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildAccessInviteLink,
  getAccessInviteEmailConfig,
} from "../access-invite";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://vendeo.tech";
  process.env.RESEND_API_KEY = "re_test";
  process.env.VENDEO_EMAIL_FROM = "noreply@vendeo.tech";
  process.env.VENDEO_EMAIL_ENABLED = "true";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("access-invite — configuração e link", () => {
  it("link de convite aponta para /convite (não consome no GET)", () => {
    const link = buildAccessInviteLink("https://vendeo.tech/", "abc123", "invite");

    expect(link).toBe("https://vendeo.tech/convite?token_hash=abc123&type=invite");
  });

  it("link de continuação usa type=magiclink", () => {
    const link = buildAccessInviteLink("https://vendeo.tech", "abc123", "continue");

    expect(link).toBe("https://vendeo.tech/convite?token_hash=abc123&type=magiclink");
  });

  it("codifica o token no link", () => {
    const link = buildAccessInviteLink("https://vendeo.tech", "a+b/c=", "invite");

    expect(link).toContain("token_hash=a%2Bb%2Fc%3D");
  });

  it("config completa → ok", () => {
    const config = getAccessInviteEmailConfig();

    expect(config.ok).toBe(true);
    expect(config.missing).toEqual([]);
  });

  it("flag de envio desligada → fail-closed com motivo", () => {
    process.env.VENDEO_EMAIL_ENABLED = "false";

    const config = getAccessInviteEmailConfig();

    expect(config.ok).toBe(false);
    expect(config.missing).toContain("VENDEO_EMAIL_ENABLED");
  });

  it("sem chave/remetente → fail-closed", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.VENDEO_EMAIL_FROM;

    const config = getAccessInviteEmailConfig();

    expect(config.ok).toBe(false);
    expect(config.missing).toEqual(
      expect.arrayContaining(["RESEND_API_KEY", "VENDEO_EMAIL_FROM"]),
    );
  });
});
