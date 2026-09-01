import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

// Flags operacionais (F43 D5 + QCW): persistência na tabela feature_flags
// (NÃO env var como decisão principal). Leitura server-only com fallback
// seguro por flag. O RPC admin_update_feature_flag é genérico por key
// (motivo obrigatório + auditoria atômica) — sem mudança de RPC.
export const FORCE_BRIEF_VISION_CHECK_KEY = "force_brief_vision_check";
export const CAPTCHA_ENABLED_KEY = "captcha_enabled";
export const CAMPAIGN_GENERATION_ENABLED_KEY = "campaign_generation_enabled";
export const VISUAL_SIGNATURE_GENERATION_ENABLED_KEY =
  "visual_signature_generation_enabled";
export const CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled";

// Ordem canônica de exibição na tela "Controles operacionais".
export const ALL_FEATURE_FLAG_KEYS = [
  FORCE_BRIEF_VISION_CHECK_KEY,
  CAPTCHA_ENABLED_KEY,
  CAMPAIGN_GENERATION_ENABLED_KEY,
  VISUAL_SIGNATURE_GENERATION_ENABLED_KEY,
  CAMPAIGN_APPROVAL_ENABLED_KEY,
];

// Env vars emergenciais opcionais (fail-safe de infra) — nunca são a decisão
// principal. A decisão principal é a tabela.
const FORCE_ENV = "VENDEO_FORCE_BRIEF_VISION_CHECK";

/**
 * Mesma semântica do `envBool` do launch-config: retorna o valor da env var
 * quando setada como "true"/"false", senão `defaultValue`.
 */
function envVarBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

export class FeatureFlagService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  /**
   * Leitura genérica de flag com fallback operacional.
   *
   * Cadeia: from("feature_flags").select("enabled").eq("key", key).maybeSingle().
   * Erro de leitura ou not-found → console.warn operacional + fallback.
   * `envOverride` (quando presente) pode forçar `true` se a env var estiver
   * exatamente `"true"` (fail-safe emergencial de infra). O fallback final é
   * `fallback` — que pode já embutir uma env var via `envVarBool` (captcha).
   */
  private async readFlag(
    key: string,
    fallback: boolean,
    envOverride?: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from("feature_flags")
        .select("enabled")
        .eq("key", key)
        .maybeSingle();

      if (error) {
        console.warn(
          `[feature-flag] ${key} read error — falling back: ${error.message}`
        );
      } else if (data === null) {
        console.warn(
          `[feature-flag] ${key} not found — falling back`
        );
      } else {
        return data.enabled === true;
      }
    } catch (err) {
      console.warn(
        `[feature-flag] ${key} read exception — falling back: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Fail-safe emergencial (infra): nunca a decisão principal.
    if (envOverride && process.env[envOverride] === "true") {
      return true;
    }

    return fallback;
  }

  /**
   * Lê o `enabled` da flag `force_brief_vision_check` (F43 D5).
   *
   * Fallback seguro: falha na leitura → `false` (fluxo padrão: revisão humana +
   * pular vision) — NUNCA bloqueia a geração; loga warning operacional.
   * Env var emergencial `VENDEO_FORCE_BRIEF_VISION_CHECK=true` pode forçar
   * `true` quando presente (fail-safe de infra).
   */
  isForceBriefVisionCheckEnabled(): Promise<boolean> {
    return this.readFlag(
      FORCE_BRIEF_VISION_CHECK_KEY,
      false,
      FORCE_ENV,
    );
  }

  /**
   * Lê o `enabled` da flag `captcha_enabled` (QCW).
   *
   * Escopo: nível do APP — o Vendeo renderiza/oculta o Turnstile, exige ou não
   * token no frontend e envia ou não captchaToken ao Supabase Auth. A flag NÃO
   * altera a configuração de CAPTCHA do Supabase Auth (se habilitada lá, o
   * Auth continua exigindo token válido — limite informado na descrição da
   * flag e na tela Controles operacionais).
   *
   * Fallback fail-safe operacional: falha/not-found de leitura → usa
   * `VENDEO_CAPTCHA_ENABLED` se setada (respeita true E false); se ausente,
   * `true`. Com seed `true` + fallback `true`, a migration e a falha de leitura
   * NUNCA desligam o envio de captchaToken por acidente — preserva o
   * comportamento de produção e evita quebrar login/signup/recuperação quando
   * o Supabase Auth está com CAPTCHA habilitado.
   */
  isCaptchaEnabled(): Promise<boolean> {
    return this.readFlag(
      CAPTCHA_ENABLED_KEY,
      envVarBool("VENDEO_CAPTCHA_ENABLED", true),
    );
  }

  /**
   * Lê o `enabled` da flag `campaign_generation_enabled` (QCW).
   *
   * Fallback fail-open (F38 D5): falha/not-found de leitura → `true` — NUNCA
   * desliga a geração de campanhas por acidente.
   */
  isCampaignGenerationEnabled(): Promise<boolean> {
    return this.readFlag(CAMPAIGN_GENERATION_ENABLED_KEY, true);
  }

  /**
   * Lê o `enabled` da flag `visual_signature_generation_enabled` (QCW).
   *
   * Fallback fail-open (F38 D5): falha/not-found de leitura → `true` — NUNCA
   * desliga a geração de assinatura visual por acidente.
   */
  isVisualSignatureGenerationEnabled(): Promise<boolean> {
    return this.readFlag(VISUAL_SIGNATURE_GENERATION_ENABLED_KEY, true);
  }

  /**
   * Lê o `enabled` da flag `campaign_approval_enabled` (F37.1 D1).
   *
   * Fallback fail-closed: falha/not-found de leitura → `false` → comportamento
   * exatamente o atual (entrega imediata). Sem envOverride — a decisão principal
   * é a tabela `feature_flags`; env var seria apenas fail-safe emergencial de
   * infra, não decisão (decisão 1 da F37.1).
   */
  isCampaignApprovalEnabled(): Promise<boolean> {
    return this.readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false);
  }
}

export async function isForceBriefVisionCheckEnabled(): Promise<boolean> {
  return new FeatureFlagService().isForceBriefVisionCheckEnabled();
}

export async function isCaptchaEnabled(): Promise<boolean> {
  return new FeatureFlagService().isCaptchaEnabled();
}

export async function isCampaignGenerationEnabled(): Promise<boolean> {
  return new FeatureFlagService().isCampaignGenerationEnabled();
}

export async function isVisualSignatureGenerationEnabled(): Promise<boolean> {
  return new FeatureFlagService().isVisualSignatureGenerationEnabled();
}

export async function isCampaignApprovalEnabled(): Promise<boolean> {
  return new FeatureFlagService().isCampaignApprovalEnabled();
}