import { describe, it, expect } from "vitest";
import { humanizeLabel, getLabel } from "@/lib/labels";

describe("humanizeLabel", () => {
  it("converte snake_case para Title Case", () => {
    expect(humanizeLabel("unknown_value")).toBe("Unknown Value");
  });

  it("converte single word", () => {
    expect(humanizeLabel("test")).toBe("Test");
  });

  it("converte multiple underscores", () => {
    expect(humanizeLabel("very_unknown_value")).toBe("Very Unknown Value");
  });

  it("retorna string vazia para input vazio", () => {
    expect(humanizeLabel("")).toBe("");
  });
});

describe("getLabel", () => {
  const map: Record<string, string> = { a: "Label A", b: "Label B" };

  it("retorna label para chave conhecida", () => {
    expect(getLabel(map, "a")).toBe("Label A");
    expect(getLabel(map, "b")).toBe("Label B");
  });

  it("retorna fallback humanizado para chave desconhecida", () => {
    expect(getLabel(map, "c")).toBe("C");
    expect(getLabel(map, "unknown_key")).toBe("Unknown Key");
  });

  it("retorna fallback humanizado para chave vazia", () => {
    expect(getLabel(map, "")).toBe("");
  });
});
