import type { AiProvider } from "./model-resolver";

/**
 * Resolução de chaves de API por provider (F46, D5 / spec ai-model-registry).
 *
 * `getApiKey(provider)` é o **único** ponto de leitura das chaves de provider.
 * Nenhum outro módulo do gateway/adapters lê `OPENAI_API_KEY`/`GEMINI_API_KEY`
 * diretamente (D8 — restam apenas as chaves + operacionais).
 *
 * Contrato coerente (nunca `undefined`):
 * - `NODE_ENV === "production"`: chave ausente → erro de configuração explícito
 *   (fail-fast, sem fallback silencioso — spec "Ausência de chave em produção
 *   falha explicitamente").
 * - dev/teste: chave ausente → `""` (string vazia), preservando os caminhos
 *   mock/dev que hoje checam `if (!process.env.OPENAI_API_KEY)`.
 *
 * O parâmetro é o union `AiProvider` (46-01) para um switch **exaustivo**: um
 * provider novo quebraria o typecheck até ser tratado aqui.
 */
export function getApiKey(provider: AiProvider): string {
  switch (provider) {
    case "openai":
      return resolveKey(provider, "OPENAI_API_KEY");
    case "gemini":
      return resolveKey(provider, "GEMINI_API_KEY");
    default: {
      // Defensivo em runtime: o tipo cobre os providers conhecidos, mas um valor
      // forjado (cast/JSON) não pode cair silenciosamente no provider errado.
      const unknownProvider = provider as string;
      throw new Error(`[api-keys] provider desconhecido: "${unknownProvider}"`);
    }
  }
}

/**
 * F47.1 (D6) — credencial DEDICADA da validação local da Assinatura Visual.
 *
 * Lê SOMENTE `VENDEO_VS_VALIDATION_OPENAI_API_KEY`. Ausente/vazia falha com
 * erro tipado e NUNCA cai para `OPENAI_API_KEY` ou qualquer outra chave.
 */
export const VALIDATION_OPENAI_API_KEY_ENV = "VENDEO_VS_VALIDATION_OPENAI_API_KEY" as const;

export const OPERATIONAL_PROVIDER_KEY_MISSING =
  "visual_signature_operational_provider_key_missing" as const;

export class OperationalApiKeyMissingError extends Error {
  readonly code = OPERATIONAL_PROVIDER_KEY_MISSING;

  constructor(provider: AiProvider) {
    super(`${OPERATIONAL_PROVIDER_KEY_MISSING}:${provider}`);
    this.name = "OperationalApiKeyMissingError";
  }
}

export function readOperationalApiKey(provider: AiProvider): string {
  try {
    const key = getApiKey(provider);
    if (!key.trim()) throw new OperationalApiKeyMissingError(provider);
    return key;
  } catch {
    throw new OperationalApiKeyMissingError(provider);
  }
}

/**
 * Produção usa o resolvedor central; validação mantém credencial isolada.
 */
export function readVisualSignatureApiKey(
  provider: AiProvider,
  environment: "local_validation" | "production",
): string {
  return environment === "production"
    ? readOperationalApiKey(provider)
    : readValidationApiKey(provider);
}

export const VALIDATION_PROVIDER_KEY_MISSING =
  "visual_signature_validation_provider_key_missing" as const;

export class ValidationApiKeyMissingError extends Error {
  readonly code = VALIDATION_PROVIDER_KEY_MISSING;

  constructor(provider: AiProvider) {
    super(`${VALIDATION_PROVIDER_KEY_MISSING}:${provider}`);
    this.name = "ValidationApiKeyMissingError";
  }
}

export function readValidationApiKey(provider: AiProvider): string {
  // A validação local desta fase usa exclusivamente OpenAI/Responses. Qualquer
  // outro provider falha fechado (sem fallback silencioso).
  if (provider !== "openai") {
    throw new ValidationApiKeyMissingError(provider);
  }
  const value = process.env[VALIDATION_OPENAI_API_KEY_ENV];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationApiKeyMissingError(provider);
  }
  return value;
}

function resolveKey(provider: AiProvider, envName: "OPENAI_API_KEY" | "GEMINI_API_KEY"): string {
  const value = process.env[envName];
  if (value !== undefined && value.length > 0) {
    return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `[api-keys] ${envName} não configurada para o provider "${provider}" (fail-fast em produção)`,
    );
  }
  return "";
}
