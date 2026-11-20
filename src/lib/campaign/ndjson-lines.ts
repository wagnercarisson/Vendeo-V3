/**
 * F60.7 C2/C6 — leitor de linhas NDJSON usado tanto pelo stream inicial quanto
 * pela continuação.
 *
 * Responsabilidades estritamente de transporte:
 * - decodificar chunks fragmentados (inclusive UTF-8 dividido);
 * - separar por `\n`;
 * - no fim do stream, fazer o flush do `TextDecoder` e entregar a última
 *   linha mesmo sem newline final;
 * - ignorar linhas vazias.
 *
 * A interpretação dos eventos/terminais continua com o chamador.
 */
export async function* readNdjsonLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield line;
      }
    }

    // Flush de uma possível sequência multibyte retida e da última linha sem `\n`.
    buffer += decoder.decode();
    if (buffer.trim()) yield buffer;
  } finally {
    reader.releaseLock();
  }
}
