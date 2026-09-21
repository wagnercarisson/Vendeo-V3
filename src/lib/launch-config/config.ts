import "server-only";

export interface LaunchConfig {
  v15Enabled: boolean;
  creditsChargingEnabled: boolean;
  copyDirectorEnabled: boolean;
  rateLimitEnabled: boolean;
  generationPaused: boolean;
  monthlyCreditsEnabled: boolean;
  monthlyCreditsAmount: number;
  monthlyBonusCap: number;
  monthlyCreditsMinStoreAgeDays: number;
  publicSignupEnabled: boolean;
  demoCreditsEnabled: boolean;
  demoCreditsAmount: number;
  demoCreditsTtlHours: number;
  emailEnabled: boolean;
}

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

export function getLaunchConfig(): LaunchConfig {
  const v15Enabled = envBool("VENDEO_V15_ENABLED", true);

  if (!v15Enabled) {
    return {
      v15Enabled: false,
      creditsChargingEnabled: false,
      copyDirectorEnabled: false,
      rateLimitEnabled: false,
      generationPaused: envBool("VENDEO_GENERATION_PAUSED", false),
      monthlyCreditsEnabled: envBool("VENDEO_MONTHLY_CREDITS_ENABLED", true),
      monthlyCreditsAmount: Number(process.env.VENDEO_MONTHLY_CREDITS_AMOUNT) || 5,
      monthlyBonusCap: Number(process.env.VENDEO_MONTHLY_BONUS_CAP) || 10,
      monthlyCreditsMinStoreAgeDays: Number(process.env.VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS) || 30,
      publicSignupEnabled: envBool("VENDEO_PUBLIC_SIGNUP_ENABLED", false),
      demoCreditsEnabled: envBool("VENDEO_DEMO_CREDITS_ENABLED", false),
      demoCreditsAmount: Number(process.env.VENDEO_DEMO_CREDITS_AMOUNT) || 10,
      demoCreditsTtlHours: Number(process.env.VENDEO_DEMO_CREDITS_TTL_HOURS) || 168,
      emailEnabled: envBool("VENDEO_EMAIL_ENABLED", false),
    };
  }

  return {
    v15Enabled: true,
    creditsChargingEnabled: envBool("VENDEO_CREDITS_CHARGING_ENABLED", true),
    copyDirectorEnabled: envBool("VENDEO_COPY_DIRECTOR_ENABLED", true),
    rateLimitEnabled: envBool("VENDEO_RATE_LIMIT_ENABLED", true),
    generationPaused: envBool("VENDEO_GENERATION_PAUSED", false),
    monthlyCreditsEnabled: envBool("VENDEO_MONTHLY_CREDITS_ENABLED", true),
    monthlyCreditsAmount: Number(process.env.VENDEO_MONTHLY_CREDITS_AMOUNT) || 5,
    monthlyBonusCap: Number(process.env.VENDEO_MONTHLY_BONUS_CAP) || 10,
    monthlyCreditsMinStoreAgeDays: Number(process.env.VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS) || 30,
    publicSignupEnabled: envBool("VENDEO_PUBLIC_SIGNUP_ENABLED", false),
    demoCreditsEnabled: envBool("VENDEO_DEMO_CREDITS_ENABLED", false),
    demoCreditsAmount: Number(process.env.VENDEO_DEMO_CREDITS_AMOUNT) || 10,
    demoCreditsTtlHours: Number(process.env.VENDEO_DEMO_CREDITS_TTL_HOURS) || 168,
    emailEnabled: envBool("VENDEO_EMAIL_ENABLED", false),
  };
}
