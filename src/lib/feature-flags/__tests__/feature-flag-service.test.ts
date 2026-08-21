import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FeatureFlagService } from "../feature-flag-service";

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
});

afterEach(() => {
  delete process.env.VENDEO_FORCE_BRIEF_VISION_CHECK;
  delete process.env.VENDEO_CAPTCHA_ENABLED;
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