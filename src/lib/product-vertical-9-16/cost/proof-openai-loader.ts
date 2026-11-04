/**
 * F59 — Loader do SDK OpenAI exclusivo da prova de provider.
 *
 * Duas garantias que o loader padrão do adapter NÃO oferece:
 * 1. `maxRetries: 0` — a prova contabiliza UMA requisição por chamada; retries
 *    automáticos do SDK executariam requisições pagas fora da contagem.
 * 2. credencial EXPLÍCITA — usa exatamente a chave já validada no preflight,
 *    em vez de reler `process.env` dentro do adapter.
 *
 * Não altera o runtime 1:1: o adapter padrão continua usando o loader default.
 */

import type {
  UpstreamImagesSdk,
  UpstreamImagesSdkLoader,
} from "@/lib/ai/adapters/upstream-images";

export interface ProofOpenAiModule {
  readonly default: new (options: {
    apiKey: string;
    maxRetries: number;
  }) => unknown;
  readonly toFile: UpstreamImagesSdk["toFile"];
}

export type ImportProofOpenAiModule = () => Promise<ProofOpenAiModule>;

async function defaultImport(): Promise<ProofOpenAiModule> {
  const mod = await import("openai");
  return {
    default: mod.default as unknown as ProofOpenAiModule["default"],
    toFile: mod.toFile as unknown as ProofOpenAiModule["toFile"],
  };
}

/**
 * Cria o loader da prova. O argumento `adapterApiKey` é intencionalmente
 * IGNORADO: a credencial usada é a validada no preflight (closure), nunca uma
 * leitura posterior de ambiente.
 */
export function createProofSdkLoader(
  validatedApiKey: string,
  importModule: ImportProofOpenAiModule = defaultImport,
): UpstreamImagesSdkLoader {
  if (validatedApiKey.trim().length === 0) {
    throw new Error("proof_api_key_missing");
  }

  return async (_adapterApiKey: string): Promise<UpstreamImagesSdk> => {
    const { default: OpenAI, toFile } = await importModule();
    const client = new OpenAI({
      apiKey: validatedApiKey,
      maxRetries: 0,
    });
    return {
      client: client as unknown as UpstreamImagesSdk["client"],
      toFile,
    };
  };
}
