import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { OperationCostService as OperationCostServiceType } from "@/lib/credit/operation-cost-service";

const envPath = resolve(process.cwd(), ".env.local");
const originalEnv: Record<string, string | undefined> = {};

// Simula "banco derrubado": aponta o Supabase para uma URL inacessivel e
// verifica que getCost lança OperationCostUnavailableError (fail-closed),
// sem retornar fallback nem resolver o custo.
describe("OperationCostService fail-closed (simulated DB down)", () => {
  let OperationCostService: typeof OperationCostServiceType;

  beforeAll(async () => {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m) {
          const key = m[1];
          let value = m[2].trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          originalEnv[key] = process.env[key];
          process.env[key] = value;
        }
      }
    } catch (err) {
      console.warn("Could not load .env.local for integration test", err);
    }

    // Corrompe a URL para simular banco indisponivel (erro de rede/ENOTFOUND)
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:59999";

    const mod = await import("@/lib/credit/operation-cost-service");
    OperationCostService = mod.OperationCostService;
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("getCost lança OperationCostUnavailableError quando a leitura falha", async () => {
    const service = new OperationCostService();
    const promise = service.getCost("campaign_generation");
    await expect(promise).rejects.toMatchObject({
      name: "OperationCostUnavailableError",
    });
  });
});
