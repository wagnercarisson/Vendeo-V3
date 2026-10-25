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
