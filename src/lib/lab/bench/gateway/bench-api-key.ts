import type { AiProvider } from "@/lib/ai/model-resolver";

/**
 * Resolvedor de chave de API **exclusivo da bancada** (F48.2.4, D21; spec
 * `lab-isolation`).
 *
 * Lê **somente** `OPENAI_BENCH_API_KEY`. **Nunca** faz fallback para
 * `OPENAI_API_KEY`/`GEMINI_API_KEY` (nem qualquer outra chave). Chave ausente ou
 * vazia ⇒ `BenchApiKeyError` (`bench_api_key_missing`) **antes** de criar o
 * cliente ou chamar o provider. O resolvedor produtivo `getApiKey`
 * (`src/lib/ai/api-keys.ts`) permanece **intocado**.
 *
 * A chave **nunca** é registrada, persistida ou exibida: a mensagem de erro é
 * sanitizada (não inclui o valor da chave) e nenhum log/artefato a expõe.
 */

/** Variável de ambiente da chave da bancada (única fonte). */
export const BENCH_API_KEY_ENV = "OPENAI_BENCH_API_KEY" as const;

export type BenchApiKeyErrorCode = "bench_api_key_missing";

/** Lançado quando a chave da bancada está ausente/vazia (fail-closed). */
export class BenchApiKeyError extends Error {
  readonly code: BenchApiKeyErrorCode = "bench_api_key_missing";
  readonly provider: string;

  constructor(provider: string) {
    // Mensagem sanitizada: nunca inclui o valor da chave.
    super(`bench_api_key_missing:${provider}:${BENCH_API_KEY_ENV}`);
    this.name = "BenchApiKeyError";
    this.provider = provider;
  }
}

/**
 * Resolve a chave da bancada para o provider. Somente `openai` é suportado no
 * caminho isolado; qualquer outro provider é recusado. Ausente/vazia ⇒
 * `BenchApiKeyError` — nunca cai para a chave produtiva.
 */
export function getBenchApiKey(provider: AiProvider): string {
  if (provider !== "openai") {
    throw new BenchApiKeyError(provider as string);
  }
  const value = process.env.OPENAI_BENCH_API_KEY;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BenchApiKeyError(provider);
  }
  return value;
}
