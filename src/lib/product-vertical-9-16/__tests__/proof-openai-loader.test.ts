// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createProofSdkLoader } from "../cost/proof-openai-loader";
import type { UpstreamImagesSdk } from "@/lib/ai/adapters/upstream-images";

interface CapturedOptions {
  apiKey: string;
  maxRetries: number;
}

function fakeModule() {
  let captured: CapturedOptions | null = null;
  const edit = vi.fn();
  class FakeOpenAI {
    readonly images = { edit };
    constructor(options: CapturedOptions) {
      captured = options;
    }
  }
  const toFile = vi.fn(async () => ({}));
  return {
    module: {
      default: FakeOpenAI as unknown as new (options: CapturedOptions) => unknown,
      toFile: toFile as unknown as UpstreamImagesSdk["toFile"],
    },
    edit,
    toFile,
    captured: () => captured,
  };
}

describe("F59 — loader da prova: retries e credencial", () => {
  it("configura maxRetries: 0 no cliente OpenAI", async () => {
    const fake = fakeModule();
    const loader = createProofSdkLoader("validated-key", async () => fake.module);

    await loader("adapter-key");

    expect(fake.captured()).toEqual({
      apiKey: "validated-key",
      maxRetries: 0,
    });
  });

  it("usa a credencial validada, ignorando a chave repassada pelo adapter", async () => {
    const fake = fakeModule();
    const loader = createProofSdkLoader("validated-key", async () => fake.module);

    await loader("different-key-from-env");
    await loader("another-key");

    expect(fake.captured()?.apiKey).toBe("validated-key");
    expect(fake.captured()?.maxRetries).toBe(0);
  });

  it("recusa chave vazia sem construir cliente", () => {
    const fake = fakeModule();
    expect(() =>
      createProofSdkLoader("   ", async () => fake.module),
    ).toThrow("proof_api_key_missing");
    expect(fake.captured()).toBeNull();
  });
});
