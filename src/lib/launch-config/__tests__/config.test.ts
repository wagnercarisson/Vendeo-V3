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
  delete process.env.VENDEO_MONTHLY_CREDITS_ENABLED;
  delete process.env.VENDEO_MONTHLY_CREDITS_AMOUNT;
  delete process.env.VENDEO_MONTHLY_BONUS_CAP;
  delete process.env.VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS;
  delete process.env.VENDEO_PUBLIC_SIGNUP_ENABLED;
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

  describe("monthly credit flags (F29.3)", () => {
    it("defaults: enabled=true, amount=5, cap=10, minAge=30", () => {
      const config = getLaunchConfig();
      expect(config.monthlyCreditsEnabled).toBe(true);
      expect(config.monthlyCreditsAmount).toBe(5);
      expect(config.monthlyBonusCap).toBe(10);
      expect(config.monthlyCreditsMinStoreAgeDays).toBe(30);
    });

    it("VENDEO_MONTHLY_CREDITS_ENABLED=false", () => {
      process.env.VENDEO_MONTHLY_CREDITS_ENABLED = "false";
      expect(getLaunchConfig().monthlyCreditsEnabled).toBe(false);
    });

    it("VENDEO_MONTHLY_CREDITS_AMOUNT override", () => {
      process.env.VENDEO_MONTHLY_CREDITS_AMOUNT = "10";
      expect(getLaunchConfig().monthlyCreditsAmount).toBe(10);
    });

    it("VENDEO_MONTHLY_BONUS_CAP override", () => {
      process.env.VENDEO_MONTHLY_BONUS_CAP = "20";
      expect(getLaunchConfig().monthlyBonusCap).toBe(20);
    });

    it("VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS override", () => {
      process.env.VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS = "15";
      expect(getLaunchConfig().monthlyCreditsMinStoreAgeDays).toBe(15);
    });

    it("invalid numeric env falls back to default", () => {
      process.env.VENDEO_MONTHLY_CREDITS_AMOUNT = "invalid";
      expect(getLaunchConfig().monthlyCreditsAmount).toBe(5);
    });

    it("empty numeric env falls back to default", () => {
      process.env.VENDEO_MONTHLY_CREDITS_AMOUNT = "";
      expect(getLaunchConfig().monthlyCreditsAmount).toBe(5);
    });
  });

  describe("public signup flag (F42)", () => {
    it("defaults to false when env var is not set", () => {
      const config = getLaunchConfig();
      expect(config.publicSignupEnabled).toBe(false);
    });

    it("VENDEO_PUBLIC_SIGNUP_ENABLED=true", () => {
      process.env.VENDEO_PUBLIC_SIGNUP_ENABLED = "true";
      expect(getLaunchConfig().publicSignupEnabled).toBe(true);
    });

    it("VENDEO_PUBLIC_SIGNUP_ENABLED=false", () => {
      process.env.VENDEO_PUBLIC_SIGNUP_ENABLED = "false";
      expect(getLaunchConfig().publicSignupEnabled).toBe(false);
    });

    it("invalid env value falls back to default false", () => {
      process.env.VENDEO_PUBLIC_SIGNUP_ENABLED = "sim";
      expect(getLaunchConfig().publicSignupEnabled).toBe(false);
    });
  });
});
