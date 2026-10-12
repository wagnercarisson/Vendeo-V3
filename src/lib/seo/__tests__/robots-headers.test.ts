// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildRobotsHeaders } from "@/lib/seo/robots-headers";
import { NOINDEX_TAG, NOINDEX_TAG_GLOBAL } from "@/lib/seo/indexation-policy";

describe("buildRobotsHeaders — produção confirmada", () => {
  const rules = buildRobotsHeaders({ productionConfirmed: true });

  it("retorna exatamente 3 regras (sem regra global)", () => {
    expect(rules).toHaveLength(3);
  });

  it("inclui /auth, /api e /docs com X-Robots-Tag: noindex, nesta ordem", () => {
    expect(rules.map((rule) => rule.source)).toEqual([
      "/auth/:path*",
      "/api/:path*",
      "/docs/:path*",
    ]);
    for (const rule of rules) {
      expect(rule.headers).toEqual([{ key: "X-Robots-Tag", value: NOINDEX_TAG }]);
    }
  });

  it("não inclui a regra global /(.*)", () => {
    expect(rules.some((rule) => rule.source === "/(.*)")).toBe(false);
  });
});

describe("buildRobotsHeaders — fora de produção confirmada", () => {
  const rules = buildRobotsHeaders({ productionConfirmed: false });

  it("retorna 4 regras (inclui a regra global)", () => {
    expect(rules).toHaveLength(4);
  });

  it("a regra global é /(.*) com X-Robots-Tag: noindex, nofollow", () => {
    const global = rules.find((rule) => rule.source === "/(.*)");
    expect(global).toBeDefined();
    expect(global?.headers).toEqual([{ key: "X-Robots-Tag", value: NOINDEX_TAG_GLOBAL }]);
  });

  it("ainda contém /auth, /api e /docs com noindex", () => {
    for (const source of ["/auth/:path*", "/api/:path*", "/docs/:path*"]) {
      const rule = rules.find((entry) => entry.source === source);
      expect(rule?.headers).toEqual([{ key: "X-Robots-Tag", value: NOINDEX_TAG }]);
    }
  });
});

describe("buildRobotsHeaders — nunca emite Disallow", () => {
  it("produção confirmada: JSON sem Disallow", () => {
    expect(JSON.stringify(buildRobotsHeaders({ productionConfirmed: true }))).not.toMatch(/Disallow/i);
  });

  it("fora de produção: JSON sem Disallow", () => {
    expect(JSON.stringify(buildRobotsHeaders({ productionConfirmed: false }))).not.toMatch(/Disallow/i);
  });

  it("nenhuma chave é Disallow em nenhum modo", () => {
    for (const productionConfirmed of [true, false]) {
      for (const rule of buildRobotsHeaders({ productionConfirmed })) {
        for (const header of rule.headers) {
          expect(header.key).toBe("X-Robots-Tag");
          expect(header.value).not.toMatch(/Disallow/i);
        }
      }
    }
  });
});
