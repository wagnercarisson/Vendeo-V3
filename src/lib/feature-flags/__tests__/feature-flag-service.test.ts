import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ALL_FEATURE_FLAG_KEYS,
  FeatureFlagService,
  PRODUCT_1_1_ALL_STORES_ENABLED_KEY,
  PRODUCT_1_1_TEST_STORES_ENABLED_KEY,
} from "../feature-flag-service";

vi.mock("server-only", () => ({}));

// Mock do cliente supabaseAdmin — controla a leitura da feature_flags.
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.VENDEO_FORCE_BRIEF_VISION_CHECK;
  delete process.env.VENDEO_CAPTCHA_ENABLED;
  delete process.env.VENDEO_PRODUCT_1_1_TEST_STORES_ENABLED;
  delete process.env.VENDEO_PRODUCT_1_1_ALL_STORES_ENABLED;
});

afterEach(() => {
  delete process.env.VENDEO_FORCE_BRIEF_VISION_CHECK;
  delete process.env.VENDEO_CAPTCHA_ENABLED;
  delete process.env.VENDEO_PRODUCT_1_1_TEST_STORES_ENABLED;
  delete process.env.VENDEO_PRODUCT_1_1_ALL_STORES_ENABLED;
});

describe("FeatureFlagService — leitura da flag (F43 D5)", () => {
  it("Teste 26a (D5): leitura normal retorna enabled da tabela", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { enabled: true },
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      return {};
    });

    const service = new FeatureFlagService();
    expect(await service.isForceBriefVisionCheckEnabled()).toBe(true);
  });

  it("Teste 26b (D5): falha de leitura → enabled=false (não bloqueia geração), log warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: "db unavailable" } })),
            })),
          })),
        };
      }
      return {};
    });

    const service = new FeatureFlagService();
    expect(await service.isForceBriefVisionCheckEnabled()).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("Teste 26c (D5): env var VENDEO_FORCE_BRIEF_VISION_CHECK=true pode forçar true (fail-safe emergencial)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: "db unavailable" } })),
            })),
          })),
        };
      }
      return {};
    });

    process.env.VENDEO_FORCE_BRIEF_VISION_CHECK = "true";
    const service = new FeatureFlagService();
    expect(await service.isForceBriefVisionCheckEnabled()).toBe(true);
  });
});

describe("FeatureFlagService — isCaptchaEnabled (QCW)", () => {
  it("flag true → true", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({ data: { enabled: true }, error: null })
              ),
            })),
          })),
        };
      }
      return {};
    });

    const service = new FeatureFlagService();
    expect(await service.isCaptchaEnabled()).toBe(true);
  });

  it("flag false → false", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({ data: { enabled: false }, error: null })
              ),
            })),
          })),
        };
      }
      return {};
    });

    const service = new FeatureFlagService();
    expect(await service.isCaptchaEnabled()).toBe(false);
  });

  it("erro de leitura sem env → true (fail-safe — nunca desliga captcha por acidente)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: "db unavailable" } })),
            })),
          })),
        };
      }
      return {};
    });

    const service = new FeatureFlagService();
    expect(await service.isCaptchaEnabled()).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("erro + VENDEO_CAPTCHA_ENABLED=true → true (override emergencial)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: "db unavailable" } })),
            })),
          })),
        };
      }
      return {};
    });

    process.env.VENDEO_CAPTCHA_ENABLED = "true";
    const service = new FeatureFlagService();
    expect(await service.isCaptchaEnabled()).toBe(true);
  });

  it("erro + VENDEO_CAPTCHA_ENABLED=false → false (env respeita false)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: "db unavailable" } })),
            })),
          })),
        };
      }
      return {};
    });

    process.env.VENDEO_CAPTCHA_ENABLED = "false";
    const service = new FeatureFlagService();
    expect(await service.isCaptchaEnabled()).toBe(false);
  });
});

describe("FeatureFlagService — flags de geração (QCW, F38 D5 fail-open)", () => {
  function mockFlag(enabled: boolean | null, error: { message: string } | null = null) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve(error ? { data: null, error } : { data: { enabled }, error: null })
              ),
            })),
          })),
        };
      }
      return {};
    });
  }

  it("isCampaignGenerationEnabled: flag true → true", async () => {
    mockFlag(true);
    const service = new FeatureFlagService();
    expect(await service.isCampaignGenerationEnabled()).toBe(true);
  });

  it("isCampaignGenerationEnabled: flag false → false", async () => {
    mockFlag(false);
    const service = new FeatureFlagService();
    expect(await service.isCampaignGenerationEnabled()).toBe(false);
  });

  it("isCampaignGenerationEnabled: erro de leitura → true (fail-open — nunca desliga geração)", async () => {
    mockFlag(null, { message: "db unavailable" });
    const service = new FeatureFlagService();
    expect(await service.isCampaignGenerationEnabled()).toBe(true);
  });

  it("isVisualSignatureGenerationEnabled: flag true → true", async () => {
    mockFlag(true);
    const service = new FeatureFlagService();
    expect(await service.isVisualSignatureGenerationEnabled()).toBe(true);
  });

  it("isVisualSignatureGenerationEnabled: flag false → false", async () => {
    mockFlag(false);
    const service = new FeatureFlagService();
    expect(await service.isVisualSignatureGenerationEnabled()).toBe(false);
  });

  it("isVisualSignatureGenerationEnabled: erro de leitura → true (fail-open)", async () => {
    mockFlag(null, { message: "db unavailable" });
    const service = new FeatureFlagService();
    expect(await service.isVisualSignatureGenerationEnabled()).toBe(true);
  });
});

describe("FeatureFlagService — isCampaignApprovalEnabled (F37.1 D1, fail-closed)", () => {
  function mockFlag(enabled: boolean | null, error: { message: string } | null = null) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "feature_flags") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve(error ? { data: null, error } : { data: { enabled }, error: null })
              ),
            })),
          })),
        };
      }
      return {};
    });
  }

  it("18.3 — leitura ok com enabled: true → true", async () => {
    mockFlag(true);
    const service = new FeatureFlagService();
    expect(await service.isCampaignApprovalEnabled()).toBe(true);
  });

  it("18.3 — leitura ok com enabled: false → false", async () => {
    mockFlag(false);
    const service = new FeatureFlagService();
    expect(await service.isCampaignApprovalEnabled()).toBe(false);
  });

  it("18.3 — not-found (data null) → false (fallback fail-closed)", async () => {
    mockFlag(null);
    const service = new FeatureFlagService();
    expect(await service.isCampaignApprovalEnabled()).toBe(false);
  });

  it("18.3 — erro de leitura → false (fail-closed)", async () => {
    mockFlag(null, { message: "db unavailable" });
    const service = new FeatureFlagService();
    expect(await service.isCampaignApprovalEnabled()).toBe(false);
  });

  it("18.3 — NENHUMA env var consultada (sem envOverride — readFlag(key, false) com 2 args)", async () => {
    mockFlag(true);
    const service = new FeatureFlagService();
    await service.isCampaignApprovalEnabled();
    // sem VENDEO_CAPTCHA_ENABLED/VENDEO_FORCE_BRIEF_VISION_CHECK envolvidas
    expect(process.env.VENDEO_CAPTCHA_ENABLED).toBeUndefined();
    expect(process.env.VENDEO_FORCE_BRIEF_VISION_CHECK).toBeUndefined();
  });
});

describe("FeatureFlagService — chaves Produto 1:1 F56.2a (fail-closed)", () => {
  function mockFlag(enabled: boolean | null, shouldThrow = false) {
    mockFrom.mockImplementation((table: string) => {
      if (table !== "feature_flags") return {};
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => {
              if (shouldThrow) return Promise.reject(new Error("db unavailable"));
              return Promise.resolve({
                data: enabled === null ? null : { enabled },
                error: null,
              });
            }),
          })),
        })),
      };
    });
  }

  it("registra as duas chaves ao final da ordem canônica", () => {
    expect(ALL_FEATURE_FLAG_KEYS.slice(-2)).toEqual([
      PRODUCT_1_1_TEST_STORES_ENABLED_KEY,
      PRODUCT_1_1_ALL_STORES_ENABLED_KEY,
    ]);
  });

  it("retorna false quando as linhas das duas chaves não existem", async () => {
    mockFlag(null);
    const service = new FeatureFlagService();

    await expect(service.isProductOneToOneTestStoresEnabled()).resolves.toBe(false);
    await expect(service.isProductOneToOneAllStoresEnabled()).resolves.toBe(false);
  });

  it("retorna false quando a leitura das duas chaves lança exceção", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFlag(null, true);
    const service = new FeatureFlagService();

    await expect(service.isProductOneToOneTestStoresEnabled()).resolves.toBe(false);
    await expect(service.isProductOneToOneAllStoresEnabled()).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ignora env vars emergenciais: false na tabela permanece false", async () => {
    process.env.VENDEO_PRODUCT_1_1_TEST_STORES_ENABLED = "true";
    process.env.VENDEO_PRODUCT_1_1_ALL_STORES_ENABLED = "true";
    mockFlag(false);
    const service = new FeatureFlagService();

    await expect(service.isProductOneToOneTestStoresEnabled()).resolves.toBe(false);
    await expect(service.isProductOneToOneAllStoresEnabled()).resolves.toBe(false);
  });

  it("preserva os fallbacks das flags preexistentes", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFlag(null);
    const service = new FeatureFlagService();

    await expect(service.isCampaignApprovalEnabled()).resolves.toBe(false);
    await expect(service.isCampaignGenerationEnabled()).resolves.toBe(true);
    await expect(service.isVisualSignatureGenerationEnabled()).resolves.toBe(true);
    await expect(service.isForceBriefVisionCheckEnabled()).resolves.toBe(false);
    warnSpy.mockRestore();
  });
});
