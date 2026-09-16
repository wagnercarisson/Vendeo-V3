import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { LabPromptLoader } from "../lab-prompt-loader";
import { PromptLoader } from "@/lib/image-generation/prompt-loader";

/**
 * F48.1 (D6/T-48-1-34) — override de prompt sem alterar prompts oficiais.
 *
 * O override é servido **em memória**; o arquivo oficial em `prompts/` precisa
 * permanecer byte a byte idêntico antes/depois (hash SHA-256 conferido).
 */

const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const OFFICIAL_PROMPT = "campaign-image-director-offer";
const OFFICIAL_PROMPT_FILE = path.join(PROMPTS_DIR, `${OFFICIAL_PROMPT}.md`);
const DELEGATED_PROMPT = "campaign-image-reviewer";

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file, "utf8"), "utf8").digest("hex");
}

describe("LabPromptLoader — override do snapshot da variante (F48.1, D6)", () => {
  it("serve o conteúdo do override quando o nome casa", () => {
    const loader = new LabPromptLoader(
      [{ name: OFFICIAL_PROMPT, content: "OVERRIDE CANDIDATA: foco absoluto no preço." }],
      PROMPTS_DIR,
    );

    expect(loader.load(OFFICIAL_PROMPT)).toBe("OVERRIDE CANDIDATA: foco absoluto no preço.");
  });

  it("interpola {{chave}} no conteúdo do override", () => {
    const loader = new LabPromptLoader(
      [{ name: OFFICIAL_PROMPT, content: "Produto: {{productName}} — Loja: {{storeName}}" }],
      PROMPTS_DIR,
    );

    expect(loader.load(OFFICIAL_PROMPT, { productName: "Café Premium", storeName: "Loja X" })).toBe(
      "Produto: Café Premium — Loja: Loja X",
    );
  });

  it("delega ao loader de filesystem quando o prompt não está sob teste", () => {
    const loader = new LabPromptLoader(
      [{ name: OFFICIAL_PROMPT, content: "OVERRIDE" }],
      PROMPTS_DIR,
    );
    const official = new PromptLoader(PROMPTS_DIR).load(DELEGATED_PROMPT);

    expect(loader.load(DELEGATED_PROMPT)).toBe(official);
    expect(official.length).toBeGreaterThan(0);
  });

  it("mantém a interpolação oficial no caminho delegado", () => {
    const loader = new LabPromptLoader([], PROMPTS_DIR);
    const official = new PromptLoader(PROMPTS_DIR);

    expect(loader.load(DELEGATED_PROMPT)).toBe(official.load(DELEGATED_PROMPT));
  });

  it("não altera o arquivo oficial em prompts/ (hash idêntico antes/depois)", () => {
    const before = sha256(OFFICIAL_PROMPT_FILE);
    const beforeBytes = readFileSync(OFFICIAL_PROMPT_FILE);

    const loader = new LabPromptLoader(
      [{ name: OFFICIAL_PROMPT, content: "OVERRIDE TEMPORÁRIO" }],
      PROMPTS_DIR,
    );
    loader.load(OFFICIAL_PROMPT, { productName: "Produto" });
    loader.load(DELEGATED_PROMPT);
    loader.clearCache();

    expect(sha256(OFFICIAL_PROMPT_FILE)).toBe(before);
    expect(readFileSync(OFFICIAL_PROMPT_FILE).equals(beforeBytes)).toBe(true);
  });
});
