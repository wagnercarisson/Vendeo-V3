// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ROLE_POLICY } from "@/lib/campaign/composition-artifacts/role-policy";

import {
  FORBIDDEN_KEY_GROUPS,
  PROVIDER_SIZE,
  SQUARE_BASE_CAPABILITY,
  SQUARE_BASE_FORBIDDEN_KEYS,
  SQUARE_BASE_ORIGIN,
  SQUARE_BASE_PROTOCOL,
  SQUARE_BASE_PROVIDER,
  SQUARE_BASE_ROLE,
  SQUARE_BASE_SOURCE,
  SQUARE_BASE_TARGET,
  SQUARE_BASE_TIMEOUT_MS,
  effectiveTimeout,
} from "../policy";

const FORBIDDEN_MATRIX = [
  ["storagePath", "path_not_accepted"],
  ["path", "path_not_accepted"],
  ["bucket", "path_not_accepted"],
  ["storageBucket", "path_not_accepted"],
  ["url", "url_not_accepted"],
  ["publicUrl", "url_not_accepted"],
  ["signedUrl", "url_not_accepted"],
  ["downloadUrl", "url_not_accepted"],
  ["bytes", "bytes_not_accepted"],
  ["imageBase64", "bytes_not_accepted"],
  ["file", "bytes_not_accepted"],
  ["model", "model_not_accepted"],
  ["modelPrimary", "model_not_accepted"],
  ["modelFallback", "model_not_accepted"],
  ["modelPair", "model_not_accepted"],
  ["quality", "quality_not_accepted"],
  ["prompt", "prompt_not_accepted"],
  ["promptBase", "prompt_not_accepted"],
  ["systemPrompt", "prompt_not_accepted"],
  ["size", "size_not_accepted"],
  ["width", "size_not_accepted"],
  ["height", "size_not_accepted"],
  ["maxRetries", "retry_not_accepted"],
  ["retry", "retry_not_accepted"],
  ["retries", "retry_not_accepted"],
  ["fallback", "retry_not_accepted"],
] as const;

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("F60.4 policy — constantes derivadas de ROLE_POLICY", () => {
  it("SQUARE_BASE_TARGET espelha ROLE_POLICY.square_original (sem literais duplicados)", () => {
    expect(SQUARE_BASE_TARGET.role).toBe(SQUARE_BASE_ROLE);
    expect(SQUARE_BASE_TARGET.role).toBe("square_original");
    expect(SQUARE_BASE_TARGET.format).toBe(ROLE_POLICY.square_original.format);
    expect(SQUARE_BASE_TARGET.width).toBe(ROLE_POLICY.square_original.width);
    expect(SQUARE_BASE_TARGET.height).toBe(ROLE_POLICY.square_original.height);
    expect(SQUARE_BASE_TARGET.mimeType).toBe(ROLE_POLICY.square_original.mimeType);
    expect(SQUARE_BASE_TARGET.format).toBe("1:1");
    expect(SQUARE_BASE_TARGET.width).toBe(1024);
    expect(SQUARE_BASE_TARGET.height).toBe(1024);
    expect(SQUARE_BASE_TARGET.mimeType).toBe("image/jpeg");
    expect(Object.isFrozen(SQUARE_BASE_TARGET)).toBe(true);
  });

  it("PROVIDER_SIZE é template literal de width x height e vale 1024x1024 em runtime", () => {
    expect(PROVIDER_SIZE).toBe(
      `${SQUARE_BASE_TARGET.width}x${SQUARE_BASE_TARGET.height}`,
    );
    expect(PROVIDER_SIZE).toBe("1024x1024");
    expect(PROVIDER_SIZE).not.toBe("1152x2048");
  });

  it("origem/fonte/capability/provider/protocolo são os do design", () => {
    expect(SQUARE_BASE_ORIGIN).toBe("provider_generation");
    expect(SQUARE_BASE_SOURCE).toEqual({ kind: "none" });
    expect(Object.isFrozen(SQUARE_BASE_SOURCE)).toBe(true);
    expect(SQUARE_BASE_CAPABILITY).toBe("campaign_product_image");
    expect(SQUARE_BASE_PROVIDER).toBe("openai");
    expect(SQUARE_BASE_PROTOCOL).toBe("images");
  });

  it("não escreve o literal 1024 em policy.ts (nem em comentário)", () => {
    const source = readFileSync(sourcePath("../policy.ts"), "utf8");
    expect(source).not.toContain("1024");
    expect(source).not.toContain("1152x2048");
  });

  it("policy.ts é módulo puro (sem server-only/sharp/Supabase/crypto/fs)", () => {
    const source = readFileSync(sourcePath("../policy.ts"), "utf8");
    expect(source).not.toMatch(/import\s+"server-only"/);
    expect(source).not.toMatch(/\bsharp\b/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/node:crypto/);
    expect(source).not.toMatch(/node:fs/);
  });
});

describe("F60.4 policy — 26 chaves proibidas", () => {
  it("expõe exatamente 26 chaves distribuídas em 8 grupos", () => {
    expect(SQUARE_BASE_FORBIDDEN_KEYS).toHaveLength(26);
    expect([...SQUARE_BASE_FORBIDDEN_KEYS].sort()).toEqual(
      FORBIDDEN_MATRIX.map(([key]) => key).sort(),
    );
    expect(FORBIDDEN_KEY_GROUPS).toHaveLength(8);
    expect(SQUARE_BASE_FORBIDDEN_KEYS).toHaveLength(
      FORBIDDEN_KEY_GROUPS.reduce((total, group) => total + group.keys.length, 0),
    );
    expect(Object.isFrozen(SQUARE_BASE_FORBIDDEN_KEYS)).toBe(true);
    expect(Object.isFrozen(FORBIDDEN_KEY_GROUPS)).toBe(true);
  });

  it.each(FORBIDDEN_MATRIX)("a chave %s pertence ao grupo %s", (key, reason) => {
    const group = FORBIDDEN_KEY_GROUPS.find((entry) => entry.reason === reason);
    expect(group).toBeDefined();
    expect(group?.keys).toContain(key);
  });

  it("nenhum grupo tem chave vazia ou duplicada entre grupos", () => {
    const flattened = FORBIDDEN_KEY_GROUPS.flatMap((group) => [...group.keys]);
    expect(new Set(flattened).size).toBe(flattened.length);
    for (const key of flattened) {
      expect(key.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("F60.4 policy — timeout efetivo (contrato único: inválido => null)", () => {
  it("sem argumento devolve o padrão de 180 s", () => {
    expect(effectiveTimeout()).toBe(SQUARE_BASE_TIMEOUT_MS);
    expect(SQUARE_BASE_TIMEOUT_MS).toBe(180_000);
  });

  it("prazo menor do chamador prevalece", () => {
    expect(effectiveTimeout(90_000)).toBe(90_000);
    expect(effectiveTimeout(1)).toBe(1);
    expect(effectiveTimeout(SQUARE_BASE_TIMEOUT_MS)).toBe(SQUARE_BASE_TIMEOUT_MS);
  });

  it("nunca alonga um prazo maior que o teto", () => {
    expect(effectiveTimeout(600_000)).toBe(SQUARE_BASE_TIMEOUT_MS);
    expect(effectiveTimeout(SQUARE_BASE_TIMEOUT_MS + 1)).toBe(SQUARE_BASE_TIMEOUT_MS);
  });

  it("devolve exatamente null (e só null) para prazo inválido", () => {
    for (const timeoutMs of [
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(effectiveTimeout(timeoutMs)).toBeNull();
    }
  });
});
