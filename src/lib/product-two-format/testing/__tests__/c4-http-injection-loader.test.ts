// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../c4-http-injection", () => ({
  createC4HttpInjection: vi.fn(() => ({ marker: "c4-injection" })),
  emitC4Activation: vi.fn(),
}));

import { loadC4HttpInjection } from "../c4-http-injection-loader";

const client = { from: vi.fn() } as never;
const context = {
  campaignId: "22222222-2222-4222-8222-222222222222",
  operationId: "33333333-3333-4333-8333-333333333333",
  route: "continue" as const,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("F60.7 C4-I — loader test-only", () => {
  it("só carrega com flag explícita e fora de produção/Vercel", async () => {
    vi.stubEnv("F60_7_C4_TEST_INJECTION", "");
    await expect(loadC4HttpInjection(client, context)).resolves.toBeUndefined();

    vi.stubEnv("F60_7_C4_TEST_INJECTION", "1");
    vi.stubEnv("NODE_ENV", "production");
    await expect(loadC4HttpInjection(client, context)).resolves.toBeUndefined();

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "1");
    await expect(loadC4HttpInjection(client, context)).resolves.toBeUndefined();

    vi.stubEnv("VERCEL", "");
    await expect(loadC4HttpInjection(client, context)).resolves.toEqual({
      marker: "c4-injection",
    });
  });
});
