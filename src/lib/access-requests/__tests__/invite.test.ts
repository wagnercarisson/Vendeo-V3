import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  generateLink: vi.fn(),
  getUserById: vi.fn(),
  listUsers: vi.fn(),
  getConfig: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mocks.from(...args),
    auth: {
      admin: {
        generateLink: (...args: unknown[]) => mocks.generateLink(...args),
        getUserById: (...args: unknown[]) => mocks.getUserById(...args),
        listUsers: (...args: unknown[]) => mocks.listUsers(...args),
      },
    },
  },
}));

vi.mock("@/lib/email/access-invite", () => ({
  getAccessInviteEmailConfig: (...args: unknown[]) => mocks.getConfig(...args),
  sendAccessInviteEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

import { sendAccessInvite } from "../invite";

const baseRow = {
  id: "req-1",
  email: "loja@example.com",
  status: "approved",
  invite_attempts: 0,
  invited_user_id: null,
};

function setupChains(row: unknown = baseRow, claimed: unknown = baseRow) {
  const readChain: any = {};
  readChain.select = () => readChain;
  readChain.eq = () => readChain;
  readChain.maybeSingle = async () => ({ data: row, error: null });

  const claimChain: any = {};
  claimChain.update = () => claimChain;
  claimChain.eq = () => claimChain;
  claimChain.or = () => claimChain;
  claimChain.select = () => claimChain;
  claimChain.maybeSingle = async () => ({ data: claimed, error: null });

  const finalizeUpdates: Array<Record<string, unknown>> = [];
  const finalizeChain: any = {};
  finalizeChain.update = (values: Record<string, unknown>) => {
    finalizeUpdates.push(values);
    return finalizeChain;
  };
  finalizeChain.eq = async () => ({ error: null });

  let accessRequestCalls = 0;
  mocks.from.mockImplementation((table: string) => {
    if (table === "admin_audit_log") {
      return { insert: async () => ({ error: null }) };
    }
    accessRequestCalls += 1;
    if (accessRequestCalls === 1) return readChain;
    if (accessRequestCalls === 2) return claimChain;
    return finalizeChain;
  });

  return { finalizeUpdates };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfig.mockReturnValue({
    ok: true,
    siteUrl: "https://vendeo.tech",
    apiKey: "re_test",
    from: "noreply@vendeo.tech",
    missing: [],
  });
  mocks.sendEmail.mockResolvedValue({ status: "sent", providerMessageId: "msg-1" });
});

describe("sendAccessInvite — orquestração", () => {
  it("config ausente NÃO cria usuário nem envia e-mail", async () => {
    const { finalizeUpdates } = setupChains();
    mocks.getConfig.mockReturnValue({
      ok: false,
      siteUrl: null,
      apiKey: null,
      from: null,
      missing: ["VENDEO_EMAIL_ENABLED"],
    });

    const result = await sendAccessInvite({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "approve",
    });

    expect(result.ok).toBe(false);
    expect(result.outcome.status).toBe("failed");
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(finalizeUpdates[0]).toMatchObject({
      invite_status: "failed",
      invite_error: "email_not_configured:VENDEO_EMAIL_ENABLED",
    });
  });

  it("primeiro convite: generateLink invite + e-mail kind=invite", async () => {
    const { finalizeUpdates } = setupChains();
    mocks.generateLink.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        properties: { hashed_token: "hash-1" },
      },
      error: null,
    });

    const result = await sendAccessInvite({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "approve",
    });

    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "invite",
      email: "loja@example.com",
      options: { redirectTo: "https://vendeo.tech/convite" },
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: "loja@example.com",
      kind: "invite",
      tokenHash: "hash-1",
    });
    expect(result.outcome).toMatchObject({ status: "sent", providerMessageId: "msg-1" });
    expect(finalizeUpdates[0]).toMatchObject({
      invite_status: "sent",
      invite_provider_message_id: "msg-1",
      invited_user_id: "user-1",
    });
  });

  it("convite pendente conhecido → magiclink de continuação (não invite)", async () => {
    const pendingRow = { ...baseRow, invited_user_id: "user-1" };
    setupChains(pendingRow, pendingRow);
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "loja@example.com",
          invited_at: "2026-10-20T12:00:00Z",
          email_confirmed_at: null,
          last_sign_in_at: null,
        },
      },
      error: null,
    });
    mocks.generateLink.mockResolvedValue({
      data: { user: { id: "user-1" }, properties: { hashed_token: "hash-2" } },
      error: null,
    });

    const result = await sendAccessInvite({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "resend",
    });

    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "loja@example.com",
      options: { redirectTo: "https://vendeo.tech/convite" },
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: "loja@example.com",
      kind: "continue",
      tokenHash: "hash-2",
    });
    expect(result.outcome.status).toBe("sent");
  });

  it("conta já ativa → e-mail de orientação, sem magiclink e sem troca de senha", async () => {
    const activeRow = { ...baseRow, invited_user_id: "user-2" };
    setupChains(activeRow, activeRow);
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "loja@example.com",
          invited_at: "2026-10-20T12:00:00Z",
          email_confirmed_at: "2026-10-20T12:05:00Z",
          last_sign_in_at: "2026-10-20T12:10:00Z",
        },
      },
      error: null,
    });

    const result = await sendAccessInvite({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "resend",
    });

    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: "loja@example.com",
      kind: "account_active",
    });
    expect(result.outcome.status).toBe("account_active");
  });

  it("erro 'already registered' + conta ativa → account_active (sem reset de senha)", async () => {
    setupChains();
    mocks.generateLink.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered", code: "email_exists" },
    });
    mocks.listUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "user-3",
            email: "loja@example.com",
            invited_at: "2026-10-20T12:00:00Z",
            email_confirmed_at: "2026-10-20T12:05:00Z",
            last_sign_in_at: null,
          },
        ],
      },
      error: null,
    });

    const result = await sendAccessInvite({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "approve",
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: "loja@example.com",
      kind: "account_active",
    });
    expect(result.outcome.status).toBe("account_active");
  });

  it("erro genérico do Supabase NÃO é tratado como usuário existente", async () => {
    setupChains();
    mocks.generateLink.mockResolvedValue({
      data: null,
      error: { message: "Database error saving new user" },
    });

    const result = await sendAccessInvite({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "approve",
    });

    expect(mocks.listUsers).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(result.outcome.status).toBe("failed");
  });

  it("resultado ambíguo do provedor → unconfirmed, sem reenvio automático", async () => {
    setupChains();
    mocks.generateLink.mockResolvedValue({
      data: { user: { id: "user-4" }, properties: { hashed_token: "hash-3" } },
      error: null,
    });
    mocks.sendEmail.mockResolvedValue({ status: "unconfirmed", error: "timeout" });

    const result = await sendAccessInvite({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "approve",
    });

    expect(result.outcome.status).toBe("unconfirmed");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("solicitação não aprovada → não envia", async () => {
    setupChains({ ...baseRow, status: "pending" }, { ...baseRow, status: "pending" });

    const result = await sendAccessInvite({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "resend",
    });

    expect(result.reason).toBe("not_approved");
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
