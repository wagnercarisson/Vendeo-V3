// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

/**
 * Mock PARCIAL do módulo do adapter: `UpstreamImagesAdapter` (real, apenas
 * instrumentado), `createOpenAiImagesSdkLoader` real e os tipos continuam
 * disponíveis. Nenhum `openai` é importado porque o loader só é invocado na
 * chamada (e os testes injetam loader fake ou apenas espionam a fábrica).
 */
const spy = vi.hoisted(() => ({
  create: vi.fn(),
  adapterArgs: [] as unknown[],
}));

vi.mock("@/lib/ai/adapters/upstream-images", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ai/adapters/upstream-images")
  >("@/lib/ai/adapters/upstream-images");

  type AdapterArgs = ConstructorParameters<typeof actual.UpstreamImagesAdapter>;

  class RecordingAdapter extends actual.UpstreamImagesAdapter {
    constructor(loadSdk?: AdapterArgs[0], options?: AdapterArgs[1]) {
      super(loadSdk, options);
      spy.adapterArgs.push({ loadSdk, options });
    }
  }

  return {
    ...actual,
    UpstreamImagesAdapter: RecordingAdapter,
    createOpenAiImagesSdkLoader: (options?: { maxRetries?: number }) => {
      spy.create(options);
      return actual.createOpenAiImagesSdkLoader(options);
    },
  };
});

import type { UpstreamImagesSdkLoader } from "@/lib/ai/adapters/upstream-images";
import type { PreparedInvocation } from "@/lib/ai/gateway";
import { NoopAiTelemetrySink } from "@/lib/ai/telemetry-sink";
import {
  AiInvocationError,
  type AiInvocationRequest,
  type AiTelemetryContext,
} from "@/lib/ai/types";

import {
  createExpansionAbortSignal,
  createExpansionTransport,
  invokeExpansionOnce,
  type ExpansionTransportTarget,
} from "../transport";

const TARGET: ExpansionTransportTarget = {
  provider: "openai",
  model: "gpt-image-2.5-sunburst",
  protocol: "images",
  quality: "low",
};

const silentLoader: UpstreamImagesSdkLoader = async () => ({
  client: { images: { edit: async () => ({ data: [{ b64_json: "IMG" }] }) } },
  toFile: async (data, name, options) => ({ data, name, options }),
});

function telemetryContext(): AiTelemetryContext {
  return {
    operationRunId: "00000000-0000-4000-8000-000000000001",
    operationRunType: "campaign_delivery",
    traceId: "00000000-0000-4000-8000-000000000002",
    storeId: "00000000-0000-4000-8000-000000000003",
    sink: new NoopAiTelemetrySink(),
  };
}

const VALID_REQUEST: AiInvocationRequest = {
  prompt: "expanda o quadro",
  productImagesDataUrls: ["data:image/jpeg;base64,AAAA"],
  size: "1152x2048",
  quality: "low",
};

async function preparedInvocation(): Promise<PreparedInvocation> {
  const transport = createExpansionTransport(TARGET, { loadSdk: silentLoader });
  return transport.prepare();
}

describe("createExpansionTransport — alvo resolvido e sem retry oculto", () => {
  it("sem loadSdk usa createOpenAiImagesSdkLoader({ maxRetries: 0 }) e configura o adapter", () => {
    spy.create.mockClear();
    spy.adapterArgs.length = 0;

    createExpansionTransport(TARGET);

    expect(spy.create).toHaveBeenCalledWith({ maxRetries: 0 });
    expect(spy.adapterArgs).toHaveLength(1);
    expect(spy.adapterArgs[0]).toMatchObject({
      options: { maxRetries: 0, preserveUsageWithoutImage: true },
    });
  });

  it("prepare() devolve exatamente o alvo resolvido e nunca chama o invoker", async () => {
    const invoker = { invokePrepared: vi.fn() };
    const transport = createExpansionTransport(TARGET, { invoker, loadSdk: silentLoader });

    const prepared = await transport.prepare();

    expect(prepared.capability).toBe("campaign_product_image");
    expect(prepared.target).toBe("primary");
    expect(prepared.provider).toBe(TARGET.provider);
    expect(prepared.model).toBe(TARGET.model);
    expect(prepared.protocol).toBe(TARGET.protocol);
    expect(invoker.invokePrepared).not.toHaveBeenCalled();
  });

  it("aceita a costura explícita de fábrica de loader (deps.loadSdkFactory)", () => {
    const factory = vi.fn(() => silentLoader);
    spy.create.mockClear();

    createExpansionTransport(TARGET, { loadSdkFactory: factory });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(spy.create).not.toHaveBeenCalled();
  });

  it("o adapter do transporte resolve apenas o protocolo images", () => {
    const transport = createExpansionTransport(TARGET, { loadSdk: silentLoader });
    expect(transport.adapter.protocol).toBe("images");
  });
});

describe("invokeExpansionOnce — no máximo uma invocação", () => {
  it("request inválido devolve not_sent e zero invocações do SDK", async () => {
    const prepared = await preparedInvocation();
    const invoker = { invokePrepared: vi.fn() };

    const invalidRequests: AiInvocationRequest[] = [
      { ...VALID_REQUEST, quality: "medium" },
      { ...VALID_REQUEST, quality: undefined },
      { ...VALID_REQUEST, productImagesDataUrls: [] },
      { ...VALID_REQUEST, productImagesDataUrls: ["a", "b"] },
      { ...VALID_REQUEST, size: "1024x1024" },
      { ...VALID_REQUEST, prompt: "   " },
      { ...VALID_REQUEST, identityImageUrl: "data:image/png;base64,AAAA" },
    ];

    for (const request of invalidRequests) {
      const outcome = await invokeExpansionOnce({
        invoker,
        prepared,
        request,
        telemetry: telemetryContext(),
      });
      expect(outcome.sendEvidence).toBe("not_sent");
    }

    expect(invoker.invokePrepared).not.toHaveBeenCalled();
  });

  it("request válido invoca uma única vez: sucesso confirmed_sent, erro possibly_sent", async () => {
    const prepared = await preparedInvocation();

    const okInvoker = {
      invokePrepared: vi.fn(async () => ({ imageBase64: "IMG", model: TARGET.model })),
    };
    const ok = await invokeExpansionOnce({
      invoker: okInvoker,
      prepared,
      request: VALID_REQUEST,
      telemetry: telemetryContext(),
    });
    expect(ok.sendEvidence).toBe("confirmed_sent");
    expect(okInvoker.invokePrepared).toHaveBeenCalledTimes(1);

    const failingInvoker = {
      invokePrepared: vi.fn(async () => {
        throw new AiInvocationError({
          kind: "rate_limit",
          retryable: true,
          message: "rate limited",
        });
      }),
    };
    const failed = await invokeExpansionOnce({
      invoker: failingInvoker,
      prepared,
      request: VALID_REQUEST,
      telemetry: telemetryContext(),
    });
    expect(failed.sendEvidence).toBe("possibly_sent");
    expect(failingInvoker.invokePrepared).toHaveBeenCalledTimes(1);
  });
});

describe("createExpansionAbortSignal — teto de 180 s e descarte do timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem prazo usa 180 000 ms", () => {
    const handle = createExpansionAbortSignal(undefined, undefined);

    vi.advanceTimersByTime(179_999);
    expect(handle.signal.aborted).toBe(false);

    vi.advanceTimersByTime(1);
    expect(handle.signal.aborted).toBe(true);
    expect(handle.timedOut()).toBe(true);

    handle.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("prazo menor do chamador prevalece", () => {
    const handle = createExpansionAbortSignal(5_000, undefined);

    vi.advanceTimersByTime(4_999);
    expect(handle.signal.aborted).toBe(false);

    vi.advanceTimersByTime(1);
    expect(handle.signal.aborted).toBe(true);

    handle.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("prazo maior que 180 000 não alonga o teto", () => {
    const handle = createExpansionAbortSignal(600_000, undefined);

    vi.advanceTimersByTime(180_000);
    expect(handle.signal.aborted).toBe(true);
    expect(handle.timedOut()).toBe(true);

    handle.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("signal do chamador já abortado aborta imediatamente e timedOut fica false", () => {
    const caller = new AbortController();
    caller.abort();

    const handle = createExpansionAbortSignal(undefined, caller.signal);

    expect(handle.signal.aborted).toBe(true);
    expect(handle.timedOut()).toBe(false);

    handle.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("abort do chamador vence o timer; dispose em sucesso zera timers", () => {
    const caller = new AbortController();
    const handle = createExpansionAbortSignal(undefined, caller.signal);

    expect(vi.getTimerCount()).toBe(1);

    caller.abort();
    expect(handle.signal.aborted).toBe(true);
    expect(handle.timedOut()).toBe(false);

    handle.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
