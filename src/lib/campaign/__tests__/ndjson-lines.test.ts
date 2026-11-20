import { describe, expect, it } from "vitest";

import { readNdjsonLines } from "../ndjson-lines";

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function collect(chunks: Uint8Array[]): Promise<string[]> {
  const lines: string[] = [];
  for await (const line of readNdjsonLines(streamOf(chunks))) {
    lines.push(line);
  }
  return lines;
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("F60.7 C2/C6 — leitor NDJSON", () => {
  it("lê linhas completas com newline e ignora linhas vazias", async () => {
    const lines = await collect([
      encode('{"type":"phase"}\n\n{"type":"result"}\n'),
    ]);
    expect(lines).toEqual(['{"type":"phase"}', '{"type":"result"}']);
  });

  it("entrega a última linha sem newline final", async () => {
    const lines = await collect([encode('{"type":"phase"}\n{"type":"result"}')]);
    expect(lines).toEqual(['{"type":"phase"}', '{"type":"result"}']);
  });

  it("recompõe linha dividida entre chunks", async () => {
    const raw = '{"type":"result","message":"campanha pronta"}';
    const lines = await collect([
      encode(raw.slice(0, 10)),
      encode(raw.slice(10, 24)),
      encode(raw.slice(24)),
    ]);
    expect(lines).toEqual([raw]);
  });

  it("faz flush de UTF-8 dividido e sem newline final", async () => {
    const raw = '{"type":"result","message":"Geração concluída"}';
    const bytes = encode(raw);
    const chunks = Array.from(bytes, (byte) => Uint8Array.of(byte));
    const lines = await collect(chunks);
    expect(lines).toEqual([raw]);
  });
});
