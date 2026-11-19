// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  c4DeterministicImageBase64,
  createC4HttpInjection,
  emitC4Activation,
} from "../c4-http-injection";

const client = { from: vi.fn() } as never;

describe("F60.7 C4-I — injeção determinística", () => {
  it("gera bytes JPEG determinísticos nas dimensões exigidas", async () => {
    const square = Buffer.from(
      await c4DeterministicImageBase64("square"),
      "base64",
    );
    const squareMeta = await sharp(square).metadata();
    expect(squareMeta.format).toBe("jpeg");
    expect(squareMeta.width).toBe(1024);
    expect(squareMeta.height).toBe(1024);

    const vertical = Buffer.from(
      await c4DeterministicImageBase64("vertical"),
      "base64",
    );
    const verticalMeta = await sharp(vertical).metadata();
    expect(verticalMeta.format).toBe("jpeg");
    expect(verticalMeta.width).toBe(1152);
    expect(verticalMeta.height).toBe(2048);
  });

  it("compõe base/expand com as fronteiras determinísticas", () => {
    const deps = createC4HttpInjection({ client });
    expect(deps.base).toBeTypeOf("function");
    expect(deps.expand).toBeTypeOf("function");
    expect(deps.prepare).toBeTypeOf("function");
    expect(deps.generateThumbnail).toBeTypeOf("function");
  });

  it("invoca onActivation ao executar a seam determinística", async () => {
    const onActivation = vi.fn();
    const injection = createC4HttpInjection({ client, onActivation });

    await injection.seams.copyInvoker.invoke(
      "campaign_copy" as never,
      {} as never,
      {} as never,
    );

    expect(onActivation).toHaveBeenCalledWith({
      step: "copy",
      source: "deterministic",
      model: "c4-deterministic-provider",
    });
    expect(injection.activation).toEqual([
      {
        step: "copy",
        source: "deterministic",
        model: "c4-deterministic-provider",
      },
    ]);
  });

  it("emite evidência estruturada sem conteúdo/usage/custo", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const onActivation = vi.fn();
    const injection = createC4HttpInjection({
      client,
      onActivation,
    });

    emitC4Activation(
      {
        step: "copy",
        source: "deterministic",
        model: "c4-deterministic-provider",
      },
      {
        campaignId: "campaign-c4",
        operationId: "operation-c4",
        route: "continue",
      },
    );
    expect(onActivation).not.toHaveBeenCalled(); // emitter é separado
    const raw = String(info.mock.calls[0]?.[0] ?? "");
    expect(raw).toContain("[f60.7-c4-i-activation]");
    const payload = JSON.parse(raw.replace("[f60.7-c4-i-activation] ", ""));
    expect(payload).toMatchObject({
      type: "f60.7.c4_i.activation",
      campaignId: "campaign-c4",
      operationId: "operation-c4",
      route: "continue",
      step: "copy",
      source: "deterministic",
      model: "c4-deterministic-provider",
    });
    expect(payload).not.toHaveProperty("content");
    expect(payload).not.toHaveProperty("usage");
    expect(payload).not.toHaveProperty("cost");
    expect(payload).not.toHaveProperty("providerReportedCostUsd");

    void injection;
    info.mockRestore();
  });
});
