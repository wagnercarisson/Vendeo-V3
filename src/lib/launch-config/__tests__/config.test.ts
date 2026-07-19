import { vi, describe, it, expect, beforeEach } from "vitest";

const OLD_ENV = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env.VENDEO_V15_ENABLED;
  delete process.env.VENDEO_CREDITS_CHARGING_ENABLED;
  delete process.env.VENDEO_COPY_DIRECTOR_ENABLED;
  delete process.env.VENDEO_RATE_LIMIT_ENABLED;
  delete process.env.VENDEO_GENERATION_PAUSED;
});

import { getLaunchConfig } from "../config";

describe("getLaunchConfig", () => {
  it("returns defaults when no env vars set", () => {
    const config = getLaunchConfig();
    expect(config.v15Enabled).toBe(true);
    expect(config.creditsChargingEnabled).toBe(true);
    expect(config.copyDirectorEnabled).toBe(true);
    expect(config.rateLimitEnabled).toBe(true);
    expect(config.generationPaused).toBe(false);
  });

  it("respects VENDEO_V15_ENABLED=false", () => {
    process.env.VENDEO_V15_ENABLED = "false";
    const config = getLaunchConfig();
    expect(config.v15Enabled).toBe(false);
    expect(config.creditsChargingEnabled).toBe(false);
    expect(config.copyDirectorEnabled).toBe(false);
    expect(config.rateLimitEnabled).toBe(false);
  });

  it("respects VENDEO_GENERATION_PAUSED=true", () => {
    process.env.VENDEO_GENERATION_PAUSED = "true";
    const config = getLaunchConfig();
    expect(config.generationPaused).toBe(true);
  });

  it("respects VENDEO_CREDITS_CHARGING_ENABLED=false", () => {
    process.env.VENDEO_CREDITS_CHARGING_ENABLED = "false";
    const config = getLaunchConfig();
    expect(config.creditsChargingEnabled).toBe(false);
    expect(config.v15Enabled).toBe(true);
  });

  it("respects VENDEO_COPY_DIRECTOR_ENABLED=false", () => {
    process.env.VENDEO_COPY_DIRECTOR_ENABLED = "false";
    const config = getLaunchConfig();
    expect(config.copyDirectorEnabled).toBe(false);
  });

  it("respects VENDEO_RATE_LIMIT_ENABLED=false", () => {
    process.env.VENDEO_RATE_LIMIT_ENABLED = "false";
    const config = getLaunchConfig();
    expect(config.rateLimitEnabled).toBe(false);
  });

  it("falls back on malformed env var value", () => {
    process.env.VENDEO_V15_ENABLED = "invalid";
    const config = getLaunchConfig();
    expect(config.v15Enabled).toBe(true);
  });

  it("never throws for any env var value", () => {
    process.env.VENDEO_V15_ENABLED = "";
    process.env.VENDEO_CREDITS_CHARGING_ENABLED = "maybe";
    process.env.VENDEO_GENERATION_PAUSED = "1";
    expect(() => getLaunchConfig()).not.toThrow();
  });
});
