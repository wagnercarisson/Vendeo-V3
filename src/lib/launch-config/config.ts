import "server-only";

export interface LaunchConfig {
  v15Enabled: boolean;
  creditsChargingEnabled: boolean;
  copyDirectorEnabled: boolean;
  rateLimitEnabled: boolean;
  generationPaused: boolean;
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
    };
  }

  return {
    v15Enabled: true,
    creditsChargingEnabled: envBool("VENDEO_CREDITS_CHARGING_ENABLED", true),
    copyDirectorEnabled: envBool("VENDEO_COPY_DIRECTOR_ENABLED", true),
    rateLimitEnabled: envBool("VENDEO_RATE_LIMIT_ENABLED", true),
    generationPaused: envBool("VENDEO_GENERATION_PAUSED", false),
  };
}
