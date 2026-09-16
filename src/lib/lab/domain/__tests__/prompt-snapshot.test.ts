// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { PromptLoader } from "@/lib/image-generation/prompt-loader";

import {
  PROMPT_UNDER_TEST,
  buildBaselinePromptSnapshot,
  buildCandidatePromptSnapshot,
  computePromptContentHash,
} from "../prompt-snapshot";

/**
 * Snapshots de prompt do laboratório (F48.1, D5/D8).
 *
 * Trava: baseline lido do arquivo oficial atual (`official`), candidata como
 * override (`override`), hash SHA-256 determinístico e o arquivo oficial
 * **intacto** após a leitura (T-48-1-27).
 */

const OFFICIAL_PROMPT_FILE = path.join(
  process.cwd(),
  "prompts",
  `${PROMPT_UNDER_TEST}.md`,
);

describe("computePromptContentHash", () => {
  it("produz SHA-256 hex de 64 caracteres", () => {
    const hash = computePromptContentHash("conteúdo de teste");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("é determinístico: mesmo conteúdo ⇒ mesmo hash", () => {
    const content = "# Diretor de arte\n\nInstruções.";

    expect(computePromptContentHash(content)).toBe(computePromptContentHash(content));
  });

  it("conteúdos diferentes ⇒ hashes diferentes", () => {
    expect(computePromptContentHash("a")).not.toBe(computePromptContentHash("b"));
  });
});

describe("buildBaselinePromptSnapshot", () => {
  it("lê o prompt oficial atual com origem official", () => {
    const snapshot = buildBaselinePromptSnapshot();

    expect(snapshot.name).toBe(PROMPT_UNDER_TEST);
    expect(snapshot.source).toBe("official");
    expect(snapshot.content.length).toBeGreaterThan(0);
    expect(snapshot.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.contentHash).toBe(computePromptContentHash(snapshot.content));
  });

  it("usa o loader injetado (mesmo conteúdo ⇒ mesmo hash)", () => {
    const fromDisk = buildBaselinePromptSnapshot();
    const withInjectedLoader = buildBaselinePromptSnapshot(new PromptLoader());

    expect(withInjectedLoader).toEqual(fromDisk);
  });

  it("não modifica o arquivo oficial de prompt", () => {
    const before = readFileSync(OFFICIAL_PROMPT_FILE, "utf8");
    const beforeStat = statSync(OFFICIAL_PROMPT_FILE);

    buildBaselinePromptSnapshot();

    const after = readFileSync(OFFICIAL_PROMPT_FILE, "utf8");
    const afterStat = statSync(OFFICIAL_PROMPT_FILE);

    expect(after).toBe(before);
    expect(afterStat.mtimeMs).toBe(beforeStat.mtimeMs);
    expect(afterStat.size).toBe(beforeStat.size);
  });
});

describe("buildCandidatePromptSnapshot", () => {
  it("congela o override com origem override e hash do conteúdo enviado", () => {
    const content = "# Diretor de arte (candidata)\n\nInstruções enxutas.";

    const snapshot = buildCandidatePromptSnapshot({
      promptName: PROMPT_UNDER_TEST,
      promptContent: content,
    });

    expect(snapshot.name).toBe(PROMPT_UNDER_TEST);
    expect(snapshot.source).toBe("override");
    expect(snapshot.content).toBe(content);
    expect(snapshot.contentHash).toBe(computePromptContentHash(content));
  });

  it("recusa prompt fora do escopo com unsupported_prompt_under_test", () => {
    expect(() =>
      buildCandidatePromptSnapshot({
        promptName: "campaign-image-director-spotlight",
        promptContent: "# Outro prompt",
      }),
    ).toThrowError(/unsupported_prompt_under_test:campaign-image-director-spotlight/);
  });

  it("baseline e candidata com o mesmo conteúdo compartilham o hash (comparação justa)", () => {
    const baseline = buildBaselinePromptSnapshot();
    const candidate = buildCandidatePromptSnapshot({
      promptName: PROMPT_UNDER_TEST,
      promptContent: baseline.content,
    });

    expect(candidate.contentHash).toBe(baseline.contentHash);
    expect(candidate.source).not.toBe(baseline.source);
  });
});
