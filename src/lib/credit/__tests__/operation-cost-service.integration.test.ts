import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { OperationCostService as OperationCostServiceType } from "@/lib/credit/operation-cost-service";

const envPath = resolve(process.cwd(), ".env.local");
const originalEnv: Record<string, string | undefined> = {};

describe("OperationCostService integration (real DB)", () => {
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

  it("getCost campaign_generation source table", async () => {
    const result = await new OperationCostService().getCost("campaign_generation");
    expect(result).toEqual({
      operationKey: "campaign_generation",
      costCredits: 1,
      enabled: true,
      source: "table",
    });
  });

  it("getCost visual_signature_generation source table", async () => {
    const result = await new OperationCostService().getCost(
      "visual_signature_generation",
    );
    expect(result).toEqual({
      operationKey: "visual_signature_generation",
      costCredits: 1,
      enabled: true,
      source: "table",
    });
  });
});
