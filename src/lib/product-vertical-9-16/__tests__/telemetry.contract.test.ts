// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { AiGateway } from "@/lib/ai/gateway";
import type {
  AiAdapter,
  AiCallEnvelope,
  AiInvocationRequest,
  AiInvocationResult,
  AiModelResolver,
  AiTelemetryContext,
} from "@/lib/ai/types";
import { AiInvocationError } from "@/lib/ai/types";
import {
  assertNoSensitiveFields,
  buildVerticalAttemptTelemetry,
  deliveredSizeFromArtifactRow,
  withVerticalCallMetadata,
} from "../telemetry/format-attempt";
import { VerticalImagesAdapter } from "../telemetry/vertical-images-adapter";

const CAPABILITY = "campaign_product_image" as const;

const RESOLVER: AiModelResolver = {
  async resolve() {
    return {
      capability: CAPABILITY,
      segment: "image",
      primary: { provider: "openai", model: "gpt-image-test", protocol: "images" },
    };
  },
  listCapabilities() {
    return [CAPABILITY];
  },
};

function telemetryWithSink(events: AiCallEnvelope[]): AiTelemetryContext {
  return withVerticalCallMetadata(
    {
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: "store-1",
      campaignId: "campaign-1",
      attemptNumber: 1,
      sink: { emit: (envelope) => void events.push(envelope) },
    },
    { format: "9:16", requestedSize: "1152x2048" },
  );
}

function request(): AiInvocationRequest {
  return { prompt: "compose", size: "1152x2048", quality: "low" };
}

async function jpegBase64(width: number, height: number): Promise<string> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 30, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();
  return buffer.toString("base64");
}

function successAdapter(imageBase64: string, metadata?: Record<string, unknown>): AiAdapter {
  return {
    protocol: "images",
    async invoke(): Promise<AiInvocationResult> {
      return { model: "gpt-image-test", imageBase64, mimeType: "image/jpeg", metadata };
    },
  };
}

function gatewayFor(adapter: AiAdapter): AiGateway {
  return new AiGateway(RESOLVER, {
    get: (protocol) => (protocol === "images" ? adapter : undefined),
  });
}

describe("F59/59-09 — telemetria por tentativa vertical", () => {
  it("buildVerticalAttemptTelemetry usa allowlist e não inventa returnSize", () => {
    const telemetry = buildVerticalAttemptTelemetry({
      returnedWidth: 1152,
      returnedHeight: 2048,
      model: "gpt-image-test",
      quality: "low",
      target: "primary",
      outcome: "success",
      campaignId: "campaign-1",
      operationId: "operation-1",
    });
    expect(telemetry).toEqual({
      format: "9:16",
      requestedSize: "1152x2048",
      returnedSize: "1152x2048",
      outcome: "success",
      model: "gpt-image-test",
      quality: "low",
      target: "primary",
      campaignId: "campaign-1",
      operationId: "operation-1",
    });
    expect("deliveredSize" in telemetry).toBe(false);
    assertNoSensitiveFields(telemetry);
  });

  it("returnSize exige ambas as dimensões e nunca copia requestedSize", () => {
    expect(buildVerticalAttemptTelemetry({ returnedWidth: 1024 }).returnedSize).toBeNull();
    expect(buildVerticalAttemptTelemetry({ outcome: "failed" }).returnedSize).toBeNull();
  });

  it("detecta campos sensíveis inclusive aninhados", () => {
    expect(() => assertNoSensitiveFields({ metadata: { prompt: "x" } })).toThrow(
      "sensitive_telemetry_field:prompt",
    );
    expect(() =>
      assertNoSensitiveFields({ metadata: { nested: { imageBytes: "x" } } }),
    ).toThrow("sensitive_telemetry_field:imageBytes");
    expect(() => assertNoSensitiveFields({ format: "9:16" })).not.toThrow();
  });

  it("deliveredSize vem SOMENTE da linha de artefato 1080x1920", () => {
    expect(deliveredSizeFromArtifactRow({ width: 1080, height: 1920 })).toBe(
      "1080x1920",
    );
    expect(deliveredSizeFromArtifactRow({ width: 1024, height: 1024 })).toBeNull();
    expect(deliveredSizeFromArtifactRow(null)).toBeNull();
  });

  it("sucesso com bytes 1152x2048 ⇒ UM evento com format/requested/returned", async () => {
    const events: AiCallEnvelope[] = [];
    const adapter = new VerticalImagesAdapter(
      successAdapter(await jpegBase64(1152, 2048)),
    );
    const result = await gatewayFor(adapter).invoke(
      CAPABILITY,
      request(),
      telemetryWithSink(events),
    );

    expect(result.metadata?.returnedSize).toBe("1152x2048");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: "success",
      metadata: {
        format: "9:16",
        requestedSize: "1152x2048",
        returnedSize: "1152x2048",
        outcome: "success",
      },
    });
    expect(events[0].metadata).not.toHaveProperty("deliveredSize");
  });

  it("dimensão inesperada 1024x1024 é registrada sem mascarar", async () => {
    const events: AiCallEnvelope[] = [];
    const adapter = new VerticalImagesAdapter(
      successAdapter(await jpegBase64(1024, 1024)),
    );
    await gatewayFor(adapter).invoke(CAPABILITY, request(), telemetryWithSink(events));

    expect(events[0].metadata).toMatchObject({
      requestedSize: "1152x2048",
      returnedSize: "1024x1024",
      outcome: "success",
    });
  });

  it.each([
    ["provider_error", "failed"],
    ["timeout", "timeout"],
  ] as const)("falha %s ⇒ evento com outcome %s e sem returnedSize", async (kind, outcome) => {
    const events: AiCallEnvelope[] = [];
    const adapter = new VerticalImagesAdapter({
      protocol: "images",
      async invoke() {
        throw new AiInvocationError({
          kind,
          retryable: kind === "timeout",
          message: kind,
        });
      },
    });

    await expect(
      gatewayFor(adapter).invoke(CAPABILITY, request(), telemetryWithSink(events)),
    ).rejects.toBeInstanceOf(AiInvocationError);

    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(outcome);
    expect(events[0].metadata).toMatchObject({
      format: "9:16",
      requestedSize: "1152x2048",
      outcome,
    });
    expect(events[0].metadata?.returnedSize).toBeUndefined();
  });

  it("result SEM metadata mantém o envelope 1:1 sem a chave metadata", async () => {
    const events: AiCallEnvelope[] = [];
    const context: AiTelemetryContext = {
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: "store-1",
      sink: { emit: (envelope) => void events.push(envelope) },
    };

    await gatewayFor(successAdapter(await jpegBase64(1024, 1024))).invoke(
      CAPABILITY,
      request(),
      context,
    );

    expect(events).toHaveLength(1);
    expect("metadata" in events[0]).toBe(false);
  });

  it("decorador preserva campos originais e só adiciona a allowlist", async () => {
    const events: AiCallEnvelope[] = [];
    const context = telemetryWithSink(events);
    await context.sink.emit({
      capability: CAPABILITY,
      protocol: "images",
      status: "success",
      provider: "openai",
      model: "gpt-image-test",
      durationMs: 10,
      metadata: { existing: "ok", returnedSize: "1152x2048" },
    });

    expect(events[0]).toMatchObject({
      capability: CAPABILITY,
      protocol: "images",
      status: "success",
      provider: "openai",
      model: "gpt-image-test",
      durationMs: 10,
      metadata: {
        existing: "ok",
        returnedSize: "1152x2048",
        format: "9:16",
        requestedSize: "1152x2048",
        outcome: "success",
      },
    });
  });
});
