// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GreetingMessages } from "@/lib/dashboard/greeting";

const messages: GreetingMessages = {
  morning: "Bom dia",
  afternoon: "Boa tarde",
  evening: "Boa noite",
  neutral: "Olá",
  welcome: "Boas-vindas",
  nameSeparator: ", ",
};

function input(
  overrides: Partial<{
    storeName: string | null;
    timeZone: string | null;
    locale: "pt-BR" | "es-419";
    now: Date;
  }> = {},
) {
  return {
    storeName: "Loja Teste",
    timeZone: "America/Sao_Paulo",
    locale: "pt-BR" as const,
    now: new Date("2026-07-13T15:00:00Z"),
    messages,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveDashboardGreeting", () => {
  it("15:00Z em America/Asuncion (hora 12) → afternoon", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(
      input({ timeZone: "America/Asuncion" }),
    );
    expect(result).toEqual({ period: "afternoon", storeName: "Loja Teste" });
  });

  it("14:00Z em America/Sao_Paulo (hora 11) → morning; mesmo instante em UTC (hora 14) → afternoon", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const now = new Date("2026-07-13T14:00:00Z");

    expect(
      resolveDashboardGreeting(input({ now, timeZone: "America/Sao_Paulo" })),
    ).toEqual({ period: "morning", storeName: "Loja Teste" });

    expect(resolveDashboardGreeting(input({ now, timeZone: "UTC" }))).toEqual({
      period: "afternoon",
      storeName: "Loja Teste",
    });
  });

  it("02:00Z em America/Sao_Paulo (hora 23 do dia anterior) → evening", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(
      input({ now: new Date("2026-07-13T02:00:00Z") }),
    );
    expect(result).toEqual({ period: "evening", storeName: "Loja Teste" });
  });

  it("15:00Z em America/Sao_Paulo (hora 12) → afternoon", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(input());
    expect(result).toEqual({ period: "afternoon", storeName: "Loja Teste" });
  });

  it("locale só afeta o formatador, não o período", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const pt = resolveDashboardGreeting(input({ locale: "pt-BR" }));
    const es = resolveDashboardGreeting(input({ locale: "es-419" }));
    expect(pt.period).toBe(es.period);
    expect(pt.period).toBe("afternoon");
  });

  it("timeZone inválido → neutral", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(input({ timeZone: "Not/AZone" }));
    expect(result).toEqual({ period: "neutral", storeName: "Loja Teste" });
  });

  it("timeZone nulo → neutral", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(input({ timeZone: null }));
    expect(result).toEqual({ period: "neutral", storeName: "Loja Teste" });
  });

  it("storeName nulo → welcome sem nome inventado", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(input({ storeName: null }));
    expect(result).toEqual({ period: "welcome", storeName: null });
  });

  it("storeName vazio após trim → welcome", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(input({ storeName: "   " }));
    expect(result).toEqual({ period: "welcome", storeName: null });
  });

  it("hora \"24\" normalizada para 0 (meia-noite) → evening", async () => {
    class FakeDateTimeFormat {
      constructor() {}
      formatToParts() {
        return [{ type: "hour", value: "24" }];
      }
    }
    vi.stubGlobal("Intl", { DateTimeFormat: FakeDateTimeFormat });

    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(input());
    expect(result.period).toBe("evening");
  });

  it("nunca usa fallback America/Sao_Paulo: fuso inválido não vira morning", async () => {
    const { resolveDashboardGreeting } = await import("@/lib/dashboard/greeting");
    const result = resolveDashboardGreeting(
      input({ timeZone: "Not/AZone", now: new Date("2026-07-13T14:00:00Z") }),
    );
    expect(result.period).toBe("neutral");
  });
});
