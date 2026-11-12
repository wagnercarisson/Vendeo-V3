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
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import { NoopAiTelemetrySink } from "@/lib/ai/telemetry-sink";
import {
  AiInvocationError,
  type AiInvocationRequest,
  type AiInvocationResult,
  type AiTelemetryContext,
} from "@/lib/ai/types";

import {
  createSquareBaseAbortHandle,
  createSquareBaseImageGateway,
  invokeSquareBaseOnce,
  type SquareBaseImageGateway,
} from "../transport";

const PAIR: ImageModelPairConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
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
    attemptNumber: 1,
  };
}

const VALID_REQUEST: AiInvocationRequest = {
  prompt: "componha a base quadrada",
  productImagesDataUrls: ["data:image/jpeg;base64,AAAA"],
  identityImageUrl: "data:image/png;base64,BBBB",
  size: "1024x1024",
  quality: "medium",
};

function preparedInvocation(
  target: "primary" | "fallback" = "primary",
): PreparedInvocation {
  return {
    capability: "campaign_product_image",
    target,
    provider: "openai",
    model: PAIR[target].model,
    protocol: "images",
    resolved: {
      provider: "openai",
      model: PAIR[target].model,
      protocol: "images",
    },
  };
}

interface FakeGateway {
  readonly gateway: SquareBaseImageGateway;
  readonly prepare: ReturnType<typeof vi.fn>;
  readonly invokePrepared: ReturnType<typeof vi.fn>;
}

function fakeGateway(
  implementation: () => Promise<AiInvocationResult>,
  target: "primary" | "fallback" = "primary",
): FakeGateway {
  const prepare = vi.fn(async (_capability: string, chosen: "primary" | "fallback") =>
    preparedInvocation(chosen ?? target),
  );
  const invokePrepared = vi.fn(async () => implementation());
  return {
    gateway: {
      prepare: prepare as unknown as SquareBaseImageGateway["prepare"],
      invokePrepared:
        invokePrepared as unknown as SquareBaseImageGateway["invokePrepared"],
    },
    prepare,
    invokePrepared,
  };
}

function invokeInput(
  gateway: SquareBaseImageGateway,
  overrides: Partial<Parameters<typeof invokeSquareBaseOnce>[0]> = {},
): Parameters<typeof invokeSquareBaseOnce>[0] {
  return {
    gateway,
    capability: "campaign_product_image",
    target: "primary",
    request: VALID_REQUEST,
    telemetry: telemetryContext(),
    quality: "medium",
    expectedIdentity: true,
    timeoutMs: 60_000,
    ...overrides,
  };
}

describe("createSquareBaseImageGateway — sem retry oculto", () => {
  it("usa createOpenAiImagesSdkLoader({ maxRetries: 0 }) e o adapter com as opções seguras", () => {
    spy.create.mockClear();
    spy.adapterArgs.length = 0;

    createSquareBaseImageGateway(PAIR);

    expect(spy.create).toHaveBeenCalledWith({ maxRetries: 0 });
    expect(spy.adapterArgs).toHaveLength(1);
    expect(spy.adapterArgs[0]).toMatchObject({
      options: { maxRetries: 0, preserveUsageWithoutImage: true },
    });
  });

  it("prepare() fixa o alvo primary/fallback do par congelado", async () => {
    const gateway = createSquareBaseImageGateway(PAIR, { loadSdk: silentLoader });

    const primary = await gateway.prepare("campaign_product_image", "primary");
    const fallback = await gateway.prepare("campaign_product_image", "fallback");

    expect(primary.target).toBe("primary");
    expect(primary.model).toBe(PAIR.primary.model);
    expect(fallback.target).toBe("fallback");
    expect(fallback.model).toBe(PAIR.fallback.model);
  });

  it("não usa o gateway 1:1 nem registry paralelo", () => {
    const source = createSquareBaseImageGateway.toString();
    const forbiddenGateway = ["createNewFlow", "ImageGateway"].join("");
    const forbiddenRegistry = ["createNewFlow", "AdapterRegistry"].join("");
    expect(source).not.toContain(forbiddenGateway);
    expect(source).not.toContain(forbiddenRegistry);
  });
});

describe("invokeSquareBaseOnce — exatamente uma invocação", () => {
  it("prepara e invoca uma única vez no sucesso", async () => {
    const fake = fakeGateway(async () => ({
      imageBase64: "IMG",
      model: PAIR.primary.model,
    }));

    const outcome = await invokeSquareBaseOnce(invokeInput(fake.gateway));

    expect(outcome.sendEvidence).toBe("confirmed_sent");
    if (outcome.sendEvidence !== "confirmed_sent") return;
    expect(outcome.prepared.target).toBe("primary");
    expect(fake.prepare).toHaveBeenCalledTimes(1);
    expect(fake.prepare).toHaveBeenCalledWith("campaign_product_image", "primary");
    expect(fake.invokePrepared).toHaveBeenCalledTimes(1);
  });

  it("alvo fallback chega explícito ao prepare e nenhuma segunda invocação ocorre", async () => {
    const fake = fakeGateway(async () => ({
      imageBase64: "IMG",
      model: PAIR.fallback.model,
    }));

    const outcome = await invokeSquareBaseOnce(
      invokeInput(fake.gateway, { target: "fallback" }),
    );

    expect(outcome.sendEvidence).toBe("confirmed_sent");
    expect(fake.prepare).toHaveBeenCalledWith(
      "campaign_product_image",
      "fallback",
    );
    expect(fake.invokePrepared).toHaveBeenCalledTimes(1);
  });

  it("falha transitória não repete: uma única invocação e possibly_sent", async () => {
    const fake = fakeGateway(async () => {
      throw new AiInvocationError({
        kind: "rate_limit",
        retryable: true,
        message: "rate limited",
      });
    });

    const outcome = await invokeSquareBaseOnce(invokeInput(fake.gateway));

    expect(outcome.sendEvidence).toBe("possibly_sent");
    expect(fake.prepare).toHaveBeenCalledTimes(1);
    expect(fake.invokePrepared).toHaveBeenCalledTimes(1);
  });

  it("request inválido não chega ao gateway", async () => {
    const fake = fakeGateway(async () => ({
      imageBase64: "IMG",
      model: PAIR.primary.model,
    }));

    const outcome = await invokeSquareBaseOnce(
      invokeInput(fake.gateway, {
        request: { ...VALID_REQUEST, quality: "low" },
      }),
    );

    expect(outcome.sendEvidence).toBe("not_sent");
    expect(fake.prepare).not.toHaveBeenCalled();
    expect(fake.invokePrepared).not.toHaveBeenCalled();
  });

  it("falha de prepare é not_sent e não invoca", async () => {
    const prepare = vi.fn(async () => {
      throw new AiInvocationError({
        kind: "capability",
        retryable: false,
        message: "no fallback",
      });
    });
    const invokePrepared = vi.fn();
    const gateway = {
      prepare: prepare as unknown as SquareBaseImageGateway["prepare"],
      invokePrepared:
        invokePrepared as unknown as SquareBaseImageGateway["invokePrepared"],
    };

    const outcome = await invokeSquareBaseOnce(invokeInput(gateway));

    expect(outcome.sendEvidence).toBe("not_sent");
    expect(invokePrepared).not.toHaveBeenCalled();
  });
});

describe("invokeSquareBaseOnce — deadline e dispose", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deadline dispara, aborta o sinal e devolve possibly_sent sem segundo terminal", async () => {
    const deferred: {
      release: ((value: AiInvocationResult) => void) | null;
    } = { release: null };
    const pending = new Promise<AiInvocationResult>((resolve) => {
      deferred.release = resolve;
    });
    const fake = fakeGateway(() => pending);
    let observedSignal: AbortSignal | undefined;
    const originalInvoke = fake.gateway.invokePrepared;
    fake.gateway.invokePrepared = (async (prepared, request, telemetry) => {
      observedSignal = request.signal;
      return originalInvoke(prepared, request, telemetry);
    }) as SquareBaseImageGateway["invokePrepared"];

    const outcomePromise = invokeSquareBaseOnce(
      invokeInput(fake.gateway, { timeoutMs: 1_000 }),
      { clock: () => 1_000 },
    );

    await vi.advanceTimersByTimeAsync(1_000);
    const outcome = await outcomePromise;

    expect(outcome.sendEvidence).toBe("possibly_sent");
    expect(fake.invokePrepared).toHaveBeenCalledTimes(1);
    expect(observedSignal?.aborted).toBe(true);

    // Resultado tardio é descartado: não há segundo terminal nem replay.
    deferred.release?.({ imageBase64: "LATE", model: PAIR.primary.model });
    await Promise.resolve();
    expect(fake.invokePrepared).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("abort do chamador durante prepare nao invoca (not_sent)", async () => {
    let releasePrepare!: (value: PreparedInvocation) => void;
    const preparePromise = new Promise<PreparedInvocation>((resolve) => {
      releasePrepare = resolve;
    });
    const invokePrepared = vi.fn();
    const gateway: SquareBaseImageGateway = {
      prepare: vi.fn(() => preparePromise),
      invokePrepared: invokePrepared as unknown as SquareBaseImageGateway["invokePrepared"],
    };
    const caller = new AbortController();

    const outcomePromise = invokeSquareBaseOnce(
      invokeInput(gateway, { timeoutMs: 60_000, signal: caller.signal }),
      { clock: () => 0 },
    );

    caller.abort();
    releasePrepare(preparedInvocation("primary"));
    const outcome = await outcomePromise;

    expect(outcome.sendEvidence).toBe("not_sent");
    expect(invokePrepared).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("deadline expirado durante prepare nao invoca (not_sent)", async () => {
    let releasePrepare!: (value: PreparedInvocation) => void;
    const preparePromise = new Promise<PreparedInvocation>((resolve) => {
      releasePrepare = resolve;
    });
    const invokePrepared = vi.fn();
    const gateway: SquareBaseImageGateway = {
      prepare: vi.fn(() => preparePromise),
      invokePrepared: invokePrepared as unknown as SquareBaseImageGateway["invokePrepared"],
    };

    const outcomePromise = invokeSquareBaseOnce(
      invokeInput(gateway, { timeoutMs: 1_000 }),
      { clock: () => 0 },
    );

    await vi.advanceTimersByTimeAsync(1_000);
    const outcome = await outcomePromise;

    expect(outcome.sendEvidence).toBe("not_sent");
    expect(invokePrepared).not.toHaveBeenCalled();

    releasePrepare(preparedInvocation("primary"));
    await Promise.resolve();
    expect(invokePrepared).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("dispose() sempre limpa o timer, inclusive no sucesso", async () => {
    const fake = fakeGateway(async () => ({
      imageBase64: "IMG",
      model: PAIR.primary.model,
    }));

    const outcome = await invokeSquareBaseOnce(invokeInput(fake.gateway));

    expect(outcome.sendEvidence).toBe("confirmed_sent");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("createSquareBaseAbortHandle — teto e descarte", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem prazo usa 180 s; prazo menor prevalece; maior não alonga", () => {
    const defaultHandle = createSquareBaseAbortHandle(undefined, undefined);
    expect(defaultHandle.limitMs).toBe(180_000);
    defaultHandle.dispose();

    const shortHandle = createSquareBaseAbortHandle(5_000, undefined);
    expect(shortHandle.limitMs).toBe(5_000);
    vi.advanceTimersByTime(4_999);
    expect(shortHandle.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(shortHandle.signal.aborted).toBe(true);
    expect(shortHandle.timedOut()).toBe(true);
    shortHandle.dispose();

    const longHandle = createSquareBaseAbortHandle(600_000, undefined);
    expect(longHandle.limitMs).toBe(180_000);
    longHandle.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propaga abort do chamador e limpa listeners no dispose", () => {
    const caller = new AbortController();
    const handle = createSquareBaseAbortHandle(undefined, caller.signal);

    caller.abort();
    expect(handle.signal.aborted).toBe(true);
    expect(handle.timedOut()).toBe(false);

    handle.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
