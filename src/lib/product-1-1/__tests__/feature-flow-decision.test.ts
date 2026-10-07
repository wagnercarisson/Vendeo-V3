import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FeatureFlagService,
  PRODUCT_1_1_ALL_STORES_ENABLED_KEY,
  PRODUCT_1_1_TEST_STORES_ENABLED_KEY,
} from "@/lib/feature-flags/feature-flag-service";
import {
  decideProductFlow,
  PRODUCT_ONE_TO_ONE_FLOWS,
} from "../feature-flow-decision";
import { resolveProductOneToOneFlow } from "../feature-flow-decision-service";

vi.mock("server-only", () => ({}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

interface MockFlagResult {
  data: { enabled: unknown } | null;
  error: { message: string } | null;
}

type MockFlagResponse = MockFlagResult | Error;

function configureFlags(responses: Record<string, MockFlagResponse>): void {
  mockFrom.mockImplementation((table: string) => {
    if (table !== "feature_flags") return {};

    return {
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, key: string) => ({
          maybeSingle: vi.fn(() => {
            const response = responses[key] ?? { data: null, error: null };
            return response instanceof Error
              ? Promise.reject(response)
              : Promise.resolve(response);
          }),
        })),
      })),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("decideProductFlow — contrato puro F56.2a", () => {
  it("ambas desligadas mantêm o fluxo legado", () => {
    expect(
      decideProductFlow({
        testStoresEnabled: false,
        allStoresEnabled: false,
        isTestStore: true,
      }),
    ).toBe("legacy");
  });

  it("a chave de teste só escolhe new_flow para uma loja de teste", () => {
    expect(
      decideProductFlow({
        testStoresEnabled: true,
        allStoresEnabled: false,
        isTestStore: true,
      }),
    ).toBe("new_flow");
    expect(
      decideProductFlow({
        testStoresEnabled: true,
        allStoresEnabled: false,
        isTestStore: false,
      }),
    ).toBe("legacy");
  });

  it("a chave geral escolhe new_flow para qualquer tipo de loja", () => {
    expect(
      decideProductFlow({
        testStoresEnabled: false,
        allStoresEnabled: true,
        isTestStore: false,
      }),
    ).toBe("new_flow");
    expect(
      decideProductFlow({
        testStoresEnabled: false,
        allStoresEnabled: true,
        isTestStore: true,
      }),
    ).toBe("new_flow");
  });

  it("a precedência permanece determinística com ambas as chaves ligadas", () => {
    const input = {
      testStoresEnabled: true,
      allStoresEnabled: true,
      isTestStore: false,
    } as const;

    expect(PRODUCT_ONE_TO_ONE_FLOWS).toEqual(["legacy", "new_flow"]);
    expect(Array.from({ length: 3 }, () => decideProductFlow(input))).toEqual([
      "new_flow",
      "new_flow",
      "new_flow",
    ]);
  });

  it("nenhum parâmetro adicional do cliente força o novo fluxo", () => {
    const input = {
      testStoresEnabled: false,
      allStoresEnabled: false,
      isTestStore: false,
      clientRequestedFlow: "new_flow",
    } as Parameters<typeof decideProductFlow>[0];

    expect(decideProductFlow(input)).toBe("legacy");
  });
});

describe("readProductOneToOneFlags + resolver — fail-closed para o par", () => {
  it("distingue false válido de uma chave ausente", async () => {
    configureFlags({
      [PRODUCT_1_1_TEST_STORES_ENABLED_KEY]: {
        data: { enabled: false },
        error: null,
      },
      [PRODUCT_1_1_ALL_STORES_ENABLED_KEY]: { data: null, error: null },
    });

    const result = await new FeatureFlagService().readProductOneToOneFlags();

    expect(result).toEqual({
      testStoresEnabled: false,
      allStoresEnabled: false,
      testStoresStatus: "valid",
      allStoresStatus: "missing",
    });
  });

  it("chave geral true + erro na chave de teste resulta em legacy", async () => {
    configureFlags({
      [PRODUCT_1_1_TEST_STORES_ENABLED_KEY]: new Error("read failed"),
      [PRODUCT_1_1_ALL_STORES_ENABLED_KEY]: {
        data: { enabled: true },
        error: null,
      },
    });
    const service = new FeatureFlagService();

    await expect(
      resolveProductOneToOneFlow({ isTestStore: false }, service),
    ).resolves.toBe("legacy");
  });

  it("chave de teste true + chave geral ausente resulta em legacy", async () => {
    configureFlags({
      [PRODUCT_1_1_TEST_STORES_ENABLED_KEY]: {
        data: { enabled: true },
        error: null,
      },
      [PRODUCT_1_1_ALL_STORES_ENABLED_KEY]: { data: null, error: null },
    });
    const service = new FeatureFlagService();

    await expect(
      resolveProductOneToOneFlow({ isTestStore: true }, service),
    ).resolves.toBe("legacy");
  });

  it("um valor enabled não booleano invalida o par todo", async () => {
    configureFlags({
      [PRODUCT_1_1_TEST_STORES_ENABLED_KEY]: {
        data: { enabled: "true" },
        error: null,
      },
      [PRODUCT_1_1_ALL_STORES_ENABLED_KEY]: {
        data: { enabled: true },
        error: null,
      },
    });
    const service = new FeatureFlagService();

    const result = await service.readProductOneToOneFlags();
    expect(result.testStoresStatus).toBe("invalid");
    await expect(
      resolveProductOneToOneFlow({ isTestStore: true }, service),
    ).resolves.toBe("legacy");
  });

  it("uma exceção inesperada do leitor também mantém o legado", async () => {
    const throwingService = {
      readProductOneToOneFlags: () => Promise.reject(new Error("unexpected")),
    } as unknown as FeatureFlagService;

    await expect(
      resolveProductOneToOneFlow({ isTestStore: true }, throwingService),
    ).resolves.toBe("legacy");
  });

  it("os módulos de decisão não importam caminhos de execução ou provider", () => {
    const decisionSource = readFileSync(
      new URL("../feature-flow-decision.ts", import.meta.url),
      "utf8",
    );
    const serviceSource = readFileSync(
      new URL("../feature-flow-decision-service.ts", import.meta.url),
      "utf8",
    );
    const forbiddenImport =
      /(?:from\s*["'][^"']*(?:adapter|gateway|provider|credit|delivery|download)[^"']*["']|import\s*["'][^"']*(?:adapter|gateway|provider|credit|delivery|download)[^"']*["'])/i;

    expect(decisionSource).not.toMatch(forbiddenImport);
    expect(serviceSource).not.toMatch(forbiddenImport);
  });
});
