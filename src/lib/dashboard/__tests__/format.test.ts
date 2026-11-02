// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatDashboardDate } from "@/lib/dashboard/format";

/**
 * O mesmo instante muda de dia civil entre o fuso da loja (UTC-3) e UTC:
 * `2026-07-14T01:30:00Z` é 13/jul 22:30 em São Paulo e 14/jul 01:30 em UTC.
 */
const INSTANT = "2026-07-14T01:30:00Z";

describe("formatDashboardDate", () => {
  it("usa o fuso da loja quando disponível (13 de jul em pt-BR)", () => {
    const result = formatDashboardDate(INSTANT, "pt-BR", "America/Sao_Paulo");

    expect(result).toContain("13 de jul.");
  });

  it("cai no dia civil de UTC quando o fuso não está disponível", () => {
    const result = formatDashboardDate(INSTANT, "pt-BR", null);

    expect(result).toContain("14 de jul.");
  });

  it("formata o mês no idioma es-419 com e sem fuso da loja", () => {
    const local = formatDashboardDate(INSTANT, "es-419", "America/Sao_Paulo");
    const utc = formatDashboardDate(INSTANT, "es-419", null);

    expect(local).toContain("13 jul");
    expect(utc).toContain("14 jul");
  });

  it("mantém os meses no idioma do locale", () => {
    const pt = formatDashboardDate("2026-07-14T12:00:00Z", "pt-BR", "UTC");
    const es = formatDashboardDate("2026-07-14T12:00:00Z", "es-419", "UTC");

    expect(pt).toContain("jul.");
    expect(es).toContain("jul");
  });
});
