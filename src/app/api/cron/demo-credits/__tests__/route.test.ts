import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("demo-credits reconciler contract", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/api/cron/demo-credits/route.ts"), "utf8");

  it("requires the CRON_SECRET bearer token and materializes expired balances", () => {
    expect(source).toMatch(/authorization.*Bearer/);
    expect(source).toContain("materialize_demo_expiration");
  });

  it("repairs every durable evidence type with its transaction id as dedup key", () => {
    expect(source).toMatch(/type === "demo"[\s\S]*dedupKey: tx\.id/);
    expect(source).toMatch(/type === "expiration"[\s\S]*dedupKey: tx\.id/);
    expect(source).toMatch(/demo_exhausted[\s\S]*dedupKey: tx\.id/);
    expect(source).toContain("demo_expiring_24h");
  });

  it("uses the configured daily Hobby-safe schedule", () => {
    const vercel = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    expect(vercel).toContain("demo-credits");
    expect(vercel).toMatch(/0 7 \* \* \*/);
  });
});
