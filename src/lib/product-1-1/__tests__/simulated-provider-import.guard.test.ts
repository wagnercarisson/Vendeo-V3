// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  GenerateImageRequestSchema,
  NewFlowGenerateImageRequestSchema,
} from "@/lib/image-generation/schema";

/**
 * F56.2.6 — Plano 04 (Task 2) — GUARDA ESTÁTICA da fixture de provider simulado.
 *
 * Falha se:
 * - qualquer arquivo de ROTA em `src/app/api/**` importar a fixture
 *   `fixtures/simulated-provider` (vazamento test-only → bundle de rotas);
 * - existir uma rota pública de simulação (`src/app/api/**` com nome de
 *   simulação);
 * - o schema de entrada do fluxo Produto 1:1 aceitar `provider`, `simulated` ou
 *   `mockProvider` escolhidos pelo cliente.
 *
 * Rotas administrativas de pricing/filtro que LEGITIMAMENTE carregam o campo
 * `provider` não são tocadas: a varredura é por IMPORT da fixture, nunca pela
 * palavra `provider`.
 */

const API_ROOT = path.resolve(process.cwd(), "src/app/api");
const FIXTURE = path.resolve(
  process.cwd(),
  "src/lib/product-1-1/__tests__/fixtures/simulated-provider.ts",
);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

/** Arquivos de ROTA (fora de `__tests__` e fora de `*.test.*`). */
function routeFiles(): string[] {
  return walk(API_ROOT).filter((file) => {
    const normalized = file.replaceAll("\\", "/");
    return (
      /\.(ts|tsx|js|mjs|cjs)$/.test(normalized) &&
      !normalized.includes("/__tests__/") &&
      !/\.test\.[^.]+$/.test(normalized)
    );
  });
}

describe("F56.2.6 — guarda: provider simulado é TEST-ONLY", () => {
  it("nenhuma rota src/app/api/** importa a fixture de provider simulado", () => {
    const offenders = routeFiles().filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        source.includes("fixtures/simulated-provider") ||
        source.includes("simulated-provider")
      );
    });
    expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });

  it("não existe rota pública de simulação de provider", () => {
    const simulateRoutes = routeFiles().filter((file) =>
      /(^|\/)(simulate|simulation|simulated)(\/|\.|$)/i.test(
        file.replaceAll("\\", "/"),
      ),
    );
    expect(simulateRoutes.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });

  it("a própria fixture declara test-only e não usa server-only/env/flag", () => {
    expect(existsSync(FIXTURE)).toBe(true);
    const source = readFileSync(FIXTURE, "utf8");
    expect(source).toContain("test-only");
    expect(source).not.toContain("server-only");
    expect(source).not.toContain("process.env");
    expect(source).not.toMatch(/SIMULATED_PROVIDER_ENABLED|enableSimulated/);
  });

  it.each(["provider", "simulated", "mockProvider"])(
    "schema Produto 1:1 RECUSA o campo de cliente `%s`",
    (field) => {
      const legacyBody = {
        storeId: "11111111-1111-4111-8111-111111111111",
        productName: "Produto",
        campaignIntent: "spotlight",
        productImageDataUrl: "data:image/png;base64,AAAA",
        [field]: "attacker-selected",
      };
      const newFlowBody = {
        ...legacyBody,
        backgroundDirection: "studio",
        campaignId: "22222222-2222-4222-8222-222222222222",
        operationId: "33333333-3333-4333-8333-333333333333",
      };
      expect(NewFlowGenerateImageRequestSchema.safeParse(newFlowBody).success).toBe(false);
      expect(GenerateImageRequestSchema.safeParse(legacyBody).success).toBe(false);
    },
  );

  it("o corpo VÁLIDO do Produto 1:1 continua aceito (guarda não é um falso positivo)", () => {
    const body = {
      storeId: "11111111-1111-4111-8111-111111111111",
      productName: "Produto",
      campaignIntent: "spotlight",
      backgroundDirection: "studio",
      campaignId: "22222222-2222-4222-8222-222222222222",
      operationId: "33333333-3333-4333-8333-333333333333",
      productImageDataUrl: "data:image/png;base64,AAAA",
    };
    expect(NewFlowGenerateImageRequestSchema.safeParse(body).success).toBe(true);
  });
});
