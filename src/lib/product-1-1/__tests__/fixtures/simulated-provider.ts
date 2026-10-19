/**
 * F56.2.6 — Plano 04 (Task 2) — PROVIDER SIMULADO **test-only**.
 *
 * Fixture determinística de teste LOCAL (P1 / reuso local). Ela existe para
 * provar o contrato de recuperação sem NENHUMA chamada paga, sem rede e sem
 * seleção de provider pelo cliente.
 *
 * Regras invariantes (verificadas por `simulated-provider-import.guard.test.ts`):
 * - NÃO importa o marcador de módulo exclusivo de servidor;
 * - NÃO lê variáveis de ambiente de runtime;
 * - NÃO expõe flag de habilitação;
 * - é importada SOMENTE por testes (`src/lib/product-1-1/__tests__/**`);
 * - NUNCA é importada por `src/app/api/**` (não existe rota pública de simulação).
 *
 * `invoke` devolve uma imagem estática; `generateUntilAborted` simula uma
 * chamada em voo que é interrompida por um kill/abort cooperativo LOCAL. Nenhuma
 * das duas toca banco, Storage, rede ou provider real.
 */

/** JPEG 1×1 opaco (base64). Bytes sintéticos — nunca representam arte real. */
export const SIMULATED_IMAGE_BASE64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==";

export interface SimulatedGenerationResult {
  readonly imageBase64: string;
  readonly mimeType: "image/jpeg";
}

export interface SimulatedProvider {
  /** Chamada determinística: devolve bytes estáticos (zero I/O). */
  generateImage(): Promise<SimulatedGenerationResult>;
  /**
   * Simula a chamada EM VOO de um provider que só "morre" no abort (kill local
   * cooperativo). NUNCA resolve — rejeita com `AbortError` quando o sinal
   * dispara, permitindo provar que um kill NÃO equivale a ausência.
   */
  generateUntilAborted(signal: AbortSignal): Promise<never>;
}

function abortError(): Error {
  const error = new Error("simulated_provider_aborted");
  error.name = "AbortError";
  return error;
}

export function createSimulatedProvider(
  result: SimulatedGenerationResult = {
    imageBase64: SIMULATED_IMAGE_BASE64,
    mimeType: "image/jpeg",
  },
): SimulatedProvider {
  return {
    async generateImage(): Promise<SimulatedGenerationResult> {
      return result;
    },
    generateUntilAborted(signal: AbortSignal): Promise<never> {
      if (signal.aborted) return Promise.reject(abortError());
      return new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(abortError()), { once: true });
      });
    },
  };
}
