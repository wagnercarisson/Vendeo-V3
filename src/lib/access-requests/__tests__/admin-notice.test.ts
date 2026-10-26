import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isRetryableAdminNoticeStatus,
  notifyAdminOfAccessRequest,
} from "../admin-notice";
import type { AccessRequestNoticeSendResult } from "@/lib/email/access-request-notice";

interface Row {
  id: string;
  created_at: string;
  name: string | null;
  store_name: string | null;
  admin_notice_status: string | null;
  admin_notice_attempts: number;
  admin_notice_attempt_token: string | null;
  admin_notice_locked_until: string | null;
  admin_notice_sent_at: string | null;
  admin_notice_error: string | null;
  admin_notice_provider_message_id: string | null;
}

function baseRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "req-1",
    created_at: "2026-10-26T19:00:00.000Z",
    name: "Ana",
    store_name: "Loja Teste",
    admin_notice_status: "pending",
    admin_notice_attempts: 0,
    admin_notice_attempt_token: null,
    admin_notice_locked_until: null,
    admin_notice_sent_at: null,
    admin_notice_error: null,
    admin_notice_provider_message_id: null,
    ...overrides,
  };
}

type Filter =
  | { kind: "eq"; value: unknown }
  | { kind: "in"; values: unknown[] }
  | { kind: "is_null" }
  | { kind: "lt"; value: string | number };

function matches(row: Row, filters: Record<string, Filter>): boolean {
  for (const [column, filter] of Object.entries(filters)) {
    const value = (row as unknown as Record<string, unknown>)[column] ?? null;
    if (filter.kind === "eq" && value !== filter.value) return false;
    if (filter.kind === "in" && !filter.values.includes(value)) return false;
    if (filter.kind === "is_null" && value !== null) return false;
    if (filter.kind === "lt") {
      if (typeof filter.value === "number") {
        if (typeof value !== "number" || value >= filter.value) return false;
      } else {
        if (value === null || new Date(String(value)).getTime() >= new Date(filter.value).getTime()) {
          return false;
        }
      }
    }
  }
  return true;
}

function fakeClient(initial: Row, options: { claimError?: boolean } = {}) {
  const row = { ...initial };
  const updates: Array<{ patch: Record<string, unknown>; filters: Record<string, Filter> }> = [];

  const client = {
    from: () => {
      let patch: Record<string, unknown> = {};
      const filters: Record<string, Filter> = {};
      const builder: any = {
        update: (value: Record<string, unknown>) => {
          patch = value;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters[column] = { kind: "eq", value };
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          filters[column] = { kind: "in", values };
          return builder;
        },
        is: (column: string, value: unknown) => {
          if (value === null) filters[column] = { kind: "is_null" };
          return builder;
        },
        lt: (column: string, value: string | number) => {
          filters[column] = { kind: "lt", value };
          return builder;
        },
        select: () => builder,
        maybeSingle: async () => {
          updates.push({ patch, filters });
          if (options.claimError) return { data: null, error: { message: "db down" } };
          if (!matches(row, filters)) return { data: null, error: null };
          Object.assign(row, patch);
          return { data: { ...row }, error: null };
        },
      };
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, row, updates };
}

function senderReturning(result: AccessRequestNoticeSendResult) {
  return vi.fn(async () => result);
}

beforeEach(() => {
  vi.stubEnv("VENDEO_EMAIL_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.vendeo.test");
  vi.stubEnv("RESEND_API_KEY", "resend-key");
  vi.stubEnv("VENDEO_EMAIL_FROM", "noreply@vendeo.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("notifyAdminOfAccessRequest — estado durável", () => {
  it("pending → claim → sent, persiste provider id e incrementa tentativas", async () => {
    const fake = fakeClient(baseRow());
    const sender = senderReturning({
      status: "sent",
      providerMessageId: "email-1",
      errorCode: null,
    });

    const result = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(result).toMatchObject({
      status: "sent",
      providerMessageId: "email-1",
      persisted: true,
    });
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-1",
        name: "Ana",
        storeName: "Loja Teste",
        createdAt: "2026-10-26T19:00:00.000Z",
        siteUrl: "https://app.vendeo.test",
      }),
    );
    expect(fake.row.admin_notice_status).toBe("sent");
    expect(fake.row.admin_notice_attempts).toBe(1);
    expect(fake.row.admin_notice_provider_message_id).toBe("email-1");
    expect(fake.row.admin_notice_sent_at).not.toBeNull();
    expect(fake.row.admin_notice_attempt_token).toBeNull();
  });

  it("falha do provider preserva a solicitação e registra código seguro", async () => {
    const fake = fakeClient(baseRow());
    const sender = senderReturning({
      status: "failed",
      providerMessageId: null,
      errorCode: "provider_http_422",
    });

    const result = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(result).toMatchObject({
      status: "failed",
      errorCode: "provider_http_422",
      persisted: true,
    });
    expect(fake.row.id).toBe("req-1");
    expect(fake.row.admin_notice_status).toBe("failed");
    expect(fake.row.admin_notice_error).toBe("provider_http_422");
    expect(fake.row.admin_notice_attempts).toBe(1);
  });

  it("timeout/5xx → unconfirmed, distinguível de aceite", async () => {
    const fake = fakeClient(baseRow());
    const sender = senderReturning({
      status: "unconfirmed",
      providerMessageId: null,
      errorCode: "timeout",
    });

    await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(fake.row.admin_notice_status).toBe("unconfirmed");
    expect(fake.row.admin_notice_error).toBe("timeout");
  });

  it("claim já tomado/sent → skipped, sem segundo envio", async () => {
    const fake = fakeClient(baseRow({ admin_notice_status: "sent" }));
    const sender = vi.fn();

    const result = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(result).toMatchObject({ status: "skipped", persisted: false });
    expect(sender).not.toHaveBeenCalled();
  });

  it("máximo de 3 tentativas finalizadas bloqueia novo envio", async () => {
    const fake = fakeClient(
      baseRow({ admin_notice_status: "failed", admin_notice_attempts: 3 }),
    );
    const sender = vi.fn();

    const result = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(result.status).toBe("skipped");
    expect(sender).not.toHaveBeenCalled();
  });

  it("configuração desabilitada → suppressed durável, sem chamar provider", async () => {
    vi.stubEnv("VENDEO_EMAIL_ENABLED", "false");
    const fake = fakeClient(baseRow());
    const sender = vi.fn();

    const result = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(result).toMatchObject({
      status: "suppressed",
      errorCode: "email_disabled",
      persisted: true,
    });
    expect(sender).not.toHaveBeenCalled();
    expect(fake.row.admin_notice_status).toBe("suppressed");
    expect(fake.row.admin_notice_error).toBe("email_disabled");
  });

  it("tentativa antiga não sobrescreve o lease atual (stale)", async () => {
    const fake = fakeClient(baseRow());
    const sender = vi.fn(async () => {
      // Outra tentativa assumiu o lease antes da finalização.
      fake.row.admin_notice_attempt_token = "other-attempt";
      return {
        status: "sent" as const,
        providerMessageId: "email-1",
        errorCode: null,
      };
    });

    const result = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(result).toMatchObject({ status: "stale", persisted: false });
    expect(fake.row.admin_notice_status).toBe("sending");
    expect(fake.row.admin_notice_attempt_token).toBe("other-attempt");
  });

  it("reexecução após falha reenvia o MESMO aviso; depois de sent não reenvia", async () => {
    const fake = fakeClient(baseRow());
    const failSender = senderReturning({
      status: "failed",
      providerMessageId: null,
      errorCode: "provider_http_500",
    });
    await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender: failSender,
    });
    expect(fake.row.admin_notice_status).toBe("failed");

    const successSender = senderReturning({
      status: "sent",
      providerMessageId: "email-2",
      errorCode: null,
    });
    const second = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender: successSender,
    });
    expect(second.status).toBe("sent");

    const thirdSender = vi.fn();
    const third = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender: thirdSender,
    });
    expect(third.status).toBe("skipped");
    expect(thirdSender).not.toHaveBeenCalled();
  });

  it("erro de claim não chama o provider e não inventa sucesso", async () => {
    const fake = fakeClient(baseRow(), { claimError: true });
    const sender = vi.fn();

    const result = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(result).toMatchObject({
      status: "skipped",
      errorCode: "claim_failed",
      persisted: false,
    });
    expect(sender).not.toHaveBeenCalled();
  });

  it("sender lançando → failed seguro, sem vazar mensagem bruta", async () => {
    const fake = fakeClient(baseRow());
    const sender = vi.fn(async () => {
      throw new Error("raw provider secret");
    });

    const result = await notifyAdminOfAccessRequest("req-1", {
      client: fake.client,
      sender,
    });

    expect(result).toMatchObject({
      status: "failed",
      errorCode: "send_exception",
    });
    expect(fake.row.admin_notice_error).toBe("send_exception");
    expect(JSON.stringify(fake.row)).not.toContain("raw provider secret");
  });

  it("isRetryableAdminNoticeStatus cobre apenas estados retomáveis", () => {
    expect(isRetryableAdminNoticeStatus("pending")).toBe(true);
    expect(isRetryableAdminNoticeStatus("failed")).toBe(true);
    expect(isRetryableAdminNoticeStatus("unconfirmed")).toBe(true);
    expect(isRetryableAdminNoticeStatus("suppressed")).toBe(true);
    expect(isRetryableAdminNoticeStatus("sending")).toBe(true);
    expect(isRetryableAdminNoticeStatus("sent")).toBe(false);
    expect(isRetryableAdminNoticeStatus(null)).toBe(false);
  });
});
