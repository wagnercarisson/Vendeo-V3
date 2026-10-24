// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import { DeferredAiTelemetrySink } from "../telemetry-sink";
import type { AiCallEnvelope, AiCapability } from "../types";

function envelope(capability: AiCapability, model = "gpt-5.5"): AiCallEnvelope {
  return {
    capability,
    protocol: "responses",
    status: "success",
    provider: "openai",
    model,
    durationMs: 10,
  };
}

describe("F47.1 — DeferredAiTelemetrySink por tentativa", () => {
  it("enriquece o último envelope da imagem (mesmo com validação depois)", async () => {
    const delivered: AiCallEnvelope[][] = [];
    const sink = new DeferredAiTelemetrySink(async (items) => {
      delivered.push(items);
    });

    sink.emit(envelope("visual_signature_image"));
    sink.emit(envelope("visual_signature_validation"));

    expect(
      sink.enrichLast("visual_signature_image", {
        creative_intent_parse_status: "parsed_json",
        creative_intent_source: "model",
        // campo canônico tentado — deve ser ignorado
        model: "forged",
      }),
    ).toBe(true);

    await sink.flush();

    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toHaveLength(2);
    expect(delivered[0][0].metadata).toEqual({
      creative_intent_parse_status: "parsed_json",
      creative_intent_source: "model",
    });
    // O envelope da validação não recebeu os campos de parsing.
    expect(delivered[0][1].metadata).toBeUndefined();
  });

  it("flush idempotente por instância entrega uma única vez", async () => {
    const handler = vi.fn();
    const sink = new DeferredAiTelemetrySink(handler);
    sink.emit(envelope("visual_signature_image"));

    await sink.flush();
    await sink.flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(sink.isDelivered).toBe(true);
  });

  it("duas instâncias são isoladas (sem flag global)", async () => {
    const deliveredA: AiCallEnvelope[] = [];
    const deliveredB: AiCallEnvelope[] = [];
    const a = new DeferredAiTelemetrySink((items) => {
      deliveredA.push(...items);
    });
    const b = new DeferredAiTelemetrySink((items) => {
      deliveredB.push(...items);
    });

    a.emit(envelope("visual_signature_image", "a"));
    b.emit(envelope("visual_signature_image", "b"));
    a.enrichLast("visual_signature_image", { creative_intent_parse_status: "parsed_json" });

    await a.flush();
    expect(a.isDelivered).toBe(true);
    expect(b.isDelivered).toBe(false);
    expect(deliveredA).toHaveLength(1);
    expect(deliveredB).toHaveLength(0);

    await b.flush();
    expect(deliveredB).toHaveLength(1);
    expect(deliveredB[0].metadata).toBeUndefined();
  });

  it("variações sequenciais não descartam a imagem seguinte", async () => {
    const delivered: string[] = [];
    const makeSink = (model: string) => {
      const sink = new DeferredAiTelemetrySink((items) => {
        delivered.push(...items.map((item) => item.model));
      });
      sink.emit(envelope("visual_signature_image", model));
      return sink;
    };

    const first = makeSink("image-1");
    await first.flush();
    const second = makeSink("image-2");
    await second.flush();

    expect(delivered).toEqual(["image-1", "image-2"]);
  });

  it("falha do handler NÃO limpa o buffer nem declara entrega", async () => {
    const delivered: AiCallEnvelope[][] = [];
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("persist failed"))
      .mockImplementationOnce(async (items: AiCallEnvelope[]) => {
        delivered.push(items);
      });
    const sink = new DeferredAiTelemetrySink(handler);
    sink.emit(envelope("visual_signature_image"));

    await expect(sink.flush()).rejects.toThrow("persist failed");
    expect(sink.isDelivered).toBe(false);
    expect(sink.pending).toHaveLength(1);

    await sink.flush();
    expect(sink.isDelivered).toBe(true);
    expect(delivered).toHaveLength(1);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("emitir depois do flush falha explicitamente (sem perda silenciosa)", async () => {
    const sink = new DeferredAiTelemetrySink(() => {});
    sink.emit(envelope("visual_signature_image"));
    await sink.flush();

    expect(() => sink.emit(envelope("visual_signature_image"))).toThrow(
      "envelope emitido após flush",
    );
  });

  it("enrichLastIfMissing não sobrescreve parsing já enriquecido", () => {
    const sink = new DeferredAiTelemetrySink(() => {});
    sink.emit(envelope("visual_signature_image"));
    sink.enrichLast("visual_signature_image", { creative_intent_parse_status: "parsed_json" });

    const applied = sink.enrichLastIfMissing("visual_signature_image", {
      creative_intent_parse_status: "not_attempted",
    });

    expect(applied).toBe(false);
    expect(sink.pending[0].metadata?.creative_intent_parse_status).toBe("parsed_json");
  });
});
