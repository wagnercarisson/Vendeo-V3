// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { PromptLoader } from "@/lib/image-generation/prompt-loader";

import {
  PROMPT_UNDER_TEST,
  SENSITIVE_PROMPT_CONTENT,
  SensitivePromptContentError,
  buildBaselinePromptSnapshot,
  buildCandidatePromptSnapshot,
  computePromptContentHash,
  findSensitivePromptContent,
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

describe("recusa de conteúdo sensível (D15)", () => {
  /** Loader fake que devolve um conteúdo controlado (sem tocar em `prompts/`). */
  function fakeLoader(content: string): PromptLoader {
    return { load: () => content } as unknown as PromptLoader;
  }

  function capture(fn: () => unknown): unknown {
    try {
      fn();
      return null;
    } catch (caught) {
      return caught;
    }
  }

  const sensitiveCases: Array<{ label: string; content: string; kind: string }> = [
    { label: "chave OpenAI (sk-)", content: "Use a chave sk-abcdefgh12345678 no teste.", kind: "api_key" },
    { label: "chave Google (AIza)", content: "Token AIzaSyABCDEFGH1234 aqui.", kind: "api_key" },
    { label: "Bearer token", content: "Authorization: Bearer abcdefgh1234", kind: "bearer_token" },
    {
      label: "URL https",
      content: "Consulte https://projeto.supabase.co/rest/v1 para detalhes.",
      kind: "url",
    },
    {
      label: "URL de conexão postgres",
      content: "DSN: postgres://user:senha@host:5432/db",
      kind: "url",
    },
  ];

  for (const { label, content, kind } of sensitiveCases) {
    it(`candidata com ${label} é recusada com sensitive_prompt_content`, () => {
      const error = capture(() =>
        buildCandidatePromptSnapshot({ promptName: PROMPT_UNDER_TEST, promptContent: content }),
      ) as SensitivePromptContentError;

      expect(error).toBeInstanceOf(SensitivePromptContentError);
      expect(error.code).toBe(SENSITIVE_PROMPT_CONTENT);
      expect(error.field).toBe("candidate");
      expect(error.kind).toBe(kind);
      // O erro nunca expõe o conteúdo sensível.
      expect(error.message).not.toContain("sk-abcdefgh");
      expect(error.message).not.toContain("AIzaSy");
      expect(error.message).not.toContain("abcdefgh1234");
      expect(error.message).not.toContain("supabase.co");
      expect(error.message).not.toContain("postgres://");
    });
  }

  it("baseline com conteúdo sensível (loader injetado) é recusado no campo baseline", () => {
    const error = capture(() =>
      buildBaselinePromptSnapshot(fakeLoader("Vazamento: sk-abcdefgh12345678")),
    ) as SensitivePromptContentError;

    expect(error).toBeInstanceOf(SensitivePromptContentError);
    expect(error.field).toBe("baseline");
    expect(error.kind).toBe("api_key");
    expect(error.message).not.toContain("sk-abcdefgh");
  });

  it("o prompt oficial real é considerado limpo", () => {
    expect(() => buildBaselinePromptSnapshot()).not.toThrow();
  });

  it("não gera falso positivo em palavras comuns iniciadas por 'sk'", () => {
    expect(findSensitivePromptContent("O skyscraper e o skeleton do anúncio")).toBeNull();
    expect(
      findSensitivePromptContent("Produto em destaque, foto limpa, sem texto."),
    ).toBeNull();
  });

  it("detecta as três categorias declaradas", () => {
    expect(findSensitivePromptContent("Bearer xyzxyzxyz1")).toBe("bearer_token");
    expect(findSensitivePromptContent("sk-abcdefgh12345678")).toBe("api_key");
    expect(findSensitivePromptContent("https://exemplo.com/a")).toBe("url");
  });
});
