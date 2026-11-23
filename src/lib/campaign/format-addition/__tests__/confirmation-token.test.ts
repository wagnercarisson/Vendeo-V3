// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createFormatAdditionConfirmationToken,
  verifyFormatAdditionConfirmationToken,
} from "../confirmation-token";

const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const REQUEST = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const CHECKSUM = "a".repeat(64);
const SECRET = "test-format-addition-secret";
const NOW = Date.parse("2026-11-23T12:00:00.000Z");

function create(intent: "start" | "retry" = "start") {
  return createFormatAdditionConfirmationToken(
    {
      campaignId: CAMPAIGN,
      sourceChecksum: CHECKSUM,
      requestId: REQUEST,
      intent,
    },
    { secret: SECRET, now: NOW },
  );
}

describe("F62-05 — token de confirmação da adição", () => {
  it("emite e verifica payload vinculado a campanha/fonte/custo/request", () => {
    const created = create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const verified = verifyFormatAdditionConfirmationToken(created.token, {
      secret: SECRET,
      now: NOW + 1000,
    });
    expect(verified).toEqual({ ok: true, payload: created.payload });
    expect(created.payload).toMatchObject({
      v: 1,
      campaignId: CAMPAIGN,
      format: "9:16",
      sourceChecksum: CHECKSUM,
      costCredits: 1,
      requestId: REQUEST,
      intent: "start",
    });
  });

  it("segredo ausente falha fechado na emissão e na verificação", () => {
    expect(
      createFormatAdditionConfirmationToken(
        {
          campaignId: CAMPAIGN,
          sourceChecksum: CHECKSUM,
          requestId: REQUEST,
          intent: "start",
        },
        { secret: null, now: NOW },
      ),
    ).toEqual({ ok: false, reason: "secret_missing" });

    const created = create();
    if (!created.ok) throw new Error("expected token");
    expect(
      verifyFormatAdditionConfirmationToken(created.token, {
        secret: "",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "secret_missing" });
  });

  it("token adulterado ou com formato/custo alterado é recusado", () => {
    const created = create();
    if (!created.ok) throw new Error("expected token");
    const [body, signature] = created.token.split(".");
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    payload.costCredits = 0;
    const tamperedBody = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    expect(
      verifyFormatAdditionConfirmationToken(`${tamperedBody}.${signature}`, {
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      verifyFormatAdditionConfirmationToken(`${body}.${signature}x`, {
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("token expirado é recusado", () => {
    const created = create("retry");
    if (!created.ok) throw new Error("expected token");
    expect(
      verifyFormatAdditionConfirmationToken(created.token, {
        secret: SECRET,
        now: NOW + 10 * 60 * 1000 + 1,
      }),
    ).toEqual({ ok: false, reason: "expired" });
  });
});
