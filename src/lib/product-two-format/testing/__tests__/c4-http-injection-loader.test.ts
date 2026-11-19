// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../c4-http-injection", () => ({
  createC4HttpInjection: vi.fn(() => ({ marker: "c4-injection" })),
}));

import { loadC4HttpInjection } from "../c4-http-injection-loader";

const client = { from: vi.fn() } as never;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("F60.7 C4-I — loader test-only", () => {
  it("só carrega com flag explícita e fora de produção/Vercel", async () => {
    vi.stubEnv("F60_7_C4_TEST_INJECTION", "");
    await expect(loadC4HttpInjection(client)).resolves.toBeUndefined();

    vi.stubEnv("F60_7_C4_TEST_INJECTION", "1");
    vi.stubEnv("NODE_ENV", "production");
    await expect(loadC4HttpInjection(client)).resolves.toBeUndefined();

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "1");
    await expect(loadC4HttpInjection(client)).resolves.toBeUndefined();

    vi.stubEnv("VERCEL", "");
    await expect(loadC4HttpInjection(client)).resolves.toEqual({
      marker: "c4-injection",
    });
  });
});
